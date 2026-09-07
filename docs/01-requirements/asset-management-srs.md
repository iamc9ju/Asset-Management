เอกสารนี้เป็น **Software Requirement Specification (SRS) ระดับใกล้เคียงระบบองค์กรจริง** ไม่ใช่เพียงโจทย์ Portfolio โดยใช้แนวคิด Asset Lifecycle และ Asset Management ตาม ISO 55000/55001 เป็นกรอบอ้างอิง แต่ไม่ได้หมายความว่าระบบนี้จะ “ได้รับการรับรอง ISO” โดยอัตโนมัติ แนวคิดหลักของมาตรฐานเน้นการสร้างคุณค่าจากทรัพย์สินตลอดวงจรชีวิต การบริหารความเสี่ยง การตัดสินใจ และการปรับปรุงอย่างต่อเนื่อง

# Asset Management & Asset Audit System — Requirement Specification

## 1. Product Vision

ระบบต้องเป็น **ศูนย์กลางข้อมูลทรัพย์สินขององค์กร (Centralized Asset Management System)** ที่ตอบคำถามสำคัญได้ทันทีว่า

> “องค์กรมีทรัพย์สินอะไรบ้าง อยู่ที่ไหน อยู่กับใคร อยู่ในสภาพอะไร เคยย้ายไปไหน เคยซ่อมอะไร และในการตรวจนับครั้งล่าสุดพบของจริงหรือไม่”

ระบบจะครอบคลุมวงจรชีวิตโดยประมาณ:

```text
Procurement / Acquisition
          ↓
Asset Registration
          ↓
Label / Barcode
          ↓
Assignment
          ↓
Usage
          ↓
Transfer / Movement
          ↓
Maintenance / Repair
          ↓
Periodic Audit
          ↓
Return
          ↓
Retirement / Disposal
```

แนวทาง lifecycle นี้สอดคล้องกับหลัก Asset Management ที่พิจารณาทรัพย์สินตลอดอายุการใช้งาน ไม่ใช่เพียงทะเบียนรายการทรัพย์สิน

---

# 2. Business Objectives

เป้าหมายทางธุรกิจของระบบมี 8 ข้อหลัก

1. มี **Single Source of Truth** ของ Asset ทั้งองค์กร
2. ลดเวลาตรวจนับทรัพย์สิน
3. ลดความผิดพลาดจาก Excel/เอกสาร
4. รู้ผู้รับผิดชอบ Asset แต่ละชิ้น
5. ตรวจย้อนหลังได้ว่าใครทำอะไรกับ Asset
6. ลด Asset สูญหายหรืออยู่ผิดตำแหน่ง
7. มีข้อมูลสำหรับการตัดสินใจซื้อ/ซ่อม/เปลี่ยน/จำหน่าย
8. รองรับการขยายไป Barcode, QR Code และ RFID ในอนาคต

---

# 3. User Roles

ผมแนะนำ 6 Role

| Role | หน้าที่ |
|---|---|
| Super Admin | ตั้งค่าระบบทั้งหมด |
| Asset Admin | จัดการ Asset |
| Asset Manager | ดูแล Assignment / Transfer / Disposal |
| Auditor | ตรวจนับทรัพย์สิน |
| Employee | ดู Asset ที่ตนถือครอง |
| Viewer | ดู Report/Dashboard อย่างเดียว |

และต้องใช้ **RBAC — Role-Based Access Control**

ตัวอย่าง:

```text
Employee
GET own assets       ✓
GET all assets       ✕
CREATE asset         ✕
DELETE asset         ✕

Auditor
GET assets           ✓
SCAN asset           ✓
AUDIT asset          ✓
DELETE asset         ✕

Asset Admin
CREATE asset         ✓
UPDATE asset         ✓
TRANSFER asset       ✓
DISPOSE asset        ✓
```

Backend ต้องตรวจ Permission เสมอ ห้ามพึ่งการซ่อนปุ่มบน Frontend อย่างเดียว

---

# 4. Organization Structure Module

ก่อนมี Asset ระบบต้องรู้โครงสร้างองค์กร

```text
Organization
   │
   ├── Branch
   │
   ├── Department
   │
   └── Location
          │
          ├── Building
          │     └── Floor
          │           └── Room
```

ตัวอย่าง:

```text
ABC Company

Bangkok Branch
 └── Building A
      └── Floor 5
           ├── Meeting Room
           └── IT Office
```

## Requirement

ระบบต้องสามารถ

- เพิ่ม/แก้ไข/ปิดใช้งาน Organization
- เพิ่ม Branch
- เพิ่ม Department
- เพิ่ม Location
- รองรับ Location แบบ Parent/Child
- ค้นหา Location
- ระบุ Location ปัจจุบันของ Asset
- กำหนด Location Expected สำหรับ Audit

Location ไม่ควรถูก hard delete ถ้ามี Asset อ้างอิงอยู่

---

# 5. User Management

แต่ละ User ควรประกอบด้วย

```text
User
- id
- employee_code
- first_name
- last_name
- email
- phone
- department_id
- branch_id
- position
- role
- status
- created_at
- updated_at
```

Status:

```text
ACTIVE
INACTIVE
SUSPENDED
RESIGNED
```

ระบบควรมี:

- User List
- Search
- Filter Department
- Filter Status
- Create User
- Edit User
- Disable User
- Reset Password
- Assign Role

