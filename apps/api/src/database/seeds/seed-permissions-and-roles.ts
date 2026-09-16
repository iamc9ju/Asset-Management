import { randomUUID } from "node:crypto";
import type { DataSource, QueryRunner } from "typeorm";
import {
  PERMISSION_ROLE_CATALOG,
  type PermissionRoleCatalog,
  validatePermissionRoleCatalog,
} from "./permission-role.catalog";

const SEED_LOCK_KEY = "asset-management:permission-role-catalog";

interface PermissionReconciliationRow {
  readonly inserted: number;
  readonly updated: number;
  readonly code_changed_permission_ids: string[];
}

interface RoleReconciliationRow {
  readonly inserted: number;
  readonly updated: number;
  readonly collision_codes: string[];
  readonly effective_grant_changed_role_ids: string[];
}

interface GrantReconciliationRow {
  readonly inserted: number;
  readonly removed: number;
  readonly user_permission_versions_incremented: number;
}

interface PermissionSeedInput {
  readonly id: string;
  readonly code: string;
  readonly description: string;
}

interface RoleSeedInput {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly description: string;
}

interface GrantSeedInput {
  readonly role_code: string;
  readonly permission_code: string;
}

export interface PermissionRoleSeedResult {
  readonly permissionsInserted: number;
  readonly permissionsUpdated: number;
  readonly rolesInserted: number;
  readonly rolesUpdated: number;
  readonly grantsInserted: number;
  readonly grantsRemoved: number;
  readonly userPermissionVersionsIncremented: number;
}

export class ReservedSystemRoleCodeError extends Error {
  readonly roleCode: string;

  constructor(roleCode: string) {
    super(
      `Cannot seed reserved system role ${roleCode}: the code is already owned by a custom role`,
    );
    this.name = "ReservedSystemRoleCodeError";
    this.roleCode = roleCode;
  }
}

export async function seedPermissionsAndRoles(
  dataSource: DataSource,
  catalog: PermissionRoleCatalog = PERMISSION_ROLE_CATALOG,
): Promise<PermissionRoleSeedResult> {
  validatePermissionRoleCatalog(catalog);

  const queryRunner = dataSource.createQueryRunner();
  await queryRunner.connect();

  try {
    await queryRunner.startTransaction();
    await queryRunner.query(
      "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
      [SEED_LOCK_KEY],
    );

    const permissionResult = await reconcilePermissions(queryRunner, catalog);
    const roleResult = await reconcileSystemRoles(queryRunner, catalog);
    const grantResult = await reconcileSystemRoleGrants(
      queryRunner,
      catalog,
      permissionResult.code_changed_permission_ids,
      roleResult.effective_grant_changed_role_ids,
    );

    await queryRunner.commitTransaction();

    return {
      permissionsInserted: permissionResult.inserted,
      permissionsUpdated: permissionResult.updated,
      rolesInserted: roleResult.inserted,
      rolesUpdated: roleResult.updated,
      grantsInserted: grantResult.inserted,
      grantsRemoved: grantResult.removed,
      userPermissionVersionsIncremented:
        grantResult.user_permission_versions_incremented,
    };
  } catch (error) {
    if (queryRunner.isTransactionActive) {
      await queryRunner.rollbackTransaction();
    }

    throw error;
  } finally {
    if (!queryRunner.isReleased) {
      await queryRunner.release();
    }
  }
}

async function reconcilePermissions(
  queryRunner: QueryRunner,
  catalog: PermissionRoleCatalog,
): Promise<PermissionReconciliationRow> {
  const input: PermissionSeedInput[] = catalog.permissions.map(
    (permission) => ({
      id: randomUUID(),
      code: permission.code,
      description: permission.description,
    }),
  );
  const rows = (await queryRunner.query(
    `
      WITH input AS MATERIALIZED (
        SELECT id, code, description
        FROM jsonb_to_recordset($1::jsonb) AS catalog_permission(
          id uuid,
          code text,
          description text
        )
      ),
      existing AS MATERIALIZED (
        SELECT
          permission.id,
          permission.code AS old_code,
          permission.description AS old_description,
          input.code AS new_code,
          input.description AS new_description
        FROM permissions permission
        INNER JOIN input
          ON lower(input.code) = lower(permission.code)
        FOR UPDATE OF permission
      ),
      updated AS (
        UPDATE permissions permission
        SET
          code = existing.new_code,
          description = existing.new_description
        FROM existing
        WHERE
          permission.id = existing.id
          AND (
            permission.code IS DISTINCT FROM existing.new_code
            OR permission.description IS DISTINCT FROM existing.new_description
          )
        RETURNING permission.id
      ),
      inserted AS (
        INSERT INTO permissions (id, code, description)
        SELECT input.id, input.code, input.description
        FROM input
        WHERE NOT EXISTS (
          SELECT 1
          FROM existing
          WHERE lower(existing.new_code) = lower(input.code)
        )
        RETURNING id
      )
      SELECT
        (SELECT count(*)::integer FROM inserted) AS inserted,
        (SELECT count(*)::integer FROM updated) AS updated,
        COALESCE(
          (
            SELECT jsonb_agg(existing.id ORDER BY existing.id)
            FROM existing
            WHERE existing.old_code IS DISTINCT FROM existing.new_code
          ),
          '[]'::jsonb
        ) AS code_changed_permission_ids
    `,
    [JSON.stringify(input)],
  )) as PermissionReconciliationRow[];

  return getRequiredResultRow(rows, "permission reconciliation");
}

