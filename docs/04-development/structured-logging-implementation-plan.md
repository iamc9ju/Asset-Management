# Structured Logging และ HTTP Request Observability — Implementation Plan

- สถานะเอกสาร: Approved — implementation pending
- อัปเดตล่าสุด: 2026-09-08
- ขอบเขต: `apps/api`
- ผู้ตัดสินใจ: Project owner
- Decision: ใช้ Pino ผ่าน `nestjs-pino`
- Decision status: Approved on 2026-09-08
- ADR: [ADR-0004: Structured Logging with Pino](../03-decisions/0004-structured-logging.md)

## 1. เป้าหมาย

สร้างระบบ logging สำหรับ NestJS Backend ที่มีโครงสร้างสม่ำเสมอ ค้นหาด้วย `request_id` ได้ ปลอดภัยต่อข้อมูลสำคัญ และเหมาะกับการทำงานผ่าน container/stdout โดยไม่เปลี่ยน error response contract ที่มีอยู่

ระบบที่เสร็จแล้วต้องรองรับ:

- JSON structured logs ใน production
- log ที่อ่านง่ายใน local development
- HTTP terminal log หนึ่งรายการต่อ request เป็นค่าเริ่มต้น
- correlation ด้วย `request_id` เดียวกับ `X-Request-ID` และ error response
- log levels ที่สัมพันธ์กับ HTTP status และประเภทเหตุการณ์
- allowlisted request/response metadata
- defense-in-depth redaction
- การลด noise จาก successful health checks
- deterministic tests โดยไม่พึ่ง PostgreSQL, Redis หรือ SeaweedFS จริง

## 2. สิ่งที่อยู่นอกขอบเขต

- การเลือก centralized log platform เช่น Loki, Elasticsearch, Datadog หรือ CloudWatch
- Distributed tracing และ OpenTelemetry
- Metrics, dashboards และ alert rules
- Audit log ทางธุรกิจ ซึ่งต้องเก็บในฐานข้อมูลแบบ append-only แยกจาก operational logs
- Database query logging
- Request/response body logging
- การเขียน log ลงไฟล์, database หรือ remote transport จาก application process
- การเปลี่ยน error envelope หรือ HTTP API behavior

## 3. Current State

Backend ปัจจุบันมี:

- NestJS 11 และ Express adapter
- `X-Request-ID` middleware ที่รับ UUID จาก client หรือสร้าง UUID ใหม่
- `request.requestId` และ `X-Request-ID` response header
- Global Exception Filter
- Standard Error Envelope ที่มี `request_id`
- safe error mapping และ error-detail sanitization
- `Logger` จาก `@nestjs/common` ใน Global Exception Filter
- log `http_request_failed` เฉพาะ error ระดับ `5xx`
- Zod environment validation ตอน startup
- Jest unit/integration tests

ช่องว่างปัจจุบัน:

- ไม่มี HTTP completion log สำหรับ successful requests และ `4xx`
- ไม่มี duration, normalized route หรือ status-based level policy กลาง
- request context ยังไม่ไหลเข้า service logs โดยอัตโนมัติ
- logger configuration ยังไม่แยก development, test และ production
- event names และ log fields ยังไม่มี source of truth กลาง
- ไม่มี centralized redaction policy สำหรับ operational logs
- Global Exception Filter เป็นเจ้าของ error log เอง ทำให้มีโอกาสเกิด duplicate logs เมื่อเพิ่ม HTTP logger

## 4. Assumptions และ Decisions ที่ได้รับอนุมัติ

### Assumptions

- Production จะอ่าน logs จาก stdout/stderr ของ container
- Log collector เป็นความรับผิดชอบของ deployment platform ไม่ใช่ application
- API ยังเป็น Modular Monolith process เดียว
- `request_id` เป็น UUID และเป็น correlation identifier หลัก
- Audit logs และ operational logs เป็นคนละ concern
- ไม่มี requirement ให้ application ส่ง logs ไปหลายปลายทางพร้อมกัน

### Decisions ที่ได้รับอนุมัติ

