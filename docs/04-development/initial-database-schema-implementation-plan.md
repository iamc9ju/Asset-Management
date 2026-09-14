# Initial Database Schema — Implementation Plan

- สถานะเอกสาร: Implemented and verified
- อัปเดตล่าสุด: 2026-09-14
- ขอบเขต: PostgreSQL schema สำหรับ MVP ทั้งระบบ
- ผู้ตัดสินใจ: Project owner
- อ้างอิง: [MVP Architecture Baseline](../02-architecture/mvp-architecture-baseline.md)
- Authentication decision: [ADR-0005](../03-decisions/0005-authentication-and-session-strategy.md)

## 1. เป้าหมาย

สร้าง PostgreSQL schema เริ่มต้นที่เป็นฐานร่วมสำหรับ Authentication, RBAC, Asset Management, Audit Campaign และ Activity Log โดยรักษา invariants ที่ฐานข้อมูลตรวจสอบได้ด้วย named constraints, foreign keys และ indexes

แผนนี้ครอบคลุม:

- PostgreSQL extensions ที่ schema ต้องใช้
- ตารางและความสัมพันธ์ทั้งหมดใน MVP Architecture Baseline
- Authentication session และ refresh-token rotation chain ตาม ADR-0005
- named primary keys, foreign keys, unique constraints และ check constraints
- partial indexes และ exclusion constraint สำหรับ business invariants
- index สำหรับ query path หลัก
- reversible TypeORM migration

แผนนี้ยังไม่ครอบคลุม:

- TypeORM entities และ repositories
- permission/role seed data
- demo users หรือข้อมูลตัวอย่าง
- Authentication service และ REST endpoints
- database triggers สำหรับ workflow หรือ `updated_at`
- retention/archival jobs

## 2. Source of Truth และ Assumptions

- Schema ใช้ PostgreSQL 15 ขึ้นไป
- Database runtime ใช้ Neon pooled connection ผ่าน `DATABASE_URL`
- TypeORM CLI ใช้ Neon direct connection ผ่าน `DATABASE_URL_UNPOOLED`
- Migration verification ต้องทำบน Neon development/preview branch ที่แยกจาก production
- Application สร้าง UUIDv7 ก่อน insert; database ไม่มี UUID default
- เวลาเก็บเป็น `timestamptz` และใช้ UTC
- API ใช้ `snake_case`; database ใช้ `snake_case`
- TypeORM `synchronize` ต้องปิดเสมอ
- Migration เป็นเจ้าของ schema change เพียงช่องทางเดียว
- ทุก constraint ที่ต้อง map เป็น domain error ต้องมีชื่อคงที่
- Current state และ immutable history ต้องอัปเดตใน transaction เดียวกันโดย application service
- Database บังคับเฉพาะ invariant ที่ตรวจได้จาก row, key, index หรือ foreign key
- State-transition legality, object authorization และ workflow ข้าม aggregate อยู่ใน domain/application layer

## 3. ไฟล์ใน Change Set

### สร้างใหม่

- `docs/04-development/initial-database-schema-implementation-plan.md` — แผนและขอบเขตของ schema
- `apps/api/src/database/migrations/1789236000000-CreateInitialSchema.ts` — TypeORM migration สำหรับสร้างและ rollback schema

### แก้ไข

- `.env.example` — ตัวอย่าง pooled/direct Neon connection variables โดยไม่มี credential จริง
- `apps/api/src/config/database.config.ts` — runtime TypeORM configuration สำหรับ Neon
- `apps/api/src/config/typeorm-cli.config.ts` — migration connection ผ่าน direct URL
- `apps/api/src/config/environment.schema.ts` — startup validation สำหรับ PostgreSQL URL, TLS และ channel binding
- `apps/api/src/config/environment.schema.spec.ts` — configuration tests
- `compose.yaml` — แยก local PostgreSQL เป็น optional test profile
- `package.json` — แยก application infrastructure และ local test database commands
- `docs/04-guides/local-development.md` — Neon setup และ migration workflow
- `docs/04-development/project-development-checklist.md` — บันทึกสถานะ design และ migration verification

TypeORM entities จะสร้างภายหลังในแต่ละ vertical slice เพื่อไม่สร้าง persistence model ที่ยังไม่มี domain behavior รองรับ

## 4. PostgreSQL Extensions

Migration เปิดใช้:

- `citext` สำหรับ case-insensitive login identity
- `btree_gist` สำหรับ exclusion constraint ของช่วงเวลาการถือครอง asset

Migration `down` จะไม่ลบ extensions เพราะอาจมี schema หรือ application อื่นใน database เดียวกันใช้งานอยู่

## 5. Schema Groups และ Creation Order

### 5.1 Identity and Access

