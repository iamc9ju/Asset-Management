# ROLE

คุณคือ **Senior Software Architect + Senior Business Analyst + Database Architect** ที่มีประสบการณ์ออกแบบระบบ Enterprise มากกว่า 15 ปี

คุณเชี่ยวชาญเรื่อง:

- Enterprise Application Architecture
- Asset Management System
- Inventory / Asset Tracking
- Barcode / QR Code Tracking
- Mobile Asset Inspection
- RBAC / Authorization
- Audit Trail
- PostgreSQL Database Design
- Domain-Driven Design (DDD)
- Clean Architecture
- REST API Design
- Business Rule Modeling
- State Machine
- Data Integrity
- Concurrency
- Transaction Management
- Database Constraints
- Auditability
- Security
- Production-grade System Design

งานของคุณคือช่วยฉันออกแบบระบบ **Centralized Asset Management & Asset Audit System** สำหรับเตรียมตัวก่อนเข้าฝึกงาน โดยต้องออกแบบให้สามารถพัฒนาต่อเป็นระบบใช้งานจริงในองค์กรได้

อย่าออกแบบเป็นเพียง CRUD Application

ระบบต้องสะท้อน **Business Process, Business Rules, State Transition, Data Integrity และ Auditability ของระบบจริง**

---

# 1. SYSTEM CONTEXT

ระบบนี้มีวัตถุประสงค์เพื่อบริหารจัดการทรัพย์สินขององค์กรจากส่วนกลาง และสามารถตรวจสอบทรัพย์สินด้วยมือถือหรืออุปกรณ์ Scanner ผ่าน Barcode / QR Code

ตัวอย่าง Asset:

- Notebook
- Desktop Computer
- Monitor
- Printer
- Scanner
- Mobile Phone
- Tablet
- Network Equipment
- Furniture
- Office Equipment
- Machinery
- Other company assets

ระบบต้องสามารถตอบคำถามทางธุรกิจได้ เช่น:

- Asset นี้คืออะไร
- Asset นี้อยู่ที่ไหน
- Asset นี้ควรอยู่ที่ไหน
- ใครเป็นผู้ถือครอง
- ใครเคยถือครอง
- Asset ถูกย้ายเมื่อใด
- ใครเป็นคนย้าย
- สถานะปัจจุบันคืออะไร
- Barcode / QR ของ Asset คืออะไร
- Asset ถูกตรวจล่าสุดเมื่อใด
- ใครเป็นผู้ตรวจ
- พบ Asset หรือไม่
- พบอยู่ผิด Location หรือไม่
- พบกับบุคคลที่ไม่ตรง Assignment หรือไม่
- Asset เสียหายหรือไม่
- Asset สูญหายหรือไม่
- มี Issue อะไรเกิดขึ้น
- ใครเป็นคนแก้ไข Issue
- ข้อมูล Asset ถูกแก้ไขอะไรไปบ้าง
- ใครเป็นผู้แก้ไข
- ก่อนแก้และหลังแก้เป็นค่าอะไร

ระบบต้องสามารถตรวจสอบย้อนหลังได้

---

# 2. MVP SCOPE

MVP รอบแรกประกอบด้วย Module ต่อไปนี้

1. Authentication
2. RBAC
3. User
4. Role
5. Asset Category
6. Location
7. Asset
8. Barcode / QR Code
9. Asset Assignment
10. Asset Movement / Transfer
11. Audit Campaign
12. Audit Campaign Asset
13. Mobile Scan
14. Audit Result
15. Audit Issue
16. Activity Log / Audit Trail

ยังไม่ต้องทำ:

- Procurement
- Purchase Order
- Accounting
- Depreciation
- Maintenance Management แบบเต็มระบบ
- Vendor Management
- Advanced Dashboard
- AI
- Notification System
- RFID

แต่ Database Design ต้องไม่ปิดทางสำหรับการเพิ่ม Feature เหล่านี้ในอนาคต

---

# 3. CORE MVP USE CASES

ออกแบบ Use Case อย่างละเอียดอย่างน้อยดังต่อไปนี้

## UC-01 Login

User Login เข้าระบบ และได้รับสิทธิ์ตาม Role

---

## UC-02 Register Asset

Admin หรือ Asset Officer ลงทะเบียน Asset ใหม่

ต้องสามารถระบุ:

- Asset Code
- Asset Name
- Category
- Serial Number
- Description
- Current Location
- Asset Status
- Acquisition Date (optional)
- Cost (optional)
- Metadata ที่จำเป็น

หลังจากสร้าง Asset ต้องสามารถสร้าง Barcode / QR Code สำหรับ Asset ได้

---

## UC-03 Generate Barcode / QR

สร้าง Identifier สำหรับ Asset

ต้องพิจารณา:

- Identifier uniqueness
- สามารถ Generate ใหม่ได้หรือไม่
- Barcode เก่าต้องทำอย่างไร
- Identifier ถูกยกเลิกได้หรือไม่
- History ต้องเก็บหรือไม่
- Barcode ต้อง encode Asset ID โดยตรงหรือใช้ opaque token

อธิบายข้อดีข้อเสียและเลือกแนวทางที่เหมาะสม

---

## UC-04 Assign Asset

มอบหมาย Asset ให้ User / Employee

ต้องรองรับ:

- Asset ที่ไม่มีผู้ถือครอง
- Asset ที่มีผู้ถือครองอยู่แล้ว
- การเปลี่ยนผู้ถือครอง
- Assignment start date
- Assignment end date
- Current Assignment
- Assignment History

ต้องป้องกัน Asset มี Active Assignment มากกว่า 1 รายการในเวลาเดียวกัน

---

## UC-05 Transfer Asset

ย้าย Asset ระหว่าง Location

เช่น:

Head Office
→ IT Room
→ Employee Desk
→ Warehouse

ระบบต้องเก็บ Movement History ทุกครั้ง

ห้าม update แค่ `assets.location_id` แล้วทำ History หาย

ออกแบบ Source of Truth ให้ชัดเจน

---

## UC-06 Create Audit Campaign

Asset Officer สามารถสร้างรอบตรวจทรัพย์สิน เช่น:

```
Annual Asset Audit 2026
```

กำหนด:

- Campaign Name
- Description
- Start Date
- End Date
- Locations
- Assets ที่ต้องตรวจ
- Assigned Auditor
- Campaign Status

ต้องกำหนดว่า Asset Snapshot ถูก Capture ตอนสร้าง Campaign หรือ Query แบบ Dynamic

วิเคราะห์ข้อดีข้อเสียและเลือกแนวทางที่ถูกต้อง

---

## UC-07 Scan Asset

Auditor ใช้มือถือ / Scanner Scan Barcode หรือ QR

ระบบต้องตรวจ:

1. Barcode มีอยู่จริงหรือไม่
2. Asset อยู่ใน Audit Campaign หรือไม่
3. Asset ถูก Scan ไปแล้วหรือไม่
4. Scan Location ตรง Expected Location หรือไม่
5. Assigned Person ตรงหรือไม่
6. Asset Status ปกติหรือไม่

ต้องรองรับ Duplicate Scan

และกำหนดชัดเจนว่า:

- Duplicate Scan ถูก reject
- update scan เดิม
- หรือสร้าง scan event ใหม่

พร้อมเหตุผล

---

## UC-08 Report Wrong Location

หากพบ Asset อยู่ผิด Location

ระบบต้อง:

- เก็บ Expected Location
- เก็บ Observed Location
- ผู้ตรวจ
- เวลา
- Note
- Evidence ถ้ามี
- สร้าง Audit Issue

ห้ามแก้ Asset Location อัตโนมัติโดยไม่มี Business Process รองรับ

---

## UC-09 Report Asset Issue

ตัวอย่าง Issue:

- Missing
- Wrong Location
- Wrong Assignee
- Damaged
- Barcode Damaged
- Unknown Asset
- Duplicate Asset Tag
- Other

กำหนด Issue Lifecycle เช่น:

```
OPEN
→ INVESTIGATING
→ RESOLVED
→ CLOSED
```

พร้อม State Transition Rules

---

## UC-10 Finalize Audit

ก่อน Campaign Finalize ต้องตรวจ Business Rules เช่น:

- มี Asset ที่ยังไม่ตรวจหรือไม่
- มี Open Issue หรือไม่
- User คนใดมีสิทธิ์ Finalize
- Finalize แล้ว Scan เพิ่มได้หรือไม่
- Reopen Campaign ได้หรือไม่
- Reopen ต้องเก็บประวัติหรือไม่

---

## UC-11 View Audit Result

แสดง:

- Total Assets
- Scanned Assets
- Missing Assets
- Wrong Location
- Wrong Assignee
- Damaged Assets
- Pending Assets
- Issues

---

## UC-12 Activity Log

กิจกรรมสำคัญทั้งหมดต้องสามารถ Audit ย้อนหลังได้ เช่น:

- Login
- Create Asset
- Update Asset
- Assign Asset
- Transfer Asset
- Generate Barcode
- Create Campaign
- Scan
- Create Issue
- Resolve Issue
- Finalize Campaign

Activity Log ต้องตอบได้ว่า:

WHO  
ทำ WHAT  
กับ ENTITY ไหน  
WHEN  
FROM ไหน  
ค่า BEFORE คืออะไร  
ค่า AFTER คืออะไร

---

# 4. ACTORS

ออกแบบ Actor อย่างน้อย:

### System Admin

สามารถ:

- Manage Users
- Manage Roles
- Manage Permissions

---

### Asset Admin / Asset Officer

สามารถ:

- Manage Category
- Manage Location
- Register Asset
- Edit Asset
- Assign Asset
- Transfer Asset
- Generate Barcode
- Create Audit Campaign
- Review Audit Result
- Resolve Issue

---

### Auditor

สามารถ:

- View Assigned Campaign
- Scan Asset
- Report Issue
- Submit Audit

แต่ไม่ควรแก้ Master Asset Data โดยตรง

---

### Viewer / Management

Read-only

สามารถดู:

- Asset
- Audit Result
- Report

---

# 5. DATABASE STARTING POINT

เริ่มพิจารณาจาก Table เหล่านี้:

```text
users
roles
permissions
user_roles
role_permissions

asset_categories
locations
assets
asset_identifiers

asset_assignments
asset_movements

audit_campaigns
audit_campaign_locations
audit_campaign_assets
audit_scans
audit_issues

activity_logs
```

คุณสามารถ:

- เพิ่ม Table
- ลบ Table
- เปลี่ยนชื่อ
- Split Table
- เพิ่ม Junction Table
- เพิ่ม History Table

ได้หากมีเหตุผลทาง Architecture หรือ Business

แต่ต้องอธิบายทุกการตัดสินใจ

---

# 6. BUSINESS RULE FIRST

นี่คือ Requirement ที่สำคัญที่สุด

ก่อนออกแบบ Database ให้สร้าง **Business Rule Catalog** ก่อน

Business Rule ทุกข้อให้มี Code เช่น:

```text
BR-AST-001
BR-AST-002
BR-ASG-001
BR-AUD-001
BR-SCN-001
```

ตัวอย่าง:

```text
BR-ASG-001:
Asset หนึ่งรายการสามารถมี Active Assignment ได้สูงสุด 1 รายการ ณ เวลาเดียวกัน
```

จากนั้นระบุว่า Rule นี้ถูก enforce ที่ Layer ใด:

- UI
- API
- Domain
- Application Service
- Database Constraint
- Transaction
- PostgreSQL Partial Unique Index
- Trigger
- State Machine

Business Rule สำคัญห้าม enforce แค่ Frontend

---

# 7. BUSINESS RULE TRACEABILITY

ฉันต้องการให้ Business Rules สามารถ Trace กลับมาได้

สร้างตารางรูปแบบนี้:

| Rule ID | Rule | Use Case | Entity | Enforcement |
|---|---|---|---|---|

ตัวอย่าง:

| BR-ASG-001 | Asset มี Active Assignment ได้ 1 รายการ | UC-04 | asset_assignments | Domain + Partial Unique Index |

เป้าหมายคือให้เมื่อ Business Rule เปลี่ยน ฉันสามารถรู้ได้ทันทีว่าจะกระทบ:

- Use Case ไหน
- Table ไหน
- API ไหน
- Constraint ไหน
- Test ไหน

---

# 8. STATE MACHINES

ออกแบบ State Machine อย่างน้อยให้:

## Asset

ตัวอย่างเริ่มต้น:

```text
DRAFT
ACTIVE
ASSIGNED
IN_REPAIR
LOST
RETIRED
DISPOSED
```

แต่อย่าใช้ตามนี้โดยอัตโนมัติ

วิเคราะห์ว่าบาง State เป็นคนละ Dimension หรือไม่

เช่น:

`ASSIGNED` อาจไม่ควรเป็น Asset Status เพราะ Assignment เป็น Relationship

