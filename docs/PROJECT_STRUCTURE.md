# VAYRO Fleet Tracking: Project and System Structure

Backend branch note: web prototype details in this local inventory are reference only. Frontend prototype changes are excluded from the Backend commit; the committed web is the original scaffold.

เอกสารนี้อธิบายทั้งโครงสร้างที่มีอยู่จริงใน repository และโครงสร้างเป้าหมายสำหรับพัฒนาต่อ แยกสองส่วนนี้ไว้ชัดเจนเพื่อไม่ให้เข้าใจว่าโฟลเดอร์หรือฟีเจอร์ที่ยังไม่ได้สร้างมีอยู่แล้ว

## 1. ภาพรวมโครงการ

แพลตฟอร์ม B2B สำหรับติดตามรถของหลายบริษัท รับตำแหน่งจาก GPS ของผู้ให้บริการหรือจากโทรศัพท์พนักงานขับรถ จัดเก็บประวัติ แสดงรถและงานขนส่งบน Dashboard แจ้งเหตุการณ์ และจัดทำรายงาน

ข้อกำหนดจากเอกสารโครงงานประกอบด้วยการแยกข้อมูลตามบริษัท บทบาท Platform Admin, Company Admin, Dispatcher และ Driver การจัดการรถ/ผู้ขับ/งาน การตรวจสอบคุณภาพข้อมูล GPS การติดตามปัจจุบันและย้อนหลัง การแจ้งเตือน รายงาน และ API สำหรับระบบภายนอก

บริบทเพิ่มเติมจากเจ้าของโครงการ: ทำ GPS demo โดยรับ Location จากโทรศัพท์ ส่งผ่าน Server และต้องการนำเสนอ UI ในรูปแบบ 3D

## 2. เทคโนโลยีที่กำหนด

| ส่วน | เทคโนโลยี | หน้าที่ |
| --- | --- | --- |
| Web dashboard | Next.js + TypeScript | หน้าบริหารแพลตฟอร์มและบริษัท, ตารางรถ/งาน, รายงาน และมุมมองติดตาม |
| Backend/API | Elysia + Bun | ยืนยันตัวตนและสิทธิ์, API ของผลิตภัณฑ์, รับข้อมูลตำแหน่ง และประสานงานกับข้อมูล |
| Database | PostgreSQL | จัดเก็บข้อมูลบริษัท รถ งาน ตำแหน่ง ประวัติ แจ้งเตือน และกิจกรรม |
| ORM / migrations | Prisma | แต่ละ service มี `prisma/schema.prisma` และ migration ของตัวเอง; ฐานข้อมูลแยกต่อ service (ดู docs/DATABASE.md) |
| Data API | PostgREST | เปิด endpoint สำหรับข้อมูล PostgreSQL ให้ backend ใช้ตามความเหมาะสม; ไม่ใช่ตัวฐานข้อมูล |
| 3D UI | Three.js | แสดงฉาก/รถ/เส้นทางใน dashboard โดยอิงข้อมูลพิกัดและสถานะจริงที่มี |
| Container | Docker / Docker Compose | เตรียมสภาพแวดล้อมสำหรับรันบริการและฐานข้อมูลร่วมกัน |
| Driver GPS demo | Android APK | ส่งตำแหน่งโทรศัพท์ผ่าน Elysia API ตามการยืนยันตัวตนและช่วงเวลางาน |

**ยังไม่กำหนด:** framework ที่ใช้สร้าง APK, ผู้ให้บริการแผนที่/tiles, รูปแบบ protocol ของ GPS ภายนอก และค่าความถี่ส่งตำแหน่งจริง ให้เลือกเมื่อมี requirement หรือแหล่งข้อมูลพร้อม

## 3. Current local implementation (2026-11-15)

The project brief (PDF page 7, "Modular Monolith แยก 12 Service Modules") defines **12 service modules**, listed with their endpoints on PDF pages 18-26. All 12 now exist as folders under `services/`. Each service that owns data has its own database (one Postgres server, one database and login role per service) and is managed with Prisma. Services never read each other's tables: they call each other's `/internal/*` API with `INTERNAL_API_TOKEN`. Field names, ids and the 14-table Data Dictionary contract are unchanged. Ownership and migration steps are in [DATABASE.md](DATABASE.md).

