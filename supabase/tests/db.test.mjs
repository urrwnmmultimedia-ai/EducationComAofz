// ทดสอบ migration + RLS + RPC ทั้งหมดบน Postgres จำลอง (PGlite) โดยไม่ต้องมีโปรเจกต์ Supabase
// ใช้: npm run test:db
// จำลองสิ่งที่ Supabase มีให้: schema auth/storage/extensions, role anon/authenticated, auth.uid()
// แต่ละผู้ใช้ทดสอบ = เบราว์เซอร์หนึ่งเครื่อง (anonymous sign-in) แล้วล็อกอินด้วยรหัส
import { PGlite } from '@electric-sql/pglite'
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const db = new PGlite({ extensions: { pgcrypto } })

// จำลองสิ่งที่ Supabase มีให้
await db.exec(`
  create schema extensions;
  create schema auth;
  create schema storage;
  create role anon nologin; create role authenticated nologin; create role service_role nologin;
  grant usage on schema public, auth, storage, extensions to anon, authenticated;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create table storage.buckets (id text primary key, name text, public bool, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
  alter table storage.objects enable row level security;
  create function storage.foldername(name text) returns text[] language sql as $$ select string_to_array(name, '/') $$;
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant all on functions to anon, authenticated;
`)

const dir = join(root, 'supabase', 'migrations')
for (const f of readdirSync(dir).sort()) {
  await db.exec(readFileSync(join(dir, f), 'utf8'))
  console.log('migration ok:', f)
}
await db.exec(readFileSync(join(root, 'supabase', 'seed.sql'), 'utf8'))
await db.exec(readFileSync(join(root, 'supabase', 'seed_questions.sql'), 'utf8'))
await db.exec(readFileSync(join(root, 'supabase', 'seed_games.sql'), 'utf8'))
console.log('seed ok')

const A = '00000000-0000-0000-0000-00000000000a'
const B = '00000000-0000-0000-0000-00000000000b'
const T = '00000000-0000-0000-0000-00000000000c'
await db.exec(`insert into auth.users values ('${A}'), ('${B}'), ('${T}');`)

async function as(uid, sql) {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${uid}', false);`)
  try {
    return (await db.query(sql)).rows
  } finally {
    await db.exec('reset role;')
  }
}
let failed = 0
const check = (name, cond) => {
  if (!cond) failed++
  console.log(cond ? 'PASS' : 'FAIL', name)
}

let r = await as(A, `select public.login_with_code('99999', 'devA') as r`)
check('wrong code -> not_found', r[0].r.error === 'not_found')
r = await as(A, `select public.login_with_code('10001', 'devA') as r`)
check('student login', r[0].r.ok && r[0].r.student.nickname === 'ต้นกล้า' && r[0].r.student.classroom_name === 'ม.3/1')
r = await as(B, `select public.login_with_code('10002', 'devB') as r`)
check('student B login', r[0].r.ok)
r = await as(T, `select public.login_with_code('superurrwnm', 'devT') as r`)
check('admin login', r[0].r.ok && r[0].r.role === 'admin')

r = await as(A, `select public.whoami() as r`)
check('whoami student', r[0].r.role === 'student')
r = await as(A, `select count(*)::int n from public.students`)
check('student sees only self', r[0].n === 1)
r = await as(T, `select count(*)::int n from public.students`)
check('admin sees all students', r[0].n === 5)
r = await as(A, `select count(*)::int n from public.app_secrets`).catch(() => 'denied')
check('app_secrets denied', r === 'denied')
r = await as(T, `select count(*)::int n from public.app_secrets`).catch(() => 'denied')
check('app_secrets denied for admin too', r === 'denied')
r = await as(A, `update public.app_settings set device_lock = true returning id`)
check('student cannot update settings', r.length === 0)

// งาน: นักเรียน A ห้ามเห็นงาน B, ห้ามให้คะแนนตัวเอง
await db.exec(`insert into public.assignments (id, title, max_score) values ('11111111-1111-1111-1111-111111111111', 'งานทดสอบ', 3);`)
const sidB = (await as(B, `select public.current_student_id() id`))[0].id
await as(B, `insert into public.submissions (assignment_id, student_id, status, score) values ('11111111-1111-1111-1111-111111111111', '${sidB}', 'submitted', 99)`)
r = await as(B, `select score, submitted_at from public.submissions`)
check('student cannot self-score', r[0].score === null && r[0].submitted_at !== null)
r = await as(A, `select count(*)::int n from public.submissions`)
check('student A cannot read B submission', r[0].n === 0)
r = await as(A, `insert into public.submissions (assignment_id, student_id) values ('11111111-1111-1111-1111-111111111111', '${sidB}')`).catch(() => 'denied')
check('student A cannot insert as B', r === 'denied')
await as(T, `update public.submissions set score = 3, status = 'graded'`)
r = await as(B, `update public.submissions set content = '{"x":1}' returning id`)
check('graded submission locked for student', r.length === 0)

// คาบเรียน: เห็นเฉพาะที่ปลดล็อก
await db.exec(`insert into public.classroom_session_unlocks (classroom_id, session_no, is_unlocked)
  select id, 1, true from public.classrooms;`)
r = await as(A, `select session_no from public.class_sessions`)
check('student sees only unlocked sessions', r.length === 1 && r[0].session_no === 1)
r = await as(A, `select count(*)::int n from public.questions`)
check('student cannot read questions', r[0].n === 0)

// ล็อกอุปกรณ์
await db.exec(`update public.app_settings set device_lock = true`)
r = await as(B, `select public.login_with_code('10001', 'devB') as r`)
check('device lock blocks other device', r[0].r.error === 'device_locked')
r = await as(T, `select public.admin_reset_device(id) from public.students where student_code = '10001'`)
r = await as(B, `select public.login_with_code('10001', 'devB') as r`)
check('after reset, new device ok', r[0].r.ok)
r = await as(A, `select public.whoami() as r`)
check('reset kicked old session', r[0].r.role === null)

// rate limit
for (let i = 0; i < 10; i++) await as(A, `select public.login_with_code('00000', 'devA')`)
r = await as(A, `select public.login_with_code('10003', 'devA') as r`)
check('rate limited after 10 fails', r[0].r.error === 'rate_limited' && r[0].r.retry_after_sec > 0)

// admin code change
r = await as(A, `select public.admin_set_admin_code('hacker1')`).catch(() => 'denied')
check('student cannot change admin code', r === 'denied')
await as(T, `select public.admin_set_admin_code('newcode99')`)
r = await as(B, `select public.login_with_code('newcode99', 'devB') as r`)
check('new admin code works', r[0].r.role === 'admin')

await as(B, `select public.logout()`)
r = await as(B, `select public.whoami() as r`)
check('logout clears session', r[0].r.role === null)


// ---------- Phase 2 ----------
const D = '00000000-0000-0000-0000-00000000000d'
await db.exec(`insert into auth.users values ('${D}')`)

r = await db.query(`select (select count(*)::int from public.units) u, (select count(*)::int from public.class_sessions) s, (select count(*)::int from public.lessons) l`)
check('seed 3 units / 20 sessions / 20 lessons', r.rows[0].u === 3 && r.rows[0].s === 20 && r.rows[0].l === 20)
r = await db.query(`select jsonb_array_length(steps) n, steps->0->>'key' k from public.class_sessions where session_no = 2`)
check('session 2 has 6 steps', r.rows[0].n === 6 && r.rows[0].k === 'warmup')
r = await db.query(`select sum((x->>'minutes')::int)::int m from public.class_sessions, jsonb_array_elements(steps) x group by session_no`)
check('every session = 120 min', r.rows.every((x) => x.m === 120))
await db.exec(readFileSync(join(root, 'supabase', 'seed.sql'), 'utf8'))
r = await db.query(`select count(*)::int n from public.lessons`)
check('seed idempotent', r.rows[0].n === 20)

