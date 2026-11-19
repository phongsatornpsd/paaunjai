// ตั้งค่าการเชื่อมต่อ Supabase
// เว้นว่างทั้งสองค่า = โหมดทดลอง (ข้อมูลตัวอย่าง เก็บในเครื่องนี้เท่านั้น)
// ใส่ค่าจาก Supabase > Project Settings > API ของโปรเจกต์ที่รัน schema.sql แล้ว
window.EV_CONFIG = {
  SUPABASE_URL: "https://asffyfyvwkwplilsiolh.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_b0xegAsR8FcovuzU_HLAgg_zhekkBDV"   // ใช้ Publishable key (sb_publishable_...) หรือ anon key ก็ได้ ห้ามใส่ service_role
};
