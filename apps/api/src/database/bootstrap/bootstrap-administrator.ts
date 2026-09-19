import type { DataSource } from "typeorm";
import type { Clock } from "../../modules/auth/application/ports/clock.port";
import type { IdentifierGenerator } from "../../modules/auth/application/ports/identifier-generator.port";
import type { PasswordHasher } from "../../modules/auth/application/ports/password-hasher.port";
import { USER_STATUS } from "../../modules/iam/domain/user-status";
import { SYSTEM_ROLE_CODE } from "../seeds/permission-role.catalog";
import {
  BootstrapAdministratorAlreadyExistsError,
  BootstrapAdministratorEmailConflictError,
  SystemAdministratorRoleUnavailableError,
} from "./bootstrap-administrator.error";
import type { BootstrapAdministratorInput } from "./bootstrap-administrator.input";

const BOOTSTRAP_ADMINISTRATOR_LOCK_KEY =
  "asset-management:bootstrap-administrator";

export const BOOTSTRAP_ADMINISTRATOR_ACTIVITY = {
  ACTOR_TYPE: "SYSTEM",
  ACTION: "BOOTSTRAP_ADMINISTRATOR_CREATED",
  ENTITY_TYPE: "USER",
  OUTCOME: "SUCCESS",
} as const;

export const BOOTSTRAP_ADMINISTRATOR_RESULT = {
  CREATED: "created",
  ALREADY_EXISTS: "already_exists",
} as const;

interface SystemAdministratorRoleRow {
  readonly id: string;
  readonly is_system: boolean;
  readonly is_active: boolean;
}

interface UserRow {
  readonly id: string;
}

interface AdministratorAssignmentRow {
  readonly user_id: string;
}

export interface BootstrapAdministratorDependencies {
  readonly clock: Clock;
  readonly identifierGenerator: IdentifierGenerator;
  readonly passwordHasher: PasswordHasher;
}

export interface BootstrapAdministratorResult {
  readonly status:
    | typeof BOOTSTRAP_ADMINISTRATOR_RESULT.CREATED
    | typeof BOOTSTRAP_ADMINISTRATOR_RESULT.ALREADY_EXISTS;
  readonly userId: string;
}

export async function bootstrapAdministrator(
  dataSource: DataSource,
  dependencies: BootstrapAdministratorDependencies,
  input: BootstrapAdministratorInput,
): Promise<BootstrapAdministratorResult> {
  const queryRunner = dataSource.createQueryRunner();
  await queryRunner.connect();

  try {
    await queryRunner.startTransaction();
    await queryRunner.query(
      "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
      [BOOTSTRAP_ADMINISTRATOR_LOCK_KEY],
    );

    const roleRows = (await queryRunner.query(
      `
        SELECT id, is_system, is_active
        FROM roles
        WHERE lower(code) = lower($1)
        FOR UPDATE
      `,
      [SYSTEM_ROLE_CODE.SYSTEM_ADMIN],
    )) as SystemAdministratorRoleRow[];
    const systemAdministratorRole = roleRows[0];

    if (
      !systemAdministratorRole?.is_system ||
      !systemAdministratorRole.is_active
    ) {
      throw new SystemAdministratorRoleUnavailableError();
    }

    const userRows = (await queryRunner.query(
      `
        SELECT id
        FROM users
        WHERE lower(email::text) = lower($1)
        FOR UPDATE
      `,
      [input.email],
    )) as UserRow[];
    const requestedUser = userRows[0];

    const administratorRows = (await queryRunner.query(
      `
        SELECT user_role.user_id
        FROM user_roles user_role
        WHERE user_role.role_id = $1
        ORDER BY user_role.user_id
        FOR UPDATE
      `,
      [systemAdministratorRole.id],
    )) as AdministratorAssignmentRow[];
    const existingAdministrator = administratorRows[0];

    if (
      requestedUser &&
      administratorRows.some(
        (administrator) => administrator.user_id === requestedUser.id,
      )
    ) {
      await queryRunner.commitTransaction();
      return {
        status: BOOTSTRAP_ADMINISTRATOR_RESULT.ALREADY_EXISTS,
        userId: requestedUser.id,
      };
    }

    if (requestedUser) {
      throw new BootstrapAdministratorEmailConflictError();
    }

    if (existingAdministrator) {
      throw new BootstrapAdministratorAlreadyExistsError();
    }

    const occurredAt = dependencies.clock.now();
    const userId = dependencies.identifierGenerator.generate();
    const activityId = dependencies.identifierGenerator.generate();
    const requestId = dependencies.identifierGenerator.generate();
    const passwordHash = await dependencies.passwordHasher.hash(input.password);

    await queryRunner.query(
      `
        INSERT INTO users (
          id,
          email,
          password_hash,
          display_name,
          status,
          permission_version,
          version,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, 1, 1, $6, $6)
      `,
      [
        userId,
        input.email,
        passwordHash,
        input.displayName,
        USER_STATUS.ACTIVE,
        occurredAt,
      ],
    );

    await queryRunner.query(
      `
        INSERT INTO user_roles (user_id, role_id, granted_by, granted_at)
        VALUES ($1, $2, NULL, $3)
      `,
      [userId, systemAdministratorRole.id, occurredAt],
    );

    await queryRunner.query(
      `
        INSERT INTO activity_logs (
          id,
          occurred_at,
          actor_user_id,
          actor_type,
          action,
          entity_type,
          entity_id,
          metadata,
          request_id,
          outcome
        )
        VALUES ($1, $2, NULL, $3, $4, $5, $6, $7::jsonb, $8, $9)
      `,
      [
        activityId,
        occurredAt,
        BOOTSTRAP_ADMINISTRATOR_ACTIVITY.ACTOR_TYPE,
        BOOTSTRAP_ADMINISTRATOR_ACTIVITY.ACTION,
        BOOTSTRAP_ADMINISTRATOR_ACTIVITY.ENTITY_TYPE,
        userId,
        JSON.stringify({ roleCode: SYSTEM_ROLE_CODE.SYSTEM_ADMIN }),
        requestId,
        BOOTSTRAP_ADMINISTRATOR_ACTIVITY.OUTCOME,
      ],
    );

    await queryRunner.commitTransaction();

    return {
      status: BOOTSTRAP_ADMINISTRATOR_RESULT.CREATED,
      userId,
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
