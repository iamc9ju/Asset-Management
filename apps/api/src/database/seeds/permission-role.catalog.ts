export const PERMISSION_CODE = {
  USER_READ: "user:read",
  USER_CREATE: "user:create",
  USER_STATUS_UPDATE: "user:status:update",
  ROLE_READ: "role:read",
  ROLE_CREATE: "role:create",
  ROLE_UPDATE: "role:update",
  ROLE_ASSIGN: "role:assign",
  ROLE_PERMISSION_MANAGE: "role:permission:manage",
  SESSION_READ_ANY: "session:read:any",
  SESSION_REVOKE_ANY: "session:revoke:any",
  CATEGORY_READ: "category:read",
  CATEGORY_CREATE: "category:create",
  CATEGORY_UPDATE: "category:update",
  LOCATION_READ: "location:read",
  LOCATION_CREATE: "location:create",
  LOCATION_UPDATE: "location:update",
  ASSET_READ: "asset:read",
  ASSET_CREATE: "asset:create",
  ASSET_UPDATE: "asset:update",
  ASSET_LIFECYCLE_UPDATE: "asset:lifecycle:update",
  ASSET_IDENTIFIER_READ: "asset:identifier:read",
  ASSET_IDENTIFIER_MANAGE: "asset:identifier:manage",
  ASSET_ASSIGN: "asset:assign",
  ASSET_TRANSFER: "asset:transfer",
  AUDIT_CREATE: "audit:create",
  AUDIT_SCOPE_MANAGE: "audit:scope:manage",
  AUDIT_START: "audit:start",
  AUDIT_READ: "audit:read",
  AUDIT_SCAN: "audit:scan",
  AUDIT_SCAN_ANY: "audit:scan:any",
  AUDIT_SUBMIT: "audit:submit",
  AUDIT_FINALIZE: "audit:finalize",
  AUDIT_REOPEN: "audit:reopen",
  ISSUE_CREATE: "issue:create",
  ISSUE_READ: "issue:read",
  ISSUE_INVESTIGATE: "issue:investigate",
  ISSUE_RESOLVE: "issue:resolve",
  ISSUE_CLOSE: "issue:close",
  ISSUE_REOPEN: "issue:reopen",
  ACTIVITY_LOG_READ: "activity-log:read",
} as const;

export type PermissionCode =
  (typeof PERMISSION_CODE)[keyof typeof PERMISSION_CODE];

export const SYSTEM_ROLE_CODE = {
  SYSTEM_ADMIN: "SYSTEM_ADMIN",
  ASSET_OFFICER: "ASSET_OFFICER",
  AUDITOR: "AUDITOR",
  VIEWER: "VIEWER",
} as const;

export type SystemRoleCode =
  (typeof SYSTEM_ROLE_CODE)[keyof typeof SYSTEM_ROLE_CODE];

export interface PermissionCatalogEntry {
  readonly code: PermissionCode;
  readonly description: string;
}

export interface SystemRoleCatalogEntry {
  readonly code: SystemRoleCode;
  readonly name: string;
  readonly description: string;
  readonly permissionCodes: readonly PermissionCode[];
}

export interface PermissionRoleCatalog {
  readonly permissions: readonly PermissionCatalogEntry[];
  readonly systemRoles: readonly SystemRoleCatalogEntry[];
}