await as(D, `select public.login_with_code('10004', 'devA2')`)
r = await as(D, `select * from public.my_session_list()`)
check('my_session_list shows 20 with lock state', r.length === 20 && r[0].is_unlocked === true && r[1].is_unlocked === false)
r = await as(D, `select count(*)::int n from public.lessons`)
check('student reads only unlocked lessons', r[0].n === 1)
r = await as(D, `select public.checkin_session(2) ok`)
check('no checkin on locked session', r[0].ok === false)
await as(T, `select public.login_with_code('newcode99', 'devT')`)
await as(T, `select public.admin_set_session_unlock(2, true, null)`)
r = await as(D, `select public.checkin_session(2) ok`)
check('checkin latest unlocked', r[0].ok === true)
r = await as(D, `select public.checkin_session(2) ok`)
check('checkin once only', r[0].ok === false)
r = await as(D, `select coalesce(sum(xp),0)::int xp from public.xp_events`)
check('attendance +10 XP', r[0].xp === 10)
r = await as(D, `select public.mark_step_done(2, 'content') s`)
r = await as(D, `select public.mark_step_done(2, 'warmup') s`)
check('mark steps', JSON.stringify(r[0].s) === '["content","warmup"]')
r = await as(D, `select public.mark_step_done(3, 'content')`).catch(() => 'denied')
check('cannot mark locked session', r === 'denied')
r = await as(D, `select public.admin_swap_sessions(2, 3)`).catch(() => 'denied')
check('student cannot swap', r === 'denied')
await as(T, `select public.admin_swap_sessions(2, 3)`)
r = await db.query(`select session_no, title from public.class_sessions where session_no in (2,3) order by 1`)
const pr = await db.query(`select session_no from public.session_progress`)
const lr = await db.query(`select session_no from public.lessons where title = 'รถยนต์ไฟฟ้า'`)
check('swap moves session + progress + lessons', r.rows[0].title.startsWith('1.2') && pr.rows[0].session_no === 3 && lr.rows[0].session_no === 2)

// ---------- Phase 3 ----------
r = await db.query(`select category, sum(max_score)::float t from public.assignments where title <> 'งานทดสอบ' group by 1 order by 1`)
const tot = Object.fromEntries(r.rows.map((x) => [x.category, x.t]))
check('seed totals 30/15/15/20/20', tot.work === 30 && tot.project === 15 && tot.unit_test === 15 && tot.midterm === 20 && tot.final === 20)
const E = '00000000-0000-0000-0000-00000000000e'
await db.exec(`insert into auth.users values ('${E}')`)
await as(E, `select public.login_with_code('10005', 'devE')`)
const sidE = (await as(E, `select public.current_student_id() id`))[0].id
// หลังสลับคาบ 2↔3 การปลดล็อกย้ายตาม: คาบ 3 เปิด, คาบ 2 ปิด
const a2 = (await db.query(`select id from public.assignments where session_no = 3 and type = 'table'`)).rows[0].id
const a3 = (await db.query(`select id from public.assignments where session_no = 2 limit 1`)).rows[0].id
const mid = (await db.query(`select id from public.assignments where category = 'midterm'`)).rows[0].id
// session 2 & 3 swapped earlier: session_no 2 = รถยนต์ไฟฟ้า (unlocked), 3 = 5G (locked)
r = await as(E, `insert into public.submissions (assignment_id, student_id, status) values ('${a3}', '${sidE}', 'submitted')`).catch((e) => e.message)
check('cannot submit locked session', r === 'session_locked' || r === 'assignment_not_submittable')
r = await as(E, `insert into public.submissions (assignment_id, student_id, status) values ('${mid}', '${sidE}', 'submitted')`).catch((e) => e.message)
check('cannot submit score_only', r === 'assignment_not_submittable' || r === 'session_locked')
r = await as(E, `insert into public.submissions (assignment_id, student_id, status, file_paths) values ('${a2}', '${sidE}', 'draft', array['other/x.png'])`).catch((e) => e.message)
check('file path must be own folder', r === 'invalid_file_path')
await as(E, `insert into public.submissions (assignment_id, student_id, status, content, file_paths) values ('${a2}', '${sidE}', 'submitted', '{"rows":[["a"]]}', array['${sidE}/${a2}/1.png'])`)
r = await as(E, `select coalesce(sum(xp),0)::int xp from public.xp_events where source = 'assignment'`)
check('on-time submit +30 XP', r[0].xp === 30)
await as(E, `update public.submissions set status = 'draft' where assignment_id = '${a2}'`)
await as(E, `update public.submissions set status = 'submitted' where assignment_id = '${a2}'`)
r = await as(E, `select coalesce(sum(xp),0)::int xp from public.xp_events where source = 'assignment'`)
check('XP only once', r[0].xp === 30)
const subId = (await db.query(`select id from public.submissions where assignment_id = '${a2}' and student_id = '${sidE}'`)).rows[0].id
r = await as(E, `select public.grade_submission('${subId}', 3, 'ดี')`).catch(() => 'denied')
check('student cannot grade', r === 'denied')
r = await as(T, `select public.grade_submission('${subId}', 99, 'x')`).catch((e) => e.message)
check('score > max rejected', r === 'score_out_of_range')
await as(T, `select public.grade_submission('${subId}', 1, 'แก้ตาราง', 'returned')`)
r = await as(E, `update public.submissions set content = '{"rows":[["b"]]}', status = 'submitted' where id = '${subId}' returning status, score`)
check('student resubmits returned work', r.length === 1 && r[0].status === 'submitted')
await as(T, `select public.grade_submission('${subId}', 2.5, 'ดีมาก')`)
r = await as(E, `select score::float, feedback, status from public.submissions where id = '${subId}'`)
check('graded visible to student', r[0].score === 2.5 && r[0].status === 'graded' && r[0].feedback === 'ดีมาก')
await as(T, `select public.admin_set_score('${mid}', '${sidE}', 17)`)
r = await as(E, `select score::float from public.submissions where assignment_id = '${mid}'`)
check('admin_set_score upsert', r[0].score === 17)
await as(T, `select public.admin_set_score('${mid}', '${sidE}', null)`)
r = await as(E, `select score, status from public.submissions where assignment_id = '${mid}'`)
check('admin_set_score clear', r[0].score === null && r[0].status === 'draft')
r = await as(T, `select public.admin_import_students('[{"student_code":"20001","first_name":"ใหม่","classroom":"ม.3/2","number":"1"},{"student_code":"10001","first_name":"ธนกร","nickname":"กล้า","classroom":"ม.3/1"}]'::jsonb) r`)
check('import students', r[0].r.inserted === 1 && r[0].r.updated === 1)
r = await db.query(`select c.name from public.students s join public.classrooms c on c.id = s.classroom_id where student_code = '20001'`)
check('import creates classroom', r.rows[0]?.name === 'ม.3/2')
r = await as(T, `select public.admin_import_students('[{"student_code":"abc","first_name":"x"}]'::jsonb)`).catch((e) => e.message)
check('import validates code', String(r).startsWith('invalid_row'))
r = await as(E, `select count(*)::int n from public.my_gradebook_items()`)
const all = (await db.query(`select count(*)::int n from public.assignments`)).rows[0].n
const r2 = await as(E, `select count(*)::int n from public.assignments`)
console.log(r[0].n === all && r2[0].n < all ? 'PASS my_gradebook_items shows all, table hides locked' : 'FAIL my_gradebook_items')

// ---------- Phase 4 ----------
const g = async (type, correct, answer) => (await db.query(`select public.grade_answer($1, $2::jsonb, $3::jsonb) p`, [type, JSON.stringify(correct), JSON.stringify(answer)])).rows[0].p
check('grade mcq', Number(await g('mcq', { index: 2 }, { index: 2 })) === 1 && Number(await g('mcq', { index: 2 }, { index: 1 })) === 0)
check('grade tf', Number(await g('true_false', { value: false }, { value: false })) === 1 && Number(await g('true_false', { value: false }, { value: 'false' })) === 0)
check('grade matching partial', Number(await g('matching', { pairs: [2, 0, 1, 3] }, { pairs: [2, 0, 3, 1] })) === 0.5)
check('grade ordering', Number(await g('ordering', { order: [1, 0, 2] }, { order: [1, 0, 2] })) === 1)
check('grade fill normalize', Number(await g('fill', { accept: ['kWh', 'กิโลวัตต์-ชั่วโมง'] }, { text: ' KWH ' })) === 1)
check('grade short pending', (await g('short', null, { text: 'คำตอบ' })) === null && Number(await g('short', null, { text: ' ' })) === 0)
check('grade null answer = 0', Number(await g('mcq', { index: 1 }, null)) === 0)

r = await db.query(`select count(*)::int q, (select count(*)::int from public.exams) e from public.questions`)
check('seed 150 questions / 25 exams', r.rows[0].q === 150 && r.rows[0].e === 25)
await db.exec(readFileSync(join(root, 'supabase', 'seed_questions.sql'), 'utf8'))
r = await db.query(`select count(*)::int q from public.questions`)
check('question seed idempotent', r.rows[0].q === 150)
r = await db.query(`select count(*)::int n from public.exams where kind in ('unit_test','midterm','final') and assignment_id is null`)
check('scored exams linked to gradebook', r.rows[0].n === 0)

const F = '00000000-0000-0000-0000-00000000000f'
await db.exec(`insert into auth.users values ('${F}')`)
await db.exec('update public.app_settings set device_lock = false')
await as(F, `select public.login_with_code('10002', 'devF')`)
r = await as(F, `select count(*)::int n from public.questions`)
check('student cannot read questions table', r[0].n === 0)

