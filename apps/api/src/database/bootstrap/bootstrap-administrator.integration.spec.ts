import "dotenv/config";
import { randomUUID } from "node:crypto";
import { DataSource } from "typeorm";
import type { IdentifierGenerator } from "../../modules/auth/application/ports/identifier-generator.port";
import type { PasswordHasher } from "../../modules/auth/application/ports/password-hasher.port";
import { Argon2PasswordHasher } from "../../modules/auth/infrastructure/crypto/argon2-password-hasher";
import { SystemClock } from "../../modules/auth/infrastructure/time/system-clock";
import { CreateInitialSchema1789236000000 } from "../migrations/1789236000000-CreateInitialSchema";
import { SYSTEM_ROLE_CODE } from "../seeds/permission-role.catalog";
import { seedPermissionsAndRoles } from "../seeds/seed-permissions-and-roles";
import {
  assertDirectTestDatabaseUrl,
  initializeTestDataSource,
  TEST_DATABASE_SUITE_TIMEOUT_MS,
} from "../testing/test-database";
import {
  BootstrapAdministratorAlreadyExistsError,
  BootstrapAdministratorEmailConflictError,
  SystemAdministratorRoleUnavailableError,
} from "./bootstrap-administrator.error";
import type { BootstrapAdministratorInput } from "./bootstrap-administrator.input";
import {
  BOOTSTRAP_ADMINISTRATOR_ACTIVITY,
  BOOTSTRAP_ADMINISTRATOR_RESULT,
  bootstrapAdministrator,
  type BootstrapAdministratorDependencies,
} from "./bootstrap-administrator";

const DATABASE_URL = process.env.DATABASE_URL_UNPOOLED;
assertDirectTestDatabaseUrl(DATABASE_URL);
const FAST_TEST_PASSWORD_HASH = "$argon2id$bootstrap-integration-test-hash";

jest.setTimeout(TEST_DATABASE_SUITE_TIMEOUT_MS);

interface AdministratorStateRow {
  readonly id: string;
  readonly email: string;
  readonly password_hash: string;
  readonly display_name: string;
  readonly status: string;
  readonly permission_version: string;
  readonly version: string;
  readonly role_code: string;
  readonly granted_by: string | null;
}

interface ActivityRow {
  readonly actor_user_id: string | null;
  readonly actor_type: string;
  readonly action: string;
  readonly entity_type: string;
  readonly entity_id: string;
  readonly metadata: Record<string, unknown>;
  readonly outcome: string;
}

interface CountRow {
  readonly count: number;
}

const fastPasswordHasher: PasswordHasher = {
  hash: jest.fn(async () => FAST_TEST_PASSWORD_HASH),
  verify: jest.fn(async () => true),
  consumeVerificationCost: jest.fn(async () => undefined),
};

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}

function createInput(
  email = "admin@example.com",
  password = "correct horse battery staple",
): BootstrapAdministratorInput {
  return {
    email,
    displayName: "System Administrator",
    password,
  };
}

function createDependencies(
  passwordHasher: PasswordHasher = fastPasswordHasher,
): BootstrapAdministratorDependencies {
  const identifierGenerator: IdentifierGenerator = {
    generate: () => randomUUID(),
  };

  return {
    clock: new SystemClock(),
    identifierGenerator,
    passwordHasher,
  };
}

