# Authentication and Authorization Implementation Plan

- Status: In progress — Phase 4A implemented; verification pending
- Updated: 2026-09-20
- Owner: API
- Target branch: `feature/auth-protected-requests`

## Authority and related documents

This plan implements the accepted decisions and requirements from:

- [ADR-0005: Authentication and Session Strategy](../03-decisions/0005-authentication-and-session-strategy.md)
- [MVP Architecture Baseline](../02-architecture/mvp-architecture-baseline.md)
- [Initial Database Schema Implementation Plan](initial-database-schema-implementation-plan.md)
- [API Documentation Conventions](../05-api/README.md)
- [Structured Logging Implementation Plan](structured-logging-implementation-plan.md)

If this plan conflicts with ADR-0005, ADR-0005 takes precedence. A security or lifecycle change must update or replace the ADR before implementation.

## Outcome

Deliver email/password authentication, server-side session revocation, rotating opaque refresh tokens, and permission-based authorization for the NestJS API.

The completed slice must provide:

- login for active users
- short-lived JWT access tokens
- refresh-token rotation with reuse detection
- logout and session revocation
- current-user lookup
- current permission checks on every protected request
- stable error codes
- rate limiting for login and refresh
- security events without credential leakage
- integration tests for the required security behavior

## Scope

### Included

- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`
- `GET /api/v1/auth/me`
- `GET /api/v1/auth/sessions`
- `DELETE /api/v1/auth/sessions/:sessionId`
- `DELETE /api/v1/auth/sessions`
- TypeORM mappings for the existing identity and session tables
- Argon2id password verification
- HS256 access-token signing and verification
- opaque refresh-token creation, hashing, rotation, and revocation
- authentication, permission, and object-policy extension points
- Redis-backed authentication rate limits
- activity/security event writes
- OpenAPI descriptions for public authentication endpoints

### Deferred

- forgot-password and password-reset delivery
- LDAP, Active Directory, SAML, and OpenID Connect
- multi-factor authentication
- native-client secure storage
- trusted-device recognition
- asymmetric JWT signing
- cross-service token verification

Password change can be implemented after the initial authentication slice, but it must revoke every active session for the user.

## Existing database foundation

The initial migration already owns the physical schema. TypeORM entities must map to it without generating replacement DDL, and `synchronize` must remain disabled.

| Table                 | Purpose                                            |
| --------------------- | -------------------------------------------------- |
| `users`               | Credentials, account state, and permission version |
| `roles`               | Administrative grouping of permissions             |
| `permissions`         | Stable permission codes                            |
| `user_roles`          | Current role grants for a user                     |
| `role_permissions`    | Current permission grants for a role               |
| `auth_sessions`       | Revocable server-side login sessions               |
| `auth_refresh_tokens` | One-time refresh-token rotation chain              |

The existing constraints for case-insensitive identity, active-session lookup, refresh-token uniqueness, and same-session token chains remain authoritative.

## Module boundaries

### IAM module

`apps/api/src/modules/iam` owns:

- users, roles, permissions, and grants
- account-state queries
- current-permission resolution
- permission and role administration
- permission-version changes
- ports used by the Auth module

Business code checks permission codes. It must not branch on role names.

### Auth module

`apps/api/src/modules/auth` owns:

- credential verification
- access-token issue and verification
- authentication sessions
- refresh-token rotation and reuse detection
- logout and session revocation
- authentication guards and decorators
- browser refresh-cookie behavior
- authentication security events

The Auth module may use IAM application ports. It must not query IAM TypeORM entities directly from presentation or domain code.

### Shared HTTP layer

The existing global exception filter continues to produce the common error envelope and request ID. Authentication code must raise typed application errors and must not return raw JWT, Argon2, Redis, or database errors.

Object-scope authorization stays in the owning business module. The shared permission guard only confirms the global permission requirement before the application service checks the requested resource.

## Planned source layout

Create files only when their implementation phase begins.

```text
apps/api/src/modules/
├── iam/
│   ├── application/
│   │   ├── ports/iam-auth-query.port.ts
│   │   └── services/permission-resolver.service.ts
│   ├── domain/
│   │   ├── permission-code.ts
│   │   └── user-status.ts
│   ├── infrastructure/typeorm/
│   │   ├── entities/user.orm-entity.ts
│   │   ├── entities/role.orm-entity.ts
│   │   ├── entities/permission.orm-entity.ts
│   │   ├── entities/user-role.orm-entity.ts
│   │   ├── entities/role-permission.orm-entity.ts
│   │   └── iam-auth-query.repository.ts
│   └── iam.module.ts
└── auth/
    ├── application/
    │   ├── ports/auth-clock.port.ts
    │   ├── ports/auth-event.port.ts
    │   ├── ports/auth-session-repository.port.ts
    │   ├── ports/password-hasher.port.ts
    │   ├── ports/rate-limiter.port.ts
    │   ├── ports/refresh-token-generator.port.ts
    │   └── ports/token-signer.port.ts
    │   ├── services/login.service.ts
    │   ├── services/refresh-session.service.ts
    │   ├── services/logout.service.ts
    │   └── services/revoke-session.service.ts
    ├── domain/
    │   ├── authenticated-identity.ts
    │   ├── refresh-token.ts
    │   └── session-policy.ts
    ├── infrastructure/
    │   ├── crypto/argon2-password-hasher.ts
    │   ├── crypto/jwt-access-token.service.ts
    │   ├── crypto/opaque-refresh-token.service.ts
    │   ├── redis/redis-auth-rate-limiter.ts
    │   └── typeorm/
    │       ├── entities/auth-session.orm-entity.ts
    │       ├── entities/auth-refresh-token.orm-entity.ts
    │       └── auth-session.repository.ts
    ├── presentation/
    │   ├── decorators/current-identity.decorator.ts
    │   ├── decorators/require-permissions.decorator.ts
    │   ├── dto/login.request.ts
    │   ├── guards/access-token.guard.ts
    │   ├── guards/permission.guard.ts
    │   ├── auth.controller.ts
    │   └── auth-cookie.service.ts
    └── auth.module.ts