async function reconcileSystemRoles(
  queryRunner: QueryRunner,
  catalog: PermissionRoleCatalog,
): Promise<RoleReconciliationRow> {
  const input: RoleSeedInput[] = catalog.systemRoles.map((role) => ({
    id: randomUUID(),
    code: role.code,
    name: role.name,
    description: role.description,
  }));
  const rows = (await queryRunner.query(
    `
      WITH input AS MATERIALIZED (
        SELECT id, code, name, description
        FROM jsonb_to_recordset($1::jsonb) AS catalog_role(
          id uuid,
          code text,
          name text,
          description text
        )
      ),
      existing AS MATERIALIZED (
        SELECT
          role.id,
          role.code AS old_code,
          role.name AS old_name,
          role.description AS old_description,
          role.is_system,
          role.is_active,
          input.code AS new_code,
          input.name AS new_name,
          input.description AS new_description
        FROM roles role
        INNER JOIN input ON lower(input.code) = lower(role.code)
        FOR UPDATE OF role
      ),
      collisions AS MATERIALIZED (
        SELECT existing.old_code AS code
        FROM existing
        WHERE existing.is_system = false
      ),
      updated AS (
        UPDATE roles role
        SET
          code = existing.new_code,
          name = existing.new_name,
          description = existing.new_description,
          is_system = true,
          is_active = true,
          updated_at = now()
        FROM existing
        WHERE
          NOT EXISTS (SELECT 1 FROM collisions)
          AND role.id = existing.id
          AND (
            role.code IS DISTINCT FROM existing.new_code
            OR role.name IS DISTINCT FROM existing.new_name
            OR role.description IS DISTINCT FROM existing.new_description
            OR role.is_system IS DISTINCT FROM true
            OR role.is_active IS DISTINCT FROM true
          )
        RETURNING role.id
      ),
      inserted AS (
        INSERT INTO roles (
          id,
          code,
          name,
          description,
          is_system,
          is_active
        )
        SELECT
          input.id,
          input.code,
          input.name,
          input.description,
          true,
          true
        FROM input
        WHERE
          NOT EXISTS (SELECT 1 FROM collisions)
          AND NOT EXISTS (
            SELECT 1
            FROM existing
            WHERE lower(existing.new_code) = lower(input.code)
          )
        RETURNING id
      )
      SELECT
        (SELECT count(*)::integer FROM inserted) AS inserted,
        (SELECT count(*)::integer FROM updated) AS updated,
        COALESCE(
          (
            SELECT jsonb_agg(collisions.code ORDER BY collisions.code)
            FROM collisions
          ),
          '[]'::jsonb
        ) AS collision_codes,
        COALESCE(
          (
            SELECT jsonb_agg(existing.id ORDER BY existing.id)
            FROM existing
            WHERE existing.is_active = false
          ),
          '[]'::jsonb
        ) AS effective_grant_changed_role_ids
    `,
    [JSON.stringify(input)],
  )) as RoleReconciliationRow[];
  const result = getRequiredResultRow(rows, "system-role reconciliation");
  const collisionCode = result.collision_codes[0];

  if (collisionCode) {
    throw new ReservedSystemRoleCodeError(collisionCode);
  }

  return result;
}

