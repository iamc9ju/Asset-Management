import "dotenv/config";
import { randomUUID } from "node:crypto";
import { DataSource } from "typeorm";
import { CreateInitialSchema1789236000000 } from "../../../../database/migrations/1789236000000-CreateInitialSchema";
import { LOGIN_FAILURE_REASON } from "../../application/ports/auth-event.port";
import { CREATE_LOGIN_SESSION_RESULT } from "../../application/ports/auth-session-repository.port";
import { UserOrmEntity } from "../../../iam/infrastructure/typeorm/entities/user.orm-entity";
import { TypeOrmAuthEventRepository } from "./auth-event.repository";
import { TypeOrmAuthSessionRepository } from "./auth-session.repository";
import { AuthRefreshTokenOrmEntity } from "./entities/auth-refresh-token.orm-entity";
import { AuthSessionOrmEntity } from "./entities/auth-session.orm-entity";

const DATABASE_URL = process.env.DATABASE_URL_UNPOOLED;
const describeWithDatabase = DATABASE_URL ? describe : describe.skip;
const DATABASE_STARTUP_ATTEMPTS = 3;
const DATABASE_STARTUP_RETRY_DELAY_MS = 1_000;
const NOW = new Date("2026-09-17T08:00:00.000Z");
const IDLE_EXPIRES_AT = new Date("2026-09-24T08:00:00.000Z");
const ABSOLUTE_EXPIRES_AT = new Date("2026-10-17T08:00:00.000Z");

jest.setTimeout(90_000);

function isTransientDatabaseStartupError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const code = "code" in error ? String(error.code) : undefined;

  return (
    code === "57P01" ||
    code === "57P02" ||
    code === "57P03" ||
    error.message.includes(
      "terminating connection due to administrator command",
    ) ||
    error.message.includes("Connection terminated unexpectedly")
  );
}

async function waitForDatabase(dataSource: DataSource): Promise<void> {
  for (let attempt = 1; attempt <= DATABASE_STARTUP_ATTEMPTS; attempt += 1) {
    try {
      await dataSource.query("SELECT 1");
      return;
    } catch (error) {
      if (
        !isTransientDatabaseStartupError(error) ||
        attempt === DATABASE_STARTUP_ATTEMPTS
      ) {
        throw error;
      }

      await new Promise((resolve) =>
        setTimeout(resolve, DATABASE_STARTUP_RETRY_DELAY_MS),
      );
    }
  }
}

