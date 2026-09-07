# Database Documentation

PostgreSQL เป็น source of truth และ schema เปลี่ยนผ่าน migration เท่านั้น

```text
apps/api/src/database/
  migrations/       executable TypeORM migrations
  seeds/            idempotent development/bootstrap seed
docs/06-database/
  README.md          database policy and links
  data-dictionary.md (สร้างเมื่อ schema แรกพร้อม)
```

Critical constraints เช่น active assignment หนึ่งรายการ, active identifier ต่อ type และ temporal overlap ต้อง enforce ใน PostgreSQL migration ไม่ใช่ TypeORM decorator อย่างเดียว

Table specification และ constraint baseline อยู่ใน [MVP Architecture](../02-architecture/mvp-architecture-baseline.md)