const correctAnswerFor = async (qid) => {
  const c = (await db.query(`select type, correct_answer c from public.questions where id = $1`, [qid])).rows[0]
  return { type: c.type, ans: c.type === 'fill' ? { text: c.c.accept[0] } : c.c }
}

const ex1 = (await db.query(`select id from public.exams where kind = 'exit_ticket' and session_no = 1`)).rows[0].id
const st = (await as(F, `select public.start_exam('${ex1}') r`))[0].r
check('start_exam returns 5 questions', st.questions.length === 5)
check('no answers leaked to client', !JSON.stringify(st).includes('correct') && !JSON.stringify(st).includes('explanation'))
const again = (await as(F, `select public.start_exam('${ex1}') r`))[0].r
check('resume same attempt', again.attempt_id === st.attempt_id)
for (const q of st.questions) {
  const { ans } = await correctAnswerFor(q.id)
  await as(F, `select public.save_exam_answer('${st.attempt_id}', '${q.id}', '${JSON.stringify(ans)}'::jsonb)`)
}
r = await as(F, `select public.save_exam_answer('${st.attempt_id}', '${ex1}', '{}'::jsonb)`).catch((e) => e.message)
check('reject question not in exam', r === 'question_not_in_exam')
await as(F, `select public.record_tab_switch('${st.attempt_id}')`)
const res = (await as(F, `select public.submit_exam('${st.attempt_id}') r`))[0].r
check('exit ticket full score', Number(res.score) === 5 && Number(res.max_points) === 5 && res.show_answers === true && res.review.length === 5)
r = await as(F, `select coalesce(sum(xp),0)::int xp from public.xp_events where source = 'exit_ticket'`)
check('exit ticket full +20 XP', r[0].xp === 20)
r = (await as(F, `select public.start_exam('${ex1}') r`))[0].r
check('max attempts -> returns last result', r.finished === true && Number(r.result.score) === 5 && !r.attempt_id)
r = await as(F, `select public.save_exam_answer('${st.attempt_id}', '${st.questions[0].id}', '{}'::jsonb)`).catch((e) => e.message)
check('no edit after submit', r === 'already_submitted')
r = await as(F, `select tab_switches from public.exam_attempts where id = '${st.attempt_id}'`)
check('tab switch recorded', r[0].tab_switches === 1)

const ut1 = (await db.query(`select id, assignment_id from public.exams where title = 'ทดสอบท้ายหน่วยที่ 1'`)).rows[0]
r = await as(F, `select public.start_exam('${ut1.id}')`).catch((e) => e.message)
check('locked session exam blocked', r === 'exam_locked')
await as(T, `select public.admin_set_session_unlock(6, true, null)`)
const st2 = (await as(F, `select public.start_exam('${ut1.id}') r`))[0].r
check('unit test 20 questions', st2.questions.length === 20)
let shortQ = null
let answered = 0
for (const q of st2.questions) {
  const { type, ans } = await correctAnswerFor(q.id)
  if (type === 'short') {
    shortQ = q.id
    await as(F, `select public.save_exam_answer('${st2.attempt_id}', '${q.id}', '{"text":"มอเตอร์ใช้แม่เหล็กไฟฟ้า"}'::jsonb)`)
    continue
  }
  if (answered >= 10) continue
  await as(F, `select public.save_exam_answer('${st2.attempt_id}', '${q.id}', '${JSON.stringify(ans)}'::jsonb)`)
  answered++
}
const res2 = (await as(F, `select public.submit_exam('${st2.attempt_id}') r`))[0].r
check('unit test needs review, no answers shown', res2.needs_review === true && Number(res2.score) === 10 && res2.review === null)
r = await as(F, `select score::float from public.submissions where assignment_id = '${ut1.assignment_id}'`)
check('unit test synced to gradebook (10/20 -> 2.5/5)', r[0]?.score === 2.5)
r = await as(F, `select public.admin_grade_exam_answer('${st2.attempt_id}', '${shortQ}', 1)`).catch(() => 'denied')
check('student cannot grade exam', r === 'denied')
const res3 = (await as(T, `select public.admin_grade_exam_answer('${st2.attempt_id}', '${shortQ}', 1) r`))[0].r
check('admin grades short answer', Number(res3.score) === 11 && res3.needs_review === false)
r = await as(F, `select score::float from public.submissions where assignment_id = '${ut1.assignment_id}'`)
check('gradebook updated after review (11/20 -> 2.75)', r[0]?.score === 2.75)
await as(T, `select public.admin_rescore_exam('${ut1.id}')`)
r = await as(F, `select score::float s from public.exam_attempts where id = '${st2.attempt_id}'`)
check('rescore keeps teacher points', r[0].s === 11)

const pre = (await db.query(`select id from public.exams where kind = 'pretest'`)).rows[0].id
const st3 = (await as(F, `select public.start_exam('${pre}') r`))[0].r
await db.exec(`update public.exam_attempts set deadline_at = now() - interval '5 minutes' where id = '${st3.attempt_id}'`)
r = await as(F, `select public.save_exam_answer('${st3.attempt_id}', '${st3.questions[0].id}', '{"index":0}'::jsonb)`).catch((e) => e.message)
check('time up blocks saving', r === 'time_up')
r = (await as(F, `select public.start_exam('${pre}') r`))[0].r
const subm = await db.query(`select submitted_at is not null s from public.exam_attempts where id = '${st3.attempt_id}'`)
check('expired attempt auto-submitted on revisit', r.finished === true && subm.rows[0].s === true)
r = await as(E, `select public.exam_result('${st3.attempt_id}')`).catch((e) => e.message)
check('cannot view other student result', r === 'attempt_not_found')

// ---------- Phase 5 ----------
r = await db.query(`select (select count(*)::int from public.games) g, (select count(*)::int from public.badges) b`)
check('seed 18 games / 8 badges', r.rows[0].g === 18 && r.rows[0].b === 8)
await db.exec(readFileSync(join(root, 'supabase', 'seed_games.sql'), 'utf8'))
r = await db.query(`select count(*)::int g from public.games`)
check('game seed idempotent', r.rows[0].g === 18)

const G = '00000000-0000-0000-0000-000000000010'
await db.exec(`insert into auth.users values ('${G}')`)
await as(G, `select public.login_with_code('10004', 'devG')`)
const sidG = (await as(G, `select public.current_student_id() id`))[0].id

r = await as(G, `select slug, is_unlocked from public.my_games()`)
const unlocked = Object.fromEntries(r.map((x) => [x.slug, x.is_unlocked]))
check('my_games lists 18 with lock state', r.length === 18 && unlocked['warmup'] === true && unlocked['ip-hunter'] === false)

r = await as(G, `select public.submit_game_result('ip-hunter', 90, 60)`).catch((e) => e.message)
check('locked game rejected', r === 'game_locked')
r = await as(G, `select public.submit_game_result('warmup', 101, 60)`).catch((e) => e.message)
check('score above max rejected', r === 'invalid_score')
r = await as(G, `select public.submit_game_result('warmup', 80, 3)`).catch((e) => e.message)
check('too short duration rejected', r === 'invalid_duration')

const play1 = (await as(G, `select public.submit_game_result('warmup', 80, 30) r`))[0].r
check('first play full XP (80% of 10 = 8)', play1.xp === 8 && play1.first_play === true)
r = await as(G, `select public.submit_game_result('warmup', 100, 30)`).catch((e) => e.message)
check('rapid resubmit blocked', r === 'too_fast')
await db.exec(`update public.game_plays set played_at = played_at - interval '1 minute' where student_id = '${sidG}'`)
const play2 = (await as(G, `select public.submit_game_result('warmup', 100, 30) r`))[0].r
check('second play 20% XP (10*0.2 = 2)', play2.xp === 2 && play2.first_play === false && play2.best_score === 100)
await db.exec(`update public.game_plays set played_at = played_at - interval '1 minute' where student_id = '${sidG}'`)
await as(G, `select public.submit_game_result('warmup', 100, 30)`)
await db.exec(`update public.game_plays set played_at = played_at - interval '1 minute' where student_id = '${sidG}'`)
const play4 = (await as(G, `select public.submit_game_result('warmup', 100, 30) r`))[0].r
check('4th play today capped (0 XP)', play4.xp === 0 && play4.capped === true)
r = await as(G, `select coalesce(sum(xp),0)::int xp from public.xp_events where source = 'game'`)
check('game XP total 8+2+2', r[0].xp === 12)
r = await as(G, `insert into public.game_plays (game_id, student_id, score, duration_sec, xp_earned) select id, '${sidG}', 100, 10, 999 from public.games where slug = 'warmup'`).catch(() => 'denied')
check('student cannot insert game_plays directly', r === 'denied')

