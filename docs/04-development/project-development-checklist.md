# Asset Management — Project Development Checklist

เอกสารนี้เป็น source of truth สำหรับติดตามสถานะการพัฒนาและประวัติงานที่เสร็จแล้ว โดยใช้ร่วมกับ Git history, requirements, architecture baseline และ ADRs

- อัปเดตล่าสุด: 2026-09-16
- เขตเวลา: Asia/Bangkok
- ขอบเขตปัจจุบัน: MVP

## วิธีใช้เอกสารนี้

- `[x]` หมายถึงมี implementation หรือเอกสารรองรับและเคยตรวจสอบแล้ว
- `[ ]` หมายถึงยังไม่เสร็จ ห้ามตีความว่าเริ่มทำแล้ว
- งานที่กำลังทำให้เติมคำว่า **In progress** และระบุผู้รับผิดชอบหรือ Task ที่เกี่ยวข้อง
- งานที่ติดปัญหาให้เติมคำว่า **Blocked** พร้อมสาเหตุและเงื่อนไขสำหรับปลด blocker
- ห้ามลบรายการใน Completed Work Log ให้เพิ่มรายการใหม่ตามลำดับเวลา
- ก่อนทำเครื่องหมาย `[x]` ต้องบันทึกหลักฐาน เช่น test, typecheck, build, migration หรือการตรวจ endpoint ตามความเหมาะสม
- ห้ามบันทึก credentials, connection strings, tokens หรือ secrets ลงในเอกสารนี้

## Current Focus

### Authentication Phase 4 — Protected Requests

สถานะ: Authentication Phase 1–3 และ OpenAPI foundation เสร็จและตรวจสอบแล้ว; ขั้นถัดไปเริ่ม protected requests

- [x] Merge Initial Database Schema เข้าสู่ `main`
- [x] เพิ่ม Authentication configuration และ cryptography foundation
- [x] เพิ่ม injectable clock สำหรับ token issuance และ verification
- [x] Map IAM และ authentication TypeORM entities กับ initial schema
- [x] เพิ่ม IAM authentication/authorization query repository
- [x] กำหนด typed permission และ system-role catalog
- [x] เพิ่ม transactional, idempotent permission/role seed
- [x] ตรวจ repeated seed, custom-role preservation และ reserved-code collision
- [x] ตรวจ permission-version increment เมื่อ effective grants เปลี่ยน
- [x] API tests, typecheck และ production build ผ่าน
- [x] เพิ่ม OpenAPI/Swagger foundation
- [x] Authentication Phase 3 — Login
- [ ] Authentication Phase 4 — Protected requests และ permission guards

## Milestone Checklist

### 1. Product Requirements และ Architecture

- [x] จัดทำ Software Requirement Specification สำหรับ MVP
- [x] จัดทำ MVP Architecture Baseline
- [x] กำหนดโครงสร้าง monorepo
- [x] บันทึก ADR สำหรับ pnpm และ Turborepo
- [x] บันทึก ADR สำหรับ Modular Monolith
- [x] บันทึก ADR สำหรับ infrastructure baseline
- [ ] Review requirements และ architecture ก่อนเริ่มแต่ละ domain module
- [x] จัดทำ ADR สำหรับ authentication และ session strategy
- [x] จัดทำ ADR สำหรับ structured logging หากเลือก external logging framework
- [ ] จัดทำ threat model ก่อนเปิดใช้งาน production

### 2. Repository และ Developer Experience

- [x] สร้าง pnpm workspace และ Turborepo
- [x] สร้าง NestJS API application
- [x] สร้าง React/Vite web application
- [x] สร้าง shared `types` และ `ui` packages
- [x] เพิ่ม Dockerfiles สำหรับ API และ Web
- [x] เพิ่ม `.env.example`
- [x] จัดทำ local development guide
- [ ] เพิ่ม automated formatting check
- [ ] เพิ่ม lint rules ที่มากกว่า TypeScript typecheck
- [x] เพิ่ม CI pipeline สำหรับ install, lint, typecheck, test และ build
- [ ] เพิ่ม dependency/security scanning

### 3. Local Infrastructure

