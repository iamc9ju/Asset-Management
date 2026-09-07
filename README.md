# Asset Management Monorepo

Centralized Asset Management & Asset Audit System แบบ Modular Monolith

## Technology stack

- Web: React, Vite, TypeScript, Tailwind CSS, shadcn/ui
- API: NestJS, TypeORM, PostgreSQL
- Storage: SeaweedFS ผ่าน S3-compatible API
- Cache: Redis
- Tooling: pnpm workspace, Turborepo, Docker Compose

## Workspace

```text
apps/
  web/                  React web application
  api/                  NestJS modular-monolith API
packages/
  types/                DTO-independent shared contracts
  ui/                   shared shadcn/ui components
infra/
  seaweedfs/            local SeaweedFS configuration
docs/                   requirements, architecture, ADRs, guides
scripts/                repository automation
```

อ่าน [เอกสารทั้งหมด](docs/README.md) และ [คู่มือเริ่มต้น](docs/04-guides/local-development.md) ก่อนพัฒนา

## Quick start

```bash
cp .env.example .env
corepack enable
pnpm install
pnpm infra:up
pnpm dev
```

Web: `http://localhost:5173`  
API health: `http://localhost:3000/api/v1/health`

