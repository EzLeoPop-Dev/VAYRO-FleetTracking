# VAYRO FleetTracking

โครงเริ่มต้นของระบบติดตามรถหลายบริษัท ใช้ Next.js, Elysia และ Bun workspaces
Backend แบ่งเป็น 12 Service Modules ตามเอกสารโครงการ และมี Navigation Service เพิ่มสำหรับค้นหาที่อยู่/เส้นทาง แต่ละ service ที่เก็บข้อมูลมีฐานข้อมูล PostgreSQL ของตัวเองและใช้ Prisma ส่วนที่มี API แล้วคือ Authentication, User, GPS Device, GPS Data, Vehicle, Transport และการสมัครบริษัท; โมดูลอื่นยังเป็นโครงสำหรับพัฒนาต่อ (ดู README ในแต่ละ `services/*-service`)
ดู [Auth](docs/AUTH.md), [User](docs/USER.md), [ฐานข้อมูลกลาง](docs/DATABASE.md) และ [สัญญาข้อมูล API](docs/API_DATA_CONTRACT.md) รวมถึง [ประวัติเวอร์ชัน](CHANGELOG.md)

หน้าเว็บส่งคำขอเปิด Workspace และเข้าสู่ระบบผ่าน Gateway บัญชีผู้ดูแลคนแรกจะเข้าสู่ระบบได้เมื่อ Workspace เปิดใช้งานแล้ว ส่วน Dashboard ใช้ข้อมูลรถจำลอง

## รันด้วย Docker

Existing installs (old shared `vayro` database): follow "Existing install" in docs/DATABASE.md to move the data into the per-service databases. New volumes set everything up automatically. Do not reset the volume to upgrade.

ติดตั้งและเปิด Docker Desktop (Linux containers) พร้อม Docker Compose v2 แล้วรัน:

```sh
git clone --branch vayro-frontend https://github.com/EzLeoPop-Dev/VAYRO-FleetTracking.git
cd VAYRO-FleetTracking
cp .env.example .env   # PowerShell: Copy-Item .env.example .env
docker compose up --build -d --wait
```

| บริการ | URL บนเครื่อง |
| --- | --- |
| Web dashboard | http://localhost:3000 |
| Gateway | http://localhost:3001 |
| Authentication service | http://localhost:3002 |
| User service | http://localhost:3003 |
| GPS Data service (ingest, latest, history) | http://localhost:3004 |
| Company, Vehicle, GPS Device, Tracking, Route History, Transport, Alert, Reporting, Integration | ผ่าน gateway เท่านั้น (ไม่เปิดพอร์ตออกเครื่อง) |

Each service owns its tables in its own database (auth_db, company_db, user_db, vehicle_db, gps_device_db, gps_data_db, transport_db, alert_db, integration_db). See [shared schema and migration commands](docs/DATABASE.md), [API field contract](docs/API_DATA_CONTRACT.md) and [integration status](docs/INTEGRATION.md).

