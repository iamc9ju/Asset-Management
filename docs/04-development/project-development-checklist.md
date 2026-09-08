# Asset Management — Project Development Checklist

เอกสารนี้เป็น source of truth สำหรับติดตามสถานะการพัฒนาและประวัติงานที่เสร็จแล้ว โดยใช้ร่วมกับ Git history, requirements, architecture baseline และ ADRs

- อัปเดตล่าสุด: 2026-09-07
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

### Structured Logging และ HTTP Request Observability

สถานะ: ยังไม่เริ่ม

- [x] ตรวจสอบ logging implementation และข้อกำหนดในระบบปัจจุบัน
- [x] เปรียบเทียบ NestJS Logger, Pino และ Winston
- [ ] ตัดสินใจ logging architecture และบันทึก ADR หากมีผลระยะยาว
- [ ] กำหนด structured log schema
- [ ] กำหนด log levels และ event-name catalog
- [ ] กำหนด redaction policy สำหรับ headers, body, credentials และ PII
- [ ] ออกแบบ request lifecycle logging พร้อม `request_id`
- [ ] ออกแบบการเชื่อมต่อกับ Global Exception Filter
- [ ] กำหนด environment configuration และ startup validation
- [ ] วางแผน health-check log suppression หรือ sampling
- [ ] วางแผน unit และ integration tests
- [ ] Review และอนุมัติ implementation plan
- [ ] Implement ตามแผนที่อนุมัติ
- [ ] Formatter, tests, typecheck และ production build ผ่าน
- [ ] อัปเดต checklist และเอกสารที่เกี่ยวข้อง

## Milestone Checklist

### 1. Product Requirements และ Architecture

- [x] จัดทำ Software Requirement Specification สำหรับ MVP
- [x] จัดทำ MVP Architecture Baseline
- [x] กำหนดโครงสร้าง monorepo
- [x] บันทึก ADR สำหรับ pnpm และ Turborepo
- [x] บันทึก ADR สำหรับ Modular Monolith
- [x] บันทึก ADR สำหรับ infrastructure baseline
- [ ] Review requirements และ architecture ก่อนเริ่มแต่ละ domain module
- [ ] จัดทำ ADR สำหรับ authentication และ session strategy
- [ ] จัดทำ ADR สำหรับ structured logging หากเลือก external logging framework
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
- [ ] เพิ่ม structured logging และ request observability
- [ ] เพิ่ม OpenAPI/Swagger generation
- [ ] กำหนด API versioning และ deprecation policy
- [ ] เพิ่ม rate limiting
- [ ] เพิ่ม idempotency middleware/guard สำหรับ mutation ที่ retry ได้

### 5. Database และ Persistence

- [x] เพิ่ม TypeORM และ PostgreSQL connection configuration
- [x] เพิ่ม TypeORM CLI configuration
- [x] เพิ่ม migration scripts
- [ ] สร้าง shared persistence conventions และ base types ที่จำเป็น
- [ ] สร้าง initial schema migration ตาม architecture baseline
- [ ] ตั้งชื่อ constraints และ indexes ที่ต้อง map เป็น domain errors
- [ ] เพิ่ม migration integration tests
- [ ] เพิ่ม seed strategy สำหรับ development และ test
- [ ] เพิ่ม transaction-boundary conventions
- [ ] เพิ่ม optimistic/pessimistic concurrency strategy ตาม use case
- [ ] ทดสอบ migration run และ rollback บนฐานข้อมูลว่าง

### 6. Authentication และ Authorization

- [ ] สรุป authentication/session requirements
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
- [ ] เพิ่ม structured application logs
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

## Blocked Items

ยังไม่มีรายการที่บันทึก

## Next Recommended Tasks

1. วางแผน Structured Logging และ HTTP Request Observability
2. ตัดสินใจ Authentication และ Session Strategy พร้อม ADR
3. เพิ่ม OpenAPI ก่อนเริ่มขยาย domain endpoints
4. ออกแบบ Initial Database Schema และ Migration Plan
5. เริ่ม User/Authentication module ก่อน Asset workflows ที่ต้องใช้ actor และ permission

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
