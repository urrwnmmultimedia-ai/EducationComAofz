// สร้าง SQL บทเรียนจาก supabase/lessons/NN.md (บรรทัดแรก "# ชื่อบทเรียน" แล้วตามด้วยเนื้อหา Markdown)
//   1) แทนที่ส่วน D ใน supabase/seed.sql (สำหรับติดตั้งใหม่)
//   2) สร้าง supabase/updates/lessons_update.sql (อัปเดตฐานข้อมูลที่ติดตั้งแล้ว — ทับเนื้อหาบทเรียนแรกของแต่ละคาบ)
// ใช้: node scripts/build-lessons.mjs [เลขคาบ ...]   (ไม่ระบุ = อัปเดตทุกคาบ)
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dir = join(root, 'supabase/lessons')
const only = process.argv.slice(2).map(Number).filter(Boolean)

const lessons = readdirSync(dir)
  .filter((f) => /^\d+\.md$/.test(f))
  .sort()
  .map((f) => {
    const text = readFileSync(join(dir, f), 'utf8').replace(/\r\n/g, '\n')
    const m = /^# (.+)\n+([\s\S]*)$/.exec(text)
    if (!m) throw new Error(`${f}: บรรทัดแรกต้องเป็น "# ชื่อบทเรียน"`)
    const md = m[2].trimEnd()
    if (md.includes('$md$')) throw new Error(`${f}: ห้ามมีข้อความ $md$`)
    return { no: Number(f.slice(0, -3)), title: m[1].trim(), md }
  })

const s = (v) => `'${String(v).replace(/'/g, "''")}'`

// ---------- 1) ส่วน D ใน seed.sql ----------
const seedPath = join(root, 'supabase/seed.sql')
const seed = readFileSync(seedPath, 'utf8').replace(/\r\n/g, '\n')
const start = seed.indexOf('-- ---------- D.')
const end = seed.indexOf('-- ---------- E.')
if (start < 0 || end < 0) throw new Error('หาเครื่องหมายส่วน D/E ใน seed.sql ไม่พบ')
const header = seed.slice(start, seed.indexOf('\n\n', start))
const sectionD = `${header}

insert into public.lessons (unit_id, session_no, title, content_md, sort_order, est_minutes)
select cs.unit_id, v.no, v.title, v.md, 1, 30
from (values
${lessons.map((l) => `(${l.no}, ${s(l.title)}, $md$\n${l.md}\n$md$)`).join(',\n\n')}
) as v(no, title, md)
join public.class_sessions cs on cs.session_no = v.no
where not exists (select 1 from public.lessons l where l.session_no = v.no);

`
writeFileSync(seedPath, seed.slice(0, start) + sectionD + seed.slice(end))

// ---------- 2) ไฟล์อัปเดตฐานข้อมูลที่ติดตั้งแล้ว ----------
const targets = only.length ? lessons.filter((l) => only.includes(l.no)) : lessons
mkdirSync(join(root, 'supabase/updates'), { recursive: true })
const update = `-- =============================================================
-- อัปเดตเนื้อหาบทเรียนคาบ ${targets.map((l) => l.no).join(', ')} (สร้างอัตโนมัติจาก supabase/lessons/*.md)
-- ใช้กับฐานข้อมูลที่ติดตั้งแล้ว: SQL Editor → วางทั้งไฟล์ → Run
-- ⚠️ ทับเนื้อหาบทเรียนแรก (sort_order = 1) ของแต่ละคาบ ถ้าครูแก้เนื้อหาเองในหน้าแอดมินไว้ จะถูกแทนที่
-- =============================================================

begin;
${targets
  .map(
    (l) => `
update public.lessons set title = ${s(l.title)}, content_md = $md$
${l.md}
$md$
where session_no = ${l.no} and sort_order = 1;`,
  )
  .join('\n')}

commit;

-- ตรวจผล: ทุกแถวควรมี has_think = true
select session_no, title, length(content_md) as chars, content_md like '%:::think%' as has_think
from public.lessons where session_no in (${targets.map((l) => l.no).join(', ')}) and sort_order = 1 order by session_no;
`
writeFileSync(join(root, 'supabase/updates/lessons_update.sql'), update)
console.log(`lessons: ${lessons.length} -> seed.sql section D; update: sessions ${targets.map((l) => l.no).join(',')}`)
