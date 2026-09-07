# Local Development

## Prerequisites

- Node.js 22 LTS หรือใหม่กว่า
- Corepack และ pnpm 10
- Docker Engine พร้อม Docker Compose v2

## First run

```bash
cp .env.example .env
corepack enable
pnpm install
pnpm infra:up
pnpm dev
```

ค่าใน `.env.example` ใช้ `localhost` สำหรับการรัน Web/API บนเครื่อง ส่วน Compose จะ override hostname ของ API ให้เป็น service name ภายใน network

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

## Adding a shadcn/ui component

รันจาก repository root และกำหนด destination ไปที่ shared UI package ตาม `components.json`:

```bash
pnpm dlx shadcn@latest add dialog --cwd packages/ui
```

ตรวจ import หลัง generate ให้ใช้ `@asset-management/ui/lib/utils` และให้ Web import component ผ่าน `@asset-management/ui/components/ui/<name>`

## Database migrations

สร้าง migration หลังเพิ่ม TypeORM entity และตรวจ SQL ทุกครั้ง:

```bash
pnpm --filter @asset-management/api migration:generate -- src/database/migrations/DescribeChange
pnpm --filter @asset-management/api migration:run
```

ห้ามเปิด `synchronize: true` เป็นทางลัด

