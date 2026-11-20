# ทดสอบ Backend ด้วย Postman

ฐานข้อมูล local ปัจจุบันมีครบ 14 ตารางตาม Data Dictionary แล้ว สำหรับฐานเดิมให้รัน migrations 002 และ 003 ตาม ../DATABASE.md ก่อนใช้ GPS ส่วน API ของ Vehicle/Job/Alert และโมดูลอื่นยังไม่ได้ทำในงานนี้

1. รัน `docker compose up --build -d --wait postgres auth-service user-service gateway` จาก root (ไม่ต้องรันเว็บ)
2. Import `VAYRO.postman_collection.json` และ `local.postman_environment.json` ใน Postman
3. เลือก environment `VAYRO Local (fill credentials locally)`
4. ใส่ `login_email`, `login_password` ของ Company Admin ทดสอบที่บัญชีและ Workspace เป็น active และตั้ง `new_user_password` เป็นรหัสทดสอบ 10-128 ตัวอักษร
5. กด Send ตามหมายเลข 01-15 หรือใช้ Collection Runner; Login/Refresh จะเก็บ token ลง environment ให้อัตโนมัติ

ใช้ฐานข้อมูล local และบัญชีทดสอบเท่านั้น: ชุดนี้แก้ชื่อบัญชีที่ Login, สร้างพนักงานใหม่, เปลี่ยน role และระงับพนักงานทดสอบ โดยไม่ลบข้อมูลหลังรัน
การสมัครบริษัทและอนุมัติ Workspace เป็น Company Service จึงไม่รวมใน collection นี้; สำหรับ local สามารถสร้างข้อมูลทดสอบและตรวจระบบเดิมด้วย `node services/auth-service/test/e2e.mjs` หรือตั้งบัญชีผ่านผู้ดูแลฐานข้อมูล

`user_id` ใช้เฉพาะพนักงานที่สร้างในขั้น 09; หากขั้นนั้นล้มเหลวให้แก้สาเหตุก่อนเรียกขั้น 10-13 อย่าแทนด้วยบัญชีจริง
Token ที่แก้ไขในขั้น 04 เป็น negative test: ผลที่ถูกต้องคือ HTTP 401 เพราะลายเซ็นไม่ถูกต้อง ไม่ใช่การออก token ปลอมให้ใช้งาน
หลัง Logout ขั้น 15 ต้องได้ 401 เช่นกัน ส่วน Company Admin จัดการคนต่างบริษัทต้องได้ 404; Driver/Dispatcher จัดการผู้ใช้อื่นต้องได้ 403 (ตรวจใน E2E เพิ่มเติม)

ห้าม export/share environment ที่กรอก password หรือ token แล้ว ตรวจและล้างค่าก่อนนำไฟล์ขึ้น Git; ไฟล์ตัวอย่างใน repo ไม่มี secret จริง
User API รองรับ Platform Admin และ Company Admin แล้ว ดูสัญญา API และคำสั่งตั้ง Platform Admin คนแรกใน ../USER.md


## Platform Admin

Import VAYRO.Platform.postman_collection.json พร้อม environment เดิม ตั้ง platform_email, platform_password, company_id ของ Workspace ที่มีอยู่ และ new_user_password แล้วรันชุดนี้แยกจากชุด Company Admin ระบบจะใช้ platform_access_token / platform_refresh_token / platform_user_id แยกกัน

ชุดนี้มี 12 requests และจะแก้โปรไฟล์บัญชีทดสอบ สร้างและระงับพนักงานทดสอบในบริษัทที่เลือก POST /users ตอบ 201 ตามเอกสาร


## GPS Device / GPS Data (PostgreSQL)

Import VAYRO.GPS.postman_collection.json และใช้ environment เดิม ไฟล์ตัวอย่างไม่มีรหัสผ่านหรือ token จริง

1. ตั้ง login_email/login_password ของ Company Admin ทดสอบที่ Workspace active แล้ว Login เพื่อดู company_id ของตน
2. ต้องมีรถในบริษัทนั้นจริง เพราะฐานข้อมูลตรวจ Foreign Key แล้ว ขณะนี้ Vehicle API ยังไม่ได้สร้าง ผู้ดูแล local สามารถเตรียมรถทดสอบผ่าน SQL ได้ โดยเปลี่ยน 123 เป็น company_id จริงก่อนรัน:

```powershell
docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U vayro -d vayro -c "INSERT INTO vehicles(company_id,vehicle_code,license_plate) VALUES (123,'DEMO-001','DEMO-001') RETURNING vehicle_id;"
```

3. ตั้ง vehicle_id ใน Postman เป็น ID ที่ได้ (ชนิด string) และ device_code เป็นรหัสทดสอบ เช่น gps-postman-local
4. ตั้ง TRACKING_API_TOKENS ใน environment ส่วนตัวหรือ .env ที่ไม่ขึ้น Git ให้มี token สุ่มส่วนตัวอย่างน้อย 24 ตัวอักษร โดย value เป็น {"role":"gps_device","company_id":"123","device_code":"gps-postman-local"} เปลี่ยน company_id ให้ตรงกับบัญชีทดสอบ ชื่อ companyId/deviceIdentifier แบบเดิมใช้ไม่ได้แล้ว
5. Recreate Tracking เพื่อโหลดค่า แล้วใส่ token เดียวกันในตัวแปร device_token ของ Postman ห้ามนำ token จริงไปใส่ collection หรือไฟล์ตัวอย่าง
6. เรียกตามลำดับ 01-10: สร้าง/อ่าน/แก้อุปกรณ์ ส่งพิกัด อ่านล่าสุด/ย้อนหลัง และตรวจว่าปิดการเชื่อมต่อโดยไม่ลบประวัติ

POST สร้างอุปกรณ์ที่ device_code ซ้ำในบริษัทเดิมจะได้ 409 ถ้าเคยสร้างแล้วให้ GET รายการ เลือก gps_device_id ของอุปกรณ์ทดสอบตัวเดิม และข้ามขั้น 02; ห้ามแทนด้วยอุปกรณ์จริง GPS external_record_id ใช้ GUID ใหม่ต่อ request เพื่อไม่ชนของเดิม

GPS ใช้ speed_kmh, direction_degree, accuracy_meters, gps_location_id และ ID แบบ string ตามเอกสาร ฟิลด์ sensor ที่ไม่มีค่าเป็น null ได้; ชื่อ speed_kph/heading/accuracy_m เดิมถูกปฏิเสธ ไม่มี alias ที่ทำให้ชื่อข้อมูลต่างกันเงียบ ๆ

ชุดทดสอบ restart จริงที่ไม่ต้องเตรียม device token เอง ใช้ Driver JWT กับรถ/งานที่มอบหมาย และเตรียม fixture เฉพาะ local ให้อัตโนมัติ:

```sh
node services/tracking-service/test/e2e.mjs
```

คำสั่งนี้สร้างข้อมูลทดสอบและ restart เฉพาะ Tracking Service แล้วตรวจว่าอุปกรณ์/พิกัดยังอยู่ใน PostgreSQL ไม่ลบข้อมูลหลังรัน


## Services 8, 9, 10, 12 (Route History, Transport Job, Alert & Geofence, Integration & Logging)

Import `VAYRO.Services.8-9-10-12.postman_collection.json` และ `local.postman_environment.json` (เพิ่มตัวแปร `driver_email`, `driver_password`, `job_id`, `external_api_key` ฯลฯ ให้แล้ว ค่าว่างทั้งหมด) แล้วรัน `00 Setup` ก่อน จากนั้น 09, 10, 08, 12 ตามลำดับ ไฟล์ตัวอย่างไม่มี password หรือ token จริง

### เตรียมก่อนรัน

1. รัน stack ให้ครบ: `docker compose up --build -d --wait` (ต้องเป็นเวอร์ชันที่มี 4 service นี้ และ Postgres เริ่มจากฐานใหม่หรือ migrate แล้ว: alert-service มี migration ใหม่ `20261118000000_audit_log_and_signal_state`)
2. ถ้าต้องการให้ overspeed / geofence / GPS offline ทำงาน ให้ใส่ใน `.env` แล้ว recreate gps-data-service:

   ```powershell
   # .env
   GPS_EVENT_SUBSCRIBERS=http://alert-service:3000
   docker compose up -d gps-data-service
   ```

   ถ้าไม่ตั้ง alert จาก GPS จะไม่เกิด (alert จากงานขนส่งยังเกิดตามปกติ)
