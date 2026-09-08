# ADR-0004: Structured Logging with Pino

- Status: Accepted
- Date: 2026-09-08

## Context

Backend ใช้ NestJS และต้องการระบบ logging ที่เป็น structured log เพื่อให้ค้นหา วิเคราะห์ และเชื่อมโยงเหตุการณ์ของแต่ละ HTTP request ได้ง่ายขึ้น

ระบบมี `X-Request-ID`, Global Exception Filter และ health endpoints อยู่แล้ว จึงต้องกำหนดแนวทาง logging กลางที่รองรับ request context, error context และการป้องกันข้อมูลสำคัญรั่วไหลผ่าน log

## Decision

ใช้ Pino ผ่าน `nestjs-pino` เป็นระบบ logging หลักของ Backend

กำหนดแนวทางดังนี้:

- Production แสดง log เป็น JSON
- Development ใช้ `pino-pretty`
- Test environment ปิด log เป็นค่าเริ่มต้น
- ส่ง log ไปยัง standard output เท่านั้น
- สร้าง terminal HTTP log หนึ่งรายการต่อหนึ่ง request
- ใช้ค่า `X-Request-ID` เดิมเป็น request ID หลักตลอด request lifecycle
- ไม่บันทึก request body หรือ response body
- ไม่บันทึก raw query string
- ไม่บันทึก sensitive headers เช่น `authorization`, `cookie` และ `set-cookie`
- ไม่บันทึก database query, connection string หรือ raw exception ที่อาจมีข้อมูลสำคัญ
- ใช้ allowlisted serializers และ explicit redaction
- Domain และ application code ต้องเรียกใช้ NestJS-compatible logger abstraction และไม่ import Pino โดยตรง

### HTTP log levels

- Successful `/health` และ `/health/ready` ไม่สร้าง access log
- Health check ที่ล้มเหลวต้องสร้าง log
- Unknown-route `404` ใช้ระดับ `info`
- `400`, `401`, `403`, `409`, `422` และ `429` ใช้ระดับ `warn`
- `5xx` ใช้ระดับ `error`

## Consequences

### Positive

- Log เป็นโครงสร้างที่ระบบรวบรวม log สามารถค้นหาและวิเคราะห์ได้
- สามารถติดตาม request เดียวกันด้วย `request_id`
- ลดความเสี่ยงที่ secrets หรือข้อมูลส่วนบุคคลจะปรากฏใน log
- รองรับการทำ monitoring และ centralized logging ในอนาคต
- Pino มี overhead ต่ำและเหมาะกับงาน HTTP throughput สูง

### Negative

- ต้องเพิ่ม dependencies และ configuration สำหรับ `nestjs-pino`
- ต้องดูแล redaction rules เมื่อมี headers หรือข้อมูลสำคัญชนิดใหม่
- Developer ต้องใช้รูปแบบ field และ event name ที่กำหนดร่วมกัน
- Pretty logs ใน development อาจแสดงผลต่างจาก JSON logs ใน production

## Alternatives Considered

### NestJS built-in Logger

มี dependency น้อยและใช้งานง่าย แต่ความสามารถด้าน structured logging, request context, serializers และ redaction มีข้อจำกัดมากกว่า

### Winston

รองรับ transports และการปรับแต่งที่หลากหลาย แต่ configuration ซับซ้อนกว่าและยังไม่จำเป็นสำหรับระบบที่ส่ง log ผ่าน standard output เท่านั้น

## Security and Operational Guardrails

- ห้าม log passwords, tokens, API keys, cookies และ authorization headers
- ห้ามส่ง stack trace หรือ raw infrastructure errors ไปยัง HTTP response
- Stack trace ใช้ได้เฉพาะใน server-side error log ที่ผ่าน serializer และ redaction แล้ว
- Production logs ต้องเป็น machine-readable JSON
- การเปลี่ยน logging policy ต้องมี test ครอบคลุมข้อมูลที่ถูกบันทึกและข้อมูลที่ต้องถูกซ่อน

## References

- [NestJS Logger](https://docs.nestjs.com/techniques/logger)
- [nestjs-pino](https://github.com/iamolegga/nestjs-pino)
- [Pino](https://github.com/pinojs/pino)
- [Pino Redaction](https://github.com/pinojs/pino/blob/main/docs/redaction.md)