- [x] เพิ่ม PostgreSQL service ใน Docker Compose สำหรับ local development
- [x] เพิ่ม Redis service พร้อม persistence และ authentication ใน Docker Compose
- [x] เพิ่ม SeaweedFS Master, Volume, Filer และ S3 gateway
- [x] เพิ่ม persistent volumes และ Docker network
- [x] เชื่อม API กับ PostgreSQL ผ่าน environment configuration
- [x] เชื่อม API กับ Redis ใน Docker
- [x] เชื่อม API กับ SeaweedFS ผ่าน S3-compatible API
- [x] เพิ่ม `/api/v1/health`
- [x] เพิ่ม `/api/v1/health/ready` สำหรับ PostgreSQL, Redis และ SeaweedFS
- [x] ตรวจ readiness และยืนยันทุก service เป็น `up` อย่างน้อยหนึ่งครั้ง
- [ ] เพิ่ม startup/readiness dependency policy สำหรับ production deployment
- [ ] เพิ่ม backup และ restore procedure สำหรับ PostgreSQL และ SeaweedFS
- [ ] เพิ่ม infrastructure monitoring และ alerting

> Readiness เป็นสถานะ runtime ที่เปลี่ยนได้ เครื่องหมายด้านบนยืนยันว่า feature เคยผ่านการตรวจ ไม่ได้ยืนยันว่า service กำลังทำงานอยู่ในขณะอ่านเอกสาร

### 4. Backend Foundation

- [x] เพิ่ม typed environment validation ตอน Backend startup
- [x] รองรับ graceful shutdown hooks
- [x] เพิ่ม `X-Request-ID` middleware
- [x] รับ request ID ที่ถูกต้องจาก client หรือสร้าง UUID ใหม่
- [x] ส่ง `X-Request-ID` กลับใน response และเปิดผ่าน CORS
- [x] เพิ่ม `AppError` สำหรับ domain/application errors
- [x] เพิ่ม centralized stable error-code และ message catalog
- [x] เพิ่ม Global Exception Filter
- [x] เพิ่ม Standard Error Envelope
- [x] เพิ่ม Global Validation Pipe
- [x] แปลง DTO validation errors เป็น field errors
- [x] ป้องกัน stack trace, SQL/query details และ secrets รั่วใน error response
- [x] แปลง unknown exceptions เป็น `500 INTERNAL_ERROR`
- [x] ใส่ `request_id` ในทุก error response
- [x] เพิ่ม tests สำหรับ `400`, `404`, `409` และ `500`
- [x] เพิ่ม structured logging และ request observability
- [x] เพิ่ม OpenAPI/Swagger generation
- [ ] กำหนด API versioning และ deprecation policy
- [ ] เพิ่ม rate limiting
- [ ] เพิ่ม idempotency middleware/guard สำหรับ mutation ที่ retry ได้

### 5. Database และ Persistence

- [x] เพิ่ม TypeORM และ PostgreSQL connection configuration
- [x] เพิ่ม TypeORM CLI configuration
- [x] เพิ่ม migration scripts
- [ ] สร้าง shared persistence conventions และ base types ที่จำเป็น
- [x] สร้าง initial schema migration ตาม architecture baseline
- [x] ตั้งชื่อ constraints และ indexes ที่ต้อง map เป็น domain errors
- [x] เพิ่ม migration integration tests
- [ ] เพิ่ม seed strategy สำหรับ development และ test (permission/role catalog seed เสร็จแล้ว; bootstrap และ domain fixture strategy ยังไม่ครบ)
- [ ] เพิ่ม transaction-boundary conventions
- [ ] เพิ่ม optimistic/pessimistic concurrency strategy ตาม use case
- [x] ทดสอบ migration run และ rollback บน Neon development branch

### 6. Authentication และ Authorization

- [x] สรุป authentication/session requirements
- [ ] Implement user identity และ credential storage
- [ ] Implement login, refresh, logout และ session revocation
- [ ] ป้องกัน account enumeration และ token reuse
- [ ] Implement RBAC permissions
- [ ] Implement object-scope authorization
- [ ] เพิ่ม authentication และ authorization guards
- [ ] เพิ่ม rate limiting สำหรับ authentication endpoints
- [ ] เพิ่ม security tests สำหรับ `401`, `403`, expired/reused token และ privilege escalation
- [ ] เพิ่ม audit events สำหรับ security-sensitive actions

### 7. Domain Modules

- [ ] User Management
- [ ] Category Management
- [ ] Location Management
- [ ] Asset Management
- [ ] Asset Identifier Management
- [ ] Assignment และ Return
- [ ] Asset Transfer
- [ ] Asset Status/Lifecycle
- [ ] Audit Campaign
- [ ] Audit Scan และ Reconciliation
- [ ] Attachment/File Management ผ่าน SeaweedFS
- [ ] Audit Log และ Activity History
- [ ] Reporting และ Export ตามขอบเขต MVP