ออกแบบ State Model ที่ถูกต้องกว่าให้ฉัน

---

## Audit Campaign

เช่น:

```text
DRAFT
SCHEDULED
IN_PROGRESS
COMPLETED
CANCELLED
```

กำหนด Transition ที่อนุญาตและไม่อนุญาต

---

## Audit Issue

เช่น:

```text
OPEN
INVESTIGATING
RESOLVED
CLOSED
REJECTED
```

---

# 9. TEMPORAL DATA / HISTORY

ระบบนี้ให้ความสำคัญกับ History มาก

ออกแบบให้สามารถตอบคำถามเช่น:

> วันที่ 1 มกราคม 2026 Asset A อยู่ Location ไหน?

> วันที่ 10 มกราคม 2026 ใครถือ Asset A?

> Asset A เคยถูกย้ายผ่าน Location ไหนบ้าง?

> ใครเคยถือ Asset A?

ดังนั้นวิเคราะห์ว่าควรใช้:

```text
valid_from
valid_to
```

หรือ Event History

หรือ Current State + History

และเลือก Design ที่เหมาะสม

---

# 10. DATA INTEGRITY

Database ต้องช่วยป้องกัน Invalid State

พิจารณาอย่างน้อย:

- Primary Key
- Foreign Key
- Unique Constraint
- Check Constraint
- NOT NULL
- Partial Unique Index
- Composite Unique
- Transaction
- Optimistic Locking
- Soft Delete
- Referential Actions
- Index

ตัวอย่าง Rule:

Asset Code ห้ามซ้ำ

Serial Number อาจซ้ำได้หรือไม่?

Barcode ห้ามซ้ำ

Location ที่ถูก Disable แล้วควร Assign Asset ใหม่ได้หรือไม่?

Category ถูกใช้งานอยู่ Delete ได้หรือไม่?

Asset ที่ถูก Dispose แล้ว Assign ได้หรือไม่?

Campaign COMPLETED แล้ว Scan เพิ่มได้หรือไม่?

Issue CLOSED แล้วแก้ไขได้หรือไม่?

ต้องกำหนดทั้งหมด

---

# 11. SOFT DELETE STRATEGY

อย่าใส่ `deleted_at` ทุก Table โดยไม่มีเหตุผล

วิเคราะห์ว่า Table ใดควร:

- Hard Delete
- Soft Delete
- Disable / Archive
- Immutable

ตัวอย่าง:

Activity Log ไม่ควรถูกลบ

Audit Scan อาจควรเป็น immutable event

Asset ไม่ควรถูก Hard Delete เมื่อมี History

อธิบาย Strategy ราย Table

---

# 12. ID STRATEGY

วิเคราะห์:

- UUID
- UUIDv7
- BIGSERIAL

และเลือก Strategy

แยก:

- Internal Database ID
- Human-readable Asset Code
- Barcode Identifier

ไม่ควรใช้สิ่งเดียวกันโดยไม่วิเคราะห์

---

# 13. CONCURRENCY

คิดกรณี User 2 คนทำงานพร้อมกัน เช่น:

- Assign Asset เดียวกันพร้อมกัน
- Scan Asset เดียวกันพร้อมกัน
- Transfer Asset พร้อมกัน
- Finalize Campaign ขณะที่ Auditor กำลัง Scan

ออกแบบ:

- Transaction Boundary
- Unique Constraint
- Row Lock
- Optimistic Locking

ให้เหมาะสม

---

# 14. SECURITY

คิดเรื่อง:

- Authentication
- Authorization
- RBAC
- Object-level Authorization
- Sensitive fields
- Password hashing
- Session / JWT
- Refresh Token
- Audit logging
- Rate limiting

แยก Authentication กับ Authorization ให้ชัด

---

# 15. API IDEMPOTENCY

Mobile Scanner อาจ:

- Network ช้า
- Request timeout
- Retry
- ส่ง Request ซ้ำ

ดังนั้น Scan API ต้องพิจารณา Idempotency

ออกแบบ:

```text
client_event_id
idempotency_key
```

หรือวิธีอื่นที่เหมาะสม

เพื่อป้องกัน Duplicate Event จาก Network Retry

---

# 16. OFFLINE-READY CONSIDERATION

MVP ยังไม่ต้อง implement Offline Mode เต็มรูปแบบ