async function reconcileSystemRoleGrants(
  queryRunner: QueryRunner,
  catalog: PermissionRoleCatalog,
  codeChangedPermissionIds: readonly string[],
  initiallyChangedRoleIds: readonly string[],
): Promise<GrantReconciliationRow> {
  const grants: GrantSeedInput[] = catalog.systemRoles.flatMap((role) =>
    role.permissionCodes.map((permissionCode) => ({
      role_code: role.code,
      permission_code: permissionCode,
    })),
  );
  const normalizedRoleCodes = catalog.systemRoles.map((role) =>
    normalizeCode(role.code),
  );
  const rows = (await queryRunner.query(
    `
      WITH input_grants AS MATERIALIZED (
        SELECT role_code, permission_code
        FROM jsonb_to_recordset($1::jsonb) AS catalog_grant(
          role_code text,
          permission_code text
        )
      ),
      catalog_roles AS MATERIALIZED (
        SELECT role.id
        FROM roles role
        WHERE
          lower(role.code) = ANY($2::text[])
          AND role.is_system = true
      ),
      desired_grants AS MATERIALIZED (
        SELECT
          role.id AS role_id,
          permission.id AS permission_id
        FROM input_grants input_grant
        INNER JOIN roles role
          ON lower(role.code) = lower(input_grant.role_code)
        INNER JOIN permissions permission
          ON lower(permission.code) = lower(input_grant.permission_code)
        WHERE role.is_system = true
      ),
      inserted AS (
        INSERT INTO role_permissions (role_id, permission_id)
        SELECT desired_grant.role_id, desired_grant.permission_id
        FROM desired_grants desired_grant
        WHERE NOT EXISTS (
          SELECT 1
          FROM role_permissions role_permission
          WHERE
            role_permission.role_id = desired_grant.role_id
            AND role_permission.permission_id = desired_grant.permission_id
        )
        ON CONFLICT DO NOTHING
        RETURNING role_id
      ),
      removed AS (
        DELETE FROM role_permissions role_permission
        USING catalog_roles catalog_role
        WHERE
          role_permission.role_id = catalog_role.id
          AND NOT EXISTS (
            SELECT 1
            FROM desired_grants desired_grant
            WHERE
              desired_grant.role_id = role_permission.role_id
              AND desired_grant.permission_id = role_permission.permission_id
          )
        RETURNING role_permission.role_id
      ),
      permission_code_changed_roles AS (
        SELECT DISTINCT role_permission.role_id
        FROM role_permissions role_permission
        INNER JOIN roles role ON role.id = role_permission.role_id
        WHERE
          role_permission.permission_id = ANY($3::uuid[])
          AND role.is_active = true
      ),
      effective_grant_changed_roles AS MATERIALIZED (
        SELECT inserted.role_id FROM inserted
        UNION
        SELECT removed.role_id FROM removed
        UNION
        SELECT permission_code_changed_roles.role_id
        FROM permission_code_changed_roles
        UNION
        SELECT changed_role_id
        FROM unnest($4::uuid[]) AS changed_role(changed_role_id)
      ),
      updated_users AS (
        UPDATE users app_user
        SET
          permission_version = app_user.permission_version + 1,
          updated_at = now()
        WHERE EXISTS (
          SELECT 1
          FROM user_roles user_role
          INNER JOIN effective_grant_changed_roles changed_role
            ON changed_role.role_id = user_role.role_id
          WHERE user_role.user_id = app_user.id
        )
        RETURNING app_user.id
      )
      SELECT
        (SELECT count(*)::integer FROM inserted) AS inserted,
        (SELECT count(*)::integer FROM removed) AS removed,
        (
          SELECT count(*)::integer
          FROM updated_users
        ) AS user_permission_versions_incremented
    `,
    [
      JSON.stringify(grants),
      normalizedRoleCodes,
      codeChangedPermissionIds,
      initiallyChangedRoleIds,
    ],
  )) as GrantReconciliationRow[];

  return getRequiredResultRow(rows, "system-role grant reconciliation");
}

function getRequiredResultRow<T>(rows: readonly T[], operation: string): T {
  const row = rows[0];

  if (!row) {
    throw new Error(`Database returned no result for ${operation}`);
  }

  return row;
}

function normalizeCode(code: string): string {
  return code.toLocaleLowerCase("en-US");
}

async function runFromCommandLine(): Promise<void> {
  const { default: dataSource } =
    await import("../../config/typeorm-cli.config");

  try {
    await dataSource.initialize();
    const result = await seedPermissionsAndRoles(dataSource);
    console.log("Permission and system-role seed completed", result);
  } finally {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  }
}

if (require.main === module) {
  void runFromCommandLine().catch((error: unknown) => {
    console.error("Permission and system-role seed failed", error);
    process.exitCode = 1;
  });
}