แต่ละ module ต้องผ่าน checklist ต่อไปนี้ก่อนถือว่าเสร็จ:

- [ ] Business rules ตรงกับ SRS และ Architecture Baseline
- [ ] Module boundary และ dependency direction ถูกต้อง
- [ ] DTO validation และ authorization ครบ
- [ ] Transaction, concurrency และ idempotency ได้รับการพิจารณา
- [ ] Stable domain error codes และ HTTP mapping ครบ
- [ ] Database constraints/indexes สนับสนุน data integrity
- [ ] Unit และ integration tests ครอบคลุม failure modes
- [ ] API documentation และ checklist ได้รับการอัปเดต

### 8. Frontend Foundation

- [x] สร้าง React 19 และ Vite application
- [x] เพิ่ม Tailwind CSS และ shadcn/ui configuration
- [x] เชื่อม shared UI และ types packages
- [ ] สร้าง typed API client
- [ ] รองรับ Standard Error Envelope และ field errors
- [ ] แสดงหรือบันทึก `request_id` สำหรับ support/debugging
- [ ] เพิ่ม authentication state และ protected routes
- [ ] สร้าง application shell, navigation และ responsive layout
- [ ] เพิ่ม loading, empty, error และ retry states
- [ ] กำหนด accessibility baseline
- [ ] เพิ่ม component และ integration tests

### 9. Quality, Security และ Observability

- [x] ตั้งค่า Jest สำหรับ Backend
- [x] เพิ่ม unit tests สำหรับ Request ID middleware
- [x] เพิ่ม unit tests สำหรับ error-detail sanitization
- [x] เพิ่ม integration tests สำหรับ Global Exception Filter
- [x] เพิ่ม GitHub Actions CI พร้อม frozen lockfile, pnpm cache และ read-only permissions
- [x] ทดสอบว่า CI ปฏิเสธ TypeScript error และกลับมาผ่านหลังแก้ไข
- [ ] กำหนด test pyramid และ coverage expectations
- [ ] เพิ่ม API end-to-end test environment
- [x] เพิ่ม structured application logs
- [ ] เพิ่ม metrics และ dashboards
- [ ] เพิ่ม distributed tracing เมื่อมี service boundary ที่ต้องติดตาม
- [ ] เพิ่ม audit-log integrity controls
- [ ] เพิ่ม security headers และ CORS production policy
- [ ] เพิ่ม secrets-management policy
- [ ] เพิ่ม load/performance tests สำหรับ critical flows

### 10. Deployment และ Operations

- [ ] กำหนด environments: development, test, staging และ production
- [ ] สร้าง CI/CD pipeline
- [ ] กำหนด deployment strategy และ rollback procedure
- [ ] กำหนด migration execution และ rollback procedure
- [ ] ตั้งค่า production PostgreSQL, Redis และ SeaweedFS
- [ ] ตั้งค่า TLS, DNS และ reverse proxy/load balancer
- [ ] ตั้งค่า centralized logs, metrics และ alerts
- [ ] ทดสอบ backup/restore และ disaster recovery
- [ ] จัดทำ runbooks สำหรับ incident ที่สำคัญ
- [ ] ทำ production-readiness review

## Verification Baseline

หลักฐานล่าสุดที่บันทึกไว้ ณ 2026-09-07:

| Area                           | Verification                                        | Result                                          |
| ------------------------------ | --------------------------------------------------- | ----------------------------------------------- |
| Backend error handling         | Jest unit/integration tests                         | 3 suites, 10 tests passed                       |
| Backend types                  | `pnpm --filter @asset-management/api run typecheck` | Passed                                          |
| Backend production compilation | `pnpm --filter @asset-management/api run build`     | Passed                                          |
| Infrastructure readiness       | `GET /api/v1/health/ready`                          | PostgreSQL, Redis และ SeaweedFS เคยตอบ `up` ครบ |
| Monorepo quality gate          | GitHub Actions CI run `34092917110`                 | Passed                                          |
| CI failure gate                | GitHub Actions CI run `34093165960`                 | TypeScript error ถูกปฏิเสธตามที่ออกแบบ          |
| CI recovery                    | GitHub Actions CI run `34093467856`                 | Passed หลังนำ failure probe ออก                 |