1. ใช้ Pino ผ่าน `nestjs-pino`
2. Production ใช้ JSON logs และ development ใช้ `pino-pretty`
3. Test environment ปิด log เป็นค่าเริ่มต้น
4. ส่ง log ไปยัง stdout เท่านั้น
5. ไม่บันทึก request body หรือ response body
6. Suppress successful `/health` และ `/health/ready` request logs แต่ failed health checks ต้องถูก log
7. Unknown-route `404` ใช้ระดับ `info`
8. `400`, `401`, `403`, `409`, `422` และ `429` ใช้ระดับ `warn`
9. `5xx` ใช้ระดับ `error`
10. ใช้ `X-Request-ID` เดิมเป็น request correlation ID ตลอด request lifecycle

## 5. เปรียบเทียบทางเลือก

| เกณฑ์                    | NestJS Logger                                 | Pino + `nestjs-pino`                    | Winston                                         |
| ------------------------ | --------------------------------------------- | --------------------------------------- | ----------------------------------------------- |
| Dependency เพิ่ม         | ไม่เพิ่ม                                      | เพิ่ม Pino integration                  | เพิ่ม Winston integration                       |
| JSON logs                | รองรับผ่าน `ConsoleLogger({ json: true })`    | JSON เป็นรูปแบบหลัก                     | รองรับผ่าน JSON format                          |
| HTTP auto logging        | ต้องสร้าง middleware/interceptor เอง          | มีผ่าน `pino-http`                      | ต้องเพิ่ม middleware/integration เอง            |
| Request context          | ต้องสร้าง AsyncLocalStorage/context layer เอง | ผูก request context อัตโนมัติ           | ต้องสร้าง context layer เพิ่ม                   |
| `request_id` propagation | ทำเอง                                         | รองรับ `genReqId` และ child logger      | ทำเองหรือใช้ integration เพิ่ม                  |
| Redaction                | ต้องเขียน sanitizer/serializer เอง            | มี path-based redaction และ serializers | ทำได้ผ่าน custom formats                        |
| Multiple transports      | จำกัด ต้องเขียน custom logger                 | ไม่ใช่จุดเด่น; แนะนำ stdout             | จุดเด่นหลักของ Winston                          |
| Runtime overhead         | เพียงพอสำหรับระบบขนาดเล็ก                     | ออกแบบเพื่อ throughput สูง              | ยืดหยุ่นกว่าแต่ processing pipeline ซับซ้อนกว่า |
| Configuration complexity | ต่ำตอนเริ่ม แต่สูงขึ้นเมื่อเพิ่ม context      | ปานกลางและตรงกับ requirement นี้        | ปานกลางถึงสูง                                   |
| NestJS integration       | Built-in                                      | Integration ครบและแทน Nest logger ได้   | ต้องใช้ adapter เช่น `nest-winston`             |
| เหมาะกับโปรเจกต์นี้      | ใช้ได้ แต่ต้องสร้าง plumbing เองมาก           | เหมาะที่สุด                             | เกินความต้องการเมื่อไม่ใช้หลาย transports       |

### 5.1 NestJS Logger

ข้อดี:

- ไม่มี production dependency เพิ่ม
- ทำงานกับ Nest bootstrap และ dependency injection โดยตรง
- รองรับ JSON output และ structured parameters
- migration risk ต่ำที่สุด

ข้อจำกัด:

- ต้องสร้าง HTTP middleware/interceptor, timing, request context และ redaction policy เอง
- การเติม `request_id` ให้ logs จาก service/application layer ต้องสร้าง AsyncLocalStorage หรือส่ง context ด้วยตนเอง
- มีโอกาสสร้าง custom logging framework ภายในโปรเจกต์มากเกินความจำเป็น

เหมาะเมื่อ:

- ต้องการเพียง system logs และ application logs จำนวนไม่มาก
- ไม่ต้องการ automatic request logging หรือ request-scoped context

NestJS รองรับ JSON logging และการเปลี่ยน logger implementation ผ่าน `app.useLogger()` โดยตรง: <https://docs.nestjs.com/techniques/logger>

### 5.2 Pino ผ่าน `nestjs-pino`

ข้อดี:

- JSON-first และเหมาะกับ stdout/container logging
- `pino-http` รองรับ request timing, status-based levels, serializers และ request ID generation
- `nestjs-pino` ใช้ request child loggers และ AsyncLocalStorage เพื่อให้ context เข้าถึง service logs ได้โดยไม่ใช้ request-scoped providers
- มี redaction mechanism และสามารถเพิ่ม allowlisted serializers เป็นชั้นป้องกันแรก
- สามารถแทน Nest system logger ทำให้ bootstrap/application logs ใช้ pipeline เดียวกัน
- รองรับ NestJS 11 ใน release line ปัจจุบัน

ข้อจำกัด:

- เพิ่ม production dependencies และ integration-specific API
- default request serializer อาจมี headers มากเกินไป ต้อง configure allowlist/redaction ก่อนใช้งาน
- automatic logs อาจซ้ำกับ Global Exception Filter หากไม่กำหนด ownership
- pretty printing ต้องแยกเป็น development-only transport

เหมาะเมื่อ:

- ต้องการ operational HTTP logs และ correlation context เป็น requirement หลัก
- application ทำงานใน container และส่ง JSON ไป stdout

เอกสารอ้างอิง:

- `nestjs-pino` request context และ NestJS integration: <https://github.com/iamolegga/nestjs-pino>
- `pino-http` request ID, serializers และ automatic logging: <https://github.com/pinojs/pino-http>
- Pino redaction: <https://github.com/pinojs/pino/blob/main/docs/redaction.md>

### 5.3 Winston

ข้อดี:

- Flexible format pipeline
- รองรับหลาย transports เช่น console, file, HTTP และ third-party destinations
- ecosystem สำหรับ custom formats และ transports มีขนาดใหญ่

ข้อจำกัด:

- ความสามารถหลาย transports ไม่จำเป็นกับ architecture ที่ให้ container runtime เก็บ stdout
- request context และ HTTP lifecycle ต้องมี Nest integration/context layer เพิ่ม
- mutable format pipeline และ transport configuration เพิ่ม operational complexity
- child logger มีข้อควรระวังเมื่อใช้ร่วมกับ extended logger class ตามเอกสารของ Winston

เหมาะเมื่อ:

- มี requirement ชัดเจนให้ application ส่ง logs ไปหลายปลายทาง
- ต้องใช้ transport/format เฉพาะที่มีใน Winston ecosystem

เอกสารอ้างอิง: <https://github.com/winstonjs/winston>

## 6. Approved Decision

เลือกใช้ **Pino ผ่าน `nestjs-pino`** โดยใช้ stdout เป็นปลายทางเดียว ตาม [ADR-0004](../03-decisions/0004-structured-logging.md)

เหตุผล:

1. Requirement หลักคือ HTTP lifecycle และ request correlation ไม่ใช่ multiple transports
2. ทำงานร่วมกับ `request_id` และ service logs ได้โดยไม่สร้าง request-scoped providers
3. ให้ JSON logs เป็นค่าเริ่มต้นและเหมาะกับ Docker deployment
4. มี serializer และ redaction primitives ที่ตรงกับ security requirement
5. ลด custom middleware/interceptor plumbing เมื่อเทียบกับ NestJS Logger เดิม
6. Winston มี flexibility ที่ยังไม่มี use case รองรับและจะเพิ่ม configuration surface โดยไม่จำเป็น

Decision guardrail:

- Domain/application code ควรพึ่ง Nest-compatible logger abstraction ไม่ควร import raw Pino instanceทั่วไป
- Pino-specific configuration ต้องอยู่ใน shared logging/infrastructure boundary
- ห้ามใช้ file, database หรือ HTTP transport ใน application process
- หากภายหลังเปลี่ยน logger ต้องไม่กระทบ domain logic

## 7. Target Architecture

```text
Incoming HTTP request
        |
        v
Request ID resolution
  - validate incoming X-Request-ID
  - generate UUID when absent/invalid
        |
        v
HTTP logging context
  - request_id
  - method
  - normalized route
  - start time
        |
        v
NestJS controller/application/domain
  - child logger automatically receives request context
        |
        +--------------------------+
        |                          |
        v                          v
Successful response         Exception Filter
                                   |
                                   v
                            safe error mapping
                            + error_code metadata
        |                          |
        +-------------+------------+
                      v
              One terminal HTTP log
              - status_code
              - duration_ms
              - error_code when present
                      |
                      v
                 stdout/stderr
```