| # | Service folder | Database | Tables it owns | Status |
| --- | --- | --- | --- | --- |
| 1 | `auth-service` | `auth_db` | `auth_sessions` | done (4 endpoints) |
| 2 | `company-service` | `company_db` | `company` | all 7 PDF endpoints (register, list, get, edit, approve, reject, status) + internal lookup |
| 3 | `user-service` | `user_db` | `users` | done (8 endpoints) |
| 4 | `vehicle-service` | `vehicle_db` | `vehicle_types`, `vehicles` | data only; internal lookup, public API to do |
| 5 | `gps-device-service` | `gps_device_db` | `gps_devices` | done (6 endpoints, encrypted provider credentials) |
| 6 | `gps-data-service` | `gps_data_db` | `gps_locations` | done (3 endpoints, abnormal/missing-data detection, event push) |
| 7 | `tracking-service` | none | none | empty skeleton |
| 8 | `route-history-service` | none | none | empty skeleton |
| 9 | `transport-service` | `transport_db` | `transport_jobs` | data only; internal lookup, public API to do |
| 10 | `alert-service` (Alert & Geofence) | `alert_db` | `alert_rules`, `geofences`, `alerts` | data only; skeleton |
| 11 | `reporting-service` | none | none | done (7 endpoints, CSV export; reads the other services' `/internal` stats) |
| 12 | `integration-service` (Integration & Logging) | `integration_db` | `api_integrations`, `api_request_logs`, `system_log` | data only; skeleton |

Every service has a `README.md` with its PDF endpoint checklist, the internal API it offers, and the data it must ask other services for. Skeletons already boot, answer the Docker health check, and have `src/plugins/guard.ts` ready for protected routes.

```text
apps/web/                            # Frontend is a separate responsibility
gateway/                             # routes public paths to the 12 services (route table); never proxies /internal/*
services/*-service/                  # the 12 modules above
packages/service-kit/                # shared plumbing: ApiError/ok/http plugin, ids, internal-call client, audit helper, auth guard factory
packages/shared-types/               # shared Auth/User/GPS request/response types
infra/database/init/                 # creates one database + role per service on a new volume
infra/database/split-legacy.sh       # one-time copy from the old shared database
infra/database/legacy/               # old shared-schema SQL, reference only
docs/data-dictionary.json            # machine-readable 14-table field contract
docs/API_DATA_CONTRACT.md            # Canonical fields and API representation
docs/DATABASE.md                     # database ownership, Prisma workflow, migration from the shared database
compose.yaml                         # PostgreSQL + the 12 services + gateway + optional Web
```

Every service with a database has `prisma/schema.prisma`, `prisma/migrations/` and `prisma.config.ts`; the generated client lives in `src/generated/` (not committed).

Inside a service the code is split by responsibility (examples from the three built services):

```text
auth-service/src                     user-service/src                      gps-data-service/src
  config/env.ts                        config/env.ts                         config/env.ts
  lib/    prisma, audit, jwt, ...      lib/    prisma, audit, password       lib/        prisma
  adapters/user-service.ts             adapters/auth-service.ts, company-    adapters/   fleet-directory, device-directory,
  plugins/guard.ts                       service.ts                            identity, device-tokens
  modules/auth     routes/service/     plugins/guard.ts                      routes/     locations, internal (HTTP only)
  modules/session  repository          modules/users  routes/service/        schemas/    request schemas + row -> API mapping
  modules/internal routes                repository/model, internal           application/ use cases (ingest, queries)
  app.ts, index.ts                     app.ts, index.ts                      domain/     pure GPS rules (freshness, limits)
                                                                             infrastructure/ Prisma repositories
```

Rule of thumb: routes only parse HTTP and call a service/use case; services/use cases hold the rules and transactions; repositories are the only code that touches Prisma models; adapters wrap other services so tests can replace them with fakes.

gps-data-service serves the three endpoints the PDF lists for service 6: `POST /api/v1/gps/ingest`, `GET /api/v1/gps/vehicles/:vehicleId/latest` and `/locations`. Services 7 (`/api/v1/tracking/*`: every vehicle's latest position with filters) and 8 (`/api/v1/routes/*`: route points and summary) are different endpoints; they are to read gps-data-service's `/internal/locations*`.

All functions the PDF lists for services 1, 3, 5 and 6 are implemented. gps-data-service pushes new points only to services named in `GPS_EVENT_SUBSCRIBERS`; no service receives them yet (Alert & Geofence will).
Root dev scripts exist for all 12 services. See the shared contract before writing new APIs; do not invent alternate field spellings. IDs are BIGINT strings; timestamps are UTC ISO 8601; GPS values use speed_kmh, direction_degree, accuracy_meters and gps_location_id.

## 4. โครงสร้างเป้าหมายที่แนะนำ

นี่คือแนวทางการจัดวางโค้ดเมื่อเริ่มเพิ่มความสามารถ ไม่ใช่รายการไฟล์ที่มีอยู่แล้ว และสามารถปรับให้เข้ากับ implementation จริงได้

```text
.
├── apps/
│   ├── web/                         # Next.js: Admin, Dispatcher, dashboard 3D
│   └── driver-android/              # เป้าหมาย: แอป Driver และ APK demo (ยังไม่เลือก framework)
├── gateway/                         # Elysia: API entry, auth, validation, routing
├── services/
│   ├── auth-service/                # Login, session/token และการตรวจตัวตน
│   ├── user-service/                # บัญชี, role, account_status และโปรไฟล์
│   ├── company-service/             # เป้าหมาย: บริษัทและสถานะ Workspace
│   ├── vehicle-service/             # รถ, ประเภทรถ และการมอบหมายผู้ขับ
│   ├── tracking-service/            # ingest GPS, normalize, validate, history, freshness
│   ├── transport-service/           # งานขนส่ง, จุดรับ/ส่ง, สถานะงาน
│   ├── notification-service/        # กฎแจ้งเตือนและสถานะการจัดการ
│   └── reporting-service/           # รายงาน/aggregation เมื่อมีความจำเป็น
├── packages/
│   ├── shared-types/                # DTO/API contracts และชนิดข้อมูลร่วม
│   └── service-kit/                 # ท่อร่วมของทุก service (http, id, internal call, audit, guard)
├── infra/
│   ├── docker/                      # Dockerfiles/config เฉพาะบริการเมื่อจำเป็น
│   └── database/                    # migrations, schema และ seed สำหรับ local demo
├── docs/
│   ├── PROJECT_STRUCTURE.md
│   └── api/                         # สัญญา API เมื่อเริ่มกำหนด endpoint
├── compose.yaml                     # รัน stack สำหรับ dev/demo
└── .env.example                     # ตัวอย่างชื่อตัวแปรเท่านั้น ไม่มี secret จริง
```

เริ่มจากโมดูล/บริการที่จำเป็นต่อ vertical slice แรก อย่าสร้าง microservice แยกทุกโดเมนล่วงหน้าโดยไม่มีเหตุผลด้านการ deploy หรือการ scale รองรับ ชื่อในโครงสร้างนี้เป็นขอบเขตเชิงตรรกะที่แนะนำ; อาจคง deployment รวมกันได้

## 5. การไหลของข้อมูล

```text
Android APK (demo) ─┐
                    ├─> Elysia API / Gateway ─> ตรวจตัวตนและสิทธิ์
GPS provider ───────┘                           │
                                                ├─> PostgreSQL (ผ่าน backend/PostgREST ตามขอบเขต)
                                                └─> ส่งข้อมูลที่อนุญาตให้ Web dashboard
                                                      ├─> รายการรถและสถานะข้อมูล
                                                      ├─> เส้นทางย้อนหลัง/รายงาน
                                                      └─> Three.js 3D presentation
```

หลักการสำคัญ:

1. Web และ APK ส่ง request ไป backend เท่านั้น; ห้ามฝัง database credential หรือเรียกฐานข้อมูลโดยตรงจาก client
2. Backend ตรวจสิทธิ์และ company/workspace scope ทุกครั้งก่อนอ่านหรือเขียนข้อมูล
3. Adapter ของแต่ละแหล่ง GPS แปลงข้อมูลเข้าแบบข้อมูลกลางเดียวกัน
4. เก็บ `recorded_at` (เวลาที่อุปกรณ์วัดตำแหน่ง) และ `received_at` (เวลาที่ server ได้รับ) แยกกัน เพื่อวัดความล่าช้าและทำเครื่องหมายข้อมูลเก่า
5. Three.js แสดงข้อมูลที่ API ส่งให้ ไม่เป็นผู้คำนวณหรือยืนยันความถูกต้องของ GPS เอง

## 6. โดเมนข้อมูลหลัก

| กลุ่ม | ข้อมูลสำคัญ | ข้อสังเกต |
| --- | --- | --- |
| Company / Workspace | `company`: company_id, company_name, workspace_status | ข้อมูลของแต่ละบริษัทแยกด้วย company_id |
| User | `users`: user_id, company_id, role, account_status | Platform Admin มี company_id เป็น null; ไม่มีตาราง membership แยกในเอกสาร |
| Vehicle | `vehicles`, `vehicle_types`: vehicle_code, license_plate, vehicle_status, current_driver_id | ประเภทรถและคนขับต้องอยู่ในบริษัทเดียวกับรถ |
| GPS Source / Device | `gps_devices`: device_code, source_type, provider_name, connection_status | รองรับแหล่ง gps_device, provider_api, driver_mobile_app ตามเอกสาร |
| GPS Position | `gps_locations`: latitude, longitude, speed_kmh, direction_degree, accuracy_meters, recorded_at, received_at | ค่า sensor ที่ไม่มีข้อมูลเป็น null |
| Transport Job | `transport_jobs`: job_id, vehicle_id, driver_id, job_status | เก็บเวลานัดหมาย/เริ่ม/จบและ problem_note |
| Route History | อ่าน `gps_locations` ตาม vehicle_id และ recorded_at | ไม่เพิ่มตารางประวัติเส้นทางนอก Data Dictionary |
| Alert / Geofence | `alerts`, `alert_rules`, `geofences` | มีโครงสร้างตารางแล้ว; API และการประมวลผลเหตุการณ์ยังไม่สร้าง |
| API Integration | `api_integrations`, `api_request_logs` | มีโครงสร้างตารางแล้ว; การออก API Key/Rate Limit ยังไม่สร้าง |
| Audit / Session | `system_log`, `auth_sessions` | ไม่เก็บ password/token จริงใน log; Refresh Token เก็บเป็น hash |

ชื่อตารางและฟิลด์ยึด Data Dictionary ใน PDF เป็นหลัก รายการทุกคอลัมน์อยู่ใน docs/data-dictionary.json; การปรับชนิดข้อมูลสำหรับ PostgreSQL อธิบายใน docs/DATABASE.md

## 7. ขอบเขตตามบทบาท

- **Platform Admin:** อนุมัติ/จัดการบริษัทและ Workspace, ดูสถานะการเชื่อมต่อระดับแพลตฟอร์ม, บริหารบัญชีกลาง, dashboard ภาพรวม และ audit
- **Company Admin:** จัดการผู้ใช้/สิทธิ์ รถ GPS/API connection การมอบหมายงาน และ dashboard/รายงานของบริษัทตัวเอง
- **Dispatcher:** ติดตามตำแหน่ง/สถานะ/คุณภาพข้อมูล GPS ดูเส้นทางและงาน ประสาน Driver และจัดการเหตุการณ์ตามสิทธิ์
- **Driver:** ดูงานของตน เริ่ม/จบงาน ส่งตำแหน่งจากมือถือ แจ้งสถานะหรือปัญหา และดูประวัติงานที่อนุญาต
- **External API Client:** client credential ที่มี scope และผูกกับบริษัท ไม่ใช่บทบาทหน้าจอของผู้ใช้

## 8. ข้อจำกัดของ demo และข้อมูลรถ

- โทรศัพท์เป็นแหล่งข้อมูล GPS สำหรับ demo เท่านั้น; ให้เก็บ `source_type` ชัดเจนเพื่อแยกจาก GPS hardware/vendor
- ความถี่และความแม่นยำขึ้นกับการอนุญาต Location, OS, แบตเตอรี่, เครือข่าย และพฤติกรรมแอป โทรศัพท์อาจหยุดส่งเมื่ออยู่เบื้องหลังหรือ offline
- “เรียลไทม์” หมายถึงข้อมูลล่าสุดที่ได้รับตามรอบส่งและเครือข่าย ไม่รับประกันการอัปเดตต่อเนื่อง
- การระบุความเร็วเกินกำหนดทำได้เมื่อมีข้อมูลความเร็ว/กฎที่กำหนด; การวิเคราะห์พฤติกรรมต้องมีข้อมูลและเกณฑ์ที่รองรับ
- สภาพเครื่องยนต์/ชิ้นส่วนต้องอาศัย sensor, OBD หรือ provider ที่รองรับ พิกัด GPS ไม่พอสำหรับสรุปสุขภาพรถ
- หากไม่มีแผนที่/route provider ที่เลือกไว้ ให้แสดงฉาก 3D demo ที่ติดป้ายชัดเจน ไม่กล่าวอ้างว่าเป็นถนนหรือระยะทางที่แม่นยำ

## 9. ลำดับทำงานที่เข้ากับแผนโครงงาน

1. **พื้นฐาน:** กำหนด schema/migrations, company/workspace, auth/roles, รถ/Driver, GPS provider contract และ endpoint รับตำแหน่ง demo
2. **ปฏิบัติงาน:** หน้า tracking และ route history, Driver APK/demo, งานขนส่ง/assignment, alert, report และตรวจคุณภาพข้อมูล
3. **ขยายระบบ:** geofence, analytics/driver behavior ที่มีข้อมูลรองรับ, API สำหรับลูกค้าองค์กร, dashboard/report เชิงลึก และ hardening ด้านประสิทธิภาพ/ความปลอดภัย

ลำดับนี้อิงแผนใน brief แต่ผู้ใช้สามารถจัดลำดับใหม่ได้ หากเริ่มงานเฉพาะ feature ให้ทำ end-to-end slice ที่เล็กที่สุดและรักษา tenant isolation ตั้งแต่ต้น

## 10. แนวทางให้ Codex ทำงานต่อ

- เริ่มอ่าน root `AGENTS.md`, เอกสารนี้ และ `AGENTS.md` ของโฟลเดอร์ที่จะแก้
- สำรวจไฟล์จริงและ scripts ก่อนแก้; อย่าสมมติว่า target structure มีอยู่แล้ว
- สำหรับงาน UI ให้อ่าน `apps/web/AGENTS.md` และคู่มือ Next.js ใน dependency ที่ติดตั้งอยู่ก่อนแก้ API/framework behavior
- ระบุข้อมูลว่าเป็น live, delayed, unavailable หรือ demo ให้ชัดใน API และ UI
- รักษาการแยกข้อมูลบริษัทที่ API boundary; อย่าส่ง GPS ของบริษัทหนึ่งให้ผู้ใช้อีกบริษัท
- ไม่เพิ่มการเชื่อมต่อผู้ให้บริการ, การเปิดเผยข้อมูล, หรือการใช้ location เกินที่ผู้ใช้อนุญาต
- อัปเดตเอกสารนี้เมื่อมีการสร้าง/ย้าย service หรือเมื่อ target architecture ถูกตัดสินใจจริง

## 11. แหล่งอ้างอิงและหมายเหตุ

เอกสารนี้สรุปจากเอกสารโครงงาน GPS ที่ผู้ใช้แนบ และข้อกำหนดเพิ่มเติมของเจ้าของโครงการเรื่อง Next.js/TypeScript, Elysia, PostgreSQL/PostgREST, Bun, Three.js, Docker และ Android APK สำหรับ demo

Markdown ต้นฉบับมีข้อความบาง bullet ที่แสดงอักขระผิด encoding (mojibake) จึงไม่ถอดความบรรทัดที่อ่านไม่ได้เป็น requirement ใหม่; ให้ยึดหัวข้อและเนื้อหาที่อ่านได้ รวมถึงข้อจำกัดที่ระบุชัดในเอกสาร หากต้องตีความ bullet ที่เสียหาย ให้ตรวจต้นฉบับที่อ่านได้หรือถามเจ้าของโครงการก่อน
