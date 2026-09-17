# ADR-0005: Authentication and Session Strategy

- Status: Accepted
- Date: 2026-09-13

## Context

ระบบ Asset Management ต้องรองรับการยืนยันตัวตน การจัดการ session การเพิกถอนสิทธิ์ และ RBAC สำหรับ Web application และ API

Architecture baseline กำหนดไว้ว่า:

- ผู้ใช้เข้าสู่ระบบด้วย email และ password
- password ต้อง hash ด้วย Argon2id
- access token ต้องมีอายุสั้น
- refresh token ต้องเก็บเป็น hash และ rotate ทุกครั้ง
- เมื่อพบ refresh token reuse ต้อง revoke token family
- ผู้ใช้ที่ถูก disable หรือ session ที่ถูก revoke ต้องใช้งานระบบต่อไม่ได้
- Backend ต้องตรวจ permission และ object scope
- ห้ามบันทึก password, token, cookie หรือ authorization header ลง log

จึงต้องกำหนด token format, session lifecycle, storage และ security controls ก่อนเริ่มสร้าง User และ Authentication modules

## Decision

### Authentication method

ใช้ email และ password เป็น authentication method สำหรับ MVP

- normalize email ด้วยการ trim และแปลงเป็น lowercase ก่อนค้นหา
- อนุญาตให้ login เฉพาะ user ที่มีสถานะ `ACTIVE`
- hash password ด้วย Argon2id
- ใช้ข้อความตอบกลับแบบเดียวกันเมื่อ email ไม่มีอยู่, password ผิด หรือ user ไม่ active เพื่อป้องกัน account enumeration
- ห้ามเก็บหรือ log plaintext password

### Access token

ใช้ JWT ที่ sign ด้วย `HS256` เป็น access token เนื่องจาก MVP เป็น Modular Monolith และมี API service เดียวเป็นผู้ออกและตรวจ token

กำหนดให้:

- ส่งผ่าน `Authorization: Bearer <token>`
- อายุเริ่มต้น 15 นาที
- signing secret ต้องเป็น random secret อย่างน้อย 256 bits และมาจาก secret manager หรือ environment
- verifier ต้องจำกัด algorithm เป็น `HS256` และตรวจ `issuer`, `audience`, signature และ expiration ทุกครั้ง
- ระบุ `sub` เป็น user ID
- ระบุ `sid` เป็น authentication session ID
- ระบุ `jti`, `iat` และ `exp`
- ไม่บรรจุ email, roles, permissions, password hash หรือข้อมูลส่วนบุคคลที่ไม่จำเป็น
- ไม่เก็บ access token ลงฐานข้อมูล

Access token ใช้ยืนยัน user และ session เท่านั้น ส่วน authorization ต้องอ่านสถานะ user, session และ permission ปัจจุบันจากระบบฝั่ง server เพื่อให้การ disable user, revoke session และเปลี่ยน permission มีผลกับ request ถัดไป

หากระบบแยกเป็นหลาย service หรือมีผู้ตรวจ token นอก API service ให้ทบทวนการเปลี่ยนไปใช้ asymmetric signature ใน ADR ใหม่

### Refresh token

ใช้ opaque refresh token รูปแบบ `<token-id>.<secret>` โดย `secret` สร้างจาก cryptographically secure random bytes ที่มี entropy อย่างน้อย 256 bits

- `token-id` ใช้ค้นหา record โดยไม่เก็บ secret
- เก็บเฉพาะ SHA-256 hash ของ secret ในฐานข้อมูล
- เปรียบเทียบ hash ด้วย constant-time comparison
- rotate ทุกครั้งที่ใช้ refresh
- token แต่ละรายการใช้งานสำเร็จได้เพียงครั้งเดียว
- ผูกกับ authentication session และ token family
- ถูก revoke เมื่อ logout, user ถูก disable, session หมดอายุ หรือพบ token reuse
- ห้ามส่ง token ผ่าน URL และห้ามบันทึก token หรือ token hash ลง log

สำหรับ Web application ให้ส่ง refresh token ผ่าน cookie ชื่อ `__Secure-am_refresh` ใน secure environment ซึ่งมีคุณสมบัติ:

- `HttpOnly`
- `Secure` ใน production
- `SameSite=Lax`
- จำกัด `Path=/api/v1/auth`
- กำหนด `Max-Age` ไม่เกิน absolute expiration ของ session

Local development ที่รันผ่าน HTTP ใช้ชื่อ `am_refresh` เพราะ cookie prefix `__Secure-` บังคับให้มี `Secure` attribute ตาม browser contract ชื่อ cookie ต้อถูก resolve จาก typed authentication configuration และห้ามกระจายเงื่อนไขนี้ไปตาม controller