ในอนาคตจึงค่อยต่อ LDAP / Active Directory / SSO

---

# 6. Authentication

Version แรก:

```text
Email + Password
       ↓
Backend
       ↓
Access Token
Refresh Token
```

Requirement:

- Login
- Logout
- Refresh Token
- Forgot Password
- Change Password
- Revoke Session
- Login history

Password ไม่เก็บ plain text

ต้อง hash เช่น Argon2id หรือ bcrypt

---

# 7. Asset Category

เพื่อไม่ให้ข้อมูล Asset มั่ว ต้องมี Category

ตัวอย่าง:

```text
IT Equipment
 ├── Notebook
 ├── Desktop
 ├── Monitor
 ├── Keyboard
 ├── Mouse
 └── Router

Office Equipment
 ├── Desk
 ├── Chair
 └── Printer
```

Category ต้องสามารถกำหนด Custom Field ได้ในอนาคต เช่น Notebook ต้องมี

```text
CPU
RAM
Storage
OS
```

ขณะที่ Vehicle อาจมี

```text
Registration Number
Engine Number
Mileage
```

---

# 8. Asset Master

นี่คือหัวใจของระบบ

Asset แต่ละชิ้นต้องมี Unique ID ภายใน DB และ Human-readable Asset Code

ตัวอย่าง:

```text
UUID:
550e8400-e29b-41d4-a716-446655440000

Asset Code:
IT-NB-000001
```

## Required fields

```text
asset_code
name
category
status
location
```

## Optional fields

```text
serial_number
manufacturer
brand
model
purchase_date
purchase_price
currency
supplier
warranty_start
warranty_end
description
picture
```

Asset Detail Page ควรแสดงทุกอย่างรวมกัน

```text
MacBook Air M2
────────────────────
Asset Code: IT-NB-000001
Serial: FVFG123456
Category: Notebook

Status: IN_USE

Owner
Ittipol B.

Location
Building A / Floor 2 / Room 201

Purchased
15 Jan 2025

Warranty
Until 15 Jan 2028
```

---

# 9. Asset Status

ควรใช้ State ที่ชัดเจน

```text
AVAILABLE
IN_USE
RESERVED
UNDER_MAINTENANCE
DAMAGED
LOST
RETIRED
DISPOSED
```

ห้ามให้ Frontend ส่งข้อความ status อะไรก็ได้

ใช้ Enum/Domain Constant

---

# 10. Asset Lifecycle

ระบบต้องเก็บ **Lifecycle History**

ตัวอย่าง:

```text
2026-01-05 REGISTERED
2026-01-06 ASSIGNED
2026-03-15 TRANSFERRED
2026-06-01 MAINTENANCE
2026-06-03 RETURNED
2026-08-24 AUDITED
```

History ห้ามแก้ไขย้อนหลังโดย User ปกติ

---

# 11. Barcode / QR Code

ทุก Asset ต้องสามารถ Generate Label ได้

ผมแนะนำช่วงแรกใช้ **Code 128 Barcode + QR Code**

Barcode:

```text
IT-NB-000001
```

QR อาจ encode:

```text
https://asset.example.com/a/IT-NB-000001
```

หรือ Asset ID

แต่ไม่ควรใส่ข้อมูลสำคัญทั้งหมดลง QR เพราะข้อมูลอาจเปลี่ยนภายหลัง

Label:

```text
┌───────────────────────────┐
│       COMPANY ASSET       │
│                           │
│        MacBook Air        │
│                           │
│  || ||| ||||| || |||      │
│                           │
│       IT-NB-000001        │
│                           │
│          [ QR ]           │
└───────────────────────────┘
```

ระบบต้องรองรับ:

- Generate Barcode
- Generate QR
- Preview Label
- Print Single Label
- Batch Print
- Download PDF labels

---

# 12. Asset Assignment

Asset สามารถถูกมอบหมายให้ Employee ได้

ตัวอย่าง

```text
MacBook Air
     ↓
Assigned To
     ↓
Employee A
```

Assignment ต้องมี

```text
asset_id
assigned_to
assigned_by
assigned_at
expected_return_at
note
status
```

และเก็บ History

```text
Jan 2026 → Somchai
Mar 2026 → Suda
Aug 2026 → Ittipol
```

Asset หนึ่งชิ้นมี Active Assignment ได้สูงสุดหนึ่งรายการ

---

# 13. Asset Transfer

การย้าย Asset ต้องแยกออกจากการ Edit Location ธรรมดา

Wrong:

```text
PUT asset
location = Room B
```

Correct:

```text
Create Transfer
Room A
  ↓
Room B
```

ข้อมูล:

```text
asset_id
from_location
to_location
requested_by
approved_by
transferred_by
transfer_date
reason
note
```

Workflow:

```text
REQUESTED
   ↓
APPROVED
   ↓
COMPLETED
```

หรือ

```text
REJECTED
CANCELLED
```

เมื่อ `COMPLETED` เท่านั้นจึง update Current Location

---

# 14. Asset Check-in / Check-out

ตัวอย่างพนักงานยืม Projector

```text
AVAILABLE
    ↓
CHECK OUT
    ↓
IN_USE
    ↓
CHECK IN
    ↓
AVAILABLE
```

เก็บ

```text
checked_out_by
checked_out_to
checked_out_at
expected_return_at

checked_in_by
checked_in_at
```

ถ้าเลยวันคืน:

```text
OVERDUE
```

Dashboard ควรแจ้งเตือน

---

# 15. Asset Audit Campaign

นี่คือ Feature สำคัญที่สุดของโปรเจกต์นี้

Asset Admin สร้าง

```text
2026 Annual Asset Audit
```

กำหนด

```text
Start Date
End Date
Branch
Department
Location
Asset Categories
Auditors
```

ระบบ Snapshot รายการ Asset ที่ต้องตรวจ ณ ตอนสร้าง Campaign

เช่น

```text
Audit Campaign

Total Assets: 1,000

Pending       1000
Found            0
Missing          0
Mismatch         0
```

---

# 16. Mobile Audit

Auditor เปิด Web ผ่านโทรศัพท์

```text
Login

↓

Audit Campaign

↓

Select Location

Building A
Floor 5
Room 501

↓

Start Audit

↓

Camera Scanner
```

หลัง Scan:

```text
[ Scan ]

IT-NB-000123

MacBook Pro M4

Expected Location
Room 501

Current Audit Location
Room 501

✓ MATCH

[Confirm Found]
```

Backend บันทึกทันที

```text
asset
auditor
time
location
audit campaign
result
```

---

# 17. Audit Result

ผลตรวจอย่างน้อยต้องมี

```text
FOUND
NOT_FOUND
WRONG_LOCATION
DAMAGED
UNREGISTERED
DUPLICATE_SCAN
```

กรณี UNKNOWN barcode:

```text
Scan
   ↓
ABC-00099
   ↓
Asset Not Found
   ↓
UNREGISTERED ASSET
```

Auditor สามารถ

```text
Take Photo
Add Note
Report Issue
```

---

# 18. Duplicate Scan Protection

สมมติ Asset เดียวถูก scan สองครั้ง

ระบบต้องไม่เพิ่ม Found Count เป็น 2

```text
IT-NB-000001

Already scanned

Last scan:
24 Aug 2026 14:31

Auditor:
User A
```

สามารถอนุญาต Re-scan ได้ แต่ต้องสร้าง Scan Log

---

# 19. Audit Completion

เมื่อ Audit จบ

```text
Total Assets       1000

Found               965
Wrong Location       10
Damaged               5
Not Found            20
```

Completion:

```text
980 / 1000 = 98%
```

Asset ที่ไม่เคย Scan ใน Campaign → `NOT_FOUND` หลัง Finalize

อย่า mark Missing ทันทีตั้งแต่ Campaign เริ่ม

---

# 20. Audit Approval

เพื่อใกล้ระบบ Enterprise ให้มี

```text
Auditor
   ↓
Submit Audit
   ↓
Asset Manager
   ↓
Review
   ↓
Approve
```

Status:

```text
DRAFT
IN_PROGRESS
SUBMITTED
APPROVED
CLOSED
```

เมื่อ Closed แล้วห้ามแก้ Result โดยตรง

---

# 21. Audit Issue

ความผิดปกติควรถูกสร้างเป็น Issue

เช่น

```text
Asset:
IT-NB-0004

Issue:
Wrong Location

Expected:
Building A

Found:
Building C
```

Issue status:

```text
OPEN
INVESTIGATING
RESOLVED
CLOSED
```

และต้องระบุ

```text
assigned_to
resolution_note
resolved_at
```

---

# 22. Maintenance Module

Asset สามารถแจ้งซ่อม

```text
User
 ↓
Report Problem
 ↓
Maintenance Ticket
```

Ticket:

```text
ticket_no
asset_id
reported_by
problem
priority
status
technician
cost
start_date
complete_date
```

Status:

```text
OPEN
ASSIGNED
IN_PROGRESS
WAITING_PART
COMPLETED
CANCELLED
```

---

# 23. Maintenance History

หน้า Asset ต้องเห็น

```text
Repair #001
Keyboard failure
฿3,500

Repair #002
Battery replacement
฿5,000
```

ทำให้ตอบได้ว่า

> Laptop ฿35,000 เครื่องนี้ซ่อมไปแล้ว ฿20,000 สมควรเปลี่ยนใหม่หรือไม่

นี่เป็นหนึ่งในจุดที่ระบบเริ่มช่วยการตัดสินใจเชิง Asset Lifecycle ตามแนวคิด ISO 55000 ได้จริง

---

# 24. Warranty Management

ระบบควรเก็บ

```text
warranty_start
warranty_end
warranty_provider
warranty_document
```

Dashboard:

```text
Warranty Expiring

Next 30 days     12 assets
Next 60 days     25 assets
Next 90 days     41 assets
```

---

# 25. Disposal / Retirement

ห้าม Delete Asset ที่เคยใช้งานจริง

ใช้ Lifecycle:

```text
IN_USE
 ↓
RETIRED
 ↓
DISPOSED
```

Disposal ต้องเก็บ

```text
reason
method
approved_by
disposed_by
disposed_at
sale_price
document
```

เช่น

```text
Method:
SOLD
DONATED
DESTROYED
RECYCLED
RETURNED_TO_VENDOR
```

หลัง disposed:

```text
Asset record remains
Audit history remains
Assignment history remains
```

---

# 26. Asset Documents

Asset สามารถมี Attachment

เช่น

- Invoice
- Purchase order
- Warranty
- Photo
- Repair receipt
- Disposal certificate

File metadata:

```text
filename
content_type
size
storage_key
uploaded_by
uploaded_at
```