describeWithDatabase("TypeOrmAuthSessionRepository integration", () => {
  const schemaName = `test_auth_login_${randomUUID().replaceAll("-", "_")}`;
  const quotedSchemaName = `"${schemaName}"`;
  const migration = new CreateInitialSchema1789236000000();

  let dataSource: DataSource;
  let repository: TypeOrmAuthSessionRepository;
  let eventRepository: TypeOrmAuthEventRepository;
  let schemaCreated = false;

  beforeAll(async () => {
    if (!DATABASE_URL) {
      throw new Error(
        "DATABASE_URL_UNPOOLED must target a direct development database endpoint",
      );
    }

    if (new URL(DATABASE_URL).hostname.split(".")[0]?.endsWith("-pooler")) {
      throw new Error(
        "DATABASE_URL_UNPOOLED must use a direct endpoint without the -pooler suffix",
      );
    }

    const bootstrapDataSource = new DataSource({
      type: "postgres",
      url: DATABASE_URL,
      poolSize: 1,
      extra: {
        enableChannelBinding: true,
        keepAlive: true,
      },
      synchronize: false,
      logging: false,
    });

    await bootstrapDataSource.initialize();
    await waitForDatabase(bootstrapDataSource);
    await bootstrapDataSource.query(
      "CREATE EXTENSION IF NOT EXISTS citext WITH SCHEMA public",
    );
    await bootstrapDataSource.query(
      "CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA public",
    );
    await bootstrapDataSource.query(`CREATE SCHEMA ${quotedSchemaName}`);
    schemaCreated = true;
    await bootstrapDataSource.destroy();

    dataSource = new DataSource({
      type: "postgres",
      url: DATABASE_URL,
      schema: schemaName,
      poolSize: 1,
      extra: {
        enableChannelBinding: true,
        keepAlive: true,
        options: `-c search_path=${schemaName},public`,
      },
      entities: [
        UserOrmEntity,
        AuthSessionOrmEntity,
        AuthRefreshTokenOrmEntity,
      ],
      synchronize: false,
      logging: false,
    });

    await dataSource.initialize();
    await waitForDatabase(dataSource);
    const queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();
    await migration.up(queryRunner);
    await queryRunner.release();

    repository = new TypeOrmAuthSessionRepository(dataSource);
    eventRepository = new TypeOrmAuthEventRepository(dataSource);
  });

  beforeEach(async () => {
    await dataSource.query(`
      TRUNCATE TABLE
        activity_logs,
        auth_refresh_tokens,
        auth_sessions,
        users
      CASCADE
    `);
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      try {
        if (schemaCreated) {
          await dataSource.query(`DROP SCHEMA ${quotedSchemaName} CASCADE`);
          schemaCreated = false;
        }
      } finally {
        await dataSource.destroy();
      }
    }
  });

  async function insertUser(status: "ACTIVE" | "INACTIVE" = "ACTIVE") {
    const userId = randomUUID();

    await dataSource.query(
      `
        INSERT INTO users (id, email, password_hash, display_name, status)
        VALUES ($1, $2, $3, $4, $5)
      `,
      [
        userId,
        `${randomUUID()}@example.com`,
        "$argon2id$integration-test-hash",
        "Login Integration User",
        status,
      ],
    );

    return userId;
  }

  function createInput(
    userId: string,
    overrides: Partial<{
      sessionId: string;
      refreshTokenId: string;
      refreshTokenHash: string;
      occurredAt: Date;
    }> = {},
  ) {
    return {
      sessionId: overrides.sessionId ?? randomUUID(),
      userId,
      deviceLabel: "Integration Browser",
      idleExpiresAt: IDLE_EXPIRES_AT,
      absoluteExpiresAt: ABSOLUTE_EXPIRES_AT,
      refreshTokenId: overrides.refreshTokenId ?? randomUUID(),
      refreshTokenHash: overrides.refreshTokenHash ?? "a".repeat(64),
      occurredAt: overrides.occurredAt ?? NOW,
      client: {
        requestId: randomUUID(),
        ipAddress: "127.0.0.1",
        userAgent: "Repository integration test",
      },
    };
  }

  it("creates the session, token, user update, and success activity atomically", async () => {
    const userId = await insertUser();
    const input = createInput(userId);

    await expect(repository.createLoginSession(input)).resolves.toBe(
      CREATE_LOGIN_SESSION_RESULT.CREATED,
    );

    const [session] = (await dataSource.query(
      "SELECT * FROM auth_sessions WHERE id = $1",
      [input.sessionId],
    )) as Array<Record<string, unknown>>;
    const [refreshToken] = (await dataSource.query(
      "SELECT * FROM auth_refresh_tokens WHERE id = $1",
      [input.refreshTokenId],
    )) as Array<Record<string, unknown>>;
    const [user] = (await dataSource.query(
      "SELECT last_login_at, version FROM users WHERE id = $1",
      [userId],
    )) as Array<Record<string, unknown>>;
    const [activity] = (await dataSource.query(
      "SELECT * FROM activity_logs WHERE entity_id = $1",
      [input.sessionId],
    )) as Array<Record<string, unknown>>;

    expect(session).toMatchObject({
      user_id: userId,
      device_label: "Integration Browser",
      ip_created: "127.0.0.1",
      user_agent_created: "Repository integration test",
      revoked_at: null,
    });
    expect(refreshToken).toMatchObject({
      session_id: input.sessionId,
      token_hash: "a".repeat(64),
      used_at: null,
      revoked_at: null,
    });
    expect(user?.last_login_at).toEqual(NOW);
    expect(user?.version).toBe("2");
    expect(activity).toMatchObject({
      actor_user_id: userId,
      actor_type: "USER",
      action: "LOGIN_SUCCEEDED",
      entity_type: "AUTH_SESSION",
      entity_id: input.sessionId,
      outcome: "SUCCESS",
      request_id: input.client.requestId,
    });
  });

  it("does not create a session when the user is not active", async () => {
    const userId = await insertUser("INACTIVE");

    await expect(
      repository.createLoginSession(createInput(userId)),
    ).resolves.toBe(CREATE_LOGIN_SESSION_RESULT.USER_NOT_ACTIVE);

    const countRows = (await dataSource.query(
      "SELECT count(*)::int AS count FROM auth_sessions",
    )) as Array<{ count: number }>;
    const [user] = (await dataSource.query(
      "SELECT last_login_at, version FROM users WHERE id = $1",
      [userId],
    )) as Array<{ last_login_at: Date | null; version: string }>;

    expect(countRows[0]).toEqual({ count: 0 });
    expect(user).toEqual({ last_login_at: null, version: "1" });
  });

  it("rolls back the user update and session when the token insert fails", async () => {
    const userId = await insertUser();
    const sharedHash = "b".repeat(64);
    const firstInput = createInput(userId, { refreshTokenHash: sharedHash });
    await repository.createLoginSession(firstInput);

    const later = new Date("2026-09-17T09:00:00.000Z");
    const conflictingInput = createInput(userId, {
      refreshTokenHash: sharedHash,
      occurredAt: later,
    });

    await expect(
      repository.createLoginSession(conflictingInput),
    ).rejects.toBeDefined();

    const sessionCountRows = (await dataSource.query(
      "SELECT count(*)::int AS session_count FROM auth_sessions",
    )) as Array<{ session_count: number }>;
    const [user] = (await dataSource.query(
      "SELECT last_login_at, version FROM users WHERE id = $1",
      [userId],
    )) as Array<{ last_login_at: Date; version: string }>;

    expect(sessionCountRows[0]).toEqual({ session_count: 1 });
    expect(user).toEqual({ last_login_at: NOW, version: "2" });
  });

  it("records only allowlisted failure metadata", async () => {
    const requestId = randomUUID();

    await eventRepository.recordLoginFailure({
      targetUserId: null,
      reason: LOGIN_FAILURE_REASON.UNKNOWN_IDENTITY,
      occurredAt: NOW,
      client: {
        requestId,
        ipAddress: "127.0.0.1",
        userAgent: "Repository integration test",
      },
    });

    const [activity] = (await dataSource.query(
      "SELECT * FROM activity_logs WHERE request_id = $1",
      [requestId],
    )) as Array<Record<string, unknown>>;

    expect(activity).toMatchObject({
      actor_user_id: null,
      actor_type: "ANONYMOUS",
      action: "LOGIN_FAILED",
      entity_type: "AUTHENTICATION",
      entity_id: null,
      metadata: { reason: LOGIN_FAILURE_REASON.UNKNOWN_IDENTITY },
      outcome: "DENIED",
    });
    expect(JSON.stringify(activity)).not.toContain("password");
    expect(JSON.stringify(activity)).not.toContain("@example.com");
  });
});