Access token ให้เก็บใน memory ของ frontend และไม่เก็บใน `localStorage` หรือ `sessionStorage`

### Refresh token rotation and reuse detection

เมื่อ refresh token ที่ยัง active ถูกใช้:

1. เริ่ม database transaction
2. lock refresh token และ session ที่เกี่ยวข้อง
3. ตรวจ token hash, expiration, consumption และ revocation state
4. mark token เดิมว่า consumed และอ้างถึง successor token
5. สร้าง refresh token ใหม่ใน token family เดิม
6. ออก access token ใหม่
7. commit transaction ก่อนส่ง token กลับ

หากมีการนำ token ที่ consumed, replaced หรือ revoked แล้วกลับมาใช้:

1. ถือว่าเป็น refresh token reuse
2. revoke refresh token ทั้ง family
3. revoke authentication session
4. บันทึก security event `REFRESH_TOKEN_REUSE_DETECTED`
5. ตอบกลับด้วย `401 AUTH_SESSION_INVALID`

transaction และ row-level locking ต้องทำให้ concurrent refresh ด้วย token เดียวกันสำเร็จได้เพียงหนึ่ง request

### Session lifecycle

เก็บ server-side session ใน `auth_sessions` โดยแต่ละ session ต้องมีอย่างน้อย:

- session ID
- user ID
- created time
- last activity time
- idle expiration time
- absolute expiration time
- revoked time
- revocation reason
- optional client metadata ที่ผ่าน allowlist

กำหนดค่าเริ่มต้น:

- access token lifetime: 15 นาที
- session idle lifetime: 7 วัน
- session absolute lifetime: 30 วัน

การ refresh ที่สำเร็จให้อัปเดต last activity และ idle expiration แต่ห้ามขยาย absolute expiration เกินค่าที่กำหนดตอนสร้าง session

ทุก protected request ต้องตรวจว่า session ยัง active และ user ยังมีสถานะ `ACTIVE` เพื่อให้การ revoke session และ disable user มีผลทันที

### Logout and revocation

`POST /api/v1/auth/logout` ต้อง revoke session ปัจจุบันและ refresh token ที่เกี่ยวข้องทั้งหมด แล้วล้าง refresh-token cookie แม้ token จะหมดอายุหรือไม่ถูกต้องอยู่แล้ว

การเปลี่ยน password, disable user หรือเหตุการณ์ด้านความปลอดภัยที่มีผลต่อ credential ต้อง revoke ทุก active session ของ user

ระบบต้องรองรับการ revoke session รายอุปกรณ์และ revoke ทุก session โดยไม่ต้องรอ access token หมดอายุ

### Authorization

ใช้ permission-based RBAC ที่ backend เป็นผู้บังคับใช้

ทุก protected request ต้องตรวจ:

1. access token ถูกต้องและยังไม่หมดอายุ
2. user ยังมีสถานะ `ACTIVE`
3. session ยัง active และไม่หมดอายุ
4. user มี permission ที่ endpoint ต้องการ
5. user ผ่าน object-scope policy ของ resource นั้น

Role ใช้รวม permission เพื่อการจัดการเท่านั้น Application code ต้องตรวจ permission หรือ object policy โดยไม่ผูก business logic กับชื่อ role โดยตรง

### CSRF and browser security

Endpoint ที่ใช้ refresh-token cookie ต้องตรวจ `Origin` ตาม configured allowlist และปฏิเสธ cross-origin request ที่ไม่อนุญาต

Mutation endpoint อื่นใช้ Bearer access token และไม่ใช้ cookie เป็น authentication credential

CORS ต้องกำหนด explicit allowed origins และเปิด credentials เฉพาะ origin ที่เชื่อถือได้ ห้ามใช้ wildcard origin ร่วมกับ credentials

### Rate limiting

ต้องมี rate limiting อย่างน้อยสำหรับ:

- login แยกตาม IP และ normalized account identifier
- refresh แยกตาม session/token identifier และ IP
- password-related endpoints แยกตาม user และ IP

ค่า limit และ window ต้องปรับผ่าน configuration ได้ โดย response ต้องไม่เปิดเผยว่า account มีอยู่หรือไม่

### Stable error responses

กำหนด error codes อย่างน้อยดังนี้:

- `AUTH_INVALID_CREDENTIALS`
- `AUTH_ACCESS_TOKEN_INVALID`
- `AUTH_ACCESS_TOKEN_EXPIRED`
- `AUTH_SESSION_INVALID`
- `AUTH_SESSION_EXPIRED`
- `AUTH_PERMISSION_DENIED`
- `AUTH_RATE_LIMITED`

HTTP response ห้ามส่ง raw token verification error, database error หรือข้อมูลที่ใช้ตรวจสอบการมีอยู่ของ account

### Logging and audit events

ห้าม log:

- plaintext password
- password hash
- access token
- refresh token
- refresh-token hash
- authorization header
- cookie header

บันทึก security และ activity events อย่างน้อย:

- `LOGIN_SUCCEEDED`
- `LOGIN_FAILED`
- `TOKEN_REFRESHED`
- `REFRESH_TOKEN_REUSE_DETECTED`
- `SESSION_REVOKED`
- `LOGOUT_SUCCEEDED`
- `AUTHORIZATION_DENIED`

Events ต้องมี request ID, actor ID เมื่อมี, session ID เมื่อมี และเหตุผลแบบ allowlist ห้ามใช้ raw credential หรือ raw request payload เป็น metadata

## Consequences

### Positive

- สามารถ revoke session และ permission ได้ทันที
- refresh token ที่ถูกขโมยมีโอกาสถูกตรวจพบเมื่อเกิด reuse
- token และ credential ไม่ถูกเก็บเป็น plaintext
- permission changes มีผลโดยไม่ต้องรอ access token หมดอายุ
- รองรับการตรวจสอบเหตุการณ์ด้านความปลอดภัย

### Negative

- Protected requests ต้องตรวจ server-side session และ authorization state
- Refresh rotation ต้องใช้ transaction และ row-level locking
- ต้องดูแล cookie, CORS และ origin policy ให้สอดคล้องกัน
- ต้องมีการ cleanup expired sessions และ refresh tokens
- การรองรับ native client ในอนาคตต้องกำหนด secure token storage เพิ่มเติม

## Alternatives Considered

### Stateless JWT with roles and permissions in claims

ลด database lookup ต่อ request แต่ permission และ session revocation จะไม่มีผลทันทีจนกว่า token หมดอายุ และ claims อาจมีขนาดใหญ่หรือ stale

### Long-lived access token without refresh token

สร้างง่ายกว่า แต่เพิ่มผลกระทบเมื่อ token รั่วไหลและไม่รองรับ session lifecycle ที่กำหนดไว้

### Store refresh token as plaintext

ค้นหาและตรวจสอบง่ายกว่า แต่ database compromise จะทำให้ token ถูกนำไปใช้ได้ทันที จึงไม่เลือกแนวทางนี้

### Server session cookie for every request

รองรับ revocation ได้ง่าย แต่ไม่เหมาะกับ API clients และเพิ่มภาระ CSRF protection ให้ทุก authenticated mutation

## Security and Operational Guardrails

- secret ต้องมาจาก environment หรือ secret manager
- production ต้องไม่ใช้ default signing secret
- signing-secret rotation ต้องรองรับ current และ previous key ในช่วงเปลี่ยนผ่านโดยระบุ key version อย่างชัดเจน
- refresh rotation ต้องทำใน transaction
- expired และ revoked token records ต้องมี retention และ cleanup policy
- authentication endpoints ต้องมี integration และ security tests
- logs และ error responses ต้องผ่าน redaction policy
- production ต้องใช้ HTTPS

## Required Verification

ก่อนถือว่า implementation เสร็จ ต้องทดสอบอย่างน้อย:

- active user login สำเร็จ
- invalid credential และ inactive user ได้ generic response เดียวกัน
- expired access token ถูกปฏิเสธ
- revoked session ถูกปฏิเสธ
- refresh rotation สำเร็จ
- refresh token เดิมใช้ซ้ำไม่ได้
- token reuse ทำให้ session และ token family ถูก revoke
- concurrent refresh สำเร็จได้เพียงหนึ่ง request
- logout ทำให้ session ใช้งานต่อไม่ได้
- permission change มีผลกับ request ถัดไป
- user ไม่สามารถยกระดับสิทธิ์ของตนเอง
- token, password และ cookie ไม่ปรากฏใน log
- login และ refresh rate limiting ทำงานตาม policy

## References

- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
- [OWASP Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
- [OWASP OAuth 2.0 Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/OAuth2_Cheat_Sheet.html)
- [RFC 7519: JSON Web Token](https://www.rfc-editor.org/rfc/rfc7519)
- [RFC 8725: JWT Best Current Practices](https://www.rfc-editor.org/rfc/rfc8725)