// เหรียญ: 5G Time Machine >= 80% (คาบ 3 = 5G หลังสลับ เปิดแล้ว)
const p5g = (await as(G, `select public.submit_game_result('5g-time-machine', 85, 40) r`))[0].r
check('badge awarded on game score', p5g.new_badges.some((b) => b.code === '5g-master'))
r = await as(G, `select count(*)::int n from public.student_badges`)
check('student sees own badge', r[0].n >= 1)
await db.exec(`update public.game_plays set played_at = played_at - interval '1 minute' where student_id = '${sidG}'`)
const p5g2 = (await as(G, `select public.submit_game_result('5g-time-machine', 90, 40) r`))[0].r
check('badge not awarded twice', !p5g2.new_badges.some((b) => b.code === '5g-master'))
// เหรียญมาเรียน 5 คาบ
await db.exec(`insert into public.attendance (student_id, session_no, status) select '${sidG}', n, 'present' from generate_series(11, 15) n`)
r = await db.query(`select count(*)::int n from public.student_badges sb join public.badges b on b.id = sb.badge_id where sb.student_id = '${sidG}' and b.code = 'attendance-5'`)
check('attendance badge via trigger', r.rows[0].n === 1)

// ลีดเดอร์บอร์ด
r = await as(G, `select * from public.leaderboard('class')`)
const me = r.find((x) => x.is_me)
check('leaderboard class shows me with xp', !!me && me.xp >= 12 && r.every((x) => x.classroom_name === 'ม.3/1'))
check('leaderboard hides student ids/codes', !Object.keys(r[0]).some((k) => k.includes('id') || k.includes('code')))
await db.exec(`update public.app_settings set leaderboard_mode = 'hidden'`)
r = await as(G, `select * from public.leaderboard('all')`)
const ra = await as(T, `select * from public.leaderboard('all')`)
check('hidden mode: students see nothing, admin sees all', r.length === 0 && ra.length > 0)
await db.exec(`update public.app_settings set leaderboard_mode = 'top10'`)
r = await db.query(`select updated_at from public.leaderboard_ticks`)
check('leaderboard tick row exists', r.rows.length === 1)

// อวาตาร์
await as(G, `select public.set_my_avatar('robot')`)
r = await as(G, `select avatar from public.students`)
check('set avatar', r[0].avatar === 'robot')
r = await as(G, `select public.set_my_avatar('<script>')`).catch((e) => e.message)
check('invalid avatar rejected', r === 'invalid_avatar')

// ---------- Phase 6 ----------
// ครูลบผลสอบ (ให้สอบใหม่) แล้วคะแนนในสมุดคะแนนต้องถูกล้าง
const utAttempt = (await db.query(`select a.id, e.assignment_id, a.student_id from public.exam_attempts a join public.exams e on e.id = a.exam_id where e.title = 'ทดสอบท้ายหน่วยที่ 1' limit 1`)).rows[0]
await as(T, `delete from public.exam_attempts where id = '${utAttempt.id}'`)
r = await db.query(`select count(*)::int n from public.submissions where assignment_id = '${utAttempt.assignment_id}' and student_id = '${utAttempt.student_id}'`)
check('deleting exam attempt clears gradebook score', r.rows[0].n === 0)
r = await as(F, `delete from public.exam_attempts returning id`)
check('student cannot delete own attempts', r.length === 0)

// ---------- DB Quest (ม.5) ----------
await db.exec(readFileSync(join(root, 'supabase', 'seed_dbquest.sql'), 'utf8'))
await db.exec(readFileSync(join(root, 'supabase', 'seed_dbquest.sql'), 'utf8')) // รันซ้ำได้
await db.exec(readFileSync(join(root, 'supabase', 'seed', 'answer_keys.sql'), 'utf8'))
await db.exec(readFileSync(join(root, 'supabase', 'seed', 'answer_keys.sql'), 'utf8')) // รันซ้ำได้
await db.exec(readFileSync(join(root, 'supabase', 'updates', 'dbquest_content.sql'), 'utf8')) // ไฟล์อัปเดตเนื้อหารันซ้ำได้
const D5 = '00000000-0000-0000-0000-0000000000d5'
const D3 = '00000000-0000-0000-0000-0000000000d3'
await db.exec(`insert into auth.users values ('${D5}'), ('${D3}');`)

r = await as(D5, `select public.login_with_code('55555', 'devD5') as r`)
check('dbq: 55555 logs in as ม.5 DB Quest', r[0].r.ok && r[0].r.student.course === 'dbquest_m5' && r[0].r.student.classroom_name === 'ม.5/1')
r = await as(D3, `select public.login_with_code('33333', 'devD3') as r`)
check('dbq: 33333 logs in as ม.3 design', r[0].r.ok && r[0].r.student.course === 'design_m3')
r = await as(D5, `select public.whoami() as r`)
check('dbq: whoami carries course', r[0].r.student.course === 'dbquest_m5')

const dbqTables = (await db.query(`select tablename from pg_tables where schemaname = 'public' and tablename like 'dbq\\_%'`)).rows.map((x) => x.tablename)
check('dbq: 18 tables exist', dbqTables.length === 18)
check('dbq: RLS on every table', (await db.query(`select count(*)::int n from pg_tables where tablename like 'dbq\\_%' and not rowsecurity`)).rows[0].n === 0)
let directOk = 0
for (const t of dbqTables) {
  for (const uid of [D5, T]) {
    const res = await as(uid, `select 1 from public.${t} limit 1`).catch(() => 'denied')
    if (res === 'denied') directOk++
  }
}
check('dbq: student and admin cannot read any dbq table directly', directOk === dbqTables.length * 2)
r = await as(D5, `insert into public.dbq_xp_events (student_id, source, amount) select id, 'hack', 9999 from public.students limit 1`).catch(() => 'denied')
check('dbq: student cannot insert XP directly', r === 'denied')

r = await as(D5, `select public.dbq_me() as r`)
check('dbq: dbq_me for ม.5 student', r[0].r.student.student_code === '55555' && r[0].r.xp === 0 && r[0].r.settings.unlock_threshold_pct === 80)
r = await as(D3, `select public.dbq_me() as r`).catch(() => 'denied')
check('dbq: ม.3 student cannot use DB Quest RPC', r === 'denied')
r = await as(T, `select public.dbq_me() as r`)
check('dbq: admin can call dbq_me', r[0].r.role === 'admin' && r[0].r.student === null)
r = await as(D5, `select public.dbq_admin_get_settings() as r`).catch(() => 'denied')
check('dbq: student cannot read admin settings', r === 'denied')
r = await as(D5, `select public.dbq_student_id() as r`).catch(() => 'denied')
check('dbq: helper functions not callable by client', r === 'denied')
await as(T, `select public.dbq_admin_set_setting('leaderboard_enabled', 'false')`)
r = await as(D5, `select public.dbq_me() as r`)
check('dbq: admin setting change visible', r[0].r.settings.leaderboard_enabled === false)
r = await as(T, `select public.dbq_admin_set_setting('admin_code', '"x"')`).catch(() => 'denied')
check('dbq: unknown setting rejected', r === 'denied')

await as(T, `select public.admin_import_students('[{"student_code":"55600","first_name":"นำเข้า","classroom":"ม.5/2"}]'::jsonb)`)
r = await db.query(`select course from public.classrooms where name = 'ม.5/2'`)
check('dbq: CSV-created ม.5 room becomes DB Quest', r.rows[0]?.course === 'dbquest_m5')

// เปิดคาบเว็บ ม.3 "ทุกห้อง" ต้องไม่ไปเปิดให้ห้อง ม.5
await as(T, `select public.admin_set_session_unlock(7, true)`)
r = await db.query(`select count(*)::int n from public.classroom_session_unlocks u join public.classrooms c on c.id = u.classroom_id where c.course = 'dbquest_m5'`)
check('dbq: M.3 unlock-all skips ม.5 rooms', r.rows[0].n === 0)

// ---------- DB Quest: คาบเรียน + เฉลย (migration 010) ----------
const err = (e) => e.message
const keyCount = (await db.query(`select count(*)::int n from public.dbq_answer_keys`)).rows[0].n
r = await db.query(`select count(*)::int n from public.dbq_answer_keys where session_no = 1`)
check('dbq010: answer keys seeded (s01 = 10 items: 6 + ภารกิจปิดคาบ 4)', r.rows[0].n === 10)
r = await db.query(`select game_key from public.dbq_lessons where session_no = 1`)
check('dbq010: lesson game_key from sNN.json', r.rows[0].game_key === 'memory-match')
r = await db.query(`select item_id, max_score from public.dbq_assignments where item_id = 'ws-s01'`)
check('dbq010: worksheet seeded', r.rows[0]?.max_score == 5)

