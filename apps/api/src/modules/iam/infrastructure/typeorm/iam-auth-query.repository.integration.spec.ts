import "dotenv/config";
import { randomUUID } from "node:crypto";
import { DataSource, type QueryRunner, type Repository } from "typeorm";
import { CreateInitialSchema1789236000000 } from "../../../../database/migrations/1789236000000-CreateInitialSchema";
import {
  assertDirectTestDatabaseUrl,
  initializeTestDataSource,
  isTransientTestDatabaseError,
  TEST_DATABASE_SUITE_TIMEOUT_MS,
  waitForTestDatabase,
} from "../../../../database/testing/test-database";
import { TypeOrmIamAuthQueryRepository } from "./iam-auth-query.repository";
import { PermissionOrmEntity } from "./entities/permission.orm-entity";
import { RolePermissionOrmEntity } from "./entities/role-permission.orm-entity";
import { RoleOrmEntity } from "./entities/role.orm-entity";
import { UserRoleOrmEntity } from "./entities/user-role.orm-entity";
import { UserOrmEntity } from "./entities/user.orm-entity";

const DATABASE_URL = process.env.DATABASE_URL_UNPOOLED;
const describeWithDatabase = DATABASE_URL ? describe : describe.skip;

jest.setTimeout(TEST_DATABASE_SUITE_TIMEOUT_MS);

interface UserFixtureOptions {
  readonly email?: string;
  readonly passwordHash?: string;
  readonly status?: "ACTIVE" | "INACTIVE" | "SUSPENDED";
}

interface RoleFixtureOptions {
  readonly code: string;
  readonly isActive: boolean;
}

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}