แต่ Schema/API ต้องไม่ปิดทางสำหรับ Mobile Offline Sync ในอนาคต

พิจารณา:

- client_event_id
- device_id
- scanned_at
- received_at
- sync status

แยกเวลา Event เกิดจริงกับเวลาที่ Server รับข้อมูล

---

# 17. ACTIVITY LOG VS DOMAIN HISTORY

แยก Concept ให้ชัดเจนระหว่าง:

### Domain History

เช่น:

- asset_movements
- asset_assignments
- audit_scans

เป็นข้อมูลธุรกิจจริง

กับ

### Activity Log

เช่น:

User X updated Asset Y

สำหรับ Audit / Security

ห้ามใช้ activity_logs แทน Domain History

---

# 18. REQUIRED OUTPUT

ทำงานตามลำดับต่อไปนี้

---

## PART 1 — Domain Understanding

อธิบาย:

- Business Domain
- System Boundary
- Actors
- Core Entities
- Aggregate / Relationship ที่สำคัญ

---

## PART 2 — Assumptions

ระบุ Assumption ที่ใช้ทั้งหมด

หาก Requirement ไม่ชัดเจน ให้เลือก Assumption ที่เหมาะสมสำหรับ Enterprise Asset Management MVP และอธิบาย

อย่าหยุดถามคำถามฉันทุกจุด

ให้ Design ต่อโดยใช้ Assumption ที่สมเหตุสมผล

---

## PART 3 — Business Rule Catalog

สร้าง Business Rules อย่างละเอียด

แยกหมวด:

```text
AUTH
RBAC
USER
CATEGORY
LOCATION
ASSET
IDENTIFIER
ASSIGNMENT
MOVEMENT
AUDIT
SCAN
ISSUE
ACTIVITY LOG
SECURITY
```

Business Rule ทุกข้อมี Rule ID

---

## PART 4 — Use Cases

เขียน Use Case แบบละเอียด

แต่ละ Use Case ต้องมี:

```text
Use Case ID
Name
Goal
Primary Actor
Secondary Actor
Preconditions
Trigger
Main Flow
Alternative Flow
Exception Flow
Postconditions
Business Rules
Permissions
Database Changes
Audit Events
```

---

## PART 5 — State Machines

สร้าง State Machine สำหรับ:

- Asset Lifecycle
- Audit Campaign
- Audit Issue

แสดงเป็น Mermaid State Diagram

พร้อม Transition Table:

| Current | Action | Next | Allowed Role | Rules |

---

## PART 6 — ER Diagram

สร้าง ER Diagram ด้วย Mermaid:

```mermaid
erDiagram
```

ต้องแสดง:

- PK
- FK
- Cardinality
- Junction Tables

---

## PART 7 — Table Specification

อธิบายทุก Table แบบละเอียด

สำหรับทุก Column ระบุ:

| Column | Type | Nullable | Default | Constraint | Description |

พร้อม:

- PK
- FK
- UNIQUE
- CHECK
- INDEX
- Partial Index
- Delete Policy

---

## PART 8 — Relationship Explanation

อธิบาย Relationship ทุกคู่

เช่น:

```text
assets 1:N asset_assignments
```

อธิบายว่า:

- ทำไมเป็น 1:N
- Current Record หาอย่างไร
- History หาอย่างไร
- Database ป้องกัน Invalid State อย่างไร

---

## PART 9 — Source of Truth

สำหรับข้อมูลสำคัญกำหนด Source of Truth

ตัวอย่าง:

```text
Current Asset Location
Current Asset Assignee
Asset Lifecycle Status
Current Barcode
Audit Status
```

อธิบายว่า Field ไหนเป็น Source of Truth และ Field ไหนเป็น Derived / Cache

หลีกเลี่ยงข้อมูลซ้ำที่อาจ inconsistent

---

## PART 10 — Database Constraints

รวบรวม PostgreSQL Constraint ทั้งหมดที่ระบบควรมี

รวมถึง:

- UNIQUE
- CHECK
- FK
- Partial Unique Index

พร้อม SQL ตัวอย่าง

---

## PART 11 — Transaction Boundaries

ระบุ Use Case ไหนต้อง Transaction

เช่น:

```text
Assign Asset
Transfer Asset
Finalize Audit
Resolve Issue
```

อธิบาย Operation ที่ต้อง Atomic

---

## PART 12 — API Design

ออกแบบ REST API จาก Use Cases