// เฉลย: นักเรียนดึงไม่ได้ + บันทึก log / ครูดึงได้
r = await as(D5, `select public.dbq_get_answer_key('{}'::jsonb) as r`)
check('dbq010: student get_answer_key -> forbidden', r[0].r.error === 'forbidden' && !('items' in r[0].r))
r = await as(D3, `select public.dbq_get_answer_key('{"session_no":1}'::jsonb) as r`)
check('dbq010: ม.3 student get_answer_key -> forbidden', r[0].r.error === 'forbidden')
r = await db.query(`select action, detail from public.dbq_security_log order by id`)
check('dbq010: denied key access logged', r.rows.length === 2 && r.rows.every((x) => x.action === 'get_answer_key_denied') && r.rows[1].detail.session_no === 1)
r = await as(T, `select public.dbq_get_answer_key('{}'::jsonb) as r`)
check('dbq010: admin gets all keys', r[0].r.items.length === keyCount && r[0].r.items[0].answer !== undefined)
r = await as(T, `select public.dbq_get_answer_key('{"session_no":1,"item_type":"practice"}'::jsonb) as r`)
check('dbq010: admin key scope filter', r[0].r.items.map((x) => x.item_id).join() === 's01-p1,s01-p2')
r = await as(D5, `select public.dbq_grade('mcq', '{"choice":2}', '{"choice":2}') as r`).catch(() => 'denied')
check('dbq010: dbq_grade not callable by client', r === 'denied')
r = await as(D5, `select public.dbq_award_xp(public.current_student_id(), 'hack', 9999) as r`).catch(() => 'denied')
check('dbq010: dbq_award_xp not callable by client', r === 'denied')

// ตัวตรวจคำตอบ
const gr = async (type, answer, resp) =>
  (await db.query(`select public.dbq_grade($1, $2::jsonb, $3::jsonb) g`, [type, JSON.stringify(answer), JSON.stringify(resp)])).rows[0].g
check('dbq010: grade mcq', (await gr('mcq', { choice: 2 }, { choice: 2 })) && !(await gr('mcq', { choice: 2 }, { choice: 1 })))
check('dbq010: grade multi ignores order', (await gr('multi', { choices: [0, 2] }, { choices: [2, 0] })) && !(await gr('multi', { choices: [0, 2] }, { choices: [0] })))
check('dbq010: grade fill normalizes', (await gr('fill', { accept: ['Hardware'] }, { text: '  hardware ' })) && !(await gr('fill', { accept: ['x'] }, { text: '' })))
check('dbq010: grade order exact', (await gr('order', { order: ['a', 'b'] }, { order: ['a', 'b'] })) && !(await gr('order', { order: ['a', 'b'] }, { order: ['b', 'a'] })))
check('dbq010: grade classify', (await gr('classify', { pairs: { a: 'x', b: 'y' } }, { pairs: { b: 'y', a: 'x' } })) && !(await gr('classify', { pairs: { a: 'x' } }, { pairs: { a: 'y' } })))
check('dbq010: grade malformed -> false', !(await gr('mcq', { choice: 2 }, { choice: 'abc' })) && !(await gr('order', { order: ['a'] }, { order: 'a' })) && !(await gr('rubric', {}, {})))

// ตรวจคำตอบ: คืนแค่ถูก/ผิด + คำใบ้ ไม่มีเฉลย
let totalXp = 0
r = await as(D5, `select public.dbq_check_answer('s01-c1-q', '{"choice":0}') as r`)
check('dbq010: wrong answer -> hint, no xp', r[0].r.correct === false && r[0].r.score === 0 && r[0].r.hint?.length > 0 && r[0].r.xp === 0)
check('dbq010: check_answer returns only correct/score/hint/xp', Object.keys(r[0].r).sort().join() === 'correct,hint,score,xp')
r = await as(D5, `select public.dbq_check_answer('s01-c1-q', '{"choice":2}') as r`)
check('dbq010: correct after retry -> 2 xp, no hint', r[0].r.correct === true && r[0].r.hint === null && r[0].r.xp === 2)
totalXp += r[0].r.xp
r = await as(D5, `select public.dbq_check_answer('s01-c1-q', '{"choice":2}') as r`)
check('dbq010: re-answer solved item -> 0 xp', r[0].r.correct === true && r[0].r.xp === 0)
r = await as(D5, `select public.dbq_check_answer('s01-c1-q', '{"choice":0}') as r`)
r = await db.query(`select attempts, correct from public.dbq_item_attempts where item_id = 's01-c1-q'`)
check('dbq010: later wrong answer keeps solved', r.rows[0].correct === true && r.rows[0].attempts === 4)
r = await as(D5, `select public.dbq_check_answer('ws-s01', '{}') as r`).catch(err)
check('dbq010: worksheet key not gradable via check_answer', r === 'not_found')
r = await as(D5, `select public.dbq_check_answer('nope', '{}') as r`).catch(err)
check('dbq010: unknown item -> not_found', r === 'not_found')
r = await as(D5, `select public.dbq_check_answer('s01-c2-q', jsonb_build_object('x', repeat('a', 30000))) as r`).catch(err)
check('dbq010: oversized response rejected', r === 'response_too_large')
r = await as(D3, `select public.dbq_check_answer('s01-c1-q', '{"choice":2}') as r`).catch(err)
check('dbq010: ม.3 student cannot check answers', r === 'forbidden')

// ขั้นในคาบ
r = await as(D5, `select public.dbq_session_state(1) as r`)
check('dbq010: s01 steps', r[0].r.steps.join() === 'warmup,lesson,practice,game,worksheet,wrapup' && r[0].r.solved.join() === 's01-c1-q' && r[0].r.pct === 0)
check('dbq010: session_state has no answer data', !/explanation|teacher_notes|"answer"|d-2":"server/.test(JSON.stringify(r[0].r)))
r = await as(D5, `select public.dbq_my_map() as r`)
check('dbq010: map s1 open, s2 locked', r[0].r[0].open === true && r[0].r[1].open === false && r[0].r.length === 20)
r = await as(D5, `select public.dbq_session_state(2) as r`).catch(err)
check('dbq010: locked session state denied', r === 'locked')
r = await as(D5, `select public.dbq_complete_step(2, 'warmup', '{"answers":["x"]}') as r`).catch(err)
check('dbq010: complete step in locked session denied', r === 'locked')
r = await as(D5, `select public.dbq_complete_step(1, 'hack', '{}') as r`).catch(err)
check('dbq010: invalid step rejected', r === 'invalid_step')

r = await as(D5, `select public.dbq_complete_step(1, 'warmup', '{"answers":["", "  "]}') as r`).catch(err)
check('dbq010: warmup needs a non-empty answer', r === 'incomplete')
r = await as(D5, `select public.dbq_complete_step(1, 'warmup', '{"answers":["แอปธนาคาร"]}') as r`)
check('dbq010: warmup done -> 5 xp', r[0].r.ok && r[0].r.xp === 5 && r[0].r.pct === 16)
totalXp += r[0].r.xp
r = await as(D5, `select public.dbq_complete_step(1, 'warmup', '{"answers":["อีกครั้ง"]}') as r`)
check('dbq010: repeat step -> 0 xp', r[0].r.xp === 0)

r = await as(D5, `select public.dbq_complete_step(1, 'lesson', '{}') as r`).catch(err)
check('dbq010: lesson needs all card checks correct', r === 'incomplete')
for (const [id, resp] of [
  ['s01-c2-q', { pairs: { 'i-1': 'hw', 'i-2': 'data', 'i-3': 'sw', 'i-4': 'people', 'i-5': 'data' } }],
  ['s01-c3-q', { pairs: { 'd-1': 'client', 'd-2': 'server', 'd-3': 'client', 'd-4': 'client' } }],
]) {
  r = await as(D5, `select public.dbq_check_answer('${id}', '${JSON.stringify(resp)}') as r`)
  check(`dbq010: ${id} first-try correct -> 5 xp`, r[0].r.correct && r[0].r.xp === 5)
  totalXp += r[0].r.xp
}
r = await as(D5, `select public.dbq_complete_step(1, 'lesson', '{}') as r`)
check('dbq010: lesson done -> 20 xp', r[0].r.xp === 20)
totalXp += r[0].r.xp