describeWithDatabase("TypeOrmIamAuthQueryRepository integration", () => {
  const schemaName = `test_iam_auth_query_${randomUUID().replaceAll("-", "_")}`;
  const quotedSchemaName = quoteIdentifier(schemaName);
  const migration = new CreateInitialSchema1789236000000();

  let dataSource: DataSource;
  let queryRunner: QueryRunner;
  let users: Repository<UserOrmEntity>;
  let repository: TypeOrmIamAuthQueryRepository;
  let schemaCreated = false;
  let migrationApplied = false;

  beforeAll(async () => {
    assertDirectTestDatabaseUrl(DATABASE_URL);

    dataSource = await initializeTestDataSource(
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
          entities: [
            UserOrmEntity,
            RoleOrmEntity,
            PermissionOrmEntity,
            UserRoleOrmEntity,
            RolePermissionOrmEntity,
          ],
          synchronize: false,
          logging: false,
        }),
    );

    queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.query(
      "CREATE EXTENSION IF NOT EXISTS citext WITH SCHEMA public",
    );
    await queryRunner.query(
      "CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA public",
    );
    await queryRunner.query(`CREATE SCHEMA ${quotedSchemaName}`);
    schemaCreated = true;
    await queryRunner.query(`SET search_path TO ${quotedSchemaName}, public`);

    await migration.up(queryRunner);
    migrationApplied = true;

    users = queryRunner.manager.getRepository(UserOrmEntity);
    repository = new TypeOrmIamAuthQueryRepository(users);
  });

  beforeEach(async () => {
    await queryRunner.startTransaction();
  });

  afterEach(async () => {
    if (queryRunner.isTransactionActive) {
      await queryRunner.rollbackTransaction();
    }
  });

  afterAll(async () => {
    if (!queryRunner) {
      if (dataSource?.isInitialized) {
        await dataSource.destroy();
      }
      return;
    }

    try {
      if (queryRunner.isTransactionActive) {
        await queryRunner.rollbackTransaction();
      }

      if (migrationApplied) {
        await migration.down(queryRunner);
        migrationApplied = false;
      }
    } finally {
      if (schemaCreated && dataSource.isInitialized) {
        try {
          await queryRunner.query("SET search_path TO public");
          await queryRunner.query(
            `DROP SCHEMA IF EXISTS ${quotedSchemaName} CASCADE`,
          );
        } catch (error) {
          if (!isTransientTestDatabaseError(error)) {
            throw error;
          }

          if (!queryRunner.isReleased) {
            await queryRunner.release();
          }

          await waitForTestDatabase(dataSource);
          await dataSource.query(
            `DROP SCHEMA IF EXISTS ${quotedSchemaName} CASCADE`,
          );
        }

        schemaCreated = false;
      }

      if (!queryRunner.isReleased) {
        await queryRunner.release();
      }

      if (dataSource.isInitialized) {
        await dataSource.destroy();
      }
    }
  });

  async function insertUser(options: UserFixtureOptions = {}): Promise<string> {
    const userId = randomUUID();

    await queryRunner.query(
      `
        INSERT INTO users (
          id,
          email,
          password_hash,
          display_name,
          status
        )
        VALUES ($1, $2, $3, $4, $5)
      `,
      [
        userId,
        options.email ?? `${randomUUID()}@example.com`,
        options.passwordHash ?? "$argon2id$integration-test-hash",
        "IAM Integration User",
        options.status ?? "ACTIVE",
      ],
    );

    return userId;
  }

  async function insertRole(options: RoleFixtureOptions): Promise<string> {
    const roleId = randomUUID();

    await queryRunner.query(
      `
        INSERT INTO roles (id, code, name, is_active)
        VALUES ($1, $2, $3, $4)
      `,
      [roleId, options.code, options.code, options.isActive],
    );

    return roleId;
  }

  async function insertPermission(code: string): Promise<string> {
    const permissionId = randomUUID();

    await queryRunner.query(
      `
        INSERT INTO permissions (id, code)
        VALUES ($1, $2)
      `,
      [permissionId, code],
    );

    return permissionId;
  }

  async function assignRole(userId: string, roleId: string): Promise<void> {
    await queryRunner.query(
      `
        INSERT INTO user_roles (user_id, role_id)
        VALUES ($1, $2)
      `,
      [userId, roleId],
    );
  }

  async function grantPermission(
    roleId: string,
    permissionId: string,
  ): Promise<void> {
    await queryRunner.query(
      `
        INSERT INTO role_permissions (role_id, permission_id)
        VALUES ($1, $2)
      `,
      [roleId, permissionId],
    );
  }

  it("finds credentials by case-insensitive email", async () => {
    const email = "Case.Sensitive.User@example.com";
    const passwordHash = "$argon2id$case-insensitive-test-hash";
    const userId = await insertUser({ email, passwordHash });

    await expect(
      repository.findAuthenticationUserByEmail(
        "case.sensitive.user@EXAMPLE.COM",
      ),
    ).resolves.toEqual({
      id: userId,
      email,
      passwordHash,
      displayName: "IAM Integration User",
      status: "ACTIVE",
      permissionVersion: "1",
    });
  });

  it("selects the password hash only for the credential query", async () => {
    const email = "select-safety@example.com";
    const passwordHash = "$argon2id$select-safety-test-hash";
    await insertUser({ email, passwordHash });

    const defaultUser = await users.findOneByOrFail({ email });
    const authenticationUser =
      await repository.findAuthenticationUserByEmail(email);

    expect(defaultUser.passwordHash).toBeUndefined();
    expect(authenticationUser?.passwordHash).toBe(passwordHash);
  });

  it("returns the union of permissions from active roles without duplicates", async () => {
    const userId = await insertUser({
      email: "permission-union@example.com",
    });
    const firstRoleId = await insertRole({
      code: "ACTIVE_ROLE_ONE",
      isActive: true,
    });
    const secondRoleId = await insertRole({
      code: "ACTIVE_ROLE_TWO",
      isActive: true,
    });
    const sharedPermissionId = await insertPermission("asset:read");
    const secondPermissionId = await insertPermission("asset:update");

    await assignRole(userId, firstRoleId);
    await assignRole(userId, secondRoleId);
    await grantPermission(firstRoleId, sharedPermissionId);
    await grantPermission(secondRoleId, sharedPermissionId);
    await grantPermission(secondRoleId, secondPermissionId);

    await expect(
      repository.findAuthorizationContextByUserId(userId),
    ).resolves.toEqual({
      userId,
      email: "permission-union@example.com",
      displayName: "IAM Integration User",
      status: "ACTIVE",
      permissionVersion: "1",
      permissionCodes: ["asset:read", "asset:update"],
    });
  });

  it("excludes permissions granted only through inactive roles", async () => {
    const userId = await insertUser({
      email: "inactive-role@example.com",
      status: "SUSPENDED",
    });
    const activeRoleId = await insertRole({
      code: "ACTIVE_ROLE",
      isActive: true,
    });
    const inactiveRoleId = await insertRole({
      code: "INACTIVE_ROLE",
      isActive: false,
    });
    const activePermissionId = await insertPermission("asset:read");
    const inactivePermissionId = await insertPermission("asset:delete");

    await assignRole(userId, activeRoleId);
    await assignRole(userId, inactiveRoleId);
    await grantPermission(activeRoleId, activePermissionId);
    await grantPermission(inactiveRoleId, inactivePermissionId);

    await expect(
      repository.findAuthorizationContextByUserId(userId),
    ).resolves.toEqual({
      userId,
      email: "inactive-role@example.com",
      displayName: "IAM Integration User",
      status: "SUSPENDED",
      permissionVersion: "1",
      permissionCodes: ["asset:read"],
    });
  });

  it("returns null when the requested user does not exist", async () => {
    await expect(
      repository.findAuthenticationUserByEmail("missing@example.com"),
    ).resolves.toBeNull();
    await expect(
      repository.findAuthorizationContextByUserId(randomUUID()),
    ).resolves.toBeNull();
  });
});