### Logging ownership

- HTTP logger เป็นเจ้าของ terminal request log
- Global Exception Filter เป็นเจ้าของ response mapping เท่านั้น
- Filter ต้องส่ง safe `error_code`/`error_type` เข้า request/response logging context
- ห้าม log raw exception object จาก Filter และ HTTP logger พร้อมกัน
- Application services log เฉพาะ business/operational events ที่มีความหมาย ไม่ log ทุก method entry/exit

## 8. Standard Log Schema

ใช้ `snake_case` ให้สอดคล้องกับ error envelope และ architecture baseline

### Required fields ทุก log

| Field         | Type                       | รายละเอียด                                      |
| ------------- | -------------------------- | ----------------------------------------------- |
| `timestamp`   | ISO-8601 string หรือ epoch | ให้ logger สร้าง ไม่รับจาก client               |
| `level`       | string/number              | normalized โดย logging pipeline                 |
| `service`     | string                     | `asset-management-api` จาก constant/config กลาง |
| `environment` | string                     | development, test หรือ production               |
| `event`       | stable string              | machine-readable event name                     |
| `message`     | string                     | human-readable และไม่มี secrets                 |

### HTTP terminal log fields

| Field         | Required     | รายละเอียด                                                    |
| ------------- | ------------ | ------------------------------------------------------------- |
| `request_id`  | Yes          | ค่าเดียวกับ response header/envelope                          |
| `method`      | Yes          | HTTP method                                                   |
| `route`       | Yes          | normalized route template หรือ pathname ที่ไม่มี query string |
| `status_code` | Yes          | final HTTP status                                             |
| `duration_ms` | Yes          | server processing duration                                    |
| `error_code`  | Error only   | stable application error code                                 |
| `error_type`  | `5xx` only   | class/type ที่ปลอดภัย ไม่ใช่ raw message                      |
| `actor_id`    | เมื่อมี auth | internal user UUID เท่านั้น                                   |

ห้ามใส่โดยปริยาย:

- raw URL query string
- request/response body
- authorization/cookie headers
- IP address
- email, employee name หรือ personal identifiers
- SQL, query parameters หรือ database error object
- raw exception message/stack ใน production

## 9. Event Catalog

ประกาศ event names จาก source of truth เดียว ห้ามกระจาย string literals:

- `application_started`
- `application_stopping`
- `http_request_completed`
- `http_request_failed`
- `infrastructure_dependency_unavailable`
- domain-specific events จะเพิ่มเมื่อมี module และ business requirement

`event` เป็น stable machine-readable field ส่วน `message` เปลี่ยนข้อความได้โดยไม่กระทบ alert/query logic

## 10. Log-Level Policy

| Condition                                        | Level                 |
| ------------------------------------------------ | --------------------- |
| Application startup/shutdown                     | `info`                |
| HTTP `2xx`/`3xx`                                 | `info`                |
| Unknown-route HTTP `404`                         | `info`                |
| HTTP `400`, `401`, `403`, `409`, `422` และ `429` | `warn`                |
| HTTP `5xx` หรือ dependency unavailable           | `error`               |
| Development diagnostic                           | `debug`               |
| High-volume internals                            | `trace`, ปิดโดยปริยาย |

HTTP `4xx` อื่นที่ไม่ได้ระบุข้างต้นต้องกำหนดระดับผ่าน status-to-level policy กลางก่อนนำมาใช้งาน ห้ามกระจายเงื่อนไขตาม controller หรือ service

## 11. HTTP Logging Policy

- ไม่ emit “request received” log โดยปริยาย เพื่อลด log volume เป็นสองเท่า
- เก็บ start time ใน request context และ emit terminal log เมื่อ response จบ
- terminal log ต้องเกิดทั้ง success, handled error และ unknown error
- client disconnect/aborted request ต้องมี outcome ที่แยกจาก success
- normalized route ต้องไม่มี query parameters
- successful health endpoints ถูก suppress โดยปริยาย
- failed health/readiness checks ต้อง log ระดับ `error`
- ไม่ log static assets หาก Backend ให้บริการในอนาคต