r = await as(D5, `select public.dbq_check_answer('s01-p1', '{"pairs":{}}') as r`)
r = await as(D5, `select public.dbq_complete_step(1, 'practice', '{}') as r`).catch(err)
check('dbq010: practice needs every item attempted', r === 'incomplete')
r = await as(D5, `select public.dbq_game_deck('memory-match') as r`)
check('dbq015: game deck available as soon as the session is open', r[0].r.pairs.length === 8)
r = await as(D5, `select public.dbq_game_deck('db-terms-match') as r`).catch(err)
check('dbq015: game deck of a locked session is still locked', r === 'locked')
r = await as(D5, `select public.dbq_check_answer('s01-p2', '{"text":" HARDWARE "}') as r`)
check('dbq010: fill accepts normalized text', r[0].r.correct && r[0].r.xp === 5)
totalXp += r[0].r.xp
r = await as(D5, `select public.dbq_complete_step(1, 'practice', '{}') as r`)
check('dbq010: practice done (wrong answers still count as attempted)', r[0].r.xp === 15)
totalXp += r[0].r.xp

r = await as(D5, `select public.dbq_complete_step(1, 'game', '{}') as r`).catch(err)
check('dbq010: game step needs a game score', r === 'incomplete')
// สำรับเกม (migration 012)
r = await as(D5, `select public.dbq_game_deck('memory-match') as r`)
check('dbq012: deck available after practice', r[0].r.pairs.length === 8 && r[0].r.session_no === 1 && r[0].r.game_key === 'memory-match' && r[0].r.time_limit_sec > 0)
r = await as(T, `select public.dbq_game_deck('memory-match') as r`)
check('dbq012: admin gets deck', r[0].r.pairs.length === 8)
r = await as(D3, `select public.dbq_game_deck('memory-match') as r`).catch(err)
check('dbq012: ม.3 student cannot get deck', r === 'forbidden')
r = await as(D5, `select public.dbq_game_deck('nope') as r`).catch(err)
check('dbq012: unknown deck -> game_not_found', r === 'game_not_found')

// ส่งผลเกม (migration 011)
const backdate = () => db.exec(`update public.dbq_game_scores set played_at = played_at - interval '1 minute'`)
r = await as(D5, `select public.dbq_submit_game_result('nope', 50, 30) as r`).catch(err)
check('dbq011: unknown game rejected', r === 'game_not_found')
r = await as(D5, `select public.dbq_submit_game_result('memory-match', 101, 30) as r`).catch(err)
check('dbq011: score over 100 rejected', r === 'invalid_score')
r = await as(D5, `select public.dbq_submit_game_result('memory-match', 80, 3) as r`).catch(err)
check('dbq011: too-short duration rejected', r === 'invalid_duration')
r = await as(D3, `select public.dbq_submit_game_result('memory-match', 80, 30) as r`).catch(err)
check('dbq011: ม.3 student cannot submit DB Quest game', r === 'forbidden')
r = await as(D5, `select public.dbq_game_stars(100) as r`).catch(() => 'denied')
check('dbq011: dbq_game_stars not callable by client', r === 'denied')
r = await as(D5, `select public.dbq_submit_game_result('memory-match', 75, 30) as r`)
check('dbq011: 75 -> 2 stars, 10 xp', r[0].r.ok && r[0].r.stars === 2 && r[0].r.xp === 10 && r[0].r.best_score === 75 && r[0].r.badges.length === 0)
totalXp += r[0].r.xp
r = await as(D5, `select public.dbq_submit_game_result('memory-match', 95, 30) as r`).catch(err)
check('dbq011: replay within 5s -> too_fast', r === 'too_fast')
await backdate()
r = await as(D5, `select public.dbq_submit_game_result('memory-match', 70, 30) as r`)
check('dbq011: same stars again -> 0 xp, best kept', r[0].r.stars === 2 && r[0].r.xp === 0 && r[0].r.best_score === 75)
await backdate()
r = await as(D5, `select public.dbq_submit_game_result('memory-match', 95, 30) as r`)
check('dbq011: new 3rd star -> 5 xp + three-stars badge', r[0].r.stars === 3 && r[0].r.xp === 5 && r[0].r.best_stars === 3 && r[0].r.badges.join() === 'three-stars')
totalXp += r[0].r.xp
await backdate()
r = await as(D5, `select public.dbq_submit_game_result('memory-match', 100, 30) as r`)
check('dbq011: badge awarded once', r[0].r.xp === 0 && r[0].r.badges.length === 0)
r = await db.query(`select count(*)::int n, max(unit_no) u from public.dbq_game_scores`)
check('dbq011: every play stored with unit', r.rows[0].n === 4 && r.rows[0].u === 1)
r = await as(T, `select public.dbq_submit_game_result('memory-match', 100, 30) as r`)
check('dbq011: admin preview not recorded', r[0].r.preview === true && (await db.query(`select count(*)::int n from public.dbq_game_scores`)).rows[0].n === 4)
await db.exec(`update public.dbq_lessons set game_key = 'locked-game' where session_no = 5`)
r = await as(D5, `select public.dbq_submit_game_result('locked-game', 80, 30) as r`).catch(err)
check('dbq011: game of locked session rejected', r === 'locked')
await db.exec(`update public.dbq_lessons set game_key = null where session_no = 5`)

r = await as(D5, `select public.dbq_complete_step(1, 'game', '{}') as r`)
check('dbq010: game done -> 10 xp', r[0].r.xp === 10)
totalXp += r[0].r.xp

r = await as(D5, `select public.dbq_complete_step(1, 'worksheet', '{}') as r`).catch(err)
check('dbq010: worksheet step needs submission', r === 'incomplete')
r = await as(D5, `select public.dbq_submit_worksheet('ws-s01', '{"text":"   "}') as r`).catch(err)
check('dbq010: empty worksheet rejected', r === 'invalid_content')
r = await as(D3, `select public.dbq_submit_worksheet('ws-s01', '{"text":"x"}') as r`).catch(err)
check('dbq010: ม.3 student cannot submit DB Quest worksheet', r === 'forbidden')
r = await as(D5, `select public.dbq_submit_worksheet('ws-s01', '{"text":"ร้านสะดวกซื้อ ...", "score": 5}') as r`)
check('dbq010: worksheet submitted -> 15 xp', r[0].r.ok && r[0].r.xp === 15)
totalXp += r[0].r.xp
r = await db.query(`select content, score from public.dbq_submissions s join public.dbq_assignments a on a.id = s.assignment_id where a.item_id = 'ws-s01'`)
check('dbq010: worksheet stores only text (client score ignored)', Object.keys(r.rows[0].content).join() === 'text' && r.rows[0].score === null)
r = await as(D5, `select public.dbq_complete_step(1, 'worksheet', '{}') as r`)
check('dbq010: worksheet step done, 83% unlocks next session', r[0].r.xp === 10 && r[0].r.pct === 83)
totalXp += r[0].r.xp
r = await as(D5, `select public.dbq_my_map() as r`)
check('dbq010: s2 open after reaching 80%', r[0].r[1].open === true && r[0].r[0].pct === 83)

r = await as(D5, `select public.dbq_complete_step(1, 'wrapup', '{"reflection":"เขียนอย่างเดียว"}') as r`).catch(err)
check('dbq017: closing mission needs every question attempted', r === 'incomplete')
r = await as(D5, `select public.dbq_check_answer('s01-w1', '{"pairs":{"w1-a":"data","w1-b":"info","w1-c":"hw","w1-d":"sw","w1-e":"people"}}') as r`)
check('dbq017: closing question graded on server', r[0].r.correct === true && r[0].r.xp === 5 && Object.keys(r[0].r).sort().join() === 'correct,hint,score,xp')
totalXp += r[0].r.xp
r = await as(D5, `select public.dbq_check_answer('s01-w2', '{"order":["o3","o1","o4","o2"]}') as r`)
check('dbq017: wrong closing answer gets hint', r[0].r.correct === false && r[0].r.hint.length > 0)
r = await as(D5, `select public.dbq_check_answer('s01-w3', '{"choice":1}') as r`)
totalXp += r[0].r.xp
r = await as(D5, `select public.dbq_check_answer('s01-w4', '{"choices":[0]}') as r`)
check('dbq017: multi needs all correct choices', r[0].r.correct === false)
// ให้หน่วย 1 มีแค่คาบ 1 ชั่วคราว เพื่อทดสอบเหรียญจบหน่วย
const unit1Others = (await db.query(`update public.dbq_lessons set unit_no = 2 where unit_no = 1 and session_no <> 1 returning session_no`)).rows.map((x) => x.session_no)
r = await as(D5, `select public.dbq_complete_step(1, 'wrapup', '{}') as r`)
check('dbq010: wrapup -> 100% + session bonus + unit badge', r[0].r.pct === 100 && r[0].r.xp === 30 && r[0].r.badges.join() === 'unit-complete')
totalXp += r[0].r.xp
await db.exec(`update public.dbq_lessons set unit_no = 1 where session_no = any('{${unit1Others.join(',')}}'::int[])`)
r = await db.query(`select badge_key from public.dbq_student_badges order by badge_key`)
check('dbq010: badges stored', r.rows.map((x) => x.badge_key).join() === 'three-stars,unit-complete')
r = await as(D5, `select public.dbq_me() as r`)
check('dbq010: dbq_me xp equals awarded xp', r[0].r.xp === totalXp)