เมื่อมีการเปลี่ยนแปลงที่เกี่ยวข้อง ให้เพิ่ม verification record ใหม่ใน Completed Work Log แทนการแก้ผลเก่าให้ดูเหมือนเป็นผลล่าสุด

## Completed Work Log

### 2026-09-06 — Local Infrastructure และ Readiness

สถานะ: เสร็จและเคยตรวจสอบแล้ว

สิ่งที่ทำ:

- เตรียม Docker Compose สำหรับ PostgreSQL, Redis และ SeaweedFS
- กำหนด persistent volumes และ local network
- เชื่อม Backend กับ PostgreSQL, Redis และ SeaweedFS ผ่าน environment configuration
- เพิ่ม health และ readiness endpoints
- ตรวจ readiness จน PostgreSQL, Redis และ SeaweedFS ตอบ `up`

หมายเหตุ:

- Backend ใช้ PostgreSQL connection จาก environment; ห้ามคัดลอก connection string ลงเอกสาร
- Redis สำหรับ local development ทำงานผ่าน Docker
- Object storage ใช้ SeaweedFS S3 gateway

### 2026-09-06 — Environment Startup Validation

สถานะ: เสร็จและตรวจสอบแล้ว

สิ่งที่ทำ:

- เพิ่ม Zod environment schema
- ตรวจ port, URLs, PostgreSQL, Redis และ S3 configuration ตอน startup
- ป้องกัน development placeholder secrets ใน production
- เชื่อม validation ผ่าน `ConfigModule.forRoot({ validate })`

### 2026-09-06 — HTTP Request Correlation

สถานะ: เสร็จและตรวจสอบแล้ว

สิ่งที่ทำ:

- เพิ่ม middleware สำหรับรับหรือสร้าง `X-Request-ID`
- ตรวจรูปแบบ UUID ของ request ID จาก client
- ส่ง request ID กลับผ่าน response header
- เปิด `X-Request-ID` ผ่าน CORS
- เพิ่ม unit tests สำหรับ middleware

### 2026-09-06 — Global Exception Handling

สถานะ: เสร็จและตรวจสอบแล้ว

สิ่งที่ทำ:

- เพิ่ม `AppError`, stable error-code catalog และ user-safe message catalog
- เพิ่ม Global Exception Filter และ Standard Error Envelope
- เพิ่ม DTO Validation Pipe และ field-error mapping
- เพิ่ม error-detail sanitization
- ป้องกัน unknown errors, SQL details, stack traces และ secrets รั่วออกทาง response
- เพิ่ม `request_id` ใน error response และ response header
- เพิ่ม unit/integration tests สำหรับ `400`, `404`, `409` และ `500`

ผลการตรวจสอบ:

- Jest: 3 suites, 10 tests passed
- TypeScript typecheck: passed
- NestJS production build: passed

ไฟล์สำคัญ:

- `apps/api/src/shared/errors/`
- `apps/api/src/shared/http/errors/`
- `apps/api/src/shared/http/validation/`
- `apps/api/src/shared/http/request-id/`

### 2026-09-07 — GitHub Actions Continuous Integration

สถานะ: เสร็จและตรวจสอบแล้ว

เป้าหมายและขอบเขต:

- ตรวจ monorepo อัตโนมัติเมื่อเปิด Pull Request เข้า `main`, push เข้า `main` หรือสั่งรันด้วยตนเอง
- งานนี้เป็น Continuous Integration เท่านั้น ไม่รวม deployment หรือ production secrets

สิ่งที่ทำ:

- เพิ่ม workflow `.github/workflows/ci.yml`
- ใช้ Node.js 22 และ pnpm version จาก root `packageManager`
- เปิด pnpm-store cache โดยใช้ `pnpm-lock.yaml` เป็น dependency source of truth
- ติดตั้ง dependencies ด้วย frozen lockfile
- รัน lint, typecheck, tests และ production build ทั้ง monorepo
- เพิ่ม concurrency cancellation และ job timeout
- กำหนด `GITHUB_TOKEN` เป็น `contents: read`
- ปิด checkout credential persistence
- Pin external actions ด้วย full commit SHA พร้อมกำกับ release version

ผลการตรวจสอบ:

- Local lint: 4 packages passed
- Local typecheck: 4 packages passed
- Local tests: Backend 3 suites/10 tests passed; Web ยังไม่มี test files
- Local production build: API และ Web passed
- GitHub CI success run: `34092917110`
- GitHub CI intentional-failure run: `34093165960`
- GitHub CI recovery run: `34093467856`
- Failure probe ถูกลบแล้วและไม่อยู่ใน final diff