ไฟล์จริงไม่ควรเก็บเป็น binary ใน PostgreSQL

ใช้ Object Storage เช่น S3-compatible Storage

---

# 27. Notifications

Notification Center

เหตุการณ์เช่น

```text
Asset overdue
Warranty expiring
Audit assigned
Audit deadline
Transfer requested
Transfer approved
Maintenance completed
Asset missing
```

Version แรกทำ In-app ก่อน

อนาคต:

```text
Email
LINE
Microsoft Teams
Slack
Push notification
```

---

# 28. Dashboard

Executive Dashboard:

```text
Total Assets
12,482

Total Asset Value
฿82.4M

In Use
9,820

Available
1,210

Maintenance
320

Missing
14

Disposed
1,118
```

Charts:

```text
Assets by Category
Assets by Department
Assets by Location
Assets by Status
Asset Value by Department
Asset Age
Maintenance Cost
Audit Compliance
```

---

# 29. Search

Asset หลักหมื่น/แสนชิ้นต้องค้นเร็ว

Search by:

```text
Asset Code
Name
Serial Number
Employee
Department
Location
Category
Barcode
```

และ Filter:

```text
Status
Category
Location
Department
Assigned User
Purchase Date
Warranty
```

รองรับ Sorting + Pagination

```http
GET /assets?page=1&limit=50
```

ห้ามโหลด Asset ทั้งหมดขึ้น Browser

---

# 30. Import / Export

ระบบองค์กรต้อง Import ข้อมูลเดิมได้

รองรับ CSV/XLSX:

```text
Asset Code
Name
Serial
Category
Location
Employee
Status
```

Import Flow:

```text
Upload
 ↓
Validation
 ↓
Preview
 ↓
Errors
 ↓
Confirm Import
```

ต้องไม่ insert ครึ่งไฟล์แบบไม่รู้ว่าอะไรเสีย

สร้าง Import Job

```text
SUCCESS 980
FAILED   20
```

พร้อม Error Report

Export:

```text
CSV
Excel
PDF
```

---

# 31. Bulk Operations

ผู้ใช้ต้องสามารถเลือกหลาย Asset แล้ว

```text
Change Category
Change Location
Assign
Generate Labels
Export
Create Audit
```

แต่ operation สำคัญควร confirmation

---

# 32. Audit Trail

ทุกการเปลี่ยนแปลงที่สำคัญต้องตรวจย้อนหลังได้

ตัวอย่าง:

```text
24 Aug 2026 15:31

User:
admin@example.com

Action:
TRANSFER_ASSET

Asset:
IT-NB-0012

Before:
Room 101

After:
Room 204

IP:
192.168.x.x
```

Audit Log ควร append-only สำหรับ User ทั่วไป

Action ตัวอย่าง:

```text
LOGIN
CREATE_ASSET
UPDATE_ASSET
ASSIGN_ASSET
TRANSFER_ASSET
SCAN_ASSET
CREATE_AUDIT
CLOSE_AUDIT
DISPOSE_ASSET
```

---

# 33. Activity Timeline

Asset Detail ควรแสดง Timeline

```text
24 AUG
✓ Audited
Room A

18 JUL
→ Transferred
Room B → Room A

01 JUN
🔧 Maintenance completed

16 JAN
👤 Assigned to Somchai

15 JAN
＋ Asset registered
```

---

# 34. Comment / Note

ผู้ใช้สามารถเพิ่ม Note ต่อ Asset ได้

เช่น

```text
"พบรอยแตกที่มุมเครื่อง"
```

แต่ Note ต้องเก็บ

```text
created_by
created_at
```

ห้ามแก้ว่าเป็น Note ของคนอื่น

---

# 35. Approval Engine

Operation เสี่ยง เช่น

```text
Dispose
Transfer
Write-off
High-cost Maintenance
```

สามารถมี Approval

```text
Requester
 ↓
Manager
 ↓
Asset Manager
 ↓
Approved
```

Version MVP อาจเริ่ม 1 level

แต่ Database ควรออกแบบให้ขยายได้

---

# 36. Reports

รายงานควรมีอย่างน้อย

**Asset Register**

```text
รายการ Asset ทั้งหมด
```

**Asset by Location**

```text
แต่ละห้องมีอะไรบ้าง
```

**Asset by Employee**

```text
Employee แต่ละคนถืออะไร
```

**Asset Movement**

```text
ประวัติการย้าย
```

**Asset Audit**

```text
ผลตรวจนับ
```

**Missing Assets**

```text
Asset ที่หาไม่พบ
```

**Maintenance Cost**

```text
ค่าใช้จ่ายซ่อม
```

**Asset Disposal**

```text
Asset ที่จำหน่ายแล้ว
```

---

# 37. Business Rules สำคัญมาก

นี่คือส่วนที่ทำให้ระบบต่างจาก CRUD

### BR-001

`asset_code` ต้อง Unique

### BR-002

Asset `DISPOSED` ห้าม Assign

### BR-003

Asset `DISPOSED` ห้าม Transfer

### BR-004

Asset มี Active Assignment ได้สูงสุดหนึ่งคน

### BR-005

Asset ที่ `UNDER_MAINTENANCE` ห้าม Check-out

### BR-006

Asset Movement ทุกครั้งต้องมี History

### BR-007

Audit Scan ต้องสัมพันธ์กับ Campaign

