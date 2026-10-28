-- =============================================================
-- อัปเดต DB Quest เฟส 2 สำหรับฐานข้อมูลที่ติดตั้งแล้ว (รันครั้งเดียวใน SQL Editor)
-- = migrations/20261028000009_dbquest_schema.sql + seed_dbquest.sql
-- =============================================================

-- =============================================================
-- 009 DB Quest (ม.5): แยกวิชาตามห้องเรียน + ตารางของ DB Quest
--   * ใช้ระบบล็อกอินเดิม (login_with_code / sessions / students) ร่วมกับเว็บ ม.3
--   * ห้องเรียนบอกว่านักเรียนเรียนวิชาไหน: classrooms.course
--   * ตาราง DB Quest ทุกตารางขึ้นต้น dbq_ เปิด RLS และ "ไม่มี policy"
--     => anon/authenticated อ่าน-เขียนตรงไม่ได้เลย ต้องผ่าน RPC (SECURITY DEFINER) เท่านั้น
-- =============================================================

-- ---------- วิชาของห้องเรียน ----------
alter table public.classrooms
  add column course text not null default 'design_m3'
  check (course in ('design_m3', 'dbquest_m5'));

-- ห้องที่ถูกสร้างอัตโนมัติตอนนำเข้ารายชื่อ (ไม่ได้ระบุวิชา): ชื่อขึ้นต้น "ม.5" => DB Quest
create or replace function public.classrooms_guess_course()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.course = 'design_m3' and new.name like 'ม.5%' then
    new.course := 'dbquest_m5';
  end if;
  return new;
end;
$$;

create trigger classrooms_guess_course
  before insert on public.classrooms
  for each row execute function public.classrooms_guess_course();

-- เผื่อฟีเจอร์ PIN 4 หลักของนักเรียน (ปิดไว้เป็นค่าเริ่มต้นใน dbq_settings.pin_enabled)
alter table public.students add column pin_hash text;

-- ข้อมูลนักเรียนที่ส่งให้ client: เพิ่ม course (หน้าเว็บใช้เลือกว่าจะพาไปเว็บไหน)
create or replace function public.student_profile_json(p_student_id uuid)
returns jsonb
language sql stable security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', st.id,
    'student_code', st.student_code,
    'prefix', st.prefix,
    'first_name', st.first_name,
    'last_name', st.last_name,
    'nickname', st.nickname,
    'number', st.number,
    'avatar', st.avatar,
    'classroom_id', st.classroom_id,
    'classroom_name', c.name,
    'course', coalesce(c.course, 'design_m3')
  )
  from public.students st
  left join public.classrooms c on c.id = st.classroom_id
  where st.id = p_student_id
$$;

-- เปิดคาบของเว็บ ม.3 "ทุกห้อง" = เฉพาะห้อง ม.3 (ไม่ไปเปิดให้ห้อง DB Quest)
create or replace function public.admin_set_session_unlock(p_session_no int, p_unlocked boolean, p_classroom_id uuid default null)
returns void
language plpgsql volatile security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  insert into public.classroom_session_unlocks (classroom_id, session_no, is_unlocked, unlocked_at)
  select c.id, p_session_no, p_unlocked, case when p_unlocked then now() end
  from public.classrooms c
  where (p_classroom_id is null and c.course = 'design_m3') or c.id = p_classroom_id
  on conflict (classroom_id, session_no) do update
    set is_unlocked = excluded.is_unlocked,
        unlocked_at = case
          when excluded.is_unlocked and public.classroom_session_unlocks.is_unlocked
            then public.classroom_session_unlocks.unlocked_at
          when excluded.is_unlocked then now()
          else public.classroom_session_unlocks.unlocked_at
        end;
end;
$$;

-- ---------- ตั้งค่า DB Quest (key/value) ----------
create table public.dbq_settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

insert into public.dbq_settings (key, value) values
  -- คะแนนรายวิชา 100 (เก็บ 70 : สอบ 30)
  ('score_weights', '{"worksheet":25,"unit_quiz":15,"game":10,"project":15,"attendance":5,"midterm":10,"final":20}'),
  ('leaderboard_enabled', 'true'),
  ('pin_enabled', 'false'),
  -- คาบถัดไปเปิดเมื่อทำคาบก่อนหน้าครบกี่ %
  ('unlock_threshold_pct', '80')
on conflict (key) do nothing;

-- ---------- คาบเรียน (metadata อ้างอิงไฟล์เนื้อหาใน src/content/units) ----------
create table public.dbq_lessons (
  session_no          int primary key check (session_no between 1 and 20),
  unit_no             int check (unit_no between 1 and 7),
  kind                text not null default 'lesson' check (kind in ('lesson', 'midterm', 'project', 'final')),
  title               text not null,
  is_unlocked_default boolean not null default false
);

