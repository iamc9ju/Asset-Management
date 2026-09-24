import "dotenv/config";
import { randomUUID } from "node:crypto";
import { DataSource } from "typeorm";
import { CreateInitialSchema1789236000000 } from "../../../../database/migrations/1789236000000-CreateInitialSchema";
import {
  assertDirectTestDatabaseUrl,
  initializeTestDataSource,
  isTransientTestDatabaseError,
  TEST_DATABASE_SUITE_TIMEOUT_MS,
  waitForTestDatabase,
} from "../../../../database/testing/test-database";
import { LOGIN_FAILURE_REASON } from "../../application/ports/auth-event.port";
import { CREATE_LOGIN_SESSION_RESULT } from "../../application/ports/auth-session-repository.port";
import { ROTATE_REFRESH_SESSION_RESULT } from "../../application/ports/refresh-session-repository.port";
import { AUTH_SESSION_REVOKE_REASON } from "../../domain/auth.constants";
import { UserOrmEntity } from "../../../iam/infrastructure/typeorm/entities/user.orm-entity";
import { OpaqueRefreshTokenService } from "../crypto/opaque-refresh-token.service";
import { TypeOrmAuthEventRepository } from "./auth-event.repository";
import { TypeOrmAuthSessionQueryRepository } from "./auth-session-query.repository";
import { TypeOrmAuthSessionRepository } from "./auth-session.repository";
import { TypeOrmRefreshSessionRepository } from "./refresh-session.repository";
import { TypeOrmSessionManagementRepository } from "./session-management.repository";
import { AuthRefreshTokenOrmEntity } from "./entities/auth-refresh-token.orm-entity";
import { AuthSessionOrmEntity } from "./entities/auth-session.orm-entity";

const DATABASE_URL = process.env.DATABASE_URL_UNPOOLED;
const describeWithDatabase = DATABASE_URL ? describe : describe.skip;
const NOW = new Date("2026-09-17T08:00:00.000Z");
const IDLE_EXPIRES_AT = new Date("2026-09-24T08:00:00.000Z");
const ABSOLUTE_EXPIRES_AT = new Date("2026-10-17T08:00:00.000Z");

jest.setTimeout(TEST_DATABASE_SUITE_TIMEOUT_MS);

