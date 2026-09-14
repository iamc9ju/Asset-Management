# Local Development

## Prerequisites

- Node.js 22 LTS หรือใหม่กว่า
- Corepack และ pnpm 10
- Docker Engine พร้อม Docker Compose v2
- Neon project และ development branch สำหรับฐานข้อมูล

## First run

```bash
cp .env.example .env
corepack enable
pnpm install
pnpm infra:up
pnpm dev
```

คัดลอก pooled Neon connection string ไปที่ `DATABASE_URL` และ direct connection string ของ branch เดียวกันไปที่ `DATABASE_URL_UNPOOLED` ใน `.env` ห้าม commit หรือส่ง connection string จริงผ่าน client-side environment variables ตัวแปรที่ขึ้นต้นด้วย `VITE_` หรือ source code

สำหรับ `node-postgres` ให้ใช้ `sslmode=verify-full&channel_binding=require` ในทั้งสอง URLs เพื่อยืนยัน certificate hostname และเปิด channel binding อย่างชัดเจน

`pnpm infra:up` เปิดเฉพาะ Redis และ SeaweedFS สำหรับ local development ส่วน PostgreSQL หลักใช้ Neon หากต้องการ local PostgreSQL สำหรับ isolated integration tests ให้ใช้ `pnpm infra:db:up`

## Endpoints

- Web: `http://localhost:5173`
- API liveness: `http://localhost:3000/api/v1/health`
- API readiness: `http://localhost:3000/api/v1/health/ready`
- SeaweedFS Master UI: `http://localhost:9333`
- SeaweedFS Filer: `http://localhost:8888`
- SeaweedFS S3: `http://localhost:8333`

## Commands

```bash
pnpm build
pnpm lint
pnpm typecheck
pnpm test
pnpm infra:down
pnpm docker:up
```

## Logging

API ใช้ Pino ผ่าน `nestjs-pino` และเขียน operational logs ไปที่ stdout เท่านั้น Application process ไม่เขียน log ลงไฟล์, database หรือ remote transport

ตัวแปรที่เกี่ยวข้อง:

| Variable              | Development default | Test default | Production default | รายละเอียด                                      |
| --------------------- | ------------------- | ------------ | ------------------ | ----------------------------------------------- |
| `LOG_LEVEL`           | `debug`             | `silent`     | `info`             | ระดับต่ำสุดที่ logger จะเขียน                   |
| `LOG_PRETTY`          | `true`              | `false`      | `false`            | เปิด output ที่อ่านง่ายสำหรับ local development |
| `LOG_HEALTH_REQUESTS` | `false`             | `false`      | `false`            | เขียน successful health request logs            |

Production ปฏิเสธ `LOG_PRETTY=true` ตอน startup เพื่อป้องกัน multi-line/non-JSON output ส่วน TypeORM raw query logging ถูกปิดเพื่อไม่ให้ SQL หรือ query parameters ข้าม structured logging และ redaction policy

HTTP terminal log ใช้ fields หลักดังนี้:

- `timestamp`, `level`, `service`, `environment`, `event` และ `message`
- `request_id`, `method`, `route`, `status_code` และ `duration_ms`
- `error_code` สำหรับ failed requests และ `error_type` สำหรับ `5xx`

ระบบไม่บันทึก request/response body, query string, authorization/cookie headers, SQL message หรือ raw exception stack ใน HTTP terminal log

ตรวจ request-ID correlation และ JSON output โดยรัน API ด้วย:

```bash
LOG_PRETTY=false pnpm --filter @asset-management/api dev
```

จากอีก terminal เรียก unknown route ด้วย UUID ที่กำหนดเอง:

```bash
curl -i \
  -H "X-Request-ID: 123e4567-e89b-42d3-a456-426614174000" \
  http://localhost:3000/api/v1/not-found
```

ค่า `X-Request-ID` ใน response header, `request_id` ใน error envelope และ `request_id` ใน terminal log ต้องตรงกัน Successful `/api/v1/health` และ `/api/v1/health/ready` จะไม่สร้าง terminal log เมื่อ `LOG_HEALTH_REQUESTS=false` แต่ failed health/readiness request ยังคงเขียน log ระดับ `error`

เมื่อ API เริ่มรับ request สำเร็จ ระบบเขียน `application_started` และเมื่อ graceful shutdown ผ่าน `SIGINT` หรือ `SIGTERM` ระบบเขียนและ flush `application_stopping` ก่อน process สิ้นสุด

## Adding a shadcn/ui component

รันจาก repository root และกำหนด destination ไปที่ shared UI package ตาม `components.json`:

```bash
pnpm dlx shadcn@latest add dialog --cwd packages/ui
```

ตรวจ import หลัง generate ให้ใช้ `@asset-management/ui/lib/utils` และให้ Web import component ผ่าน `@asset-management/ui/components/ui/<name>`

## Database migrations

API runtime ใช้ pooled Neon URL จาก `DATABASE_URL` ส่วน TypeORM CLI เลือก direct URL จาก `DATABASE_URL_UNPOOLED` ก่อน และ fallback ไปที่ `DATABASE_URL` เมื่อไม่ได้กำหนด direct URL

ให้สร้าง Neon development/preview branch แยกจาก production ก่อนรัน migration หรือ rollback แล้วกำหนด connection strings ของ branch นั้นใน `.env`

สำหรับ migration ที่ generate จาก TypeORM entities ให้ตรวจ SQL ทุกครั้งก่อนรัน ส่วน initial schema migration เป็น migration ที่เขียนจาก Architecture Baseline โดยตรง:

```bash
pnpm --filter @asset-management/api migration:generate -- src/database/migrations/DescribeChange
pnpm --filter @asset-management/api migration:run
```

ตรวจ rollback เฉพาะ Neon development/preview branch ที่ไม่มีข้อมูลสำคัญ:

```bash
pnpm --filter @asset-management/api migration:revert
pnpm --filter @asset-management/api migration:run
```

ห้ามเปิด `synchronize: true` เป็นทางลัด และห้ามใช้ pooled URL สำหรับงาน dump/restore หรือ migration ที่ต้องพึ่ง session-level behavior
