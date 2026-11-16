# VAYRO FleetTracking

This branch delivers Backend APIs only. The web prototype previously tested locally is not included in this Backend change; the committed web remains the original Next.js scaffold. Frontend integration is owned separately.

โครงเริ่มต้นของระบบติดตามรถหลายบริษัท ใช้ Next.js, Elysia และ Bun workspaces
Backend แบ่งเป็น 12 Service Modules ตามเอกสารโครงการ (หน้า 18-26) แต่ละ service ที่เก็บข้อมูลมีฐานข้อมูล PostgreSQL ของตัวเองและใช้ Prisma ที่ทำเสร็จแล้ว: Authentication, User, GPS Device, GPS Data และส่วนสมัครบริษัท; ที่เหลือมีชั้นข้อมูลและโครงเปล่าพร้อมให้ทีมต่อ (ดู README ในแต่ละ `services/*-service`)
ดู [Auth](docs/AUTH.md), [User](docs/USER.md), [ฐานข้อมูลกลาง](docs/DATABASE.md) และ [สัญญาข้อมูล API](docs/API_DATA_CONTRACT.md); API ของโมดูลธุรกิจอื่นยังไม่ได้สร้าง

## รันด้วย Docker

Existing installs (old shared `vayro` database): follow "Existing install" in docs/DATABASE.md to move the data into the per-service databases. New volumes set everything up automatically. Do not reset the volume to upgrade.

ติดตั้งและเปิด Docker Desktop (Linux containers) พร้อม Docker Compose v2 แล้วรัน:

```sh
git clone https://github.com/aphiluk/VAYRO-FleetTracking.git
cd VAYRO-FleetTracking
cp .env.example .env   # PowerShell: Copy-Item .env.example .env
docker compose up --build -d --wait
```

| บริการ | URL บนเครื่อง |
| --- | --- |
| Web (optional; separate Frontend work) | http://localhost:3000 |
| Gateway | http://localhost:3001 |
| Authentication service | http://localhost:3002 |
| User service | http://localhost:3003 |
| GPS Data service (ingest, latest, history) | http://localhost:3004 |
| Company, Vehicle, GPS Device, Tracking, Route History, Transport, Alert, Reporting, Integration | ผ่าน gateway เท่านั้น (ไม่เปิดพอร์ตออกเครื่อง) |

Each service owns its tables in its own database (auth_db, company_db, user_db, vehicle_db, gps_device_db, gps_data_db, transport_db, alert_db, integration_db). See [shared schema and migration commands](docs/DATABASE.md), [API field contract](docs/API_DATA_CONTRACT.md) and [integration status](docs/INTEGRATION.md).

แต่ละ container ใช้พอร์ต 3000 ภายในและ bind host port เฉพาะ localhost
Compose มี PostgreSQL (ไม่เปิดพอร์ตออกเครื่อง) ที่สร้างฐานข้อมูลต่อ service จาก `infra/database/init/` ตอนสร้าง volume ครั้งแรก ส่วนตารางสร้างโดย Prisma migration ของแต่ละ service ตอน container เริ่มทำงาน
ต้องมี `.env` (`POSTGRES_PASSWORD`, `DB_PASSWORD_<SERVICE>` ของแต่ละฐาน 9 ตัว, `JWT_SECRET`, `INTERNAL_API_TOKEN`) ก่อนรัน แต่ละ service ได้รหัสของฐานตัวเองเท่านั้น ไม่รู้รหัสแอดมินของ Postgres ไม่มีข้อมูล GPS จริงในชุดนี้
gateway ส่งทุก path ใน /api/v1 ไป service ที่เป็นเจ้าของตามตาราง route ใน `gateway/src/index.ts`; service เรียกกันเองผ่าน /internal/* (gateway ไม่ส่งต่อ)
health check ตรวจ HTTP `/` ของแต่ละบริการ ไม่ได้ตรวจฟังก์ชันธุรกิจ

```sh
docker compose ps
docker compose logs -f
docker compose down
```

หากพอร์ตชน ให้คัดลอก `.env.example` เป็น `.env` แล้วเปลี่ยน `WEB_PORT`, `GATEWAY_PORT` หรือ `AUTH_PORT`
จากนั้นรัน `docker compose up -d --wait` ใหม่ ห้าม commit `.env` หรือ credentials
การ build ครั้งแรกต้องใช้อินเทอร์เน็ตเพื่อดึง image, packages และ Google Fonts ของหน้าเว็บเริ่มต้น
Docker ใช้ Bun 1.3.14 และ root `bun.lock` ด้วย `--frozen-lockfile`

## พัฒนาโดยไม่ใช้ Docker

ติดตั้ง Bun 1.3.14 แล้วรัน:

```sh
bun install --frozen-lockfile
bun run db:generate   # สร้าง Prisma client ของแต่ละ service
bun run dev:web
```

เปิด terminal เพิ่มสำหรับแต่ละ API (ตัวอย่าง PowerShell):

```powershell
$env:PORT=3001
bun run dev:gateway
```

```powershell
$env:PORT=3002
bun run dev:auth
```

บน macOS/Linux ใช้ `PORT=3001 bun run dev:gateway` และ `PORT=3002 bun run dev:auth`
การรัน service เดี่ยว ๆ ต้องตั้ง `DATABASE_URL`, `INTERNAL_API_TOKEN` และ URL ของ service ที่มันเรียก (ดู `compose.yaml`)

อ่าน [โครงสร้างและขอบเขตโครงการ](docs/PROJECT_STRUCTURE.md) และ [คู่มือสำหรับ agent](AGENTS.md) ก่อนพัฒนาต่อ
ชุดนี้เตรียมสำหรับรันในเครื่อง ยังต้องพัฒนา business logic อื่นและตรวจความปลอดภัยก่อนใช้งานจริง