await db.exec(`update public.dbq_submissions set score = 4, graded_at = now()`)
r = await as(D5, `select public.dbq_submit_worksheet('ws-s01', '{"text":"แก้"}') as r`).catch(err)
check('dbq010: graded worksheet cannot be resubmitted', r === 'already_graded')

// ห้องอื่น: ความก้าวหน้าแยกกัน + ครูปลดล็อกรายห้อง
const D6 = '00000000-0000-0000-0000-0000000000d6'
await db.exec(`insert into auth.users values ('${D6}');`)
r = await as(D6, `select public.login_with_code('55600', 'devD6') as r`)
check('dbq010: imported ม.5/2 student logs in', r[0].r.ok)
r = await as(D6, `select public.dbq_session_state(1) as r`)
check('dbq010: progress is per student', r[0].r.solved.length === 0 && r[0].r.pct === 0 && Object.keys(r[0].r.submissions).length === 0)
const room52 = (await db.query(`select id from public.classrooms where name = 'ม.5/2'`)).rows[0].id
r = await as(D6, `select public.dbq_admin_set_unlock(3, true, '${room52}')`).catch(err)
check('dbq010: student cannot unlock sessions', r === 'forbidden')
await as(T, `select public.dbq_admin_set_unlock(3, true, '${room52}')`)
r = await as(D6, `select public.dbq_my_map() as r`)
check('dbq010: teacher unlock opens session for that room', r[0].r[2].open === true && r[0].r[1].open === false)
r = await as(D5, `select public.dbq_my_map() as r`)
check('dbq010: room unlock does not leak to other rooms', r[0].r[2].open === false)
r = await as(T, `select public.dbq_admin_unlock_overview() as r`)
check('dbq010: unlock overview', r[0].r.find((x) => x.name === 'ม.5/2').unlocked.join() === '3')
await as(T, `select public.dbq_admin_set_unlock(3, false)`)
r = await as(D6, `select public.dbq_my_map() as r`)
check('dbq010: re-lock all rooms', r[0].r[2].open === false)

// ครูดูตัวอย่าง: ใช้ได้ทุกคาบ แต่ไม่บันทึก
r = await as(T, `select public.dbq_my_map() as r`)
check('dbq010: admin sees every session open', r[0].r.every((x) => x.open) && r[0].r[0].pct === null)
r = await as(T, `select public.dbq_check_answer('s01-c1-q', '{"choice":2}') as r`)
check('dbq010: admin preview check works without xp', r[0].r.correct && r[0].r.xp === 0)
r = await as(T, `select public.dbq_complete_step(1, 'lesson', '{}') as r`)
check('dbq010: admin preview complete_step not recorded', r[0].r.preview === true)
r = await db.query(`select count(*)::int n from public.dbq_item_attempts a join public.students s on s.id = a.student_id where s.student_code not in ('55555', '55600')`)
check('dbq010: no attempts recorded for non-students', r.rows[0].n === 0)

// ---------- DB Quest: คะแนนและหลังบ้าน (migration 013) ----------
for (const fn of [
  `dbq_admin_overview()`,
  `dbq_admin_students(null)`,
  `dbq_admin_gradebook(null)`,
  `dbq_admin_submissions('{}')`,
  `dbq_admin_set_manual_score(public.current_student_id(), 'midterm', 20, 20)`,
]) {
  r = await as(D5, `select public.${fn} as r`).catch(err)
  check(`dbq013: student cannot call ${fn.split('(')[0]}`, r === 'forbidden')
}
r = await as(D5, `select public.dbq_student_scores(public.current_student_id()) as r`).catch(() => 'denied')
check('dbq013: dbq_student_scores not callable by client', r === 'denied')
r = await as(D3, `select public.dbq_my_scores() as r`).catch(err)
check('dbq013: ม.3 student cannot read DB Quest scores', r === 'forbidden')

// คะแนนของฉัน: ใบงาน 4/10 (ws-s01 ได้ 4, ws-s02 ยังไม่ส่ง) · เกม 100/200 (2 เกม เล่น 1 เกม)
r = await as(D5, `select public.dbq_my_scores() as r`)
let sc = r[0].r.scores
check('dbq013: worksheet category counts missing work as 0', sc.categories.worksheet.earned == 4 && sc.categories.worksheet.max == 10 && sc.categories.worksheet.pct == 40 && sc.categories.worksheet.points == 10)
check('dbq013: game category = best score per game', sc.categories.game.pct == 50 && sc.categories.game.points == 5)
check('dbq013: manual categories empty until entered', sc.categories.midterm.pct === null && sc.total == 15 && sc.available == 35)
check('dbq013: my_scores lists assignments with status', r[0].r.assignments.map((a) => `${a.item_id}:${a.status}`).join() === 'ws-s01:graded,ws-s02:missing')
check('dbq013: my_scores lists games', r[0].r.games.find((g) => g.game_key === 'memory-match').best_stars === 3)
r = await as(T, `select public.dbq_my_scores() as r`)
check('dbq013: admin preview my_scores', r[0].r.preview === true)

// คะแนนที่ครูกรอก
const sidD5 = (await db.query(`select id from public.students where student_code = '55555'`)).rows[0].id
r = await as(T, `select public.dbq_admin_set_manual_score('${sidD5}', 'midterm', 15, 20)`)
r = await as(D5, `select public.dbq_my_scores() as r`)
sc = r[0].r.scores
check('dbq013: manual midterm 15/20 -> 7.5 points', sc.categories.midterm.pct == 75 && sc.categories.midterm.points == 7.5 && sc.total == 22.5 && sc.available == 45)
r = await as(T, `select public.dbq_admin_set_manual_score('${sidD5}', 'midterm', 25, 20)`).catch(err)
check('dbq013: manual score over max rejected', r === 'invalid_score')
r = await as(T, `select public.dbq_admin_set_manual_score('${sidD5}', 'worksheet', 5, 10)`).catch(err)
check('dbq013: auto category cannot be entered manually', r === 'invalid_category')
r = await as(T, `select public.dbq_admin_set_manual_score('${sidD5}', 'final', 30, 40)`)
r = await as(T, `select public.dbq_admin_set_manual_score('${sidD5}', 'final', null)`)
r = await db.query(`select count(*)::int n from public.dbq_manual_scores where category = 'final'`)
check('dbq013: null manual score deletes', r.rows[0].n === 0)

// ตรวจงาน
r = await as(D6, `select public.dbq_submit_worksheet('ws-s01', '{"text":"งานของห้อง 5/2"}') as r`)
check('dbq013: second student submits worksheet', r[0].r.ok)
r = await as(T, `select public.dbq_admin_overview() as r`)
check('dbq013: overview counts pending grading', r[0].r.pending_grading === 1 && r[0].r.classrooms.find((c) => c.name === 'ม.5/2').pending_grading === 1)
check('dbq013: overview session progress', r[0].r.sessions.length === 20 && r[0].r.sessions[0].completed >= 1)
r = await as(T, `select public.dbq_admin_submissions('{"status":"pending"}') as r`)
const pend = r[0].r
check('dbq013: pending list has rubric + sample for teacher', pend.length === 1 && pend[0].student.student_code === '55600' && pend[0].rubric.length === 3 && pend[0].sample.length > 0)
r = await as(T, `select public.dbq_admin_grade_submission('${pend[0].id}', 6, '') as r`).catch(err)
check('dbq013: grade above max rejected', r === 'invalid_score')
r = await as(T, `select public.dbq_admin_grade_submission('${pend[0].id}', 4.5, 'ตัวอย่างดีมาก') as r`)
check('dbq013: grade saved', r[0].r.graded === true)
r = await as(D6, `select public.dbq_my_scores() as r`)
check('dbq013: student sees score + feedback', r[0].r.assignments[0].status === 'graded' && r[0].r.assignments[0].score == 4.5 && r[0].r.assignments[0].feedback === 'ตัวอย่างดีมาก')
r = await as(D6, `select public.dbq_submit_worksheet('ws-s01', '{"text":"แก้"}') as r`).catch(err)
check('dbq013: graded work locked for student', r === 'already_graded')
await as(T, `select public.dbq_admin_grade_submission('${pend[0].id}', null) as r`)
r = await as(D6, `select public.dbq_submit_worksheet('ws-s01', '{"text":"แก้แล้ว"}') as r`)
check('dbq013: ungrade lets student resubmit', r[0].r.ok)
r = await as(T, `select public.dbq_admin_submissions('{"status":"graded"}') as r`)
check('dbq013: graded filter', r[0].r.length === 1 && r[0].r[0].student.student_code === '55555')