### BR-008

Asset เดียว Scan ซ้ำใน Audit เดิมต้องไม่เพิ่ม Found Count

### BR-009

Audit `CLOSED` ห้ามแก้ Result

### BR-010

Hard Delete Asset ที่มี transaction/history แล้วไม่ได้

### BR-011

ทุก operation สำคัญต้องสร้าง Audit Log

---

# 38. Concurrency

สมมติ Auditor 2 คน scan Asset เดียวกันพร้อมกัน

```text
Auditor A ─────► API
                    │
Asset ABC           │
                    │
Auditor B ─────► API
```

Backend ต้องป้องกัน Race Condition

เช่น unique constraint:

```text
UNIQUE (
 audit_campaign_id,
 asset_id
)
```

ไม่ใช่เช็กด้วย Frontend

---

# 39. Offline Mode

อันนี้เก็บไว้ Phase 2

เพราะ Mobile Audit อาจอยู่ Warehouse ที่ Wi-Fi แย่

```text
Scan

Internet ✕
    ↓
IndexedDB
    ↓
Pending Sync
    ↓
Internet returns
    ↓
Sync API
```

แต่ต้องแก้ปัญหา

```text
Duplicate
Conflict
Deleted Campaign
Changed Asset Location
Expired Session
```

ดังนั้น MVP อย่าเพิ่งทำ

---

# 40. API Design

ตัวอย่าง Resources

```text
/auth
/users
/roles
/organizations
/branches
/departments
/locations

/assets
/asset-categories
/asset-assignments
/asset-transfers
/asset-maintenance
/asset-documents

/audits
/audit-items
/audit-scans
/audit-issues

/reports
/notifications
/activity-logs
```

ตัวอย่าง:

```http
POST /api/v1/assets

GET /api/v1/assets
GET /api/v1/assets/:id
PATCH /api/v1/assets/:id

POST /api/v1/assets/:id/assignments
POST /api/v1/assets/:id/transfers
POST /api/v1/assets/:id/maintenance
POST /api/v1/assets/:id/disposal
```

อย่าทำแบบ

```http
POST /updateAssetLocation
POST /changeAssetUser
POST /deleteAssetData
```

---

# 41. API Response

กำหนดมาตรฐานเดียวกัน

Success:

```json
{
  "data": {
    "id": "uuid",
    "asset_code": "IT-NB-000001"
  }
}
```

Pagination:

```json
{
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 1520,
    "total_pages": 76
  }
}
```

Error:

```json
{
  "error": {
    "code": "ASSET_NOT_FOUND",
    "message": "Asset not found"
  }
}
```

---

# 42. Database Scope

ถ้าทำทั้งหมดจริง Database อาจมีประมาณนี้

```text
users
roles
permissions
user_roles
role_permissions

organizations
branches
departments
locations

asset_categories
assets
asset_attributes
asset_attribute_values

asset_assignments
asset_transfers
asset_movements
asset_documents

maintenance_tickets
maintenance_logs

audit_campaigns
audit_campaign_assets
audit_scans
audit_issues

disposals

notifications
activity_logs

refresh_tokens
```

ประมาณ **20–30 tables ถือว่าปกติมาก** สำหรับระบบระดับนี้

---

# 43. Recommended Architecture

สำหรับโปรเจกต์เตรียมฝึกงาน ผมไม่แนะนำ Microservices

ใช้ **Modular Monolith**

```text
                 Next.js
                    │
                    ▼
             REST API / Go
                    │
         ┌──────────┼───────────┐
         │          │           │
        Auth       Asset       Audit
         │          │           │
         └──────────┼───────────┘
                    │
                 Service
                    │
                 Domain
                    │
              Repository
                    │
              PostgreSQL
```

Deploy ง่ายกว่า Debug ง่ายกว่า และยังออกแบบ boundaries แบบดี ๆ ได้

---

# 44. Backend Non-functional Requirements

ระบบควรตั้ง Target เช่น

```text
GET Asset Detail
P95 < 300 ms

Search
P95 < 500 ms

Audit Scan API
P95 < 500 ms

Availability
≥ 99.5%
```

สำหรับ Portfolio ไม่ต้องพิสูจน์ SLA จริง แต่ใช้เป็น Engineering Target

---

# 45. Database Performance

Index ควรมีอย่างน้อย

```text
assets.asset_code
assets.serial_number
assets.category_id
assets.location_id
assets.assigned_user_id
assets.status

audit_scans.audit_id
audit_scans.asset_id

activity_logs.entity_id
activity_logs.created_at
```

และ Search ที่ใหญ่ขึ้นค่อยพิจารณา Full-text Search

---

# 46. Security Requirements

ต้องมี

- HTTPS
- Password hashing
- JWT expiration
- Refresh token rotation/revocation
- RBAC
- Input validation
- Rate limiting
- CORS policy
- Secure headers
- File validation
- SQL injection protection
- XSS protection
- Audit logs
- Environment secrets

และห้าม log

```text
Password
Access Token
Refresh Token
Sensitive secret
```

---

# 47. File Security

Upload ต้องจำกัด

```text
allowed MIME type
max file size
filename sanitization
```

ไม่ใช้ filename ที่ User ส่งมาเป็น Storage path โดยตรง

---

# 48. Testing Requirements

### Unit Test

ทดสอบ Business Rule

