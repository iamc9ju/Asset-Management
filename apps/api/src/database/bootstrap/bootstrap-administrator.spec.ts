import type { DataSource, QueryRunner } from "typeorm";
import type { Clock } from "../../modules/auth/application/ports/clock.port";
import type { IdentifierGenerator } from "../../modules/auth/application/ports/identifier-generator.port";
import type { PasswordHasher } from "../../modules/auth/application/ports/password-hasher.port";
import { SYSTEM_ROLE_CODE } from "../seeds/permission-role.catalog";
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

const ROLE_ID = "10000000-0000-4000-8000-000000000001";
const USER_ID = "10000000-0000-4000-8000-000000000002";
const ACTIVITY_ID = "10000000-0000-4000-8000-000000000003";
const REQUEST_ID = "10000000-0000-4000-8000-000000000004";
const OTHER_USER_ID = "10000000-0000-4000-8000-000000000005";
const PASSWORD_HASH = "$argon2id$unit-test-hash";
const OCCURRED_AT = new Date("2026-09-17T00:00:00.000Z");

const INPUT: BootstrapAdministratorInput = {
  email: "admin@example.com",
  displayName: "System Administrator",
  password: "correct horse battery staple",
};

interface BootstrapDatabaseMock {
  readonly dataSource: DataSource;
  readonly query: jest.Mock;
  readonly commitTransaction: jest.Mock;
  readonly rollbackTransaction: jest.Mock;
  readonly release: jest.Mock;
}

function createBootstrapDatabaseMock(): BootstrapDatabaseMock {
  const query = jest.fn();
  const commitTransaction = jest.fn().mockResolvedValue(undefined);
  const rollbackTransaction = jest.fn().mockResolvedValue(undefined);
  const release = jest.fn().mockResolvedValue(undefined);
  const queryRunner = {
    connect: jest.fn().mockResolvedValue(undefined),
    startTransaction: jest.fn().mockResolvedValue(undefined),
    commitTransaction,
    rollbackTransaction,
    release,
    query,
    isTransactionActive: true,
    isReleased: false,
  } as unknown as QueryRunner;
  const dataSource = {
    createQueryRunner: jest.fn(() => queryRunner),
  } as unknown as DataSource;

  return {
    dataSource,
    query,
    commitTransaction,
    rollbackTransaction,
    release,
  };
}

function createDependencies(): BootstrapAdministratorDependencies & {
  readonly passwordHasher: jest.Mocked<PasswordHasher>;
} {
  const generatedIdentifiers = [USER_ID, ACTIVITY_ID, REQUEST_ID];
  const clock: Clock = { now: jest.fn(() => OCCURRED_AT) };
  const identifierGenerator: IdentifierGenerator = {
    generate: jest.fn(() => {
      const identifier = generatedIdentifiers.shift();

      if (!identifier) {
        throw new Error("Identifier fixture exhausted");
      }

      return identifier;
    }),
  };
  const passwordHasher: jest.Mocked<PasswordHasher> = {
    hash: jest.fn().mockResolvedValue(PASSWORD_HASH),
    verify: jest.fn(),
    consumeVerificationCost: jest.fn(),
  };

  return { clock, identifierGenerator, passwordHasher };
}

function arrangeAvailableRole(database: BootstrapDatabaseMock): void {
  database.query
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([{ id: ROLE_ID, is_system: true, is_active: true }]);
}