3. Company Admin ที่ Workspace เป็น `active` ตั้ง `login_email` / `login_password` ตามชุดเดิม
4. สร้าง Driver ในบริษัทเดียวกัน (เรียกครั้งเดียวด้วย token ของ Company Admin, ใช้ request `09 Create test employee` ในชุด Authentication แล้วเปลี่ยน `"role"` เป็น `"driver"`) ใส่ email/password ลง `driver_email`, `driver_password`
5. ต้องมีรถ `active` ของบริษัทนั้นและตั้ง `vehicle_id` ใน environment (Vehicle API ยังไม่มี จึงเตรียมด้วย SQL ได้ ตัวอย่างด้านล่าง เปลี่ยน `123` เป็น `company_id` จริงและ `456` เป็น `user_id` ของ Driver)

   ```powershell
   docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U vayro -d vehicle_db -c "INSERT INTO vehicles(company_id,vehicle_code,license_plate,current_driver_id) VALUES (123,'PM-001','PM-001',456) RETURNING vehicle_id;"
   ```

   `current_driver_id` ต้องเป็น Driver คนนั้น ไม่เช่นนั้น `/gps/ingest` จากมือถือจะถูกปฏิเสธ (งานที่ assign จะตอบ `warnings: ["vehicle_current_driver_differs"]`)
6. เมื่ออยากส่งพิกัดจริงจาก Driver: ต้องมีอุปกรณ์ `driver_mobile_app` ผูกกับรถ (ใน `gps_device_db` ตาราง `gps_devices`) และงาน `in_progress` ซึ่งขั้น 09.14 ทำให้ ส่วนพิกัดใช้ `POST /gps/ingest` ตามชุด GPS เดิม

### ทดสอบเหตุการณ์ GPS (หลังตั้ง `GPS_EVENT_SUBSCRIBERS`)

- **Overspeed:** สร้างกฎ overspeed (10.01) แล้วส่งพิกัดที่ `speed_kmh` เกินเกณฑ์ ได้ alert `overspeed` หนึ่งรายการ ส่งซ้ำภายใน 10 นาทีไม่เกิดรายการใหม่ ตราบที่รายการแรกยังไม่ resolve
- **Geofence:** สร้างวง (10.09) ส่งพิกัดนอกวง แล้วส่งพิกัดในวง ได้ `geofence_enter` (พิกัดแรกสุดของรถเป็นแค่จุดเริ่ม ไม่เกิด alert)
- **GPS offline:** สร้างกฎ `gps_offline` 5 นาที ส่งพิกัดหนึ่งจุด แล้วรอเกินเวลา (ตัวตรวจรันทุก 60 วินาที) ได้ alert `gps_offline` หนึ่งรายการต่อการหายหนึ่งครั้ง
- พิกัดที่ช้า (`freshness = delayed`) หรือผิดปกติ (`null_island`, `impossible_speed`) ไม่ทำให้เกิด overspeed/geofence และไม่เลื่อนตำแหน่งปัจจุบันของรถ

### ส่วนที่ทดสอบผ่าน Postman ไม่ได้

`POST /internal/api-keys/verify` และ `/internal/request-logs` เป็น internal (gateway ไม่ส่งต่อ) ใช้ `x-internal-token` ซึ่งเป็นค่า `INTERNAL_API_TOKEN` ใน `.env` เรียกจากใน container ได้ เช่น (รูปแบบการ quote ต่างกันตาม shell):

```powershell
docker compose exec -T integration-service bun -e "const r = await fetch('http://localhost:3000/internal/api-keys/verify', {method:'POST', headers:{'content-type':'application/json','x-internal-token':process.env.INTERNAL_API_TOKEN}, body: JSON.stringify({api_key:'<external_api_key>', permission:'vehicles:read'})}); console.log(r.status, await r.text())"
```

ตอนนี้ยังไม่มีตัวไหนเรียก verify อัตโนมัติ (ดู "Not done yet" ใน `services/integration-service/README.md`)
