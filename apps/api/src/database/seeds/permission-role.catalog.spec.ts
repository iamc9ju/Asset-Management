import {
  PERMISSION_CODE,
  PERMISSION_ROLE_CATALOG,
  PermissionRoleCatalogValidationError,
  SYSTEM_ROLE_CODE,
  type PermissionCode,
  validatePermissionRoleCatalog,
} from "./permission-role.catalog";

const MUTATION_SUFFIX_PATTERN =
  /:(create|update|manage|assign|transfer|start|scan|submit|finalize|reopen|investigate|resolve|close)$/;

describe("permission and system-role catalog", () => {
  it("is internally valid", () => {
    expect(() =>
      validatePermissionRoleCatalog(PERMISSION_ROLE_CATALOG),
    ).not.toThrow();
  });

  it("rejects permission codes that collide case-insensitively", () => {
    const firstPermission = PERMISSION_ROLE_CATALOG.permissions[0]!;
    const invalidCatalog = {
      ...PERMISSION_ROLE_CATALOG,
      permissions: [
        ...PERMISSION_ROLE_CATALOG.permissions,
        {
          ...firstPermission,
          code: firstPermission.code.toUpperCase() as PermissionCode,
        },
      ],
    };

    expect(() => validatePermissionRoleCatalog(invalidCatalog)).toThrow(
      PermissionRoleCatalogValidationError,
    );
  });

  it("rejects grants that reference an unknown permission", () => {
    const viewer = PERMISSION_ROLE_CATALOG.systemRoles.find(
      (role) => role.code === SYSTEM_ROLE_CODE.VIEWER,
    )!;
    const invalidCatalog = {
      ...PERMISSION_ROLE_CATALOG,
      systemRoles: [
        ...PERMISSION_ROLE_CATALOG.systemRoles.filter(
          (role) => role.code !== SYSTEM_ROLE_CODE.VIEWER,
        ),
        {
          ...viewer,
          permissionCodes: [
            ...viewer.permissionCodes,
            "unknown:permission" as PermissionCode,
          ],
        },
      ],
    };

    expect(() => validatePermissionRoleCatalog(invalidCatalog)).toThrow(
      /references unknown permission unknown:permission/,
    );
  });

  it("preserves the intended least-privilege role boundaries", () => {
    const rolesByCode = new Map(
      PERMISSION_ROLE_CATALOG.systemRoles.map((role) => [role.code, role]),
    );
    const systemAdmin = rolesByCode.get(SYSTEM_ROLE_CODE.SYSTEM_ADMIN)!;
    const auditor = rolesByCode.get(SYSTEM_ROLE_CODE.AUDITOR)!;
    const viewer = rolesByCode.get(SYSTEM_ROLE_CODE.VIEWER)!;

    expect(systemAdmin.permissionCodes).not.toContain(
      PERMISSION_CODE.ASSET_UPDATE,
    );
    expect(systemAdmin.permissionCodes).not.toContain(
      PERMISSION_CODE.AUDIT_FINALIZE,
    );
    expect(auditor.permissionCodes).not.toContain(
      PERMISSION_CODE.AUDIT_SCAN_ANY,
    );
    expect(
      viewer.permissionCodes.filter((code) =>
        MUTATION_SUFFIX_PATTERN.test(code),
      ),
    ).toEqual([]);
  });
});
