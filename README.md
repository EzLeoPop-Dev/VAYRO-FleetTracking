# VAYRO FleetTracking

โครงเริ่มต้นของระบบติดตามรถหลายบริษัท ใช้ Next.js, Elysia และ Bun workspaces
Backend ปัจจุบันมี Authentication, User และ GPS Device/Data ที่บันทึก PostgreSQL โดยใช้ schema ครบ 14 ตารางตาม Data Dictionary
ดู [Auth](docs/AUTH.md), [User](docs/USER.md), [ฐานข้อมูลกลาง](docs/DATABASE.md) และ [สัญญาข้อมูล API](docs/API_DATA_CONTRACT.md); API ของโมดูลธุรกิจอื่นยังไม่ได้สร้าง

หน้าเว็บเปิด Dashboard ติดตามรถจำลอง และมีหน้า Login/Register ทดลอง การเชื่อมหน้าเว็บกับ API เป็นงานขั้นถัดไป

## รันด้วย Docker

Existing databases: apply migrations 002 and 003 using docs/DATABASE.md before using the GPS endpoints. New volumes initialize all fourteen tables automatically. Do not reset the volume to upgrade.

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
| GPS Device/Data (PostgreSQL) | http://localhost:3004 |

The Backend schema contains all 14 Data Dictionary tables, with PostgreSQL-backed GPS Device/Data. See [shared schema and migration commands](docs/DATABASE.md), [API field contract](docs/API_DATA_CONTRACT.md) and [integration status](docs/INTEGRATION.md).

แต่ละ container ใช้พอร์ต 3000 ภายในและ bind host port เฉพาะ localhost
Compose มี PostgreSQL (ไม่เปิดพอร์ตออกเครื่อง) ที่สร้างตารางจาก `infra/database/*.sql` ตอนสร้าง volume ครั้งแรก
ต้องมี `.env` (`POSTGRES_PASSWORD`, `JWT_SECRET`) ก่อนรัน ไม่มีข้อมูล GPS จริงในชุดนี้
gateway ส่ง /api/v1/auth, /api/v1/users และ /api/v1/gps* ไป Backend ที่เกี่ยวข้อง โดยใช้ PostgreSQL เดียวกัน
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
bun run dev:web
```

เปิด [Dashboard](http://localhost:3000/dashboard) เพื่อทดลองติดตามรถจำลองในกรุงเทพฯ และปริมณฑล
หน้าเริ่มต้นใช้โหมด 3D เพื่อแสดงโมเดลรถบรรทุก รถยนต์ และมอเตอร์ไซค์ตามพิกัดและทิศทางของรถจำลอง สลับเป็นหมุด 2D ได้จากแถบเครื่องมือแผนที่
แผนที่เต็มหน้าจอพร้อมแผงรายการรถด้านขวาและรายละเอียดรถที่เลือกด้านซ้ายล่าง บนมือถือกดปุ่มรายการรถเพื่อเปิดแผง
Bottom Bar ทรงแคปซูลใช้สลับระหว่างแผนที่ รถ คนขับ งาน และเพิ่มเติม ส่วนเมนูจัดหน้าจอด้านขวาใช้เปิดหรือปิดแผงบนแผนที่
เมนูรถเปิดหน้าต่างจัดการรถเหนือแผนที่ ค้นหาทะเบียนหรือคนขับและกรองตามประเภทรถได้ ลากแถบชื่อเพื่อย้ายหน้าต่างบนเดสก์ท็อป หรือใช้ปุ่มบนแถบชื่อเพื่อปิด ย่อ และขยาย
กดโปรไฟล์บัญชีทดลองที่มุมซ้ายบนของแผนที่หรือเปิด **เพิ่มเติม → TestRole** เพื่อสลับมุมมองจำลองระหว่าง Dispatch และ Admin ของบริษัท Dispatch ใช้แผนที่ งาน และเพิ่มเติม ส่วน Admin มีเมนูภาพรวม รถ และคนขับเพิ่ม บทบาทที่เลือกจะคงอยู่เมื่อรีเฟรชแท็บเดิมและไม่เปลี่ยนสิทธิ์บัญชี
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
สคริปต์สำหรับ User และ GPS คือ `bun run dev:user` และ `bun run dev:tracking` ตั้งค่า PostgreSQL และตัวแปรสภาพแวดล้อมตามเอกสารของแต่ละบริการก่อนรัน ส่วน `dev:vehicle` และ `dev:notification` ยังไม่มี service รองรับ

อ่าน [โครงสร้างและขอบเขตโครงการ](docs/PROJECT_STRUCTURE.md) และ [คู่มือสำหรับ agent](AGENTS.md) ก่อนพัฒนาต่อ
ชุดนี้เตรียมสำหรับรันในเครื่อง ยังต้องพัฒนา business logic อื่นและตรวจความปลอดภัยก่อนใช้งานจริง