## 12. Request-ID Integration

ต้องมี request ID source of truth เดียว:

1. รับ `X-Request-ID` เมื่อเป็น UUID ที่ถูกต้อง
2. normalize เป็น lowercase
3. สร้าง UUID ใหม่เมื่อ header หายหรือไม่ถูกต้อง
4. เก็บไว้บน request object
5. ส่งกลับเป็น `X-Request-ID`
6. ใช้ค่าเดียวกันเป็น Pino request/child logger ID
7. ใช้ค่าเดียวกันใน Standard Error Envelope

ห้ามให้ request-id middleware และ `pino-http` สร้าง ID คนละค่า การ implement ต้อง refactor resolver ให้ reuse ได้และมี test ยืนยัน header, request property, log และ error envelope ตรงกัน

## 13. Redaction และ Data-Minimization Policy

### ชั้นที่ 1: Allowlisted serializers

Request serializer คืนเฉพาะ:

- request ID
- method
- normalized route/pathname

Response serializer คืนเฉพาะ:

- status code

ไม่ serialize full request, response หรือ headers object

### ชั้นที่ 2: Pino redaction

กำหนด static redact paths สำหรับ defense in depth อย่างน้อย:

- authorization
- proxy authorization
- cookie และ set-cookie
- password/current_password/new_password
- access token/refresh token
- API/access/secret keys
- database credentials และ connection URLs
- nested request/response sensitive fields หาก serializer ถูกเปลี่ยนในอนาคต

Redaction paths ต้องเป็น static configuration เท่านั้น ห้ามสร้างจาก user input

### ชั้นที่ 3: Logging API rules

- ห้ามส่ง raw request body เข้า logger
- ห้ามส่ง raw `Error`, TypeORM/PG/Redis/AWS error object เข้า structured metadata
- known `AppError` log เฉพาะ stable code และ allowlisted details ที่จำเป็นจริง
- unknown error ใน production log เฉพาะ safe type/correlation metadata
- stack trace อนุญาตเฉพาะ policy ที่ได้รับอนุมัติและต้องไม่รวม raw driver error/message

Pino ระบุว่า request body logging ถูกปิดโดยปริยายเพราะมีความเสี่ยงต่อข้อมูลส่วนบุคคล และ redaction wildcard มีต้นทุนมากกว่า explicit paths จึงควรใช้ allowlist ร่วมกับ explicit redaction paths: <https://github.com/pinojs/pino-http#logging-request-body> และ <https://github.com/pinojs/pino/blob/main/docs/redaction.md>

## 14. Environment Configuration

เพิ่ม typed environment variables ผ่าน Zod schema:

| Variable              | Allowed                                                      | Proposed default                                      |
| --------------------- | ------------------------------------------------------------ | ----------------------------------------------------- |
| `LOG_LEVEL`           | `trace`, `debug`, `info`, `warn`, `error`, `fatal`, `silent` | development=`debug`, test=`silent`, production=`info` |
| `LOG_PRETTY`          | `true`, `false`                                              | `true` เฉพาะ development                              |
| `LOG_HEALTH_REQUESTS` | `true`, `false`                                              | `false`                                               |

ข้อกำหนด:

- production ต้องไม่เปิด pretty transport
- test ต้อง silent โดยปริยาย แต่เปิด logger ราย test ได้เมื่อทดสอบ output
- invalid log level ต้องทำให้ startup fail
- environment defaults ต้องคำนวณจาก `NODE_ENV` ใน config factory ไม่กระจายใน business logic
- อัปเดต `.env.example` โดยไม่มี secrets

## 15. Planned Files

### ไฟล์ที่จะสร้าง

```text
apps/api/src/config/logging.config.ts
apps/api/src/shared/logging/log-event.constants.ts
apps/api/src/shared/logging/logging.module.ts
apps/api/src/shared/logging/logging.types.ts
apps/api/src/shared/logging/http-log.serializer.ts
apps/api/src/shared/logging/http-log.serializer.spec.ts
apps/api/src/shared/logging/log-redaction.constants.ts
apps/api/src/shared/logging/logging.integration.spec.ts
docs/03-decisions/0004-structured-logging.md
```

