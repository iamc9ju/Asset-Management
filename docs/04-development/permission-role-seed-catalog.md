# Permission and System Role Seed Catalog

- Status: Implemented and verified
- Updated: 2026-09-16
- Owner: IAM/API
- Target branch: `feature/authentication-foundation`

## Authority and related documents

This catalog implements the permission model defined by:

- [MVP Architecture Baseline](../02-architecture/mvp-architecture-baseline.md)
- [ADR-0005: Authentication and Session Strategy](../03-decisions/0005-authentication-and-session-strategy.md)
- [Authentication and Authorization Implementation Plan](authentication-implementation-plan.md)
- [Initial Database Schema Implementation Plan](initial-database-schema-implementation-plan.md)

The endpoint catalog in the MVP Architecture Baseline is authoritative for existing permission codes. New endpoint permissions must update that catalog and this document together.

## Purpose

Define stable permission codes, built-in roles, default grants, and idempotent seed behavior before implementing IAM repositories and authentication guards.

The catalog must provide a safe baseline without embedding role names in business logic. Application code checks permission codes and object-scope policies only.

## Rules

- permission codes are lowercase and use colon-separated resource/action segments
- codes are stable identifiers and are never translated
- display names and descriptions may change without changing codes
- every mutation endpoint requires an explicit permission unless it is a public authentication operation
- read permissions never imply mutation permissions
- `:any` bypasses a specific object-scope restriction; it does not bypass authentication, session validation, domain rules, or input validation
- built-in roles are system-owned catalog entries
- custom roles may reuse permissions but are never overwritten by the seed
- user-role assignments are never created or removed by the catalog seed
- no default password or administrator account is seeded

## System roles

| Code            | Name                 | Purpose                                                               |
| --------------- | -------------------- | --------------------------------------------------------------------- |
| `SYSTEM_ADMIN`  | System Administrator | Manage users, roles, permissions, sessions, and security audit access |
| `ASSET_OFFICER` | Asset Officer        | Manage asset master data, custody, locations, campaigns, and issues   |
| `AUDITOR`       | Auditor              | Work on assigned audit campaigns and submit observations              |
| `VIEWER`        | Viewer               | Read asset and audit information without mutation access              |

All four records use `is_system=true` and `is_active=true`.

The System Administrator role does not automatically receive asset or audit mutation permissions. This preserves the architecture rule that system administration does not imply authority to change audit results.

## Permission catalog

### User, role, and session administration

| Code                     | Description                               |
| ------------------------ | ----------------------------------------- |
| `user:read`              | List and view users                       |
| `user:create`            | Create a user                             |
| `user:status:update`     | Activate, disable, or suspend a user      |
| `role:read`              | List roles and their permission grants    |
| `role:create`            | Create a custom role                      |
| `role:update`            | Update or disable a custom role           |
| `role:assign`            | Replace role grants for a user            |
| `role:permission:manage` | Replace permission grants for a role      |
| `session:read:any`       | View sessions belonging to another user   |
| `session:revoke:any`     | Revoke sessions belonging to another user |

A user may list and revoke their own sessions through authenticated self-service endpoints without an `:any` permission. Ownership must still be checked by the application service.

### Asset categories

| Code              | Description                              |
| ----------------- | ---------------------------------------- |
| `category:read`   | List and view asset categories           |
| `category:create` | Create an asset category                 |
| `category:update` | Edit, move, or disable an asset category |

### Locations

| Code              | Description                       |
| ----------------- | --------------------------------- |
| `location:read`   | List and view the location tree   |
| `location:create` | Create a location                 |
| `location:update` | Edit, move, or disable a location |

### Assets

| Code                      | Description                                |
| ------------------------- | ------------------------------------------ |
| `asset:read`              | Search and view assets and their timelines |
| `asset:create`            | Register an asset                          |
| `asset:update`            | Update allowed asset master fields         |
| `asset:lifecycle:update`  | Activate, retire, or dispose an asset      |
| `asset:identifier:read`   | View identifier history                    |
| `asset:identifier:manage` | Generate or replace identifiers            |
| `asset:assign`            | Assign, reassign, or return an asset       |
| `asset:transfer`          | Transfer an asset or correct its location  |

### Audit campaigns

| Code                 | Description                                                              |
| -------------------- | ------------------------------------------------------------------------ |
| `audit:create`       | Create a draft audit campaign                                            |
| `audit:scope:manage` | Manage scope and refresh a draft snapshot                                |
| `audit:start`        | Schedule or start a campaign                                             |
| `audit:read`         | List and view campaigns, progress, and results                           |
| `audit:scan`         | Read assigned work items and submit scans within assigned campaign scope |
| `audit:scan:any`     | Submit scans without the assigned-auditor scope restriction              |
| `audit:submit`       | Submit assigned audit work for review                                    |
| `audit:finalize`     | Finalize an eligible campaign                                            |
| `audit:reopen`       | Reopen a finalized campaign with a reason                                |

`audit:scan:any` is deliberately not granted to a built-in role. It is available for an explicitly approved custom role or emergency operational grant.

### Audit issues

| Code                | Description                                   |
| ------------------- | --------------------------------------------- |
| `issue:create`      | Create an audit issue                         |
| `issue:read`        | List and view issue details and history       |
| `issue:investigate` | Move an issue into investigation              |
| `issue:resolve`     | Resolve an issue with the required resolution |
| `issue:close`       | Close an eligible issue                       |
| `issue:reopen`      | Reopen an issue with a reason                 |

### Activity log

| Code                | Description                                  |
| ------------------- | -------------------------------------------- |
| `activity-log:read` | Search and view the sanitized activity trail |

## Default grants

