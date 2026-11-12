# VAYRO FleetTracking

โครงเริ่มต้นของระบบติดตามรถหลายบริษัท ใช้ Next.js, Elysia และ Bun workspaces
หน้าแรกเปิด Dashboard ติดตามรถจำลอง ส่วน gateway/auth-service ยังเป็น scaffold ที่ตอบ `Hello Elysia`
หน้า `/login` และ `/register` เป็นแบบทดลอง ระบบบัญชีและ GPS จริงยังไม่ได้เชื่อมต่อ

## รันด้วย Docker

ติดตั้งและเปิด Docker Desktop (Linux containers) พร้อม Docker Compose v2 แล้วรัน:

```sh
git clone https://github.com/aphiluk/VAYRO-FleetTracking.git
cd VAYRO-FleetTracking
docker compose up --build -d --wait
```

| บริการ | URL บนเครื่อง |
| --- | --- |
| Web | http://localhost:3000 |
| Gateway | http://localhost:3001 |
| Auth service | http://localhost:3002 |

แต่ละ container ใช้พอร์ต 3000 ภายในและ bind host port เฉพาะ localhost
ไม่มีฐานข้อมูลหรือข้อมูล GPS จริงในชุด Compose นี้
บริการไม่ได้เรียกหากันใน scaffold ปัจจุบัน จึงยังไม่กำหนดลำดับเริ่มต้น
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
ไม่ควรเรียก `dev:vehicle`, `dev:tracking` หรือ `dev:notification` เพราะยังไม่มี service เหล่านั้น

อ่าน [โครงสร้างและขอบเขตโครงการ](docs/PROJECT_STRUCTURE.md) และ [คู่มือสำหรับ agent](AGENTS.md) ก่อนพัฒนาต่อ
ชุดนี้เตรียมสำหรับรัน scaffold ในเครื่อง ยังต้องพัฒนาการยืนยันตัวตนและ business logic ก่อนใช้งานจริง