ชื่อไฟล์จริงสามารถปรับหลัง spike กับ API ของ `nestjs-pino` แต่ module boundary และความรับผิดชอบต้องคงตามแผน

### ไฟล์ที่จะแก้

```text
.env.example
apps/api/package.json
apps/api/src/app.module.ts
apps/api/src/config/environment.schema.ts
apps/api/src/main.ts
apps/api/src/shared/http/errors/global-exception.filter.ts
apps/api/src/shared/http/request-id/request-id.middleware.ts
apps/api/src/shared/http/request-id/request-id.types.ts
apps/api/src/shared/http/request-id/request-id.middleware.spec.ts
docs/04-development/project-development-checklist.md
pnpm-lock.yaml
```

## 16. Dependency Plan

หลัง decision ได้รับอนุมัติเท่านั้นจึงเพิ่ม:

- `nestjs-pino` เป็น NestJS integration
- `pino` ตาม peer dependency ที่ compatible
- `pino-http` ตาม peer dependency ที่ compatible หาก package manager ไม่ resolve ให้โดยตรง
- `pino-pretty` เป็น development dependency เท่านั้นสำหรับ local development

ก่อนติดตั้งต้องตรวจ release/peer dependencies ปัจจุบันกับ NestJS 11, Node.js 22 และ pnpm lockfile ห้ามใช้ unpinned floating dependency ใน production build

## 17. Implementation Sequence

1. อนุมัติ proposed decision และสร้าง ADR-0004
2. ตรวจ compatibility แล้วติดตั้ง dependencies
3. เพิ่ม environment schema/config พร้อม unit tests
4. เพิ่ม centralized event names, types, serializers และ redaction paths
5. เชื่อม `LoggerModule` เป็น global logging infrastructure
6. เปิด bootstrap buffering แล้วแทน Nest system logger หลัง DI พร้อม
7. รวม request ID resolver ให้เป็น source of truth เดียว
8. เชื่อม request context กับ logger และ response header
9. ย้าย HTTP error logging ownership ออกจาก Global Exception Filter เพื่อตัด duplicate log
10. เพิ่ม safe error metadata ให้ terminal HTTP log
11. เพิ่ม health-check suppression policy
12. เพิ่ม unit/integration tests
13. รัน formatter, lint, typecheck, tests และ production build
14. Smoke test success, validation error, not found, conflict และ unknown error
15. ตรวจ logs ด้วย secret canaries ว่าไม่รั่ว
16. อัปเดต checklist, API/operations documentation และ PR evidence

## 18. Test Strategy

### Unit tests

- Request serializer คืนเฉพาะ allowlisted fields
- Query string ไม่ปรากฏใน normalized route
- Response serializer คืนเฉพาะ status code
- Redaction paths ครอบคลุม camelCase, snake_case และ headers
- Status-to-level mapping ถูกต้อง
- Health suppression ทำงานตาม config
- Invalid logging environment configuration ทำให้ validation fail

### Integration tests

- `2xx` emit `http_request_completed` พร้อม request ID และ duration
- invalid DTO `400` emit `warn` พร้อม `VALIDATION_FAILED`
- unknown route `404` emit policy level พร้อม `RESOURCE_NOT_FOUND`
- `AppError` `409` emit `warn` พร้อม stable code
- unknown exception `500` emit `error` พร้อม `INTERNAL_ERROR`
- incoming valid `X-Request-ID` ตรงกันใน header, envelope และ log
- invalid `X-Request-ID` ถูกแทนด้วย UUID ใหม่และใช้ค่าเดียวกันทุกจุด
- authorization, cookie, password, token, query string, SQL message และ stack canaries ไม่ปรากฏใน captured production logs
- successful health check ถูก suppress แต่ failed readiness ถูก log
- หนึ่ง request มี terminal HTTP log เพียงหนึ่งรายการ

### Regression checks

- Request ID middleware tests เดิมผ่าน
- Global Exception Filter tests เดิมผ่าน
- `/health` และ `/health/ready` response contract ไม่เปลี่ยน
- Backend startup, shutdown และ CORS behavior ไม่เปลี่ยน

