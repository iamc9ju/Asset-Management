# Database Documentation

PostgreSQL เป็น source of truth และ schema เปลี่ยนผ่าน migration เท่านั้น

```text
apps/api/src/database/
  bootstrap/        one-time, explicitly invoked provisioning commands
  migrations/       executable TypeORM migrations
  seeds/            idempotent development/bootstrap seed
docs/06-database/
  README.md          database policy and links
  data-dictionary.md (สร้างเมื่อ schema แรกพร้อม)
```

Critical constraints เช่น active assignment หนึ่งรายการ, active identifier ต่อ type และ temporal overlap ต้อง enforce ใน PostgreSQL migration ไม่ใช่ TypeORM decorator อย่างเดียว

Table specification และ constraint baseline อยู่ใน [MVP Architecture](../02-architecture/mvp-architecture-baseline.md)

## Bootstrap administrator

ระบบไม่มี public registration และ permission/role seed จะไม่สร้าง user หรือ default password ผู้ดูแลระบบคนแรกต้องถูกสร้างด้วย command ที่เรียกอย่างชัดเจนหลัง migration และ permission/role seed สำเร็จแล้ว

คุณสมบัติด้านความปลอดภัยของ command:

- รับ email และ display name ผ่าน environment เฉพาะตอนรัน
- รับ password ผ่าน standard input เท่านั้น ไม่รับผ่าน command argument และไม่มี password environment variable
- บังคับ password อย่างน้อย 15 ตัวอักษร สูงสุด 1,024 ตัวอักษร และปฏิเสธ default password ที่รู้จัก
- ใช้ Argon2id policy เดียวกับ login
- สร้าง user, `SYSTEM_ADMIN` assignment และ sanitized activity event ใน transaction เดียว
- ใช้ PostgreSQL advisory transaction lock เพื่อ serialize การ bootstrap พร้อมกัน
- รันซ้ำด้วย normalized email เดิมเป็น no-op และไม่ reset password
- ปฏิเสธการยกระดับ user เดิมและปฏิเสธ admin คนที่สอง; การเพิ่ม admin ภายหลังต้องผ่าน authenticated administrator workflow

ลำดับการรันจาก repository root:

```bash
pnpm --filter @asset-management/api migration:run
pnpm --filter @asset-management/api seed:permissions-and-roles

printf 'Bootstrap administrator password: '
IFS= read -r -s BOOTSTRAP_ADMIN_PASSWORD
printf '\n'
printf '%s' "$BOOTSTRAP_ADMIN_PASSWORD" | \
  BOOTSTRAP_ADMIN_EMAIL='admin@example.com' \
  BOOTSTRAP_ADMIN_DISPLAY_NAME='System Administrator' \
  pnpm --filter @asset-management/api bootstrap:administrator
unset BOOTSTRAP_ADMIN_PASSWORD
```

ผลลัพธ์ `created` หมายถึงสร้างสำเร็จ ส่วน `already_exists` หมายถึง normalized email เดิมเป็น `SYSTEM_ADMIN` อยู่แล้วและไม่มีข้อมูลใดถูกแก้ไข Command จะไม่พิมพ์ password, password hash หรือ email ออกทาง stdout/stderr

หลัง bootstrap สำเร็จควรนำตัวแปร metadata ออกจาก persistent environment ที่ไม่จำเป็น แม้ตัวแปรดังกล่าวจะไม่ใช่ secret และห้ามนำ command นี้ไปรันอัตโนมัติระหว่าง API startup หรือ deployment ทุกครั้ง