1. `users`
2. `roles`
3. `permissions`
4. `user_roles`
5. `role_permissions`
6. `auth_sessions`
7. `auth_refresh_tokens`

`auth_sessions` เพิ่ม `idle_expires_at` จาก ADR-0005 และใช้ `expires_at` เป็น absolute expiration เพื่อให้ session ตรวจ idle timeout และ absolute timeout แยกกันได้

`auth_refresh_tokens.id` เป็น token selector ใน opaque token รูปแบบ `<token-id>.<secret>` และ `token_hash` เก็บ SHA-256 hex digest ของ secret เท่านั้น

### 5.2 Asset Master and History

1. `asset_categories`
2. `locations`
3. `assets`
4. `asset_lifecycle_transitions`
5. `asset_identifiers`
6. `asset_assignments`
7. `asset_movements`

### 5.3 Audit Campaign and Results

1. `audit_campaigns`
2. `audit_campaign_transitions`
3. `audit_campaign_locations`
4. `audit_campaign_auditors`
5. `audit_campaign_assets`
6. `audit_scan_events`
7. `audit_observations`
8. `audit_issues`
9. `audit_issue_transitions`

### 5.4 Cross-cutting Audit

1. `activity_logs`

Rollback ลบตารางย้อนลำดับเพื่อไม่ละเมิด foreign keys

## 6. Critical Database Invariants

### Identity and access

- email, employee code, role code และ permission code ไม่ซ้ำแบบ case-insensitive
- user status จำกัดเป็น `ACTIVE`, `INACTIVE` หรือ `SUSPENDED`
- optimistic-lock versions ต้องมากกว่าศูนย์
- revoked session ต้องมี revoke reason
- session idle/absolute expiry ต้องอยู่หลัง creation time
- refresh-token hash ไม่ซ้ำ
- refresh token มี parent และ replacement ได้ตาม rotation chain โดย replacement ไม่ซ้ำ
- token expiration ต้องอยู่หลัง issue time

### Asset master and history

- category, location และ asset code ไม่ซ้ำแบบ case-insensitive
- category/location/name/code ต้องไม่เป็นข้อความว่าง
- category และ location hierarchy ห้ามชี้ parent เป็นตัวเอง; cycle ที่ยาวกว่าหนึ่งระดับตรวจใน domain transaction
- asset lifecycle, condition, cost/currency และ JSON metadata ต้องอยู่ในรูปแบบที่กำหนด
- identifier token ไม่ซ้ำ และมี active identifier ต่อ asset/type ได้สูงสุดหนึ่งรายการ
- inactive identifier ต้องมี `valid_to` และ revoke reason
- asset มี active assignment ได้สูงสุดหนึ่งรายการ
- assignment intervals ของ asset เดียวกันห้ามซ้อนกัน
- movement แรกต้องเป็น `INITIAL` และไม่มี source location
- movement ที่ไม่ใช่ `INITIAL` ต้องมี source location และ source/destination ต้องต่างกัน

### Audit campaign and results

- campaign period และ state fields ต้องสอดคล้องกัน
- snapshot มี asset เดียวต่อ campaign ได้หนึ่งรายการ
- scan event idempotency ใช้ `(device_id, client_event_id)`
- scan event ที่อ้าง campaign asset ต้องอยู่ใน campaign เดียวกัน
- canonical observation มีหนึ่งรายการต่อ campaign asset
- latest scan ของ observation ต้องเป็น scan ของ campaign asset เดียวกัน
- issue ต้องมี known campaign asset หรือ scan event เป็น context อย่างน้อยหนึ่งค่า
- issue ที่ resolved/closed ต้องมี resolution note, resolver และ resolved time
- open issue ของ campaign asset และ issue type เดียวกันมีได้สูงสุดหนึ่งรายการ

### Activity log

- action และ entity type ต้องไม่ว่าง
- actor type และ outcome จำกัดด้วย allowlist
- JSON before/after/metadata ต้องเป็น object เมื่อมีค่า
- application ไม่มี generic update/delete endpoint สำหรับ activity logs

## 7. Referential Actions

- Master data และ business history ใช้ `RESTRICT` เพื่อป้องกันการลบประวัติ
- Actor references ที่ยอมให้ anonymize ใช้ `SET NULL`
- Junctions ที่เป็น ownership ของ draft/session ใช้ `CASCADE` เฉพาะจุดที่กำหนด
- `auth_sessions` ลบ refresh tokens แบบ `CASCADE` เฉพาะ retention purge
- Self-referencing replacement chains ใช้ `RESTRICT`
- Application ต้อง revoke, disable, cancel หรือ archive ก่อนพิจารณา physical purge

## 8. Index Strategy

Migration ต้องมี index สำหรับ:

- case-insensitive business identifiers
- active user sessions และ session expiry
- refresh-token session timeline และ active expiry
- category/location hierarchy และ active filters
- asset category/location/status/serial/creation filters
- asset lifecycle, identifier, assignment และ movement timelines
- campaign status/date, scope, auditors และ snapshot work queue
- scan idempotency, campaign timeline, resolution และ outcome
- observation lookup
- issue review queue และ open-issue uniqueness
- activity log entity, actor, request และ action timelines

ไม่เพิ่ม trigram index ใน initial migration เพราะต้องตัดสินใจ search behavior และ `pg_trgm` dependency ก่อน

## 9. Migration Design

ใช้ TypeORM `MigrationInterface` แต่ส่ง explicit PostgreSQL SQL ผ่าน `QueryRunner` เพราะ schema นี้ใช้ partial indexes, composite foreign keys, `inet`, `citext`, JSON checks และ GiST exclusion constraint ที่แสดง intent ได้ชัดกว่า TypeORM table abstraction

Migration ต้อง:

1. เปิด extensions แบบ idempotent
2. สร้างตารางตาม dependency order
3. สร้าง named constraints ทุกตัว
4. สร้าง indexes หลัง table/foreign-key structure พร้อม
5. rollback ตารางย้อน dependency order
6. ไม่ seed role, permission หรือ user
7. ไม่สร้าง default UUID เพื่อคง UUIDv7 ownership ที่ application layer

## 10. Verification Plan

เจ้าของโปรเจกต์ต้องเป็นผู้อนุญาตก่อนรันคำสั่งที่แตะ database หรือ test environment ห้ามทดสอบ rollback บน production branch

เมื่อได้รับอนุญาต ให้ตรวจตามลำดับ:

1. สร้าง Neon development/preview branch สำหรับ migration นี้
2. กำหนด pooled และ direct connection strings ใน `.env`
3. รัน migration บน Neon branch ที่ไม่มี application data
4. ตรวจว่าตาราง, constraints และ indexes ถูกสร้างครบ
5. รัน migration revert
6. ตรวจว่าตารางถูกลบครบแต่ extensions ยังคงอยู่
7. รัน migration ซ้ำเพื่อยืนยัน reproducibility
8. เพิ่ม integration tests สำหรับ critical constraints แทนการทดสอบทุก column ซ้ำกับ migration

คำสั่งที่คาดว่าจะใช้:

```bash
pnpm --filter @asset-management/api migration:run
pnpm --filter @asset-management/api migration:revert
pnpm --filter @asset-management/api migration:run
```

## 11. Required Integration Tests

ควรมี integration tests ที่พิสูจน์ behavior ต่อไปนี้:

- case-insensitive duplicate email/asset code ถูกปฏิเสธ
- refresh-token hash และ replacement uniqueness ทำงาน
- refresh token expiry/rotation constraints ทำงาน
- active identifier ต่อ type ซ้ำไม่ได้
- active assignment ซ้ำและ assignment interval overlap ไม่ได้
- invalid movement source/destination ถูกปฏิเสธ
- campaign asset ซ้ำไม่ได้
- scan idempotency และ cross-campaign reference ถูกปฏิเสธ
- observation latest scan ต้องมาจาก campaign asset เดียวกัน
- issue context และ resolution constraints ทำงาน
- open issue ต่อ asset/type ซ้ำไม่ได้

## 12. Rollback and Operational Considerations

- Migration `down` เป็น destructive operation และใช้เฉพาะ local/test หรือ deployment rollback ก่อนมี production data
- Production ที่มีข้อมูลแล้วต้องใช้ forward-fix migration แทนการ revert initial schema
- Long-running index creation ยังไม่เป็นปัญหาสำหรับฐานข้อมูลว่าง; migration ในอนาคตต้องพิจารณา `CREATE INDEX CONCURRENTLY`
- App deployment ต้องรัน migration เป็นขั้นตอนแยกก่อนเปิด application version ที่ต้องใช้ schema ใหม่
- Backup/restore และ retention policy จะกำหนดก่อน production release

## 13. Definition of Done

- [x] Database schema design สอดคล้องกับ MVP Architecture Baseline
- [x] Authentication tables สอดคล้องกับ ADR-0005
- [x] ระบุ table order, constraints, indexes และ referential actions
- [x] สร้าง reversible TypeORM migration
- [x] สร้าง critical database constraint integration test suite
- [x] Migration run ผ่านบน Neon development branch
- [x] Migration revert ผ่าน
- [x] Migration rerun หลัง revert ผ่าน
- [x] Critical database constraint integration tests ผ่าน 6/6
- [x] API tests, typecheck และ production build ผ่าน
- [x] Checklist และผล verification ได้รับการอัปเดต
