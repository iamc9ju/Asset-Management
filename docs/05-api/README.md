# API Documentation

API base path: `/api/v1`

## Conventions

- ใช้ REST resource nouns และ explicit command endpoint สำหรับ state transition เช่น `/assets/:id/transfer`
- mutation รองรับ request correlation; operation ที่ retry ได้ต้องมี idempotency key
- validation และ authorization ทำที่ backend เสมอ
- business success response ใช้ `{ "data": ... }`; paginated response เพิ่ม `meta`
- error response ใช้ stable machine-readable `code`
- OpenAPI generate จาก NestJS decorators โดยใช้ lazy document factory
- OpenAPI endpoints ปิดโดยค่าเริ่มต้นและเปิดผ่าน `OPENAPI_ENABLED`
- Swagger UI เปิดแยกผ่าน `OPENAPI_UI_ENABLED`

## Response contracts

Business API ใช้ response envelope ต่อไปนี้เป็นมาตรฐาน:

- single resource: `{ "data": { ... } }`
- non-paginated collection: `{ "data": [ ... ] }`
- paginated collection: `{ "data": [ ... ], "meta": { "page", "limit", "total", "total_pages" } }`
- error: `{ "error": { "code", "message", "details", "request_id" } }`
- no content: HTTP `204` โดยไม่มี response body

ทุก response มี `x-request-id` header ส่วน error response ต้องมี `error.request_id` ค่าเดียวกับ header ด้วย Success response ไม่เพิ่ม `success`, `status_code`, generic `message`, timestamp หรือ request ID ซ้ำใน body

External JSON contract ใช้ `snake_case`; application code ภายในใช้ `camelCase` ได้ตาม TypeScript conventions ค่า collection ว่างต้องเป็น `[]` ไม่ใช่ `null` และ resource ที่ไม่มีต้องตอบ `404` แทน `{ "data": null }`

Health/readiness, OpenAPI JSON, binary/file streaming และ `204 No Content` เป็นข้อยกเว้นที่ไม่ถูกครอบด้วย `data` envelope โดยต้องประกาศ contract ของตนเองอย่างชัดเจน

Controller ต้องสร้าง envelope อย่างชัดเจนผ่าน shared response factory และประกาศ schema ผ่าน shared OpenAPI decorator ระบบไม่ใช้ global success-response interceptor เพราะ interceptor อัตโนมัติเสี่ยง wrap response ซ้ำและเปลี่ยน contract ของ health, no-content หรือ streaming endpoint โดยไม่ตั้งใจ

## Protected requests

Protected endpoint รับ access token ผ่าน `Authorization: Bearer <token>` เท่านั้น Access token ที่ signature ถูกต้องยังไม่เพียงพอ ระบบต้องโหลด user, session และ effective permissions ปัจจุบันจากฐานข้อมูลทุก request แล้วตรวจว่า user เป็น `ACTIVE`, session ไม่ถูก revoke และยังไม่เกิน idle หรือ absolute expiration

`GET /api/v1/auth/me` เป็น protected endpoint แรก Response ส่งเฉพาะ user ID, display name, active status และ current permission codes โดยไม่ส่ง token, password data, credential hash หรือข้อมูล session ภายใน

Authentication failure ใช้ stable `401` codes ได้แก่ `AUTH_ACCESS_TOKEN_INVALID`, `AUTH_ACCESS_TOKEN_EXPIRED`, `AUTH_SESSION_INVALID` และ `AUTH_SESSION_EXPIRED` พร้อม `WWW-Authenticate: Bearer` ส่วน database หรือ dependency failure ต้องคงเป็น sanitized server error และห้ามถูกแปลงเป็น authentication failure

Permission-protected operation ต้องประกาศ typed permission codes ผ่าน `@RequirePermissions(...)` ซึ่งรวม access-token guard, permission guard และ OpenAPI `401`/`403` contract ไว้ด้วย Permission หลายค่าใน decorator เดียวใช้เงื่อนไข AND คือผู้ใช้ต้องมีครบทุกค่า ระบบตรวจจาก current effective permissions ที่โหลดระหว่าง request นั้น และตอบ `403 AUTH_PERMISSION_DENIED` เมื่อ permission ไม่ครบ ห้ามตรวจ role name โดยตรงใน controller หรือ application service

Permission guard ทำหน้าที่ตรวจ coarse-grained operation permission เท่านั้น ส่วน ownership, assigned location, audit scope หรือ object-level policy ต้องตรวจใน application service ของ module เจ้าของข้อมูล การใช้ permission guard โดยไม่มี required-permission metadata ต้อง fail closed

Typed permission source of truth อยู่ที่ `apps/api/src/modules/iam/domain/permission-code.ts`; seed catalog ต้อง import และ re-export source นี้แทนการประกาศ string ซ้ำ

Implementation foundation อยู่ใน:

- `apps/api/src/shared/http/responses/api-response.types.ts`
- `apps/api/src/shared/http/responses/api-response.factory.ts`
- `apps/api/src/shared/http/openapi/api-response.openapi.ts`

## OpenAPI endpoints

เมื่อ `OPENAPI_ENABLED=true`:

- JSON document: `/api/docs/openapi.json`
- Swagger UI: `/api/docs` เมื่อ `OPENAPI_UI_ENABLED=true`

Production deployment ต้องตัดสินใจเปิด OpenAPI อย่างชัดเจน ห้ามอาศัย development default และไม่ควรเปิด Swagger UI หากไม่ได้ใช้ใน operational workflow

## Decorator conventions

- ทุก controller ต้องกำหนด `@ApiTags()`
- ทุก operation ต้องกำหนด `@ApiOperation()` และ success/error responses ที่เป็นไปได้
- DTO properties ที่อยู่ใน request หรือ response contract ต้องกำหนด `@ApiProperty()` หรือ `@ApiPropertyOptional()`
- Protected operation ต้องอ้าง bearer scheme `access-token` ผ่าน constant กลางใน `openapi.config.ts`
- Refresh operation ต้องอ้าง cookie scheme `refresh-token` และประกาศ `Origin` header
- Error responses ต้องใช้ standard error envelope; ห้ามสร้าง schema เฉพาะ endpoint ที่ไม่ตรงกับ runtime response
- OpenAPI operation IDs generate จาก controller, method และ version อย่าง deterministic

โปรเจกต์ยังไม่เปิดใช้ Swagger CLI plugin ดังนั้น schema metadata ต้องประกาศด้วย decorators อย่างชัดเจน การเพิ่ม plugin ในภายหลังต้องตรวจ generated document diff เพื่อป้องกัน contract เปลี่ยนโดยไม่ตั้งใจ

Health endpoints ที่มีแล้ว:

- `GET /api/v1/health`
- `GET /api/v1/health/ready`

## Authentication endpoints

### `POST /api/v1/auth/login`

Public endpoint สำหรับ email/password authentication:

- normalize email ด้วย trim และ lowercase
- ตอบ `401 AUTH_INVALID_CREDENTIALS` แบบเดียวกันเมื่อ email ไม่มี, password ผิด หรือ account ไม่ active
- สร้าง server-side session, initial refresh token, `last_login_at` และ `LOGIN_SUCCEEDED` activity ใน transaction เดียว
- ส่ง access token กลับใน `{ "data": ... }` envelope
- ส่ง refresh token เฉพาะใน `HttpOnly`, `SameSite=Lax` cookie ที่ path `/api/v1/auth`
- ใช้ `__Secure-am_refresh` เมื่อ secure cookie ถูกเปิด; local HTTP ใช้ `am_refresh`

Request:

```json
{
  "email": "user@example.com",
  "password": "plaintext supplied over HTTPS",
  "device_label": "Chrome on macOS"
}
```

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

Phase 3 ยังไม่รวม Redis login rate limiting; endpoint ยังไม่ควรเปิดสู่ production traffic จนกว่า security control ใน Authentication Phase 7 จะเสร็จและผ่านการตรวจสอบ

### `POST /api/v1/auth/refresh`

หมุน refresh token แบบ one-time-use และออก access token ใหม่ โดย request body ต้องว่างและ client ต้องส่ง:

- refresh token ผ่าน `HttpOnly` cookie ที่ระบบตั้งจาก login หรือ refresh ครั้งก่อน
- `Origin` header ที่ตรงกับ `WEB_ORIGIN` ทุกตัวอักษร

เมื่อสำเร็จ ระบบทำงานใน database transaction เดียว: lock current token และ session, ตรวจ token hash แบบ constant-time, สร้าง successor token, mark token เดิมว่าใช้แล้ว, เชื่อม replacement chain, ขยาย idle expiry โดยไม่เกิน absolute expiry และบันทึก `TOKEN_REFRESHED`

Response:

```json
{
  "data": {
    "access_token": "<new-jwt>",
    "token_type": "Bearer",
    "expires_in": 900
  }
}
```

Response จะตั้ง replacement refresh cookie ด้วย scope และ security attributes เดิม Token ที่ใช้แล้ว, ถูกแทนที่ หรือถูก revoke จะใช้ซ้ำไม่ได้ หาก secret ของ token ดังกล่าวถูกต้อง ระบบถือว่าเป็น reuse incident และ revoke session พร้อม refresh-token family ทั้งหมด ก่อนตอบ `401 AUTH_SESSION_INVALID`

Security/error behavior:

- missing, malformed, unknown หรือ wrong-secret credential ตอบ `401 AUTH_SESSION_INVALID` โดยไม่ revoke session อื่น
- expired idle/absolute window ตอบ `401 AUTH_SESSION_EXPIRED`
- missing หรือ untrusted `Origin` ตอบ `403 FORBIDDEN` ก่อนอ่าน refresh credential
- credential/session error จะ clear refresh cookie
- request พร้อม token เดียวกันที่ชนกันมีได้เพียงหนึ่ง rotation success; attempt อื่นจะเข้า reuse handling

Phase 5 ยังไม่รวม Redis refresh rate limiting ซึ่งอยู่ใน Authentication Phase 7 และยังไม่รวม logout/session-management endpoints ซึ่งอยู่ใน Phase 6

Endpoint catalog และ error model ฉบับ baseline อยู่ใน [MVP Architecture](../02-architecture/mvp-architecture-baseline.md)