const PERMISSIONS: readonly PermissionCatalogEntry[] = [
  { code: PERMISSION_CODE.USER_READ, description: "List and view users" },
  { code: PERMISSION_CODE.USER_CREATE, description: "Create a user" },
  {
    code: PERMISSION_CODE.USER_STATUS_UPDATE,
    description: "Activate, disable, or suspend a user",
  },
  {
    code: PERMISSION_CODE.ROLE_READ,
    description: "List roles and their permission grants",
  },
  {
    code: PERMISSION_CODE.ROLE_CREATE,
    description: "Create a custom role",
  },
  {
    code: PERMISSION_CODE.ROLE_UPDATE,
    description: "Update or disable a custom role",
  },
  {
    code: PERMISSION_CODE.ROLE_ASSIGN,
    description: "Replace role grants for a user",
  },
  {
    code: PERMISSION_CODE.ROLE_PERMISSION_MANAGE,
    description: "Replace permission grants for a role",
  },
  {
    code: PERMISSION_CODE.SESSION_READ_ANY,
    description: "View sessions belonging to another user",
  },
  {
    code: PERMISSION_CODE.SESSION_REVOKE_ANY,
    description: "Revoke sessions belonging to another user",
  },
  {
    code: PERMISSION_CODE.CATEGORY_READ,
    description: "List and view asset categories",
  },
  {
    code: PERMISSION_CODE.CATEGORY_CREATE,
    description: "Create an asset category",
  },
  {
    code: PERMISSION_CODE.CATEGORY_UPDATE,
    description: "Edit, move, or disable an asset category",
  },
  {
    code: PERMISSION_CODE.LOCATION_READ,
    description: "List and view the location tree",
  },
  {
    code: PERMISSION_CODE.LOCATION_CREATE,
    description: "Create a location",
  },
  {
    code: PERMISSION_CODE.LOCATION_UPDATE,
    description: "Edit, move, or disable a location",
  },
  {
    code: PERMISSION_CODE.ASSET_READ,
    description: "Search and view assets and their timelines",
  },
  { code: PERMISSION_CODE.ASSET_CREATE, description: "Register an asset" },
  {
    code: PERMISSION_CODE.ASSET_UPDATE,
    description: "Update allowed asset master fields",
  },
  {
    code: PERMISSION_CODE.ASSET_LIFECYCLE_UPDATE,
    description: "Activate, retire, or dispose an asset",
  },
  {
    code: PERMISSION_CODE.ASSET_IDENTIFIER_READ,
    description: "View identifier history",
  },
  {
    code: PERMISSION_CODE.ASSET_IDENTIFIER_MANAGE,
    description: "Generate or replace identifiers",
  },
  {
    code: PERMISSION_CODE.ASSET_ASSIGN,
    description: "Assign, reassign, or return an asset",
  },
  {
    code: PERMISSION_CODE.ASSET_TRANSFER,
    description: "Transfer an asset or correct its location",
  },
  {
    code: PERMISSION_CODE.AUDIT_CREATE,
    description: "Create a draft audit campaign",
  },
  {
    code: PERMISSION_CODE.AUDIT_SCOPE_MANAGE,
    description: "Manage scope and refresh a draft snapshot",
  },
  {
    code: PERMISSION_CODE.AUDIT_START,
    description: "Schedule or start a campaign",
  },
  {
    code: PERMISSION_CODE.AUDIT_READ,
    description: "List and view campaigns, progress, and results",
  },
  {
    code: PERMISSION_CODE.AUDIT_SCAN,
    description:
      "Read assigned work items and submit scans within assigned campaign scope",
  },
  {
    code: PERMISSION_CODE.AUDIT_SCAN_ANY,
    description: "Submit scans without the assigned-auditor scope restriction",
  },
  {
    code: PERMISSION_CODE.AUDIT_SUBMIT,
    description: "Submit assigned audit work for review",
  },
  {
    code: PERMISSION_CODE.AUDIT_FINALIZE,
    description: "Finalize an eligible campaign",
  },
  {
    code: PERMISSION_CODE.AUDIT_REOPEN,
    description: "Reopen a finalized campaign with a reason",
  },
  {
    code: PERMISSION_CODE.ISSUE_CREATE,
    description: "Create an audit issue",
  },
  {
    code: PERMISSION_CODE.ISSUE_READ,
    description: "List and view issue details and history",
  },
  {
    code: PERMISSION_CODE.ISSUE_INVESTIGATE,
    description: "Move an issue into investigation",
  },
  {
    code: PERMISSION_CODE.ISSUE_RESOLVE,
    description: "Resolve an issue with the required resolution",
  },
  {
    code: PERMISSION_CODE.ISSUE_CLOSE,
    description: "Close an eligible issue",
  },
  {
    code: PERMISSION_CODE.ISSUE_REOPEN,
    description: "Reopen an issue with a reason",
  },
  {
    code: PERMISSION_CODE.ACTIVITY_LOG_READ,
    description: "Search and view the sanitized activity trail",
  },
];