```text
Cannot assign disposed asset
Cannot scan closed audit
Cannot transfer asset under invalid conditions
```

### Integration Test

```text
API → PostgreSQL
```

### API Test

```text
POST /assets
GET /assets/:id
```

### E2E Test

```text
Login
 ↓
Create Asset
 ↓
Generate Barcode
 ↓
Create Audit
 ↓
Scan
 ↓
Finalize
```

นี่ควรเป็น Happy Path หลักของโปรเจกต์

---

# 49. CI/CD

Pipeline:

```text
Developer
 ↓
Pull Request
 ↓
Lint
 ↓
Unit Test
 ↓
Integration Test
 ↓
Build
 ↓
Docker Image
 ↓
Deploy Staging
 ↓
Smoke Test
 ↓
Production
```

---

# 50. Logging & Monitoring

Backend Log แบบ Structured

```json
{
  "level": "info",
  "request_id": "abc123",
  "method": "POST",
  "path": "/api/v1/audits/123/scans",
  "status": 201,
  "duration_ms": 84,
  "user_id": "uuid",
  "timestamp": "2026-08-24T14:31:00Z"
}
```

ระบบควรเก็บและติดตามอย่างน้อย

```text
Application errors
HTTP error rate
API latency
Database connection usage
Slow queries
CPU / Memory
Disk usage
Audit scan throughput
Failed background jobs
```

ทุก Request ควรมี `request_id` เพื่อให้ค้นหาเหตุการณ์เดียวกันข้าม Frontend, Backend และ Infrastructure ได้

Alert ขั้นต้น:

```text
Error rate สูงผิดปกติ
API latency เกิน Target
Database เชื่อมต่อไม่ได้
Disk ใกล้เต็ม
Backup ล้มเหลว
Production unavailable
```

---

# 51. Error Handling

Frontend ต้องแสดงข้อความที่ผู้ใช้เข้าใจได้ และ Backend ต้องส่ง Error Code ที่คงที่

ตัวอย่าง:

```json
{
  "error": {
    "code": "AUDIT_ALREADY_CLOSED",
    "message": "This audit campaign is already closed."
  }
}
```

ระบบต้องแยกประเภท Error อย่างน้อย

```text
Validation Error
Authentication Error
Permission Error
Business Rule Error
Resource Not Found
Conflict
Rate Limit
Internal Server Error
```

ห้ามส่ง Stack Trace, SQL Error หรือข้อมูลภายในระบบไปยังผู้ใช้

---

# 52. Backup & Recovery

Production Database ต้องมี Backup ตามรอบเวลา

ตัวอย่าง Target:

```text
Daily full backup
Point-in-time recovery
Backup retention: 30 days
RPO: ≤ 24 hours
RTO: ≤ 4 hours
```

สำหรับ Portfolio สามารถเริ่มจาก Daily Backup และทดสอบ Restore จริงอย่างน้อยหนึ่งครั้ง

Backup ที่ไม่เคยทดลอง Restore ยังถือว่าเชื่อถือไม่ได้

---

# 53. Data Retention

ข้อมูลต่อไปนี้ไม่ควรถูกลบโดยไม่มีนโยบายรองรับ

```text
Asset master
Assignment history
Movement history
Audit results
Maintenance history
Disposal records
Approval records
Activity logs
```

ข้อมูลที่หมดอายุควรถูก Archive หรือ Anonymize ตามนโยบายองค์กร แทนการ Hard Delete โดยตรง

---

# 54. UI / UX Requirements

หน้าจอต้องออกแบบให้ผู้ใช้ทำงานประจำได้เร็ว

หลักสำคัญ:

- Responsive สำหรับ Desktop, Tablet และ Mobile
- ตารางต้องมี Search, Filter, Sort และ Pagination
- Form ต้องแสดง Validation ใกล้ Field ที่ผิด
- Operation สำคัญต้องมี Confirmation
- Status ใช้สีและข้อความร่วมกัน ห้ามพึ่งสีอย่างเดียว
- Loading, Empty State และ Error State ต้องชัดเจน
- รายการยาวต้องไม่ทำให้ Browser ค้าง
- ปุ่ม Scan บนมือถือควรกดง่ายและอยู่ในตำแหน่งที่เข้าถึงสะดวก

---

# 55. Mobile Audit UX

Mobile Audit ควรลดจำนวนขั้นตอนให้เหลือน้อยที่สุด

```text
เลือก Campaign
      ↓
เลือก Location
      ↓
เปิด Scanner
      ↓
Scan
      ↓
แสดง Asset + Result
      ↓
Confirm / Add Issue
      ↓
พร้อม Scan ชิ้นถัดไป
```

หน้าจอ Scan ต้องแสดง

```text
Asset Code
Asset Name
Expected Location
Current Audit Location
Current Result
Last Scan
Auditor
Photo / Note
```

เมื่อ Scan สำเร็จควรมี Feedback ที่สังเกตได้ทันที เช่น สี เสียง หรือการสั่น โดยผู้ใช้สามารถปิดได้

---

# 56. Accessibility

ระบบควรรองรับอย่างน้อย

- Keyboard navigation
- Label สำหรับ Form control
- Focus state ที่มองเห็นได้
- Contrast ที่อ่านได้
- ข้อความอธิบาย Error
- ไม่ใช้สีเป็นตัวสื่อความหมายเพียงอย่างเดียว
- รองรับการขยายตัวอักษรบนมือถือ