// รายชื่อ / รายละเอียด / สมุดคะแนน
const meXp = (await as(D5, `select public.dbq_me() as r`))[0].r.xp
r = await as(T, `select public.dbq_admin_students(null) as r`)
const d5row = r[0].r.find((x) => x.student_code === '55555')
check('dbq013: students list', d5row.xp === meXp && d5row.sessions_done === 1 && d5row.badges === 2 && d5row.classroom_name === 'ม.5/1' && r[0].r.every((x) => x.classroom_name.startsWith('ม.5')))
r = await as(T, `select public.dbq_admin_student_detail('${sidD5}') as r`)
check('dbq013: student detail', r[0].r.sessions.length === 20 && r[0].r.sessions[0].pct === 100 && r[0].r.scores.total == 22.5 && r[0].r.games.length === 1 && r[0].r.recent_xp.length > 0)
const sidD3 = (await db.query(`select id from public.students where student_code = '33333'`)).rows[0].id
r = await as(T, `select public.dbq_admin_student_detail('${sidD3}') as r`).catch(err)
check('dbq013: ม.3 student not in DB Quest detail', r === 'not_found')
r = await as(T, `select public.dbq_admin_gradebook('${room52}') as r`)
check('dbq013: gradebook filtered by room', r[0].r.rows.length >= 1 && r[0].r.rows.every((x) => x.classroom_name === 'ม.5/2') && r[0].r.assignments.length === 2)
r = await as(T, `select public.dbq_admin_gradebook(null) as r`)
const gb5 = r[0].r.rows.find((x) => x.student_code === '55555')
const ws1 = r[0].r.assignments.find((a) => a.item_id === 'ws-s01').id
check('dbq013: gradebook cells', gb5.work[ws1].status === 'graded' && gb5.work[ws1].score == 4 && gb5.manual.midterm.score == 15 && gb5.scores.total == 22.5 && r[0].r.manual_max.midterm == 20)

// ตั้งค่า
r = await as(T, `select public.dbq_admin_set_setting('score_weights', '{"worksheet":25,"unit_quiz":15,"game":10,"project":15,"attendance":5,"midterm":10,"final":19}')`).catch(err)
check('dbq013: weights must sum 100', r === 'weights_must_sum_100')
r = await as(T, `select public.dbq_admin_set_setting('score_weights', '{"worksheet":25}')`).catch(err)
check('dbq013: weights need every category', r === 'invalid_value')
r = await as(T, `select public.dbq_admin_set_setting('unlock_threshold_pct', '150')`).catch(err)
check('dbq013: threshold range checked', r === 'invalid_value')
r = await as(T, `select public.dbq_admin_set_setting('leaderboard_enabled', '"yes"')`).catch(err)
check('dbq013: boolean setting checked', r === 'invalid_value')
await as(T, `select public.dbq_admin_set_setting('score_weights', '{"worksheet":50,"unit_quiz":0,"game":50,"project":0,"attendance":0,"midterm":0,"final":0}')`)
r = await as(D5, `select public.dbq_my_scores() as r`)
check('dbq013: new weights applied', r[0].r.scores.total == 45)
await as(T, `select public.dbq_admin_set_setting('score_weights', '{"worksheet":25,"unit_quiz":15,"game":10,"project":15,"attendance":5,"midterm":10,"final":20}')`)

// อันดับ
r = await as(D5, `select public.dbq_leaderboard() as r`)
check('dbq013: leaderboard respects disabled setting', r[0].r.enabled === false)
await as(T, `select public.dbq_admin_set_setting('leaderboard_enabled', 'true')`)
r = await as(D5, `select public.dbq_leaderboard() as r`)
check('dbq013: leaderboard ranks own room', r[0].r.enabled && r[0].r.rows[0].is_me === true && r[0].r.rows[0].rank === 1 && r[0].r.rows.every((x) => !('student_code' in x)))

// ---------- DB Quest: ชื่อเกม (migration 014) ----------
r = await as(D5, `select public.dbq_game_titles() as r`)
check('dbq014: game titles for student', r[0].r['memory-match'] === '🃏 Memory Match' && r[0].r['db-terms-match'].includes('ศัพท์ฐานข้อมูล'))
check('dbq014: titles carry no deck pairs', !JSON.stringify(r[0].r).includes('meaning'))
r = await as(D3, `select public.dbq_game_titles() as r`).catch(err)
check('dbq014: ม.3 student denied', r === 'forbidden')
r = await as(T, `select public.dbq_game_titles() as r`)
check('dbq014: admin gets titles', Object.keys(r[0].r).length === 2)

// ---------- ลบนักเรียน (หน้าจัดการนักเรียน) ----------
r = await as(D5, `delete from public.students where student_code = '55600' returning id`)
check('students: student cannot delete others', r.length === 0)
const sid600 = (await db.query(`select id from public.students where student_code = '55600'`)).rows[0].id
r = await db.query(`select count(*)::int n from public.dbq_submissions where student_id = '${sid600}'`)
check('students: delete target has data', r.rows[0].n === 1)
r = await as(T, `delete from public.students where student_code = '55600' returning id`)
check('students: admin deletes student', r.length === 1)
r = await db.query(`select (select count(*) from public.dbq_submissions where student_id = '${sid600}')::int s, (select count(*) from public.sessions where student_id = '${sid600}')::int l`)
check('students: delete cascades to submissions and logins', r.rows[0].s === 0 && r.rows[0].l === 0)
// ---------- ลบห้องเรียน (หน้าจัดการห้องเรียน) ----------
r = await as(D5, `delete from public.classrooms where name = 'ม.5/2' returning id`)
check('classrooms: student cannot delete rooms', r.length === 0)
await as(T, `select public.dbq_admin_set_unlock(4, true, '${room52}')`)
r = await as(T, `delete from public.classrooms where name = 'ม.5/2' and not exists (select 1 from public.students st where st.classroom_id = classrooms.id) returning id`)
check('classrooms: admin deletes empty room', r.length === 1)
r = await db.query(`select count(*)::int n from public.dbq_classroom_unlocks where classroom_id = '${room52}'`)
check('classrooms: room delete removes its unlocks', r.rows[0].n === 0)
// ---------- DB Quest: ครูรีเซ็ตคาบรายคน (migration 016) ----------
r = await as(D5, `select public.dbq_admin_reset_session(public.current_student_id(), 1) as r`).catch(err)
check('dbq016: student cannot reset', r === 'forbidden')
const xpBefore = (await as(D5, `select public.dbq_me() as r`))[0].r.xp
const wsBefore = (await db.query(`select count(*)::int n from public.dbq_submissions where student_id = '${sidD5}'`)).rows[0].n
r = await as(T, `select public.dbq_admin_reset_session('${sidD5}', 1) as r`)
check('dbq016: reset removes steps, attempts, xp', r[0].r.ok && r[0].r.steps === 6 && r[0].r.items >= 5 && r[0].r.xp_events > 0)
r = await as(D5, `select public.dbq_session_state(1) as r`)
check('dbq016: session back to 0%', r[0].r.pct === 0 && r[0].r.solved.length === 0 && Object.keys(r[0].r.done).length === 0)
const xpAfter = (await as(D5, `select public.dbq_me() as r`))[0].r.xp
r = await db.query(`select count(*)::int n from public.dbq_xp_events where student_id = '${sidD5}' and (source like 'step:1:%' or source = 'session:1' or source like 'item:s01-%')`)
check('dbq016: only session-1 xp removed', r.rows[0].n === 0 && xpAfter < xpBefore && xpAfter > 0)
r = await db.query(`select count(*)::int n from public.dbq_submissions where student_id = '${sidD5}'`)
check('dbq016: worksheet submissions kept', r.rows[0].n === wsBefore)
r = await as(D5, `select public.dbq_complete_step(1, 'warmup', '{"answers":["ใหม่"]}') as r`)
check('dbq016: redo earns xp again', r[0].r.xp === 5)
r = await as(T, `select public.dbq_admin_reset_session('${sidD3}', 1) as r`).catch(err)
check('dbq016: non DB Quest student not found', r === 'not_found')
console.log(failed ? `${failed} FAILED` : 'ALL PASSED')
process.exit(failed ? 1 : 0)
