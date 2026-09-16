# API Documentation

API base path: `/api/v1`

## Conventions

- ใช้ REST resource nouns และ explicit command endpoint สำหรับ state transition เช่น `/assets/:id/transfer`
- mutation รองรับ request correlation; operation ที่ retry ได้ต้องมี idempotency key
- validation และ authorization ทำที่ backend เสมอ
- error response ใช้ stable machine-readable `code`
- OpenAPI generate จาก NestJS decorators โดยใช้ lazy document factory
- OpenAPI endpoints ปิดโดยค่าเริ่มต้นและเปิดผ่าน `OPENAPI_ENABLED`
- Swagger UI เปิดแยกผ่าน `OPENAPI_UI_ENABLED`

## OpenAPI endpoints

เมื่อ `OPENAPI_ENABLED=true`:

- JSON document: `/api/docs/openapi.json`
- Swagger UI: `/api/docs` เมื่อ `OPENAPI_UI_ENABLED=true`

Production deployment ต้องตัดสินใจเปิด OpenAPI อย่างชัดเจน ห้ามอาศัย development default และไม่ควรเปิด Swagger UI หากไม่ได้ใช้ใน operational workflow

## Decorator conventions

- ทุก controller ต้องกำหนด `@ApiTags()`
- ทุก operation ต้องกำหนด `@ApiOperation()` และ success/error responses ที่เป็นไปได้
- DTO properties ที่อยู่ใน request หรือ response contract ต้องกำหนด `@ApiProperty()` หรือ `@ApiPropertyOptional()`
- Protected operation ต้องอ้าง bearer scheme `access-token` ผ่าน constant กลางใน `openapi.config.ts`
- Error responses ต้องใช้ standard error envelope; ห้ามสร้าง schema เฉพาะ endpoint ที่ไม่ตรงกับ runtime response
- OpenAPI operation IDs generate จาก controller, method และ version อย่าง deterministic

โปรเจกต์ยังไม่เปิดใช้ Swagger CLI plugin ดังนั้น schema metadata ต้องประกาศด้วย decorators อย่างชัดเจน การเพิ่ม plugin ในภายหลังต้องตรวจ generated document diff เพื่อป้องกัน contract เปลี่ยนโดยไม่ตั้งใจ

Health endpoints ที่มีแล้ว:

- `GET /api/v1/health`
- `GET /api/v1/health/ready`

Endpoint catalog และ error model ฉบับ baseline อยู่ใน [MVP Architecture](../02-architecture/mvp-architecture-baseline.md)
