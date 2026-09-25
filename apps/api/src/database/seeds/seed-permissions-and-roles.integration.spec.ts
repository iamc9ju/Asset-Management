import "dotenv/config";
import { randomUUID } from "node:crypto";
import { DataSource } from "typeorm";
import { CreateInitialSchema1789236000000 } from "../migrations/1789236000000-CreateInitialSchema";
import {
  assertDirectTestDatabaseUrl,
  initializeTestDataSource,
  TEST_DATABASE_SUITE_TIMEOUT_MS,
} from "../testing/test-database";
import {
  PERMISSION_CODE,
  PERMISSION_ROLE_CATALOG,
  SYSTEM_ROLE_CODE,
  type PermissionRoleCatalog,
} from "./permission-role.catalog";
import {
  ReservedSystemRoleCodeError,
  seedPermissionsAndRoles,
} from "./seed-permissions-and-roles";

const DATABASE_URL = process.env.DATABASE_URL_UNPOOLED;
assertDirectTestDatabaseUrl(DATABASE_URL);

jest.setTimeout(TEST_DATABASE_SUITE_TIMEOUT_MS);

interface CountRow {
  readonly count: number;
}

interface GrantRow {
  readonly role_code: string;
  readonly permission_code: string;
}

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}

describe("permission and system-role seed integration", () => {
  const schemaName = `test_permission_seed_${randomUUID().replaceAll("-", "_")}`;
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

  async function insertUser(email: string): Promise<string> {
    const userId = randomUUID();

    await dataSource.query(
      `
        INSERT INTO users (
          id,
          email,
          password_hash,
          display_name
        )
        VALUES ($1, $2, $3, $4)
      `,
      [userId, email, "$argon2id$integration-test-hash", "Seed Test User"],
    );

    return userId;
  }

  async function findRoleId(code: string): Promise<string> {
    const rows = (await dataSource.query(
      "SELECT id FROM roles WHERE lower(code) = lower($1)",
      [code],
    )) as Array<{ readonly id: string }>;
    const role = rows[0];

    if (!role) {
      throw new Error(`Role not found: ${code}`);
    }

    return role.id;
  }

  async function findPermissionId(code: string): Promise<string> {
    const rows = (await dataSource.query(
      "SELECT id FROM permissions WHERE lower(code) = lower($1)",
      [code],
    )) as Array<{ readonly id: string }>;
    const permission = rows[0];

    if (!permission) {
      throw new Error(`Permission not found: ${code}`);
    }

    return permission.id;
  }

  async function readCatalogGrants(): Promise<GrantRow[]> {
    return dataSource.query(`
      SELECT role.code AS role_code, permission.code AS permission_code
      FROM role_permissions role_permission
      INNER JOIN roles role ON role.id = role_permission.role_id
      INNER JOIN permissions permission
        ON permission.id = role_permission.permission_id
      WHERE role.is_system = true
      ORDER BY role.code, permission.code
    `) as Promise<GrantRow[]>;
  }

  it("creates every permission, system role, and documented grant", async () => {
    const result = await seedPermissionsAndRoles(dataSource);
    const permissionCount = (await dataSource.query(
      "SELECT count(*)::integer AS count FROM permissions",
    )) as CountRow[];
    const roleCount = (await dataSource.query(
      "SELECT count(*)::integer AS count FROM roles WHERE is_system = true",
    )) as CountRow[];
    const grants = await readCatalogGrants();
    const expectedGrants = PERMISSION_ROLE_CATALOG.systemRoles
      .flatMap((role) =>
        role.permissionCodes.map((permissionCode) => ({
          role_code: role.code,
          permission_code: permissionCode,
        })),
      )
      .sort((left, right) =>
        `${left.role_code}:${left.permission_code}`.localeCompare(
          `${right.role_code}:${right.permission_code}`,
        ),
      );

    expect(permissionCount[0]?.count).toBe(
      PERMISSION_ROLE_CATALOG.permissions.length,
    );
    expect(roleCount[0]?.count).toBe(
      PERMISSION_ROLE_CATALOG.systemRoles.length,
    );
    expect(grants).toEqual(expectedGrants);
    expect(result.permissionsInserted).toBe(
      PERMISSION_ROLE_CATALOG.permissions.length,
    );
    expect(result.rolesInserted).toBe(
      PERMISSION_ROLE_CATALOG.systemRoles.length,
    );
  });

  it("is idempotent when the catalog and database state are unchanged", async () => {
    await seedPermissionsAndRoles(dataSource);
    const permissionsBefore = await dataSource.query(
      "SELECT id, code, description FROM permissions ORDER BY code",
    );
    const rolesBefore = await dataSource.query(
      `
        SELECT id, code, name, description, is_system, is_active
        FROM roles
        ORDER BY code
      `,
    );
    const grantsBefore = await readCatalogGrants();

    const secondResult = await seedPermissionsAndRoles(dataSource);

    await expect(
      dataSource.query(
        "SELECT id, code, description FROM permissions ORDER BY code",
      ),
    ).resolves.toEqual(permissionsBefore);
    await expect(
      dataSource.query(`
        SELECT id, code, name, description, is_system, is_active
        FROM roles
        ORDER BY code
      `),
    ).resolves.toEqual(rolesBefore);
    await expect(readCatalogGrants()).resolves.toEqual(grantsBefore);
    expect(secondResult).toEqual({
      permissionsInserted: 0,
      permissionsUpdated: 0,
      rolesInserted: 0,
      rolesUpdated: 0,
      grantsInserted: 0,
      grantsRemoved: 0,
      userPermissionVersionsIncremented: 0,
    });
  });

  it("preserves custom roles, their grants, and user-role assignments", async () => {
    const customRoleId = randomUUID();
    const customPermissionId = randomUUID();
    const userId = await insertUser("custom-role-user@example.com");

    await dataSource.query(
      `
        INSERT INTO permissions (id, code, description)
        VALUES ($1, $2, $3)
      `,
      [customPermissionId, "custom:read", "Custom permission"],
    );
    await dataSource.query(
      `
        INSERT INTO roles (id, code, name, is_system, is_active)
        VALUES ($1, $2, $3, false, true)
      `,
      [customRoleId, "CUSTOM_ROLE", "Custom Role"],
    );
    await dataSource.query(
      `
        INSERT INTO role_permissions (role_id, permission_id)
        VALUES ($1, $2)
      `,
      [customRoleId, customPermissionId],
    );
    await dataSource.query(
      "INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)",
      [userId, customRoleId],
    );

    await seedPermissionsAndRoles(dataSource);

    const customState = await dataSource.query(
      `
        SELECT
          role.is_system,
          role.is_active,
          permission.code AS permission_code,
          user_role.user_id
        FROM roles role
        INNER JOIN role_permissions role_permission
          ON role_permission.role_id = role.id
        INNER JOIN permissions permission
          ON permission.id = role_permission.permission_id
        INNER JOIN user_roles user_role ON user_role.role_id = role.id
        WHERE role.id = $1
      `,
      [customRoleId],
    );

    expect(customState).toEqual([
      {
        is_system: false,
        is_active: true,
        permission_code: "custom:read",
        user_id: userId,
      },
    ]);
  });

  it("rejects a custom role using a reserved code and rolls back", async () => {
    await dataSource.query(
      `
        INSERT INTO roles (id, code, name, is_system, is_active)
        VALUES ($1, $2, $3, false, true)
      `,
      [randomUUID(), SYSTEM_ROLE_CODE.VIEWER.toLowerCase(), "Collision"],
    );

    await expect(seedPermissionsAndRoles(dataSource)).rejects.toBeInstanceOf(
      ReservedSystemRoleCodeError,
    );

    const permissions = (await dataSource.query(
      "SELECT count(*)::integer AS count FROM permissions",
    )) as CountRow[];
    const systemRoles = (await dataSource.query(
      "SELECT count(*)::integer AS count FROM roles WHERE is_system = true",
    )) as CountRow[];

    expect(permissions[0]?.count).toBe(0);
    expect(systemRoles[0]?.count).toBe(0);
  });

  it("reconciles only system-role grants and increments affected users once", async () => {
    await seedPermissionsAndRoles(dataSource);
    const userId = await insertUser("viewer@example.com");
    const viewerRoleId = await findRoleId(SYSTEM_ROLE_CODE.VIEWER);
    const removedPermissionId = await findPermissionId(
      PERMISSION_CODE.ISSUE_READ,
    );
    await dataSource.query(
      "INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)",
      [userId, viewerRoleId],
    );

    const catalogWithoutViewerIssueRead: PermissionRoleCatalog = {
      ...PERMISSION_ROLE_CATALOG,
      systemRoles: PERMISSION_ROLE_CATALOG.systemRoles.map((role) =>
        role.code === SYSTEM_ROLE_CODE.VIEWER
          ? {
              ...role,
              permissionCodes: role.permissionCodes.filter(
                (code) => code !== PERMISSION_CODE.ISSUE_READ,
              ),
            }
          : role,
      ),
    };

    const result = await seedPermissionsAndRoles(
      dataSource,
      catalogWithoutViewerIssueRead,
    );
    const removedGrant = (await dataSource.query(
      `
        SELECT count(*)::integer AS count
        FROM role_permissions
        WHERE role_id = $1 AND permission_id = $2
      `,
      [viewerRoleId, removedPermissionId],
    )) as CountRow[];
    const userRows = (await dataSource.query(
      "SELECT permission_version FROM users WHERE id = $1",
      [userId],
    )) as Array<{ readonly permission_version: string }>;

    expect(result.grantsRemoved).toBe(1);
    expect(result.userPermissionVersionsIncremented).toBe(1);
    expect(removedGrant[0]?.count).toBe(0);
    expect(userRows[0]?.permission_version).toBe("2");

    const repeatedResult = await seedPermissionsAndRoles(
      dataSource,
      catalogWithoutViewerIssueRead,
    );
    expect(repeatedResult.userPermissionVersionsIncremented).toBe(0);
  });

  it("reactivates system roles and increments assigned users", async () => {
    await seedPermissionsAndRoles(dataSource);
    const userId = await insertUser("inactive-viewer@example.com");
    const viewerRoleId = await findRoleId(SYSTEM_ROLE_CODE.VIEWER);
    await dataSource.query(
      "INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)",
      [userId, viewerRoleId],
    );
    await dataSource.query("UPDATE roles SET is_active = false WHERE id = $1", [
      viewerRoleId,
    ]);

    const result = await seedPermissionsAndRoles(dataSource);
    const roleRows = (await dataSource.query(
      "SELECT is_active FROM roles WHERE id = $1",
      [viewerRoleId],
    )) as Array<{ readonly is_active: boolean }>;
    const userRows = (await dataSource.query(
      "SELECT permission_version FROM users WHERE id = $1",
      [userId],
    )) as Array<{ readonly permission_version: string }>;

    expect(result.rolesUpdated).toBe(1);
    expect(result.userPermissionVersionsIncremented).toBe(1);
    expect(roleRows[0]?.is_active).toBe(true);
    expect(userRows[0]?.permission_version).toBe("2");
  });

  it("increments custom-role users when a permission code is canonicalized", async () => {
    const userId = await insertUser("canonical-code-user@example.com");
    const customRoleId = randomUUID();
    const permissionId = randomUUID();
    await dataSource.query(
      `
        INSERT INTO permissions (id, code, description)
        VALUES ($1, $2, $3)
      `,
      [permissionId, "ASSET:READ", "Legacy description"],
    );
    await dataSource.query(
      `
        INSERT INTO roles (id, code, name, is_system, is_active)
        VALUES ($1, $2, $3, false, true)
      `,
      [customRoleId, "CUSTOM_ASSET_READER", "Custom Asset Reader"],
    );
    await dataSource.query(
      "INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2)",
      [customRoleId, permissionId],
    );
    await dataSource.query(
      "INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)",
      [userId, customRoleId],
    );

    const result = await seedPermissionsAndRoles(dataSource);
    const permissionRows = (await dataSource.query(
      "SELECT code FROM permissions WHERE id = $1",
      [permissionId],
    )) as Array<{ readonly code: string }>;
    const userRows = (await dataSource.query(
      "SELECT permission_version FROM users WHERE id = $1",
      [userId],
    )) as Array<{ readonly permission_version: string }>;

    expect(result.permissionsUpdated).toBe(1);
    expect(result.userPermissionVersionsIncremented).toBe(1);
    expect(permissionRows[0]?.code).toBe(PERMISSION_CODE.ASSET_READ);
    expect(userRows[0]?.permission_version).toBe("2");
  });
});
