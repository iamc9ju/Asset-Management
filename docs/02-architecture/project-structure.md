# Monorepo Project Structure

## Repository layout

```text
asset-management/
├── apps/
│   ├── web/                    # React + Vite application
│   │   └── src/
│   │       ├── app/            # router, providers, application shell
│   │       ├── features/       # feature slices: assets, audits, auth
│   │       ├── components/     # app-specific components
│   │       ├── hooks/
│   │       ├── lib/            # API client and utilities
│   │       └── pages/
│   └── api/                    # NestJS modular monolith
│       └── src/
│           ├── config/
│           ├── database/
│           │   ├── migrations/
│           │   └── seeds/
│           ├── modules/
│           │   ├── auth/
│           │   ├── iam/
│           │   ├── assets/
│           │   ├── locations/
│           │   ├── audit-campaigns/
│           │   └── activity-logs/
│           └── shared/
├── packages/
│   ├── types/                  # stable cross-app contracts only
│   └── ui/                     # shadcn/ui components
├── infra/
│   └── seaweedfs/
├── docs/
└── scripts/
```

โฟลเดอร์ย่อยที่ยังไม่มี implementation จะสร้างพร้อม feature แรก เพื่อไม่ให้ repository เต็มไปด้วย empty placeholders

## Backend module boundary

แต่ละ business module ใช้ dependency direction ต่อไปนี้:

```text
presentation -> application -> domain
                      |
                      v
                infrastructure
```

- `domain/` — entity, value object, domain service, invariant; ไม่ import NestJS หรือ TypeORM
- `application/` — use case, command/query, port และ transaction orchestration
- `infrastructure/` — TypeORM repository, Redis/S3 adapter และ external implementation
- `presentation/` — controller, request DTO, guard และ response mapping

ห้าม module หนึ่ง import TypeORM entity ภายในของอีก module โดยตรง ให้เรียก public application service หรือใช้ port ที่ตกลงกัน

## Frontend feature boundary

แต่ละ feature ควรมี `api/`, `components/`, `hooks/`, `model/`, `pages/` ตามความจำเป็น และ import UI primitives จาก `@asset-management/ui` ส่วน API response ที่ใช้ร่วมกัน import จาก `@asset-management/types`

## Shared package rule

อย่าย้ายโค้ดเข้า `packages/*` เพียงเพราะถูกใช้สองครั้ง โค้ดต้องมี API ที่เสถียรและไม่มี dependency กลับเข้า `apps/*` ก่อนจึงเป็น shared package