describeWithDatabase("TypeOrmAuthSessionRepository integration", () => {
  const schemaName = `test_auth_login_${randomUUID().replaceAll("-", "_")}`;
  const quotedSchemaName = `"${schemaName}"`;
  const migration = new CreateInitialSchema1789236000000();

  let dataSource: DataSource;
  let repository: TypeOrmAuthSessionRepository;
  let refreshRepository: TypeOrmRefreshSessionRepository;
  let sessionManagementRepository: TypeOrmSessionManagementRepository;
  let sessionQueryRepository: TypeOrmAuthSessionQueryRepository;
  let eventRepository: TypeOrmAuthEventRepository;
  let schemaCreated = false;

  beforeAll(async () => {
    assertDirectTestDatabaseUrl(DATABASE_URL);

    const bootstrapDataSource = await initializeTestDataSource(
      () =>
        new DataSource({
          type: "postgres",
          url: DATABASE_URL,
          poolSize: 1,
          extra: {
            enableChannelBinding: true,
            keepAlive: true,
          },
          connectTimeoutMS: 15_000,
          synchronize: false,
          logging: false,
        }),
    );

    try {
      await bootstrapDataSource.query(
        "CREATE EXTENSION IF NOT EXISTS citext WITH SCHEMA public",
      );
      await bootstrapDataSource.query(
        "CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA public",
      );
      await bootstrapDataSource.query(`CREATE SCHEMA ${quotedSchemaName}`);
      schemaCreated = true;
    } finally {
      if (bootstrapDataSource.isInitialized) {
        await bootstrapDataSource.destroy();
      }
    }

    dataSource = await initializeTestDataSource(
      () =>
        new DataSource({
          type: "postgres",
          url: DATABASE_URL,
          schema: schemaName,
          poolSize: 1,
          extra: {
            enableChannelBinding: true,
            keepAlive: true,
            options: `-c search_path=${schemaName},public`,
          },
          connectTimeoutMS: 15_000,
          entities: [
            UserOrmEntity,
            AuthSessionOrmEntity,
            AuthRefreshTokenOrmEntity,
          ],
          synchronize: false,
          logging: false,
        }),
    );
    const queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();
    await migration.up(queryRunner);
    await queryRunner.release();

    repository = new TypeOrmAuthSessionRepository(dataSource);
    refreshRepository = new TypeOrmRefreshSessionRepository(
      dataSource,
      new OpaqueRefreshTokenService(),
    );
    sessionManagementRepository = new TypeOrmSessionManagementRepository(
      dataSource,
      new OpaqueRefreshTokenService(),
    );
    sessionQueryRepository = new TypeOrmAuthSessionQueryRepository(
      dataSource.getRepository(AuthSessionOrmEntity),
    );
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
          try {
            await dataSource.query(`DROP SCHEMA ${quotedSchemaName} CASCADE`);
          } catch (error) {
            if (!isTransientTestDatabaseError(error)) {
              throw error;
            }

            await waitForTestDatabase(dataSource);
            await dataSource.query(`DROP SCHEMA ${quotedSchemaName} CASCADE`);
          }

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

  function createRotationInput(
    input: ReturnType<typeof createInput>,
    overrides: Partial<{
      currentTokenHash: string;
      replacementTokenId: string;
      replacementTokenHash: string;
      occurredAt: Date;
      requestId: string;
    }> = {},
  ) {
    return {
      currentTokenId: input.refreshTokenId,
      currentTokenHash: overrides.currentTokenHash ?? input.refreshTokenHash,
      replacementTokenId: overrides.replacementTokenId ?? randomUUID(),
      replacementTokenHash: overrides.replacementTokenHash ?? "b".repeat(64),
      idleTtlSeconds: 604_800,
      occurredAt: overrides.occurredAt ?? new Date("2026-09-18T08:00:00.000Z"),
      client: {
        requestId: overrides.requestId ?? randomUUID(),
        ipAddress: "127.0.0.2",
        userAgent: "Refresh repository integration test",
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

  it("loads current session state only for the matching user", async () => {
    const userId = await insertUser();
    const input = createInput(userId);
    await repository.createLoginSession(input);

    await expect(
      sessionQueryRepository.findByIdAndUserId(input.sessionId, userId),
    ).resolves.toEqual({
      sessionId: input.sessionId,
      userId,
      idleExpiresAt: IDLE_EXPIRES_AT,
      absoluteExpiresAt: ABSOLUTE_EXPIRES_AT,
      revokedAt: null,
    });
    await expect(
      sessionQueryRepository.findByIdAndUserId(input.sessionId, randomUUID()),
    ).resolves.toBeNull();
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

  it("rotates a refresh token and extends idle expiry atomically", async () => {
    const userId = await insertUser();
    const loginInput = createInput(userId);
    await repository.createLoginSession(loginInput);
    const rotationInput = createRotationInput(loginInput);

    await expect(refreshRepository.rotate(rotationInput)).resolves.toEqual({
      status: ROTATE_REFRESH_SESSION_RESULT.ROTATED,
      userId,
      sessionId: loginInput.sessionId,
      refreshTokenExpiresAt: ABSOLUTE_EXPIRES_AT,
    });

    const [oldToken] = (await dataSource.query(
      "SELECT used_at, replaced_by_token_id, ip_used FROM auth_refresh_tokens WHERE id = $1",
      [loginInput.refreshTokenId],
    )) as Array<Record<string, unknown>>;
    const [replacement] = (await dataSource.query(
      "SELECT session_id, parent_token_id, token_hash, expires_at FROM auth_refresh_tokens WHERE id = $1",
      [rotationInput.replacementTokenId],
    )) as Array<Record<string, unknown>>;
    const [session] = (await dataSource.query(
      "SELECT last_used_at, idle_expires_at, revoked_at FROM auth_sessions WHERE id = $1",
      [loginInput.sessionId],
    )) as Array<Record<string, unknown>>;
    const [activity] = (await dataSource.query(
      "SELECT action, outcome, request_id FROM activity_logs WHERE request_id = $1",
      [rotationInput.client.requestId],
    )) as Array<Record<string, unknown>>;

    expect(oldToken).toMatchObject({
      used_at: rotationInput.occurredAt,
      replaced_by_token_id: rotationInput.replacementTokenId,
      ip_used: "127.0.0.2",
    });
    expect(replacement).toMatchObject({
      session_id: loginInput.sessionId,
      parent_token_id: loginInput.refreshTokenId,
      token_hash: rotationInput.replacementTokenHash,
      expires_at: ABSOLUTE_EXPIRES_AT,
    });
    expect(session).toMatchObject({
      last_used_at: rotationInput.occurredAt,
      idle_expires_at: new Date("2026-09-25T08:00:00.000Z"),
      revoked_at: null,
    });
    expect(activity).toEqual({
      action: "TOKEN_REFRESHED",
      outcome: "SUCCESS",
      request_id: rotationInput.client.requestId,
    });
  });

  it("does not revoke a session when the selector exists but the secret hash is wrong", async () => {
    const userId = await insertUser();
    const loginInput = createInput(userId);
    await repository.createLoginSession(loginInput);
    const rotationInput = createRotationInput(loginInput, {
      currentTokenHash: "f".repeat(64),
    });

    await expect(refreshRepository.rotate(rotationInput)).resolves.toEqual({
      status: ROTATE_REFRESH_SESSION_RESULT.INVALID,
    });

    const [session] = (await dataSource.query(
      "SELECT revoked_at, revoke_reason FROM auth_sessions WHERE id = $1",
      [loginInput.sessionId],
    )) as Array<Record<string, unknown>>;
    const tokenCountRows = (await dataSource.query(
      "SELECT count(*)::int AS count FROM auth_refresh_tokens WHERE session_id = $1",
      [loginInput.sessionId],
    )) as Array<{ count: number }>;

    expect(session).toEqual({ revoked_at: null, revoke_reason: null });
    expect(tokenCountRows[0]).toEqual({ count: 1 });
  });

  it("rolls back the rotation when successor persistence fails", async () => {
    const userId = await insertUser();
    const loginInput = createInput(userId);
    await repository.createLoginSession(loginInput);
    const rotationInput = createRotationInput(loginInput, {
      replacementTokenHash: loginInput.refreshTokenHash,
    });
    const [sessionBeforeRotation] = (await dataSource.query(
      "SELECT last_used_at, idle_expires_at FROM auth_sessions WHERE id = $1",
      [loginInput.sessionId],
    )) as Array<Record<string, unknown>>;

    await expect(refreshRepository.rotate(rotationInput)).rejects.toBeDefined();

    const [token] = (await dataSource.query(
      "SELECT used_at, replaced_by_token_id FROM auth_refresh_tokens WHERE id = $1",
      [loginInput.refreshTokenId],
    )) as Array<Record<string, unknown>>;
    const [session] = (await dataSource.query(
      "SELECT last_used_at, idle_expires_at FROM auth_sessions WHERE id = $1",
      [loginInput.sessionId],
    )) as Array<Record<string, unknown>>;
    const activityCountRows = (await dataSource.query(
      "SELECT count(*)::int AS count FROM activity_logs WHERE request_id = $1",
      [rotationInput.client.requestId],
    )) as Array<{ count: number }>;

    expect(token).toEqual({ used_at: null, replaced_by_token_id: null });
    expect(session).toEqual(sessionBeforeRotation);
    expect(activityCountRows[0]).toEqual({ count: 0 });
  });

  it("revokes the entire token family when an authenticated used token is presented again", async () => {
    const userId = await insertUser();
    const loginInput = createInput(userId);
    await repository.createLoginSession(loginInput);
    const firstRotation = createRotationInput(loginInput);
    await refreshRepository.rotate(firstRotation);
    const reuseOccurredAt = new Date("2026-09-18T08:01:00.000Z");
    const reuseInput = createRotationInput(loginInput, {
      replacementTokenId: randomUUID(),
      replacementTokenHash: "c".repeat(64),
      occurredAt: reuseOccurredAt,
    });

    await expect(refreshRepository.rotate(reuseInput)).resolves.toEqual({
      status: ROTATE_REFRESH_SESSION_RESULT.REUSED,
    });

    const [session] = (await dataSource.query(
      "SELECT revoked_at, revoke_reason FROM auth_sessions WHERE id = $1",
      [loginInput.sessionId],
    )) as Array<Record<string, unknown>>;
    const tokens = (await dataSource.query(
      "SELECT revoked_at FROM auth_refresh_tokens WHERE session_id = $1 ORDER BY issued_at",
      [loginInput.sessionId],
    )) as Array<Record<string, unknown>>;
    const [activity] = (await dataSource.query(
      "SELECT action, outcome FROM activity_logs WHERE request_id = $1",
      [reuseInput.client.requestId],
    )) as Array<Record<string, unknown>>;

    expect(session).toEqual({
      revoked_at: reuseOccurredAt,
      revoke_reason: AUTH_SESSION_REVOKE_REASON.REFRESH_TOKEN_REUSE,
    });
    expect(tokens).toHaveLength(2);
    expect(tokens).toEqual([
      { revoked_at: reuseOccurredAt },
      { revoked_at: reuseOccurredAt },
    ]);
    expect(activity).toEqual({
      action: "REFRESH_TOKEN_REUSE_DETECTED",
      outcome: "DENIED",
    });
  });

  it("allows only one rotation attempt to succeed for the same current token", async () => {
    const userId = await insertUser();
    const loginInput = createInput(userId);
    await repository.createLoginSession(loginInput);
    const firstInput = createRotationInput(loginInput, {
      replacementTokenHash: "b".repeat(64),
    });
    const secondInput = createRotationInput(loginInput, {
      replacementTokenHash: "c".repeat(64),
      occurredAt: new Date(firstInput.occurredAt.getTime() - 1),
    });

    const results = await Promise.all([
      refreshRepository.rotate(firstInput),
      refreshRepository.rotate(secondInput),
    ]);

    expect(results.map((result) => result.status).sort()).toEqual(
      [
        ROTATE_REFRESH_SESSION_RESULT.REUSED,
        ROTATE_REFRESH_SESSION_RESULT.ROTATED,
      ].sort(),
    );
  });

  it("rejects an expired idle window without creating a successor", async () => {
    const userId = await insertUser();
    const loginInput = createInput(userId);
    await repository.createLoginSession(loginInput);
    const rotationInput = createRotationInput(loginInput, {
      occurredAt: IDLE_EXPIRES_AT,
    });

    await expect(refreshRepository.rotate(rotationInput)).resolves.toEqual({
      status: ROTATE_REFRESH_SESSION_RESULT.EXPIRED,
    });

    const tokenCountRows = (await dataSource.query(
      "SELECT count(*)::int AS count FROM auth_refresh_tokens WHERE session_id = $1",
      [loginInput.sessionId],
    )) as Array<{ count: number }>;
    expect(tokenCountRows[0]).toEqual({ count: 1 });
  });

  it("logs out a valid refresh credential idempotently and revokes its token family", async () => {
    const userId = await insertUser();
    const loginInput = createInput(userId);
    await repository.createLoginSession(loginInput);
    const logoutOccurredAt = new Date("2026-09-18T09:00:00.000Z");
    const logoutInput = {
      tokenId: loginInput.refreshTokenId,
      tokenHash: loginInput.refreshTokenHash,
      occurredAt: logoutOccurredAt,
      client: {
        requestId: randomUUID(),
        ipAddress: "127.0.0.3",
        userAgent: "Logout repository integration test",
      },
    };

    await expect(
      sessionManagementRepository.logoutByRefreshCredential(logoutInput),
    ).resolves.toBeUndefined();
    await expect(
      sessionManagementRepository.logoutByRefreshCredential(logoutInput),
    ).resolves.toBeUndefined();

    const [session] = (await dataSource.query(
      "SELECT revoked_at, revoke_reason FROM auth_sessions WHERE id = $1",
      [loginInput.sessionId],
    )) as Array<Record<string, unknown>>;
    const [token] = (await dataSource.query(
      "SELECT revoked_at FROM auth_refresh_tokens WHERE id = $1",
      [loginInput.refreshTokenId],
    )) as Array<Record<string, unknown>>;
    const activities = (await dataSource.query(
      "SELECT action, outcome FROM activity_logs WHERE request_id = $1",
      [logoutInput.client.requestId],
    )) as Array<Record<string, unknown>>;

    expect(session).toEqual({
      revoked_at: logoutOccurredAt,
      revoke_reason: AUTH_SESSION_REVOKE_REASON.USER_LOGOUT,
    });
    expect(token).toEqual({ revoked_at: logoutOccurredAt });
    expect(activities).toEqual([
      { action: "LOGOUT_SUCCEEDED", outcome: "SUCCESS" },
    ]);
  });

  it("does not revoke a session when logout has the right selector but wrong secret", async () => {
    const userId = await insertUser();
    const loginInput = createInput(userId);
    await repository.createLoginSession(loginInput);

    await sessionManagementRepository.logoutByRefreshCredential({
      tokenId: loginInput.refreshTokenId,
      tokenHash: "f".repeat(64),
      occurredAt: new Date("2026-09-18T09:00:00.000Z"),
      client: {
        requestId: randomUUID(),
        ipAddress: null,
        userAgent: null,
      },
    });

    const [session] = (await dataSource.query(
      "SELECT revoked_at, revoke_reason FROM auth_sessions WHERE id = $1",
      [loginInput.sessionId],
    )) as Array<Record<string, unknown>>;

    expect(session).toEqual({ revoked_at: null, revoke_reason: null });
  });

  it("lists only active, unexpired sessions for the requested user", async () => {
    const userId = await insertUser();
    const otherUserId = await insertUser();
    const currentInput = createInput(userId);
    const expiredInput = createInput(userId, {
      refreshTokenHash: "b".repeat(64),
    });
    const otherInput = createInput(otherUserId, {
      refreshTokenHash: "c".repeat(64),
    });
    await repository.createLoginSession(currentInput);
    await repository.createLoginSession(expiredInput);
    await repository.createLoginSession(otherInput);
    await dataSource.query(
      "UPDATE auth_sessions SET idle_expires_at = $1 WHERE id = $2",
      [new Date("2026-09-18T08:30:00.000Z"), expiredInput.sessionId],
    );

    await expect(
      sessionManagementRepository.listActiveByUserId(
        userId,
        new Date("2026-09-18T09:00:00.000Z"),
      ),
    ).resolves.toEqual([
      expect.objectContaining({
        sessionId: currentInput.sessionId,
        userId,
        deviceLabel: "Integration Browser",
        revokedAt: null,
      }),
    ]);
  });

  it("revokes one session and records the actor and reason atomically", async () => {
    const actorUserId = await insertUser();
    const targetUserId = await insertUser();
    const targetInput = createInput(targetUserId);
    await repository.createLoginSession(targetInput);
    const requestId = randomUUID();
    const occurredAt = new Date("2026-09-18T10:00:00.000Z");

    await expect(
      sessionManagementRepository.revokeById({
        sessionId: targetInput.sessionId,
        actorUserId,
        reason: AUTH_SESSION_REVOKE_REASON.ADMIN_REVOKED_SESSION,
        occurredAt,
        client: {
          requestId,
          ipAddress: "127.0.0.4",
          userAgent: "Session revocation integration test",
        },
      }),
    ).resolves.toBe(true);
    await expect(
      sessionManagementRepository.revokeById({
        sessionId: targetInput.sessionId,
        actorUserId,
        reason: AUTH_SESSION_REVOKE_REASON.ADMIN_REVOKED_SESSION,
        occurredAt: new Date(occurredAt.getTime() + 1_000),
        client: {
          requestId,
          ipAddress: "127.0.0.4",
          userAgent: "Session revocation integration test",
        },
      }),
    ).resolves.toBe(true);

    const [session] = (await dataSource.query(
      "SELECT revoked_at, revoke_reason FROM auth_sessions WHERE id = $1",
      [targetInput.sessionId],
    )) as Array<Record<string, unknown>>;
    const [token] = (await dataSource.query(
      "SELECT revoked_at FROM auth_refresh_tokens WHERE id = $1",
      [targetInput.refreshTokenId],
    )) as Array<Record<string, unknown>>;
    const activities = (await dataSource.query(
      "SELECT actor_user_id, action, entity_id, metadata FROM activity_logs WHERE request_id = $1",
      [requestId],
    )) as Array<Record<string, unknown>>;

    expect(session).toEqual({
      revoked_at: occurredAt,
      revoke_reason: AUTH_SESSION_REVOKE_REASON.ADMIN_REVOKED_SESSION,
    });
    expect(token).toEqual({ revoked_at: occurredAt });
    expect(activities).toEqual([
      {
        actor_user_id: actorUserId,
        action: "SESSION_REVOKED",
        entity_id: targetInput.sessionId,
        metadata: {
          reason: AUTH_SESSION_REVOKE_REASON.ADMIN_REVOKED_SESSION,
        },
      },
    ]);
  });

  it("revokes all sessions for one user without affecting another user", async () => {
    const userId = await insertUser();
    const otherUserId = await insertUser();
    const firstInput = createInput(userId);
    const secondInput = createInput(userId, {
      refreshTokenHash: "b".repeat(64),
    });
    const otherInput = createInput(otherUserId, {
      refreshTokenHash: "c".repeat(64),
    });
    await repository.createLoginSession(firstInput);
    await repository.createLoginSession(secondInput);
    await repository.createLoginSession(otherInput);
    const requestId = randomUUID();

    await expect(
      sessionManagementRepository.revokeAllByUserId({
        userId,
        actorUserId: userId,
        reason: AUTH_SESSION_REVOKE_REASON.USER_REVOKED_ALL_SESSIONS,
        occurredAt: new Date("2026-09-18T11:00:00.000Z"),
        client: {
          requestId,
          ipAddress: null,
          userAgent: "Revoke all integration test",
        },
      }),
    ).resolves.toBe(2);

    const sessions = (await dataSource.query(
      "SELECT user_id, revoked_at FROM auth_sessions ORDER BY user_id, id",
    )) as Array<{ user_id: string; revoked_at: Date | null }>;
    const activityCountRows = (await dataSource.query(
      "SELECT count(*)::int AS count FROM activity_logs WHERE request_id = $1",
      [requestId],
    )) as Array<{ count: number }>;

    expect(sessions.filter((session) => session.user_id === userId)).toEqual([
      expect.objectContaining({ revoked_at: expect.any(Date) }),
      expect.objectContaining({ revoked_at: expect.any(Date) }),
    ]);
    expect(sessions.find((session) => session.user_id === otherUserId)).toEqual(
      expect.objectContaining({ revoked_at: null }),
    );
    expect(activityCountRows[0]).toEqual({ count: 2 });
  });
});
