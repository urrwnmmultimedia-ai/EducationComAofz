-- =============================================================
-- Seed DB Quest ม.5 (สร้างอัตโนมัติจาก scripts/build-dbquest-seed.mjs — ห้ามแก้ตรง)
-- รันซ้ำได้ ไม่สร้างข้อมูลซ้ำ
--   ห้อง ม.5/1 (วิชา DB Quest) + นักเรียนตัวอย่าง 5 คน (รหัสทดลอง 55555)
--   นักเรียนทดลอง ม.3 รหัส 33333 ในห้อง ม.3/1
--   คาบเรียน 20 คาบ + เหรียญตรา
-- =============================================================

insert into public.classrooms (name, sort_order, course) values
  ('ม.3/1', 1, 'design_m3'),
  ('ม.5/1', 51, 'dbquest_m5')
on conflict (name) do nothing;

insert into public.students (student_code, prefix, first_name, last_name, nickname, classroom_id, number, avatar)
select v.code, v.prefix, v.first_name, v.last_name, v.nickname, c.id, v.number, v.avatar
from (values
  ('33333', 'เด็กชาย', 'ทดลอง',   'ม.สาม',    'สาม',   'ม.3/1', 99, 'non'),
  ('55555', 'นาย',    'ทดลอง',   'ม.ห้า',    'ห้า',    'ม.5/1', 1,  'robot'),
  ('55501', 'นางสาว', 'ศศิธร',   'ข้อมูลดี',  'ดาว',   'ม.5/1', 2,  'namwan'),
  ('55502', 'นาย',    'ปัณณวัฒน์', 'คีย์หลัก',  'ปัณ',   'ม.5/1', 3,  'non'),
  ('55503', 'นางสาว', 'ชนิดา',   'ตารางงาม', 'มิ้นท์',  'ม.5/1', 4,  'cat'),
  ('55504', 'นาย',    'ธีรภัทร์',  'คิวรี',     'ธีร์',   'ม.5/1', 5,  'owl')
) as v(code, prefix, first_name, last_name, nickname, classroom, number, avatar)
join public.classrooms c on c.name = v.classroom
on conflict (student_code) do nothing;

insert into public.dbq_lessons (session_no, unit_no, kind, title, is_unlocked_default) values
  (1, 1, 'lesson', 'คำศัพท์คอมพิวเตอร์ที่ต้องรู้', true),
  (2, 1, 'lesson', 'คำศัพท์ฐานข้อมูลในชีวิตจริง', false),
  (3, 2, 'lesson', 'ลำดับชั้นของข้อมูล Bit → Database', false),
  (4, 2, 'lesson', 'ฐานข้อมูล (DB) กับระบบจัดการฐานข้อมูล (DBMS)', false),
  (5, 3, 'lesson', 'โมเดลแบบตาราง ต้นไม้ และเครือข่าย', false),
  (6, 3, 'lesson', 'โมเดลกราฟและเอกสาร เลือกโมเดลให้เหมาะงาน', false),
  (7, 4, 'lesson', 'วิเคราะห์ความต้องการ หา Entity และ Attribute', false),
  (8, 4, 'lesson', 'ความสัมพันธ์ 1:1, 1:M, M:N และ E-R Diagram', false),
  (9, 4, 'lesson', 'คีย์หลัก (Primary Key) คีย์นอก (Foreign Key) และตารางเชื่อม', false),
  (10, 5, 'lesson', 'ความซ้ำซ้อนและความผิดปกติ (Anomaly) กับ 1NF', false),
  (11, 5, 'lesson', '2NF และ 3NF', false),
  (12, null, 'midterm', 'สอบกลางภาค (หน่วย 1–5) + ทบทวน', false),
  (13, 6, 'lesson', 'DDL: สร้างตาราง (CREATE TABLE)', false),
  (14, 6, 'lesson', 'DDL: แก้ไขตารางและข้อกำหนด (ALTER, DROP, Constraint)', false),
  (15, 6, 'lesson', 'DML: INSERT, UPDATE, DELETE', false),
  (16, 6, 'lesson', 'SELECT, WHERE, ORDER BY, LIKE', false),
  (17, 6, 'lesson', 'ฟังก์ชันรวม GROUP BY และ JOIN', false),
  (18, 7, 'lesson', 'สิทธิ์ผู้ใช้ การสำรองและกู้คืนข้อมูล', false),
  (19, null, 'project', 'โครงงานฐานข้อมูลห้องสมุด นำเสนอ/ส่งงาน', false),
  (20, null, 'final', 'สอบปลายภาค (หน่วย 1–7) + สรุปผล', false)
on conflict (session_no) do update
  set unit_no = excluded.unit_no, kind = excluded.kind, title = excluded.title;

insert into public.dbq_badges (key, name, description, icon, sort_order) values
  ('unit-complete', 'จบหน่วยแรก', 'เรียนครบทุกขั้นของหน่วยใดหน่วยหนึ่ง', '🎓', 1),
  ('all-units', 'นักผจญภัยครบ 7 หน่วย', 'เรียนครบทุกหน่วย', '🗺️', 2),
  ('three-stars', 'สามดาวแรก', 'ทำเกมใดเกมหนึ่งได้ 3 ดาว', '⭐', 3),
  ('on-time-5', 'ส่งตรงเวลา 5 ครั้งติด', 'ส่งใบงานก่อนกำหนด 5 ครั้งติดต่อกัน', '⏰', 4),
  ('sql-no-hint', 'SQL ไร้คำใบ้', 'ผ่านด่าน SQL Quest โดยไม่ใช้คำใบ้', '🧙', 5),
  ('streak-5', 'มาเรียนต่อเนื่อง 5 คาบ', 'เข้าเรียนต่อเนื่อง 5 คาบไม่ขาด', '🔥', 6)
on conflict (key) do update
  set name = excluded.name, description = excluded.description, icon = excluded.icon, sort_order = excluded.sort_order;