const SYSTEM_ROLES: readonly SystemRoleCatalogEntry[] = [
  {
    code: SYSTEM_ROLE_CODE.SYSTEM_ADMIN,
    name: "System Administrator",
    description:
      "Manage users, roles, permissions, sessions, and security audit access",
    permissionCodes: [
      PERMISSION_CODE.USER_READ,
      PERMISSION_CODE.USER_CREATE,
      PERMISSION_CODE.USER_STATUS_UPDATE,
      PERMISSION_CODE.ROLE_READ,
      PERMISSION_CODE.ROLE_CREATE,
      PERMISSION_CODE.ROLE_UPDATE,
      PERMISSION_CODE.ROLE_ASSIGN,
      PERMISSION_CODE.ROLE_PERMISSION_MANAGE,
      PERMISSION_CODE.SESSION_READ_ANY,
      PERMISSION_CODE.SESSION_REVOKE_ANY,
      PERMISSION_CODE.ACTIVITY_LOG_READ,
    ],
  },
  {
    code: SYSTEM_ROLE_CODE.ASSET_OFFICER,
    name: "Asset Officer",
    description:
      "Manage asset master data, custody, locations, campaigns, and issues",
    permissionCodes: [
      PERMISSION_CODE.CATEGORY_READ,
      PERMISSION_CODE.CATEGORY_CREATE,
      PERMISSION_CODE.CATEGORY_UPDATE,
      PERMISSION_CODE.LOCATION_READ,
      PERMISSION_CODE.LOCATION_CREATE,
      PERMISSION_CODE.LOCATION_UPDATE,
      PERMISSION_CODE.ASSET_READ,
      PERMISSION_CODE.ASSET_CREATE,
      PERMISSION_CODE.ASSET_UPDATE,
      PERMISSION_CODE.ASSET_LIFECYCLE_UPDATE,
      PERMISSION_CODE.ASSET_IDENTIFIER_READ,
      PERMISSION_CODE.ASSET_IDENTIFIER_MANAGE,
      PERMISSION_CODE.ASSET_ASSIGN,
      PERMISSION_CODE.ASSET_TRANSFER,
      PERMISSION_CODE.AUDIT_CREATE,
      PERMISSION_CODE.AUDIT_SCOPE_MANAGE,
      PERMISSION_CODE.AUDIT_START,
      PERMISSION_CODE.AUDIT_READ,
      PERMISSION_CODE.AUDIT_FINALIZE,
      PERMISSION_CODE.AUDIT_REOPEN,
      PERMISSION_CODE.ISSUE_CREATE,
      PERMISSION_CODE.ISSUE_READ,
      PERMISSION_CODE.ISSUE_INVESTIGATE,
      PERMISSION_CODE.ISSUE_RESOLVE,
      PERMISSION_CODE.ISSUE_CLOSE,
      PERMISSION_CODE.ISSUE_REOPEN,
      PERMISSION_CODE.ACTIVITY_LOG_READ,
    ],
  },
  {
    code: SYSTEM_ROLE_CODE.AUDITOR,
    name: "Auditor",
    description: "Work on assigned audit campaigns and submit observations",
    permissionCodes: [
      PERMISSION_CODE.CATEGORY_READ,
      PERMISSION_CODE.LOCATION_READ,
      PERMISSION_CODE.ASSET_READ,
      PERMISSION_CODE.ASSET_IDENTIFIER_READ,
      PERMISSION_CODE.AUDIT_READ,
      PERMISSION_CODE.AUDIT_SCAN,
      PERMISSION_CODE.AUDIT_SUBMIT,
      PERMISSION_CODE.ISSUE_CREATE,
      PERMISSION_CODE.ISSUE_READ,
    ],
  },
  {
    code: SYSTEM_ROLE_CODE.VIEWER,
    name: "Viewer",
    description: "Read asset and audit information without mutation access",
    permissionCodes: [
      PERMISSION_CODE.CATEGORY_READ,
      PERMISSION_CODE.LOCATION_READ,
      PERMISSION_CODE.ASSET_READ,
      PERMISSION_CODE.ASSET_IDENTIFIER_READ,
      PERMISSION_CODE.AUDIT_READ,
      PERMISSION_CODE.ISSUE_READ,
    ],
  },
];

export const PERMISSION_ROLE_CATALOG: PermissionRoleCatalog = {
  permissions: PERMISSIONS,
  systemRoles: SYSTEM_ROLES,
};

export class PermissionRoleCatalogValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PermissionRoleCatalogValidationError";
  }
}

export function validatePermissionRoleCatalog(
  catalog: PermissionRoleCatalog,
): void {
  const permissionCodes = validateUniqueCodes(
    "permission",
    catalog.permissions.map((permission) => permission.code),
  );
  validateUniqueCodes(
    "system role",
    catalog.systemRoles.map((role) => role.code),
  );

  for (const permission of catalog.permissions) {
    assertNonBlank("permission description", permission.description);
  }

  for (const role of catalog.systemRoles) {
    assertNonBlank("system role name", role.name);
    assertNonBlank("system role description", role.description);
    validateUniqueCodes(
      `permission grant for role ${role.code}`,
      role.permissionCodes,
    );

    for (const permissionCode of role.permissionCodes) {
      if (!permissionCodes.has(normalizeCode(permissionCode))) {
        throw new PermissionRoleCatalogValidationError(
          `System role ${role.code} references unknown permission ${permissionCode}`,
        );
      }
    }
  }
}

function validateUniqueCodes(
  category: string,
  codes: readonly string[],
): ReadonlySet<string> {
  const normalizedCodes = new Set<string>();

  for (const code of codes) {
    assertNonBlank(`${category} code`, code);
    const normalizedCode = normalizeCode(code);

    if (normalizedCodes.has(normalizedCode)) {
      throw new PermissionRoleCatalogValidationError(
        `Duplicate ${category} code detected: ${code}`,
      );
    }

    normalizedCodes.add(normalizedCode);
  }

  return normalizedCodes;
}

function assertNonBlank(field: string, value: string): void {
  if (value.trim().length === 0) {
    throw new PermissionRoleCatalogValidationError(
      `${field} must not be blank`,
    );
  }
}

function normalizeCode(code: string): string {
  return code.toLocaleLowerCase("en-US");
}
