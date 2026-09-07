# Business Modules

เพิ่ม module ตามลำดับ dependency ใน architecture baseline:

1. `auth` และ `iam`
2. `locations` และ `asset-categories`
3. `assets` และ `asset-identifiers`
4. `asset-assignments` และ `asset-movements`
5. `audit-campaigns`, `audit-scans`, `audit-issues`
6. `activity-logs`

ภายในแต่ละ module ใช้ `domain/`, `application/`, `infrastructure/`, `presentation/` เฉพาะเมื่อมีโค้ดจริง และ expose เฉพาะ application API จาก module root

