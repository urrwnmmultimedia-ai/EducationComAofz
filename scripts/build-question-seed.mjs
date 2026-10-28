// สร้าง supabase/seed_questions.sql จาก supabase/questions/questions.txt
// ใช้: node scripts/build-question-seed.mjs
// UUID ของข้อสอบและชุดสอบคงที่ (คำนวณจากตำแหน่งในไฟล์) จึงรัน seed ซ้ำได้โดยไม่สร้างข้อมูลซ้ำ
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const src = readFileSync(join(root, 'supabase/questions/questions.txt'), 'utf8')

const uuid = (key) => {
  const h = createHash('sha1').update(`tech-m3:${key}`).digest('hex')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`
}

// PRNG แบบกำหนด seed ได้ (mulberry32) — ผลสลับเหมือนเดิมทุกครั้ง
const rng = (seed) => () => {
  seed |= 0
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
const seedOf = (s) => parseInt(createHash('md5').update(s).digest('hex').slice(0, 8), 16)

// สลับจนไม่ตรงลำดับเดิม (กันเฉลยรั่วจากลำดับ)
function shuffledIndices(n, key) {
  const r = rng(seedOf(key))
  for (let tries = 0; tries < 20; tries++) {
    const idx = [...Array(n).keys()]
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1))
      ;[idx[i], idx[j]] = [idx[j], idx[i]]
    }
    if (n < 2 || idx.some((v, i) => v !== i)) return idx
  }
  return [...Array(n).keys()].reverse()
}

const pick = (list, n, key, exclude = new Set()) => {
  const pool = list.filter((q) => !exclude.has(q.id))
  const order = shuffledIndices(pool.length, key)
  return order.slice(0, n).map((i) => pool[i])
}

const TYPE = { mcq: 'mcq', tf: 'true_false', fill: 'fill', match: 'matching', order: 'ordering', short: 'short' }
const SESSION_UNIT = (s) => (s >= 2 && s <= 6 ? 1 : s >= 7 && s <= 16 ? 2 : s >= 17 && s <= 19 ? 3 : null)

const questions = []
let group = null
let lineNo = 0
for (const raw of src.split(/\r?\n/)) {
  lineNo++
  const line = raw.trim()
  if (!line || line.startsWith('#')) continue
  const g = /^@(ex|ut):(\d+)$/.exec(line)
  if (g) {
    group = { kind: g[1], no: Number(g[2]), count: 0 }
    continue
  }
  if (!group) throw new Error(`บรรทัด ${lineNo}: ยังไม่ระบุกลุ่ม @ex/@ut`)
  const parts = line.split('|')
  if (parts.length !== 8) throw new Error(`บรรทัด ${lineNo}: ต้องมี 8 ช่อง แต่มี ${parts.length}`)
  const [t, difficulty, indicator, topic, prompt, choicesRaw, answer, explanation] = parts
  const type = TYPE[t]
  if (!type) throw new Error(`บรรทัด ${lineNo}: ประเภท "${t}" ไม่รู้จัก`)
  const key = `${group.kind}:${group.no}:${group.count++}`
  const items = choicesRaw ? choicesRaw.split(';').map((s) => s.trim()) : []
  let choices = []
  let correct = null

  switch (type) {
    case 'mcq': {
      if (items.length !== 4) throw new Error(`บรรทัด ${lineNo}: ปรนัยต้องมี 4 ตัวเลือก`)
      const n = Number(answer)
      if (!(n >= 1 && n <= 4)) throw new Error(`บรรทัด ${lineNo}: เฉลยต้องเป็น 1–4`)
      // สลับตัวเลือกให้เฉลยกระจายทั้ง 4 ตำแหน่ง (ไฟล์ต้นฉบับเขียนง่ายโดยไม่ต้องคิดตำแหน่ง)
      const perm = shuffledIndices(4, `mcq:${key}`)
      choices = perm.map((i) => items[i])
      correct = { index: perm.indexOf(n - 1) }
      break
    }
    case 'true_false':
      if (answer !== 'T' && answer !== 'F') throw new Error(`บรรทัด ${lineNo}: เฉลย T/F`)
      correct = { value: answer === 'T' }
      break
    case 'fill':
      correct = { accept: answer.split(';').map((s) => s.trim()).filter(Boolean) }
      break
    case 'matching': {
      const pairs = items.map((p) => p.split('='))
      if (pairs.some((p) => p.length !== 2)) throw new Error(`บรรทัด ${lineNo}: จับคู่ต้องเป็น ซ้าย=ขวา`)
      const perm = shuffledIndices(pairs.length, key) // right[k] = ขวาเดิมของ perm[k]
      const right = perm.map((i) => pairs[i][1].trim())
      choices = { left: pairs.map((p) => p[0].trim()), right }
      correct = { pairs: pairs.map((_, i) => perm.indexOf(i)) }
      break
    }
    case 'ordering': {
      const perm = shuffledIndices(items.length, key) // stored[k] = เดิมลำดับที่ perm[k]
      choices = perm.map((i) => items[i])
      correct = { order: items.map((_, i) => perm.indexOf(i)) }
      break
    }
    case 'short':
      correct = null
      break
  }

  const unitNo = group.kind === 'ut' ? group.no : SESSION_UNIT(group.no)
  questions.push({
    id: uuid(`q:${key}`),
    group: `${group.kind}:${group.no}`,
    unitNo,
    topic: topic === '0' ? '' : topic,
    indicator: indicator ? Number(indicator) : null,
    type,
    prompt,
    choices,
    correct,
    explanation,
    difficulty,
  })
}

const byGroup = (g) => questions.filter((q) => q.group === g)
const groups = (...gs) => gs.flatMap(byGroup)
const auto = (list) => list.filter((q) => q.type !== 'short')

for (const n of [1, 2, 3]) {
  const c = byGroup(`ut:${n}`).length
  if (c !== 20) throw new Error(`ทดสอบท้ายหน่วยที่ ${n} มี ${c} ข้อ (ต้อง 20)`)
}

// ---------- ชุดสอบ ----------
const exams = []
const exitSessions = [...new Set(questions.filter((q) => q.group.startsWith('ex:')).map((q) => Number(q.group.slice(3))))]
for (const s of exitSessions) {
  exams.push({
    id: uuid(`exam:exit:${s}`),
    title: `Exit ticket คาบที่ ${s}`,
    kind: 'exit_ticket',
    unitNo: SESSION_UNIT(s),
    sessionNo: s,
    assignment: null,
    ids: byGroup(`ex:${s}`).map((q) => q.id),
    duration: 10,
    shuffle: false,
    maxAttempts: 1,
    showAnswers: true,
    fullscreen: false,
  })
}
const UNIT_TEST_SESSION = { 1: 6, 2: 16, 3: 19 }
for (const n of [1, 2, 3]) {
  exams.push({
    id: uuid(`exam:unit:${n}`),
    title: `ทดสอบท้ายหน่วยที่ ${n}`,
    kind: 'unit_test',
    unitNo: n,
    sessionNo: UNIT_TEST_SESSION[n],
    assignment: { session: UNIT_TEST_SESSION[n], title: `ทดสอบท้ายหน่วยที่ ${n}` },
    ids: byGroup(`ut:${n}`).map((q) => q.id),
    duration: 30,
    shuffle: true,
    maxAttempts: 1,
    showAnswers: false,
    fullscreen: true,
  })
}

const ut1 = auto(byGroup('ut:1'))
const ut2 = auto(byGroup('ut:2'))
const ut3 = auto(byGroup('ut:3'))
const ex1 = auto(groups('ex:2', 'ex:3', 'ex:4', 'ex:5', 'ex:6'))
const ex2a = auto(groups('ex:7', 'ex:8', 'ex:9'))
const ex2b = auto(groups('ex:11', 'ex:12', 'ex:13', 'ex:14', 'ex:15', 'ex:16'))
const ex3 = auto(groups('ex:17', 'ex:18', 'ex:19'))

const mid = [...pick(ut1, 12, 'mid:ut1'), ...pick(ex1, 6, 'mid:ex1'), ...pick(ex2a, 12, 'mid:ex2a')]
const used = new Set(mid.map((q) => q.id))
const fin = [
  ...pick(ut1, 6, 'fin:ut1', used),
  ...pick(ex1, 4, 'fin:ex1', used),
  ...pick(ut2, 12, 'fin:ut2'),
  ...pick(ex2b, 6, 'fin:ex2b'),
  ...pick(ut3, 8, 'fin:ut3'),
  ...pick(ex3, 4, 'fin:ex3'),
]
const pre = [...pick(ut1, 7, 'pre:ut1'), ...pick(ut2, 7, 'pre:ut2'), ...pick(ut3, 6, 'pre:ut3')]
if (mid.length !== 30 || fin.length !== 40 || pre.length !== 20) throw new Error(`จำนวนข้อไม่ครบ ${mid.length}/${fin.length}/${pre.length}`)

exams.push(
  { id: uuid('exam:midterm'), title: 'สอบกลางภาค', kind: 'midterm', unitNo: null, sessionNo: 10, assignment: { session: 10, title: 'สอบกลางภาค' }, ids: mid.map((q) => q.id), duration: 60, shuffle: true, maxAttempts: 1, showAnswers: false, fullscreen: true },
  { id: uuid('exam:final'), title: 'สอบปลายภาค', kind: 'final', unitNo: null, sessionNo: 20, assignment: { session: 20, title: 'สอบปลายภาค' }, ids: fin.map((q) => q.id), duration: 60, shuffle: true, maxAttempts: 1, showAnswers: false, fullscreen: true },
  { id: uuid('exam:pretest'), title: 'แบบทดสอบก่อนเรียน', kind: 'pretest', unitNo: null, sessionNo: 1, assignment: null, ids: pre.map((q) => q.id), duration: 30, shuffle: false, maxAttempts: 1, showAnswers: false, fullscreen: false },
  { id: uuid('exam:posttest'), title: 'แบบทดสอบหลังเรียน', kind: 'posttest', unitNo: null, sessionNo: 20, assignment: null, ids: pre.map((q) => q.id), duration: 30, shuffle: false, maxAttempts: 1, showAnswers: true, fullscreen: false },
)

// ---------- เขียน SQL ----------
const s = (v) => (v == null ? 'null' : `'${String(v).replace(/'/g, "''")}'`)
const j = (v) => (v == null ? 'null' : `${s(JSON.stringify(v))}::jsonb`)
const unit = (n) => (n == null ? 'null' : `(select id from public.units where no = ${n})`)