ไฟล์สำคัญ:

- `.github/workflows/ci.yml`
- `docs/04-development/project-development-checklist.md`

สิ่งที่ยังไม่ครอบคลุมและความเสี่ยงคงเหลือ:

- Frontend ยังไม่มี test files และใช้ `--passWithNoTests`
- CI ยังไม่มี database/infrastructure integration tests
- Continuous Deployment ยังไม่อยู่ในขอบเขต

### 2026-09-13 — Structured Logging และ HTTP Request Observability

สถานะ: เสร็จและตรวจสอบแล้ว

เป้าหมายและขอบเขต:

- เพิ่ม structured operational logging สำหรับ NestJS API ผ่าน Pino และ stdout
- ทำ HTTP request correlation ด้วย `request_id` โดยไม่เปลี่ยน Standard Error Envelope
- ไม่รวม centralized log platform, distributed tracing, metrics หรือ business audit log

สิ่งที่ทำ:

- เพิ่ม environment-aware logging configuration สำหรับ development, test และ production
- เพิ่ม JSON schema ที่ใช้ `timestamp`, `message`, stable event names และ snake_case HTTP fields
- เพิ่ม HTTP terminal log หนึ่งรายการต่อ request พร้อม normalized route, status และ duration
- ใช้ Request ID เดียวกันใน response header, error envelope และ log
- ย้าย HTTP error-log ownership ออกจาก Global Exception Filter เพื่อตัด duplicate logs
- เพิ่ม allowlisted serializers, centralized redaction และ secret-canary integration tests
- suppress successful health/readiness logs โดยค่าเริ่มต้น และคง failed readiness logs ระดับ `error`
- เพิ่ม `application_started` และ `application_stopping` พร้อม flush asynchronous pretty transport ตอน shutdown
- ปิด TypeORM raw query logging เพื่อไม่ให้ SQL ข้าม structured logging policy

Architecture/technical decisions:

- ใช้ Pino ผ่าน `nestjs-pino`; production เป็น single-line JSON และ development ใช้ `pino-pretty`
- ส่ง operational logs ไป stdout เท่านั้น และไม่บันทึก request/response body
- HTTP logger เป็นเจ้าของ terminal request log ส่วน Global Exception Filter ทำ response mapping และส่ง safe error metadata
- Operational logs และ business audit logs ยังคงเป็นคนละ concern

ผลการตรวจสอบ:

- Formatter/Diff check: passed
- Monorepo lint: 4 packages passed
- Monorepo typecheck: 4 packages passed
- API tests: 9 suites, 48 tests passed
- Integration tests: HTTP `2xx`, `400`, `404`, `409`, `500`, request ID correlation, redaction, health suppression และ duplicate-log checks passed
- Production build: API และ Web passed
- Runtime verification: JSON terminal log, request ID correlation, lifecycle start/stop logs และการปิด raw SQL logs ผ่าน
- Local runtime: Node.js 25.9.0
- GitHub Actions CI: ผ่านบน Node.js 22 ก่อน merge

ไฟล์หรือเอกสารสำคัญ:

- `apps/api/src/config/logging.config.ts`
- `apps/api/src/shared/logging/`
- `apps/api/src/shared/http/errors/global-exception.filter.ts`
- `docs/03-decisions/0004-structured-logging.md`
- `docs/04-development/structured-logging-implementation-plan.md`
- `docs/04-guides/local-development.md`

สิ่งที่ยังไม่ครอบคลุมและความเสี่ยงคงเหลือ:

- Centralized log collection, retention, access control, metrics, tracing และ alerting อยู่นอกขอบเขต
- Business audit-log persistence ต้องออกแบบแยกจาก operational logs

งานถัดไป:

- Merge Initial Database Schema และ ADR-0005
- เพิ่ม OpenAPI ก่อนเริ่ม domain endpoints

### 2026-09-14 — Initial Database Schema และ Neon Integration

สถานะ: เสร็จและตรวจสอบแล้ว

เป้าหมายและขอบเขต:

- สร้าง PostgreSQL schema เริ่มต้นสำหรับ MVP ตาม Architecture Baseline
- ใช้ Neon pooled connection สำหรับ API runtime และ direct connection สำหรับ migration
- ไม่รวม TypeORM entities, seed data หรือ domain repositories

