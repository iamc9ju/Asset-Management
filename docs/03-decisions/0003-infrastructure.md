# ADR-0003: PostgreSQL, Redis, SeaweedFS and Docker

- Status: Accepted
- Date: 2026-08-28

## Decision

- PostgreSQL เป็น transactional source of truth และ TypeORM ใช้ migrations; production ปิด `synchronize`
- Redis ใช้กับ cache, rate limit และ short-lived coordination เท่านั้น ข้อมูลธุรกิจสำคัญต้อง reconstruct ได้จาก PostgreSQL
- SeaweedFS ให้บริการ object storage ผ่าน S3-compatible endpoint; database เก็บ object key/metadata ไม่เก็บ public URL ถาวร
- Docker Compose ใช้สำหรับ local development; production secrets ต้องมาจาก secret manager ไม่ commit ลง repository

## Consequences

การเขียน database และ object storage ไม่ใช่ transaction เดียวกัน ต้องใช้ staged upload/cleanup job หรือ outbox เมื่อเริ่ม feature เอกสารแนบ