### SYSTEM_ADMIN

- `user:read`
- `user:create`
- `user:status:update`
- `role:read`
- `role:create`
- `role:update`
- `role:assign`
- `role:permission:manage`
- `session:read:any`
- `session:revoke:any`
- `activity-log:read`

### ASSET_OFFICER

- `category:read`
- `category:create`
- `category:update`
- `location:read`
- `location:create`
- `location:update`
- `asset:read`
- `asset:create`
- `asset:update`
- `asset:lifecycle:update`
- `asset:identifier:read`
- `asset:identifier:manage`
- `asset:assign`
- `asset:transfer`
- `audit:create`
- `audit:scope:manage`
- `audit:start`
- `audit:read`
- `audit:finalize`
- `audit:reopen`
- `issue:create`
- `issue:read`
- `issue:investigate`
- `issue:resolve`
- `issue:close`
- `issue:reopen`
- `activity-log:read`

### AUDITOR

- `category:read`
- `location:read`
- `asset:read`
- `asset:identifier:read`
- `audit:read`
- `audit:scan`
- `audit:submit`
- `issue:create`
- `issue:read`

The assigned-campaign object policy remains mandatory for `audit:read`, `audit:scan`, `audit:submit`, and related issue access.

### VIEWER

- `category:read`
- `location:read`
- `asset:read`
- `asset:identifier:read`
- `audit:read`
- `issue:read`

Viewer receives no mutation permission.

## Authorization behavior

Permission checks are additive across all active roles assigned to the user.

A successful global permission check does not imply object access. Examples:

- `audit:scan` also requires the user to be an assigned auditor for the campaign
- `audit:scan:any` bypasses only that assignment check
- `audit:read` may still restrict an Auditor to assigned campaigns
- `issue:read` follows the scope of its campaign or related audit object
- self-service session operations require session ownership
- administrative session operations require `session:read:any` or `session:revoke:any`

A role that is inactive contributes no permissions. A disabled or suspended user cannot authenticate or authorize even if role grants remain in the database.

## Seed ownership and reconciliation

Implement the catalog in:

```text
apps/api/src/database/seeds/permission-role.catalog.ts
apps/api/src/database/seeds/seed-permissions-and-roles.ts
apps/api/src/database/seeds/seed-permissions-and-roles.integration.spec.ts
```

The seed is an explicit deployment or development command. It must not run implicitly on every API startup.

The catalog is passed to PostgreSQL as JSON and reconciled with set-based CTE statements. The seed must not issue one insert or update per catalog entry because remote development databases amplify per-query network latency. Keep the number of database round trips bounded as the catalog grows.

Run the seed in one transaction:

1. validate that every catalog code is unique case-insensitively
2. upsert permission descriptions by stable permission code
3. upsert built-in role names and descriptions by stable role code
4. enforce `is_system=true` for catalog roles
5. add missing grants for built-in roles
6. remove grants from built-in roles that are no longer in the catalog
7. leave custom roles and all user-role assignments unchanged
8. commit only after the complete catalog is consistent

The implementation uses one advisory-lock query and three bulk reconciliation queries inside the transaction: permissions, system roles, and grants plus affected-user permission versions.

The implementation must detect an existing non-system role using a reserved system-role code and fail with an actionable error instead of silently taking ownership.

Permission rows are never automatically deleted when removed from a later catalog version. Removing a permission requires a reviewed data migration because custom roles may still reference it.

## Stable identity strategy

Role and permission relationships use database UUIDs, while application and seed logic resolve them by stable code.

The implementation may use catalog-owned deterministic UUID constants, but it must still detect code/ID collisions before reconciliation. API clients and business logic must never depend on those UUID values.

## Permission-version changes

Any committed change to a user's effective grants must increment `users.permission_version`, including:

- assigning or removing a user role
- changing permissions on a role assigned to that user
- activating or deactivating an assigned role

The first implementation reads current grants for every protected request, so `permission_version` is not trusted as a substitute for a database authorization lookup. It remains available for cache invalidation and future optimization.

The catalog seed does not increment versions for users in an empty development database. If it changes grants for a built-in role already assigned to users, it must increment affected users' permission versions in the same transaction.

## Bootstrap administrator

The catalog does not seed a user or default password.

A first administrator must be created through a separate, explicit bootstrap command that:

- refuses weak or default credentials
- hashes the password with the same Argon2id policy as login
- assigns `SYSTEM_ADMIN`
- writes an activity event
- is idempotent by normalized email
- is disabled or tightly controlled after initial provisioning

This bootstrap command is a later IAM implementation task and is not part of the permission catalog seed.

## Verification

The seed implementation is complete when tests prove:

- a clean database receives every catalog permission and system role
- every built-in role receives exactly its documented grants
- running the seed twice produces the same state
- permission and role codes are unique case-insensitively
- a custom role and its grants remain unchanged
- user-role assignments remain unchanged
- an existing custom role cannot be silently converted into a system role
- removing a grant from the catalog removes it only from the matching system role
- catalog reconciliation does not delete permission rows
- effective grants are the union of active assigned roles
- Viewer has no mutation permission
- Auditor does not receive `audit:scan:any`
- System Administrator does not automatically receive asset or audit mutation permissions
- grant changes increment affected users' permission versions
- seed failure rolls back the complete transaction

## Change process

When adding an endpoint:

1. add or reuse a permission in the MVP endpoint catalog
2. update this permission catalog
3. decide built-in role grants explicitly
4. add permission and object-scope tests
5. run the idempotent seed
6. record security-sensitive grant changes in the release notes

Renaming a permission code is a data migration and authorization-contract change. It must not be performed as a description-only seed update.
