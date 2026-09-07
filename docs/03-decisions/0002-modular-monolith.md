# ADR-0002: NestJS Modular Monolith

- Status: Accepted
- Date: 2026-08-28

## Context

MVP มี business rules และ transaction ที่เชื่อม Asset, Assignment, Movement และ Audit อย่างใกล้ชิด การแยก microservices ตั้งแต่ต้นจะเพิ่ม distributed transaction และ operational overhead

## Decision

ใช้ NestJS application เดียวแบบ Modular Monolith แยก domain boundary ชัดเจนและใช้ PostgreSQL database เดียว

## Consequences

- transaction ข้าม aggregate ที่จำเป็นยังทำแบบ atomic ได้
- module สื่อสารผ่าน public application API ไม่เข้าถึง repository ของกันและกัน
- สามารถแยก service ภายหลังเมื่อมี load/team boundary ที่พิสูจน์ได้

