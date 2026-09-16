import type { DataSource, QueryRunner } from "typeorm";
import { PERMISSION_ROLE_CATALOG } from "./permission-role.catalog";
import {
  ReservedSystemRoleCodeError,
  seedPermissionsAndRoles,
} from "./seed-permissions-and-roles";

interface SeedDatabaseMock {
  readonly dataSource: DataSource;
  readonly queryRunner: QueryRunner;
  readonly query: jest.Mock;
  readonly startTransaction: jest.Mock;
  readonly commitTransaction: jest.Mock;
  readonly rollbackTransaction: jest.Mock;
  readonly release: jest.Mock;
}

function createSeedDatabaseMock(): SeedDatabaseMock {
  const query = jest.fn();
  const startTransaction = jest.fn().mockResolvedValue(undefined);
  const commitTransaction = jest.fn().mockResolvedValue(undefined);
  const rollbackTransaction = jest.fn().mockResolvedValue(undefined);
  const release = jest.fn().mockResolvedValue(undefined);
  const queryRunner = {
    connect: jest.fn().mockResolvedValue(undefined),
    startTransaction,
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
    queryRunner,
    query,
    startTransaction,
    commitTransaction,
    rollbackTransaction,
    release,
  };
}

describe("seedPermissionsAndRoles bulk orchestration", () => {
  it("uses a bounded four-query transaction for the complete catalog", async () => {
    const database = createSeedDatabaseMock();
    const expectedGrantCount = PERMISSION_ROLE_CATALOG.systemRoles.reduce(
      (total, role) => total + role.permissionCodes.length,
      0,
    );
    database.query
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          inserted: PERMISSION_ROLE_CATALOG.permissions.length,
          updated: 0,
          code_changed_permission_ids: [],
        },
      ])
      .mockResolvedValueOnce([
        {
          inserted: PERMISSION_ROLE_CATALOG.systemRoles.length,
          updated: 0,
          collision_codes: [],
          effective_grant_changed_role_ids: [],
        },
      ])
      .mockResolvedValueOnce([
        {
          inserted: expectedGrantCount,
          removed: 0,
          user_permission_versions_incremented: 0,
        },
      ]);

    await expect(seedPermissionsAndRoles(database.dataSource)).resolves.toEqual(
      {
        permissionsInserted: PERMISSION_ROLE_CATALOG.permissions.length,
        permissionsUpdated: 0,
        rolesInserted: PERMISSION_ROLE_CATALOG.systemRoles.length,
        rolesUpdated: 0,
        grantsInserted: expectedGrantCount,
        grantsRemoved: 0,
        userPermissionVersionsIncremented: 0,
      },
    );

    expect(database.query).toHaveBeenCalledTimes(4);
    expect(database.startTransaction).toHaveBeenCalledTimes(1);
    expect(database.commitTransaction).toHaveBeenCalledTimes(1);
    expect(database.rollbackTransaction).not.toHaveBeenCalled();
    expect(database.release).toHaveBeenCalledTimes(1);
  });

  it("rolls back before grant reconciliation on reserved-role collision", async () => {
    const database = createSeedDatabaseMock();
    database.query
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          inserted: PERMISSION_ROLE_CATALOG.permissions.length,
          updated: 0,
          code_changed_permission_ids: [],
        },
      ])
      .mockResolvedValueOnce([
        {
          inserted: 0,
          updated: 0,
          collision_codes: ["viewer"],
          effective_grant_changed_role_ids: [],
        },
      ]);

    await expect(
      seedPermissionsAndRoles(database.dataSource),
    ).rejects.toBeInstanceOf(ReservedSystemRoleCodeError);

    expect(database.query).toHaveBeenCalledTimes(3);
    expect(database.commitTransaction).not.toHaveBeenCalled();
    expect(database.rollbackTransaction).toHaveBeenCalledTimes(1);
    expect(database.release).toHaveBeenCalledTimes(1);
  });
});