แต่ละ container ใช้พอร์ต 3000 ภายในและ bind host port เฉพาะ localhost
Compose มี PostgreSQL (ไม่เปิดพอร์ตออกเครื่อง) ที่สร้างฐานข้อมูลต่อ service จาก `infra/database/init/` ตอนสร้าง volume ครั้งแรก ส่วนตารางสร้างโดย Prisma migration ของแต่ละ service ตอน container เริ่มทำงาน
ต้องมี `.env` (`POSTGRES_PASSWORD`, `JWT_SECRET`, `INTERNAL_API_TOKEN`) ก่อนรัน ไม่มีข้อมูล GPS จริงในชุดนี้
gateway ส่งทุก path ใน /api/v1 ไป service ที่เป็นเจ้าของตามตาราง route ใน `gateway/src/index.ts`; service เรียกกันเองผ่าน /internal/* (gateway ไม่ส่งต่อ)
health check ตรวจ HTTP `/` ของแต่ละบริการ ไม่ได้ตรวจฟังก์ชันธุรกิจ

```sh
docker compose ps
docker compose logs -f
docker compose down
```

หากพอร์ตชน ให้คัดลอก `.env.example` เป็น `.env` แล้วเปลี่ยน `WEB_PORT`, `GATEWAY_PORT` หรือ `AUTH_PORT`
จากนั้นรัน `docker compose up -d --wait` ใหม่ ห้าม commit `.env` หรือ credentials
การ build ครั้งแรกต้องใช้อินเทอร์เน็ตเพื่อดึง image และ packages
Docker ใช้ Bun 1.3.14 และ root `bun.lock` ด้วย `--frozen-lockfile`

## พัฒนาโดยไม่ใช้ Docker

ติดตั้ง Bun 1.3.14 แล้วรัน:

```sh
bun install --frozen-lockfile
bun run db:generate   # สร้าง Prisma client ของแต่ละ service
bun run dev:web
```

เปิด [หน้าเข้าสู่ระบบ](http://localhost:3000/login) แล้วใช้บัญชีที่เปิดใช้งานเพื่อเข้า Dashboard ติดตามรถจำลองในกรุงเทพฯ และปริมณฑล เว็บบนเครื่องเรียก Gateway ที่ `http://127.0.0.1:3001` โดยค่าเริ่มต้น หากใช้พอร์ตอื่นให้กำหนด `API_URL` ใน environment ของเว็บ [ดูวิธีเตรียมบัญชีและทดสอบ Login](docs/AUTH.md#web-appsweb)
หน้าเริ่มต้นใช้โหมด 3D เพื่อแสดงโมเดลรถบรรทุก รถยนต์ และมอเตอร์ไซค์ตามพิกัดและทิศทางของรถจำลอง สลับเป็นหมุด 2D ได้จากแถบเครื่องมือแผนที่
แผนที่เต็มหน้าจอพร้อมแผงรายการรถด้านขวาและรายละเอียดรถที่เลือกด้านซ้ายล่าง บนมือถือกดปุ่มรายการรถเพื่อเปิดแผง
Bottom Bar ทรงแคปซูลใช้สลับระหว่างแผนที่ รถ คนขับ งาน และเพิ่มเติม ส่วนเมนูจัดหน้าจอด้านขวาใช้เปิดหรือปิดแผงบนแผนที่
เมนูรถเปิดหน้าต่างจัดการรถเหนือแผนที่ ค้นหาทะเบียนหรือคนขับและกรองตามประเภทรถได้ ลากแถบชื่อเพื่อย้ายหน้าต่างบนเดสก์ท็อป หรือใช้ปุ่มบนแถบชื่อเพื่อปิด ย่อ และขยาย
Company Admin ใช้ **Manage → เพิ่มรถ** ใน Bottom Bar เพื่อบันทึกรถ ประเภท สถานะ และคนขับประจำรถผ่าน Gateway ลงฐานข้อมูลจริง โดยยังไม่ต้องตั้งค่า GPS รายการและการแก้ไขคงอยู่หลังรีเฟรช
Company Admin กดโปรไฟล์ที่มุมซ้ายบนของแผนที่หรือเปิด **เพิ่มเติม → TestRole** เพื่อสลับมุมมองจำลองระหว่าง Dispatch และ Admin ของบริษัท Dispatch ใช้แผนที่ งาน และเพิ่มเติม ส่วน Admin มีเมนูภาพรวม รถ และคนขับเพิ่ม ตัวเลือกนี้มีผลกับหน้าจอเดโมในแท็บปัจจุบัน
บนแผนที่ เปิด **จัดหน้าจอแผนที่ → แจ้งเตือน** เพื่อดูเหตุการณ์จำลองพร้อมทะเบียนและรหัสรถ กดรายการเพื่อดูรถบนแผนที่ เกณฑ์ความเร็วใช้ข้อมูลเดโม ส่วนเหตุออกนอกเส้นทางและรถเสียเป็นเหตุการณ์ตัวอย่าง
ปุ่ม **จัดหน้าจอแผนที่** เปิดเมนูวงกลมกลางจอสำหรับเปิดหรือซ่อนแผง กดปุ่มกลางวงหรือ Escape เพื่อปิดเมนู
แผงแจ้งเตือนและรายการรถเปิดพร้อมกันได้ ลากตัวจับหกจุดเพื่อย้ายแผงสรุปสถานะ รายการรถ รายละเอียดรถ หรือแจ้งเตือน กดปุ่มลูกศรบนหัวแผงเพื่อย่อหรือขยายข้อมูล เมื่อโฟกัสที่ตัวจับ ใช้ปุ่มลูกศรบนคีย์บอร์ดเพื่อขยับแผงและกด Home เพื่อคืนตำแหน่งเริ่มต้น
ลากสัญลักษณ์เส้นเฉียงที่มุมแผงเพื่อปรับความกว้างและความสูง เมื่อโฟกัสที่สัญลักษณ์ ใช้ปุ่มลูกศรปรับขนาดและกด Home เพื่อคืนขนาดกับตำแหน่งเริ่มต้น
เมนู **ภาพรวม** เปิดหน้าต่างลอยเหนือแผนที่เช่นเดียวกับเมนูรถ สรุปจำนวนพนักงานขับรถและรถตามประเภทจากข้อมูลจำลอง แสดงสถานะการจัดรถและสถานะ GPS ในคนละส่วน
แผนที่ใช้ MapLibre GL JS กับ [OpenFreeMap](https://openfreemap.org/) ซึ่งไม่ต้องใช้ API key สำหรับ public instance
เบราว์เซอร์ต้องเข้าถึงบริการแผนที่และรองรับ WebGL เพื่อดูแผนที่ถนนแบบโต้ตอบ

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

Company Admin ใช้ **Manage → จัดการงาน** เพื่อสร้างและมอบหมายงานจริงให้ Driver โดยเลือกจุดรับ–ส่งจากการค้นหาสถานที่และคำนวณเส้นทางถนน คนขับ Login เข้า /driver เพื่อรับงาน เริ่มงาน แจ้งปัญหา ทำงานต่อ จบงาน และดูประวัติ สถานะเก็บใน PostgreSQL การนำทางรอบนี้เป็นเส้นทางถนนให้เลือกดูเอง ยังไม่ใช้ GPS หรือตรวจระยะใกล้ปลายทาง และยังไม่รองรับข้อจำกัดรถบรรทุกโดยเฉพาะ