สิ่งที่ทำ:

- สร้าง reversible TypeORM migration ครบ 24 application tables
- เพิ่ม `citext`, `btree_gist`, named constraints, foreign keys, partial indexes และ query indexes
- บังคับ refresh-token chain, assignment interval, scan idempotency และ cross-campaign integrity
- เพิ่ม environment validation สำหรับ Neon URL, TLS และ channel binding
- แยก pooled runtime URL กับ direct migration URL
- เพิ่ม isolated-schema integration test ซึ่งไม่แตะ application tables ใน `public`
- เพิ่ม retry สำหรับ Neon compute startup และแก้ connection cleanup ของ test suite

ผลการตรวจสอบ:

- Migration run: passed
- Migration down/revert: passed
- Migration rerun: passed
- Critical database constraint integration tests: 6/6 passed
- API test suite: passed
- API typecheck: passed
- API production build: passed

ไฟล์สำคัญ:

- `apps/api/src/database/migrations/1789236000000-CreateInitialSchema.ts`
- `apps/api/src/database/migrations/initial-schema.integration.spec.ts`
- `apps/api/src/config/database.config.ts`
- `apps/api/src/config/typeorm-cli.config.ts`
- `apps/api/src/config/environment.schema.ts`
- `docs/04-development/initial-database-schema-implementation-plan.md`

สิ่งที่ยังไม่ครอบคลุมและความเสี่ยงคงเหลือ:

- TypeORM entities และ repositories จะสร้างตาม vertical slice
- Permission/role seed catalog ยังไม่ได้กำหนด
- Database integration test ยังไม่ได้เพิ่มใน GitHub Actions CI
- ต้อง rotate Neon credential ที่เคยถูกส่งผ่าน conversation ก่อนใช้งาน production

งานถัดไป:

- Merge branch ปัจจุบันและตรวจ GitHub Actions CI
- เพิ่ม OpenAPI foundation
- จัดทำ Authentication Implementation Plan และ permission seed catalog

### 2026-09-14 — Authentication Implementation Plan

สถานะ: เสร็จ

สิ่งที่ทำ:

- กำหนดขอบเขต Authentication, server-side session และ permission-based authorization
- กำหนด API contract สำหรับ login, refresh, logout, current user และ session revocation
- กำหนด refresh-token rotation, reuse detection, cookie, Origin และ rate-limit controls
- แบ่ง implementation เป็น 8 phases พร้อม verification matrix และ definition of done

ไฟล์สำคัญ:

- `docs/04-development/authentication-implementation-plan.md`

งานถัดไป:

- กำหนด permission/role seed catalog
- เริ่ม Authentication Phase 1: configuration และ cryptography foundation

### 2026-09-16 — Authentication Foundation Phases 1–2

สถานะ: เสร็จและตรวจสอบแล้ว

เป้าหมายและขอบเขต:

- สร้าง configuration, cryptography, IAM persistence และ permission/role seed foundation ตาม ADR-0005
- ยังไม่รวม Login, protected-request guards, refresh rotation, logout หรือ session-management endpoints

สิ่งที่ทำ:

- เพิ่มและตรวจ environment configuration สำหรับ JWT, session TTL, rate limits และ refresh cookie
- เพิ่ม password hasher, JWT access-token service, opaque refresh-token service และ injectable clock
- Map IAM และ authentication tables เป็น TypeORM entities
- เพิ่ม query repository สำหรับ credential lookup และ current effective permissions
- สร้าง typed permission/system-role catalog จากเอกสารที่อนุมัติ
- เพิ่ม explicit seed command ที่ reconcile permissions, system roles และ grants ใน transaction เดียว
- ป้องกัน reserved system-role code collision และรักษา custom roles กับ user-role assignments
- เพิ่ม `users.permission_version` เมื่อ seed เปลี่ยน effective grants ของ role ที่มีผู้ใช้งาน

Architecture/technical decisions:

- Seed ไม่รันอัตโนมัติระหว่าง API startup
- ใช้ transaction-scoped PostgreSQL advisory lock เพื่อ serialize catalog reconciliation
- Permission rows ที่ออกจาก catalog ไม่ถูกลบอัตโนมัติ เพราะ custom roles อาจยังอ้างอิงอยู่
- JWT issuance และ verification ใช้ clock port เดียวกันเพื่อให้ expiry behavior ทดสอบแบบ deterministic

ผลการตรวจสอบ:

- Formatter: Prettier ผ่านสำหรับไฟล์ที่เพิ่มหรือแก้ใน task นี้
- Typecheck: `pnpm --filter @asset-management/api typecheck` ผ่าน
- Typecheck, unit tests, seed tests, full test suite, production build และ `git diff --check` ผ่านหลัง bulk-seed optimization
- Bulk seed integration suite บน Neon ใช้เวลาประมาณ 40 วินาที ลดจาก implementation แบบ per-row query ที่ใช้เวลาประมาณ 194 วินาที
- Build: `pnpm --filter @asset-management/api build` ผ่าน
- Seed behavior: clean seed, repeated seed, rollback, custom-role preservation, grant removal และ permission-version increment ผ่าน

ไฟล์หรือเอกสารสำคัญ:

- `apps/api/src/database/seeds/permission-role.catalog.ts`
- `apps/api/src/database/seeds/seed-permissions-and-roles.ts`
- `apps/api/src/modules/auth/infrastructure/crypto/jwt-access-token.service.ts`
- `apps/api/src/modules/iam/infrastructure/typeorm/iam-auth-query.repository.ts`
- `docs/04-development/permission-role-seed-catalog.md`

สิ่งที่ยังไม่ครอบคลุมและความเสี่ยงคงเหลือ:

- ยังไม่มี bootstrap administrator command
- Authentication endpoints, session transaction services, guards และ rate limiting ยังไม่ implement
- Integration tests ต้องใช้ `DATABASE_URL_UNPOOLED` ที่ชี้ direct development database endpoint
- ใช้ `test:unit` สำหรับ fast feedback, `test:db` สำหรับ database integration และ `test:all` ก่อน merge

งานถัดไป:

- เพิ่ม OpenAPI foundation
- เริ่ม Authentication Phase 3 — Login

### 2026-09-16 — OpenAPI/Swagger Foundation

สถานะ: เสร็จและตรวจสอบแล้ว

สิ่งที่ทำ:

- เพิ่ม NestJS OpenAPI document generation และ Swagger UI แบบเปิดใช้ผ่าน typed environment configuration
- แยก OpenAPI JSON endpoint ออกจาก Swagger UI เพื่อให้ production deployment ปิด UI ได้อิสระ
- รวม global API prefix, OpenAPI routes และ bearer security scheme ไว้ใน typed constants
- เพิ่ม explicit OpenAPI decorators และ response DTOs ให้ Health endpoints
- เพิ่ม unit/integration tests และ `test:openapi` script
- บันทึก endpoint, decorator และ deployment conventions ใน API documentation

ผลการตรวจสอบ:

- Typecheck: `pnpm --filter @asset-management/api typecheck` ผ่าน
- OpenAPI tests: `pnpm --filter @asset-management/api test:openapi` ผ่าน
- Full API test suite: `pnpm --filter @asset-management/api test:all` ผ่าน
- Production build: `pnpm --filter @asset-management/api build` ผ่าน
- Diff validation: `git diff --check` ผ่าน
- Runtime verification: Swagger UI ที่ `/api/docs` และ OpenAPI JSON ที่ `/api/docs/openapi.json` เปิดใช้งานได้

ไฟล์หรือเอกสารสำคัญ:

- `apps/api/src/config/openapi.config.ts`
- `apps/api/src/shared/http/api-route.constants.ts`
- `apps/api/src/shared/http/openapi/error-response.openapi.ts`
- `apps/api/src/modules/health/health.openapi.ts`
- `docs/05-api/README.md`

สิ่งที่ยังไม่ครอบคลุมและความเสี่ยงคงเหลือ:

- ต้องกำหนด production exposure policy ก่อนเปิด OpenAPI JSON หรือ Swagger UI ใน production
- Authentication endpoints ต้องเพิ่ม request/response DTO metadata, bearer decorators และ standard error responses เมื่อ implement

งานถัดไป:

- เริ่ม Authentication Phase 3 — Login

### 2026-09-17 — Authentication Phase 3 — Login

สถานะ: เสร็จและตรวจสอบแล้ว

เป้าหมายและขอบเขต:

- เพิ่ม `POST /api/v1/auth/login` สำหรับ email/password authentication
- ครอบคลุม credential verification, initial session, refresh cookie, access token และ login activity events
- ยังไม่รวม access-token guard, `/auth/me`, refresh rotation, logout และ Redis rate limiting

สิ่งที่ทำ:

- Normalize email และใช้ generic `AUTH_INVALID_CREDENTIALS` สำหรับ unknown email, incorrect password และ non-active account
- ทำ Argon2 dummy work เมื่อไม่พบ account เพื่อลด timing-based account enumeration
- สร้าง session, initial hashed refresh token, `last_login_at` และ `LOGIN_SUCCEEDED` activity ใน database transaction เดียว
- ตรวจ user status ซ้ำภายใน transaction เพื่อป้องกัน concurrent disable/login race
- ออก short-lived JWT access token และ HttpOnly, SameSite=Lax refresh cookie
- แยก cookie name เป็น `__Secure-am_refresh` ใน secure environment และ `am_refresh` สำหรับ local HTTP
- เพิ่ม request/response DTO validation, OpenAPI metadata และ standard error mapping
- เพิ่ม `test:auth` สำหรับ targeted authentication verification

Architecture/technical decisions:

- Auth application layer ใช้ IAM query port และไม่ query IAM entities จาก controller หรือ domain code
- Login failure events เป็น anonymous actor; target user ID ถูกเก็บเฉพาะเมื่อ resolve ได้ และไม่เก็บ email/password
- IP มาจาก Express trusted connection metadata; ยังไม่เชื่อ forwarded headers จนกว่าจะกำหนด trusted-proxy policy
- ไม่มี schema migration ใหม่เพราะใช้ `users`, `auth_sessions`, `auth_refresh_tokens` และ `activity_logs` จาก initial schema

ผลการตรวจสอบ:

- Formatter: Prettier ผ่านสำหรับไฟล์ใน task
- Typecheck: `pnpm --filter @asset-management/api typecheck` ผ่าน
- Authentication tests: `pnpm --filter @asset-management/api test:auth` ผ่าน
- Full API test suite: `pnpm --filter @asset-management/api test:all` ผ่าน
- Production build: `pnpm --filter @asset-management/api build` ผ่าน
- Diff validation: `git diff --check` ผ่าน
- Database integration: session, refresh token, user update และ success activity เกิดแบบ atomic; failure rollback ผ่าน
- Security behavior: active login, unknown identity, incorrect password, inactive/suspended user, concurrent account-state change และ sanitized failure activity ผ่าน

ไฟล์หรือเอกสารสำคัญ:

- `apps/api/src/modules/auth/application/services/login.service.ts`
- `apps/api/src/modules/auth/infrastructure/typeorm/auth-session.repository.ts`
- `apps/api/src/modules/auth/presentation/auth.controller.ts`
- `apps/api/src/modules/auth/presentation/auth-cookie.service.ts`
- `apps/api/src/modules/auth/presentation/dto/login.request.ts`
- `docs/05-api/README.md`

สิ่งที่ยังไม่ครอบคลุมและความเสี่ยงคงเหลือ:

- Redis login rate limiting ยังอยู่ใน Phase 7; ห้ามเปิด login endpoint สู่ production traffic ก่อน security control นี้เสร็จ
- ยังไม่มี bootstrap administrator command จึงยังไม่มี manual runtime login ด้วย production-like account fixture
- Access-token enforcement, refresh rotation, logout และ session management ยังอยู่ใน Phase 4–6

งานถัดไป:

- Authentication Phase 4 — Protected requests และ permission guards

## Blocked Items

ยังไม่มีรายการที่บันทึก

## Next Recommended Tasks

1. ทำ Authentication Phase 4 — Protected requests และ permission guards
2. ทำ Authentication Phase 5 — Refresh-token rotation และ reuse detection
3. ทำ Authentication Phase 6 — Logout และ session management

## Update Template

คัดลอกส่วนนี้ไปต่อท้าย Completed Work Log เมื่อปิด Task:

```markdown
### YYYY-MM-DD — Task Name

สถานะ: เสร็จและตรวจสอบแล้ว | เสร็จบางส่วน | ยกเลิก

เป้าหมายและขอบเขต:

- ...

สิ่งที่ทำ:

- ...

Architecture/technical decisions:

- ...

ผลการตรวจสอบ:

- Formatter/Lint: ...
- Typecheck: ...
- Unit tests: ...
- Integration/E2E tests: ...
- Build: ...
- Runtime/Migration verification: ...

ไฟล์หรือเอกสารสำคัญ:

- `path/to/file`

สิ่งที่ยังไม่ครอบคลุมและความเสี่ยงคงเหลือ:

- ...

งานถัดไป:

- ...
```