let sql = `-- =============================================================
-- Seed คลังข้อสอบฉบับร่าง (สร้างอัตโนมัติจาก supabase/questions/questions.txt)
-- ห้ามแก้ไฟล์นี้ตรง ๆ — แก้ questions.txt แล้วรัน: node scripts/build-question-seed.mjs
-- รันหลัง seed.sql · รันซ้ำได้ (ไม่สร้างซ้ำ และไม่ทับข้อที่ครูแก้แล้ว)
-- ทุกข้อติดป้าย reviewed = false ("ร่างจาก AI ยังไม่ตรวจ") จนกว่าครูกด "ตรวจแล้ว"
-- ข้อสอบ ${questions.length} ข้อ · ชุดสอบ ${exams.length} ชุด
-- =============================================================

insert into public.questions (id, unit_id, topic, indicator, type, prompt, choices, correct_answer, explanation, difficulty, reviewed)
values
`
sql += questions
  .map(
    (q) =>
      `  (${s(q.id)}, ${unit(q.unitNo)}, ${s(q.topic)}, ${q.indicator ?? 'null'}, ${s(q.type)}, ${s(q.prompt)}, ${j(q.choices)}, ${j(q.correct)}, ${s(q.explanation)}, ${s(q.difficulty)}, false)`,
  )
  .join(',\n')
sql += '\non conflict (id) do nothing;\n\n'

sql += `insert into public.exams (id, title, kind, unit_id, session_no, assignment_id, question_ids, duration_min, shuffle, shuffle_choices, max_attempts, show_answers, require_fullscreen)
values
`
sql += exams
  .map((e) => {
    const asg = e.assignment
      ? `(select id from public.assignments where session_no = ${e.assignment.session} and title = ${s(e.assignment.title)} limit 1)`
      : 'null'
    return `  (${s(e.id)}, ${s(e.title)}, ${s(e.kind)}, ${unit(e.unitNo)}, ${e.sessionNo ?? 'null'}, ${asg}, array[${e.ids.map(s).join(', ')}]::uuid[], ${e.duration}, ${e.shuffle}, ${e.shuffle}, ${e.maxAttempts}, ${e.showAnswers}, ${e.fullscreen})`
  })
  .join(',\n')
sql += '\non conflict (id) do nothing;\n'

writeFileSync(join(root, 'supabase/seed_questions.sql'), sql)
console.log(`questions: ${questions.length}, exams: ${exams.length} -> supabase/seed_questions.sql`)