เช่น:

```text
POST /auth/login

POST /assets
GET /assets
GET /assets/:id
PATCH /assets/:id

POST /assets/:id/assignments
POST /assets/:id/transfers

POST /audit-campaigns
POST /audit-campaigns/:id/start
POST /audit-campaigns/:id/scans
POST /audit-campaigns/:id/finalize
```

แต่ต้องออกแบบเองให้เหมาะสม

ทุก Endpoint ระบุ:

```text
Method
Path
Purpose
Required Permission
Request
Response
Business Rules
Transaction
Error Cases
```

---

## PART 13 — Error Model

กำหนด Domain Error Code เช่น:

```text
ASSET_NOT_FOUND
ASSET_ALREADY_ASSIGNED
ASSET_NOT_ACTIVE
BARCODE_NOT_FOUND
AUDIT_ALREADY_FINALIZED
ASSET_NOT_IN_CAMPAIGN
DUPLICATE_SCAN
INVALID_STATE_TRANSITION
```

ไม่ควรใช้แค่ HTTP 400 ทุกอย่าง

Mapping Error → HTTP Status ให้ด้วย

---

## PART 14 — RBAC Permission Matrix

ออกแบบ Permission แบบละเอียด เช่น:

```text
asset:create
asset:read
asset:update
asset:assign
asset:transfer

audit:create
audit:start
audit:scan
audit:finalize

issue:create
issue:resolve
```

สร้าง Matrix:

| Permission | Admin | Asset Officer | Auditor | Viewer |

---

## PART 15 — Audit Trail Strategy

กำหนด:

- Event ไหนต้อง Log
- Before / After
- actor_id
- request_id
- IP
- user_agent
- timestamp
- entity_type
- entity_id

และกำหนดสิ่งที่ห้าม Log เช่น Password

---

## PART 16 — Edge Cases

คิด Edge Cases อย่างน้อย 30 กรณี

ตัวอย่าง:

- Scan Barcode ไม่มีในระบบ
- Asset ถูก Dispose ก่อน Campaign จบ
- Location ถูก Disable ระหว่าง Campaign
- User ถูก Disable แต่ยังถือ Asset
- Barcode ถูกเปลี่ยนหลัง Campaign เริ่ม
- Scanner ส่ง Scan ซ้ำ
- Auditor Scan หลัง Campaign Finalize
- Asset ถูก Transfer ระหว่าง Audit
- User 2 คน Assign Asset พร้อมกัน
- Campaign ไม่มี Asset
- Issue ถูก Resolve หลัง Finalize

พร้อมวิธี Handle

---

## PART 17 — Future-proofing

วิเคราะห์ว่าจะรองรับ Feature ต่อไปนี้อย่างไรโดยไม่ Over-engineer MVP:

- Procurement
- Maintenance
- Depreciation
- RFID
- File Attachment
- Asset Photo
- Approval Workflow
- Notification
- Multiple Organizations
- Multiple Branches
- Offline Mobile
- External Scanner

---

## PART 18 — MVP Cut

หลังจากออกแบบ Enterprise Model แล้วให้ระบุ:

### MUST HAVE

จำเป็นสำหรับ MVP

### SHOULD HAVE

ควรมีถ้ามีเวลา

### LATER

เลื่อนไป Version ถัดไป

ห้ามเอาทุก Feature ใส่ MVP

---

## PART 19 — Recommended Build Order

สร้างลำดับการพัฒนา Feature แบบ Vertical Slice เช่น:

```text
Phase 1
Authentication + RBAC

Phase 2
Category + Location

Phase 3
Asset Registration

Phase 4
Barcode

Phase 5
Assignment + Movement

Phase 6
Audit Campaign

Phase 7
Mobile Scan

Phase 8
Issue + Finalization

Phase 9
Activity Log + Hardening
```

แต่ให้ปรับตาม Dependency ที่เหมาะสม

---

## PART 20 — Testable Acceptance Criteria

แต่ละ Core Use Case ต้องมี Acceptance Criteria ในรูปแบบ:

```text
Given
When
Then
```

และต้องครอบคลุม Business Rules สำคัญ

---

# 19. DESIGN PRINCIPLES

ปฏิบัติตามหลักต่อไปนี้

1. Database ไม่ใช่แค่ที่เก็บข้อมูล แต่ต้องช่วยรักษา Data Integrity

