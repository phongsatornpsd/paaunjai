# ป่าอุ่นใจ · สมุดรายรับรายจ่ายครอบครัว

เว็บแอป HTML/JS ล้วน (ไม่ต้อง build) + Supabase (ฐานข้อมูล, ล็อกอิน, เก็บรูปใบเสร็จ)
วางบน GitHub Pages ได้ฟรีทั้งหมด

- ถ้า `js/config.js` ยังว่าง แอปจะเปิดใน **โหมดทดลอง** (เก็บข้อมูลในเครื่อง)
- สิทธิ์ทั้งหมดตรวจที่ฐานข้อมูล (Row Level Security) — รายการ "ส่วนตัว" ของคนอื่นจะเห็นแค่ยอดเงิน ไม่เห็นโน้ต/ใบเสร็จ

---

## ขั้นตอนขึ้นระบบจริง (ประมาณ 20 นาที)

### 1) สร้างฐานข้อมูลที่ Supabase
1. สมัครที่ https://supabase.com → **New project**
   - Region: **Southeast Asia (Singapore)**
   - ตั้ง Database Password แล้วจดเก็บไว้
2. เมนูซ้าย **SQL Editor** → **New query** → เปิดไฟล์ `supabase/schema.sql` คัดลอกทั้งหมดไปวาง → **Run**
   (ต้องขึ้นว่า Success)
3. เมนู **Project Settings → API** จดค่า 2 อย่าง:
   - **Project URL** (เช่น `https://abcd1234.supabase.co`)
   - **Publishable key** (`sb_publishable_...` หรือ anon key แบบเดิม `eyJ...`) — เปิดเผยได้ ปลอดภัยเพราะสิทธิ์คุมที่ฐานข้อมูล ห้ามใช้ secret key
4. เปิดไฟล์ `js/config.js` ใส่ 2 ค่านี้ลงไป

### 2) วางเว็บบน GitHub Pages
1. GitHub → **New repository** ชื่อเช่น `paaunjai` → เลือก **Public** → Create
   (GitHub Pages ฟรีต้องเป็น Public — โค้ดเห็นได้ แต่ข้อมูลการเงินอยู่ใน Supabase ไม่ได้อยู่ในโค้ด)
2. กด **uploading an existing file** → ลากไฟล์และโฟลเดอร์ทั้งหมดในโฟลเดอร์นี้ไปวาง → **Commit changes**
   (ถ้าโฟลเดอร์ `.github` ไม่ขึ้นตอนลาก ให้สร้างไฟล์ `.github/workflows/keepalive.yml` ด้วยปุ่ม Add file → Create new file แล้ววางเนื้อหา)
3. **Settings → Pages** → Source: **Deploy from a branch** → Branch: `main` / `/ (root)` → Save
4. รอ 1–2 นาที จะได้ลิงก์ `https://<ชื่อผู้ใช้>.github.io/paaunjai/`

### 2.5) ปิดการยืนยันอีเมล
Supabase → **Authentication → Sign In / Providers → Email** → ปิด **Confirm email** → Save
(ระบบอีเมลฟรีของ Supabase ส่งได้ 2 ฉบับ/ชั่วโมง และส่งถึงเฉพาะทีมงานของโปรเจกต์ — คนในบ้านจะสมัครไม่ผ่านถ้าเปิดไว้)

### 3) ตั้งค่าลิงก์ล็อกอินใน Supabase
**Authentication → URL Configuration**
- Site URL: `https://<ชื่อผู้ใช้>.github.io/paaunjai/`
- Redirect URLs: เพิ่มลิงก์เดียวกัน

(อีเมลยืนยัน/ลืมรหัสผ่าน จะพากลับมาที่เว็บนี้)

### 4) สมัครและตั้งตัวเองเป็น Admin
1. เปิดเว็บ → สมัครสมาชิกด้วยอีเมล (เข้าระบบได้ทันที ไม่ต้องยืนยันอีเมล)
2. Supabase → SQL Editor รัน (เปลี่ยนอีเมลเป็นของคุณ):
   ```sql
   update public.profiles set is_admin = true
   where id = (select id from auth.users where email = 'อีเมลของคุณ');
   ```