create table public.dbq_classroom_unlocks (
  classroom_id uuid not null references public.classrooms(id) on delete cascade,
  session_no   int  not null references public.dbq_lessons(session_no) on delete cascade,
  unlocked_at  timestamptz not null default now(),
  primary key (classroom_id, session_no)
);

-- step: warmup | lesson | practice | game | worksheet | wrapup (หรือ "lesson:card-3" สำหรับขั้นย่อย)
create table public.dbq_progress (
  student_id   uuid not null references public.students(id) on delete cascade,
  session_no   int  not null references public.dbq_lessons(session_no) on delete cascade,
  step         text not null check (length(step) between 1 and 64),
  data         jsonb not null default '{}'::jsonb,
  completed_at timestamptz not null default now(),
  primary key (student_id, session_no, step)
);

-- ---------- งาน / ใบงาน ----------
create table public.dbq_assignments (
  id         uuid primary key default gen_random_uuid(),
  item_id    text not null unique,                 -- รหัสอ้างอิงใน src/content และ answer_keys เช่น "ws-u1"
  session_no int references public.dbq_lessons(session_no) on delete set null,
  title      text not null,
  max_score  numeric(6,2) not null default 10 check (max_score > 0),
  due_at     timestamptz,
  type       text not null check (type in ('text', 'file', 'er', 'sql')),
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table public.dbq_submissions (
  id            uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.dbq_assignments(id) on delete cascade,
  student_id    uuid not null references public.students(id) on delete cascade,
  content       jsonb not null default '{}'::jsonb,
  file_url      text,
  score         numeric(6,2),
  feedback      text,
  submitted_at  timestamptz not null default now(),
  graded_at     timestamptz,
  unique (assignment_id, student_id)
);
create index dbq_submissions_student_idx on public.dbq_submissions(student_id);

-- ---------- ข้อสอบ ----------
create table public.dbq_quizzes (
  id               uuid primary key default gen_random_uuid(),
  unit_no          int check (unit_no between 1 and 7),
  kind             text not null check (kind in ('unit', 'midterm', 'final')),
  title            text not null,
  max_score        numeric(6,2) not null default 10 check (max_score > 0),
  question_count   int not null default 10 check (question_count > 0),
  time_limit_min   int check (time_limit_min > 0),
  opens_at         timestamptz,
  closes_at        timestamptz,
  attempts_allowed int not null default 1 check (attempts_allowed between 1 and 10),
  created_at       timestamptz not null default now(),
  check ((kind = 'unit') = (unit_no is not null))
);

-- โจทย์ข้อสอบ (ไม่มีเฉลย — เฉลยอยู่ใน dbq_answer_keys) ส่งให้นักเรียนผ่าน RPC ตอนเริ่มสอบเท่านั้น
create table public.dbq_quiz_questions (
  id           text primary key,                   -- เช่น "q-u1-01"
  unit_no      int not null check (unit_no between 1 and 7),
  objective_no int not null check (objective_no between 1 and 8),
  type         text not null check (type in ('mcq', 'match', 'order', 'sql')),
  prompt       jsonb not null,                     -- { text, choices?, pairs?, items?, schema? }
  points       numeric(5,2) not null default 1 check (points > 0),
  is_active    boolean not null default true
);
create index dbq_quiz_questions_unit_idx on public.dbq_quiz_questions(unit_no);

create table public.dbq_quiz_attempts (
  id               uuid primary key default gen_random_uuid(),
  quiz_id          uuid not null references public.dbq_quizzes(id) on delete cascade,
  student_id       uuid not null references public.students(id) on delete cascade,
  attempt_no       int not null default 1,
  question_ids     text[] not null default '{}',   -- ลำดับข้อที่สุ่มให้คนนี้
  answers          jsonb not null default '{}'::jsonb,
  score            numeric(6,2),
  objective_scores jsonb,
  started_at       timestamptz not null default now(),
  finished_at      timestamptz,
  unique (quiz_id, student_id, attempt_no)
);

-- ---------- เกม / XP / เหรียญ ----------
create table public.dbq_game_scores (
  id         uuid primary key default gen_random_uuid(),
  game_key   text not null,
  unit_no    int check (unit_no between 1 and 7),
  student_id uuid not null references public.students(id) on delete cascade,
  score      int not null check (score between 0 and 100),
  stars      int not null default 0 check (stars between 0 and 3),
  xp         int not null default 0 check (xp >= 0),
  played_at  timestamptz not null default now()
);
create index dbq_game_scores_student_idx on public.dbq_game_scores(student_id, game_key);

create table public.dbq_xp_events (
  id         bigint generated always as identity primary key,
  student_id uuid not null references public.students(id) on delete cascade,
  source     text not null,                        -- เช่น "step:3:lesson", "game:memory-match", "badge:..."
  amount     int not null,
  created_at timestamptz not null default now()
);
create index dbq_xp_events_student_idx on public.dbq_xp_events(student_id);

create table public.dbq_badges (
  key         text primary key,
  name        text not null,
  description text not null,
  icon        text not null default '🏅',
  sort_order  int not null default 0
);

create table public.dbq_student_badges (
  student_id uuid not null references public.students(id) on delete cascade,
  badge_key  text not null references public.dbq_badges(key) on delete cascade,
  earned_at  timestamptz not null default now(),
  primary key (student_id, badge_key)
);

-- ---------- RLS: เปิดทุกตาราง ไม่มี policy + ถอนสิทธิ์ตรง ----------
do $$
declare t text;
begin
  foreach t in array array[
    'dbq_settings', 'dbq_lessons', 'dbq_classroom_unlocks', 'dbq_progress',
    'dbq_assignments', 'dbq_submissions', 'dbq_quizzes', 'dbq_quiz_questions', 'dbq_quiz_attempts',
    'dbq_game_scores', 'dbq_xp_events', 'dbq_badges', 'dbq_student_badges'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;

-- ---------- ฟังก์ชันช่วย ----------
-- นักเรียน DB Quest ที่ล็อกอินอยู่ (null ถ้าไม่ใช่นักเรียนห้อง dbquest_m5)
create or replace function public.dbq_student_id()
returns uuid
language sql stable security definer
set search_path = ''
as $$
  select st.id
  from public.students st
  join public.classrooms c on c.id = st.classroom_id
  where st.id = public.current_student_id() and c.course = 'dbquest_m5'
$$;

-- ใช้ต้น RPC: ต้องเป็นนักเรียน DB Quest หรือครู
create or replace function public.dbq_require_member()
returns void
language plpgsql stable security definer
set search_path = ''
as $$
begin
  if not public.is_admin() and public.dbq_student_id() is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.dbq_require_admin()
returns void
language plpgsql stable security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
end;
$$;

-- ---------- RPC ----------
-- ข้อมูลตัวเองใน DB Quest: โปรไฟล์ + XP รวม + เหรียญ + ตั้งค่าที่นักเรียนเห็นได้
create or replace function public.dbq_me()
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_sid uuid := public.dbq_student_id();
begin
  perform public.dbq_require_member();
  return jsonb_build_object(
    'role', public.current_app_role(),
    'student', case when v_sid is null then null else public.student_profile_json(v_sid) end,
    'xp', coalesce((select sum(amount) from public.dbq_xp_events where student_id = v_sid), 0),
    'badges', coalesce((
      select jsonb_agg(jsonb_build_object('key', b.key, 'name', b.name, 'icon', b.icon, 'earned_at', sb.earned_at) order by sb.earned_at)
      from public.dbq_student_badges sb join public.dbq_badges b on b.key = sb.badge_key
      where sb.student_id = v_sid
    ), '[]'::jsonb),
    'settings', jsonb_build_object(
      'leaderboard_enabled', coalesce((select value from public.dbq_settings where key = 'leaderboard_enabled'), 'true'::jsonb),
      'unlock_threshold_pct', coalesce((select value from public.dbq_settings where key = 'unlock_threshold_pct'), '80'::jsonb)
    )
  );
end;
$$;

-- ครู: อ่าน/แก้ตั้งค่า DB Quest ทั้งหมด
create or replace function public.dbq_admin_get_settings()
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
begin
  perform public.dbq_require_admin();
  return coalesce((select jsonb_object_agg(key, value) from public.dbq_settings), '{}'::jsonb);
end;
$$;

create or replace function public.dbq_admin_set_setting(p_key text, p_value jsonb)
returns void
language plpgsql volatile security definer
set search_path = ''
as $$
begin
  perform public.dbq_require_admin();
  if p_key not in ('score_weights', 'leaderboard_enabled', 'pin_enabled', 'unlock_threshold_pct') then
    raise exception 'unknown setting %', p_key using errcode = '22023';
  end if;
  insert into public.dbq_settings (key, value, updated_at) values (p_key, p_value, now())
  on conflict (key) do update set value = excluded.value, updated_at = now();
end;
$$;

-- ฟังก์ชันช่วย (dbq_student_id, dbq_require_*) ใช้ภายใน RPC เท่านั้น ไม่ grant ให้ client
revoke execute on function
  public.dbq_student_id(),
  public.dbq_require_member(),
  public.dbq_require_admin(),
  public.dbq_me(),
  public.dbq_admin_get_settings(),
  public.dbq_admin_set_setting(text, jsonb)
from public, anon;

revoke execute on function
  public.dbq_student_id(),
  public.dbq_require_member(),
  public.dbq_require_admin()
from authenticated;

grant execute on function
  public.dbq_me(),
  public.dbq_admin_get_settings(),
  public.dbq_admin_set_setting(text, jsonb)
to authenticated;

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