describe("bootstrap administrator integration", () => {
  const schemaName = `test_admin_bootstrap_${randomUUID().replaceAll("-", "_")}`;
  const quotedSchemaName = quoteIdentifier(schemaName);
  const migration = new CreateInitialSchema1789236000000();

  let dataSource: DataSource;
  let schemaCreated = false;
  let migrationApplied = false;

  beforeAll(async () => {
    dataSource = await initializeTestDataSource(
      () =>
        new DataSource({
          type: "postgres",
          url: DATABASE_URL,
          poolSize: 2,
          extra: {
            enableChannelBinding: true,
            keepAlive: true,
            options: `-c search_path=${schemaName},public`,
          },
          connectTimeoutMS: 15_000,
          synchronize: false,
          logging: false,
        }),
    );
    await dataSource.query(
      "CREATE EXTENSION IF NOT EXISTS citext WITH SCHEMA public",
    );
    await dataSource.query(
      "CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA public",
    );
    await dataSource.query(`CREATE SCHEMA ${quotedSchemaName}`);
    schemaCreated = true;

    const queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();

    try {
      await migration.up(queryRunner);
      migrationApplied = true;
    } finally {
      await queryRunner.release();
    }
  });

  beforeEach(async () => {
    await dataSource.query("TRUNCATE TABLE users, roles, permissions CASCADE");
    await seedPermissionsAndRoles(dataSource);
    jest.clearAllMocks();
  });

  afterAll(async () => {
    if (!dataSource?.isInitialized) {
      return;
    }

    try {
      if (migrationApplied) {
        const queryRunner = dataSource.createQueryRunner();
        await queryRunner.connect();

        try {
          await migration.down(queryRunner);
          migrationApplied = false;
        } finally {
          await queryRunner.release();
        }
      }

      if (schemaCreated) {
        await dataSource.query(
          `DROP SCHEMA IF EXISTS ${quotedSchemaName} CASCADE`,
        );
        schemaCreated = false;
      }
    } finally {
      await dataSource.destroy();
    }
  });

  it("creates a login-compatible administrator, role assignment, and activity atomically", async () => {
    const passwordHasher = new Argon2PasswordHasher();
    const input = createInput();

    const result = await bootstrapAdministrator(
      dataSource,
      createDependencies(passwordHasher),
      input,
    );

    expect(result.status).toBe(BOOTSTRAP_ADMINISTRATOR_RESULT.CREATED);

    const userRows = (await dataSource.query(
      `
        SELECT
          users.id,
          users.email::text AS email,
          users.password_hash,
          users.display_name,
          users.status,
          users.permission_version,
          users.version,
          roles.code AS role_code,
          user_roles.granted_by
        FROM users
        INNER JOIN user_roles ON user_roles.user_id = users.id
        INNER JOIN roles ON roles.id = user_roles.role_id
        WHERE users.id = $1
      `,
      [result.userId],
    )) as AdministratorStateRow[];
    const user = userRows[0];

    expect(user).toMatchObject({
      email: input.email,
      display_name: input.displayName,
      status: "ACTIVE",
      permission_version: "1",
      version: "1",
      role_code: SYSTEM_ROLE_CODE.SYSTEM_ADMIN,
      granted_by: null,
    });
    expect(user?.password_hash).not.toBe(input.password);
    await expect(
      passwordHasher.verify(user?.password_hash ?? "", input.password),
    ).resolves.toBe(true);

    const activityRows = (await dataSource.query(
      `
        SELECT
          actor_user_id,
          actor_type,
          action,
          entity_type,
          entity_id,
          metadata,
          outcome
        FROM activity_logs
        WHERE entity_id = $1
      `,
      [result.userId],
    )) as ActivityRow[];

    expect(activityRows).toEqual([
      {
        actor_user_id: null,
        actor_type: BOOTSTRAP_ADMINISTRATOR_ACTIVITY.ACTOR_TYPE,
        action: BOOTSTRAP_ADMINISTRATOR_ACTIVITY.ACTION,
        entity_type: BOOTSTRAP_ADMINISTRATOR_ACTIVITY.ENTITY_TYPE,
        entity_id: result.userId,
        metadata: { roleCode: SYSTEM_ROLE_CODE.SYSTEM_ADMIN },
        outcome: BOOTSTRAP_ADMINISTRATOR_ACTIVITY.OUTCOME,
      },
    ]);
  });

  it("is idempotent for the same normalized email without resetting credentials", async () => {
    const passwordHasher = new Argon2PasswordHasher();
    const firstInput = createInput(
      "admin@example.com",
      "first secure passphrase",
    );
    const secondInput = createInput(
      "ADMIN@EXAMPLE.COM",
      "different secure passphrase",
    );
    const dependencies = createDependencies(passwordHasher);

    const firstResult = await bootstrapAdministrator(
      dataSource,
      dependencies,
      firstInput,
    );
    const secondResult = await bootstrapAdministrator(
      dataSource,
      dependencies,
      secondInput,
    );

    expect(secondResult).toEqual({
      status: BOOTSTRAP_ADMINISTRATOR_RESULT.ALREADY_EXISTS,
      userId: firstResult.userId,
    });

    const rows = (await dataSource.query(
      `
        SELECT
          count(*)::integer AS count,
          min(password_hash) AS password_hash,
          min(display_name) AS display_name
        FROM users
      `,
    )) as Array<{
      readonly count: number;
      readonly password_hash: string;
      readonly display_name: string;
    }>;
    const state = rows[0];

    expect(state).toMatchObject({
      count: 1,
      display_name: firstInput.displayName,
    });
    await expect(
      passwordHasher.verify(state?.password_hash ?? "", firstInput.password),
    ).resolves.toBe(true);
    await expect(
      passwordHasher.verify(state?.password_hash ?? "", secondInput.password),
    ).resolves.toBe(false);

    const activityCountRows = (await dataSource.query(
      "SELECT count(*)::integer AS count FROM activity_logs",
    )) as CountRow[];
    expect(activityCountRows[0]?.count).toBe(1);
  });

  it("does not elevate an existing user with the requested email", async () => {
    const existingUserId = randomUUID();
    await dataSource.query(
      `
        INSERT INTO users (id, email, password_hash, display_name)
        VALUES ($1, $2, $3, $4)
      `,
      [
        existingUserId,
        "existing@example.com",
        FAST_TEST_PASSWORD_HASH,
        "Existing User",
      ],
    );

    await expect(
      bootstrapAdministrator(
        dataSource,
        createDependencies(),
        createInput("existing@example.com"),
      ),
    ).rejects.toBeInstanceOf(BootstrapAdministratorEmailConflictError);

    const assignmentCountRows = (await dataSource.query(
      "SELECT count(*)::integer AS count FROM user_roles WHERE user_id = $1",
      [existingUserId],
    )) as CountRow[];
    expect(assignmentCountRows[0]?.count).toBe(0);
  });

  it("does not create a second administrator", async () => {
    await bootstrapAdministrator(
      dataSource,
      createDependencies(),
      createInput("first-admin@example.com"),
    );

    await expect(
      bootstrapAdministrator(
        dataSource,
        createDependencies(),
        createInput("second-admin@example.com"),
      ),
    ).rejects.toBeInstanceOf(BootstrapAdministratorAlreadyExistsError);

    const userCountRows = (await dataSource.query(
      "SELECT count(*)::integer AS count FROM users",
    )) as CountRow[];
    expect(userCountRows[0]?.count).toBe(1);
  });

  it("requires the seeded active SYSTEM_ADMIN system role", async () => {
    await dataSource.query("DELETE FROM roles WHERE lower(code) = lower($1)", [
      SYSTEM_ROLE_CODE.SYSTEM_ADMIN,
    ]);

    await expect(
      bootstrapAdministrator(dataSource, createDependencies(), createInput()),
    ).rejects.toBeInstanceOf(SystemAdministratorRoleUnavailableError);

    const userCountRows = (await dataSource.query(
      "SELECT count(*)::integer AS count FROM users",
    )) as CountRow[];
    expect(userCountRows[0]?.count).toBe(0);
  });

  it("serializes concurrent bootstrap attempts so only one administrator is created", async () => {
    const results = await Promise.allSettled([
      bootstrapAdministrator(
        dataSource,
        createDependencies(),
        createInput("concurrent-one@example.com"),
      ),
      bootstrapAdministrator(
        dataSource,
        createDependencies(),
        createInput("concurrent-two@example.com"),
      ),
    ]);

    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    const rejectedResult = results.find(
      (result): result is PromiseRejectedResult => result.status === "rejected",
    );
    expect(rejectedResult?.reason).toBeInstanceOf(
      BootstrapAdministratorAlreadyExistsError,
    );

    const administratorCountRows = (await dataSource.query(
      `
        SELECT count(*)::integer AS count
        FROM user_roles
        INNER JOIN roles ON roles.id = user_roles.role_id
        WHERE lower(roles.code) = lower($1)
      `,
      [SYSTEM_ROLE_CODE.SYSTEM_ADMIN],
    )) as CountRow[];
    expect(administratorCountRows[0]?.count).toBe(1);
  });
});