### 5) กันฐานข้อมูลหลับ (แผนฟรีจะหยุดถ้าไม่มีคนใช้ 7 วัน)
GitHub repo → **Settings → Secrets and variables → Actions → New repository secret**
- `SUPABASE_URL` = Project URL
- `SUPABASE_ANON_KEY` = anon key

แล้วไปที่แท็บ **Actions** → เปิดใช้ workflow `keep-supabase-awake` (จะ ping ทุก 3 วัน)

### 6) ติดตั้งเป็นแอปบนมือถือ
- iPhone: เปิดลิงก์ใน Safari → ปุ่มแชร์ → **Add to Home Screen**
- Android: เปิดใน Chrome → เมนู ⋮ → **Install app / เพิ่มลงในหน้าจอหลัก**

### 7) เชิญคนในบ้าน
แท็บ **บ้าน** → **คัดลอกลิงก์เชิญ** ส่งทาง LINE ได้เลย คนที่กดลิงก์จะสมัคร แล้วเข้าบ้านให้อัตโนมัติ

---

## สำหรับ Admin
ปุ่ม **จัดการทุกบ้าน (Admin)** บนหน้าเกาะ:
- ดูรายจ่ายเดือนนี้ของทุกบ้าน และติ๊กเลือกบ้านที่จะรวมยอด
- บ้านที่ไม่มีรายการใหม่เกิน 60 วันจะขึ้นป้าย "ไม่ได้ใช้งาน"
- **จัดการ** แต่ละบ้าน: เพิ่มสมาชิกด้วยอีเมล (ต้องสมัครไว้แล้ว), นำออก, ตั้ง/ปลดเจ้าของบ้าน
- **ลบบ้าน**: ต้องพิมพ์ชื่อบ้านยืนยัน ลบรายการ โปรเจค ยอดตั้งต้น ค่าใช้จ่ายรายปี และรูปใบเสร็จของบ้านนั้นทั้งหมด (กู้คืนไม่ได้)

> ถ้าเคยรัน `schema.sql` เวอร์ชันก่อนไปแล้ว ให้รันไฟล์ใหม่ทับได้เลย (รันซ้ำได้ ข้อมูลเดิมไม่หาย)

## ลืมรหัสผ่าน
Admin รันใน SQL Editor:
```sql
update auth.users set encrypted_password = crypt('ChangeMe123', gen_salt('bf')) where email = 'mom@gmail.com';
```

## สำรองข้อมูล
- แผนฟรีของ Supabase ไม่มี backup อัตโนมัติ
- ระหว่างนี้: แท็บ **บ้าน → ส่งออก Excel (CSV)** เป็นประจำ (เช่น เดือนละครั้ง)
- **อย่า** ตั้ง backup ฐานข้อมูลอัตโนมัติใน repo นี้ เพราะเป็น Public — ไฟล์ backup จะเปิดดูได้

## โครงสร้างไฟล์
```
index.html            หน้าเว็บ + สไตล์ทั้งหมด
js/config.js          ค่าเชื่อมต่อ Supabase
js/api.js             เชื่อมต่อฐานข้อมูล (และโหมดทดลอง)
js/app.js             ทุกหน้าจอและการคำนวณ
supabase/schema.sql   ตาราง + สิทธิ์ (RLS) + ฟังก์ชัน
img/                  ภาพตัวละคร ไอคอน เกาะ บ้าน
sw.js, manifest       ติดตั้งเป็นแอปบนมือถือ
```

## ยังไม่มีในเวอร์ชันนี้ (ขั้นถัดไป)
- LINE Login (ต้องเพิ่ม Supabase Edge Function)
- งบต่อหมวด/รายคน, แยกหลายบัญชี, รายการประจำอัตโนมัติ, แจ้งเตือน
- แก้ไขรายการที่บันทึกแล้ว (ตอนนี้ลบแล้วบันทึกใหม่)