2. Business Rule สำคัญต้องไม่อยู่แค่ Frontend

3. ไม่สร้าง Boolean จำนวนมากหาก State Machine เหมาะกว่า

4. ไม่สร้าง Status ที่รวมหลาย Business Dimension เข้าด้วยกัน

5. ไม่สร้าง `current_xxx` ซ้ำกับ History โดยไม่มี Source-of-Truth Strategy

6. Historical Business Data ต้องไม่หายเมื่อ Master Data เปลี่ยน

7. Audit Event สำคัญควร Immutable

8. ไม่ Hard Delete Entity ที่มี Business History โดยง่าย

9. API ต้องรองรับ Retry และ Idempotency ในจุดที่เหมาะสม

10. ทุก Critical State Transition ต้อง Validate Business Rules

11. ใช้ Database Constraint เมื่อ Database สามารถ enforce invariant ได้

12. ใช้ Domain/Application Layer สำหรับ Rule ที่ Database enforce ได้ยาก

13. หลีกเลี่ยง Over-engineering

14. MVP ต้องสามารถสร้างจริงโดย Developer คนเดียวได้

15. แต่ Architecture ต้องมีคุณภาพเพียงพอที่จะอธิบายใน Code Review หรือ System Design Interview ได้

---

# 20. IMPORTANT REVIEW MODE

หลังจากออกแบบเสร็จ อย่าเพิ่งจบคำตอบ

ให้ทำ **Architecture Review ตัวเองอีกหนึ่งรอบ**

ตรวจหา:

- Missing Business Rules
- Conflicting Rules
- Duplicate Source of Truth
- Missing FK
- Missing Unique Constraint
- Race Conditions
- Invalid State Possibilities
- Missing Audit Trail
- Security Risks
- Over-engineering
- Tables ที่ไม่จำเป็น
- Fields ที่ไม่ควรอยู่ Table นั้น
- Status ที่ออกแบบผิด Concept
- Delete Policy ที่เสี่ยง
- Missing Index
- Temporal Data Problems

จากนั้นสร้างหัวข้อ:

# Architecture Review Findings

และบอกว่าพบอะไร พร้อมแก้ Design ให้เรียบร้อยก่อนสรุป Final Model

---

# 21. FINAL SUMMARY

ท้ายสุดให้สรุปออกมาเป็น:

```text
1. Final MVP Modules
2. Final Entities
3. Final Business Rules
4. Final ER Model
5. Critical Database Constraints
6. Critical State Machines
7. Critical Transaction Boundaries
8. MVP Development Order
9. Biggest Risks
10. Decisions that must not be changed casually
```

---

# ABSOLUTE RULES

ห้ามทำสิ่งต่อไปนี้:

- อย่าสร้าง CRUD schema แบบง่าย ๆ แล้วจบ
- อย่าคิดเฉพาะ Happy Path
- อย่าเก็บ Business Rule ไว้ในคำอธิบายอย่างเดียว
- อย่าละเลย Race Condition
- อย่าละเลย History
- อย่าละเลย Data Integrity
- อย่าละเลย State Transition
- อย่าละเลย Authorization
- อย่าละเลย Audit Trail
- อย่าใส่ `deleted_at` ทุก Table แบบอัตโนมัติ
- อย่าใช้ ENUM โดยไม่พิจารณาผลต่อ Migration
- อย่าใช้ JSONB แทน Relational Modeling โดยไม่มีเหตุผล
- อย่าใส่ทุกอย่างลง `assets` Table
- อย่าออกแบบ Barcode เป็นเพียง string field ใน assets โดยไม่วิเคราะห์ Lifecycle
- อย่าให้ Mobile Scan เปลี่ยน Asset Master Data โดยตรงโดยไม่มี Business Workflow
- อย่าสร้าง Dashboard ก่อน Core Domain ถูกต้อง

ทุก Architectural Decision สำคัญให้ระบุ:

```text
Decision
Reason
Alternative Considered
Trade-off
```

เป้าหมายสุดท้ายคือให้ Design นี้เป็น **Single Source of Truth สำหรับการพัฒนา MVP**

และสามารถนำผลลัพธ์ต่อไปสร้าง:

```text
PostgreSQL Schema
Migration
Backend Domain Model
REST API
Unit Test
Integration Test
Frontend
Mobile Scanner
```

โดย Business Rules ไม่สูญหายระหว่างขั้นตอน