---

# 57. MVP Scope

MVP สำหรับระยะเวลา 2 เดือนควรเน้น Workflow ที่สาธิตได้ครบตั้งแต่ต้นจนจบ

## In Scope

| Module | MVP Requirement |
|---|---|
| Authentication | Login, Logout, Access Token, Refresh Token |
| RBAC | Super Admin, Asset Admin, Auditor, Employee, Viewer |
| Organization | Department และ Location แบบ Parent/Child |
| Asset Category | Create, Edit, Disable |
| Asset Master | Create, View, Update, Search, Filter |
| Asset Status | AVAILABLE, IN_USE, UNDER_MAINTENANCE, DAMAGED, LOST, RETIRED, DISPOSED |
| Barcode / QR | Generate, Preview, Print และ PDF Label |
| Assignment | Assign, Return และดู History |
| Transfer | บันทึกการย้ายและ Movement History |
| Audit Campaign | Create, Scope, Assign Auditor, Start, Submit, Close |
| Mobile Audit | Scan, Confirm Found, Wrong Location, Damaged, Unknown Barcode |
| Duplicate Protection | Asset เดียวไม่เพิ่ม Count ซ้ำใน Campaign เดิม |
| Audit Result | Dashboard, Progress, Found, Not Found, Mismatch |
| Audit Issue | Create Issue, Assign, Resolve |
| Audit Trail | Log Operation สำคัญ |
| Dashboard | Asset summary และ Audit summary |
| Deployment | Docker, CI/CD, Staging หรือ Production Demo |
| Testing | Unit, Integration และ E2E Happy Path |

## MVP Success Criteria

MVP ถือว่าสำเร็จเมื่อสามารถทำ Flow นี้ได้จริง

```text
Create User
   ↓
Create Location / Category
   ↓
Register Asset
   ↓
Generate & Print Barcode
   ↓
Assign Asset
   ↓
Create Audit Campaign
   ↓
Scan ด้วยโทรศัพท์
   ↓
Detect Match / Wrong Location / Duplicate
   ↓
Finalize Audit
   ↓
View Dashboard and History
```

---

# 58. Out of MVP / Phase 2

Feature ต่อไปนี้มีคุณค่า แต่ไม่ควรบังคับให้เสร็จใน MVP

- Offline Sync
- RFID Integration
- LDAP / Active Directory / SSO
- Multi-level Approval Engine
- Advanced Custom Fields
- Email / LINE / Teams / Slack Notification
- Predictive Maintenance
- Depreciation Accounting
- ERP / SAP / HR Integration
- Native iOS / Android Application
- Full-text Search Engine แยก
- Multi-tenant SaaS
- Advanced Analytics และ BI
- Electronic Signature

หลักคือทำ Core Workflow ให้แข็งแรงก่อน แล้วค่อยเพิ่ม Integration และ Automation

---

# 59. Suggested Screens

## Desktop

```text
Login
Dashboard
Asset List
Asset Detail
Create / Edit Asset
Category Management
Location Management
User Management
Assignment
Transfer
Maintenance
Audit Campaign List
Audit Campaign Detail
Audit Results
Audit Issues
Reports
Activity Logs
Settings
```

## Mobile

```text
Login
My Audit Campaigns
Select Location
Scanner
Scan Result
Add Photo / Note
Audit Progress
Submit Audit
```

ไม่จำเป็นต้องสร้าง Native Mobile App ใน MVP ใช้ Responsive Web หรือ PWA ที่เปิดผ่าน Browser บนมือถือและเข้าถึงกล้องได้ก่อน

---

# 60. Frontend Architecture

แนะนำแยก Frontend ตาม Feature

```text
src/
 ├── app/
 ├── features/
 │    ├── auth/
 │    ├── assets/
 │    ├── assignments/
 │    ├── transfers/
 │    ├── audits/
 │    └── reports/
 ├── components/
 ├── services/
 ├── hooks/
 ├── types/
 └── utils/
```

Frontend ไม่ควรเก็บ Business Rule สำคัญเป็นแหล่งตัดสินเพียงที่เดียว เพราะทุก Rule ต้องถูกตรวจซ้ำที่ Backend

---

# 61. Deployment Architecture

Architecture สำหรับ MVP:

```text
                         Internet
                            │
                          HTTPS
                            │
                    ┌───────▼────────┐
                    │ Reverse Proxy  │
                    └───────┬────────┘
                            │
             ┌──────────────┴──────────────┐
             │                             │
     ┌───────▼────────┐           ┌────────▼───────┐
     │ Next.js Web/PWA│           │ Go REST API    │
     │ Admin + Mobile │           │ Modular        │
     └────────────────┘           │ Monolith       │
                                  └───────┬────────┘
                                          │
                              ┌───────────┴───────────┐
                              │                       │
                     ┌────────▼────────┐     ┌────────▼────────┐
                     │ PostgreSQL      │     │ Object Storage  │
                     │ Primary Data    │     │ Images/Documents│
                     └─────────────────┘     └─────────────────┘
```

Optional:

```text
Redis
Background Worker
Email Provider
Monitoring Service
```

สำหรับผู้ทำโปรเจกต์คนเดียว Docker Compose เพียงพอสำหรับ Local Development และ Demo Environment

---

# 62. Recommended Technology Stack

