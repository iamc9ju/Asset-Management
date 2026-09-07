# ADR-0001: Use pnpm Workspaces and Turborepo

- Status: Accepted
- Date: 2026-08-28

## Context

ระบบมี Web, API และ shared packages ที่ต้องใช้ TypeScript/tooling ชุดเดียวกัน แต่ deploy แยก container ได้

## Decision

ใช้ pnpm workspace จัดการ dependencies และใช้ Turborepo จัด task graph, cache และคำสั่งจาก repository root

## Consequences

- dependency ภายในอ้างด้วย `workspace:*`
- ใช้ lockfile เดียวที่ root
- ทุก workspace ต้องมี `build`, `lint`, `test`, `typecheck` เท่าที่เกี่ยวข้อง
- ไม่อนุญาต nested lockfile ใน `apps/*` หรือ `packages/*`

