// สร้าง supabase/seed_dbquest.sql จาก src/content/units/course.json (ชื่อคาบมีที่เดียว ไม่เขียนซ้ำ)
// ใช้: node scripts/build-dbquest-seed.mjs (หรือ npm run seed:build)
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const course = JSON.parse(readFileSync(join(root, 'src/content/units/course.json'), 'utf8'))

const q = (s) => `'${String(s).replaceAll("'", "''")}'`

const lessons = course.sessions
  .map((s) => `  (${s.no}, ${s.unit ?? 'null'}, ${q(s.kind)}, ${q(s.title)}, ${s.no === 1})`)
  .join(',\n')

const badges = [
  ['unit-complete', 'จบหน่วยแรก', 'เรียนครบทุกขั้นของหน่วยใดหน่วยหนึ่ง', '🎓'],
  ['all-units', 'นักผจญภัยครบ 7 หน่วย', 'เรียนครบทุกหน่วย', '🗺️'],
  ['three-stars', 'สามดาวแรก', 'ทำเกมใดเกมหนึ่งได้ 3 ดาว', '⭐'],
  ['on-time-5', 'ส่งตรงเวลา 5 ครั้งติด', 'ส่งใบงานก่อนกำหนด 5 ครั้งติดต่อกัน', '⏰'],
  ['sql-no-hint', 'SQL ไร้คำใบ้', 'ผ่านด่าน SQL Quest โดยไม่ใช้คำใบ้', '🧙'],
  ['streak-5', 'มาเรียนต่อเนื่อง 5 คาบ', 'เข้าเรียนต่อเนื่อง 5 คาบไม่ขาด', '🔥'],
]
  .map(([key, name, desc, icon], i) => `  (${q(key)}, ${q(name)}, ${q(desc)}, ${q(icon)}, ${i + 1})`)
  .join(',\n')

const sql = `-- =============================================================
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
${lessons}
on conflict (session_no) do update
  set unit_no = excluded.unit_no, kind = excluded.kind, title = excluded.title;

insert into public.dbq_badges (key, name, description, icon, sort_order) values
${badges}
on conflict (key) do update
  set name = excluded.name, description = excluded.description, icon = excluded.icon, sort_order = excluded.sort_order;
`

writeFileSync(join(root, 'supabase/seed_dbquest.sql'), sql)
console.log(`seed_dbquest.sql: ${course.sessions.length} lessons`)