```text
Frontend
Next.js + TypeScript

Backend
Go + Gin

ORM / Database Access
GORM หรือ sqlc

Database
PostgreSQL

Authentication
JWT Access Token + Refresh Token

File Storage
S3-compatible Storage

Barcode
Code 128

QR
URL หรือ Asset ID

Deployment
Docker + CI/CD

Testing
Go testing + API Integration Test + Playwright/Cypress
```

เลือก Library ได้ตามความถนัด แต่ Domain Model, Business Rule และ Database Constraint สำคัญกว่า Framework

---

# 63. Two-Month Implementation Plan

| Week | Deliverable |
|---|---|
| 1 | Requirement, Use Case, ER Diagram, Architecture, Repository Setup |
| 2 | PostgreSQL, Backend Structure, Authentication, RBAC |
| 3 | Organization, Category, Location, Asset APIs |
| 4 | Next.js Dashboard, Asset List, Asset Detail, Forms |
| 5 | Barcode/QR Generation, Label Printing, Mobile Scanner |
| 6 | Assignment, Transfer, Audit Campaign, Audit Result |
| 7 | Unit/Integration/E2E Test, Error Handling, Performance |
| 8 | Docker, CI/CD, Deploy, Documentation และทดสอบ Audit จริง |

ทุกสัปดาห์ควรมี Demo ที่รันได้ ไม่ควรรอรวมระบบในสัปดาห์สุดท้าย

---

# 64. Demo Scenario

สร้างทรัพย์สินจำลอง 10–30 ชิ้นและพิมพ์ Barcode ติดอุปกรณ์จริง เช่น

```text
IT-NB-000001   MacBook
IT-MN-000001   Monitor
IT-KB-000001   Keyboard
IT-MS-000001   Mouse
IT-PH-000001   Phone
IT-RT-000001   Router
```

## Demo Flow

```text
1. Login เป็น Asset Admin
2. สร้าง Location: Room A และ Room B
3. ลงทะเบียน Asset 10–30 ชิ้น
4. Generate และ Print Barcode
5. ติด Label บนอุปกรณ์จำลอง
6. สร้าง 2026 Annual Asset Audit
7. Assign Auditor
8. Login ผ่านโทรศัพท์
9. เลือก Room A
10. Scan Asset ทีละชิ้น
11. แสดง FOUND เมื่อ Location ตรง
12. แสดง DUPLICATE_SCAN เมื่อ Scan ซ้ำ
13. แสดง UNREGISTERED เมื่อ Barcode ไม่มีในระบบ
14. ย้าย Mouse จำลองไป Room B
15. Scan แล้วแสดง WRONG_LOCATION
16. เพิ่ม Photo และ Note
17. Submit และ Approve Audit
18. Finalize Campaign
19. แสดง NOT_FOUND สำหรับ Asset ที่ไม่เคย Scan
20. เปิด Dashboard และ Activity Timeline
```

ตัวอย่างผล Location Mismatch:

```text
⚠ LOCATION MISMATCH

Asset:
Logitech MX Master 3

Expected:
Room A

Current Audit Location:
Room B

[ Report Wrong Location ]
```

Demo นี้แสดงให้เห็นว่าโปรเจกต์เป็น Asset Management System จริง ไม่ใช่ CRUD ทั่วไป

---

# 65. Definition of Done

Feature ถือว่าเสร็จเมื่อ

- Requirement และ Acceptance Criteria ผ่าน
- Backend ตรวจ Permission และ Business Rule แล้ว
- Database Migration พร้อมใช้งาน
- Unit Test สำหรับ Rule สำคัญผ่าน
- Integration Test สำหรับ API หลักผ่าน
- Frontend มี Loading, Empty และ Error State
- Audit Log ถูกสร้างเมื่อเป็น Operation สำคัญ
- Code Review แล้ว
- CI Pipeline ผ่าน
- Deploy บน Demo Environment ได้
- Documentation และ API Example อัปเดตแล้ว

---

# 66. Final Acceptance Criteria

ระบบฉบับ MVP ต้องพิสูจน์ได้ว่า

1. Asset Code ไม่ซ้ำ
2. ผู้ไม่มีสิทธิ์ไม่สามารถแก้ไข Asset ได้
3. Asset ถูก Assign ให้ผู้ใช้ได้ครั้งละหนึ่งคน
4. การย้าย Location มี History
5. Barcode/QR ระบุ Asset ได้ถูกต้อง
6. Auditor ใช้โทรศัพท์ Scan ได้
7. Scan ซ้ำไม่เพิ่มยอด Found
8. Wrong Location ถูกตรวจพบและสร้าง Issue ได้
9. Campaign ที่ Finalize แล้วระบุ Asset ที่ไม่พบได้
10. Campaign ที่ Closed แล้วแก้ Result โดยตรงไม่ได้
11. Asset Detail แสดง Lifecycle Timeline
12. Dashboard สรุปผล Audit ได้
13. Operation สำคัญตรวจย้อนหลังได้
14. ระบบรันผ่าน Docker และ Deploy ด้วย CI/CD ได้
15. E2E Happy Path ผ่านตั้งแต่ Login จน Finalize Audit

---

เอกสารนี้เป็น Requirement Baseline สำหรับเริ่มออกแบบ Use Case, ER Diagram, Database Schema, API Contract, UI Flow และ Test Plan ต่อไป โดย Scope จริงควรถูกทบทวนร่วมกับ Stakeholder ก่อนพัฒนา Production