```

Tests live beside focused units. Cross-component behavior belongs in `apps/api/test/auth.e2e-spec.ts` or an equivalent integration suite using an isolated test database.

## API contract

All successful JSON responses use the existing `{ "data": ... }` envelope. Error responses use stable machine-readable codes and include the request ID through the existing global error handling.

### POST /api/v1/auth/login

Request:

```json
{
  "email": "user@example.com",
  "password": "plaintext supplied over HTTPS",
  "device_label": "Chrome on macOS"
}
```

Behavior:

1. trim and lowercase the email
2. apply rate limits by IP and normalized account identifier
3. return the same failure status, code, and message for an unknown email, incorrect password, or inactive user
4. verify Argon2id without logging credentials
5. create one session and its first refresh token in one transaction
6. update `last_login_at`
7. write `LOGIN_SUCCEEDED` or a sanitized `LOGIN_FAILED` event
8. return an access token and set the refresh cookie

Response:

```json
{
  "data": {
    "access_token": "<jwt>",
    "token_type": "Bearer",
    "expires_in": 900
  }
}
```

### POST /api/v1/auth/refresh

The request body is empty. The endpoint reads `__Secure-am_refresh`, validates the configured Origin, applies rate limiting, and rotates the token in a database transaction.

A successful response has the same token payload as login and replaces the refresh cookie. Invalid, expired, reused, or revoked credentials return a stable authentication error and clear the cookie when appropriate.

### POST /api/v1/auth/logout

Logout is idempotent:

- validate Origin when a refresh cookie is sent
- revoke the identified session and every refresh token in that session when the credential is valid
- always clear the refresh cookie
- return success even when the cookie is missing, expired, or invalid
- never reveal whether a token ID or session existed

### GET /api/v1/auth/me

Requires a valid Bearer access token and active server-side session.

Response data contains the current user ID, display name, status, and current permission codes. It does not return password data, token data, or internal hashes.

### Session management

`GET /auth/sessions` returns the current user's active sessions with allowlisted device and time metadata.

`DELETE /auth/sessions/:sessionId` revokes one session owned by the current user. Revoking another user's session requires an explicit administrative permission.

`DELETE /auth/sessions` revokes all sessions for the current user. The API contract must explicitly state whether the caller's current session is included; the initial implementation includes it.

## Access token rules

- sign with HS256
- accept HS256 only
- verify issuer, audience, signature, `exp`, and required claims
- use `sub` for user ID and `sid` for session ID
- include `jti`, `iat`, and `exp`
- keep roles, permissions, email, and personal data out of claims
- use a 15-minute default lifetime
- never persist access tokens
- use the JWT header `kid` so current and previous signing keys can overlap during rotation

A verified signature is only the first authentication step. Every protected request must also load the user and session and confirm:

- user status is `ACTIVE`
- session is not revoked
- current time is before idle expiration
- current time is before absolute expiration

The request-scoped authenticated identity can cache this result for the remainder of the same request. Cross-request authorization state must not be trusted solely from JWT claims.

## Refresh-token rules

Format:

```text
<token-id>.<secret>
```

- `token-id` is a UUID selector
- `secret` contains at least 256 bits from a cryptographically secure random source
- the database stores only a lowercase SHA-256 hex digest of the secret
- comparison uses a constant-time function
- raw token values and hashes never enter logs or error metadata

The implementation must verify the secret before treating a consumed token as reuse. This prevents an attacker who knows or guesses a token ID from revoking a valid session with a random secret.

### Successful rotation

Inside one transaction:

1. parse and validate the token format
2. lock the selected refresh-token row
3. lock its session row
4. compare the presented secret hash
5. validate user, session, token expiry, revocation, and consumption state
6. create the successor token in the same session
7. mark the old token used and link its successor
8. update session activity and idle expiry without extending its absolute expiry
9. write `TOKEN_REFRESHED`
10. commit before sending the new cookie

### Reuse detection

A correctly authenticated token that is already used, replaced, or revoked triggers:

- revocation of the session
- revocation of every remaining token in that session/token family
- `REFRESH_TOKEN_REUSE_DETECTED`
- `401 AUTH_SESSION_INVALID`

Row locks and database uniqueness constraints must ensure that two concurrent refresh attempts with the same token cannot both succeed.

## Session policy

Defaults:

| Setting                   |    Default |
| ------------------------- | ---------: |
| Access token lifetime     | 15 minutes |
| Idle session lifetime     |     7 days |
| Absolute session lifetime |    30 days |

On successful refresh:

```text
idle_expires_at = min(now + idle lifetime, expires_at)
```

A session is invalid when it is revoked, idle-expired, absolute-expired, belongs to a non-active user, or refers to a user that no longer exists.

Changing a password, disabling a user, or handling a credential security event must revoke all active sessions for that user.

## Refresh cookie and browser controls

Cookie name: `__Secure-am_refresh` เมื่อ `AUTH_REFRESH_COOKIE_SECURE=true`; local HTTP development ใช้ `am_refresh` เพื่อไม่ละเมิด browser contract ของ `__Secure-` prefix

| Attribute  | Value                                     |
| ---------- | ----------------------------------------- |
| `HttpOnly` | true                                      |
| `Secure`   | true in production                        |
| `SameSite` | `Lax`                                     |
| `Path`     | `/api/v1/auth`                            |
| `Max-Age`  | no later than the session absolute expiry |

Cookie-authenticated endpoints validate `Origin` against the configured allowlist. CORS uses explicit trusted origins with credentials enabled. A wildcard origin must never be combined with credentials.

The Web application keeps the access token in memory and never writes it to localStorage or sessionStorage.

## Permission enforcement

Permission codes use lowercase resource/action form:

```text
resource:action
resource:action:any
```

Examples include `users:read`, `users:manage-roles`, `assets:update`, `audit:scan`, and `audit:scan:any`.

The final permission and system-role catalog is a separate prerequisite before authorization administration is implemented. Its seed must be idempotent, update system-owned descriptions and grants safely, and never overwrite custom roles.

A protected request follows this order:

1. access-token verification
2. active user and session lookup
3. required permission lookup from current database grants
4. object-scope policy in the owning application service
5. domain state and business-rule validation

A role name is never used as an authorization condition in application code.

## Stable errors

| HTTP | Code                        | Use                                                               |
| ---: | --------------------------- | ----------------------------------------------------------------- |
|  401 | `AUTH_INVALID_CREDENTIALS`  | Generic login failure                                             |
|  401 | `AUTH_ACCESS_TOKEN_INVALID` | Invalid token structure, signature, issuer, audience, or claims   |
|  401 | `AUTH_ACCESS_TOKEN_EXPIRED` | Access token expired                                              |
|  401 | `AUTH_SESSION_INVALID`      | Missing, revoked, reused, or otherwise invalid session credential |
|  401 | `AUTH_SESSION_EXPIRED`      | Idle or absolute session expiry                                   |
|  403 | `AUTH_PERMISSION_DENIED`    | Authenticated user lacks required permission or object scope      |
|  429 | `AUTH_RATE_LIMITED`         | Authentication rate limit exceeded                                |

Client responses must not expose token-library messages, password-verification details, SQL errors, Redis errors, or account-existence signals.

## Configuration

Add validated server-only environment variables during implementation:

```text
AUTH_JWT_ISSUER
AUTH_JWT_AUDIENCE
AUTH_JWT_CURRENT_KID
AUTH_JWT_CURRENT_SECRET
AUTH_JWT_PREVIOUS_KID
AUTH_JWT_PREVIOUS_SECRET
AUTH_ACCESS_TOKEN_TTL_SECONDS
AUTH_SESSION_IDLE_TTL_SECONDS
AUTH_SESSION_ABSOLUTE_TTL_SECONDS
AUTH_LOGIN_RATE_LIMIT
AUTH_LOGIN_RATE_WINDOW_SECONDS
AUTH_REFRESH_RATE_LIMIT
AUTH_REFRESH_RATE_WINDOW_SECONDS
AUTH_REFRESH_COOKIE_SECURE
```

Production must reject missing or weak current signing secrets, placeholder values, invalid TTL ordering, and insecure refresh-cookie configuration. Previous key variables are optional as a pair and exist only for a controlled rotation window.

These variables belong to the API environment and must never use the `VITE_` prefix.

## Rate limiting

Use Redis so limits remain effective across API processes.

- login key: trusted client IP plus a one-way digest of normalized email
- refresh key: trusted client IP plus token/session selector
- do not put raw email, token, or password into Redis keys
- apply limits before expensive password verification where possible
- rate-limit failures use the same account-enumeration protections
- explicitly configure trusted proxies before accepting forwarded client IP headers

Redis unavailability must produce a deliberate operational policy. The implementation should fail closed for repeated authentication attempts or return a temporary service error; it must not silently disable authentication limits in production.

## Logging and activity events

Never log:

- plaintext passwords or password hashes
- access or refresh tokens
- refresh-token hashes
- authorization or cookie headers
- raw login/refresh request bodies
- raw JWT or Argon2 errors

Required events:

- `LOGIN_SUCCEEDED`
- `LOGIN_FAILED`
- `TOKEN_REFRESHED`
- `REFRESH_TOKEN_REUSE_DETECTED`
- `SESSION_REVOKED`
- `LOGOUT_SUCCEEDED`
- `AUTHORIZATION_DENIED`

Events use allowlisted reason codes and include request ID, actor ID, and session ID only when available. A state change and its activity event should share the same database transaction when both are stored in PostgreSQL.

## Implementation phases

### Phase 1 — Configuration and cryptography foundation

Status: Complete and verified on 2026-09-16

1. add required JWT, Argon2, cookie, and testing dependencies
2. add and test environment validation
3. implement clock, password-hasher, token-signer, and refresh-token-generator ports
4. add focused unit tests for token claims, algorithms, token parsing, hashing, and expiry calculations

### Phase 2 — IAM persistence and seed catalog

Status: Complete and verified, including bulk-seed reconciliation

1. map the five existing IAM tables
2. implement active-user and current-permission queries
3. define the permission and system-role catalog
4. implement an idempotent development/test seed
5. verify repeated seed runs and custom-role preservation

### Phase 3 — Login

Status: Complete and verified on 2026-09-17

1. implement generic credential verification
2. create session and initial refresh token transactionally
3. set the refresh cookie and return the access token
4. record sanitized login events
5. test active, invalid, and inactive cases

### Phase 3.1 — First-administrator bootstrap

Status: Complete and verified on 2026-09-18

1. accept administrator metadata from explicit command environment and password from standard input only
2. require the seeded active `SYSTEM_ADMIN` system role
3. create the first active user, role assignment, and sanitized activity event atomically
4. serialize concurrent attempts and refuse silent privilege elevation or a second bootstrap administrator
5. make repeated execution for the same normalized administrator email a credential-preserving no-op

### Phase 4 — Protected requests

Status: Phase 4A implemented; verification pending. Phase 4B permission enforcement has not started.

1. implement access-token guard
2. load active user and session on every protected request
3. implement permission metadata and guard
4. implement `GET /auth/me`
5. verify immediate session revocation and permission-change behavior

### Phase 5 — Refresh rotation

1. implement Origin and cookie validation
2. implement row-locked refresh rotation
3. implement reuse detection and family/session revocation
4. test expiry, reuse, and concurrent refresh behavior

### Phase 6 — Logout and session management

1. implement idempotent logout and cookie clearing
2. implement session listing
3. implement single-session and all-session revocation
4. verify ownership and administrative permission checks

### Phase 7 — Rate limiting, audit, and cleanup

1. implement Redis-backed login and refresh limits
2. complete security/activity event coverage
3. add expired and revoked session/token retention cleanup
4. document the operational schedule and failure policy

### Phase 8 — API and release verification

1. generate OpenAPI definitions from NestJS decorators
2. verify error and cookie contracts
3. run unit, integration, security, typecheck, and production-build checks
4. update the project checklist and local-development guide

## Verification matrix

The implementation is not complete until these behaviors pass:

- active user login succeeds
- unknown email, wrong password, and inactive user have the same public response
- passwords are stored and verified with Argon2id
- JWT verifier rejects wrong algorithm, issuer, audience, signature, malformed claims, and expiration
- revoked and expired sessions reject otherwise valid access tokens
- refresh rotation succeeds and replaces the cookie
- the old refresh token cannot be used successfully again
- authenticated token reuse revokes the session and token family
- only one concurrent refresh attempt succeeds
- logout prevents further access and refresh
- session revocation is limited to the owner or an authorized administrator
- permission changes affect the next protected request
- users cannot elevate their own privileges
- disallowed browser origins cannot use cookie endpoints
- login and refresh rate limits work
- secrets, credentials, cookies, and hashes do not appear in logs
- database state and activity event remain atomic
- API typecheck and production build pass

## Definition of done

Authentication is complete when:

- all included endpoints follow the documented contract
- configuration has no production fallback secrets
- every protected request checks current user and session state
- authorization uses current permission grants and object policies
- refresh rotation and reuse detection are transaction-safe
- logout and administrative security changes revoke sessions correctly
- rate limits and browser-origin controls are enforced
- OpenAPI and operational documentation are current
- all required verification cases pass