## 19. Operational Considerations

- stdout เป็น append-only stream; ห้าม application rotate log files
- log collector ต้องรับ multi-line-free JSON ใน production
- ห้ามให้ pretty transport ทำงานใน production
- logger/transport initialization failure ต้อง fail startup อย่างชัดเจน
- individual logging call ต้องไม่ทำให้ business request fail
- log volume ต้องวัดหลัง rollout โดยเฉพาะ health endpoints และ `4xx`
- retention, access control และ deletion policy เป็นหน้าที่ของ production platform
- `request_id` ใช้ correlation ไม่ใช่ authentication หรือ idempotency key

## 20. Rollout และ Rollback

### Rollout

1. เปิดใช้ใน development และ integration tests
2. เปรียบเทียบ request IDs และ error codes กับ response จริง
3. ตรวจ secret canaries
4. เปิดใน staging ด้วย JSON output
5. ตรวจ parsing, volume และ queryability
6. เปิด production โดยไม่เปิด request bodies

### Rollback

- เก็บ integration ไว้ใน logging module boundary
- revert logger bootstrap/module configuration และกลับไปใช้ NestJS Logger
- Request ID และ Global Exception Filter ต้องยังทำงานโดยอิสระ
- ไม่มี database migration หรือ data rollback
- rollback ต้องไม่เปลี่ยน Standard Error Envelope

## 21. Risks และ Mitigations

| Risk                                           | Mitigation                                                                       |
| ---------------------------------------------- | -------------------------------------------------------------------------------- |
| Full headers/body รั่วลง log                   | allowlisted serializers + explicit redaction + canary tests                      |
| HTTP log ซ้ำกับ Exception Filter               | กำหนด HTTP logger เป็น terminal-log owner เดียว                                  |
| Request IDs คนละค่าระหว่าง middleware/logger   | shared resolver และ integration assertion                                        |
| Query string มี token/PII                      | normalized route/pathname เท่านั้น                                               |
| Pretty transport หลุด production               | startup validation และ production integration test                               |
| Health checks สร้าง noise                      | suppress successful health logs โดย policy กลาง                                  |
| Logger dependency กระจายเข้า domain            | Nest-compatible abstraction และ shared logging boundary                          |
| Unknown errors debug ยากเพราะไม่ log raw stack | ใช้ request ID, safe error type และเพิ่ม secure error telemetry ภายหลังหากจำเป็น |
| Log operation กระทบ request                    | stdout/non-blocking design และไม่ใช้ network transport ใน process                |

## 22. Definition of Done

- [x] เจ้าของโปรเจกต์อนุมัติ Pino + `nestjs-pino`
- [ ] ADR-0004 ถูกสร้างและ merge
- [ ] Dependencies compatible กับ NestJS 11 และ Node.js 22
- [ ] Logging environment variables มี startup validation
- [ ] Production logs เป็น valid single-line JSON
- [ ] Development logs อ่านง่ายตาม decision
- [ ] ทุก HTTP terminal log มี request ID, method, route, status และ duration
- [ ] Error logs มี stable error code
- [ ] Header, body, query string, SQL, stack และ secrets ไม่รั่วตาม policy
- [ ] Successful health logs ถูก suppress ตาม config
- [ ] ไม่มี duplicate terminal/error logs
- [ ] Unit และ integration tests ผ่าน
- [ ] Existing Backend tests ผ่านทั้งหมด
- [ ] Lint, typecheck และ production build ผ่าน
- [ ] Smoke tests ครบ `2xx`, `400`, `404`, `409`, `500`
- [ ] Checklist และ operational documentation ถูกอัปเดต
- [ ] GitHub Actions CI ผ่านก่อน merge

## 23. Decision Summary

ข้อเสนอสำหรับ Asset Management คือ:

```text
Pino + nestjs-pino
stdout-only
JSON in production
pretty output in development
silent by default in tests
one terminal HTTP log per request
allowlisted serializers + explicit redaction
request_id as the correlation source of truth
```

Architecture decision นี้ได้รับการอนุมัติและบันทึกไว้ใน [ADR-0004](../03-decisions/0004-structured-logging.md) แล้ว
