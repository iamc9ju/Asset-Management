# Documentation Index

เอกสารถูกแยกตามหน้าที่เพื่อไม่ให้ requirement, architecture, decision และ prompt ปะปนกัน

## Document authority

1. `01-requirements/` — ความต้องการทางธุรกิจและขอบเขตผลิตภัณฑ์
2. `02-architecture/` — architecture baseline และโครงสร้างระบบ
3. `03-decisions/` — Architecture Decision Records (ADR) พร้อมเหตุผลของการตัดสินใจ
4. `04-development/` — checklist, progress history และ implementation plans
5. `04-guides/` — คู่มือสำหรับ developer และ operation
6. `05-api/` — API conventions, OpenAPI และ integration notes
7. `06-database/` — schema, migration, seed และ data dictionary
8. `99-prompts/` — prompt/reference material เท่านั้น ไม่ใช่ข้อกำหนด runtime

เมื่อเอกสารขัดกัน ให้ใช้ Architecture Baseline สำหรับ MVP และสร้าง ADR ใหม่ก่อนเปลี่ยน decision สำคัญ

## Current documents

- [Software Requirement Specification](01-requirements/asset-management-srs.md)
- [MVP Architecture Baseline](02-architecture/mvp-architecture-baseline.md)
- [Monorepo Project Structure](02-architecture/project-structure.md)
- [ADR-0001: pnpm and Turborepo](03-decisions/0001-pnpm-turborepo.md)
- [ADR-0002: Modular Monolith](03-decisions/0002-modular-monolith.md)
- [ADR-0003: Infrastructure](03-decisions/0003-infrastructure.md)
- [Project Development Checklist](04-development/project-development-checklist.md)
- [Local Development](04-guides/local-development.md)
- [API Documentation](05-api/README.md)
- [Database Documentation](06-database/README.md)
- [Original Architecture Prompt](99-prompts/asset-management-architecture-prompt.md)

## File naming

- ใช้ lowercase kebab-case เช่น `asset-transfer-flow.md`
- ADR ใช้เลข 4 หลัก เช่น `0004-authentication-token-strategy.md`
- ห้ามวาง prompt ใน requirements
- diagram source ให้อยู่ใกล้เอกสารที่อธิบาย หรือใน `docs/assets/` เมื่อถูกใช้หลายเอกสาร