describe("bootstrapAdministrator", () => {
  it("creates the first administrator, role assignment, and sanitized audit event atomically", async () => {
    const database = createBootstrapDatabaseMock();
    const dependencies = createDependencies();
    arrangeAvailableRole(database);
    database.query
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    await expect(
      bootstrapAdministrator(database.dataSource, dependencies, INPUT),
    ).resolves.toEqual({
      status: BOOTSTRAP_ADMINISTRATOR_RESULT.CREATED,
      userId: USER_ID,
    });

    expect(dependencies.passwordHasher.hash).toHaveBeenCalledWith(
      INPUT.password,
    );
    expect(database.query).toHaveBeenCalledTimes(7);
    expect(database.query.mock.calls[4]?.[1]).toEqual([
      USER_ID,
      INPUT.email,
      PASSWORD_HASH,
      INPUT.displayName,
      "ACTIVE",
      OCCURRED_AT,
    ]);
    expect(database.query.mock.calls[6]?.[1]).toEqual([
      ACTIVITY_ID,
      OCCURRED_AT,
      BOOTSTRAP_ADMINISTRATOR_ACTIVITY.ACTOR_TYPE,
      BOOTSTRAP_ADMINISTRATOR_ACTIVITY.ACTION,
      BOOTSTRAP_ADMINISTRATOR_ACTIVITY.ENTITY_TYPE,
      USER_ID,
      JSON.stringify({ roleCode: SYSTEM_ROLE_CODE.SYSTEM_ADMIN }),
      REQUEST_ID,
      BOOTSTRAP_ADMINISTRATOR_ACTIVITY.OUTCOME,
    ]);
    expect(database.commitTransaction).toHaveBeenCalledTimes(1);
    expect(database.rollbackTransaction).not.toHaveBeenCalled();
    expect(database.release).toHaveBeenCalledTimes(1);
  });

  it("returns an idempotent result without hashing or changing an existing administrator", async () => {
    const database = createBootstrapDatabaseMock();
    const dependencies = createDependencies();
    arrangeAvailableRole(database);
    database.query
      .mockResolvedValueOnce([{ id: USER_ID }])
      .mockResolvedValueOnce([{ user_id: USER_ID }]);

    await expect(
      bootstrapAdministrator(database.dataSource, dependencies, INPUT),
    ).resolves.toEqual({
      status: BOOTSTRAP_ADMINISTRATOR_RESULT.ALREADY_EXISTS,
      userId: USER_ID,
    });

    expect(dependencies.passwordHasher.hash).not.toHaveBeenCalled();
    expect(database.query).toHaveBeenCalledTimes(4);
    expect(database.commitTransaction).toHaveBeenCalledTimes(1);
    expect(database.rollbackTransaction).not.toHaveBeenCalled();
  });

  it("refuses to elevate an existing non-administrator user", async () => {
    const database = createBootstrapDatabaseMock();
    const dependencies = createDependencies();
    arrangeAvailableRole(database);
    database.query
      .mockResolvedValueOnce([{ id: USER_ID }])
      .mockResolvedValueOnce([]);

    await expect(
      bootstrapAdministrator(database.dataSource, dependencies, INPUT),
    ).rejects.toBeInstanceOf(BootstrapAdministratorEmailConflictError);

    expect(dependencies.passwordHasher.hash).not.toHaveBeenCalled();
    expect(database.commitTransaction).not.toHaveBeenCalled();
    expect(database.rollbackTransaction).toHaveBeenCalledTimes(1);
    expect(database.release).toHaveBeenCalledTimes(1);
  });

  it("refuses to create a second administrator", async () => {
    const database = createBootstrapDatabaseMock();
    const dependencies = createDependencies();
    arrangeAvailableRole(database);
    database.query
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ user_id: OTHER_USER_ID }]);

    await expect(
      bootstrapAdministrator(database.dataSource, dependencies, INPUT),
    ).rejects.toBeInstanceOf(BootstrapAdministratorAlreadyExistsError);

    expect(dependencies.passwordHasher.hash).not.toHaveBeenCalled();
    expect(database.rollbackTransaction).toHaveBeenCalledTimes(1);
  });

  it("fails before reading users when the system role is unavailable", async () => {
    const database = createBootstrapDatabaseMock();
    const dependencies = createDependencies();
    database.query.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    await expect(
      bootstrapAdministrator(database.dataSource, dependencies, INPUT),
    ).rejects.toBeInstanceOf(SystemAdministratorRoleUnavailableError);

    expect(database.query).toHaveBeenCalledTimes(2);
    expect(dependencies.passwordHasher.hash).not.toHaveBeenCalled();
    expect(database.rollbackTransaction).toHaveBeenCalledTimes(1);
  });

  it("rolls back the user and role assignment when activity insertion fails", async () => {
    const database = createBootstrapDatabaseMock();
    const dependencies = createDependencies();
    const persistenceError = new Error("activity persistence failed");
    arrangeAvailableRole(database);
    database.query
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockRejectedValueOnce(persistenceError);

    await expect(
      bootstrapAdministrator(database.dataSource, dependencies, INPUT),
    ).rejects.toBe(persistenceError);

    expect(database.commitTransaction).not.toHaveBeenCalled();
    expect(database.rollbackTransaction).toHaveBeenCalledTimes(1);
    expect(database.release).toHaveBeenCalledTimes(1);
  });
});
