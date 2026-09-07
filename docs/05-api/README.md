# API Documentation

API base path: `/api/v1`

## Conventions

- ใช้ REST resource nouns และ explicit command endpoint สำหรับ state transition เช่น `/assets/:id/transfer`
- mutation รองรับ request correlation; operation ที่ retry ได้ต้องมี idempotency key
- validation และ authorization ทำที่ backend เสมอ
- error response ใช้ stable machine-readable `code`
- OpenAPI จะ generate จาก NestJS decorators และเก็บ exported artifact ในโฟลเดอร์นี้เมื่อเริ่ม domain API

Health endpoints ที่มีแล้ว:

- `GET /api/v1/health`
- `GET /api/v1/health/ready`

Endpoint catalog และ error model ฉบับ baseline อยู่ใน [MVP Architecture](../02-architecture/mvp-architecture-baseline.md)

