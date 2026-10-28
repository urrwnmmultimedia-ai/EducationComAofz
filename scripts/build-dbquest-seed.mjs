// สร้าง seed ของ DB Quest จากไฟล์ต้นฉบับ (ข้อมูลมีที่เดียว ไม่เขียนซ้ำ)
//   supabase/seed_dbquest.sql      <- src/content/units/course.json + sNN.json (คาบ ใบงาน เกม — ไม่มีเฉลย)
//   supabase/seed/answer_keys.sql  <- supabase/answer_keys/sNN.json + supabase/dbq_games/*.json (เฉลย/สำรับเกม อยู่นอก src จึงไม่ถูก build ไปกับเว็บ)
// ใช้: node scripts/build-dbquest-seed.mjs (หรือ npm run seed:build)
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const course = JSON.parse(readFileSync(join(root, 'src/content/units/course.json'), 'utf8'))

const q = (s) => `'${String(s).replaceAll("'", "''")}'`
const qj = (v) => (v == null ? 'null' : `${q(JSON.stringify(v))}::jsonb`)

const unitsDir = join(root, 'src/content/units')
const sessions = readdirSync(unitsDir)
  .filter((f) => /^s\d{2}\.json$/.test(f))
  .sort()
  .map((f) => JSON.parse(readFileSync(join(unitsDir, f), 'utf8')))

const gameKeys = sessions
  .filter((s) => s.game)
  .map((s) => `  (${s.session}, ${q(s.game.slug)})`)
  .join(',\n')

const assignments = sessions
  .filter((s) => s.worksheet)
  .map((s, i) => `  (${q(s.worksheet.item_id)}, ${s.session}, ${q(s.worksheet.title)}, ${s.worksheet.max_score}, ${q(s.worksheet.type)}, ${i + 1})`)
  .join(',\n')

const keysDir = join(root, 'supabase/answer_keys')
const keyRows = readdirSync(keysDir)
  .filter((f) => f.endsWith('.json'))
  .sort()
  .flatMap((f) => {
    const file = JSON.parse(readFileSync(join(keysDir, f), 'utf8'))
    return file.items.map(
      (k) =>
        `  (${q(k.item_id)}, ${q(k.item_type)}, ${q(k.grade_type)}, ${file.unit ?? 'null'}, ${file.session ?? 'null'}, ` +
        `${qj(k.answer ?? {})}, ${q(k.explanation ?? '')}, ${q(k.hint ?? '')}, ${qj(k.rubric ?? null)}, ${q(k.teacher_notes ?? '')})`,
    )
  })

// สำรับเกม (คู่คำ-ความหมาย ซ้ำกับเฉลยแบบฝึก) — ไปอยู่ใน answer_keys.sql ด้วย
const decksDir = join(root, 'supabase/dbq_games')
const deckRows = readdirSync(decksDir)
  .filter((f) => f.endsWith('.json'))
  .sort()
  .map((f) => {
    const { game_key, ...config } = JSON.parse(readFileSync(join(decksDir, f), 'utf8'))
    return `  (${q(game_key)}, ${qj(config)})`
  })

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

${gameKeys ? `update public.dbq_lessons l set game_key = v.game_key
from (values
${gameKeys}
) as v(session_no, game_key)
where l.session_no = v.session_no;
` : ''}
${assignments ? `insert into public.dbq_assignments (item_id, session_no, title, max_score, type, sort_order) values
${assignments}
on conflict (item_id) do update
  set session_no = excluded.session_no, title = excluded.title, max_score = excluded.max_score,
      type = excluded.type, sort_order = excluded.sort_order;
` : ''}
insert into public.dbq_badges (key, name, description, icon, sort_order) values
${badges}
on conflict (key) do update
  set name = excluded.name, description = excluded.description, icon = excluded.icon, sort_order = excluded.sort_order;
`

writeFileSync(join(root, 'supabase/seed_dbquest.sql'), sql)

const keysSql = `-- =============================================================
-- เฉลย DB Quest (สร้างอัตโนมัติจาก supabase/answer_keys/*.json — ห้ามแก้ตรง)
-- ต้องรันหลัง seed_dbquest.sql · รันซ้ำได้ (อัปเดตเฉลยตามไฟล์ต้นฉบับ)
-- ⚠️ ไฟล์นี้มีเฉลยทั้งหมด ห้ามนำไปไว้ใน src/ หรือ public/
-- =============================================================

insert into public.dbq_answer_keys (item_id, item_type, grade_type, unit_no, session_no, answer, explanation, hint, rubric, teacher_notes) values
${keyRows.join(',\n')}
on conflict (item_id) do update
  set item_type = excluded.item_type, grade_type = excluded.grade_type, unit_no = excluded.unit_no,
      session_no = excluded.session_no, answer = excluded.answer, explanation = excluded.explanation,
      hint = excluded.hint, rubric = excluded.rubric, teacher_notes = excluded.teacher_notes, updated_at = now();
${deckRows.length ? `
-- สำรับเกม <- supabase/dbq_games/*.json
insert into public.dbq_game_decks (game_key, config) values
${deckRows.join(',\n')}
on conflict (game_key) do update set config = excluded.config, updated_at = now();
` : ''}`
writeFileSync(join(root, 'supabase/seed/answer_keys.sql'), keysSql)

// ฐานข้อมูลที่ติดตั้งแล้ว (เฟส 3 ขึ้นไป): รันไฟล์นี้ทุกครั้งที่เพิ่ม/แก้คาบ เฉลย หรือสำรับเกม — รันซ้ำได้
writeFileSync(
  join(root, 'supabase/updates/dbquest_content.sql'),
  `-- =============================================================
-- อัปเดตเนื้อหา DB Quest (คาบ ใบงาน เกม เฉลย) สำหรับฐานข้อมูลที่ติดตั้งเฟส 3 แล้ว
-- สร้างอัตโนมัติจาก scripts/build-dbquest-seed.mjs — SQL Editor → วางทั้งไฟล์ → Run (รันซ้ำได้)
-- ⚠️ มีเฉลยทั้งหมด ห้ามนำไปไว้ใน src/ หรือ public/
-- =============================================================

begin;

${sql}
${keysSql}
commit;
`,
)
console.log(
  `seed_dbquest.sql: ${course.sessions.length} lessons, ${sessions.length} session files · ` +
    `answer_keys.sql: ${keyRows.length} items, ${deckRows.length} game decks`,
)
