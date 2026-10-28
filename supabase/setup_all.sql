-- =============================================================
-- ติดตั้งฐานข้อมูลทั้งหมดในครั้งเดียว (สร้างอัตโนมัติ — ห้ามแก้ตรง)
-- ใช้กับโปรเจกต์ Supabase ที่ยังว่างเท่านั้น
-- ถ้าเคยติดตั้งแล้วและมี migration ใหม่ ให้รันเฉพาะไฟล์ใหม่ใน supabase/migrations/
-- =============================================================

-- >>>>>>>>>> migrations/20261028000001_schema.sql
-- =============================================================
-- 001 Schema: ตารางทั้งหมดของห้องเรียนเทคโนโลยี ม.3
-- =============================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------- ตั้งค่า / ความลับ ----------
create table public.app_settings (
  id                   int primary key default 1 check (id = 1),
  school_name          text not null default 'โรงเรียนของเรา',
  term                 int  not null default 1 check (term in (1, 2)),
  year                 int  not null default 2569,
  student_code_length  int  not null default 5 check (student_code_length between 3 and 12),
  score_weights        jsonb not null default
    '{"work":30,"project":15,"unit_test":15,"midterm":20,"final":20,"affective":0}'::jsonb,
  grade_scale          jsonb not null default
    '[{"min":80,"grade":4},{"min":75,"grade":3.5},{"min":70,"grade":3},{"min":65,"grade":2.5},{"min":60,"grade":2},{"min":55,"grade":1.5},{"min":50,"grade":1},{"min":0,"grade":0}]'::jsonb,
  late_penalty_enabled boolean not null default true,
  late_penalty_pct     numeric(5,2) not null default 20 check (late_penalty_pct between 0 and 100),
  device_lock          boolean not null default false,
  leaderboard_mode     text not null default 'top10' check (leaderboard_mode in ('all', 'top10', 'hidden')),
  updated_at           timestamptz not null default now()
);

-- เก็บค่าลับ (admin_code เก็บเป็น bcrypt hash) — ไม่มี policy ใด ๆ ให้ API อ่าน
create table public.app_secrets (
  key   text primary key,
  value text not null
);

-- ---------- ห้องเรียน / นักเรียน ----------
create table public.classrooms (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,             -- ม.3/1
  sort_order int  not null default 0,
  created_at timestamptz not null default now()
);

create table public.students (
  id               uuid primary key default gen_random_uuid(),
  student_code     text not null unique check (student_code ~ '^[0-9]+$'),
  prefix           text not null default '',
  first_name       text not null,
  last_name        text not null default '',
  nickname         text not null default '',
  classroom_id     uuid references public.classrooms(id) on delete set null,
  number           int,
  avatar           text not null default 'non',
  is_active        boolean not null default true,
  bound_auth_uid   uuid,                       -- auth.uid() ล่าสุดที่เข้าด้วยรหัสนี้
  bound_device_key text,                       -- ใช้กับ "ล็อกอุปกรณ์" (คงอยู่แม้ออกจากระบบ)
  created_at       timestamptz not null default now()
);
create index students_classroom_idx on public.students(classroom_id);

-- ---------- การเข้าสู่ระบบ ----------
create table public.sessions (
  auth_uid    uuid primary key references auth.users(id) on delete cascade,
  role        text not null check (role in ('admin', 'student')),
  student_id  uuid references public.students(id) on delete cascade,
  device_info jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  check ((role = 'student') = (student_id is not null))
);
create index sessions_student_idx on public.sessions(student_id);

create table public.login_attempts (
  id           bigint generated always as identity primary key,
  auth_uid     uuid not null,
  attempted_at timestamptz not null default now(),
  success      boolean not null
);
create index login_attempts_uid_time_idx on public.login_attempts(auth_uid, attempted_at desc);

-- ---------- เนื้อหารายวิชา ----------
create table public.units (
  id          uuid primary key default gen_random_uuid(),
  no          int  not null unique,
  title       text not null,
  description text not null default '',
  indicators  int[] not null default '{}',
  cover       text
);

create table public.class_sessions (
  id         uuid primary key default gen_random_uuid(),
  session_no int  not null unique,
  unit_id    uuid references public.units(id) on delete set null,
  title      text not null,
  summary    text not null default '',
  work_label text not null default '',
  game_slug  text,
  steps      jsonb not null default '[]'::jsonb
);

create table public.lessons (
  id          uuid primary key default gen_random_uuid(),
  unit_id     uuid references public.units(id) on delete set null,
  session_no  int references public.class_sessions(session_no) on update cascade on delete set null,
  title       text not null,
  content_md  text not null default '',
  sort_order  int  not null default 0,
  est_minutes int  not null default 30
);
create index lessons_session_idx on public.lessons(session_no);

create table public.classroom_session_unlocks (
  classroom_id uuid not null references public.classrooms(id) on delete cascade,
  session_no   int  not null references public.class_sessions(session_no) on update cascade on delete cascade,
  is_unlocked  boolean not null default false,
  unlocked_at  timestamptz,
  primary key (classroom_id, session_no)
);

-- ---------- งาน / การส่งงาน ----------
create table public.assignments (
  id              uuid primary key default gen_random_uuid(),
  session_no      int references public.class_sessions(session_no) on update cascade on delete set null,
  unit_id         uuid references public.units(id) on delete set null,
  title           text not null,
  instructions_md text not null default '',
  type            text not null default 'text' check (type in ('text', 'table', 'file', 'link')),
  max_score       numeric(6,2) not null default 0 check (max_score >= 0),
  rubric          jsonb not null default '[]'::jsonb,
  due_at          timestamptz,
  category        text not null default 'work'
                  check (category in ('work', 'project', 'unit_test', 'midterm', 'final')),
  sort_order      int not null default 0,
  created_at      timestamptz not null default now()
);

create table public.submissions (
  id            uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  student_id    uuid not null references public.students(id) on delete cascade,
  content       jsonb not null default '{}'::jsonb,
  file_paths    text[] not null default '{}',
  submitted_at  timestamptz,
  score         numeric(6,2),
  feedback      text,
  status        text not null default 'draft' check (status in ('draft', 'submitted', 'returned', 'graded')),
  updated_at    timestamptz not null default now(),
  unique (assignment_id, student_id)
);
create index submissions_student_idx on public.submissions(student_id);

-- ---------- คลังข้อสอบ / การสอบ ----------
create table public.questions (
  id             uuid primary key default gen_random_uuid(),
  unit_id        uuid references public.units(id) on delete set null,
  topic          text not null default '',
  indicator      int check (indicator between 1 and 4),
  type           text not null check (type in ('mcq', 'true_false', 'matching', 'ordering', 'fill', 'short')),
  prompt         text not null,
  choices        jsonb not null default '[]'::jsonb,
  correct_answer jsonb,
  explanation    text not null default '',
  difficulty     text not null default 'medium' check (difficulty in ('easy', 'medium', 'hard')),
  reviewed       boolean not null default false,
  created_at     timestamptz not null default now()
);
create index questions_unit_idx on public.questions(unit_id);

create table public.exams (
  id                uuid primary key default gen_random_uuid(),
  title             text not null,
  kind              text not null
                    check (kind in ('exit_ticket', 'unit_test', 'midterm', 'final', 'pretest', 'posttest', 'practice')),
  unit_id           uuid references public.units(id) on delete set null,
  session_no        int references public.class_sessions(session_no) on update cascade on delete set null,
  assignment_id     uuid references public.assignments(id) on delete set null, -- ผูกกับสมุดคะแนน (ถ้ามี)
  question_ids      uuid[] not null default '{}',
  duration_min      int check (duration_min > 0),
  opens_at          timestamptz,
  closes_at         timestamptz,
  shuffle           boolean not null default false,
  shuffle_choices   boolean not null default false,
  max_attempts      int not null default 1 check (max_attempts > 0),
  show_answers      boolean not null default false,
  require_fullscreen boolean not null default false,
  created_at        timestamptz not null default now()
);

create table public.exam_attempts (
  id           uuid primary key default gen_random_uuid(),
  exam_id      uuid not null references public.exams(id) on delete cascade,
  student_id   uuid not null references public.students(id) on delete cascade,
  attempt_no   int not null default 1,
  started_at   timestamptz not null default now(),
  submitted_at timestamptz,
  answers      jsonb not null default '{}'::jsonb,
  score        numeric(6,2),
  tab_switches int not null default 0,
  unique (exam_id, student_id, attempt_no)
);
create index exam_attempts_student_idx on public.exam_attempts(student_id);

-- ---------- เกม / Gamification ----------
create table public.games (
  id               uuid primary key default gen_random_uuid(),
  slug             text not null unique,
  unit_id          uuid references public.units(id) on delete set null,
  title            text not null,
  description      text not null default '',
  config           jsonb not null default '{}'::jsonb,
  max_score        int not null default 100 check (max_score > 0),
  max_xp           int not null default 50 check (max_xp between 0 and 500),
  min_duration_sec int not null default 20 check (min_duration_sec >= 0),
  is_active        boolean not null default true
);

create table public.game_plays (
  id           uuid primary key default gen_random_uuid(),
  game_id      uuid not null references public.games(id) on delete cascade,
  student_id   uuid not null references public.students(id) on delete cascade,
  score        int not null,
  duration_sec int not null,
  xp_earned    int not null default 0,
  played_at    timestamptz not null default now()
);
create index game_plays_student_game_idx on public.game_plays(student_id, game_id, played_at desc);

create table public.xp_events (
  id         uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  source     text not null check (source in ('game', 'assignment', 'exit_ticket', 'attendance', 'badge', 'manual')),
  ref_id     uuid,
  xp         int not null,
  created_at timestamptz not null default now()
);
create index xp_events_student_idx on public.xp_events(student_id);

create table public.badges (
  id   uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  icon text not null default '🏅',
  rule jsonb not null default '{}'::jsonb
);

create table public.student_badges (
  student_id uuid not null references public.students(id) on delete cascade,
  badge_id   uuid not null references public.badges(id) on delete cascade,
  earned_at  timestamptz not null default now(),
  primary key (student_id, badge_id)
);

create table public.attendance (
  student_id   uuid not null references public.students(id) on delete cascade,
  session_no   int  not null references public.class_sessions(session_no) on update cascade on delete cascade,
  classroom_id uuid references public.classrooms(id) on delete set null,
  status       text not null default 'present' check (status in ('present', 'late', 'absent', 'leave')),
  checked_at   timestamptz not null default now(),
  primary key (student_id, session_no)
);

-- ---------- ค่าเริ่มต้นที่ระบบต้องมี ----------
insert into public.app_settings (id) values (1);

-- รหัสแอดมินเริ่มต้น superurrwnm (เก็บแบบ hash) — เปลี่ยนได้ในหน้าตั้งค่า
insert into public.app_secrets (key, value)
values ('admin_code', extensions.crypt('superurrwnm', extensions.gen_salt('bf')));

-- >>>>>>>>>> migrations/20261028000002_auth_functions.sql
-- =============================================================
-- 002 ฟังก์ชันช่วย + RPC เข้าสู่ระบบด้วยรหัส (ไม่มีรหัสผ่าน)
-- ทุกฟังก์ชันใช้ search_path = '' และอ้างชื่อเต็ม schema
-- =============================================================

-- หมายเหตุ: ชื่อ current_role ชนกับ keyword ของ SQL (CURRENT_ROLE)
-- จึงใช้ชื่อ current_app_role() แทน
create or replace function public.current_app_role()
returns text
language sql stable security definer
set search_path = ''
as $$
  select s.role
  from public.sessions s
  left join public.students st on st.id = s.student_id
  where s.auth_uid = auth.uid()
    and (s.role = 'admin' or st.is_active)
$$;

create or replace function public.current_student_id()
returns uuid
language sql stable security definer
set search_path = ''
as $$
  select s.student_id
  from public.sessions s
  join public.students st on st.id = s.student_id
  where s.auth_uid = auth.uid() and s.role = 'student' and st.is_active
$$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select coalesce(public.current_app_role() = 'admin', false)
$$;

create or replace function public.current_classroom_id()
returns uuid
language sql stable security definer
set search_path = ''
as $$
  select st.classroom_id from public.students st where st.id = public.current_student_id()
$$;

-- คาบนี้ปลดล็อกให้ห้องของนักเรียนที่ล็อกอินอยู่หรือไม่ (แอดมิน = true เสมอ)
create or replace function public.is_session_unlocked(p_session_no int)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select public.is_admin() or exists (
    select 1 from public.classroom_session_unlocks u
    where u.session_no = p_session_no
      and u.classroom_id = public.current_classroom_id()
      and u.is_unlocked
  )
$$;

-- ข้อมูลนักเรียนแบบที่ส่งให้ client ได้ (ไม่มี bound_*)
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
    'classroom_name', c.name
  )
  from public.students st
  left join public.classrooms c on c.id = st.classroom_id
  where st.id = p_student_id
$$;

-- -------------------------------------------------------------
-- login_with_code: ตรวจรหัสฝั่งเซิร์ฟเวอร์เท่านั้น
-- คืน jsonb เสมอ (ไม่ raise) เพื่อให้บันทึก login_attempts ได้
--   { ok: true, role, student }  หรือ  { ok: false, error, retry_after_sec? }
-- error: not_signed_in | rate_limited | not_found | device_locked
-- -------------------------------------------------------------
create or replace function public.login_with_code(p_code text, p_device_key text default null)
returns jsonb
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_uid       uuid := auth.uid();
  v_code      text := btrim(coalesce(p_code, ''));
  v_fail      int;
  v_oldest    timestamptz;
  v_hash      text;
  v_student   public.students%rowtype;
  v_lock      boolean;
  v_device    jsonb;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'not_signed_in');
  end if;

  -- จำกัดการเดา: ผิดเกิน 10 ครั้งใน 5 นาที ต่อ auth_uid => ล็อก 5 นาที
  select count(*), min(attempted_at) into v_fail, v_oldest
  from public.login_attempts
  where auth_uid = v_uid and not success and attempted_at > now() - interval '5 minutes';

  if v_fail >= 10 then
    return jsonb_build_object(
      'ok', false, 'error', 'rate_limited',
      'retry_after_sec', greatest(1, ceil(extract(epoch from (v_oldest + interval '5 minutes' - now())))::int)
    );
  end if;

  if length(v_code) = 0 or length(v_code) > 64 then
    insert into public.login_attempts (auth_uid, success) values (v_uid, false);
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  v_device := jsonb_build_object(
    'device_key', left(coalesce(p_device_key, ''), 64),
    'user_agent', left(coalesce(current_setting('request.headers', true)::jsonb ->> 'user-agent', ''), 300)
  );

  -- 1) รหัสแอดมิน
  select value into v_hash from public.app_secrets where key = 'admin_code';
  if v_hash is not null and v_hash = extensions.crypt(v_code, v_hash) then
    insert into public.sessions (auth_uid, role, student_id, device_info)
    values (v_uid, 'admin', null, v_device)
    on conflict (auth_uid) do update
      set role = 'admin', student_id = null, device_info = excluded.device_info,
          created_at = now(), last_seen_at = now();
    insert into public.login_attempts (auth_uid, success) values (v_uid, true);
    return jsonb_build_object('ok', true, 'role', 'admin', 'student', null);
  end if;

  -- 2) รหัสนักเรียน
  select * into v_student
  from public.students
  where student_code = v_code and is_active
  for update;

  if not found then
    insert into public.login_attempts (auth_uid, success) values (v_uid, false);
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  select device_lock into v_lock from public.app_settings where id = 1;

  if coalesce(v_lock, false)
     and v_student.bound_device_key is not null
     and v_student.bound_device_key is distinct from nullif(p_device_key, '') then
    -- ไม่นับเป็นการเดารหัสผิด แต่ไม่ให้เข้า
    return jsonb_build_object('ok', false, 'error', 'device_locked');
  end if;

  update public.students
  set bound_auth_uid = v_uid,
      bound_device_key = case
        when coalesce(v_lock, false) then coalesce(bound_device_key, nullif(p_device_key, ''))
        else nullif(p_device_key, '')
      end
  where id = v_student.id;

  insert into public.sessions (auth_uid, role, student_id, device_info)
  values (v_uid, 'student', v_student.id, v_device)
  on conflict (auth_uid) do update
    set role = 'student', student_id = excluded.student_id, device_info = excluded.device_info,
        created_at = now(), last_seen_at = now();

  insert into public.login_attempts (auth_uid, success) values (v_uid, true);

  return jsonb_build_object('ok', true, 'role', 'student', 'student', public.student_profile_json(v_student.id));
end;
$$;

-- ใครกำลังล็อกอินอยู่ (ใช้ตอนรีเฟรชหน้า)
create or replace function public.whoami()
returns jsonb
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_role text := public.current_app_role();
  v_sid  uuid;
begin
  if v_role is null then
    return jsonb_build_object('role', null, 'student', null);
  end if;
  update public.sessions set last_seen_at = now() where auth_uid = auth.uid();
  v_sid := public.current_student_id();
  return jsonb_build_object(
    'role', v_role,
    'student', case when v_sid is null then null else public.student_profile_json(v_sid) end
  );
end;
$$;

create or replace function public.logout()
returns void
language sql volatile security definer
set search_path = ''
as $$
  delete from public.sessions where auth_uid = auth.uid()
$$;

-- -------------------------------------------------------------
-- RPC ฝั่งแอดมิน
-- -------------------------------------------------------------
create or replace function public.admin_set_admin_code(p_new_code text)
returns void
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_code text := btrim(coalesce(p_new_code, ''));
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if length(v_code) < 6 or v_code ~ '^[0-9]+$' then
    -- ห้ามเป็นตัวเลขล้วน เพื่อไม่ให้ชนกับรหัสนักเรียน
    raise exception 'invalid_admin_code' using errcode = '22023';
  end if;
  update public.app_secrets
  set value = extensions.crypt(v_code, extensions.gen_salt('bf'))
  where key = 'admin_code';
end;
$$;

create or replace function public.admin_reset_device(p_student_id uuid)
returns void
language plpgsql volatile security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.students set bound_device_key = null, bound_auth_uid = null where id = p_student_id;
  delete from public.sessions where student_id = p_student_id;
end;
$$;

-- -------------------------------------------------------------
-- สิทธิ์เรียกใช้ฟังก์ชัน
-- -------------------------------------------------------------
revoke execute on all functions in schema public from public, anon;

grant execute on function
  public.current_app_role(),
  public.current_student_id(),
  public.is_admin(),
  public.current_classroom_id(),
  public.is_session_unlocked(int),
  public.login_with_code(text, text),
  public.whoami(),
  public.logout(),
  public.admin_set_admin_code(text),
  public.admin_reset_device(uuid)
to authenticated;

-- student_profile_json ใช้ภายในเท่านั้น
revoke execute on function public.student_profile_json(uuid) from authenticated;

-- >>>>>>>>>> migrations/20261028000003_rls.sql
-- =============================================================
-- 003 Row Level Security + Storage
-- ทุกตารางเปิด RLS; ใช้ current_app_role() / current_student_id()
-- รูปแบบ (select fn()) ช่วยให้ Postgres คำนวณครั้งเดียวต่อ query
-- =============================================================

do $$
declare t text;
begin
  foreach t in array array[
    'app_settings','app_secrets','classrooms','students','sessions','login_attempts',
    'units','class_sessions','lessons','classroom_session_unlocks',
    'assignments','submissions','questions','exams','exam_attempts',
    'games','game_plays','xp_events','badges','student_badges','attendance'
  ] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- ความลับ: ปิดทุก role (อ่านได้เฉพาะใน SECURITY DEFINER function)
revoke all on public.app_secrets from anon, authenticated;
revoke all on public.login_attempts from anon, authenticated;
grant select on public.login_attempts to authenticated;

-- anon (ยังไม่ได้ sign in แบบ anonymous) ไม่ต้องเข้าถึงอะไรเลย
revoke all on all tables in schema public from anon;

-- ---------- app_settings ----------
create policy app_settings_read on public.app_settings
  for select to authenticated using (true);
create policy app_settings_admin_write on public.app_settings
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- ---------- sessions / login_attempts ----------
create policy sessions_read on public.sessions
  for select to authenticated
  using (auth_uid = (select auth.uid()) or (select public.is_admin()));
create policy sessions_admin_delete on public.sessions
  for delete to authenticated using ((select public.is_admin()));

create policy login_attempts_admin_read on public.login_attempts
  for select to authenticated using ((select public.is_admin()));

-- ---------- classrooms / students ----------
create policy classrooms_read on public.classrooms
  for select to authenticated
  using ((select public.is_admin()) or id = (select public.current_classroom_id()));
create policy classrooms_admin_all on public.classrooms
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

create policy students_read on public.students
  for select to authenticated
  using ((select public.is_admin()) or id = (select public.current_student_id()));
create policy students_admin_all on public.students
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- ---------- เนื้อหา ----------
create policy units_read on public.units
  for select to authenticated using ((select public.current_app_role()) is not null);
create policy units_admin_all on public.units
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

create policy class_sessions_read on public.class_sessions
  for select to authenticated using (public.is_session_unlocked(session_no));
create policy class_sessions_admin_all on public.class_sessions
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

create policy lessons_read on public.lessons
  for select to authenticated
  using ((select public.is_admin()) or (session_no is not null and public.is_session_unlocked(session_no)));
create policy lessons_admin_all on public.lessons
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

create policy unlocks_read on public.classroom_session_unlocks
  for select to authenticated
  using ((select public.is_admin()) or classroom_id = (select public.current_classroom_id()));
create policy unlocks_admin_all on public.classroom_session_unlocks
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- ---------- งาน ----------
create policy assignments_read on public.assignments
  for select to authenticated
  using (
    (select public.is_admin())
    or ((select public.current_student_id()) is not null
        and (session_no is null or public.is_session_unlocked(session_no)))
  );
create policy assignments_admin_all on public.assignments
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

create policy submissions_read on public.submissions
  for select to authenticated
  using ((select public.is_admin()) or student_id = (select public.current_student_id()));
create policy submissions_student_insert on public.submissions
  for insert to authenticated
  with check (student_id = (select public.current_student_id()) and status in ('draft', 'submitted'));
create policy submissions_student_update on public.submissions
  for update to authenticated
  using (student_id = (select public.current_student_id()) and status in ('draft', 'submitted', 'returned'))
  with check (student_id = (select public.current_student_id()) and status in ('draft', 'submitted'));
create policy submissions_admin_all on public.submissions
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- กันนักเรียนแก้คะแนน/คอมเมนต์เอง
create or replace function public.submissions_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  if not public.is_admin() then
    if tg_op = 'INSERT' then
      new.score := null;
      new.feedback := null;
    else
      new.score := old.score;
      new.feedback := old.feedback;
      new.assignment_id := old.assignment_id;
      new.student_id := old.student_id;
    end if;
    if new.status = 'submitted' and (tg_op = 'INSERT' or old.status <> 'submitted') then
      new.submitted_at := now();
    elsif tg_op = 'UPDATE' then
      new.submitted_at := old.submitted_at;
    else
      new.submitted_at := null;
    end if;
  end if;
  return new;
end;
$$;
create trigger submissions_guard
  before insert or update on public.submissions
  for each row execute function public.submissions_guard();

-- ---------- ข้อสอบ ----------
-- questions มีเฉลย => แอดมินเท่านั้น (นักเรียนจะอ่านผ่าน view questions_public ใน Phase 4)
create policy questions_admin_all on public.questions
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

create policy exams_read on public.exams
  for select to authenticated using ((select public.current_app_role()) is not null);
create policy exams_admin_all on public.exams
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- เขียน exam_attempts ได้ผ่าน RPC (start_exam/save_exam_answer/submit_exam) เท่านั้น
create policy exam_attempts_read on public.exam_attempts
  for select to authenticated
  using ((select public.is_admin()) or student_id = (select public.current_student_id()));
create policy exam_attempts_admin_all on public.exam_attempts
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- ---------- เกม / Gamification ----------
create policy games_read on public.games
  for select to authenticated using ((select public.current_app_role()) is not null);
create policy games_admin_all on public.games
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- game_plays / xp_events เขียนผ่าน RPC submit_game_result เท่านั้น
create policy game_plays_read on public.game_plays
  for select to authenticated
  using ((select public.is_admin()) or student_id = (select public.current_student_id()));
create policy game_plays_admin_all on public.game_plays
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

create policy xp_events_read on public.xp_events
  for select to authenticated
  using ((select public.is_admin()) or student_id = (select public.current_student_id()));
create policy xp_events_admin_all on public.xp_events
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

create policy badges_read on public.badges
  for select to authenticated using ((select public.current_app_role()) is not null);
create policy badges_admin_all on public.badges
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

create policy student_badges_read on public.student_badges
  for select to authenticated
  using ((select public.is_admin()) or student_id = (select public.current_student_id()));
create policy student_badges_admin_all on public.student_badges
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

create policy attendance_read on public.attendance
  for select to authenticated
  using ((select public.is_admin()) or student_id = (select public.current_student_id()));
create policy attendance_admin_all on public.attendance
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- =============================================================
-- Storage: bucket submissions (private) ไฟล์ <= 10 MB รูป/PDF เท่านั้น
-- path: {student_id}/{assignment_id}/<ชื่อไฟล์>
-- =============================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'submissions', 'submissions', false, 10485760,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'application/pdf']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy submissions_files_student_read on storage.objects
  for select to authenticated
  using (bucket_id = 'submissions'
         and (storage.foldername(name))[1] = (select public.current_student_id())::text);

create policy submissions_files_student_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'submissions'
              and (storage.foldername(name))[1] = (select public.current_student_id())::text);

create policy submissions_files_student_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'submissions'
         and (storage.foldername(name))[1] = (select public.current_student_id())::text);

create policy submissions_files_admin_all on storage.objects
  for all to authenticated
  using (bucket_id = 'submissions' and (select public.is_admin()))
  with check (bucket_id = 'submissions' and (select public.is_admin()));

-- >>>>>>>>>> migrations/20261028000004_lessons_progress.sql
-- =============================================================
-- 004 Phase 2: เนื้อหาหน่วย, ความคืบหน้าคาบ, เช็คชื่ออัตโนมัติ, จัดลำดับคาบ
-- =============================================================

alter table public.units
  add column if not exists objectives text[] not null default '{}',
  add column if not exists mindmap jsonb not null default '[]'::jsonb;  -- [{ "title": "...", "children": ["..."] }]

-- ขั้นตอนในคาบที่นักเรียนทำเสร็จแล้ว (warmup | content | game | work | exit | summary)
create table public.session_progress (
  student_id      uuid not null references public.students(id) on delete cascade,
  session_no      int  not null references public.class_sessions(session_no) on update cascade on delete cascade,
  completed_steps text[] not null default '{}',
  updated_at      timestamptz not null default now(),
  primary key (student_id, session_no)
);

alter table public.session_progress enable row level security;
revoke all on public.session_progress from anon;

create policy session_progress_read on public.session_progress
  for select to authenticated
  using ((select public.is_admin()) or student_id = (select public.current_student_id()));
create policy session_progress_admin_all on public.session_progress
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- -------------------------------------------------------------
-- รายการคาบทั้งหมดของห้องตัวเอง (เห็นชื่อคาบที่ยังล็อกได้ แต่ไม่เห็นเนื้อหา)
-- -------------------------------------------------------------
create or replace function public.my_session_list()
returns table (
  session_no  int,
  unit_id     uuid,
  title       text,
  is_unlocked boolean,
  unlocked_at timestamptz,
  completed_steps text[],
  total_steps int
)
language sql stable security definer
set search_path = ''
as $$
  select
    cs.session_no,
    cs.unit_id,
    cs.title,
    coalesce(u.is_unlocked, false) or public.is_admin(),
    u.unlocked_at,
    coalesce(p.completed_steps, '{}'),
    greatest(jsonb_array_length(cs.steps), 1)
  from public.class_sessions cs
  left join public.classroom_session_unlocks u
    on u.session_no = cs.session_no and u.classroom_id = public.current_classroom_id()
  left join public.session_progress p
    on p.session_no = cs.session_no and p.student_id = public.current_student_id()
  where public.current_app_role() is not null
  order by cs.session_no
$$;

-- -------------------------------------------------------------
-- เช็คชื่ออัตโนมัติ: เปิดหน้าคาบที่ "ครูเพิ่งปลดล็อก" (คาบล่าสุดของห้อง ภายใน 12 ชม.)
-- ได้ attendance = present และ +10 XP ครั้งเดียวต่อคาบ
-- คืน true ถ้าเพิ่งเช็คชื่อครั้งนี้
-- -------------------------------------------------------------
create or replace function public.checkin_session(p_session_no int)
returns boolean
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_sid  uuid := public.current_student_id();
  v_room uuid := public.current_classroom_id();
  v_latest int;
  v_at   timestamptz;
  v_rows int;
begin
  if v_sid is null or v_room is null then
    return false;
  end if;

  select u.session_no, u.unlocked_at into v_latest, v_at
  from public.classroom_session_unlocks u
  where u.classroom_id = v_room and u.is_unlocked and u.unlocked_at is not null
  order by u.unlocked_at desc
  limit 1;

  if v_latest is distinct from p_session_no or v_at < now() - interval '12 hours' then
    return false;
  end if;

  insert into public.attendance (student_id, session_no, classroom_id, status)
  values (v_sid, p_session_no, v_room, 'present')
  on conflict (student_id, session_no) do nothing;
  get diagnostics v_rows = row_count;

  if v_rows > 0 then
    insert into public.xp_events (student_id, source, xp)
    values (v_sid, 'attendance', 10);
    return true;
  end if;
  return false;
end;
$$;

-- บันทึกว่าทำขั้นตอนในคาบเสร็จ (เฉพาะคาบที่ปลดล็อก)
create or replace function public.mark_step_done(p_session_no int, p_step text)
returns text[]
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_sid   uuid := public.current_student_id();
  v_steps text[];
begin
  if v_sid is null then
    raise exception 'not_student' using errcode = '42501';
  end if;
  if not public.is_session_unlocked(p_session_no) then
    raise exception 'session_locked' using errcode = '42501';
  end if;
  if p_step not in ('warmup', 'content', 'game', 'work', 'exit', 'summary') then
    raise exception 'invalid_step' using errcode = '22023';
  end if;

  insert into public.session_progress (student_id, session_no, completed_steps)
  values (v_sid, p_session_no, array[p_step])
  on conflict (student_id, session_no) do update
    set completed_steps = (
          select array_agg(distinct s order by s)
          from unnest(public.session_progress.completed_steps || array[p_step]) s
        ),
        updated_at = now()
  returning completed_steps into v_steps;
  return v_steps;
end;
$$;

-- -------------------------------------------------------------
-- แอดมิน: สลับลำดับคาบ (ข้อมูลที่ผูกกับคาบย้ายตามผ่าน on update cascade)
-- -------------------------------------------------------------
create or replace function public.admin_swap_sessions(p_a int, p_b int)
returns void
language plpgsql volatile security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_a = p_b then return; end if;
  if (select count(*) from public.class_sessions where session_no in (p_a, p_b)) <> 2 then
    raise exception 'session_not_found' using errcode = '22023';
  end if;
  update public.class_sessions set session_no = -1000000 where session_no = p_a;
  update public.class_sessions set session_no = p_a where session_no = p_b;
  update public.class_sessions set session_no = p_b where session_no = -1000000;
end;
$$;

-- แอดมิน: เปิด/ปิดคาบให้หลายห้องพร้อมกัน (p_classroom_id = null => ทุกห้อง)
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
  where p_classroom_id is null or c.id = p_classroom_id
  on conflict (classroom_id, session_no) do update
    set is_unlocked = excluded.is_unlocked,
        -- คงเวลาเดิมไว้ถ้าเปิดอยู่แล้ว เพื่อไม่ให้เช็คชื่อซ้ำซ้อน
        unlocked_at = case
          when excluded.is_unlocked and public.classroom_session_unlocks.is_unlocked
            then public.classroom_session_unlocks.unlocked_at
          when excluded.is_unlocked then now()
          else public.classroom_session_unlocks.unlocked_at
        end;
end;
$$;

revoke execute on function
  public.my_session_list(),
  public.checkin_session(int),
  public.mark_step_done(int, text),
  public.admin_swap_sessions(int, int),
  public.admin_set_session_unlock(int, boolean, uuid)
from public, anon;

grant execute on function
  public.my_session_list(),
  public.checkin_session(int),
  public.mark_step_done(int, text),
  public.admin_swap_sessions(int, int),
  public.admin_set_session_unlock(int, boolean, uuid)
to authenticated;

-- >>>>>>>>>> migrations/20261028000005_assignments_gradebook.sql
-- =============================================================
-- 005 Phase 3: งาน การส่งงาน การตรวจงาน สมุดคะแนน นำเข้านักเรียน
-- =============================================================

-- score_only = รายการคะแนนที่นักเรียนไม่ต้องส่งงานในเว็บ (สอบ/ครูกรอกคะแนนเอง)
alter table public.assignments drop constraint if exists assignments_type_check;
alter table public.assignments
  add constraint assignments_type_check check (type in ('text', 'table', 'file', 'link', 'score_only'));

-- config ตามประเภทงาน เช่น { "columns": ["ยุค", "ความสามารถ"], "rows": 5 }
alter table public.assignments add column if not exists config jsonb not null default '{}'::jsonb;

-- คะแนนจิตพิสัยจาก XP: ได้เต็มสัดส่วน affective เมื่อมี XP ถึงค่านี้
alter table public.app_settings
  add column if not exists affective_full_xp int not null default 1000 check (affective_full_xp > 0);

create index if not exists submissions_assignment_idx on public.submissions(assignment_id);

-- -------------------------------------------------------------
-- กันนักเรียน (เขียนทับ guard เดิมจาก migration 003)
--   - ห้ามแก้คะแนน/คอมเมนต์
--   - ห้ามส่งงาน score_only หรืองานของคาบที่ยังล็อก
--   - ไฟล์แนบต้องอยู่ในโฟลเดอร์ {student_id}/{assignment_id}/ ของตัวเอง
-- -------------------------------------------------------------
create or replace function public.submissions_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_type    text;
  v_session int;
  v_prefix  text;
  v_path    text;
begin
  new.updated_at := now();
  if public.is_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.score := null;
    new.feedback := null;
  else
    new.score := old.score;
    new.feedback := old.feedback;
    new.assignment_id := old.assignment_id;
    new.student_id := old.student_id;
  end if;

  select a.type, a.session_no into v_type, v_session from public.assignments a where a.id = new.assignment_id;
  if v_type is null or v_type = 'score_only' then
    raise exception 'assignment_not_submittable' using errcode = '42501';
  end if;
  if v_session is not null and not public.is_session_unlocked(v_session) then
    raise exception 'session_locked' using errcode = '42501';
  end if;

  v_prefix := new.student_id::text || '/' || new.assignment_id::text || '/';
  foreach v_path in array coalesce(new.file_paths, '{}') loop
    if left(v_path, length(v_prefix)) <> v_prefix or v_path like '%..%' then
      raise exception 'invalid_file_path' using errcode = '42501';
    end if;
  end loop;
  if cardinality(new.file_paths) > 10 then
    raise exception 'too_many_files' using errcode = '22023';
  end if;

  if new.status = 'submitted' and (tg_op = 'INSERT' or old.status <> 'submitted') then
    new.submitted_at := now();
  elsif tg_op = 'UPDATE' then
    new.submitted_at := old.submitted_at;
  else
    new.submitted_at := null;
  end if;
  return new;
end;
$$;

-- ส่งงานตรงเวลาครั้งแรก +30 XP (ครั้งเดียวต่องาน)
create or replace function public.submissions_award_xp()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_due timestamptz;
begin
  if new.status <> 'submitted' or new.submitted_at is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.status = 'submitted' then
    return new;
  end if;
  select due_at into v_due from public.assignments where id = new.assignment_id;
  if v_due is not null and new.submitted_at > v_due then
    return new;
  end if;
  if not exists (
    select 1 from public.xp_events
    where student_id = new.student_id and source = 'assignment' and ref_id = new.assignment_id
  ) then
    insert into public.xp_events (student_id, source, ref_id, xp) values (new.student_id, 'assignment', new.assignment_id, 30);
  end if;
  return new;
end;
$$;

drop trigger if exists submissions_award_xp on public.submissions;
create trigger submissions_award_xp
  after insert or update of status on public.submissions
  for each row execute function public.submissions_award_xp();

-- -------------------------------------------------------------
-- RPC แอดมิน: ตรวจงาน (ให้คะแนน หรือส่งคืนให้แก้)
-- -------------------------------------------------------------
create or replace function public.grade_submission(
  p_submission_id uuid,
  p_score numeric,
  p_feedback text,
  p_status text default 'graded'
)
returns void
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_max numeric;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_status not in ('graded', 'returned') then
    raise exception 'invalid_status' using errcode = '22023';
  end if;
  select a.max_score into v_max
  from public.submissions s join public.assignments a on a.id = s.assignment_id
  where s.id = p_submission_id;
  if v_max is null then
    raise exception 'submission_not_found' using errcode = '22023';
  end if;
  if p_score is not null and (p_score < 0 or p_score > v_max) then
    raise exception 'score_out_of_range' using errcode = '22023';
  end if;
  if p_status = 'graded' and p_score is null then
    raise exception 'score_required' using errcode = '22023';
  end if;
  update public.submissions
  set score = p_score, feedback = nullif(btrim(coalesce(p_feedback, '')), ''), status = p_status
  where id = p_submission_id;
end;
$$;

-- RPC แอดมิน: กรอกคะแนนตรงในสมุดคะแนน (p_score = null คือล้างคะแนน)
create or replace function public.admin_set_score(p_assignment_id uuid, p_student_id uuid, p_score numeric)
returns void
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_max numeric;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select max_score into v_max from public.assignments where id = p_assignment_id;
  if v_max is null then
    raise exception 'assignment_not_found' using errcode = '22023';
  end if;
  if p_score is not null and (p_score < 0 or p_score > v_max) then
    raise exception 'score_out_of_range' using errcode = '22023';
  end if;

  if p_score is null then
    update public.submissions
    set score = null,
        status = case when submitted_at is not null then 'submitted' else 'draft' end
    where assignment_id = p_assignment_id and student_id = p_student_id;
    return;
  end if;

  insert into public.submissions (assignment_id, student_id, score, status)
  values (p_assignment_id, p_student_id, p_score, 'graded')
  on conflict (assignment_id, student_id) do update
    set score = excluded.score, status = 'graded';
end;
$$;

-- -------------------------------------------------------------
-- RPC แอดมิน: นำเข้านักเรียน (สร้างห้องอัตโนมัติ, อัปเดตถ้ารหัสซ้ำ)
-- p_rows: [{ student_code, prefix, first_name, last_name, nickname, classroom, number }]
-- -------------------------------------------------------------
create or replace function public.admin_import_students(p_rows jsonb)
returns jsonb
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_row      jsonb;
  v_room     uuid;
  v_code     text;
  v_inserted int := 0;
  v_updated  int := 0;
  v_was_new  boolean;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 2000 then
    raise exception 'invalid_rows' using errcode = '22023';
  end if;

  for v_row in select * from jsonb_array_elements(p_rows) loop
    v_code := btrim(v_row ->> 'student_code');
    if v_code !~ '^[0-9]{3,12}$' or coalesce(btrim(v_row ->> 'first_name'), '') = '' then
      raise exception 'invalid_row: %', v_code using errcode = '22023';
    end if;

    v_room := null;
    if coalesce(btrim(v_row ->> 'classroom'), '') <> '' then
      insert into public.classrooms (name) values (btrim(v_row ->> 'classroom'))
      on conflict (name) do update set name = excluded.name
      returning id into v_room;
    end if;

    insert into public.students (student_code, prefix, first_name, last_name, nickname, classroom_id, number)
    values (
      v_code,
      coalesce(btrim(v_row ->> 'prefix'), ''),
      btrim(v_row ->> 'first_name'),
      coalesce(btrim(v_row ->> 'last_name'), ''),
      coalesce(btrim(v_row ->> 'nickname'), ''),
      v_room,
      nullif(v_row ->> 'number', '')::int
    )
    on conflict (student_code) do update
      set prefix = excluded.prefix,
          first_name = excluded.first_name,
          last_name = excluded.last_name,
          nickname = excluded.nickname,
          classroom_id = coalesce(excluded.classroom_id, public.students.classroom_id),
          number = coalesce(excluded.number, public.students.number),
          is_active = true
    returning (xmax = 0) into v_was_new;

    if v_was_new then v_inserted := v_inserted + 1; else v_updated := v_updated + 1; end if;
  end loop;

  return jsonb_build_object('inserted', v_inserted, 'updated', v_updated);
end;
$$;

-- รายการคะแนนทั้งเทอม (นักเรียนเห็นชื่อ/คะแนนเต็มของทุกรายการ แม้คาบยังล็อก เพื่อคำนวณคะแนนรวมได้ถูกต้อง)
create or replace function public.my_gradebook_items()
returns table (id uuid, session_no int, title text, category text, type text, max_score numeric, due_at timestamptz, sort_order int)
language sql stable security definer
set search_path = ''
as $$
  select a.id, a.session_no, a.title, a.category, a.type, a.max_score, a.due_at, a.sort_order
  from public.assignments a
  where public.current_app_role() is not null
$$;

revoke execute on function public.my_gradebook_items() from public, anon;
grant execute on function public.my_gradebook_items() to authenticated;

revoke execute on function
  public.grade_submission(uuid, numeric, text, text),
  public.admin_set_score(uuid, uuid, numeric),
  public.admin_import_students(jsonb),
  public.submissions_award_xp()
from public, anon;

grant execute on function
  public.grade_submission(uuid, numeric, text, text),
  public.admin_set_score(uuid, uuid, numeric),
  public.admin_import_students(jsonb)
to authenticated;

-- >>>>>>>>>> migrations/20261028000006_exams.sql
-- =============================================================
-- 006 Phase 4: คลังข้อสอบ การสอบ ตรวจคำตอบฝั่งเซิร์ฟเวอร์
--
-- รูปแบบข้อมูลคำถาม (ดัชนีอ้างอิงลำดับใน choices ที่เก็บใน DB)
--   type        choices                          correct_answer            คำตอบนักเรียน
--   mcq         ["ก","ข","ค","ง"]                {"index":2}               {"index":2}
--   true_false  []                               {"value":true}            {"value":true}
--   matching    {"left":[..],"right":[..]}       {"pairs":[2,0,1]}         {"pairs":[2,0,1]}   (left[i] จับ right[pairs[i]])
--   ordering    ["ขั้น x","ขั้น y",...] (สลับแล้ว)  {"order":[1,0,2]}         {"order":[1,0,2]}   (ลำดับที่ถูกของดัชนี)
--   fill        []                               {"accept":["คำตอบ",...]}  {"text":"..."}
--   short       []                               null                      {"text":"..."}       (ครูตรวจ)
-- นักเรียนไม่มีสิทธิ์อ่านตาราง questions — ได้คำถาม (ไม่มีเฉลย) ผ่าน start_exam เท่านั้น
-- =============================================================

alter table public.exam_attempts
  add column if not exists question_order uuid[] not null default '{}',
  add column if not exists points jsonb not null default '{}'::jsonb,   -- { question_id: 0..1 | null }
  add column if not exists max_points numeric(6,2),
  add column if not exists needs_review boolean not null default false,
  add column if not exists deadline_at timestamptz,
  add column if not exists saved_at timestamptz;

create index if not exists exam_attempts_exam_idx on public.exam_attempts(exam_id);

-- ฟังก์ชันที่รันในนาม owner (เช่นตอนส่งข้อสอบ) ข้ามตัวกันของนักเรียนได้
create or replace function public.submissions_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_type    text;
  v_session int;
  v_prefix  text;
  v_path    text;
begin
  new.updated_at := now();
  if public.is_admin() or current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.score := null;
    new.feedback := null;
  else
    new.score := old.score;
    new.feedback := old.feedback;
    new.assignment_id := old.assignment_id;
    new.student_id := old.student_id;
  end if;

  select a.type, a.session_no into v_type, v_session from public.assignments a where a.id = new.assignment_id;
  if v_type is null or v_type = 'score_only' then
    raise exception 'assignment_not_submittable' using errcode = '42501';
  end if;
  if v_session is not null and not public.is_session_unlocked(v_session) then
    raise exception 'session_locked' using errcode = '42501';
  end if;

  v_prefix := new.student_id::text || '/' || new.assignment_id::text || '/';
  foreach v_path in array coalesce(new.file_paths, '{}') loop
    if left(v_path, length(v_prefix)) <> v_prefix or v_path like '%..%' then
      raise exception 'invalid_file_path' using errcode = '42501';
    end if;
  end loop;
  if cardinality(new.file_paths) > 10 then
    raise exception 'too_many_files' using errcode = '22023';
  end if;

  if new.status = 'submitted' and (tg_op = 'INSERT' or old.status <> 'submitted') then
    new.submitted_at := now();
  elsif tg_op = 'UPDATE' then
    new.submitted_at := old.submitted_at;
  else
    new.submitted_at := null;
  end if;
  return new;
end;
$$;

-- -------------------------------------------------------------
-- ตรวจคำตอบ 1 ข้อ: คืน 0..1 (ได้บางส่วนสำหรับจับคู่/เรียงลำดับ) หรือ null = รอครูตรวจ
-- -------------------------------------------------------------
create or replace function public.normalize_answer(p text)
returns text
language sql immutable
set search_path = ''
as $$
  select lower(regexp_replace(btrim(coalesce(p, '')), '\s+', '', 'g'))
$$;

create or replace function public.grade_answer(p_type text, p_correct jsonb, p_answer jsonb)
returns numeric
language plpgsql immutable
set search_path = ''
as $$
declare
  v_key  text;
  v_n    int;
  v_ok   int := 0;
  v_i    int;
  v_text text;
begin
  if p_type = 'short' then
    if p_answer is null or public.normalize_answer(p_answer ->> 'text') = '' then
      return 0;
    end if;
    return null;
  end if;
  if p_answer is null or jsonb_typeof(p_answer) <> 'object' or p_correct is null then
    return 0;
  end if;

  case p_type
    when 'mcq' then
      return case when (p_answer ->> 'index') = (p_correct ->> 'index') then 1 else 0 end;
    when 'true_false' then
      return case when jsonb_typeof(p_answer -> 'value') = 'boolean' and (p_answer -> 'value') = (p_correct -> 'value') then 1 else 0 end;
    when 'matching', 'ordering' then
      v_key := case when p_type = 'matching' then 'pairs' else 'order' end;
      v_n := coalesce(jsonb_array_length(p_correct -> v_key), 0);
      if v_n = 0 or jsonb_typeof(p_answer -> v_key) is distinct from 'array' then
        return 0;
      end if;
      for v_i in 0 .. v_n - 1 loop
        if (p_answer -> v_key ->> v_i) = (p_correct -> v_key ->> v_i) then
          v_ok := v_ok + 1;
        end if;
      end loop;
      return round(v_ok::numeric / v_n, 2);
    when 'fill' then
      v_text := public.normalize_answer(p_answer ->> 'text');
      if v_text = '' then
        return 0;
      end if;
      return case when exists (
        select 1 from jsonb_array_elements_text(coalesce(p_correct -> 'accept', '[]'::jsonb)) a
        where public.normalize_answer(a) = v_text
      ) then 1 else 0 end;
    else
      return 0;
  end case;
end;
$$;

-- -------------------------------------------------------------
-- ภายใน: ตรวจทั้งชุด + ลงสมุดคะแนน + XP (ไม่เปิดให้เรียกจาก API)
-- -------------------------------------------------------------
create or replace function public._score_attempt(p_attempt_id uuid)
returns void
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_att    public.exam_attempts%rowtype;
  v_exam   public.exams%rowtype;
  v_points jsonb := '{}'::jsonb;
  v_sum    numeric := 0;
  v_max    numeric := 0;
  v_review boolean := false;
  v_q      record;
  v_p      numeric;
  v_amax   numeric;
  v_best   public.exam_attempts%rowtype;
begin
  select * into v_att from public.exam_attempts where id = p_attempt_id for update;
  select * into v_exam from public.exams where id = v_att.exam_id;

  for v_q in
    select q.id, q.type, q.correct_answer
    from unnest(v_att.question_order) as o(id)
    join public.questions q on q.id = o.id
  loop
    v_max := v_max + 1;
    -- คะแนนที่ครูให้ไว้แล้ว (ข้อเขียน) คงไว้
    if v_q.type = 'short' and (v_att.points ? v_q.id::text) and jsonb_typeof(v_att.points -> v_q.id::text) = 'number' then
      v_p := (v_att.points ->> v_q.id::text)::numeric;
    else
      v_p := public.grade_answer(v_q.type, v_q.correct_answer, v_att.answers -> v_q.id::text);
    end if;
    if v_p is null then
      v_review := true;
      v_points := v_points || jsonb_build_object(v_q.id::text, null);
    else
      v_sum := v_sum + v_p;
      v_points := v_points || jsonb_build_object(v_q.id::text, v_p);
    end if;
  end loop;

  update public.exam_attempts
  set points = v_points,
      score = round(v_sum, 2),
      max_points = v_max,
      needs_review = v_review,
      submitted_at = coalesce(submitted_at, now())
  where id = p_attempt_id;

  -- ลงสมุดคะแนน: ใช้ครั้งที่ได้คะแนนสูงสุด แปลงเป็นคะแนนเต็มของรายการ
  if v_exam.assignment_id is not null then
    select max_score into v_amax from public.assignments where id = v_exam.assignment_id;
    select * into v_best from public.exam_attempts
    where exam_id = v_exam.id and student_id = v_att.student_id and submitted_at is not null and max_points > 0
    order by score / max_points desc, submitted_at asc
    limit 1;
    if v_amax is not null and v_best.id is not null then
      insert into public.submissions (assignment_id, student_id, status, score, submitted_at)
      values (v_exam.assignment_id, v_att.student_id, 'graded', round(v_best.score / v_best.max_points * v_amax, 2), v_best.submitted_at)
      on conflict (assignment_id, student_id) do update
        set score = excluded.score, status = 'graded', submitted_at = excluded.submitted_at;
    end if;
  end if;

  -- Exit ticket ได้เต็ม +20 XP (ครั้งเดียวต่อชุด)
  if v_exam.kind = 'exit_ticket' and v_max > 0 and v_sum >= v_max and not v_review
     and not exists (select 1 from public.xp_events where student_id = v_att.student_id and source = 'exit_ticket' and ref_id = v_exam.id) then
    insert into public.xp_events (student_id, source, ref_id, xp) values (v_att.student_id, 'exit_ticket', v_exam.id, 20);
  end if;
end;
$$;

-- ผลการสอบ (แสดงเฉลยเมื่อชุดสอบเปิดให้ดู)
create or replace function public._attempt_result(p_attempt_id uuid)
returns jsonb
language sql stable security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'attempt_id', a.id,
    'exam_id', a.exam_id,
    'attempt_no', a.attempt_no,
    'score', a.score,
    'max_points', a.max_points,
    'needs_review', a.needs_review,
    'submitted_at', a.submitted_at,
    'show_answers', e.show_answers,
    'review', case when e.show_answers then coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', q.id,
        'type', q.type,
        'prompt', q.prompt,
        'choices', q.choices,
        'answer', a.answers -> q.id::text,
        'correct', q.correct_answer,
        'points', a.points -> q.id::text,
        'explanation', q.explanation
      ) order by o.ord)
      from unnest(a.question_order) with ordinality as o(id, ord)
      join public.questions q on q.id = o.id
    ), '[]'::jsonb) else null end
  )
  from public.exam_attempts a
  join public.exams e on e.id = a.exam_id
  where a.id = p_attempt_id
$$;

-- -------------------------------------------------------------
-- RPC นักเรียน
-- -------------------------------------------------------------
create or replace function public.start_exam(p_exam_id uuid)
returns jsonb
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_sid   uuid := public.current_student_id();
  v_exam  public.exams%rowtype;
  v_att   public.exam_attempts%rowtype;
  v_count int;
  v_order uuid[];
  v_deadline timestamptz;
begin
  if v_sid is null then
    raise exception 'not_student' using errcode = '42501';
  end if;
  select * into v_exam from public.exams where id = p_exam_id;
  if not found then
    raise exception 'exam_not_found' using errcode = '22023';
  end if;
  if v_exam.session_no is not null and not public.is_session_unlocked(v_exam.session_no) then
    raise exception 'exam_locked' using errcode = '42501';
  end if;
  if v_exam.opens_at is not null and now() < v_exam.opens_at then
    raise exception 'exam_not_open' using errcode = '42501';
  end if;

  -- ทำต่อจากครั้งที่ค้างไว้ (เน็ตหลุด/รีเฟรช) ถ้ายังไม่หมดเวลา
  select * into v_att from public.exam_attempts
  where exam_id = p_exam_id and student_id = v_sid and submitted_at is null
  order by started_at desc limit 1;
  if found and v_att.deadline_at is not null and now() > v_att.deadline_at + interval '30 seconds' then
    perform public._score_attempt(v_att.id);
    v_att := null;
  end if;

  if v_att.id is null then
    if v_exam.closes_at is not null and now() > v_exam.closes_at then
      raise exception 'exam_closed' using errcode = '42501';
    end if;
    select count(*) into v_count from public.exam_attempts where exam_id = p_exam_id and student_id = v_sid;
    if v_count >= v_exam.max_attempts then
      -- ทำครบแล้ว: คืนผลครั้งล่าสุด (ไม่ raise เพื่อให้การส่งอัตโนมัติด้านบนถูกบันทึก)
      return jsonb_build_object('finished', true, 'result', (
        select public._attempt_result(a.id) from public.exam_attempts a
        where a.exam_id = p_exam_id and a.student_id = v_sid and a.submitted_at is not null
        order by a.submitted_at desc limit 1
      ));
    end if;
    if v_exam.shuffle then
      select array_agg(q order by random()) into v_order from unnest(v_exam.question_ids) q;
    else
      v_order := v_exam.question_ids;
    end if;
    v_deadline := case when v_exam.duration_min is null then v_exam.closes_at
                       else least(now() + make_interval(mins => v_exam.duration_min), coalesce(v_exam.closes_at, 'infinity'::timestamptz)) end;
    insert into public.exam_attempts (exam_id, student_id, attempt_no, question_order, deadline_at)
    values (p_exam_id, v_sid, v_count + 1, coalesce(v_order, '{}'), v_deadline)
    returning * into v_att;
  end if;

  return jsonb_build_object(
    'attempt_id', v_att.id,
    'attempt_no', v_att.attempt_no,
    'started_at', v_att.started_at,
    'deadline_at', v_att.deadline_at,
    'server_now', now(),
    'answers', v_att.answers,
    'tab_switches', v_att.tab_switches,
    'exam', jsonb_build_object(
      'id', v_exam.id, 'title', v_exam.title, 'kind', v_exam.kind,
      'shuffle_choices', v_exam.shuffle_choices, 'require_fullscreen', v_exam.require_fullscreen
    ),
    'questions', coalesce((
      select jsonb_agg(jsonb_build_object('id', q.id, 'type', q.type, 'prompt', q.prompt, 'choices', q.choices) order by o.ord)
      from unnest(v_att.question_order) with ordinality as o(id, ord)
      join public.questions q on q.id = o.id
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.save_exam_answer(p_attempt_id uuid, p_question_id uuid, p_answer jsonb)
returns timestamptz
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_att public.exam_attempts%rowtype;
begin
  select * into v_att from public.exam_attempts where id = p_attempt_id for update;
  if not found or v_att.student_id is distinct from public.current_student_id() then
    raise exception 'attempt_not_found' using errcode = '42501';
  end if;
  if v_att.submitted_at is not null then
    raise exception 'already_submitted' using errcode = '42501';
  end if;
  if v_att.deadline_at is not null and now() > v_att.deadline_at + interval '30 seconds' then
    raise exception 'time_up' using errcode = '42501';
  end if;
  if not (p_question_id = any(v_att.question_order)) then
    raise exception 'question_not_in_exam' using errcode = '22023';
  end if;
  if length(coalesce(p_answer, 'null'::jsonb)::text) > 5000 then
    raise exception 'answer_too_long' using errcode = '22023';
  end if;
  update public.exam_attempts
  set answers = answers || jsonb_build_object(p_question_id::text, p_answer), saved_at = now()
  where id = p_attempt_id;
  return now();
end;
$$;

create or replace function public.record_tab_switch(p_attempt_id uuid)
returns int
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_n int;
begin
  update public.exam_attempts
  set tab_switches = tab_switches + 1
  where id = p_attempt_id and student_id = public.current_student_id() and submitted_at is null
  returning tab_switches into v_n;
  return coalesce(v_n, 0);
end;
$$;

create or replace function public.submit_exam(p_attempt_id uuid)
returns jsonb
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_att public.exam_attempts%rowtype;
begin
  select * into v_att from public.exam_attempts where id = p_attempt_id;
  if not found or v_att.student_id is distinct from public.current_student_id() then
    raise exception 'attempt_not_found' using errcode = '42501';
  end if;
  if v_att.submitted_at is null then
    perform public._score_attempt(p_attempt_id);
  end if;
  return public._attempt_result(p_attempt_id);
end;
$$;

create or replace function public.exam_result(p_attempt_id uuid)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_att public.exam_attempts%rowtype;
begin
  select * into v_att from public.exam_attempts where id = p_attempt_id;
  if not found or v_att.submitted_at is null
     or (v_att.student_id is distinct from public.current_student_id() and not public.is_admin()) then
    raise exception 'attempt_not_found' using errcode = '42501';
  end if;
  return public._attempt_result(p_attempt_id);
end;
$$;

-- -------------------------------------------------------------
-- RPC แอดมิน
-- -------------------------------------------------------------
-- ให้คะแนนข้อเขียน (0..1 ของข้อ) แล้วคำนวณคะแนนรวมใหม่
create or replace function public.admin_grade_exam_answer(p_attempt_id uuid, p_question_id uuid, p_points numeric)
returns jsonb
language plpgsql volatile security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_points < 0 or p_points > 1 then
    raise exception 'points_out_of_range' using errcode = '22023';
  end if;
  update public.exam_attempts
  set points = points || jsonb_build_object(p_question_id::text, p_points)
  where id = p_attempt_id and submitted_at is not null and p_question_id = any(question_order);
  if not found then
    raise exception 'attempt_not_found' using errcode = '22023';
  end if;
  perform public._score_attempt(p_attempt_id);
  return public._attempt_result(p_attempt_id);
end;
$$;

-- ตรวจใหม่ทั้งชุด (หลังครูแก้เฉลย)
create or replace function public.admin_rescore_exam(p_exam_id uuid)
returns int
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_n  int := 0;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  for v_id in select id from public.exam_attempts where exam_id = p_exam_id and submitted_at is not null loop
    perform public._score_attempt(v_id);
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;

revoke execute on function
  public.normalize_answer(text),
  public.grade_answer(text, jsonb, jsonb),
  public._score_attempt(uuid),
  public._attempt_result(uuid),
  public.start_exam(uuid),
  public.save_exam_answer(uuid, uuid, jsonb),
  public.record_tab_switch(uuid),
  public.submit_exam(uuid),
  public.exam_result(uuid),
  public.admin_grade_exam_answer(uuid, uuid, numeric),
  public.admin_rescore_exam(uuid)
from public, anon, authenticated;

grant execute on function
  public.start_exam(uuid),
  public.save_exam_answer(uuid, uuid, jsonb),
  public.record_tab_switch(uuid),
  public.submit_exam(uuid),
  public.exam_result(uuid),
  public.admin_grade_exam_answer(uuid, uuid, numeric),
  public.admin_rescore_exam(uuid)
to authenticated;

-- >>>>>>>>>> migrations/20261028000007_games_gamification.sql
-- =============================================================
-- 007 Phase 5: เกม XP เหรียญ ลีดเดอร์บอร์ด
-- =============================================================

create index if not exists game_plays_game_idx on public.game_plays(game_id);

-- -------------------------------------------------------------
-- เหรียญ: ตรวจกฎทุกเหรียญที่ยังไม่ได้ แล้วมอบให้ (คืนรายการเหรียญใหม่)
-- rule:
--   {"kind":"game_score","slug":"...","min_pct":80}
--   {"kind":"submission_session","session_no":13}
--   {"kind":"unit_complete"}            ส่งงานครบทุกชิ้นของหน่วยใดหน่วยหนึ่ง
--   {"kind":"attendance","count":5}
-- -------------------------------------------------------------
create or replace function public._award_badges(p_student_id uuid)
returns jsonb
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_b    public.badges%rowtype;
  v_ok   boolean;
  v_new  jsonb := '[]'::jsonb;
begin
  for v_b in
    select b.* from public.badges b
    where not exists (select 1 from public.student_badges sb where sb.student_id = p_student_id and sb.badge_id = b.id)
  loop
    v_ok := case v_b.rule ->> 'kind'
      when 'game_score' then exists (
        select 1 from public.game_plays gp join public.games g on g.id = gp.game_id
        where gp.student_id = p_student_id and g.slug = v_b.rule ->> 'slug'
          and gp.score * 100 >= coalesce((v_b.rule ->> 'min_pct')::numeric, 80) * g.max_score)
      when 'submission_session' then exists (
        select 1 from public.submissions s join public.assignments a on a.id = s.assignment_id
        where s.student_id = p_student_id and a.session_no = (v_b.rule ->> 'session_no')::int
          and s.status in ('submitted', 'graded'))
      when 'unit_complete' then exists (
        select 1 from public.units u
        where exists (select 1 from public.assignments a where a.unit_id = u.id and a.type <> 'score_only')
          and not exists (
            select 1 from public.assignments a
            where a.unit_id = u.id and a.type <> 'score_only'
              and not exists (
                select 1 from public.submissions s
                where s.assignment_id = a.id and s.student_id = p_student_id and s.status in ('submitted', 'graded'))))
      when 'attendance' then (
        select count(*) from public.attendance at
        where at.student_id = p_student_id and at.status in ('present', 'late')) >= coalesce((v_b.rule ->> 'count')::int, 5)
      else false
    end;
    if v_ok then
      insert into public.student_badges (student_id, badge_id) values (p_student_id, v_b.id) on conflict do nothing;
      v_new := v_new || jsonb_build_object('code', v_b.code, 'name', v_b.name, 'icon', v_b.icon);
    end if;
  end loop;
  return v_new;
end;
$$;

create or replace function public._badges_after_change()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  perform public._award_badges(new.student_id);
  return new;
end;
$$;

drop trigger if exists submissions_badges on public.submissions;
create trigger submissions_badges after insert or update of status on public.submissions
  for each row execute function public._badges_after_change();
drop trigger if exists attendance_badges on public.attendance;
create trigger attendance_badges after insert or update of status on public.attendance
  for each row execute function public._badges_after_change();

-- -------------------------------------------------------------
-- ส่งผลเกม (กันโกง XP)
--   - คะแนน 0..max_score และเวลาเล่น >= min_duration_sec
--   - เกมต้องอยู่ในคาบที่ปลดล็อก (ถ้าเกมผูกกับคาบ)
--   - XP เต็มครั้งแรก ครั้งต่อไป 20% · วันละ 3 รอบต่อเกมที่ได้ XP (รอบที่เกินเล่นได้แต่ไม่ได้ XP)
--   - กันส่งรัว: ห่างกันอย่างน้อย 5 วินาที
-- -------------------------------------------------------------
create or replace function public.submit_game_result(p_slug text, p_score int, p_duration_sec int)
returns jsonb
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_sid    uuid := public.current_student_id();
  v_game   public.games%rowtype;
  v_today  int;
  v_first  boolean;
  v_full   int;
  v_xp     int;
  v_play   uuid;
  v_best   int;
  v_day_start timestamptz := (date_trunc('day', now() at time zone 'Asia/Bangkok')) at time zone 'Asia/Bangkok';
begin
  if v_sid is null then
    raise exception 'not_student' using errcode = '42501';
  end if;
  select * into v_game from public.games where slug = p_slug and is_active;
  if not found then
    raise exception 'game_not_found' using errcode = '22023';
  end if;
  if exists (select 1 from public.class_sessions where game_slug = p_slug)
     and not exists (select 1 from public.class_sessions cs where cs.game_slug = p_slug and public.is_session_unlocked(cs.session_no)) then
    raise exception 'game_locked' using errcode = '42501';
  end if;
  if p_score is null or p_score < 0 or p_score > v_game.max_score then
    raise exception 'invalid_score' using errcode = '22023';
  end if;
  if p_duration_sec is null or p_duration_sec < v_game.min_duration_sec or p_duration_sec > 7200 then
    raise exception 'invalid_duration' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.game_plays
    where student_id = v_sid and game_id = v_game.id and played_at > now() - interval '5 seconds'
  ) then
    raise exception 'too_fast' using errcode = '42501';
  end if;

  select count(*) into v_today from public.game_plays
  where student_id = v_sid and game_id = v_game.id and played_at >= v_day_start;
  v_first := not exists (select 1 from public.game_plays where student_id = v_sid and game_id = v_game.id);
  v_full := round(v_game.max_xp::numeric * p_score / v_game.max_score);
  v_xp := case when v_today >= 3 then 0 when v_first then v_full else round(v_full * 0.2) end;

  insert into public.game_plays (game_id, student_id, score, duration_sec, xp_earned)
  values (v_game.id, v_sid, p_score, p_duration_sec, v_xp)
  returning id into v_play;
  if v_xp > 0 then
    insert into public.xp_events (student_id, source, ref_id, xp) values (v_sid, 'game', v_play, v_xp);
  end if;
  select max(score) into v_best from public.game_plays where student_id = v_sid and game_id = v_game.id;

  return jsonb_build_object(
    'xp', v_xp,
    'first_play', v_first,
    'plays_today', v_today + 1,
    'daily_limit', 3,
    'capped', v_today >= 3,
    'best_score', v_best,
    'new_badges', public._award_badges(v_sid)
  );
end;
$$;

-- เกมของฉัน: เปิดแล้วหรือยัง สถิติการเล่น
create or replace function public.my_games()
returns table (
  slug text, title text, description text, unit_no int, max_xp int, is_unlocked boolean,
  session_nos int[], plays int, best_score int, plays_today int
)
language sql stable security definer
set search_path = ''
as $$
  select
    g.slug, g.title, g.description, u.no, g.max_xp,
    public.is_admin()
      or not exists (select 1 from public.class_sessions cs where cs.game_slug = g.slug)
      or exists (select 1 from public.class_sessions cs where cs.game_slug = g.slug and public.is_session_unlocked(cs.session_no)),
    coalesce((select array_agg(cs.session_no order by cs.session_no) from public.class_sessions cs where cs.game_slug = g.slug), '{}'),
    (select count(*)::int from public.game_plays gp where gp.game_id = g.id and gp.student_id = public.current_student_id()),
    (select max(gp.score) from public.game_plays gp where gp.game_id = g.id and gp.student_id = public.current_student_id()),
    (select count(*)::int from public.game_plays gp where gp.game_id = g.id and gp.student_id = public.current_student_id()
       and gp.played_at >= (date_trunc('day', now() at time zone 'Asia/Bangkok')) at time zone 'Asia/Bangkok')
  from public.games g
  left join public.units u on u.id = g.unit_id
  where g.is_active and public.current_app_role() is not null
  order by coalesce((select min(cs.session_no) from public.class_sessions cs where cs.game_slug = g.slug), 99), g.title
$$;

-- -------------------------------------------------------------
-- ลีดเดอร์บอร์ด (แสดงเฉพาะชื่อเล่น ห้อง และ XP)
--   p_scope = 'class' (ห้องตัวเอง) | 'all'
--   app_settings.leaderboard_mode: all | top10 (แสดง 10 อันดับ + แถวของฉัน) | hidden (เฉพาะครู)
-- -------------------------------------------------------------
create or replace function public.leaderboard(p_scope text default 'class', p_classroom_id uuid default null)
returns table (rank int, nickname text, avatar text, classroom_name text, xp int, is_me boolean)
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_mode  text;
  v_admin boolean := public.is_admin();
  v_room  uuid;
  v_me    uuid := public.current_student_id();
begin
  if public.current_app_role() is null then
    return;
  end if;
  select leaderboard_mode into v_mode from public.app_settings where id = 1;
  if v_mode = 'hidden' and not v_admin then
    return;
  end if;
  v_room := case when p_scope = 'class' then coalesce(case when v_admin then p_classroom_id end, public.current_classroom_id()) end;

  return query
  with totals as (
    select s.id, coalesce(nullif(s.nickname, ''), s.first_name) as nick, s.avatar, c.name as room,
           coalesce((select sum(e.xp) from public.xp_events e where e.student_id = s.id), 0)::int as total
    from public.students s
    left join public.classrooms c on c.id = s.classroom_id
    where s.is_active and (v_room is null or s.classroom_id = v_room)
  ), ranked as (
    select (rank() over (order by t.total desc))::int as r, t.* from totals t
  )
  select r.r, r.nick, r.avatar, r.room, r.total, r.id = v_me
  from ranked r
  where v_admin or v_mode <> 'top10' or r.r <= 10 or r.id = v_me
  order by r.r, r.nick;
end;
$$;

-- สัญญาณให้หน้าลีดเดอร์บอร์ดโหลดใหม่ (Realtime) — แถวเดียว ไม่มีข้อมูลส่วนตัว
create table if not exists public.leaderboard_ticks (
  id int primary key default 1 check (id = 1),
  updated_at timestamptz not null default now()
);
insert into public.leaderboard_ticks (id) values (1) on conflict do nothing;
alter table public.leaderboard_ticks enable row level security;
revoke all on public.leaderboard_ticks from anon;
create policy leaderboard_ticks_read on public.leaderboard_ticks for select to authenticated using (true);

create or replace function public._tick_leaderboard()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  update public.leaderboard_ticks set updated_at = now() where id = 1;
  return null;
end;
$$;
drop trigger if exists xp_events_tick on public.xp_events;
create trigger xp_events_tick after insert or delete on public.xp_events
  for each statement execute function public._tick_leaderboard();

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.leaderboard_ticks;
  end if;
end $$;

-- เลือกอวาตาร์
create or replace function public.set_my_avatar(p_avatar text)
returns void
language plpgsql volatile security definer
set search_path = ''
as $$
begin
  if public.current_student_id() is null then
    raise exception 'not_student' using errcode = '42501';
  end if;
  if p_avatar not in ('non', 'namwan', 'doctor', 'robot', 'cat', 'owl') then
    raise exception 'invalid_avatar' using errcode = '22023';
  end if;
  update public.students set avatar = p_avatar where id = public.current_student_id();
end;
$$;

revoke execute on function
  public._award_badges(uuid),
  public._badges_after_change(),
  public._tick_leaderboard(),
  public.submit_game_result(text, int, int),
  public.my_games(),
  public.leaderboard(text, uuid),
  public.set_my_avatar(text)
from public, anon, authenticated;

grant execute on function
  public.submit_game_result(text, int, int),
  public.my_games(),
  public.leaderboard(text, uuid),
  public.set_my_avatar(text)
to authenticated;

-- >>>>>>>>>> migrations/20261028000008_polish.sql
-- =============================================================
-- 008 Phase 6: เก็บงาน
--   - ครูลบผลสอบ (ให้สอบใหม่) แล้วคะแนนในสมุดคะแนนคำนวณใหม่ทันที
--   - index สำหรับหน้าแดชบอร์ด/สมุดคะแนน
-- =============================================================

create or replace function public._sync_exam_score_after_delete()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_assignment uuid;
  v_amax       numeric;
  v_best       public.exam_attempts%rowtype;
begin
  select assignment_id into v_assignment from public.exams where id = old.exam_id;
  if v_assignment is null then
    return old;
  end if;
  select max_score into v_amax from public.assignments where id = v_assignment;
  select * into v_best from public.exam_attempts
  where exam_id = old.exam_id and student_id = old.student_id and submitted_at is not null and max_points > 0
  order by score / max_points desc, submitted_at asc
  limit 1;

  if v_best.id is null then
    -- ไม่เหลือผลสอบ: ล้างคะแนนรายการนี้ (นักเรียนต้องสอบใหม่)
    delete from public.submissions where assignment_id = v_assignment and student_id = old.student_id;
  else
    update public.submissions
    set score = round(v_best.score / v_best.max_points * v_amax, 2), status = 'graded', submitted_at = v_best.submitted_at
    where assignment_id = v_assignment and student_id = old.student_id;
  end if;
  return old;
end;
$$;

drop trigger if exists exam_attempts_sync_delete on public.exam_attempts;
create trigger exam_attempts_sync_delete after delete on public.exam_attempts
  for each row execute function public._sync_exam_score_after_delete();

revoke execute on function public._sync_exam_score_after_delete() from public, anon, authenticated;

create index if not exists submissions_status_idx on public.submissions(status);
create index if not exists exam_attempts_review_idx on public.exam_attempts(needs_review) where needs_review;
create index if not exists attendance_session_idx on public.attendance(session_no);

-- >>>>>>>>>> migrations/20261028000009_dbquest_schema.sql
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

-- >>>>>>>>>> migrations/20261028000010_dbquest_lessons.sql
-- =============================================================
-- 010 DB Quest: คาบเรียน 6 ขั้น, ปลดล็อก, progress, XP, เฉลย (answer_keys)
--   * เฉลยอยู่ใน dbq_answer_keys เท่านั้น — ไม่มี policy, ไม่มี grant
--   * นักเรียนตรวจคำตอบผ่าน dbq_check_answer ได้แค่ {correct, score, hint}
--   * dbq_get_answer_key คืนเฉลยเฉพาะครู; คนอื่นเรียก = บันทึก log + คืน error
-- =============================================================

alter table public.dbq_lessons add column game_key text;

-- XP แต่ละแหล่งได้ครั้งเดียว (กันกดซ้ำ/เรียกซ้ำ)
create unique index dbq_xp_events_source_uniq on public.dbq_xp_events(student_id, source);

create table public.dbq_answer_keys (
  item_id       text primary key check (item_id ~ '^[a-z0-9-]{1,64}$'),
  item_type     text not null check (item_type in ('check', 'practice', 'game', 'worksheet', 'quiz', 'project')),
  grade_type    text not null check (grade_type in ('mcq', 'multi', 'fill', 'order', 'match', 'classify', 'sql', 'rubric')),
  unit_no       int check (unit_no between 1 and 7),
  session_no    int references public.dbq_lessons(session_no) on delete set null,
  answer        jsonb not null default '{}'::jsonb,
  explanation   text not null default '',
  hint          text not null default '',           -- คำใบ้ชี้แนวคิด (ห้ามบอกคำตอบ) แสดงให้นักเรียนเมื่อตอบผิด
  rubric        jsonb,
  teacher_notes text not null default '',
  updated_at    timestamptz not null default now()
);
create index dbq_answer_keys_session_idx on public.dbq_answer_keys(session_no, item_type);

create table public.dbq_item_attempts (
  student_id       uuid not null references public.students(id) on delete cascade,
  item_id          text not null references public.dbq_answer_keys(item_id) on delete cascade,
  attempts         int not null default 0,
  correct          boolean not null default false,
  first_correct_at timestamptz,
  last_response    jsonb,
  last_at          timestamptz not null default now(),
  primary key (student_id, item_id)
);

create table public.dbq_security_log (
  id         bigint generated always as identity primary key,
  auth_uid   uuid,
  student_id uuid,
  action     text not null,
  detail     jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

do $$
declare t text;
begin
  foreach t in array array['dbq_answer_keys', 'dbq_item_attempts', 'dbq_security_log'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;

-- ---------- ตรวจคำตอบ ----------
-- mcq {choice} | multi {choices[]} | fill {accept[]} vs {text} | order {order[]} | match/classify {pairs{}}
create or replace function public.dbq_grade(p_type text, p_answer jsonb, p_resp jsonb)
returns boolean
language plpgsql immutable
set search_path = ''
as $$
begin
  case p_type
    when 'mcq' then
      return (p_resp ->> 'choice')::int = (p_answer ->> 'choice')::int;
    when 'multi' then
      return (select coalesce(array_agg(x order by x), '{}') from jsonb_array_elements_text(p_resp -> 'choices') x)
           = (select coalesce(array_agg(x order by x), '{}') from jsonb_array_elements_text(p_answer -> 'choices') x);
    when 'fill' then
      return length(public.normalize_answer(p_resp ->> 'text')) > 0 and exists (
        select 1 from jsonb_array_elements_text(p_answer -> 'accept') a
        where public.normalize_answer(a) = public.normalize_answer(p_resp ->> 'text')
      );
    when 'order' then
      return jsonb_typeof(p_resp -> 'order') = 'array' and p_resp -> 'order' = p_answer -> 'order';
    when 'match', 'classify' then
      return jsonb_typeof(p_resp -> 'pairs') = 'object' and p_resp -> 'pairs' = p_answer -> 'pairs';
    else
      return false;
  end case;
exception when others then
  return false;
end;
$$;

-- ---------- ความก้าวหน้า ----------
-- ขั้นที่ต้องทำในคาบนี้ (ไม่มีแบบฝึก/เกม/ใบงาน ก็ไม่นับขั้นนั้น)
create or replace function public.dbq_applicable_steps(p_session int)
returns text[]
language sql stable security definer
set search_path = ''
as $$
  select case when l.kind <> 'lesson' then array[]::text[] else array_remove(array[
    'warmup',
    'lesson',
    case when exists (select 1 from public.dbq_answer_keys k where k.session_no = l.session_no and k.item_type = 'practice') then 'practice' end,
    case when l.game_key is not null then 'game' end,
    case when exists (select 1 from public.dbq_assignments a where a.session_no = l.session_no) then 'worksheet' end,
    'wrapup'
  ], null) end
  from public.dbq_lessons l
  where l.session_no = p_session
$$;

create or replace function public.dbq_session_pct(p_student uuid, p_session int)
returns int
language sql stable security definer
set search_path = ''
as $$
  with s as (select public.dbq_applicable_steps(p_session) as steps)
  select case when cardinality(s.steps) = 0 then null else
    (100 * (select count(*) from public.dbq_progress p
            where p.student_id = p_student and p.session_no = p_session and p.step = any (s.steps))
     / cardinality(s.steps))::int
  end
  from s
$$;

-- คาบนี้เปิดให้นักเรียนคนนี้หรือยัง: เปิดตั้งต้น / ครูปลดล็อกให้ห้อง / คาบเนื้อหาก่อนหน้าทำครบตามเกณฑ์
create or replace function public.dbq_is_session_open(p_student uuid, p_session int)
returns boolean
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_prev int;
  v_thr  numeric;
begin
  if exists (select 1 from public.dbq_lessons where session_no = p_session and is_unlocked_default) then
    return true;
  end if;
  if exists (
    select 1 from public.dbq_classroom_unlocks u
    join public.students st on st.classroom_id = u.classroom_id
    where st.id = p_student and u.session_no = p_session
  ) then
    return true;
  end if;
  select max(session_no) into v_prev from public.dbq_lessons where session_no < p_session and kind = 'lesson';
  if v_prev is null then
    return false;
  end if;
  v_thr := coalesce((select (value #>> '{}')::numeric from public.dbq_settings where key = 'unlock_threshold_pct'), 80);
  return coalesce(public.dbq_session_pct(p_student, v_prev), 0) >= v_thr;
end;
$$;

-- ให้ XP ครั้งเดียวต่อ source คืนจำนวนที่ได้จริง (0 = เคยได้แล้ว)
create or replace function public.dbq_award_xp(p_student uuid, p_source text, p_amount int)
returns int
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_n int;
begin
  insert into public.dbq_xp_events (student_id, source, amount)
  values (p_student, p_source, p_amount)
  on conflict (student_id, source) do nothing;
  get diagnostics v_n = row_count;
  return case when v_n > 0 then p_amount else 0 end;
end;
$$;

create or replace function public.dbq_award_badge(p_student uuid, p_badge text)
returns boolean
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_n int;
begin
  insert into public.dbq_student_badges (student_id, badge_key) values (p_student, p_badge)
  on conflict do nothing;
  get diagnostics v_n = row_count;
  return v_n > 0;
end;
$$;

-- ---------- RPC นักเรียน ----------
-- แผนที่ 20 คาบ: เปิดหรือยัง ทำไปกี่ %
create or replace function public.dbq_my_map()
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_sid   uuid := public.dbq_student_id();
  v_admin boolean := public.is_admin();
begin
  perform public.dbq_require_member();
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'session_no', l.session_no,
      'unit_no', l.unit_no,
      'kind', l.kind,
      'title', l.title,
      'open', v_admin or public.dbq_is_session_open(v_sid, l.session_no),
      'pct', case when v_sid is null then null else public.dbq_session_pct(v_sid, l.session_no) end
    ) order by l.session_no)
    from public.dbq_lessons l
  ), '[]'::jsonb);
end;
$$;

-- สถานะในคาบ: ขั้นที่ต้องทำ / ทำแล้ว / ข้อที่ตอบถูกแล้ว (ไม่มีเฉลย)
create or replace function public.dbq_session_state(p_session int)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_sid uuid := public.dbq_student_id();
begin
  perform public.dbq_require_member();
  if not exists (select 1 from public.dbq_lessons where session_no = p_session) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if v_sid is not null and not public.dbq_is_session_open(v_sid, p_session) then
    raise exception 'locked' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'session_no', p_session,
    'steps', to_jsonb(public.dbq_applicable_steps(p_session)),
    'done', coalesce((
      select jsonb_object_agg(p.step, p.data) from public.dbq_progress p
      where p.student_id = v_sid and p.session_no = p_session
    ), '{}'::jsonb),
    'solved', coalesce((
      select jsonb_agg(a.item_id order by a.item_id) from public.dbq_item_attempts a
      join public.dbq_answer_keys k on k.item_id = a.item_id
      where a.student_id = v_sid and k.session_no = p_session and a.correct
    ), '[]'::jsonb),
    'attempted', coalesce((
      select jsonb_agg(a.item_id order by a.item_id) from public.dbq_item_attempts a
      join public.dbq_answer_keys k on k.item_id = a.item_id
      where a.student_id = v_sid and k.session_no = p_session
    ), '[]'::jsonb),
    'submissions', coalesce((
      select jsonb_object_agg(asg.item_id, jsonb_build_object(
        'content', s.content, 'score', s.score, 'max_score', asg.max_score,
        'feedback', s.feedback, 'submitted_at', s.submitted_at, 'graded_at', s.graded_at))
      from public.dbq_assignments asg
      join public.dbq_submissions s on s.assignment_id = asg.id and s.student_id = v_sid
      where asg.session_no = p_session
    ), '{}'::jsonb),
    'pct', case when v_sid is null then null else public.dbq_session_pct(v_sid, p_session) end,
    'preview', v_sid is null
  );
end;
$$;

-- ตรวจคำตอบ 1 ข้อ: คืนแค่ ถูก/ผิด คะแนน และคำใบ้ (ไม่คืนคำตอบที่ถูกเด็ดขาด)
create or replace function public.dbq_check_answer(p_item_id text, p_response jsonb)
returns jsonb
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_sid     uuid := public.dbq_student_id();
  v_key     public.dbq_answer_keys%rowtype;
  v_correct boolean;
  v_prev    public.dbq_item_attempts%rowtype;
  v_xp      int := 0;
begin
  perform public.dbq_require_member();
  if octet_length(coalesce(p_response::text, '')) > 20000 then
    raise exception 'response_too_large' using errcode = '22023';
  end if;
  select * into v_key from public.dbq_answer_keys where item_id = p_item_id;
  if not found or v_key.item_type not in ('check', 'practice', 'game') then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if v_sid is not null and v_key.session_no is not null and not public.dbq_is_session_open(v_sid, v_key.session_no) then
    raise exception 'locked' using errcode = '42501';
  end if;

  v_correct := public.dbq_grade(v_key.grade_type, v_key.answer, p_response);

  if v_sid is not null then
    select * into v_prev from public.dbq_item_attempts where student_id = v_sid and item_id = p_item_id;
    insert into public.dbq_item_attempts (student_id, item_id, attempts, correct, first_correct_at, last_response, last_at)
    values (v_sid, p_item_id, 1, v_correct, case when v_correct then now() end, p_response, now())
    on conflict (student_id, item_id) do update
      set attempts = public.dbq_item_attempts.attempts + 1,
          correct = public.dbq_item_attempts.correct or excluded.correct,
          first_correct_at = coalesce(public.dbq_item_attempts.first_correct_at, excluded.first_correct_at),
          last_response = excluded.last_response,
          last_at = now();
    if v_correct and not coalesce(v_prev.correct, false) then
      -- ถูกตั้งแต่ครั้งแรกได้มากกว่า
      v_xp := public.dbq_award_xp(v_sid, 'item:' || p_item_id, case when v_prev.attempts is null then 5 else 2 end);
    end if;
  end if;

  return jsonb_build_object(
    'correct', v_correct,
    'score', case when v_correct then 1 else 0 end,
    'hint', case when v_correct then null else nullif(v_key.hint, '') end,
    'xp', v_xp
  );
end;
$$;

-- บันทึกว่าทำขั้นนี้เสร็จ (ตรวจเงื่อนไขที่เซิร์ฟเวอร์)
create or replace function public.dbq_complete_step(p_session int, p_step text, p_data jsonb default '{}'::jsonb)
returns jsonb
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_sid   uuid := public.dbq_student_id();
  v_steps text[];
  v_xp    int := 0;
  v_pct   int;
  v_unit  int;
  v_game  text;
  v_badges text[] := '{}';
  v_text  text;
begin
  perform public.dbq_require_member();
  if v_sid is null then
    -- ครูดูตัวอย่าง: ไม่บันทึก
    return jsonb_build_object('ok', true, 'preview', true, 'xp', 0, 'pct', null);
  end if;
  if not public.dbq_is_session_open(v_sid, p_session) then
    raise exception 'locked' using errcode = '42501';
  end if;
  v_steps := public.dbq_applicable_steps(p_session);
  if v_steps is null or not (p_step = any (v_steps)) then
    raise exception 'invalid_step' using errcode = '22023';
  end if;
  if octet_length(coalesce(p_data::text, '')) > 8000 then
    raise exception 'data_too_large' using errcode = '22023';
  end if;

  select unit_no, game_key into v_unit, v_game from public.dbq_lessons where session_no = p_session;

  case p_step
    when 'warmup' then
      -- ตอบคำถามชวนคิดอย่างน้อยหนึ่งข้อ (ไม่คิดคะแนน)
      if jsonb_typeof(p_data -> 'answers') <> 'array' or not exists (
        select 1 from jsonb_array_elements_text(p_data -> 'answers') a where length(btrim(a)) > 0
      ) then
        raise exception 'incomplete' using errcode = '22023';
      end if;
    when 'lesson' then
      if exists (
        select 1 from public.dbq_answer_keys k
        where k.session_no = p_session and k.item_type = 'check'
          and not exists (select 1 from public.dbq_item_attempts a where a.student_id = v_sid and a.item_id = k.item_id and a.correct)
      ) then
        raise exception 'incomplete' using errcode = '22023';
      end if;
    when 'practice' then
      if exists (
        select 1 from public.dbq_answer_keys k
        where k.session_no = p_session and k.item_type = 'practice'
          and not exists (select 1 from public.dbq_item_attempts a where a.student_id = v_sid and a.item_id = k.item_id)
      ) then
        raise exception 'incomplete' using errcode = '22023';
      end if;
    when 'game' then
      if not exists (select 1 from public.dbq_game_scores g where g.student_id = v_sid and g.game_key = v_game) then
        raise exception 'incomplete' using errcode = '22023';
      end if;
    when 'worksheet' then
      if exists (
        select 1 from public.dbq_assignments asg
        where asg.session_no = p_session
          and not exists (select 1 from public.dbq_submissions s where s.assignment_id = asg.id and s.student_id = v_sid)
      ) then
        raise exception 'incomplete' using errcode = '22023';
      end if;
    when 'wrapup' then
      v_text := btrim(coalesce(p_data ->> 'reflection', ''));
      if length(v_text) = 0 then
        raise exception 'incomplete' using errcode = '22023';
      end if;
  end case;

  insert into public.dbq_progress (student_id, session_no, step, data)
  values (v_sid, p_session, p_step, coalesce(p_data, '{}'::jsonb))
  on conflict (student_id, session_no, step) do update set data = excluded.data;

  v_xp := public.dbq_award_xp(v_sid, format('step:%s:%s', p_session, p_step),
    case p_step when 'warmup' then 5 when 'lesson' then 20 when 'practice' then 15
                when 'game' then 10 when 'worksheet' then 10 else 10 end);

  v_pct := public.dbq_session_pct(v_sid, p_session);
  if v_pct = 100 then
    v_xp := v_xp + public.dbq_award_xp(v_sid, format('session:%s', p_session), 20);
    -- จบทุกคาบเนื้อหาของหน่วย
    if v_unit is not null and not exists (
      select 1 from public.dbq_lessons l
      where l.unit_no = v_unit and l.kind = 'lesson'
        and coalesce(public.dbq_session_pct(v_sid, l.session_no), 0) < 100
    ) then
      if public.dbq_award_badge(v_sid, 'unit-complete') then v_badges := array_append(v_badges, 'unit-complete'); end if;
      if not exists (
        select 1 from public.dbq_lessons l
        where l.kind = 'lesson' and coalesce(public.dbq_session_pct(v_sid, l.session_no), 0) < 100
      ) and public.dbq_award_badge(v_sid, 'all-units') then
        v_badges := array_append(v_badges, 'all-units');
      end if;
    end if;
  end if;

  return jsonb_build_object('ok', true, 'xp', v_xp, 'pct', v_pct, 'badges', to_jsonb(v_badges));
end;
$$;

-- ส่งใบงานแบบข้อความ (แบบไฟล์ / ER / SQL มาในเฟสถัดไป)
create or replace function public.dbq_submit_worksheet(p_item_id text, p_content jsonb)
returns jsonb
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_sid uuid := public.dbq_student_id();
  v_asg public.dbq_assignments%rowtype;
  v_old public.dbq_submissions%rowtype;
  v_xp  int;
begin
  if v_sid is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into v_asg from public.dbq_assignments where item_id = p_item_id;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if v_asg.session_no is not null and not public.dbq_is_session_open(v_sid, v_asg.session_no) then
    raise exception 'locked' using errcode = '42501';
  end if;
  if v_asg.type <> 'text' then
    raise exception 'unsupported_type' using errcode = '22023';
  end if;
  if length(btrim(coalesce(p_content ->> 'text', ''))) = 0 or octet_length(p_content::text) > 30000 then
    raise exception 'invalid_content' using errcode = '22023';
  end if;
  select * into v_old from public.dbq_submissions where assignment_id = v_asg.id and student_id = v_sid;
  if found and v_old.graded_at is not null then
    raise exception 'already_graded' using errcode = '42501';
  end if;
  insert into public.dbq_submissions (assignment_id, student_id, content, submitted_at)
  values (v_asg.id, v_sid, jsonb_build_object('text', p_content ->> 'text'), now())
  on conflict (assignment_id, student_id) do update set content = excluded.content, submitted_at = now();
  v_xp := public.dbq_award_xp(v_sid, 'worksheet:' || p_item_id, 15);
  return jsonb_build_object('ok', true, 'xp', v_xp);
end;
$$;

-- ---------- RPC ครู ----------
-- เฉลย: เฉพาะครูเท่านั้น คนอื่นเรียก = บันทึก log แล้วคืน error (ไม่ raise เพื่อให้ log ไม่ถูก rollback)
-- p_scope: { session_no?, unit_no?, item_type?, item_ids? }
create or replace function public.dbq_get_answer_key(p_scope jsonb default '{}'::jsonb)
returns jsonb
language plpgsql volatile security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    insert into public.dbq_security_log (auth_uid, student_id, action, detail)
    values (auth.uid(), public.current_student_id(), 'get_answer_key_denied', coalesce(p_scope, '{}'::jsonb));
    return jsonb_build_object('error', 'forbidden');
  end if;
  return jsonb_build_object('items', coalesce((
    select jsonb_agg(jsonb_build_object(
      'item_id', k.item_id, 'item_type', k.item_type, 'grade_type', k.grade_type,
      'unit_no', k.unit_no, 'session_no', k.session_no, 'answer', k.answer,
      'explanation', k.explanation, 'hint', k.hint, 'rubric', k.rubric, 'teacher_notes', k.teacher_notes
    ) order by k.session_no nulls last, k.item_id)
    from public.dbq_answer_keys k
    where (p_scope ->> 'session_no' is null or k.session_no = (p_scope ->> 'session_no')::int)
      and (p_scope ->> 'unit_no' is null or k.unit_no = (p_scope ->> 'unit_no')::int)
      and (p_scope ->> 'item_type' is null or k.item_type = p_scope ->> 'item_type')
      and (p_scope -> 'item_ids' is null or k.item_id in (select jsonb_array_elements_text(p_scope -> 'item_ids')))
  ), '[]'::jsonb));
end;
$$;

-- ห้อง DB Quest + คาบที่ครูปลดล็อกให้
create or replace function public.dbq_admin_unlock_overview()
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
begin
  perform public.dbq_require_admin();
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'classroom_id', c.id,
      'name', c.name,
      'students', (select count(*) from public.students st where st.classroom_id = c.id and st.is_active),
      'unlocked', coalesce((select jsonb_agg(u.session_no order by u.session_no) from public.dbq_classroom_unlocks u where u.classroom_id = c.id), '[]'::jsonb)
    ) order by c.sort_order, c.name)
    from public.classrooms c
    where c.course = 'dbquest_m5'
  ), '[]'::jsonb);
end;
$$;

-- p_classroom_id = null => ทุกห้อง DB Quest
create or replace function public.dbq_admin_set_unlock(p_session int, p_unlocked boolean, p_classroom_id uuid default null)
returns void
language plpgsql volatile security definer
set search_path = ''
as $$
begin
  perform public.dbq_require_admin();
  if p_unlocked then
    insert into public.dbq_classroom_unlocks (classroom_id, session_no)
    select c.id, p_session from public.classrooms c
    where c.course = 'dbquest_m5' and (p_classroom_id is null or c.id = p_classroom_id)
    on conflict do nothing;
  else
    delete from public.dbq_classroom_unlocks u
    where u.session_no = p_session and (p_classroom_id is null or u.classroom_id = p_classroom_id);
  end if;
end;
$$;

-- ---------- สิทธิ์ ----------
revoke execute on function
  public.dbq_grade(text, jsonb, jsonb),
  public.dbq_applicable_steps(int),
  public.dbq_session_pct(uuid, int),
  public.dbq_is_session_open(uuid, int),
  public.dbq_award_xp(uuid, text, int),
  public.dbq_award_badge(uuid, text),
  public.dbq_my_map(),
  public.dbq_session_state(int),
  public.dbq_check_answer(text, jsonb),
  public.dbq_complete_step(int, text, jsonb),
  public.dbq_submit_worksheet(text, jsonb),
  public.dbq_get_answer_key(jsonb),
  public.dbq_admin_unlock_overview(),
  public.dbq_admin_set_unlock(int, boolean, uuid)
from public, anon;

revoke execute on function
  public.dbq_grade(text, jsonb, jsonb),
  public.dbq_applicable_steps(int),
  public.dbq_session_pct(uuid, int),
  public.dbq_is_session_open(uuid, int),
  public.dbq_award_xp(uuid, text, int),
  public.dbq_award_badge(uuid, text)
from authenticated;

grant execute on function
  public.dbq_my_map(),
  public.dbq_session_state(int),
  public.dbq_check_answer(text, jsonb),
  public.dbq_complete_step(int, text, jsonb),
  public.dbq_submit_worksheet(text, jsonb),
  public.dbq_get_answer_key(jsonb),
  public.dbq_admin_unlock_overview(),
  public.dbq_admin_set_unlock(int, boolean, uuid)
to authenticated;

-- >>>>>>>>>> migrations/20261028000011_dbquest_games.sql
-- =============================================================
-- 011 DB Quest: ส่งผลเกม (เกมผูกกับคาบผ่าน dbq_lessons.game_key)
--   * ดาว: >= 90 = 3, >= 70 = 2, >= 40 = 1
--   * XP ได้ครั้งเดียวต่อดาว (ดาวละ 5) เล่นซ้ำคะแนนเดิมไม่ได้ XP เพิ่ม
--   * กันส่งรัว: เวลาเล่นขั้นต่ำ 10 วินาที และห่างกันอย่างน้อย 5 วินาที
-- =============================================================

create or replace function public.dbq_game_stars(p_score int)
returns int
language sql immutable
set search_path = ''
as $$
  select case when p_score >= 90 then 3 when p_score >= 70 then 2 when p_score >= 40 then 1 else 0 end
$$;

create or replace function public.dbq_submit_game_result(p_game_key text, p_score int, p_duration_sec int)
returns jsonb
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_sid    uuid := public.dbq_student_id();
  v_unit   int;
  v_stars  int;
  v_xp     int := 0;
  v_badges text[] := '{}';
  v_best   record;
begin
  perform public.dbq_require_member();
  select min(l.unit_no) into v_unit from public.dbq_lessons l where l.game_key = p_game_key;
  if not exists (select 1 from public.dbq_lessons l where l.game_key = p_game_key) then
    raise exception 'game_not_found' using errcode = 'P0002';
  end if;
  if p_score is null or p_score < 0 or p_score > 100 then
    raise exception 'invalid_score' using errcode = '22023';
  end if;
  if p_duration_sec is null or p_duration_sec < 10 or p_duration_sec > 7200 then
    raise exception 'invalid_duration' using errcode = '22023';
  end if;
  v_stars := public.dbq_game_stars(p_score);

  if v_sid is null then
    -- ครูดูตัวอย่าง: ไม่บันทึก
    return jsonb_build_object('ok', true, 'preview', true, 'score', p_score, 'stars', v_stars, 'xp', 0,
      'best_score', p_score, 'best_stars', v_stars, 'badges', '[]'::jsonb);
  end if;
  if not exists (
    select 1 from public.dbq_lessons l
    where l.game_key = p_game_key and public.dbq_is_session_open(v_sid, l.session_no)
  ) then
    raise exception 'locked' using errcode = '42501';
  end if;
  if exists (
    select 1 from public.dbq_game_scores
    where student_id = v_sid and game_key = p_game_key and played_at > now() - interval '5 seconds'
  ) then
    raise exception 'too_fast' using errcode = '42501';
  end if;

  for i in 1..v_stars loop
    v_xp := v_xp + public.dbq_award_xp(v_sid, format('game:%s:star%s', p_game_key, i), 5);
  end loop;
  if v_stars = 3 and public.dbq_award_badge(v_sid, 'three-stars') then
    v_badges := array_append(v_badges, 'three-stars');
  end if;

  insert into public.dbq_game_scores (game_key, unit_no, student_id, score, stars, xp)
  values (p_game_key, v_unit, v_sid, p_score, v_stars, v_xp);

  select max(score) as score, max(stars) as stars into v_best
  from public.dbq_game_scores where student_id = v_sid and game_key = p_game_key;

  return jsonb_build_object('ok', true, 'score', p_score, 'stars', v_stars, 'xp', v_xp,
    'best_score', v_best.score, 'best_stars', v_best.stars, 'badges', to_jsonb(v_badges));
end;
$$;

revoke execute on function
  public.dbq_game_stars(int),
  public.dbq_submit_game_result(text, int, int)
from public, anon;
revoke execute on function public.dbq_game_stars(int) from authenticated;
grant execute on function public.dbq_submit_game_result(text, int, int) to authenticated;

-- >>>>>>>>>> migrations/20261028000012_dbquest_game_decks.sql
-- =============================================================
-- 012 DB Quest: สำรับเกม (คู่คำ-ความหมาย) เก็บที่เซิร์ฟเวอร์
--   * คู่ในเกมซ้ำกับเฉลยแบบฝึก จึงไม่ใส่ไว้ใน src/ (ไม่หลุดไปกับเว็บ)
--   * นักเรียนได้สำรับเมื่อคาบเปิดแล้ว และทำทุกขั้นก่อนขั้นเกมครบ
-- =============================================================

create table public.dbq_game_decks (
  game_key   text primary key check (game_key ~ '^[a-z0-9-]{1,64}$'),
  config     jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.dbq_game_decks enable row level security;
revoke all on public.dbq_game_decks from anon, authenticated;

create or replace function public.dbq_game_deck(p_game_key text)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_sid     uuid := public.dbq_student_id();
  v_config  jsonb;
  v_session int;
begin
  perform public.dbq_require_member();
  select config into v_config from public.dbq_game_decks where game_key = p_game_key;
  select min(session_no) into v_session from public.dbq_lessons where game_key = p_game_key;
  if v_config is null or v_session is null then
    raise exception 'game_not_found' using errcode = 'P0002';
  end if;
  if v_sid is not null and not exists (
    select 1 from public.dbq_lessons l
    where l.game_key = p_game_key
      and public.dbq_is_session_open(v_sid, l.session_no)
      -- ทุกขั้นที่อยู่ก่อน 'game' ต้องทำแล้ว
      and not exists (
        select 1
        from unnest(public.dbq_applicable_steps(l.session_no)) with ordinality as s(step, pos)
        where s.pos < array_position(public.dbq_applicable_steps(l.session_no), 'game')
          and not exists (select 1 from public.dbq_progress p where p.student_id = v_sid and p.session_no = l.session_no and p.step = s.step)
      )
  ) then
    raise exception 'locked' using errcode = '42501';
  end if;
  return v_config || jsonb_build_object('game_key', p_game_key, 'session_no', v_session);
end;
$$;

revoke execute on function public.dbq_game_deck(text) from public, anon;
grant execute on function public.dbq_game_deck(text) to authenticated;

-- >>>>>>>>>> migrations/20261028000013_dbquest_scoring.sql
-- =============================================================
-- 013 DB Quest: ระบบคะแนนและหลังบ้านครู
--   * คะแนนรายวิชา 100 ตามน้ำหนักใน dbq_settings.score_weights
--       worksheet  = คะแนนใบงานที่ตรวจแล้ว / คะแนนเต็มใบงานทั้งหมด (ยังไม่ส่ง = 0)
--       game       = คะแนนดีที่สุดของแต่ละเกม เฉลี่ยทุกเกมที่ผูกกับคาบ
--       unit_quiz, project, attendance, midterm, final = ครูกรอกเอง (dbq_manual_scores)
--   * คำนวณที่เซิร์ฟเวอร์ที่เดียว (dbq_student_scores) หน้าครูและนักเรียนเห็นเลขเดียวกัน
-- =============================================================

create table public.dbq_manual_scores (
  student_id uuid not null references public.students(id) on delete cascade,
  category   text not null check (category in ('unit_quiz', 'project', 'attendance', 'midterm', 'final')),
  score      numeric(6,2) not null check (score >= 0),
  max_score  numeric(6,2) not null check (max_score > 0),
  updated_at timestamptz not null default now(),
  primary key (student_id, category),
  check (score <= max_score)
);
alter table public.dbq_manual_scores enable row level security;
revoke all on public.dbq_manual_scores from anon, authenticated;

-- ---------- คำนวณคะแนน (ภายใน) ----------
create or replace function public.dbq_student_scores(p_sid uuid)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_w      jsonb := coalesce((select value from public.dbq_settings where key = 'score_weights'), '{}'::jsonb);
  v_cat    text;
  v_earned numeric;
  v_max    numeric;
  v_pct    numeric;
  v_weight numeric;
  v_cats   jsonb := '{}'::jsonb;
  v_total  numeric := 0;
  v_avail  numeric := 0;
begin
  foreach v_cat in array array['worksheet', 'unit_quiz', 'game', 'project', 'attendance', 'midterm', 'final'] loop
    v_weight := coalesce((v_w ->> v_cat)::numeric, 0);
    if v_cat = 'worksheet' then
      select coalesce(sum(s.score) filter (where s.graded_at is not null), 0), coalesce(sum(a.max_score), 0)
        into v_earned, v_max
      from public.dbq_assignments a
      left join public.dbq_submissions s on s.assignment_id = a.id and s.student_id = p_sid;
    elsif v_cat = 'game' then
      select coalesce(sum(b.best), 0), 100 * count(*)
        into v_earned, v_max
      from (select distinct game_key from public.dbq_lessons where game_key is not null) g
      left join lateral (
        select max(gs.score) as best from public.dbq_game_scores gs where gs.student_id = p_sid and gs.game_key = g.game_key
      ) b on true;
    else
      select m.score, m.max_score into v_earned, v_max
      from public.dbq_manual_scores m where m.student_id = p_sid and m.category = v_cat;
      if not found then
        v_earned := null;
        v_max := null;
      end if;
    end if;

    v_pct := case when coalesce(v_max, 0) > 0 then round(100 * v_earned / v_max, 2) end;
    v_cats := v_cats || jsonb_build_object(v_cat, jsonb_build_object(
      'weight', v_weight,
      'earned', v_earned,
      'max', v_max,
      'pct', v_pct,
      'points', case when v_pct is null then null else round(v_pct * v_weight / 100, 2) end
    ));
    if v_pct is not null then
      v_total := v_total + v_pct * v_weight / 100;
      v_avail := v_avail + v_weight;
    end if;
  end loop;

  return jsonb_build_object(
    'categories', v_cats,
    'total', round(v_total, 2),           -- คะแนนสะสมเต็ม 100 (หมวดที่ยังไม่มีคะแนน = 0)
    'available', v_avail,                 -- น้ำหนักรวมของหมวดที่มีคะแนนแล้ว
    'current_pct', case when v_avail > 0 then round(100 * v_total / v_avail, 2) end
  );
end;
$$;

-- สรุปนักเรียน 1 คน (ใช้ในรายการนักเรียน/สมุดคะแนน)
create or replace function public.dbq_student_brief(p_sid uuid)
returns jsonb
language sql stable security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', st.id,
    'student_code', st.student_code,
    'number', st.number,
    'name', btrim(st.prefix || st.first_name || ' ' || st.last_name),
    'nickname', st.nickname,
    'classroom_id', st.classroom_id,
    'classroom_name', c.name,
    'is_active', st.is_active
  )
  from public.students st
  left join public.classrooms c on c.id = st.classroom_id
  where st.id = p_sid
$$;

-- ---------- RPC ครู ----------
-- ภาพรวม: รายห้อง + ความคืบหน้ารายคาบ + งานรอตรวจ
create or replace function public.dbq_admin_overview()
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
begin
  perform public.dbq_require_admin();
  return jsonb_build_object(
    'pending_grading', (
      select count(*) from public.dbq_submissions s
      join public.students st on st.id = s.student_id
      join public.classrooms c on c.id = st.classroom_id and c.course = 'dbquest_m5'
      where s.graded_at is null
    ),
    'classrooms', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id,
        'name', c.name,
        'students', (select count(*) from public.students st where st.classroom_id = c.id and st.is_active),
        'active_7d', (
          select count(distinct p.student_id) from public.dbq_progress p
          join public.students st on st.id = p.student_id
          where st.classroom_id = c.id and p.completed_at > now() - interval '7 days'
        ),
        'avg_xp', coalesce((
          select round(avg(x.total)) from (
            select coalesce(sum(e.amount), 0) as total
            from public.students st
            left join public.dbq_xp_events e on e.student_id = st.id
            where st.classroom_id = c.id and st.is_active
            group by st.id
          ) x
        ), 0),
        'pending_grading', (
          select count(*) from public.dbq_submissions s
          join public.students st on st.id = s.student_id
          where st.classroom_id = c.id and s.graded_at is null
        )
      ) order by c.sort_order, c.name)
      from public.classrooms c where c.course = 'dbquest_m5'
    ), '[]'::jsonb),
    'sessions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'session_no', l.session_no,
        'title', l.title,
        'kind', l.kind,
        'started', (select count(distinct p.student_id) from public.dbq_progress p where p.session_no = l.session_no),
        'completed', (
          select count(*) from public.students st
          join public.classrooms c on c.id = st.classroom_id and c.course = 'dbquest_m5'
          where st.is_active and public.dbq_session_pct(st.id, l.session_no) = 100
        )
      ) order by l.session_no)
      from public.dbq_lessons l
    ), '[]'::jsonb)
  );
end;
$$;

-- รายชื่อนักเรียน DB Quest (p_classroom_id = null => ทุกห้อง)
create or replace function public.dbq_admin_students(p_classroom_id uuid default null)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
begin
  perform public.dbq_require_admin();
  return coalesce((
    select jsonb_agg(public.dbq_student_brief(st.id) || jsonb_build_object(
      'xp', coalesce((select sum(e.amount) from public.dbq_xp_events e where e.student_id = st.id), 0),
      'sessions_done', (
        select count(*) from public.dbq_lessons l
        where l.kind = 'lesson' and public.dbq_session_pct(st.id, l.session_no) = 100
      ),
      'current_session', (select max(p.session_no) from public.dbq_progress p where p.student_id = st.id),
      'badges', (select count(*) from public.dbq_student_badges b where b.student_id = st.id),
      'last_active', greatest(
        (select max(p.completed_at) from public.dbq_progress p where p.student_id = st.id),
        (select max(e.created_at) from public.dbq_xp_events e where e.student_id = st.id)
      )
    ) order by c.sort_order, c.name, st.number nulls last, st.student_code)
    from public.students st
    join public.classrooms c on c.id = st.classroom_id and c.course = 'dbquest_m5'
    where p_classroom_id is null or st.classroom_id = p_classroom_id
  ), '[]'::jsonb);
end;
$$;

create or replace function public.dbq_admin_student_detail(p_student_id uuid)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
begin
  perform public.dbq_require_admin();
  if not exists (
    select 1 from public.students st join public.classrooms c on c.id = st.classroom_id
    where st.id = p_student_id and c.course = 'dbquest_m5'
  ) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  return jsonb_build_object(
    'student', public.dbq_student_brief(p_student_id),
    'xp', coalesce((select sum(amount) from public.dbq_xp_events where student_id = p_student_id), 0),
    'scores', public.dbq_student_scores(p_student_id),
    'sessions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'session_no', l.session_no,
        'title', l.title,
        'kind', l.kind,
        'open', public.dbq_is_session_open(p_student_id, l.session_no),
        'pct', public.dbq_session_pct(p_student_id, l.session_no),
        'steps_done', coalesce((
          select jsonb_agg(p.step order by p.completed_at) from public.dbq_progress p
          where p.student_id = p_student_id and p.session_no = l.session_no
        ), '[]'::jsonb)
      ) order by l.session_no)
      from public.dbq_lessons l
    ), '[]'::jsonb),
    'games', coalesce((
      select jsonb_agg(to_jsonb(g) order by g.game_key) from (
        select game_key, max(score) as best_score, max(stars) as best_stars, count(*) as plays, max(played_at) as last_played
        from public.dbq_game_scores where student_id = p_student_id group by game_key
      ) g
    ), '[]'::jsonb),
    'badges', coalesce((
      select jsonb_agg(jsonb_build_object('key', b.key, 'name', b.name, 'icon', b.icon, 'earned_at', sb.earned_at) order by sb.earned_at)
      from public.dbq_student_badges sb join public.dbq_badges b on b.key = sb.badge_key
      where sb.student_id = p_student_id
    ), '[]'::jsonb),
    'recent_xp', coalesce((
      select jsonb_agg(x order by x.created_at desc) from (
        select source, amount, created_at from public.dbq_xp_events
        where student_id = p_student_id order by created_at desc limit 20
      ) x
    ), '[]'::jsonb)
  );
end;
$$;

-- งานที่ส่งมา: p_filter { status: pending|graded|all, session_no?, classroom_id?, item_id? }
-- แนบเกณฑ์ (rubric) และคำตอบตัวอย่างจากเฉลยมาด้วย (เฉพาะครู)
create or replace function public.dbq_admin_submissions(p_filter jsonb default '{}'::jsonb)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_status text := coalesce(p_filter ->> 'status', 'pending');
begin
  perform public.dbq_require_admin();
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', s.id,
      'assignment', jsonb_build_object('id', a.id, 'item_id', a.item_id, 'title', a.title, 'max_score', a.max_score, 'session_no', a.session_no),
      'student', public.dbq_student_brief(st.id),
      'content', s.content,
      'score', s.score,
      'feedback', s.feedback,
      'submitted_at', s.submitted_at,
      'graded_at', s.graded_at,
      'rubric', k.rubric,
      'sample', k.answer -> 'sample'
    ) order by s.submitted_at)
    from public.dbq_submissions s
    join public.dbq_assignments a on a.id = s.assignment_id
    join public.students st on st.id = s.student_id
    join public.classrooms c on c.id = st.classroom_id and c.course = 'dbquest_m5'
    left join public.dbq_answer_keys k on k.item_id = a.item_id
    where (v_status = 'all' or (v_status = 'pending') = (s.graded_at is null))
      and (p_filter ->> 'session_no' is null or a.session_no = (p_filter ->> 'session_no')::int)
      and (p_filter ->> 'classroom_id' is null or st.classroom_id = (p_filter ->> 'classroom_id')::uuid)
      and (p_filter ->> 'item_id' is null or a.item_id = p_filter ->> 'item_id')
  ), '[]'::jsonb);
end;
$$;

-- ตรวจงาน: p_score = null => ยกเลิกการตรวจ (นักเรียนแก้แล้วส่งใหม่ได้)
create or replace function public.dbq_admin_grade_submission(p_submission_id uuid, p_score numeric, p_feedback text default null)
returns jsonb
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_max numeric;
begin
  perform public.dbq_require_admin();
  select a.max_score into v_max
  from public.dbq_submissions s join public.dbq_assignments a on a.id = s.assignment_id
  where s.id = p_submission_id;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if p_score is not null and (p_score < 0 or p_score > v_max) then
    raise exception 'invalid_score' using errcode = '22023';
  end if;
  if length(coalesce(p_feedback, '')) > 2000 then
    raise exception 'feedback_too_long' using errcode = '22023';
  end if;
  update public.dbq_submissions
  set score = p_score,
      feedback = nullif(btrim(coalesce(p_feedback, '')), ''),
      graded_at = case when p_score is null then null else now() end
  where id = p_submission_id;
  return jsonb_build_object('ok', true, 'score', p_score, 'graded', p_score is not null);
end;
$$;

-- คะแนนที่ครูกรอกเอง: p_score = null => ลบ
create or replace function public.dbq_admin_set_manual_score(p_student_id uuid, p_category text, p_score numeric, p_max_score numeric default 100)
returns void
language plpgsql volatile security definer
set search_path = ''
as $$
begin
  perform public.dbq_require_admin();
  if p_category not in ('unit_quiz', 'project', 'attendance', 'midterm', 'final') then
    raise exception 'invalid_category' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.students st join public.classrooms c on c.id = st.classroom_id
    where st.id = p_student_id and c.course = 'dbquest_m5'
  ) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if p_score is null then
    delete from public.dbq_manual_scores where student_id = p_student_id and category = p_category;
    return;
  end if;
  if p_max_score is null or p_max_score <= 0 or p_score < 0 or p_score > p_max_score then
    raise exception 'invalid_score' using errcode = '22023';
  end if;
  insert into public.dbq_manual_scores (student_id, category, score, max_score, updated_at)
  values (p_student_id, p_category, p_score, p_max_score, now())
  on conflict (student_id, category) do update
    set score = excluded.score, max_score = excluded.max_score, updated_at = now();
end;
$$;

-- สมุดคะแนนทั้งห้อง: งานแต่ละชิ้น + คะแนนทุกหมวด
create or replace function public.dbq_admin_gradebook(p_classroom_id uuid default null)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
begin
  perform public.dbq_require_admin();
  return jsonb_build_object(
    'weights', coalesce((select value from public.dbq_settings where key = 'score_weights'), '{}'::jsonb),
    'assignments', coalesce((
      select jsonb_agg(jsonb_build_object('id', a.id, 'item_id', a.item_id, 'title', a.title, 'max_score', a.max_score, 'session_no', a.session_no)
        order by a.session_no nulls last, a.sort_order)
      from public.dbq_assignments a
    ), '[]'::jsonb),
    'manual_max', coalesce((
      select jsonb_object_agg(category, max_score) from (
        select distinct on (category) category, max_score from public.dbq_manual_scores order by category, updated_at desc
      ) m
    ), '{}'::jsonb),
    'rows', coalesce((
      select jsonb_agg(public.dbq_student_brief(st.id) || jsonb_build_object(
        'work', coalesce((
          select jsonb_object_agg(a.id, jsonb_build_object(
            'status', case when s.id is null then 'missing' when s.graded_at is null then 'submitted' else 'graded' end,
            'score', s.score,
            'submission_id', s.id
          ))
          from public.dbq_assignments a
          left join public.dbq_submissions s on s.assignment_id = a.id and s.student_id = st.id
        ), '{}'::jsonb),
        'manual', coalesce((
          select jsonb_object_agg(m.category, jsonb_build_object('score', m.score, 'max', m.max_score))
          from public.dbq_manual_scores m where m.student_id = st.id
        ), '{}'::jsonb),
        'xp', coalesce((select sum(e.amount) from public.dbq_xp_events e where e.student_id = st.id), 0),
        'scores', public.dbq_student_scores(st.id)
      ) order by c.sort_order, c.name, st.number nulls last, st.student_code)
      from public.students st
      join public.classrooms c on c.id = st.classroom_id and c.course = 'dbquest_m5'
      where st.is_active and (p_classroom_id is null or st.classroom_id = p_classroom_id)
    ), '[]'::jsonb)
  );
end;
$$;

-- ตั้งค่า: ตรวจรูปแบบค่าก่อนบันทึก
create or replace function public.dbq_admin_set_setting(p_key text, p_value jsonb)
returns void
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_keys text[] := array['worksheet', 'unit_quiz', 'game', 'project', 'attendance', 'midterm', 'final'];
  v_sum  numeric := 0;
  v_k    text;
begin
  perform public.dbq_require_admin();
  if p_key not in ('score_weights', 'leaderboard_enabled', 'pin_enabled', 'unlock_threshold_pct') then
    raise exception 'unknown setting %', p_key using errcode = '22023';
  end if;
  if p_key in ('leaderboard_enabled', 'pin_enabled') and jsonb_typeof(p_value) <> 'boolean' then
    raise exception 'invalid_value' using errcode = '22023';
  end if;
  if p_key = 'unlock_threshold_pct' and (jsonb_typeof(p_value) <> 'number' or (p_value #>> '{}')::numeric not between 0 and 100) then
    raise exception 'invalid_value' using errcode = '22023';
  end if;
  if p_key = 'score_weights' then
    if jsonb_typeof(p_value) <> 'object' or (select count(*) from jsonb_object_keys(p_value)) <> cardinality(v_keys) then
      raise exception 'invalid_value' using errcode = '22023';
    end if;
    foreach v_k in array v_keys loop
      if jsonb_typeof(p_value -> v_k) is distinct from 'number' or (p_value ->> v_k)::numeric < 0 then
        raise exception 'invalid_value' using errcode = '22023';
      end if;
      v_sum := v_sum + (p_value ->> v_k)::numeric;
    end loop;
    if v_sum <> 100 then
      raise exception 'weights_must_sum_100' using errcode = '22023';
    end if;
  end if;
  insert into public.dbq_settings (key, value, updated_at) values (p_key, p_value, now())
  on conflict (key) do update set value = excluded.value, updated_at = now();
end;
$$;

-- ---------- RPC นักเรียน ----------
-- คะแนนของฉัน: ทุกหมวด + ใบงานทุกชิ้น + เกม
create or replace function public.dbq_my_scores()
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_sid uuid := public.dbq_student_id();
begin
  perform public.dbq_require_member();
  if v_sid is null then
    return jsonb_build_object('preview', true);
  end if;
  return jsonb_build_object(
    'preview', false,
    'scores', public.dbq_student_scores(v_sid),
    'assignments', coalesce((
      select jsonb_agg(jsonb_build_object(
        'item_id', a.item_id,
        'title', a.title,
        'session_no', a.session_no,
        'max_score', a.max_score,
        'open', a.session_no is null or public.dbq_is_session_open(v_sid, a.session_no),
        'status', case when s.id is null then 'missing' when s.graded_at is null then 'submitted' else 'graded' end,
        'score', s.score,
        'feedback', s.feedback,
        'submitted_at', s.submitted_at,
        'graded_at', s.graded_at
      ) order by a.session_no nulls last, a.sort_order)
      from public.dbq_assignments a
      left join public.dbq_submissions s on s.assignment_id = a.id and s.student_id = v_sid
    ), '[]'::jsonb),
    'games', coalesce((
      select jsonb_agg(jsonb_build_object(
        'game_key', l.game_key,
        'session_no', l.session_no,
        'best_score', (select max(g.score) from public.dbq_game_scores g where g.student_id = v_sid and g.game_key = l.game_key),
        'best_stars', (select max(g.stars) from public.dbq_game_scores g where g.student_id = v_sid and g.game_key = l.game_key),
        'plays', (select count(*) from public.dbq_game_scores g where g.student_id = v_sid and g.game_key = l.game_key)
      ) order by l.session_no)
      from public.dbq_lessons l where l.game_key is not null
    ), '[]'::jsonb)
  );
end;
$$;

-- อันดับ XP ในห้องของฉัน (ครูปิดได้ใน leaderboard_enabled) — แสดงแค่ชื่อเล่น
create or replace function public.dbq_leaderboard()
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_sid  uuid := public.dbq_student_id();
  v_room uuid;
begin
  perform public.dbq_require_member();
  if not coalesce((select (value #>> '{}')::boolean from public.dbq_settings where key = 'leaderboard_enabled'), true) then
    return jsonb_build_object('enabled', false, 'rows', '[]'::jsonb);
  end if;
  select classroom_id into v_room from public.students where id = v_sid;
  return jsonb_build_object('enabled', true, 'rows', coalesce((
    select jsonb_agg(jsonb_build_object('rank', r.rank, 'nickname', r.nickname, 'avatar', r.avatar, 'xp', r.xp, 'is_me', r.id = v_sid) order by r.rank, r.nickname)
    from (
      select st.id, coalesce(nullif(st.nickname, ''), st.first_name) as nickname, st.avatar,
             coalesce(sum(e.amount), 0) as xp,
             rank() over (order by coalesce(sum(e.amount), 0) desc) as rank
      from public.students st
      left join public.dbq_xp_events e on e.student_id = st.id
      where st.is_active and st.classroom_id = v_room
      group by st.id
    ) r
    where r.rank <= 10 or r.id = v_sid
  ), '[]'::jsonb));
end;
$$;

-- ---------- สิทธิ์ ----------
revoke execute on function
  public.dbq_student_scores(uuid),
  public.dbq_student_brief(uuid),
  public.dbq_admin_overview(),
  public.dbq_admin_students(uuid),
  public.dbq_admin_student_detail(uuid),
  public.dbq_admin_submissions(jsonb),
  public.dbq_admin_grade_submission(uuid, numeric, text),
  public.dbq_admin_set_manual_score(uuid, text, numeric, numeric),
  public.dbq_admin_gradebook(uuid),
  public.dbq_admin_set_setting(text, jsonb),
  public.dbq_my_scores(),
  public.dbq_leaderboard()
from public, anon;

revoke execute on function
  public.dbq_student_scores(uuid),
  public.dbq_student_brief(uuid)
from authenticated;

grant execute on function
  public.dbq_admin_overview(),
  public.dbq_admin_students(uuid),
  public.dbq_admin_student_detail(uuid),
  public.dbq_admin_submissions(jsonb),
  public.dbq_admin_grade_submission(uuid, numeric, text),
  public.dbq_admin_set_manual_score(uuid, text, numeric, numeric),
  public.dbq_admin_gradebook(uuid),
  public.dbq_admin_set_setting(text, jsonb),
  public.dbq_my_scores(),
  public.dbq_leaderboard()
to authenticated;

-- >>>>>>>>>> seed.sql
-- =============================================================
-- Seed ข้อมูลเริ่มต้น (รันซ้ำได้ ไม่สร้างข้อมูลซ้ำ)
--   ส่วน A  ห้อง ม.3/1 + นักเรียนตัวอย่าง 5 คน (รหัส 10001–10005)
--   ส่วน B  หน่วยการเรียนรู้ 3 หน่วย
--   ส่วน C  แผนการสอน 20 คาบ (ขั้นตอนในคาบ 120 นาที)
--   ส่วน D  เนื้อหาบทเรียนฉบับร่างทุกคาบ (ครูแก้ไขได้ในหน้าแอดมิน)
-- (app_settings และรหัสแอดมินเริ่มต้นอยู่ใน migration แล้ว)
-- เนื้อหาทั้งหมดเป็น "ฉบับร่าง" เรียบเรียงใหม่ตามหัวข้อหนังสือเรียน — ครูควรตรวจทานก่อนใช้จริง
-- =============================================================

-- ---------- A. ห้องเรียน / นักเรียนตัวอย่าง ----------
insert into public.classrooms (name, sort_order)
values ('ม.3/1', 1)
on conflict (name) do nothing;

insert into public.students (student_code, prefix, first_name, last_name, nickname, classroom_id, number, avatar)
select v.code, v.prefix, v.first_name, v.last_name, v.nickname, c.id, v.number, v.avatar
from (values
  ('10001', 'เด็กชาย',  'ธนกร',   'ใจดี',     'ต้นกล้า', 1, 'non'),
  ('10002', 'เด็กหญิง', 'พิมพ์ชนก', 'สายสุข',   'ใบเตย',  2, 'namwan'),
  ('10003', 'เด็กชาย',  'ภูมิพัฒน์', 'รักเรียน',  'ภูมิ',    3, 'non'),
  ('10004', 'เด็กหญิง', 'ณัฐธิดา',  'มีสุข',    'มายด์',  4, 'namwan'),
  ('10005', 'เด็กชาย',  'กิตติพัศ',  'ศรีสว่าง',  'กิต',    5, 'doctor')
) as v(code, prefix, first_name, last_name, nickname, number, avatar)
cross join public.classrooms c
where c.name = 'ม.3/1'
on conflict (student_code) do nothing;

-- ---------- B. หน่วยการเรียนรู้ ----------
insert into public.units (no, title, description, indicators, objectives, mindmap)
select * from (values
  (1, 'เทคโนโลยีเปลี่ยนโลก',
   'สำรวจเทคโนโลยีที่กำลังเปลี่ยนชีวิตเรา ทั้งเครือข่าย 5G รถยนต์ไฟฟ้า และระบบโลจิสติกส์ แล้ววิเคราะห์ว่าอะไรทำให้เทคโนโลยีเปลี่ยนแปลง และเกี่ยวข้องกับวิทยาศาสตร์และคณิตศาสตร์อย่างไร',
   array[1],
   array[
     'วิเคราะห์สาเหตุหรือปัจจัยที่ส่งผลต่อการเปลี่ยนแปลงของเทคโนโลยีได้',
     'อธิบายวิวัฒนาการของเครือข่ายไร้สาย 1G–5G และการนำไปใช้ได้',
     'จำแนกประเภทของรถยนต์ไฟฟ้า และบอกข้อดี-ข้อจำกัดได้',
     'อธิบายองค์ประกอบและเทคโนโลยีที่ใช้ในการจัดการโลจิสติกส์ได้',
     'อธิบายความสัมพันธ์ระหว่างเทคโนโลยีกับวิทยาศาสตร์และคณิตศาสตร์ได้'
   ],
   '[{"title":"เครือข่าย 5G","children":["วิวัฒนาการ 1G → 5G","อินเทอร์เน็ตของสรรพสิ่ง (IoT)","เมืองอัจฉริยะ (Smart City)"]},
     {"title":"รถยนต์ไฟฟ้า","children":["HEV / PHEV / BEV / FCEV","แบตเตอรี่และสถานีชาร์จ","ข้อดี-ข้อจำกัด"]},
     {"title":"การจัดการโลจิสติกส์","children":["การขนส่ง","คลังสินค้า","บรรจุภัณฑ์","Barcode / QR / RFID / GPS"]},
     {"title":"ปัจจัยที่ทำให้เทคโนโลยีเปลี่ยน","children":["ปัญหาและความต้องการ","ความรู้วิทยาศาสตร์-คณิตศาสตร์","เศรษฐกิจ","สังคมและวัฒนธรรม","สิ่งแวดล้อม"]}]'::jsonb),
  (2, 'เทคโนโลยีแก้ปัญหา',
   'ใช้กระบวนการออกแบบเชิงวิศวกรรม 6 ขั้น แก้ปัญหาหรือตอบความต้องการของชุมชน ตั้งแต่ระบุปัญหา ออกแบบ สร้างต้นแบบ ทดสอบ ปรับปรุง จนถึงเขียนรายงานและนำเสนอ',
   array[2, 3, 4],
   array[
     'อธิบายการนำเทคโนโลยีมาแก้ปัญหาในอาชีพต่าง ๆ ได้',
     'ระบุปัญหาหรือความต้องการของชุมชน และสรุปกรอบของปัญหาได้',
     'รวบรวม วิเคราะห์ข้อมูล และคัดเลือกแนวคิดโดยคำนึงถึงทรัพย์สินทางปัญญาได้',
     'ออกแบบ วางแผน และสร้างชิ้นงานอย่างเป็นขั้นตอนและปลอดภัยได้',
     'ทดสอบ ประเมินผล ปรับปรุงแก้ไข เขียนรายงาน และนำเสนอผลงานได้'
   ],
   '[{"title":"ระบุปัญหา","children":["สัมภาษณ์ชุมชน","5W1H","กรอบของปัญหา"]},
     {"title":"รวบรวมข้อมูลและแนวคิด","children":["แหล่งข้อมูล","ระดมสมอง","ตารางเปรียบเทียบ","อ้างอิงแหล่งที่มา"]},
     {"title":"ออกแบบและลงมือทำ","children":["ร่างภาพ / แผนภาพ","วางแผนขั้นตอน","เลือกวัสดุ-เครื่องมือ","ความปลอดภัย"]},
     {"title":"ทดสอบและนำเสนอ","children":["บันทึกผลทดสอบ","ปรับปรุงแก้ไข","เขียนรายงาน","นำเสนองาน"]}]'::jsonb),
  (3, 'เทคโนโลยีเพิ่มมูลค่า',
   'เรียนรู้วิธีเพิ่มมูลค่าให้ผลิตภัณฑ์และเทคโนโลยี ทั้งการออกแบบ ฟังก์ชัน วัสดุ บรรจุภัณฑ์ และการตลาด พร้อมรู้จักและเคารพทรัพย์สินทางปัญญาประเภทต่าง ๆ',
   array[2, 3],
   array[
     'อธิบายแนวทางการเพิ่มมูลค่าให้กับเทคโนโลยีหรือผลิตภัณฑ์ได้',
     'จำแนกประเภทของทรัพย์สินทางปัญญาและยกตัวอย่างได้',
     'เสนอแนวทางเพิ่มมูลค่าผลงานของตนเอง โดยเคารพทรัพย์สินทางปัญญาได้'
   ],
   '[{"title":"การเพิ่มมูลค่า","children":["ออกแบบรูปลักษณ์","เพิ่มฟังก์ชัน","เลือกวัสดุ","บรรจุภัณฑ์","การตลาดและเล่าเรื่องแบรนด์"]},
     {"title":"ทรัพย์สินทางปัญญา","children":["ลิขสิทธิ์","สิทธิบัตร / อนุสิทธิบัตร","เครื่องหมายการค้า","ความลับทางการค้า","สิ่งบ่งชี้ทางภูมิศาสตร์"]},
     {"title":"นำไปใช้","children":["เพิ่มมูลค่าผลงานตนเอง","อ้างอิงและขออนุญาต"]}]'::jsonb)
) as v(no, title, description, indicators, objectives, mindmap)
where not exists (select 1 from public.units u where u.no = v.no);

-- ---------- C. แผนการสอน 20 คาบ ----------
-- ตัวช่วยสร้างขั้นตอนในคาบ 120 นาที (ใช้เฉพาะตอน seed)
create or replace function pg_temp.steps(p_warmup text[], p_summary text[], p_has_game boolean default true, p_has_exit boolean default true)
returns jsonb language sql immutable as $$
  select jsonb_agg(s order by ord) from (
    select 1 ord, jsonb_build_object('key','warmup','label','อุ่นเครื่อง / ทบทวน','minutes',10,'items',to_jsonb(p_warmup)) s
    union all select 2, jsonb_build_object('key','content','label','เนื้อหา','minutes',30)
    union all select 3, jsonb_build_object('key','game','label','เกม','minutes',20) where p_has_game
    union all select 4, jsonb_build_object('key','work','label','งาน / กิจกรรม','minutes',
                          45 + case when p_has_game then 0 else 20 end + case when p_has_exit then 0 else 10 end)
    union all select 5, jsonb_build_object('key','exit','label','Exit ticket','minutes',10) where p_has_exit
    union all select 6, jsonb_build_object('key','summary','label','สรุป','minutes',5,'items',to_jsonb(p_summary))
  ) t
$$;

insert into public.class_sessions (session_no, unit_id, title, summary, work_label, game_slug, steps)
select v.no, (select id from public.units u where u.no = v.unit_no), v.title, v.summary, v.work, v.game, v.steps
from (values
  (1, null::int, 'ปฐมนิเทศ ข้อตกลง และวิธีใช้เว็บ',
   'รู้จักรายวิชา ข้อตกลงในห้องเรียน วิธีใช้เว็บห้องเรียน และทำแบบทดสอบก่อนเรียน (ไม่คิดคะแนน)',
   'สอบก่อนเรียน (ไม่คิดคะแนน)', 'warmup',
   pg_temp.steps(array['เทคโนโลยีที่เราใช้ทุกวันมีอะไรบ้าง?','ถ้าออกแบบของใช้ได้ 1 อย่าง อยากออกแบบอะไร?'],
                 array['รู้ข้อตกลงและเกณฑ์คะแนนของวิชา','เข้าใช้เว็บ ส่งงาน และเล่นเกมได้'])),
  (2, 1, '1.1 เครือข่ายไร้สายยุคที่ 5 (5G)',
   'วิวัฒนาการ 1G → 5G, IoT, Smart City และปัจจัยที่ทำให้เทคโนโลยีเปลี่ยนแปลง',
   'กิจกรรม 1.1 ไทม์ไลน์เทคโนโลยี (3 คะแนน)', '5g-time-machine',
   pg_temp.steps(array['โทรศัพท์ของพ่อแม่ตอนเด็ก ๆ ทำอะไรได้บ้าง?','ทำไมดูคลิปบนมือถือทุกวันนี้ถึงไม่ค่อยกระตุก?'],
                 array['แต่ละยุคของเครือข่ายเพิ่มความสามารถใหม่','5G เร็ว หน่วงต่ำ เชื่อมต่ออุปกรณ์ได้จำนวนมาก','ความต้องการและความรู้วิทยาศาสตร์ผลักดันให้เทคโนโลยีเปลี่ยน'])),
  (3, 1, '1.2 รถยนต์ไฟฟ้า',
   'ประเภท HEV / PHEV / BEV / FCEV, แบตเตอรี่, สถานีชาร์จ, ข้อดี-ข้อจำกัด และความเชื่อมโยงกับวิทยาศาสตร์-คณิตศาสตร์',
   'กิจกรรม 1.2 ยากแค่ไหนกว่าจะได้ใช้รถยนต์ (3 คะแนน)', 'ev-garage',
   pg_temp.steps(array['เคยเห็นรถที่มีป้ายทะเบียนสีฟ้าไหม? ต่างจากรถทั่วไปอย่างไร?','ทำไมหลายประเทศสนับสนุนรถยนต์ไฟฟ้า?'],
                 array['รถยนต์ไฟฟ้ามี 4 ประเภทหลักตามแหล่งพลังงาน','ใช้ความรู้เรื่องพลังงานไฟฟ้า-เคมีและการคำนวณ','มีทั้งข้อดีและข้อจำกัดที่ต้องพิจารณา'])),
  (4, 1, '1.3 การจัดการโลจิสติกส์',
   'การขนส่ง คลังสินค้า บรรจุภัณฑ์ และเทคโนโลยี Barcode / QR / RFID / GPS',
   'ใบงานวิเคราะห์ระบบส่งของ (3 คะแนน)', 'logistics-rush',
   pg_temp.steps(array['สั่งของออนไลน์แล้ว ของเดินทางมาถึงบ้านเราอย่างไร?','รู้ได้อย่างไรว่าพัสดุอยู่ที่ไหนแล้ว?'],
                 array['โลจิสติกส์ = การจัดการการไหลของสินค้าและข้อมูล','เทคโนโลยีช่วยให้ติดตาม ตรวจนับ และขนส่งได้แม่นยำขึ้น'])),
  (5, 1, 'กิจกรรมท้าทายความคิด "ข้าวมันไก่แสนอร่อย"',
   'ทำงานกลุ่ม วิเคราะห์เทคโนโลยีที่อยู่เบื้องหลังอาหารหนึ่งจาน ตั้งแต่วัตถุดิบจนถึงมือลูกค้า',
   'ชิ้นงานกลุ่ม (2 คะแนน)', null,
   pg_temp.steps(array['ข้าวมันไก่ 1 จาน ต้องใช้วัตถุดิบอะไรบ้าง มาจากไหน?'],
                 array['อาหารหนึ่งจานเกี่ยวข้องกับเทคโนโลยีหลายอย่าง','การทำงานกลุ่มต้องแบ่งหน้าที่และสื่อสารกัน'], false)),
  (6, 1, 'กิจกรรมท้ายบท + ทดสอบท้ายหน่วยที่ 1',
   'สรุปความรู้หน่วยที่ 1 ผ่านกิจกรรม "เทคโนโลยีเปลี่ยนโลก" และทำแบบทดสอบท้ายหน่วย',
   'กิจกรรมท้ายบท (2 คะแนน) / ทดสอบท้ายหน่วยที่ 1 (5 คะแนน)', 'boss-unit-1',
   pg_temp.steps(array['เทคโนโลยีไหนในหน่วยนี้ที่คิดว่าจะเปลี่ยนชีวิตเรามากที่สุด เพราะอะไร?'],
                 array['ทบทวนปัจจัยที่ทำให้เทคโนโลยีเปลี่ยนแปลง','เตรียมพร้อมเข้าสู่หน่วยที่ 2'])),
  (7, 2, '2.1 เทคโนโลยีแก้ปัญหาในอาชีพ + กระบวนการออกแบบเชิงวิศวกรรม',
   'ตัวอย่างการใช้เทคโนโลยีแก้ปัญหาในอาชีพ และกระบวนการออกแบบเชิงวิศวกรรม 6 ขั้น',
   'ใบงานกรณีศึกษาอาชีพ (2 คะแนน)', 'process-puzzle',
   pg_temp.steps(array['คนในครอบครัวเราทำอาชีพอะไร มีปัญหาอะไรในการทำงานบ้าง?'],
                 array['ทุกอาชีพใช้เทคโนโลยีแก้ปัญหาได้','กระบวนการออกแบบเชิงวิศวกรรมมี 6 ขั้น และวนกลับไปปรับปรุงได้'])),
  (8, 2, '2.2 การระบุปัญหา',
   'การสัมภาษณ์ การใช้ 5W1H และการสรุปกรอบของปัญหา (กิจกรรม 2.1–2.2)',
   'แบบบันทึกสัมภาษณ์ชุมชน (2 คะแนน)', 'problem-detective',
   pg_temp.steps(array['ในชุมชนหรือโรงเรียนของเรามีปัญหาอะไรที่อยากแก้?','ถ้าจะถามคนอื่นเรื่องปัญหา ควรถามอย่างไร?'],
                 array['ปัญหาที่ดีต้องระบุได้ชัดว่าใคร อะไร ที่ไหน เมื่อไร ทำไม อย่างไร','กรอบของปัญหาช่วยกำหนดขอบเขตและเงื่อนไขของงาน'])),
  (9, 2, '2.3 การรวบรวมข้อมูลและคัดเลือกแนวคิด',
   'แหล่งข้อมูล การระดมสมอง ตารางเปรียบเทียบแนวคิด และทรัพย์สินทางปัญญาของข้อมูล (กิจกรรม 2.3)',
   'กิจกรรม 2.3 หาทางแก้ปัญหา (2 คะแนน)', 'idea-picker',
   pg_temp.steps(array['ถ้าต้องหาข้อมูลเรื่องที่ไม่รู้ จะหาจากที่ไหนบ้าง?','รู้ได้อย่างไรว่าข้อมูลบนอินเทอร์เน็ตน่าเชื่อถือ?'],
                 array['ใช้ข้อมูลจากหลายแหล่งและตรวจความน่าเชื่อถือ','เลือกแนวคิดด้วยเกณฑ์ ไม่ใช่ความชอบอย่างเดียว','อ้างอิงแหล่งที่มาทุกครั้ง'])),
  (10, null, 'ทบทวน + สอบกลางภาค',
   'ทบทวนหน่วยที่ 1 และหน่วยที่ 2 (เรื่อง 2.1–2.3) แล้วสอบกลางภาค',
   'สอบกลางภาค (20 คะแนน)', null,
   pg_temp.steps(array['หัวข้อไหนที่ยังไม่มั่นใจที่สุด?'],
                 array['ตรวจคำตอบให้ครบก่อนส่ง','ดูผลและเฉลยเมื่อครูเปิดให้ดู'], false, false)),
  (11, 2, '2.4 การออกแบบแนวคิด',
   'ร่างภาพ แผนภาพ วางแผนขั้นตอน และเลือกวัสดุ-อุปกรณ์ (กิจกรรม 2.4 มาออกแบบกันเถอะ)',
   'แบบร่างชิ้นงาน (3 คะแนน)', 'blueprint-builder',
   pg_temp.steps(array['ก่อนสร้างบ้าน ช่างต้องมีอะไรก่อน?','ภาพร่างที่ดีควรมีข้อมูลอะไรบ้าง?'],
                 array['ภาพร่างและแผนภาพช่วยสื่อสารแนวคิดให้คนอื่นเข้าใจ','วางแผนขั้นตอนและเลือกวัสดุให้เหมาะกับงาน'])),
  (12, 2, 'ลงมือทำ (กิจกรรม 2.5) และความปลอดภัยในการใช้เครื่องมือ',
   'เริ่มสร้างชิ้นงานตามแผน และฝึกใช้เครื่องมือ-อุปกรณ์อย่างถูกต้องและปลอดภัย',
   'บันทึกความก้าวหน้าโครงงาน (ส่วนหนึ่งของคะแนนโครงงาน)', 'safety-check',
   pg_temp.steps(array['เครื่องมือชิ้นไหนในห้องปฏิบัติการที่อันตรายที่สุด เพราะอะไร?'],
                 array['ใช้เครื่องมือให้ถูกประเภทงานและสวมอุปกรณ์ป้องกัน','บันทึกความก้าวหน้าทุกคาบ'])),
  (13, 2, 'ลงมือทำต่อ / สร้างต้นแบบ',
   'สร้างชิ้นงานต้นแบบต่อจากคาบที่แล้ว ถ่ายภาพความก้าวหน้า',
   'อัปโหลดภาพต้นแบบ (ส่วนหนึ่งของคะแนนโครงงาน)', null,
   pg_temp.steps(array['คาบที่แล้วทำถึงขั้นไหน มีปัญหาอะไรบ้าง?'],
                 array['ต้นแบบไม่จำเป็นต้องสมบูรณ์ แต่ต้องทดสอบได้','ถ่ายภาพเก็บหลักฐานทุกขั้น'], false)),
  (14, 2, '2.5 การทดสอบ ประเมินผล และปรับปรุงแก้ไข',
   'วางแผนการทดสอบ บันทึกผล วิเคราะห์ข้อบกพร่อง และปรับปรุงชิ้นงาน (กิจกรรม 2.6)',
   'ตารางบันทึกผลทดสอบ (ส่วนหนึ่งของคะแนนโครงงาน)', 'fix-the-bug',
   pg_temp.steps(array['ถ้าชิ้นงานใช้ไม่ได้ในครั้งแรก แปลว่าล้มเหลวหรือไม่?'],
                 array['ทดสอบตามเกณฑ์ที่ตั้งไว้และบันทึกผลจริง','หาสาเหตุของข้อบกพร่องแล้วปรับปรุง'])),
  (15, 2, '2.6 การเขียนรายงาน',
   'องค์ประกอบของรายงานโครงงานและการเขียนให้ชัดเจน (กิจกรรม 2.7)',
   'รายงานโครงงาน (ส่วนหนึ่งของคะแนนโครงงาน)', 'report-order',
   pg_temp.steps(array['รายงานที่อ่านแล้วเข้าใจง่ายมีลักษณะอย่างไร?'],
                 array['รายงานมีโครงสร้างชัดเจน','อ้างอิงแหล่งข้อมูลในบรรณานุกรม'])),
  (16, 2, '2.7 การนำเสนองาน + ทดสอบท้ายหน่วยที่ 2',
   'นำเสนอผลงานโครงงาน และทำแบบทดสอบท้ายหน่วยที่ 2',
   'โครงงานรวม (15 คะแนน) / ทดสอบท้ายหน่วยที่ 2 (5 คะแนน)', 'boss-unit-2',
   pg_temp.steps(array['การนำเสนอที่ประทับใจที่สุดที่เคยดูเป็นอย่างไร?'],
                 array['นำเสนอให้ครบ: ปัญหา วิธีแก้ ผลทดสอบ การปรับปรุง','รับฟังข้อเสนอแนะเพื่อพัฒนาต่อ'])),
  (17, 3, '3.1 การเพิ่มมูลค่าเทคโนโลยี',
   'เพิ่มมูลค่าด้วยการออกแบบ ฟังก์ชัน วัสดุ บรรจุภัณฑ์ และการตลาด (กิจกรรม 3.1)',
   'กิจกรรม 3.1 เพิ่มมูลค่าให้กับเทคโนโลยี (3 คะแนน)', 'value-up-shop',
   pg_temp.steps(array['ทำไมสินค้าชนิดเดียวกันถึงขายราคาต่างกันมาก?'],
                 array['มูลค่าเพิ่มได้จากหลายด้าน ไม่ใช่แค่ลดต้นทุน','ต้องคำนึงถึงผู้ใช้และสิ่งแวดล้อม'])),
  (18, 3, '3.2 เปิดโลกทรัพย์สินทางปัญญา',
   'ลิขสิทธิ์ สิทธิบัตร อนุสิทธิบัตร เครื่องหมายการค้า ความลับทางการค้า สิ่งบ่งชี้ทางภูมิศาสตร์ (กิจกรรม 3.2)',
   'กิจกรรม 3.2 ช่วยนนท์และน้ำหวานจัดประเภททรัพย์สินทางปัญญา (3 คะแนน)', 'ip-hunter',
   pg_temp.steps(array['เอาเพลงคนอื่นมาใส่คลิปของเราได้ไหม?','โลโก้ร้านค้าคุ้มครองอย่างไร?'],
                 array['ทรัพย์สินทางปัญญามีหลายประเภท คุ้มครองต่างกัน','เคารพสิทธิ์: อ้างอิง ขออนุญาต หรือใช้งานที่เปิดให้ใช้'])),
  (19, 3, 'กิจกรรมท้ายบท "เพิ่มมูลค่าผลงานตนเอง" + ทดสอบท้ายหน่วยที่ 3',
   'นำโครงงานของตนเองมาวางแผนเพิ่มมูลค่า และทำแบบทดสอบท้ายหน่วยที่ 3',
   'กิจกรรมท้ายบท (2 คะแนน) / ทดสอบท้ายหน่วยที่ 3 (5 คะแนน)', 'boss-unit-3',
   pg_temp.steps(array['ชิ้นงานของเราจะขายได้ไหม ถ้าจะขายต้องปรับอะไร?'],
                 array['วางแผนเพิ่มมูลค่าผลงานตัวเองได้','รู้ว่าผลงานของเราคุ้มครองด้วยทรัพย์สินทางปัญญาประเภทใด'])),
  (20, null, 'ทบทวน + สอบปลายภาค + สอบหลังเรียน',
   'ทบทวนทุกหน่วยด้วย Final Quest สอบปลายภาค และทำแบบทดสอบหลังเรียนเพื่อเทียบพัฒนาการ',
   'สอบปลายภาค (20 คะแนน) / สอบหลังเรียน', 'final-quest',
   pg_temp.steps(array['ตลอดเทอมนี้ เรื่องไหนที่ชอบที่สุด?'],
                 array['เปรียบเทียบผลสอบก่อนเรียนและหลังเรียน','ภูมิใจกับพัฒนาการของตัวเอง'], true, false))
) as v(no, unit_no, title, summary, work, game, steps)
on conflict (session_no) do nothing;

-- ---------- D. เนื้อหาบทเรียนฉบับร่าง ----------
-- รูปแบบเนื้อหา (Markdown):
--   "## หัวข้อ"            = การ์ด/สไลด์ 1 ใบ
--   ":::tip ... :::"       = กล่อง "เกร็ดน่ารู้"
--   ":::doctor ... :::"    = กล่อง "ด็อกเตอร์อธิบาย"
--   ":::embed URL"         = ฝังวิดีโอ YouTube หรือ Canva

insert into public.lessons (unit_id, session_no, title, content_md, sort_order, est_minutes)
select cs.unit_id, v.no, v.title, v.md, 1, 30
from (values
(1, 'ยินดีต้อนรับสู่ห้องเรียนนักออกแบบ', $md$
## วิชานี้เรียนอะไร?
วิชาเทคโนโลยี (การออกแบบและเทคโนโลยี) ม.3 ชวนเรา **ใช้เทคโนโลยีแก้ปัญหาจริง** ตลอดเทอมเราจะเรียน 3 หน่วย

- **หน่วยที่ 1 เทคโนโลยีเปลี่ยนโลก** — 5G รถยนต์ไฟฟ้า โลจิสติกส์
- **หน่วยที่ 2 เทคโนโลยีแก้ปัญหา** — ทำโครงงานด้วยกระบวนการออกแบบเชิงวิศวกรรม
- **หน่วยที่ 3 เทคโนโลยีเพิ่มมูลค่า** — เพิ่มมูลค่าผลงาน และทรัพย์สินทางปัญญา

## หนึ่งคาบเรียนมีอะไรบ้าง
ทุกคาบ 2 ชั่วโมง มี 6 ขั้นตอน ดูได้จากแถบด้านบนของหน้าคาบเรียน

1. อุ่นเครื่อง / ทบทวน
2. เนื้อหา
3. เกม
4. งาน / กิจกรรม (มีคะแนนเก็บ)
5. Exit ticket 5 ข้อ
6. สรุป

## คะแนนและ XP
| ประเภท | คะแนน |
| --- | --- |
| งาน/ใบกิจกรรมรายคาบ | 30 |
| โครงงานหน่วยที่ 2 | 15 |
| ทดสอบท้ายหน่วย 1–3 | 15 |
| สอบกลางภาค | 20 |
| สอบปลายภาค | 20 |

นอกจากคะแนน ยังมี **XP เลเวล และเหรียญ** จากการเล่นเกม ส่งงานตรงเวลา และเข้าเรียน

:::tip
ทุก 200 XP จะเลื่อนเลเวล จาก นักสำรวจ → นักคิด → นักออกแบบ → นักประดิษฐ์ → วิศวกรน้อย → นวัตกร
:::

## ข้อตกลงในห้องเรียน
- ใช้รหัสนักเรียนของตัวเองเท่านั้น ห้ามให้เพื่อนยืม
- ส่งงานตามกำหนด ถ้าส่งช้าอาจถูกหักคะแนน
- ใช้เครื่องมือและอุปกรณ์อย่างปลอดภัย
- เคารพผลงานของคนอื่น อ้างอิงทุกครั้งที่นำมาใช้

:::doctor
สวัสดีนักออกแบบรุ่นใหม่! ผมคือด็อกเตอร์ จะคอยอธิบายเพิ่มเติมตลอดเทอม ส่วนน้ำหวานกับนนท์เป็นเพื่อน ม.3 ที่จะเรียนไปพร้อมกับเรา
:::
$md$),

(2, 'เครือข่ายไร้สายยุคที่ 5 (5G)', $md$
## เริ่มจากมือถือในมือเรา
วันนี้เราใช้มือถือทำอะไรไปแล้วบ้าง? ดูคลิปสั้น เล่นเกมออนไลน์ วิดีโอคอลกับเพื่อน สแกนจ่ายเงิน ดูตำแหน่งรถเมล์…
ทุกอย่างนี้ต้องพึ่ง **เครือข่ายไร้สาย** ที่ส่งข้อมูลผ่านคลื่นวิทยุ

:::think
ลองเรียงกิจกรรมเหล่านี้จาก "ใช้อินเทอร์เน็ตน้อย" ไป "ใช้มาก": ส่งข้อความแชท · ดูไลฟ์สดคอนเสิร์ต · โหลดเกมใหม่ 5 GB · ฟังเพลงสตรีมมิง
---
แชท < ฟังเพลง < ดูไลฟ์สด < โหลดเกม 5 GB
ข้อความใช้ข้อมูลน้อยมาก แต่วิดีโอความละเอียดสูงและไฟล์ใหญ่ต้องใช้ความเร็วสูง ความต้องการแบบนี้คือแรงผลักดันให้เครือข่ายพัฒนาจาก 1G มาถึง 5G
:::

## จาก 1G สู่ 5G
| ยุค | ช่วงเวลาโดยประมาณ | ทำอะไรได้ | เปรียบเทียบให้เห็นภาพ |
| --- | --- | --- | --- |
| 1G | ทศวรรษ 1980 | โทรคุยด้วยเสียงแบบแอนะล็อก | เหมือนวิทยุสื่อสาร เสียงซ่า ดักฟังง่าย |
| 2G | ทศวรรษ 1990 | สัญญาณดิจิทัล ส่ง SMS | ส่งได้แค่ตัวหนังสือสั้น ๆ |
| 3G | ทศวรรษ 2000 | อินเทอร์เน็ตบนมือถือ วิดีโอคอลยุคแรก | เปิดเว็บได้แต่ช้า ภาพกระตุก |
| 4G | ทศวรรษ 2010 | อินเทอร์เน็ตเร็ว ดูวิดีโอ HD เรียกรถผ่านแอป | ยุคแอปส่งอาหาร ไลฟ์ขายของ |
| 5G | ทศวรรษ 2020 | เร็วมาก หน่วงต่ำ เชื่อมอุปกรณ์มหาศาล | เครื่องจักร รถ และเมืองคุยกันเองได้ |

:::example
ตอนพ่อแม่เป็นวัยรุ่น การส่ง SMS หนึ่งข้อความต้องจ่ายเงินทีละข้อความ และพิมพ์ได้จำกัดตัวอักษร ทุกวันนี้เราส่งรูป วิดีโอ และสติกเกอร์ได้ไม่จำกัดผ่านแอปแชท นี่คือผลของเครือข่ายที่เร็วขึ้นหลายยุค
:::

## 5G เก่ง 3 ด้าน
| ความสามารถ | ชื่อทางเทคนิค | เปรียบเทียบ | ตัวอย่างการใช้ |
| --- | --- | --- | --- |
| **เร็วมาก** | eMBB | ถนนที่ขยายจาก 2 เลนเป็น 20 เลน | ดูวิดีโอ 4K ไลฟ์กีฬา เกมบนคลาวด์ |
| **หน่วงต่ำมาก** | URLLC | รถพยาบาลได้ไฟเขียวทุกแยก | รถไร้คนขับ แขนกลในโรงงาน ผ่าตัดทางไกล |
| **เชื่อมได้จำนวนมาก** | mMTC | ลานจอดรถที่จอดได้เป็นล้านคัน | เซนเซอร์ IoT ในฟาร์ม เมือง และโรงงาน |

:::doctor
5G ไม่ได้แค่ทำให้ "ดูคลิปเร็วขึ้น" ความสามารถที่สำคัญที่สุดสำหรับอนาคตคือ **ความหน่วงต่ำ** และ **เชื่อมอุปกรณ์จำนวนมาก** เพราะทำให้เครื่องจักรสื่อสารกันเองได้ทันที
:::

## ความหน่วง (Latency) สำคัญแค่ไหน — ใช้คณิตศาสตร์หาคำตอบ
**ความหน่วง** คือเวลาที่ข้อมูลใช้เดินทางไป-กลับ หน่วยเป็นมิลลิวินาที (ms) โดย 1,000 ms = 1 วินาที

รถยนต์ที่วิ่ง 60 กิโลเมตรต่อชั่วโมง เคลื่อนที่ได้ประมาณ 60,000 ÷ 3,600 ≈ **16.7 เมตรต่อวินาที**

:::think
ถ้ารถไร้คนขับรอคำสั่ง "เบรก" ผ่านเครือข่าย
- เครือข่ายหน่วง 100 ms (0.1 วินาที) รถจะวิ่งไปอีกกี่เมตรก่อนได้รับคำสั่ง?
- ถ้าหน่วงแค่ 5 ms (0.005 วินาที) ล่ะ?
---
- 16.7 × 0.1 ≈ **1.67 เมตร** ซึ่งพอจะชนคนข้างหน้าได้
- 16.7 × 0.005 ≈ **0.08 เมตร (8 เซนติเมตร)** ซึ่งปลอดภัยกว่ามาก

นี่คือเหตุผลที่งานที่ต้องตอบสนองทันทีต้องการเครือข่ายหน่วงต่ำ และเป็นตัวอย่างที่ **คณิตศาสตร์** ช่วยตัดสินใจเรื่องเทคโนโลยี
:::

## 5G ในชีวิตจริงทุกวันนี้
- **เน็ตบ้านผ่าน 5G** บ้านที่ลากสายไฟเบอร์ไปไม่ถึงใช้กล่องรับสัญญาณ 5G แทนได้
- **ไลฟ์สดและกีฬา** ถ่ายทอดสดหลายมุมกล้องพร้อมกันจากสนาม
- **โรงพยาบาล** รถพยาบาลส่งข้อมูลผู้ป่วยและภาพวิดีโอให้แพทย์ดูก่อนถึงโรงพยาบาล หลายแห่งในไทยทดลองใช้แล้ว
- **โรงงานและท่าเรือ** หุ่นยนต์ รถยก และเครนควบคุมผ่านเครือข่ายไร้สาย
- **เกษตร** เซนเซอร์วัดความชื้นดิน โดรนสำรวจแปลง

:::example
ในงานคอนเสิร์ตหรือฟุตบอลที่มีคนหลายหมื่นคน ทุกคนถ่ายรูปและไลฟ์พร้อมกัน เครือข่ายรุ่นเก่ามักเน็ตหลุด แต่ 5G รองรับผู้ใช้จำนวนมากในพื้นที่เดียวได้ดีกว่า
:::

## IoT และเมืองอัจฉริยะ
**IoT (Internet of Things)** คือการเชื่อมสิ่งของเข้ากับอินเทอร์เน็ต ให้ส่งข้อมูลและรับคำสั่งได้

| สิ่งของ | ส่งข้อมูลอะไร | ช่วยอะไร |
| --- | --- | --- |
| เซนเซอร์คุณภาพอากาศ | ค่าฝุ่น PM2.5 | เตือนประชาชนผ่านแอป |
| ไฟถนนอัจฉริยะ | มีคนหรือรถผ่านไหม | หรี่ไฟเมื่อไม่มีคน ประหยัดไฟ |
| ถังขยะอัจฉริยะ | ขยะเต็มหรือยัง | รถเก็บขยะวิ่งเฉพาะจุดที่เต็ม |
| มิเตอร์น้ำ-ไฟอัจฉริยะ | ปริมาณที่ใช้ | ตรวจจับน้ำรั่ว ไม่ต้องจดมือ |

**Smart City** คือการนำข้อมูลจาก IoT มาบริหารเมือง หลายจังหวัดในไทยกำลังพัฒนาเป็นเมืองอัจฉริยะ

:::think
ถ้าจะทำ "โรงเรียนอัจฉริยะ" นักเรียนจะติดเซนเซอร์อะไร ไว้ที่ไหน เพื่อแก้ปัญหาอะไร (คิดมา 2 อย่าง)
---
ตัวอย่างแนวคิด
- เซนเซอร์ฝุ่นที่สนาม แจ้งให้งดกิจกรรมกลางแจ้งเมื่อค่าฝุ่นสูง
- เซนเซอร์วัดระดับน้ำในถังน้ำดื่ม แจ้งแม่บ้านเมื่อใกล้หมด
- เซนเซอร์ตรวจจับคนในห้องเรียน ปิดแอร์/ไฟอัตโนมัติเมื่อไม่มีคน

คำตอบที่ดีต้องบอกได้ว่า **ปัญหาคืออะไร** และ **ข้อมูลที่ได้นำไปใช้ทำอะไร**
:::

## ก้าวต่อไป: 5G-Advanced และ 6G
- **5G-Advanced** คือการพัฒนา 5G ให้ฉลาดขึ้น ใช้ AI ช่วยจัดการเครือข่าย และประหยัดพลังงานขึ้น
- **6G** อยู่ระหว่างวิจัย คาดว่าจะเริ่มใช้ราวปี 2030 เป้าหมายคือเร็วและหน่วงต่ำยิ่งขึ้น เชื่อมกับ AI และดาวเทียม
- **ดาวเทียมวงโคจรต่ำ** เริ่มให้บริการอินเทอร์เน็ตในพื้นที่ห่างไกล บางรุ่นส่งข้อความถึงมือถือได้โดยตรงเมื่อไม่มีเสาสัญญาณ

:::tip
ข้อมูลเทคโนโลยีเปลี่ยนเร็วมาก ตัวเลขและปีในหัวข้อนี้เป็นการคาดการณ์ ควรตรวจสอบข่าวล่าสุดจากหน่วยงานที่เชื่อถือได้
:::

## อะไรทำให้เทคโนโลยีเปลี่ยนแปลง? (ดูจาก 5G)
| ปัจจัย | ตัวอย่างที่ทำให้เกิด 5G |
| --- | --- |
| **ความต้องการของมนุษย์** | อยากดูวิดีโอคมชัด ทำงานและเรียนออนไลน์ |
| **ความรู้วิทยาศาสตร์** | ความรู้เรื่องคลื่นแม่เหล็กไฟฟ้า เสาอากาศหลายต้น (Massive MIMO) |
| **คณิตศาสตร์** | วิธีเข้ารหัสและบีบอัดข้อมูลให้ส่งได้มากขึ้น |
| **เศรษฐกิจ** | ธุรกิจแข่งกันให้บริการที่ดีกว่า โรงงานอยากลดต้นทุน |
| **สังคม** | วิถีชีวิตออนไลน์ การซื้อของและจ่ายเงินผ่านมือถือ |
| **นโยบายรัฐ** | การจัดสรรคลื่นความถี่ การส่งเสริมเมืองอัจฉริยะ |

:::think
ช่วงที่โรงเรียนต้องเรียนออนไลน์เพราะโรคระบาด เป็นปัจจัยด้านใด และส่งผลต่อเทคโนโลยีการสื่อสารอย่างไร
---
เป็นปัจจัยด้าน **สังคม** และ **ความต้องการของมนุษย์** คนใช้วิดีโอคอลและแพลตฟอร์มเรียนออนไลน์มากขึ้นทันที ผู้ให้บริการต้องเร่งขยายเครือข่าย และบริษัทต่าง ๆ พัฒนาแอปประชุมออนไลน์อย่างรวดเร็ว
:::

## ผลกระทบที่ต้องคิดให้รอบ
- **ความเป็นส่วนตัว** อุปกรณ์ IoT เก็บข้อมูลชีวิตเรา ต้องตั้งรหัสผ่านและอัปเดตซอฟต์แวร์
- **ช่องว่างดิจิทัล** พื้นที่ห่างไกลยังเข้าไม่ถึงเครือข่ายเร็ว
- **ข่าวลือ** เช่น "5G ทำให้ป่วย" คลื่น 5G เป็นคลื่นวิทยุชนิดที่ไม่ทำลายเซลล์ และต้องผ่านมาตรฐานความปลอดภัย

:::think
เพื่อนส่งข่าวมาว่า "เสา 5G แพร่เชื้อโรค" นักเรียนจะตรวจสอบอย่างไร
---
ดูว่าใครเป็นผู้เผยแพร่ มีหลักฐานทางวิทยาศาสตร์หรือไม่ เทียบกับหน่วยงานด้านสาธารณสุขหรือกำกับดูแลการสื่อสาร และใช้ความรู้วิทยาศาสตร์: **คลื่นวิทยุไม่สามารถพาเชื้อโรคไปได้** เชื้อโรคแพร่ผ่านละอองหรือการสัมผัส
:::
$md$),

(3, 'รถยนต์ไฟฟ้า', $md$
## รถไฟฟ้าบนถนนไทยวันนี้
ไม่กี่ปีมานี้เราเห็นรถยนต์ไฟฟ้าบนถนนมากขึ้น ทั้งรถยนต์ส่วนตัว แท็กซี่ รถเมล์ มอเตอร์ไซค์ส่งอาหาร และเรือโดยสารไฟฟ้า หลายบริษัทเข้ามาตั้งโรงงานผลิตในประเทศไทย และรัฐมีนโยบายส่งเสริมให้ไทยเป็นฐานผลิตยานยนต์ไฟฟ้า

:::think
นักเรียนเคยนั่งหรือเห็นยานพาหนะไฟฟ้าแบบไหนบ้าง สังเกตเห็นอะไรที่ต่างจากรถน้ำมัน
---
ตัวอย่างที่สังเกตได้: เสียงเงียบมาก ไม่มีควันท่อไอเสีย ออกตัวแรงและนุ่ม ต้องจอดชาร์จแทนเติมน้ำมัน บางคันไม่มีกระจังหน้าเพราะไม่ต้องระบายความร้อนเครื่องยนต์
:::

## รถยนต์ไฟฟ้า 4 ประเภท
| ประเภท | แหล่งพลังงาน | เสียบชาร์จได้? | เหมาะกับใคร |
| --- | --- | --- | --- |
| **HEV** ไฮบริด | เครื่องยนต์ + มอเตอร์ แบตเล็ก ชาร์จจากเครื่องยนต์และการเบรก | ไม่ได้ | อยากประหยัดน้ำมัน แต่ไม่มีที่ชาร์จ |
| **PHEV** ปลั๊กอินไฮบริด | เครื่องยนต์ + มอเตอร์ แบตใหญ่ขึ้น | ได้ | ใช้ไฟในเมือง ใช้น้ำมันเมื่อเดินทางไกล |
| **BEV** ไฟฟ้าล้วน | แบตเตอรี่ + มอเตอร์เท่านั้น | ได้ | มีที่ชาร์จที่บ้านหรือที่ทำงาน |
| **FCEV** เซลล์เชื้อเพลิง | ไฮโดรเจนผลิตไฟฟ้าในรถ ปล่อยไอน้ำ | เติมไฮโดรเจน | ยังมีน้อย สถานีเติมหายาก |

:::example
**4 ครอบครัว 4 ทางเลือก**
- ครอบครัว A อยู่คอนโด ไม่มีที่ชาร์จ → **HEV**
- ครอบครัว B ขับในเมืองวันละ 30 กม. แต่กลับต่างจังหวัดบ่อย → **PHEV**
- ครอบครัว C มีบ้าน ติดตั้งเครื่องชาร์จได้ ขับในเมือง → **BEV**
- บริษัทรถบรรทุกที่ทดลองพลังงานสะอาดระยะไกล → อาจสนใจ **FCEV** ในอนาคต
:::

:::think
ครูขับรถวันละ 60 กม. บ้านติดแผงโซลาร์เซลล์และติดตั้งเครื่องชาร์จได้ ควรเลือกประเภทใด เพราะอะไร
---
**BEV** เหมาะที่สุด ระยะทางต่อวันไม่มาก ชาร์จที่บ้านได้ทุกคืน และใช้ไฟจากโซลาร์เซลล์ช่วยลดค่าใช้จ่าย ถ้าต้องขับทางไกลบ่อยและกังวลเรื่องสถานีชาร์จ PHEV ก็เป็นทางเลือกได้
:::

## รถไฟฟ้าทำงานอย่างไร (วิทยาศาสตร์เบื้องหลัง)
**แบตเตอรี่** (พลังงานเคมี) → **อินเวอร์เตอร์** แปลงไฟกระแสตรงเป็นกระแสสลับ → **มอเตอร์** (พลังงานไฟฟ้า → พลังงานกล) → **ล้อหมุน**

- มอเตอร์ทำงานด้วย **แม่เหล็กไฟฟ้า** กระแสไฟสร้างสนามแม่เหล็กที่ผลักและดูดให้แกนหมุน
- **เบรกแบบคืนพลังงาน (Regenerative braking)** ตอนชะลอ มอเตอร์กลับทำหน้าที่เป็นเครื่องกำเนิดไฟฟ้า เก็บพลังงานกลับเข้าแบต

:::doctor
รถน้ำมันเปลี่ยนพลังงานเป็นงานที่ล้อได้ราว 1 ใน 3 ที่เหลือกลายเป็นความร้อน ส่วนมอเตอร์ไฟฟ้ามีประสิทธิภาพสูงกว่ามาก พลังงานส่วนใหญ่จึงไปหมุนล้อได้จริง นี่คือเหตุผลหนึ่งที่ค่าพลังงานต่อกิโลเมตรของรถไฟฟ้าถูกกว่า
:::

## แบตเตอรี่: หัวใจของรถไฟฟ้า
- ความจุวัดเป็น **kWh (กิโลวัตต์-ชั่วโมง)** ยิ่งมากยิ่งวิ่งได้ไกล
- ชนิดที่ใช้มากคือ **ลิเทียมไอออน** มีหลายสูตร เช่น สูตรที่ทนความร้อนและอายุยาว ราคาถูกลง ซึ่งรถรุ่นใหม่ใช้กันมากขึ้น
- งานวิจัยใหม่ ๆ เช่น **แบตโซเดียมไอออน** (ใช้วัตถุดิบหาง่ายกว่า) และ **แบตโซลิดสเตต** (คาดว่าจะชาร์จเร็วและปลอดภัยขึ้น)
- **ชีวิตที่สองของแบต** แบตรถที่เสื่อมแล้วนำไปเก็บพลังงานโซลาร์ในบ้านหรืออาคารได้ ก่อนเข้าสู่การรีไซเคิล

:::think
ทำไมการรีไซเคิลแบตเตอรี่รถไฟฟ้าจึงสำคัญ ทั้งด้านสิ่งแวดล้อมและเศรษฐกิจ
---
- **สิ่งแวดล้อม** แบตมีสารเคมีที่เป็นอันตรายถ้าทิ้งไม่ถูกวิธี
- **เศรษฐกิจ** แบตมีโลหะมีค่า (เช่น ลิเทียม นิกเกิล โคบอลต์) นำกลับมาใช้ใหม่ลดการทำเหมืองและลดต้นทุน
:::

## ชาร์จนานแค่ไหน — คำนวณได้
**เวลาชาร์จ (ชั่วโมง) ≈ พลังงานที่ต้องเติม (kWh) ÷ กำลังเครื่องชาร์จ (kW)**

| เครื่องชาร์จ | กำลังโดยประมาณ | ที่พบบ่อย |
| --- | --- | --- |
| AC ที่บ้าน | 7 kW | ชาร์จข้ามคืน |
| DC ชาร์จเร็ว | 50–150 kW ขึ้นไป | ปั๊มน้ำมัน ห้าง จุดพักรถ |

:::think
แบตเตอรี่ 60 kWh เหลือ 10% ต้องการชาร์จถึง 80%
1. ต้องเติมพลังงานกี่ kWh
2. ใช้เครื่องชาร์จบ้าน 7 kW นานกี่ชั่วโมง
3. ใช้เครื่องชาร์จเร็ว 100 kW นานประมาณกี่นาที
---
1. ต้องเติม 70% ของ 60 = **42 kWh**
2. 42 ÷ 7 = **6 ชั่วโมง**
3. 42 ÷ 100 = 0.42 ชั่วโมง ≈ **25 นาที**

(ของจริงจะช้ากว่านี้เล็กน้อย เพราะเมื่อใกล้เต็ม ระบบจะชาร์จช้าลงเพื่อถนอมแบต จึงนิยมชาร์จเร็วถึงแค่ราว 80%)
:::

## เปรียบเทียบค่าใช้จ่าย (ตัวเลขสมมุติ)
สมมุติขับ **100 กิโลเมตร**
- **รถไฟฟ้า** ใช้ไฟ 15 kWh × ค่าไฟ 5 บาท = **75 บาท**
- **รถน้ำมัน** วิ่งได้ 15 กม./ลิตร ใช้ 100 ÷ 15 ≈ 6.7 ลิตร × น้ำมัน 38 บาท ≈ **253 บาท**

:::think
ถ้าขับปีละ 15,000 กม. รถไฟฟ้าประหยัดกว่ารถน้ำมันปีละประมาณเท่าไร (ใช้ตัวเลขข้างบน) และควรนำปัจจัยใดมาคิดเพิ่มก่อนตัดสินใจซื้อจริง
---
ส่วนต่างต่อ 100 กม. ≈ 253 − 75 = 178 บาท → 15,000 กม. = 150 × 178 ≈ **26,700 บาทต่อปี**

ปัจจัยที่ควรคิดเพิ่ม: ราคารถ ค่าติดตั้งเครื่องชาร์จ ค่าประกัน อายุแบต ราคาขายต่อ และสถานีชาร์จใกล้บ้าน
:::

## ข้อดี ข้อจำกัด และผลต่อสิ่งแวดล้อม
| ข้อดี | ข้อจำกัด |
| --- | --- |
| ไม่มีไอเสียจากท่อ ช่วยลดฝุ่นในเมือง | ราคาเริ่มต้นยังสูงกว่าในหลายรุ่น |
| ค่าพลังงานต่อกิโลเมตรต่ำ | สถานีชาร์จยังไม่ทั่วถึงทุกพื้นที่ |
| เงียบ ออกตัวดี บำรุงรักษาน้อย | ชาร์จนานกว่าเติมน้ำมัน |
| ใช้ไฟจากพลังงานสะอาดได้ | ต้องจัดการแบตเตอรี่เก่าอย่างถูกวิธี |

:::think
มีคนบอกว่า "รถไฟฟ้าไม่ได้สะอาดจริง เพราะไฟฟ้ายังผลิตจากโรงไฟฟ้า" นักเรียนเห็นด้วยแค่ไหน
---
ถูกบางส่วน ความสะอาดขึ้นกับ **แหล่งผลิตไฟฟ้า** ถ้าใช้ไฟจากพลังงานแสงอาทิตย์หรือลม จะสะอาดขึ้นมาก แต่แม้ใช้ไฟจากก๊าซธรรมชาติ รถไฟฟ้าก็ช่วย **ย้ายมลพิษออกจากถนนในเมือง** ซึ่งคนอยู่หนาแน่น และมอเตอร์ไฟฟ้ามีประสิทธิภาพสูงกว่าเครื่องยนต์
:::

## ไม่ใช่แค่รถยนต์
- **มอเตอร์ไซค์ไฟฟ้า + ตู้สลับแบตเตอรี่** ไรเดอร์เปลี่ยนแบตหมดเป็นแบตเต็มในไม่กี่นาที ไม่ต้องรอชาร์จ
- **รถเมล์ไฟฟ้า** วิ่งในกรุงเทพฯ และหลายเมือง
- **เรือโดยสารไฟฟ้า** ในแม่น้ำและคลอง ลดเสียงและควัน
- **รถตุ๊กตุ๊กไฟฟ้า** สำหรับท่องเที่ยว

:::example
ตู้สลับแบตเตอรี่เป็นตัวอย่างการ **แก้ปัญหาข้อจำกัด** ของรถไฟฟ้า ปัญหาคือ "ชาร์จนาน ไรเดอร์เสียเวลาทำงาน" ทางแก้คือ "ไม่ต้องรอชาร์จ แค่สลับแบต" นี่คือการคิดแบบนักออกแบบเทคโนโลยี
:::

## เชื่อมโยงวิทย์-คณิต และอาชีพใหม่
| ศาสตร์ | ใช้ทำอะไรในรถไฟฟ้า |
| --- | --- |
| **เคมี** | ปฏิกิริยาในแบตเตอรี่ การพัฒนาวัสดุแบตใหม่ |
| **ฟิสิกส์** | แม่เหล็กไฟฟ้าในมอเตอร์ พลังงานและงาน |
| **คณิตศาสตร์** | คำนวณระยะทาง เวลาชาร์จ ค่าใช้จ่าย จุดคุ้มทุน |
| **วิทยาการคอมพิวเตอร์** | ซอฟต์แวร์จัดการแบต ระบบช่วยขับขี่ อัปเดตผ่านอินเทอร์เน็ต |

อาชีพที่เกิดใหม่: ช่างซ่อมรถไฟฟ้า วิศวกรแบตเตอรี่ ผู้ติดตั้งสถานีชาร์จ นักพัฒนาซอฟต์แวร์ยานยนต์

:::tip
ราคาไฟ ราคาน้ำมัน และจำนวนสถานีชาร์จเปลี่ยนตลอดเวลา เวลาคำนวณจริงให้ใช้ตัวเลขล่าสุด
:::
$md$),

(4, 'การจัดการโลจิสติกส์', $md$
## กดสั่งเมื่อคืน ของมาถึงเช้านี้ได้อย่างไร?
ลองตามพัสดุ 1 ชิ้น ตั้งแต่เรากดสั่งเสื้อในแอปจนถึงมือเรา

1. **กดสั่งซื้อและจ่ายเงิน** ระบบส่งคำสั่งซื้อไปยังคลังสินค้าทันที
2. **คลังสินค้า** พนักงานหรือหุ่นยนต์หยิบเสื้อจากชั้นวาง แพ็กใส่กล่อง พิมพ์ใบปะหน้า
3. **ศูนย์คัดแยก** สายพานและเครื่องสแกนแยกพัสดุตามปลายทาง
4. **ขนส่งระหว่างเมือง** รถบรรทุกวิ่งข้ามคืนไปศูนย์กระจายสินค้าใกล้บ้านเรา
5. **ไมล์สุดท้าย (Last mile)** พนักงานส่งของหรือไรเดอร์นำไปส่งหน้าบ้าน
6. **ผู้รับ** สแกนยืนยัน ถ่ายรูปเป็นหลักฐาน

**โลจิสติกส์** คือการจัดการให้ **สินค้า ข้อมูล และเงิน** เคลื่อนที่อย่างถูกต้องตลอดเส้นทางนี้

:::think
ระหว่าง 6 ขั้นตอนข้างบน มี "ข้อมูล" อะไรเคลื่อนที่ไปพร้อมกับสินค้าบ้าง
---
เช่น ที่อยู่และเบอร์โทรผู้รับ เลขพัสดุ ตำแหน่งปัจจุบันของพัสดุ สถานะ (กำลังแพ็ก/ออกจากคลัง/กำลังนำส่ง) เวลาที่คาดว่าจะถึง และหลักฐานการส่ง ถ้าข้อมูลผิดแม้ชิ้นเดียว ของก็ไปผิดที่ได้
:::

## หัวใจของโลจิสติกส์: ถูกต้อง 6 อย่าง
| ถูก… | ความหมาย | ถ้าพลาดจะเกิดอะไร |
| --- | --- | --- |
| ถูกสินค้า | ส่งของตรงกับที่สั่ง | ได้เสื้อผิดไซซ์ ต้องส่งคืน |
| ถูกจำนวน | ครบตามสั่ง | ของขาด ลูกค้าไม่พอใจ |
| ถูกสภาพ | ไม่เสียหาย ไม่เน่า | ผลไม้ช้ำ ยาเสื่อม |
| ถูกสถานที่ | ส่งถึงผู้รับที่ถูกต้อง | ของหาย ต้องส่งใหม่ |
| ถูกเวลา | ทันเวลาที่สัญญาไว้ | อาหารสดเสีย ของขวัญไม่ทันวันเกิด |
| ถูกต้นทุน | ไม่แพงเกินจำเป็น | ร้านขาดทุน ค่าส่งแพง |

## เลือกการขนส่งให้เหมาะ
| รูปแบบ | ข้อดี | ข้อจำกัด | ตัวอย่าง |
| --- | --- | --- | --- |
| ถนน | ไปถึงหน้าบ้านได้ ยืดหยุ่น | รถติด ต้นทุนต่อตันสูงในระยะไกล | ส่งพัสดุ ส่งอาหาร |
| ราง | ขนได้มาก ประหยัดพลังงาน | ต้องมีราง ต้องต่อรถไปปลายทาง | ขนสินค้าเกษตรข้ามประเทศ |
| น้ำ | ถูกที่สุดต่อตัน ขนของหนักได้มาก | ช้า | ตู้คอนเทนเนอร์ส่งออก |
| อากาศ | เร็วที่สุด | แพงที่สุด | ผลไม้สดพรีเมียม ยา อะไหล่ด่วน |
| ท่อ | ส่งต่อเนื่อง | ใช้ได้กับของเหลว/ก๊าซเท่านั้น | น้ำมัน ก๊าซธรรมชาติ |

:::think
เกษตรกรต้องการส่งทุเรียน 20 ตันไปขายต่างประเทศใกล้เคียง ให้ถึงภายใน 2–3 วัน และราคาไม่แพงมาก ควรเลือกการขนส่งแบบใด เพราะอะไร
---
ทางรถไฟหรือทางถนนด้วยรถห้องเย็น เหมาะกว่าทางอากาศ (แพงเกินไปสำหรับ 20 ตัน) และทางเรือ (อาจช้าเกินไปสำหรับผลไม้สด) ปัจจุบันมีเส้นทางรถไฟข้ามประเทศที่ช่วยให้ส่งผลไม้ไทยไปขายต่างประเทศได้เร็วขึ้น คำตอบที่ดีต้องชั่งน้ำหนักทั้ง **เวลา ต้นทุน ปริมาณ และชนิดสินค้า**
:::

## Barcode / QR / RFID / GPS ทำงานอย่างไร
| เทคโนโลยี | หลักการ | จุดเด่น | ตัวอย่างใกล้ตัว |
| --- | --- | --- | --- |
| Barcode | แถบดำ-ขาวแทนตัวเลข อ่านด้วยแสง | ถูก พิมพ์ง่าย | สแกนสินค้าที่ร้านสะดวกซื้อ |
| QR Code | สี่เหลี่ยม 2 มิติ เก็บข้อมูลได้มาก | สแกนด้วยมือถือได้ | สแกนจ่ายเงิน ติดตามพัสดุ |
| RFID | ป้ายส่งคลื่นวิทยุ | อ่านได้ไม่ต้องมองเห็น อ่านหลายชิ้นพร้อมกัน | บัตรผ่านทางด่วน ป้ายสินค้าในร้านเสื้อผ้า |
| GPS | ใช้ดาวเทียมหาตำแหน่ง | รู้ตำแหน่งเรียลไทม์ | ดูรถส่งอาหารบนแผนที่ |

:::example
บัตรผ่านทางด่วนแบบอัตโนมัติก็คือ **RFID** รถขับผ่านช่องได้โดยไม่ต้องหยุด เพราะเครื่องอ่านรับคลื่นจากป้ายในรถ แล้วตัดเงินจากบัญชีอัตโนมัติ
:::

## คณิตศาสตร์ในบาร์โค้ด: เลขตรวจสอบ
บาร์โค้ดสินค้า 13 หลัก (EAN-13) ใช้ **หลักสุดท้ายเป็นเลขตรวจสอบ** กันการสแกนหรือพิมพ์ผิด สินค้าที่ผลิตในไทยมักขึ้นต้นด้วย **885**

วิธีคิดเลขตรวจสอบจาก 12 หลักแรก
1. บวกเลขหลักที่ **1, 3, 5, 7, 9, 11**
2. บวกเลขหลักที่ **2, 4, 6, 8, 10, 12** แล้วคูณ 3
3. นำผลข้อ 1 และ 2 มารวมกัน
4. เลขตรวจสอบ = จำนวนที่บวกเพิ่มแล้วได้ผลรวมหารด้วย 10 ลงตัว

:::think
หาเลขตรวจสอบของบาร์โค้ดที่ 12 หลักแรกคือ **8 8 5 1 2 3 4 5 6 7 8 9**
---
1. หลักคี่: 8 + 5 + 2 + 4 + 6 + 8 = **33**
2. หลักคู่: 8 + 1 + 3 + 5 + 7 + 9 = 33 × 3 = **99**
3. รวม 33 + 99 = **132**
4. บวกอีก **8** จะได้ 140 ซึ่งหารด้วย 10 ลงตัว

บาร์โค้ดเต็มคือ **885123456789 8** ถ้าเครื่องสแกนอ่านผิดไปหนึ่งหลัก ผลคำนวณจะไม่ตรง เครื่องจึงรู้ทันทีว่าอ่านผิด
:::

## คลังสินค้าอัจฉริยะ
- **WMS (ระบบจัดการคลังสินค้า)** รู้ว่าสินค้าแต่ละชิ้นอยู่ชั้นไหน เหลือเท่าไร ควรหยิบชิ้นไหนก่อน
- **หุ่นยนต์ขนชั้นวาง** วิ่งยกชั้นวางมาหาพนักงาน แทนให้พนักงานเดินไปหา
- **สายพานคัดแยกอัตโนมัติ** สแกนพัสดุแล้วผลักลงช่องตามปลายทาง แยกได้หลายพันชิ้นต่อชั่วโมง
- **ห้องเย็นติดเซนเซอร์ IoT** เตือนทันทีถ้าอุณหภูมิผิดปกติ ใช้กับอาหารทะเลและวัคซีน

:::think
ช่วงลดราคากลางปีและปลายปี คำสั่งซื้อพุ่งขึ้นหลายเท่าในวันเดียว คลังสินค้าควรเตรียมตัวอย่างไร และข้อมูลอะไรช่วยได้
---
ใช้ **ข้อมูลยอดขายปีก่อน ๆ** และ AI คาดการณ์ว่าสินค้าไหนจะขายดี แล้วย้ายสินค้าไปไว้คลังใกล้ลูกค้าล่วงหน้า เพิ่มพนักงานชั่วคราว เปิดสายพานเพิ่ม และวางสินค้าขายดีไว้ใกล้จุดแพ็ก
:::

## ไมล์สุดท้าย: ช่วงที่ยากที่สุด
ระยะจากศูนย์กระจายสินค้าถึงหน้าบ้านสั้นที่สุด แต่มักมี **ต้นทุนต่อชิ้นสูงที่สุด** เพราะต้องแวะทีละบ้าน เจอรถติด หาบ้านไม่เจอ หรือผู้รับไม่อยู่

ทางแก้ที่ใช้กันอยู่
- **ตู้รับพัสดุอัจฉริยะ** ในคอนโด สถานีรถไฟฟ้า ร้านสะดวกซื้อ ผู้รับมารับเองด้วยรหัส
- **จุดรับของ** ที่ร้านใกล้บ้าน
- **โดรนส่งของ** ทดลองใช้ในหลายประเทศ เหมาะกับพื้นที่ห่างไกลหรือส่งยาเร่งด่วน
- **หุ่นยนต์ส่งของ** ในอาคาร โรงพยาบาล มหาวิทยาลัย

:::think
ถ้านักเรียนเป็นผู้จัดการบริษัทขนส่ง ในหมู่บ้านที่ผู้รับมักไม่อยู่บ้านตอนกลางวัน จะแก้ปัญหาส่งของไม่สำเร็จอย่างไร
---
ตัวอย่าง: ให้ลูกค้าเลือกช่วงเวลาส่ง ส่งข้อความแจ้งก่อนถึง วางตู้รับพัสดุกลางหมู่บ้าน ฝากร้านค้าในชุมชนเป็นจุดรับ ทุกวิธีช่วยลดการวิ่งซ้ำ ซึ่งลดทั้งต้นทุนและมลพิษ
:::

## หาเส้นทางที่สั้นที่สุด (คณิตศาสตร์ช่วยได้)
รถออกจากโกดัง **W** ต้องส่งของ 3 บ้าน **A, B, C** แล้วกลับโกดัง ระยะทาง (กม.)

| | A | B | C |
| --- | --- | --- | --- |
| **W** | 2 | 5 | 4 |
| **A** | – | 3 | 6 |
| **B** | 3 | – | 2 |

:::think
ลองคิดระยะทางรวมของเส้นทาง W→A→B→C→W และ W→B→A→C→W เส้นทางไหนสั้นกว่า และมีเส้นทางที่สั้นกว่านี้อีกไหม
---
- W→A→B→C→W = 2 + 3 + 2 + 4 = **11 กม.**
- W→B→A→C→W = 5 + 3 + 6 + 4 = **18 กม.**

เส้นทาง 11 กม. คือสั้นที่สุด (หรือวิ่งย้อนทิศ W→C→B→A→W ก็ได้ 11 กม. เท่ากัน) ถ้ามีบ้าน 3 หลัง ยังลองครบทุกเส้นทางได้ (6 แบบ) แต่ถ้ามี 50 หลัง จำนวนเส้นทางจะมากจนคนคิดไม่ไหว บริษัทขนส่งจึงใช้ **คอมพิวเตอร์และ AI** คำนวณให้
:::

## โลจิสติกส์กับโลก
- **ขยะบรรจุภัณฑ์** กล่อง พลาสติกกันกระแทก เทปกาว → ใช้กล่องขนาดพอดี กระดาษแทนพลาสติก กล่องใช้ซ้ำ
- **มลพิษจากการขนส่ง** → รถขนส่งไฟฟ้า จัดเส้นทางให้สั้น ส่งรวมรอบ
- **แรงงาน** ไรเดอร์และพนักงานส่งของต้องการความปลอดภัยและรายได้ที่เป็นธรรม

:::think
การสั่งของชิ้นเล็กหลายรอบ กับการรวมสั่งครั้งเดียว ต่างกันอย่างไรต่อสิ่งแวดล้อม
---
การรวมสั่งครั้งเดียวใช้กล่องและการวิ่งรถน้อยกว่า จึงลดทั้งขยะและการปล่อยก๊าซ ผู้บริโภคเองก็ช่วยให้ระบบโลจิสติกส์เป็นมิตรต่อโลกได้
:::
$md$),

(5, 'กิจกรรมท้าทายความคิด: ข้าวมันไก่แสนอร่อย', $md$
## ภารกิจของกลุ่ม
**ร้านข้าวมันไก่ป้าศรี** ขายมา 20 ปี อร่อยจนคนต่อคิวยาว แต่เจอปัญหา
- ช่วงเที่ยงคิวยาวมาก ลูกค้าบางคนรอไม่ไหวเดินกลับ
- อยากรับออเดอร์เดลิเวอรี แต่ข้าวเย็นชืดเมื่อส่งไกล
- จดออเดอร์ด้วยกระดาษ บางครั้งทำผิดหรือลืม

ให้กลุ่มวิเคราะห์ว่า **เทคโนโลยีอะไรบ้างอยู่เบื้องหลังข้าวมันไก่หนึ่งจาน** แล้วเสนอเทคโนโลยีที่ช่วยร้านป้าศรีได้

## เส้นทางของข้าวมันไก่ 1 จาน
| ขั้นตอน | ตัวอย่างเทคโนโลยี |
| --- | --- |
| ฟาร์มไก่ | ระบบให้อาหารและน้ำอัตโนมัติ พัดลมระบายอากาศควบคุมอุณหภูมิ |
| นาข้าว | รถเกี่ยวข้าว โดรนพ่นปุ๋ย พันธุ์ข้าวที่พัฒนาแล้ว |
| โรงงาน/ตลาด | ห้องเย็น เครื่องชั่งดิจิทัล รถขนส่งห้องเย็น |
| ร้านค้า | หม้อหุงข้าวไฟฟ้า ตู้แช่ เครื่องสับไก่ หม้อต้มก๊าซ |
| การขาย | QR Code จ่ายเงิน แอปเดลิเวอรี ระบบคิวออนไลน์ |
| ถึงมือลูกค้า | บรรจุภัณฑ์เก็บความร้อน กล่องกระดาษย่อยสลายได้ |

:::think
ลองเพิ่มเทคโนโลยีอีก 2 อย่างที่ไม่อยู่ในตาราง (คิดจากประสบการณ์ที่เคยซื้อข้าวมันไก่)
---
ตัวอย่าง: เครื่องทำน้ำแข็งสำหรับน้ำซุป ตู้กดน้ำ เครื่องปั่นน้ำจิ้ม แอปบัญชีรายรับรายจ่าย กล้องวงจรปิด หลอดไฟ LED ประหยัดไฟ ป้ายเมนูดิจิทัล
:::

## ตัวอย่างการวิเคราะห์: การจ่ายเงินที่ร้าน
| ช่วงเวลา | วิธีจ่ายเงิน | ปัจจัยที่ทำให้เปลี่ยน |
| --- | --- | --- |
| อดีต | เงินสด ทอนเงินด้วยมือ | – |
| ไม่กี่ปีก่อน | โอนผ่านแอปธนาคาร ต้องพิมพ์เลขบัญชี | สมาร์ตโฟนแพร่หลาย (สังคม) |
| ปัจจุบัน | สแกน QR จ่ายทันที | ระบบชำระเงินของประเทศ (นโยบายรัฐ), สะดวก ไม่ต้องทอน (ความต้องการ), ช่วงโรคระบาดคนอยากลดการจับเงิน (สังคม/สุขภาพ) |
| อนาคต | จ่ายด้วยใบหน้าหรือนาฬิกา | ความรู้ด้าน AI และความปลอดภัยข้อมูล (วิทยาศาสตร์) |

:::doctor
สังเกตว่าเทคโนโลยีหนึ่งอย่างเปลี่ยนเพราะ **หลายปัจจัยพร้อมกัน** คำตอบที่ดีจึงไม่ควรตอบแค่ปัจจัยเดียว
:::

## ขั้นตอนการทำงานกลุ่ม
1. **แบ่งหน้าที่** ผู้ประสานงาน ผู้จด ผู้ค้นข้อมูล ผู้วาดแผนภาพ ผู้นำเสนอ
2. **เขียนเส้นทางวัตถุดิบ** ฟาร์ม → โรงงาน → ตลาด → ร้าน → ลูกค้า
3. **ระบุเทคโนโลยี** อย่างน้อยขั้นละ 1 อย่าง
4. **เลือก 1 เทคโนโลยี** แล้ววิเคราะห์แบบตัวอย่างข้างบน (อดีต → ปัจจุบัน → อนาคต + ปัจจัย)
5. **เสนอทางแก้** ปัญหาของร้านป้าศรีอย่างน้อย 1 ข้อ
6. **ทำแผนภาพ** บนกระดาษหรือ Canva ถ่ายรูปแล้วอัปโหลดในเว็บ

:::think
ปัญหา "คิวยาวช่วงเที่ยง" ของป้าศรี แก้ด้วยเทคโนโลยีอะไรได้บ้าง และแต่ละวิธีมีข้อเสียอะไร
---
- **สั่งล่วงหน้าผ่านแชทหรือแอป** มารับเลย → ข้อเสีย: คนสูงอายุบางคนใช้ไม่คล่อง
- **บัตรคิว/คิวออนไลน์** ลูกค้าไปทำธุระก่อนได้ → ข้อเสีย: มีค่าใช้จ่าย ต้องสอนพนักงาน
- **จัดชุดสำเร็จ** (ข้าว+ไก่+ซุปเป็นชุด) → ข้อเสีย: ลูกค้าเลือกปรับเปลี่ยนได้น้อย

ไม่มีทางแก้ที่สมบูรณ์แบบ ต้องเลือกให้เหมาะกับร้านและลูกค้า
:::

## เกณฑ์การให้คะแนน (2 คะแนน)
| เกณฑ์ | ดีมาก (1) | พอใช้ (0.5) |
| --- | --- | --- |
| ระบุเทคโนโลยีครบเส้นทาง | ครบทุกขั้น พร้อมบอกว่าช่วยอะไร | ระบุได้บางขั้น |
| วิเคราะห์การเปลี่ยนแปลงและเสนอทางแก้ | มีปัจจัยหลายด้าน มีเหตุผล | มีปัจจัยเดียว หรือไม่มีเหตุผล |

:::tip
ถ้าที่บ้านหรือใกล้บ้านมีร้านอาหาร ลองสัมภาษณ์เจ้าของร้านสั้น ๆ ว่าใช้เทคโนโลยีอะไรบ้าง ข้อมูลจริงทำให้งานของกลุ่มน่าสนใจขึ้นมาก
:::
$md$),

(6, 'สรุปหน่วยที่ 1: เทคโนโลยีเปลี่ยนโลก', $md$
## ทบทวนสิ่งที่เรียนมา
| เรื่อง | สาระสำคัญ | ตัวอย่างใกล้ตัว |
| --- | --- | --- |
| 5G | เร็วมาก หน่วงต่ำ เชื่อมอุปกรณ์จำนวนมาก | เน็ตบ้านผ่าน 5G, IoT, เมืองอัจฉริยะ |
| รถยนต์ไฟฟ้า | HEV / PHEV / BEV / FCEV ต่างกันที่แหล่งพลังงาน | รถเมล์ไฟฟ้า มอเตอร์ไซค์สลับแบต |
| โลจิสติกส์ | จัดการการไหลของสินค้าและข้อมูล | ติดตามพัสดุ ตู้รับพัสดุ คลังอัจฉริยะ |

:::think
ทั้ง 3 เรื่องมีอะไรเหมือนกัน (มองหา "เส้นด้าย" ที่ร้อยทุกเรื่องเข้าด้วยกัน)
---
ทั้งหมดเกิดจาก **ความต้องการของมนุษย์** + **ความรู้วิทยาศาสตร์-คณิตศาสตร์** และทั้งหมดใช้ **ข้อมูลและการเชื่อมต่อ** เช่น รถไฟฟ้าส่งข้อมูลแบตผ่านเครือข่าย พัสดุติดตามด้วย GPS ผ่านเครือข่ายมือถือ เทคโนโลยีจึงไม่ได้เปลี่ยนทีละเรื่อง แต่เปลี่ยนไปด้วยกันและส่งผลต่อกัน
:::

## ปัจจัยที่ทำให้เทคโนโลยีเปลี่ยนแปลง
1. **ปัญหาและความต้องการของมนุษย์**
2. **ความรู้วิทยาศาสตร์และคณิตศาสตร์**
3. **เศรษฐกิจและการแข่งขัน**
4. **สังคมและวัฒนธรรม** (วิถีชีวิต ค่านิยม)
5. **สิ่งแวดล้อมและทรัพยากร**
6. **นโยบายและกฎหมาย**

## ตัวอย่างวิเคราะห์: การฟังเพลงเปลี่ยนไปอย่างไร
| ยุค | เทคโนโลยี | ปัจจัยที่ทำให้เปลี่ยน |
| --- | --- | --- |
| อดีต | แผ่นเสียง วิทยุ | เครื่องเล่นใหญ่ ราคาแพง |
| ต่อมา | เทปคาสเซ็ต ซีดี | อยากพกพา (ความต้องการ) ความรู้เรื่องเลเซอร์และดิจิทัล (วิทยาศาสตร์) |
| ไม่นานมานี้ | ไฟล์ MP3 | การบีบอัดข้อมูล (คณิตศาสตร์) อินเทอร์เน็ตบ้าน |
| ปัจจุบัน | สตรีมมิง + AI แนะนำเพลง | 4G/5G (เทคโนโลยีเครือข่าย) จ่ายรายเดือนถูกกว่าซื้อทีละแผ่น (เศรษฐกิจ) แชร์เพลงในโซเชียล (สังคม) |
| อนาคต? | AI แต่งเพลงเฉพาะตัว | ความก้าวหน้าของ AI และคำถามเรื่องลิขสิทธิ์ (กฎหมาย) |

:::think
ผลกระทบด้านบวกและด้านลบของการฟังเพลงแบบสตรีมมิงมีอะไรบ้าง (คิดอย่างละ 2 ข้อ)
---
- **ด้านบวก** ฟังได้ทุกที่ เพลงหลายล้านเพลง ศิลปินหน้าใหม่ปล่อยเพลงเองได้ ไม่ต้องผลิตแผ่น ลดขยะพลาสติก
- **ด้านลบ** ศิลปินบางกลุ่มได้รายได้ต่อการฟังน้อย ต้องใช้อินเทอร์เน็ตและสมัครสมาชิก ข้อมูลการฟังของเราถูกเก็บ
:::

## เทคโนโลยีที่กำลังเปลี่ยนโลกตอนนี้
- **AI สร้างเนื้อหา (Generative AI)** เขียนข้อความ วาดรูป สรุปบทเรียน ช่วยงานได้มาก แต่ต้องตรวจความถูกต้องเสมอ
- **ธนาคารและกระเป๋าเงินบนมือถือ** แทบไม่ต้องใช้เงินสด
- **พลังงานแสงอาทิตย์บนหลังคาบ้าน** ราคาถูกลงจนครัวเรือนติดตั้งเองได้
- **การแพทย์ทางไกล** ปรึกษาแพทย์ผ่านวิดีโอคอล รับยาที่บ้าน

:::think
เลือก 1 เทคโนโลยีจากรายการข้างบน ระบุปัจจัยที่ทำให้มันแพร่หลายอย่างน้อย 2 ปัจจัย
---
ตัวอย่าง **โซลาร์เซลล์บนหลังคา**
- **เศรษฐกิจ** ค่าไฟสูงขึ้น แต่แผงโซลาร์ราคาถูกลงมาก
- **สิ่งแวดล้อม** ต้องการลดการปล่อยก๊าซเรือนกระจก
- **วิทยาศาสตร์** แผงรุ่นใหม่แปลงแสงเป็นไฟฟ้าได้มีประสิทธิภาพขึ้น
- **นโยบาย** มีการส่งเสริมและขายไฟคืนได้ในบางโครงการ
:::

## กิจกรรมท้ายบท "เทคโนโลยีเปลี่ยนโลก"
เลือกเทคโนโลยี 1 อย่างที่ใช้ในชีวิตประจำวัน (เช่น การดูหนัง การเรียน การเดินทาง การซื้อของ การถ่ายรูป) แล้วทำไทม์ไลน์ **อดีต → ปัจจุบัน → อนาคต** โดยระบุ

1. ลักษณะของเทคโนโลยีในแต่ละช่วง
2. ปัจจัยที่ทำให้เปลี่ยนแปลง (อย่างน้อย 2 ด้าน)
3. ความรู้วิทยาศาสตร์หรือคณิตศาสตร์ที่เกี่ยวข้อง
4. ผลกระทบด้านบวกและด้านลบ

:::example
**การถ่ายรูป**: กล้องฟิล์ม (ต้องล้างฟิล์ม) → กล้องดิจิทัล → กล้องมือถือหลายเลนส์ + AI แต่งภาพ → อนาคต: ภาพ 3 มิติ / AI สร้างภาพ
ความรู้ที่เกี่ยวข้อง: แสงและเลนส์ (วิทยาศาสตร์), การบีบอัดภาพ (คณิตศาสตร์)
ผลกระทบ: ทุกคนถ่ายภาพได้ง่าย (+) แต่ภาพตัดต่อและภาพปลอมแยกยากขึ้น (−)
:::

:::tip
หลังทำกิจกรรม จะมีแบบทดสอบท้ายหน่วย 20 ข้อ (5 คะแนน) และ Boss Battle ให้ลองท้าทาย!
:::
$md$),

(7, 'เทคโนโลยีแก้ปัญหาในอาชีพ', $md$
## ทุกอาชีพมีปัญหา และเทคโนโลยีช่วยได้
| อาชีพ | ปัญหาที่เจอ | เทคโนโลยีที่ช่วย |
| --- | --- | --- |
| ชาวนา/ชาวสวน | พ่นยาเปลืองแรง เสี่ยงสารเคมี | โดรนพ่นปุ๋ยและยา ระบบรดน้ำด้วยเซนเซอร์ความชื้น |
| แม่ค้าออนไลน์ | ตอบแชทลูกค้าไม่ทัน จัดส่งช้า | ระบบตอบแชทอัตโนมัติ ไลฟ์ขายของ พิมพ์ใบปะหน้าอัตโนมัติ |
| ชาวประมง | ไม่รู้สภาพอากาศ ทางกลับฝั่ง | แอปพยากรณ์อากาศ GPS เครื่องหาฝูงปลา |
| ช่างซ่อม | หาอะไหล่เก่าไม่ได้ | พิมพ์ชิ้นส่วนด้วยเครื่องพิมพ์ 3 มิติ |
| แพทย์/พยาบาล | ผู้ป่วยในพื้นที่ห่างไกลมาโรงพยาบาลยาก | การแพทย์ทางไกล อุปกรณ์วัดความดันส่งข้อมูลอัตโนมัติ |
| ครู | นักเรียนเรียนรู้ไม่เท่ากัน | ห้องเรียนออนไลน์ เกมทบทวน แบบทดสอบตรวจอัตโนมัติ |

:::think
เลือกอาชีพของคนในครอบครัวหรือคนรู้จัก 1 อาชีพ ปัญหาที่เขาบ่นบ่อยที่สุดคืออะไร และมีเทคโนโลยีอะไร (ที่มีอยู่แล้วหรือที่นักเรียนคิดเอง) ช่วยได้บ้าง
---
ตัวอย่าง: **แม่ขายส้มตำ** บ่น "จำออเดอร์ไม่ไหวตอนลูกค้าเยอะ" → เทคโนโลยีที่ช่วย: แท็บเล็ตรับออเดอร์ บัตรคิว กระดานออเดอร์สีต่างกันตามระดับเผ็ด
สิ่งสำคัญคือเริ่มจาก **ปัญหาจริงของคนจริง** ไม่ใช่เริ่มจากเทคโนโลยีที่อยากใช้
:::

:::example
**โดรนเกษตร** เป็นตัวอย่างที่เห็นชัดในชนบทไทย เกษตรกรจ้างโดรนพ่นยาแทนการสะพายถังเดินพ่น ทำได้เร็วขึ้นมาก และลดการสัมผัสสารเคมี ทั้งยังเกิด **อาชีพใหม่** คือนักบินโดรนรับจ้าง
:::

## กระบวนการออกแบบเชิงวิศวกรรม 6 ขั้น
1. **ระบุปัญหา** ใครเจอปัญหาอะไร ที่ไหน มีเงื่อนไขอะไร
2. **รวบรวมข้อมูลและแนวคิด** ค้นว่ามีคนแก้ไว้อย่างไร ระดมความคิด
3. **ออกแบบวิธีแก้ปัญหา** เลือกแนวคิดที่ดีที่สุด ร่างภาพ
4. **วางแผนและดำเนินการ** กำหนดขั้นตอน วัสดุ เวลา แล้วลงมือสร้าง
5. **ทดสอบ ประเมินผล และปรับปรุง** ทดลองใช้จริง หาข้อบกพร่อง แก้ไข
6. **นำเสนอ** เล่าวิธีแก้ ผลลัพธ์ และสิ่งที่เรียนรู้

:::doctor
ขั้นที่ 5 มักพาเรา **วนกลับ** ไปขั้น 2, 3 หรือ 4 ใหม่ วิศวกรเรียกสิ่งนี้ว่า "การทำซ้ำ (Iteration)" สินค้าที่เราใช้ทุกวัน เช่น มือถือหรือแอปต่าง ๆ ผ่านการทดสอบและปรับปรุงหลายร้อยรอบก่อนออกขาย
:::

## เดินตาม 6 ขั้น: "ถังขยะในโรงเรียนล้น"
| ขั้น | สิ่งที่นักเรียนกลุ่มหนึ่งทำ |
| --- | --- |
| 1. ระบุปัญหา | สังเกตว่าหลังพักเที่ยงถังขยะโรงอาหารล้น ขวดพลาสติกปนเศษอาหาร สัมภาษณ์แม่บ้านพบว่าแยกขยะไม่ทัน |
| 2. รวบรวมข้อมูล | ค้นวิธีแยกขยะของโรงเรียนอื่น ดูคลิปถังขยะแยกประเภท ระดมความคิดได้ 5 แนวคิด |
| 3. ออกแบบ | เลือก "ถังแยก 3 ช่อง + ป้ายรูปภาพใหญ่ + ช่องเทน้ำ" ร่างภาพพร้อมขนาด |
| 4. ลงมือ | ใช้ถังเก่า 3 ใบ ไม้อัด สติกเกอร์ ใช้เวลา 2 คาบ |
| 5. ทดสอบ | ใช้จริง 1 สัปดาห์ นับขยะที่ทิ้งถูกช่อง ได้ 60% → ปรับป้ายให้ใหญ่ขึ้น ย้ายถังไปทางออกโรงอาหาร → ได้ 85% |
| 6. นำเสนอ | ทำโปสเตอร์ก่อน-หลัง นำเสนอหน้าเสาธง |

:::think
ในตัวอย่างนี้ ขั้นที่ 5 ทำให้กลุ่มต้องย้อนกลับไปปรับอะไร และสะท้อนว่าการ "ล้มเหลวครั้งแรก" มีประโยชน์อย่างไร
---
ผลทดสอบครั้งแรก (60%) ทำให้รู้ว่า **ป้ายเห็นไม่ชัด** และ **ตำแหน่งถังไม่เหมาะ** จึงย้อนไปปรับการออกแบบ (ขั้น 3) และการติดตั้ง (ขั้น 4) ความล้มเหลวครั้งแรกให้ **ข้อมูลจริง** ที่ทำให้วิธีแก้ดีขึ้น ถ้าไม่ทดสอบ เราจะไม่รู้เลยว่าต้องปรับตรงไหน
:::

## จับคู่สถานการณ์กับขั้นตอน
:::think
แต่ละสถานการณ์อยู่ในขั้นใดของกระบวนการ
1. ถามแม่ค้าว่า "ช่วงไหนที่ขายแล้วเหนื่อยที่สุด"
2. วาดภาพชั้นวางของ 3 มุม พร้อมใส่ขนาด
3. ทดลองวางของหนัก 2 กิโลกรัมบนชั้นวางแล้วจับเวลา
4. ทำคลิป 1 นาทีเล่าผลงานให้เพื่อนดู
5. ค้นว่าชั้นวางแบบพับได้มีขายแบบไหนบ้าง
---
1 = ระบุปัญหา · 2 = ออกแบบ · 3 = ทดสอบ · 4 = นำเสนอ · 5 = รวบรวมข้อมูล
:::

## งานกรณีศึกษา
เลือกอาชีพ 1 อาชีพในชุมชน แล้วกรอกตาราง
- ปัญหาของอาชีพนั้นคืออะไร (อย่างน้อย 1 ปัญหา)
- เทคโนโลยีที่ใช้แก้ หรือที่นักเรียนเสนอ
- ถ้าจะสร้างเทคโนโลยีนั้นเอง แต่ละขั้นของกระบวนการ 6 ขั้นจะทำอะไร

:::tip
ในหน่วยนี้ทุกคนจะได้ทำ **โครงงาน** ของตัวเองตามกระบวนการ 6 ขั้น เริ่มสังเกตปัญหารอบตัวตั้งแต่วันนี้ จดลงสมุดหรือมือถือไว้ ปัญหาที่ดีมักมาจากสิ่งที่ "ทุกคนบ่น แต่ไม่มีใครแก้"
:::
$md$),

(8, 'การระบุปัญหา', $md$
## ปัญหาอยู่รอบตัว แต่ต้องมองให้เห็น
ปัญหาที่ดีสำหรับโครงงานมักซ่อนอยู่ในสิ่งที่เราชินจนไม่ทันสังเกต วิธีค้นหาปัญหา
- **สังเกต** ไปดูสถานที่จริง จดสิ่งที่ทำให้คนลำบาก เสียเวลา หรือเสียเงิน
- **สัมภาษณ์** ถามคนที่เจอปัญหาโดยตรง
- **สำรวจ** ใช้แบบสอบถามออนไลน์ถามคนจำนวนมาก
- **ลองทำเอง** ใช้ชีวิตแบบผู้ใช้ เช่น ลองยกของแบบที่แม่ค้ายกทุกวัน

:::think
ลองนึกถึงทางเดินจากประตูโรงเรียนถึงห้องเรียน มีอะไรที่ทำให้นักเรียนหรือครูลำบากบ้าง (คิดมาอย่างน้อย 3 อย่าง)
---
ตัวอย่าง: วันฝนตกทางเดินลื่นและมีน้ำขัง, จักรยานจอดเกะกะ, ที่ล้างมือไม่พอช่วงพักเที่ยง, ป้ายบอกห้องเรียนไม่ชัดสำหรับผู้มาติดต่อ, ร่มกางวางไว้หน้าห้องจนทางเดินแคบ ทั้งหมดนี้กลายเป็นโจทย์โครงงานได้
:::

## สัมภาษณ์อย่างไรให้ได้ข้อมูล (กิจกรรม 2.1)
**ก่อนสัมภาษณ์**
- ตั้งเป้าหมายว่าอยากรู้อะไร เตรียมคำถาม 5–8 ข้อ
- ขออนุญาตก่อนบันทึกเสียงหรือถ่ายภาพ

**ระหว่างสัมภาษณ์**
- ใช้ **คำถามปลายเปิด** ให้ผู้ตอบเล่า
- ถามต่อด้วย "ทำไม" หรือ "ช่วยเล่าตัวอย่างหน่อย"
- ฟังมากกว่าพูด อย่าชี้นำคำตอบ

| คำถามปลายปิด ❌ | คำถามปลายเปิด ✅ |
| --- | --- |
| ขายของเหนื่อยไหมคะ | ช่วงไหนของวันที่ขายแล้วเหนื่อยที่สุด เพราะอะไร |
| อยากได้ที่บังแดดไหม | ถ้าแก้ได้ 1 อย่าง อยากให้อะไรดีขึ้นที่สุด |
| ใช้แอปนี้ง่ายไหม | ครั้งล่าสุดที่ใช้แล้วติดขัด เกิดอะไรขึ้น |

:::think
คำถาม "อยากได้ที่บังแดดแบบพับได้ใช่ไหมคะ" มีปัญหาอะไร ควรเปลี่ยนเป็นอย่างไร
---
เป็นคำถาม **ชี้นำ** เพราะเราใส่คำตอบที่เราอยากได้ไว้แล้ว ผู้ตอบมักตอบ "ใช่" ตามเรา ควรเปลี่ยนเป็น "ช่วงที่แดดร้อน ป้าทำอย่างไรให้ผักไม่เหี่ยว และวิธีนั้นมีปัญหาอะไรบ้าง"
:::

## วิเคราะห์ปัญหาด้วย 5W1H
| คำถาม | ความหมาย | ตัวอย่าง: แผงผักป้าแดง |
| --- | --- | --- |
| **Who** | ใครเจอปัญหา | ป้าแดง แม่ค้าขายผัก อายุ 58 ปี |
| **What** | ปัญหาคืออะไร | ผักเหี่ยวเร็ว ขายไม่ได้ราคา |
| **Where** | เกิดที่ไหน | ตลาดนัดหน้าโรงเรียน แผงกลางแดด |
| **When** | เกิดเมื่อไร บ่อยแค่ไหน | ทุกวันเสาร์ ช่วง 9–11 โมง |
| **Why** | ทำไมจึงเกิด | ไม่มีที่บัง แดดร้อน ลมร้อน |
| **How** | ส่งผลอย่างไร / อยากแก้อย่างไร | ต้องลดราคาผัก รายได้ลด อยากได้อะไรที่ยกเก็บคนเดียวได้ |

:::think
ทำไมต้องรู้ทั้ง **Who** และ **When** ไม่ใช่แค่ What
---
- **Who** บอกว่าผู้ใช้เป็นใคร เช่น ป้าแดงอายุ 58 ปี ยกของหนักไม่ไหว ทางแก้ต้องเบา
- **When** บอกว่าปัญหาเกิดช่วงไหน เช่น เกิดเฉพาะ 9–11 โมง ทางแก้อาจไม่ต้องใช้ทั้งวัน

ข้อมูลเหล่านี้กลายเป็น **เงื่อนไข** ของการออกแบบ
:::

## สรุปกรอบของปัญหา (กิจกรรม 2.2)
**กรอบของปัญหา** = ปัญหาที่สรุปชัดเจน + เงื่อนไขและข้อจำกัด

| ❌ กรอบปัญหาที่กว้างเกินไป | ✅ กรอบปัญหาที่ชัดเจน |
| --- | --- |
| ทำให้ผักไม่เหี่ยว | ออกแบบที่บังแดดแผงผักขนาด 1×2 เมตร |
| | น้ำหนักไม่เกิน 5 กก. ยกเก็บคนเดียวได้ |
| | ใช้งบไม่เกิน 300 บาท ไม่ใช้ไฟฟ้า |
| | กางเสร็จภายใน 5 นาที ทนลมปานกลาง |

เงื่อนไขที่พบบ่อย: **งบประมาณ เวลา ขนาด น้ำหนัก วัสดุที่หาได้ ความปลอดภัย ผู้ใช้**

:::think
ปรับกรอบปัญหานี้ให้ชัดขึ้น: "ทำให้นักเรียนไม่ลืมส่งการบ้าน"
---
ตัวอย่าง: "ออกแบบระบบเตือนการส่งงานสำหรับนักเรียน ม.3 ห้องหนึ่ง ใช้กับมือถือที่นักเรียนมีอยู่แล้ว ไม่มีค่าใช้จ่าย เตือนก่อนกำหนดส่ง 1 วัน และครูตรวจได้ว่าใครส่งแล้ว"
สังเกตว่าเรากำหนด **ผู้ใช้ อุปกรณ์ งบ เวลา และสิ่งที่ต้องทำได้** ไว้ชัดเจน
:::

## แบบสอบถามออนไลน์: ได้ข้อมูลจากคนจำนวนมาก
- ใช้ฟอร์มออนไลน์ฟรี ส่งลิงก์ในกลุ่มแชท
- ผสม **คำถามให้เลือก** (นับง่าย ทำกราฟได้) กับ **คำถามให้เขียน** (ได้เหตุผล)
- ถามไม่เกิน 10 ข้อ ใช้เวลาตอบไม่เกิน 3 นาที

:::example
นักเรียนกลุ่มหนึ่งถามเพื่อน 120 คนว่า "เคยลืมร่มไว้ที่โรงเรียนไหม" มี 84 คนตอบว่าเคย คิดเป็น 84 ÷ 120 × 100 = **70%** ตัวเลขนี้ทำให้ครูเห็นว่าปัญหามีจริงและควรแก้ ข้อมูลเชิงตัวเลขทำให้ปัญหาน่าเชื่อถือขึ้น
:::

:::tip
ข้อมูลส่วนตัวของผู้ให้สัมภาษณ์ เช่น ชื่อ เบอร์โทร รูปภาพ ต้องขออนุญาตก่อนใช้ และไม่เผยแพร่โดยไม่จำเป็น
:::
$md$),

(9, 'การรวบรวมข้อมูลและคัดเลือกแนวคิด', $md$
## ข้อมูลมีหลายแหล่ง
| ประเภท | ความหมาย | ตัวอย่าง |
| --- | --- | --- |
| **ปฐมภูมิ** | เราเก็บเอง | สัมภาษณ์ สังเกต ทดลอง แบบสอบถาม |
| **ทุติยภูมิ** | มีคนรวบรวมไว้แล้ว | หนังสือ เว็บไซต์หน่วยงาน งานวิจัย คลิปผู้เชี่ยวชาญ |

:::think
โครงงาน "ที่บังแดดแผงผัก" ควรหาข้อมูลอะไรบ้าง และข้อมูลแต่ละอย่างได้มาจากแหล่งใด
---
- ขนาดแผงและน้ำหนักที่ป้ายกไหว → **ปฐมภูมิ** (วัดเอง ถามป้า)
- วัสดุที่กันแดดได้ดีและราคา → **ทุติยภูมิ** (เว็บร้านวัสดุ บทความ)
- อุณหภูมิใต้ร่มแต่ละแบบ → **ปฐมภูมิ** (ทดลองวัดเอง)
- ที่บังแดดแบบที่มีขายแล้ว → **ทุติยภูมิ** (ร้านออนไลน์ คลิปรีวิว)
:::

## ข้อมูลนี้เชื่อได้ไหม? ตรวจ 5 ข้อ
1. **ใครเขียน** หน่วยงาน ผู้เชี่ยวชาญ หรือบัญชีนิรนาม
2. **เผยแพร่เมื่อไร** ยังทันสมัยไหม
3. **มีหลักฐาน** อ้างอิงงานวิจัยหรือข้อมูลจริงไหม
4. **ตรงกับแหล่งอื่น** เทียบอย่างน้อย 2–3 แหล่ง
5. **มีเจตนาแอบแฝง** เป็นโฆษณาขายของหรือเปล่า

:::doctor
**AI แชตบอต** ช่วยสรุปและอธิบายได้เร็วมาก แต่บางครั้งตอบผิดอย่างมั่นใจ หรือแต่งแหล่งอ้างอิงที่ไม่มีอยู่จริงขึ้นมา ใช้ AI เป็น **จุดเริ่มต้น** แล้วตรวจกับแหล่งที่เชื่อถือได้เสมอ และบอกครูทุกครั้งว่าใช้ AI ช่วยในส่วนไหน
:::

:::think
เจอคลิปสั้นบอกว่า "ผ้าสีดำกันร้อนดีที่สุด เพราะดูดแสงหมด" นักเรียนจะตรวจสอบอย่างไร
---
- เทียบกับความรู้วิทยาศาสตร์: สีดำ **ดูดกลืนความร้อน** จึงร้อนเอง และอาจแผ่ความร้อนลงมา ผ้าสีอ่อนหรือผ้าที่มีชั้นสะท้อนแสงมักทำให้ใต้ร่มเย็นกว่า
- หาแหล่งข้อมูลอื่นมาเทียบ
- **ทดลองเอง**: ทำร่ม 2 ผืนสีต่างกัน วัดอุณหภูมิใต้ร่มด้วยเทอร์โมมิเตอร์ช่วงเวลาเดียวกัน ข้อมูลจากการทดลองเองเชื่อถือได้มากที่สุด
:::

## ระดมสมองให้ได้แนวคิดเยอะ
**กติกา**: ยังไม่ตัดสิน เน้นจำนวน ต่อยอดไอเดียเพื่อน ไอเดียแปลก ๆ ยินดีต้อนรับ

เทคนิคช่วยคิด: ลองถามตัวเองว่า
- **แทนที่** วัสดุนี้ด้วยอย่างอื่นได้ไหม (ผ้า → ใบไม้สาน)
- **รวม** สองอย่างเข้าด้วยกันได้ไหม (ร่ม + โต๊ะ)
- **ดัดแปลง** ของที่มีอยู่แล้ว (ร่มชายหาดเก่า)
- **ใช้ในทางอื่น** (ป้ายโฆษณาไวนิลเก่าเป็นผ้าบังแดด)

:::think
ระดมสมองแก้ปัญหา "ร่มเปียกวางเกะกะหน้าห้องเรียน" ให้ได้อย่างน้อย 4 แนวคิด
---
ตัวอย่าง: ราวแขวนร่มติดผนัง · ถังเสียบร่มทำจากท่อ PVC · ถุงใส่ร่มแบบใช้ซ้ำ · ชั้นวางร่มมีถาดรองน้ำ · ตะขอแขวนใต้โต๊ะ · ห้องเก็บร่มรวมที่ชั้นล่าง
ยิ่งมีแนวคิดมาก โอกาสเจอแนวคิดที่ดีจริงก็ยิ่งมาก
:::

## ตารางเปรียบเทียบแนวคิด (กิจกรรม 2.3)
ให้คะแนนแต่ละเกณฑ์ 1–3 (3 = ดีที่สุด) และให้ **น้ำหนัก** ตามความสำคัญจากกรอบของปัญหา

| เกณฑ์ (น้ำหนัก) | ร่มชายหาดดัดแปลง | โครงท่อ PVC + ผ้าใบ | หลังคาเหล็ก |
| --- | --- | --- | --- |
| ต้นทุน (×2) | 3 | 2 | 1 |
| ความปลอดภัย (×3) | 1 | 3 | 3 |
| ยกเก็บคนเดียวได้ (×3) | 3 | 3 | 1 |
| เวลาที่ใช้สร้าง (×1) | 3 | 2 | 1 |

:::think
คำนวณคะแนนรวมแบบถ่วงน้ำหนักของทั้ง 3 แนวคิด แล้วเลือกแนวคิดที่ดีที่สุดพร้อมเหตุผล
---
- ร่มชายหาด: 3×2 + 1×3 + 3×3 + 3×1 = 6 + 3 + 9 + 3 = **21**
- โครง PVC: 2×2 + 3×3 + 3×3 + 2×1 = 4 + 9 + 9 + 2 = **24**
- หลังคาเหล็ก: 1×2 + 3×3 + 1×3 + 1×1 = 2 + 9 + 3 + 1 = **15**

เลือก **โครงท่อ PVC + ผ้าใบ** เพราะคะแนนสูงสุด ปลอดภัย และยกเก็บได้ ซึ่งเป็นเงื่อนไขสำคัญที่สุดของป้าแดง สังเกตว่าถ้าไม่ถ่วงน้ำหนัก ร่มชายหาดจะได้คะแนนเกือบเท่ากัน **น้ำหนักทำให้การตัดสินใจตรงกับสิ่งที่ผู้ใช้ต้องการจริง**
:::

## ข้อมูลก็มีเจ้าของ
- ข้อความ รูปภาพ คลิป เพลง และภาพที่ AI สร้าง ล้วนเกี่ยวข้องกับ **ทรัพย์สินทางปัญญา**
- นำมาใช้ต้อง **อ้างอิงแหล่งที่มา** ห้ามคัดลอกมาเป็นของตัวเอง
- เลือกใช้สื่อที่เปิดให้ใช้ เช่น สัญญาอนุญาต **Creative Commons** ตามเงื่อนไขที่เจ้าของกำหนด

:::example
**วิธีอ้างอิงแบบง่าย**: ชื่อผู้เขียนหรือหน่วยงาน. (ปีที่เผยแพร่). ชื่อเรื่อง. ชื่อเว็บไซต์. ลิงก์ (วันที่เข้าถึง)
ถ้าใช้ภาพจากอินเทอร์เน็ตในโปสเตอร์ ให้เขียนเล็ก ๆ ใต้ภาพว่า "ที่มา: ..."
:::
$md$),

(10, 'ทบทวนก่อนสอบกลางภาค', $md$
## ขอบเขตการสอบกลางภาค
- หน่วยที่ 1 เทคโนโลยีเปลี่ยนโลก (5G รถยนต์ไฟฟ้า โลจิสติกส์ ปัจจัยการเปลี่ยนแปลง)
- หน่วยที่ 2 เรื่อง 2.1–2.3 (เทคโนโลยีในอาชีพ กระบวนการ 6 ขั้น การระบุปัญหา การรวบรวมข้อมูลและคัดเลือกแนวคิด)

## เช็กลิสต์ทบทวน
- [ ] บอกความสามารถเด่นของเครือข่ายแต่ละยุคได้
- [ ] แยก HEV / PHEV / BEV / FCEV ได้
- [ ] เลือกเทคโนโลยีโลจิสติกส์ให้เหมาะกับสถานการณ์ได้
- [ ] เรียงกระบวนการออกแบบเชิงวิศวกรรม 6 ขั้นได้
- [ ] วิเคราะห์ปัญหาด้วย 5W1H และเขียนกรอบของปัญหาได้
- [ ] ใช้ตารางเปรียบเทียบเลือกแนวคิดได้

:::doctor
ระหว่างสอบ ห้ามสลับแท็บหรือออกจากหน้าสอบ ระบบจะบันทึกจำนวนครั้งให้ครูเห็น คำตอบจะถูกบันทึกอัตโนมัติทุกข้อ ถ้าเน็ตหลุดให้เข้ามาทำต่อได้
:::
$md$),

(11, 'การออกแบบแนวคิด', $md$
## ทำไมต้องร่างก่อนสร้าง?
ก่อนสร้างบ้าน ช่างต้องมีแบบแปลน ก่อนตัดเสื้อ ช่างต้องมีแพตเทิร์น การร่างแบบช่วยให้
- **เห็นปัญหาก่อน** เสียวัสดุ เช่น ขนาดไม่พอดี ชิ้นส่วนชนกัน
- **สื่อสารกับคนอื่น** ให้เพื่อนในกลุ่มและครูเข้าใจตรงกัน
- **คำนวณวัสดุและงบ** ได้ล่วงหน้า

:::think
ถ้ากลุ่มของนักเรียนลงมือตัดไม้ทันทีโดยไม่ร่างแบบ อาจเกิดปัญหาอะไรได้บ้าง
---
ตัดไม้สั้นหรือยาวเกิน เปลืองวัสดุ งบหมดก่อนเสร็จ สมาชิกแต่ละคนเข้าใจรูปร่างไม่ตรงกัน ประกอบแล้วชิ้นส่วนไม่พอดีกัน และต้องรื้อทำใหม่ซึ่งเสียเวลามาก
:::

## สื่อสารแนวคิดด้วยภาพ
| ชนิดภาพ | ลักษณะ | ใช้เมื่อ |
| --- | --- | --- |
| **ภาพร่าง (Sketch)** | วาดด้วยมือเร็ว ๆ | ช่วงคิดไอเดีย เทียบหลายแบบ |
| **ภาพฉาย (หน้า-ข้าง-บน)** | มองตรงทีละด้าน ใส่ขนาด | ใช้ตัดวัสดุจริง |
| **ภาพ 3 มิติ / ภาพไอโซเมตริก** | เห็นรูปทรงรวม | นำเสนอให้คนอื่นเข้าใจ |
| **แผนภาพ / ผังงาน** | ลูกศรและกล่องแสดงขั้นตอน | อธิบายการทำงานของระบบ |

:::example
เครื่องมือออกแบบบนเว็บแบบฟรีหลายตัวให้นักเรียนสร้างโมเดล 3 มิติด้วยการลากรูปทรงมาต่อกัน หรือทำโปสเตอร์และแผนภาพได้ แต่ **ภาพร่างด้วยดินสอบนกระดาษก็ยังเป็นเครื่องมือที่เร็วที่สุด** สำหรับคิดไอเดีย
:::

## ภาพร่างที่ดีต้องมีอะไร
- ชื่อชิ้นงาน และชื่อส่วนประกอบแต่ละชิ้น
- **ขนาด** (กว้าง × ยาว × สูง) เป็นเซนติเมตร
- **วัสดุ** ของแต่ละส่วน
- ลูกศรหรือคำอธิบายว่า **ทำงานอย่างไร** เช่น "พับได้ตรงนี้"
- มุมมองอย่างน้อย 2 ด้าน

:::think
ภาพร่าง "ชั้นวางร่ม" ที่มีแค่รูปกล่องสี่เหลี่ยมพร้อมคำว่า "ชั้นวางร่ม" ขาดอะไรบ้าง
---
ขาดขนาด วัสดุ จำนวนช่องใส่ร่ม การระบายน้ำ (ถาดรอง) วิธียึดกับผนังหรือพื้น และมุมมองอื่น คนอื่นจะสร้างตามภาพนี้ไม่ได้เลย
:::

## ผังงาน: อธิบายการทำงานเป็นขั้นตอน
ใช้กับชิ้นงานที่มีการทำงานอัตโนมัติ เช่น ระบบรดน้ำต้นไม้

**เริ่ม** → อ่านค่าความชื้นดิน → **ดินแห้งไหม?**
- ใช่ → เปิดปั๊มน้ำ 10 วินาที → กลับไปอ่านค่าใหม่
- ไม่ใช่ → รอ 30 นาที → กลับไปอ่านค่าใหม่

:::think
ระบบรดน้ำนี้มีจุดอ่อนอะไร ถ้าเซนเซอร์เสียและส่งค่า "แห้ง" ตลอดเวลา จะแก้ผังงานอย่างไร
---
ปั๊มจะรดน้ำไม่หยุดจนน้ำท่วมกระถาง ควรเพิ่มเงื่อนไข "รดน้ำได้ไม่เกินวันละ 3 ครั้ง" หรือ "ถ้ารดแล้ว 3 รอบค่ายังแห้งอยู่ ให้หยุดและแจ้งเตือน" การคิดถึงกรณีผิดปกติแบบนี้คือการออกแบบที่ปลอดภัย
:::

## วางแผนและคิดงบประมาณ
ทำ **รายการวัสดุ** พร้อมราคา ก่อนซื้อจริง

| วัสดุ | จำนวน | ราคาต่อหน่วย (บาท) | รวม (บาท) |
| --- | --- | --- | --- |
| ท่อ PVC ½ นิ้ว ยาว 4 ม. | 3 เส้น | 45 | 135 |
| ข้อต่อสามทาง | 6 ตัว | 8 | 48 |
| ผ้าใบกันแดด 1×2 ม. | 1 ผืน | 90 | 90 |
| เข็มขัดรัดสายไฟ | 1 ถุง | 25 | 25 |

:::think
คำนวณราคารวมทั้งหมด ถ้างบคือ 300 บาท จะเหลือหรือเกินเท่าไร ถ้าเกิน ควรปรับตรงไหน
---
135 + 48 + 90 + 25 = **298 บาท** เหลือ **2 บาท** ซึ่งเฉียดงบมาก ควรเผื่อเงินไว้ราว 10% สำหรับของเสียหายหรือซื้อเพิ่ม อาจปรับโดยใช้ผ้าไวนิลเก่าที่ขอได้ฟรีแทนผ้าใบ หรือใช้เชือกแทนเข็มขัดรัดสาย
:::

## เลือกวัสดุให้เหมาะ
| วัสดุ | จุดเด่น | จุดด้อย | เหมาะกับ |
| --- | --- | --- | --- |
| กระดาษลัง | เบา ถูก หาง่าย | ไม่ทนน้ำ | ต้นแบบ ทดลองรูปทรง |
| ไม้อัด | แข็งแรง ตัดง่าย | หนัก ขึ้นราถ้าเปียก | ชั้นวาง กล่อง |
| ท่อ PVC | เบา ทนน้ำ ต่อง่าย | งอเมื่อร้อนจัด | โครงสร้างกลางแจ้ง |
| พลาสติกรีไซเคิล | ลดขยะ ทนน้ำ | แข็งแรงไม่เท่ากัน | ชิ้นส่วนตกแต่ง |
| อะลูมิเนียม | เบา แข็งแรง ไม่เป็นสนิม | แพงกว่า | ชิ้นงานใช้จริงระยะยาว |

:::tip
ทำ **ต้นแบบย่อส่วน** ด้วยกระดาษหรือดินน้ำมันก่อน ใช้เวลา 15 นาทีแต่ช่วยประหยัดวัสดุจริงได้มาก
:::
$md$),

(12, 'ลงมือทำอย่างปลอดภัย', $md$
## ก่อนเริ่ม: เช็กลิสต์ 5 ข้อ
1. แบบร่างและรายการวัสดุพร้อม ทุกคนในกลุ่มรู้หน้าที่
2. พื้นที่ทำงานโล่ง แสงพอ ไม่มีน้ำหกบนพื้น
3. สวม **อุปกรณ์ป้องกัน** ให้เหมาะกับงาน
4. รวบผม พับแขนเสื้อ ถอดเครื่องประดับที่ห้อยได้
5. รู้ว่า **ชุดปฐมพยาบาล** และ **ปลั๊กหลัก** อยู่ที่ไหน

:::think
ทำไมการ "รวบผมและถอดสร้อย" จึงสำคัญเมื่อใช้สว่านหรือเครื่องมือที่หมุน
---
เครื่องมือที่หมุนเร็วสามารถดึงผม สร้อย หรือแขนเสื้อที่ห้อยเข้าไปพันได้ภายในเสี้ยววินาที ทำให้บาดเจ็บรุนแรง การป้องกันง่าย ๆ ก่อนเริ่มงานจึงช่วยได้มาก
:::

## อุปกรณ์ป้องกันส่วนบุคคล
| อุปกรณ์ | ป้องกันอะไร | ใช้เมื่อ |
| --- | --- | --- |
| แว่นตานิรภัย | เศษวัสดุกระเด็นเข้าตา | เลื่อย เจาะ ตัด ขัด |
| ถุงมือหนัง/ถุงมือกันบาด | บาด ร้อน | จับชิ้นงานคม ใช้ปืนกาว (ห้ามใช้กับสว่าน) |
| หน้ากากกันฝุ่น | ฝุ่นไม้ ควันบัดกรี | ขัดกระดาษทราย บัดกรี |
| ผ้ากันเปื้อน | สีและกาวเลอะ | ทาสี ติดกาว |
| รองเท้าหุ้มส้น | ของหล่นทับเท้า | ทุกครั้งในห้องปฏิบัติการ |

## ใช้เครื่องมือให้ถูกงาน
| งาน | เครื่องมือ | ข้อควรระวัง |
| --- | --- | --- |
| ตัดกระดาษ/ฟิวเจอร์บอร์ด | คัตเตอร์ + แผ่นรองตัด + ไม้บรรทัดเหล็ก | ตัดออกจากตัว เก็บใบมีดทุกครั้ง |
| ตัดไม้/ท่อ | เลื่อย | จับชิ้นงานด้วยปากกาจับ ไม่ใช้มือจับใกล้ใบเลื่อย |
| เจาะรู | สว่าน | ห้ามใส่ถุงมือผ้า เจาะบนไม้รอง |
| ติดกาว | ปืนกาวร้อน | วางบนขาตั้ง หัวปืนร้อนมาก |
| บัดกรีวงจร | หัวแร้ง | วางบนแท่น ระบายอากาศดี ถอดปลั๊กเมื่อเลิกใช้ |

:::think
เพื่อนกำลังเลื่อยท่อ PVC โดยใช้เข่ากดท่อไว้กับพื้นแทนปากกาจับ นักเรียนจะบอกเพื่อนอย่างไร
---
บอกให้หยุดก่อน แล้วอธิบายว่าท่ออาจลื่นหรือหมุน ทำให้ใบเลื่อยพลาดมาโดนขา ควรยึดท่อด้วยปากกาจับหรือแท่นจับ ให้มือทั้งสองข้างอยู่ห่างจากแนวเลื่อย **การเตือนเพื่อนอย่างสุภาพคือส่วนหนึ่งของความปลอดภัยในห้องปฏิบัติการ**
:::

## ความปลอดภัยทางไฟฟ้าและแบตเตอรี่
- ตรวจสายไฟไม่ให้ชำรุดหรือฉีก ห้ามใช้ปลั๊กพ่วงต่อกันหลายทอด
- มือต้องแห้งเมื่อจับปลั๊กหรืออุปกรณ์ไฟฟ้า
- ต่อวงจรเสร็จ **ตรวจขั้วบวก-ลบ** ก่อนจ่ายไฟ
- **แบตเตอรี่ลิเทียม** (แบตมือถือ พาวเวอร์แบงก์ แบตรีชาร์จ) ห้ามเจาะ บีบ หรือทำให้ร้อนจัด ถ้าแบต **บวม** ให้หยุดใช้ทันทีและแจ้งครู

:::example
โครงงานยุคนี้มักใช้ **บอร์ดไมโครคอนโทรลเลอร์** ต่อกับเซนเซอร์และมอเตอร์ บอร์ดพวกนี้ใช้ไฟน้อยและปลอดภัย แต่ถ้าต่อกับปั๊มน้ำหรือมอเตอร์ที่ใช้ไฟบ้าน 220 โวลต์ ต้องให้ครูหรือผู้เชี่ยวชาญตรวจทุกครั้ง
:::

:::think
ทำไมไม่ควรวางพาวเวอร์แบงก์ชาร์จไฟทิ้งไว้บนเบาะหรือในกระเป๋าที่ปิดสนิทระหว่างทำงาน
---
ระหว่างชาร์จแบตจะร้อนขึ้น ถ้าอยู่ในที่อับ ความร้อนระบายไม่ได้ แบตอาจเสื่อม บวม หรือในกรณีร้ายแรงอาจติดไฟ ควรวางบนพื้นแข็งที่อากาศถ่ายเท
:::

## ถ้าเกิดอุบัติเหตุ
1. **หยุด** งานทันที ปิดเครื่อง ถอดปลั๊ก
2. **แจ้งครู** ทันที แม้แผลจะเล็ก
3. แผลบาด: ล้างน้ำสะอาด กดห้ามเลือดด้วยผ้าสะอาด
4. ถูกของร้อน: เปิดน้ำสะอาดไหลผ่านบริเวณที่ถูกความร้อนนานราว 10–20 นาที **ห้ามทายาสีฟันหรือน้ำแข็งโดยตรง**
5. เศษเข้าตา: ห้ามขยี้ ล้างด้วยน้ำสะอาด

## บันทึกความก้าวหน้าทุกคาบ
| หัวข้อ | ตัวอย่างการบันทึก |
| --- | --- |
| วันนี้ทำอะไร | ตัดท่อ PVC ครบ 8 ท่อน ประกอบโครงด้านล่างเสร็จ |
| ปัญหาที่เจอ | ข้อต่อหลวม โครงโยก |
| แก้อย่างไร | พันเทปพันเกลียวก่อนสวมข้อต่อ |
| คาบหน้าจะทำ | ประกอบโครงด้านบน เย็บผ้าใบ |
| ภาพประกอบ | (แนบรูป 2 รูป) |

:::doctor
บันทึกความก้าวหน้าเป็น **หลักฐาน** ที่จะใช้เขียนรายงานและนำเสนอ อีกทั้งช่วยให้ครูเห็นว่ากลุ่มทำงานอย่างไร ไม่ใช่ดูแค่ผลงานสุดท้าย
:::
$md$),

(13, 'สร้างต้นแบบ', $md$
## ต้นแบบ (Prototype) คืออะไร
**ต้นแบบ** คือชิ้นงานที่สร้างขึ้นเพื่อ **ทดสอบแนวคิด** ก่อนทำชิ้นจริง อาจยังไม่สวย แต่ต้องทำงานได้ตามหลักที่ออกแบบไว้

| ระดับต้นแบบ | ลักษณะ | ตัวอย่าง |
| --- | --- | --- |
| **หยาบ** | กระดาษ ดินน้ำมัน เทปกาว ทำเสร็จในไม่กี่นาที | ทดลองรูปทรงและขนาด |
| **ใช้งานได้** | วัสดุใกล้ของจริง ทำงานได้จริง | ทดสอบความแข็งแรงและการใช้งาน |
| **ใกล้ของจริง** | หน้าตาและวัสดุเหมือนสินค้า | นำเสนอหรือทดลองกับผู้ใช้จริง |

:::example
บริษัทแอปมือถือมักวาดหน้าจอบนกระดาษ แล้วให้ผู้ใช้ลอง "จิ้ม" กระดาษ ผู้ทดสอบจะสลับแผ่นกระดาษเป็นหน้าจอถัดไป วิธีนี้ทำให้รู้ว่าผู้ใช้งงตรงไหนก่อนเขียนโปรแกรมจริงแม้แต่บรรทัดเดียว
:::

:::think
ทำไมไม่ควรทำต้นแบบให้สวยและสมบูรณ์ตั้งแต่ครั้งแรก
---
เพราะต้นแบบแรกมักต้องแก้ ถ้าลงเวลาและเงินไปกับความสวยงามมากแล้วพบว่าแนวคิดใช้ไม่ได้ จะเสียทั้งหมด ควรทำให้ **พอทดสอบได้** ก่อน แล้วค่อยเก็บรายละเอียดเมื่อแน่ใจว่าแนวคิดใช้ได้จริง
:::

## เช็กลิสต์ระหว่างสร้าง
- ทำตามแผนขั้นตอนที่วางไว้หรือไม่
- ถ้าต้องเปลี่ยนวัสดุหรือแบบ **จดเหตุผลไว้** (ใช้ในรายงาน)
- ตั้งชื่อรุ่นต้นแบบ เช่น **รุ่น 1, รุ่น 2** และบันทึกว่าแต่ละรุ่นต่างกันอย่างไร
- ถ่ายภาพทุกขั้นตอนสำคัญ

:::think
กลุ่มหนึ่งตั้งใจใช้ไม้อัด แต่ร้านหมด จึงเปลี่ยนเป็นฟิวเจอร์บอร์ด ควรบันทึกอะไรบ้าง และการเปลี่ยนนี้อาจส่งผลอะไรต่อการทดสอบ
---
บันทึก: วันที่เปลี่ยน สาเหตุ (ร้านหมด) วัสดุใหม่ และผลที่คาดว่าจะเกิด
ผลที่อาจเกิด: ฟิวเจอร์บอร์ดเบากว่าแต่รับน้ำหนักได้น้อยกว่าและไม่ทนน้ำ ผลทดสอบความแข็งแรงอาจต่ำลง ต้องระบุไว้เพื่อให้คนอ่านรายงานเข้าใจว่าทำไมผลเป็นแบบนั้น
:::

## เมื่อประกอบแล้วไม่เป็นไปตามแผน
| อาการ | สาเหตุที่พบบ่อย | วิธีแก้ |
| --- | --- | --- |
| ชิ้นส่วนไม่พอดีกัน | วัดหรือตัดคลาดเคลื่อน | วัด 2 ครั้ง ตัด 1 ครั้ง ใช้แม่แบบช่วยตัด |
| โครงโยก ไม่มั่นคง | ข้อต่อหลวม ไม่มีค้ำยัน | เพิ่มค้ำยันแนวทแยง (รูปสามเหลี่ยมแข็งแรง) |
| กาวไม่ติด | ผิววัสดุมัน ใช้กาวผิดชนิด | ขัดผิวเล็กน้อย เลือกกาวให้ตรงวัสดุ |
| วงจรไม่ทำงาน | สายหลวม ต่อขั้วผิด | ตรวจทีละจุดตามแผนภาพวงจร |

:::doctor
ทำไมสะพานและเสาไฟฟ้าแรงสูงมีโครงเป็นรูปสามเหลี่ยมเต็มไปหมด? เพราะ **สามเหลี่ยมเปลี่ยนรูปไม่ได้** ถ้าไม่เปลี่ยนความยาวด้าน ต่างจากสี่เหลี่ยมที่บิดเป็นสี่เหลี่ยมด้านขนานได้ นี่คือความรู้คณิตศาสตร์ที่ช่วยให้โครงสร้างแข็งแรง
:::

:::think
โครงชั้นวางทรงสี่เหลี่ยมของเพื่อนโยกไปมา ควรเพิ่มชิ้นส่วนตรงไหน
---
เพิ่ม **ค้ำยันแนวทแยง** ที่มุมด้านข้างหรือด้านหลัง ทำให้เกิดรูปสามเหลี่ยม โครงจะหยุดโยกทันทีโดยใช้วัสดุเพิ่มเพียงเล็กน้อย
:::

## ถ่ายภาพต้นแบบให้ดี
- พื้นหลังเรียบ แสงพอ ไม่ย้อนแสง
- ถ่ายอย่างน้อย **2–3 มุม** (หน้า ข้าง ขณะใช้งาน)
- วางไม้บรรทัดหรือวัตถุที่รู้ขนาด (เช่น ปากกา) ข้าง ๆ ให้เห็นขนาดจริง
- ถ่ายคลิปสั้นตอนชิ้นงานทำงาน

## อัปโหลดภาพต้นแบบ
ส่งภาพในหน้างานของคาบนี้ พร้อมคำอธิบายสั้น ๆ ว่า **ส่วนไหนทำหน้าที่อะไร** และ **ต่างจากแบบร่างตรงไหน เพราะอะไร**
$md$),

(14, 'การทดสอบ ประเมินผล และปรับปรุงแก้ไข', $md$
## ทดสอบไปทำไม?
ชิ้นงานที่ "ดูดี" อาจใช้งานจริงไม่ได้ การทดสอบช่วยตอบคำถามว่า **แก้ปัญหาได้จริงไหม** และ **ดีพอตามเงื่อนไขในกรอบของปัญหาหรือยัง**

:::example
ก่อนวางขายรถยนต์รุ่นใหม่ บริษัทจะทดสอบชนด้วยหุ่นจำลองคน ขับในที่ร้อนจัดและหนาวจัด ส่วนแอปมือถือก็ทดสอบกับผู้ใช้กลุ่มเล็กก่อนเปิดให้ทุกคนใช้ ทุกเทคโนโลยีที่เราใช้ผ่านการทดสอบมาแล้วหลายรอบ
:::

## วางแผนการทดสอบ
1. **สิ่งที่จะทดสอบ** มาจากเงื่อนไขในกรอบของปัญหา เช่น รับน้ำหนัก กันแดด กางเสร็จเร็ว
2. **วิธีวัด** ใช้เครื่องมืออะไร หน่วยอะไร
3. **เกณฑ์ผ่าน** ตัวเลขที่ชัดเจน
4. **ทดสอบซ้ำ** อย่างน้อย 3 ครั้ง แล้วหาค่าเฉลี่ย

| สิ่งที่ทดสอบ | วิธีวัด | เกณฑ์ผ่าน |
| --- | --- | --- |
| กางเสร็จเร็ว | จับเวลาด้วยมือถือ | ไม่เกิน 5 นาที |
| กันแดดได้ | เทอร์โมมิเตอร์ใต้ร่ม vs กลางแดด | เย็นกว่าอย่างน้อย 5 °C |
| ยกคนเดียวได้ | ชั่งน้ำหนัก | ไม่เกิน 5 กก. |

## การทดสอบที่ยุติธรรม (ความรู้วิทยาศาสตร์)
ถ้าจะเปรียบเทียบผ้า 2 ชนิด ต้องให้ **ทุกอย่างเหมือนกัน ยกเว้นสิ่งที่ต้องการเปรียบเทียบ**
- วัดเวลาเดียวกัน ที่เดียวกัน
- เทอร์โมมิเตอร์ตัวเดียวกัน ความสูงเดียวกัน
- ผ้าขนาดเท่ากัน

:::think
กลุ่มหนึ่งวัดอุณหภูมิใต้ผ้าสีขาวตอน 9 โมง และใต้ผ้าสีเทาตอนเที่ยง แล้วสรุปว่า "ผ้าสีขาวเย็นกว่า" ข้อสรุปนี้เชื่อได้ไหม
---
**เชื่อไม่ได้** เพราะวัดคนละเวลา ตอนเที่ยงแดดแรงกว่า 9 โมงอยู่แล้ว อุณหภูมิที่ต่างกันอาจมาจากเวลา ไม่ใช่สีผ้า ต้องวัดพร้อมกันในตำแหน่งเดียวกันจึงจะยุติธรรม
:::

## บันทึกผลและใช้คณิตศาสตร์วิเคราะห์
| ครั้งที่ | อุณหภูมิกลางแดด (°C) | ใต้ร่มรุ่น 1 (°C) | ใต้ร่มรุ่น 2 (°C) |
| --- | --- | --- | --- |
| 1 | 38 | 35 | 32 |
| 2 | 39 | 36 | 33 |
| 3 | 37 | 34 | 31 |

:::think
1. หาค่าเฉลี่ยอุณหภูมิกลางแดด ใต้ร่มรุ่น 1 และใต้ร่มรุ่น 2
2. รุ่นไหนผ่านเกณฑ์ "เย็นกว่ากลางแดดอย่างน้อย 5 °C"
---
1. กลางแดด (38 + 39 + 37) ÷ 3 = **38 °C** · รุ่น 1 (35 + 36 + 34) ÷ 3 = **35 °C** · รุ่น 2 (32 + 33 + 31) ÷ 3 = **32 °C**
2. รุ่น 1 เย็นกว่า 3 °C → **ไม่ผ่าน** · รุ่น 2 เย็นกว่า 6 °C → **ผ่าน**

การปรับปรุงจากรุ่น 1 เป็นรุ่น 2 ทำให้เย็นลงอีก 3 °C ข้อมูลตัวเลขแบบนี้ทำให้ผลงานน่าเชื่อถือกว่าการบอกว่า "เย็นขึ้น"
:::

## หาสาเหตุด้วย "ทำไม 5 ครั้ง"
เมื่อชิ้นงานล้มเหลว อย่าแก้ที่อาการ ให้ถาม **"ทำไม"** ไปเรื่อย ๆ จนเจอต้นเหตุ

:::example
**ปัญหา:** ร่มล้มเมื่อมีลม
1. ทำไมล้ม? → ฐานเบาเกินไป
2. ทำไมฐานเบา? → ใช้ฐานพลาสติกกลวง
3. ทำไมใช้ฐานกลวง? → อยากให้ยกง่าย
4. ทำไมต้องยกง่าย? → ป้าต้องยกเก็บคนเดียวทุกวัน
**ต้นเหตุ:** ต้องการทั้ง "เบา" และ "ไม่ล้ม" → **ทางแก้:** ฐานกลวงที่เติมน้ำได้หน้างาน แล้วเทน้ำออกตอนเก็บ ได้ทั้งหนักเวลาใช้และเบาเวลายก
:::

:::think
ถ้ากลุ่มแก้ปัญหาร่มล้มด้วยการ "เอาก้อนอิฐมาทับฐาน" จะขัดกับเงื่อนไขข้อไหน
---
ขัดกับเงื่อนไข "ยกเก็บคนเดียวได้ น้ำหนักไม่เกิน 5 กก." เพราะต้องขนอิฐไปด้วยทุกวัน ทางแก้ที่ดีต้องแก้ปัญหาโดย **ไม่สร้างปัญหาใหม่** ให้ผู้ใช้
:::

## ปรับปรุงแล้วทดสอบซ้ำ
**ระบุส่วนที่บกพร่อง → หาสาเหตุ → เสนอวิธีแก้ → แก้ไข → ทดสอบซ้ำ → เปรียบเทียบผลก่อน-หลัง**

:::doctor
บันทึกผลทุกครั้ง **แม้ผลจะไม่ผ่าน** ห้ามแก้ตัวเลขให้ดูดี ผลที่ไม่ผ่านคือข้อมูลสำคัญที่บอกเราว่าต้องปรับตรงไหน นักวิทยาศาสตร์และวิศวกรมืออาชีพต่างเรียนรู้จากผลที่ล้มเหลว
:::
$md$),

(15, 'การเขียนรายงานโครงงาน', $md$
## รายงานเขียนให้ใครอ่าน?
รายงานช่วยให้ **คนที่ไม่ได้อยู่ในกลุ่ม** เข้าใจว่าเราแก้ปัญหาอะไร อย่างไร และได้ผลแค่ไหน รวมถึงทำตามหรือพัฒนาต่อได้ ผู้อ่านอาจเป็นครู เพื่อนรุ่นน้อง กรรมการประกวด หรือคนในชุมชนที่จะนำไปใช้

## องค์ประกอบของรายงาน
1. **ปก** ชื่อโครงงาน ผู้จัดทำ ชั้น/ห้อง ครูที่ปรึกษา
2. **บทคัดย่อ** สรุปทั้งโครงงานใน 1 ย่อหน้า
3. **กิตติกรรมประกาศ** ขอบคุณผู้ช่วยเหลือ
4. **สารบัญ**
5. **บทนำ** ที่มาและความสำคัญ ปัญหา วัตถุประสงค์ ขอบเขต
6. **ข้อมูลและแนวคิดที่เกี่ยวข้อง** สิ่งที่ค้นคว้า แนวคิดที่เปรียบเทียบ
7. **วิธีดำเนินงาน** วัสดุอุปกรณ์ ขั้นตอน ภาพร่าง
8. **ผลการดำเนินงาน** ผลการทดสอบ ตาราง กราฟ
9. **สรุป อภิปรายผล และข้อเสนอแนะ**
10. **บรรณานุกรม**
11. **ภาคผนวก** ภาพเพิ่มเติม แบบสอบถาม บันทึกความก้าวหน้า

:::think
ถ้าคนอ่านมีเวลาอ่านแค่ 1 นาที เขาควรอ่านส่วนไหน และส่วนนั้นต้องมีอะไรบ้าง
---
**บทคัดย่อ** ต้องบอกให้ครบใน 1 ย่อหน้าว่า ปัญหาคืออะไร ทำอะไร ทดสอบอย่างไร ได้ผลเท่าไร (มีตัวเลข) และสรุปว่าแก้ปัญหาได้หรือไม่ จึงควรเขียนบทคัดย่อ **เป็นส่วนสุดท้าย** หลังรู้ผลครบแล้ว
:::

## เขียนให้ชัด: เปรียบเทียบ
| ❌ เขียนกว้าง ๆ | ✅ เขียนชัดเจน |
| --- | --- |
| ร่มของเราเย็นมาก | ใต้ร่มรุ่น 2 อุณหภูมิเฉลี่ย 32 °C ต่ำกว่ากลางแดด 6 °C |
| ทำไม่นานก็เสร็จ | ใช้เวลาสร้าง 3 คาบ (6 ชั่วโมง) |
| ป้าชอบมาก | ป้าแดงให้คะแนนความพึงพอใจ 5 จาก 5 และใช้ต่อเนื่อง 4 สัปดาห์ |
| มีปัญหานิดหน่อย | โครงโยกเมื่อลมแรง แก้โดยเพิ่มค้ำยันแนวทแยง 2 ชิ้น |

:::think
ปรับประโยคนี้ให้ชัดเจนขึ้น: "เราทดสอบหลายรอบ ผลออกมาดีขึ้นเรื่อย ๆ"
---
ตัวอย่าง: "ทดสอบรุ่นละ 3 ครั้ง รวม 2 รุ่น รุ่น 1 ลดอุณหภูมิได้เฉลี่ย 3 °C ส่วนรุ่น 2 ซึ่งเปลี่ยนเป็นผ้าสะท้อนแสง ลดได้เฉลี่ย 6 °C ผ่านเกณฑ์ที่ตั้งไว้ 5 °C"
บอก **จำนวนครั้ง ตัวเลข สิ่งที่เปลี่ยน และเกณฑ์** ครบ
:::

## ตาราง กราฟ และภาพ
- ทุกตาราง ภาพ และกราฟต้องมี **ชื่อและเลขลำดับ** เช่น "ตารางที่ 1 ผลการวัดอุณหภูมิ"
- กราฟแท่งเหมาะกับเปรียบเทียบหลายรุ่น กราฟเส้นเหมาะกับการเปลี่ยนแปลงตามเวลา
- อ้างถึงในเนื้อหาด้วย เช่น "จากตารางที่ 1 พบว่า…"

## อ้างอิงแหล่งข้อมูล
ทุกข้อมูลที่ไม่ได้คิดหรือวัดเอง ต้องอ้างอิงใน **บรรณานุกรม**

:::example
**รูปแบบอย่างง่าย**
- เว็บไซต์: ชื่อผู้เขียน/หน่วยงาน. (ปี). *ชื่อบทความ*. ชื่อเว็บไซต์. ลิงก์
- หนังสือ: ชื่อผู้แต่ง. (ปี). *ชื่อหนังสือ*. สำนักพิมพ์.
- สัมภาษณ์: ชื่อผู้ให้สัมภาษณ์. (วันที่). สัมภาษณ์โดย ชื่อผู้สัมภาษณ์.
:::

## ใช้ AI ช่วยเขียนอย่างซื่อสัตย์
AI ช่วยได้ เช่น ตรวจคำผิด แนะนำโครงเรื่อง อธิบายศัพท์ แต่
- **ห้ามให้ AI เขียนแทนทั้งหมด** แล้วส่งเป็นงานตัวเอง
- **ข้อมูลและตัวเลขต้องมาจากการทดสอบจริงของกลุ่ม** AI ไม่รู้ผลการทดลองของเรา
- **ตรวจทุกข้อเท็จจริง** ที่ AI ให้มา
- **ระบุไว้ในรายงาน** ว่าใช้ AI ช่วยส่วนไหน

:::think
เพื่อนให้ AI เขียน "ผลการทดสอบ" ทั้งบท ออกมาเป็นตัวเลขสวยงาม แต่กลุ่มยังไม่ได้ทดสอบจริง ผิดอย่างไร
---
เป็นการ **สร้างข้อมูลเท็จ** ซึ่งผิดจริยธรรมร้ายแรง ผู้อ่านอาจนำชิ้นงานไปใช้โดยเชื่อว่าได้ผลจริง และกลุ่มเองไม่ได้เรียนรู้อะไรจากการทดสอบเลย ผลจริงที่ไม่สวยงามมีค่ากว่าผลปลอมที่สวยงามเสมอ
:::

:::tip
เขียนรายงานจาก **บันทึกความก้าวหน้า** ที่ทำทุกคาบ จะง่ายกว่าเริ่มจากหน้ากระดาษว่างมาก
:::
$md$),

(16, 'การนำเสนองาน', $md$
## นำเสนอได้หลายรูปแบบ
| รูปแบบ | จุดเด่น | ข้อควรระวัง |
| --- | --- | --- |
| สไลด์ประกอบการพูด | จัดลำดับเรื่องได้ดี | อย่าอ่านสไลด์ทุกคำ |
| โปสเตอร์ | สรุปในแผ่นเดียว คนเดินดูได้ | ตัวหนังสือต้องใหญ่พอ |
| คลิปวิดีโอสั้น | ดูซ้ำได้ แชร์ง่าย | ต้องตัดต่อให้กระชับ |
| สาธิตจริง | เห็นผลงานทำงานจริง | ซ้อมก่อน เตรียมแผนสำรองถ้าเครื่องไม่ทำงาน |

:::example
**คลิปสั้น 60 วินาที** เป็นรูปแบบที่นิยมมากในยุคนี้ ผู้ประกอบการรุ่นใหม่ใช้เล่าสินค้าในโซเชียลมีเดีย โครงสร้างที่ได้ผล: 5 วินาทีแรกเปิดด้วยปัญหาที่คนดูรู้สึกได้ → แสดงชิ้นงานแก้ปัญหา → โชว์ผลก่อน-หลัง → ปิดด้วยข้อความชวนจำ
:::

## โครงเรื่องการนำเสนอ (5–7 นาที)
1. **เปิดเรื่องด้วยปัญหา** เล่าเรื่องคนจริงที่เจอปัญหา (30 วินาที)
2. **กรอบของปัญหา** เงื่อนไขที่ต้องทำให้ได้ (30 วินาที)
3. **แนวคิดที่พิจารณา** และเหตุผลที่เลือก (1 นาที)
4. **การออกแบบและสร้าง** ภาพร่าง ภาพขั้นตอน (1–2 นาที)
5. **ผลการทดสอบและการปรับปรุง** ตัวเลขก่อน-หลัง (1–2 นาที)
6. **สรุปและสิ่งที่จะพัฒนาต่อ** (30 วินาที)

:::think
ประโยคเปิดแบบไหนน่าฟังกว่ากัน
ก. "สวัสดีครับ วันนี้กลุ่มผมจะมานำเสนอโครงงานที่บังแดดครับ"
ข. "ทุกเช้าวันเสาร์ ป้าแดงต้องลดราคาผักเพราะผักเหี่ยวกลางแดด วันนี้เราจะเล่าว่าเราช่วยป้าอย่างไร"
---
**ข.** น่าฟังกว่า เพราะเริ่มจาก **คนจริงและปัญหาจริง** ผู้ฟังรู้สึกเห็นใจและอยากรู้ต่อ แบบ ก. ถูกต้องแต่ไม่ดึงดูด
:::

## สไลด์ที่ดี
- สไลด์ละ **1 ประเด็นหลัก**
- ข้อความน้อย ภาพเยอะ ตัวอักษรใหญ่พอให้คนหลังห้องอ่านได้
- ใช้ **ตัวเลขจากการทดสอบ** แสดงเป็นกราฟ
- สีอ่านง่าย ไม่ใช้พื้นหลังลายเยอะ

:::think
สไลด์หนึ่งมีข้อความ 12 บรรทัดเกี่ยวกับวิธีสร้างชิ้นงาน ควรปรับอย่างไร
---
แบ่งเป็น 2–3 สไลด์ หรือเปลี่ยนเป็น **ภาพขั้นตอน 4 ภาพ + คำบรรยายสั้น ๆ** แล้วให้ผู้นำเสนอเป็นคนเล่ารายละเอียดด้วยคำพูด ผู้ฟังจะฟังเราแทนที่จะก้มอ่านสไลด์
:::

## เทคนิคพูดให้น่าฟัง
- สบตาผู้ฟัง พูดดัง ชัด ไม่เร็วเกิน
- ซ้อมพร้อมจับเวลาอย่างน้อย 2 รอบ
- แบ่งหน้าที่พูดในกลุ่มให้ทุกคนมีส่วนร่วม
- เตรียม **คำถามที่น่าจะถูกถาม** และคำตอบไว้ล่วงหน้า

## ตอบคำถามอย่างมืออาชีพ
| สถานการณ์ | วิธีตอบ |
| --- | --- |
| รู้คำตอบ | ตอบตรงประเด็น อ้างข้อมูลหรือผลทดสอบ |
| ไม่รู้คำตอบ | "ประเด็นนี้เรายังไม่ได้ทดสอบ เป็นข้อเสนอแนะที่ดีสำหรับรุ่นถัดไป" |
| ถูกวิจารณ์ | ขอบคุณ จดไว้ ไม่โต้เถียง |

:::think
กรรมการถามว่า "ถ้าฝนตก ร่มนี้ใช้ได้ไหม" แต่กลุ่มไม่เคยทดสอบตอนฝนตก ควรตอบอย่างไร
---
ตอบตามจริงว่ายังไม่ได้ทดสอบกับฝน บอกสิ่งที่รู้ เช่น ผ้าใบที่ใช้กันน้ำได้แต่โครงอาจต้องเสริม แล้วเสนอว่าจะทดสอบเพิ่มในรุ่นถัดไป **ความซื่อสัตย์ดีกว่าการเดาคำตอบ**
:::

## ฟังเพื่อนนำเสนอก็เป็นการเรียนรู้
ใช้เกณฑ์นี้ให้ข้อเสนอแนะเพื่อน
- **ชอบ** 1 อย่าง (บอกเจาะจง)
- **สงสัย** 1 คำถาม
- **เสนอ** 1 แนวทางพัฒนา

:::doctor
การให้ข้อเสนอแนะที่ดีต้อง **เจาะจงและสร้างสรรค์** เช่น "ชอบที่มีกราฟก่อน-หลังชัดเจน" ดีกว่า "ดีมากครับ" และ "ลองเพิ่มค้ำยันด้านหลังไหม" ดีกว่า "ยังไม่แข็งแรง"
:::

:::tip
หลังนำเสนอ จะมีแบบทดสอบท้ายหน่วยที่ 2 และ Boss Battle หน่วย 2 ให้ทบทวน
:::
$md$),

(17, 'การเพิ่มมูลค่าเทคโนโลยี', $md$
## มูลค่าเพิ่มคืออะไร
**มูลค่าเพิ่ม** คือการทำให้ผลิตภัณฑ์หรือเทคโนโลยีมีคุณค่าในสายตาผู้ใช้มากขึ้น จนยอมจ่ายแพงขึ้นหรือเลือกใช้มากขึ้น

## 5 แนวทางเพิ่มมูลค่า
| แนวทาง | ตัวอย่าง |
| --- | --- |
| ออกแบบรูปลักษณ์ | เปลี่ยนสีและลวดลายผ้าทอให้ทันสมัย |
| เพิ่มฟังก์ชัน | กระติกน้ำที่บอกอุณหภูมิได้ |
| เปลี่ยนวัสดุ | ใช้วัสดุธรรมชาติย่อยสลายได้ |
| บรรจุภัณฑ์ | กล่องข้าวเกรียบที่ปิดซ้ำได้ เก็บความกรอบ |
| การตลาด / เล่าเรื่องแบรนด์ | เล่าเรื่องชุมชนและภูมิปัญญาที่อยู่เบื้องหลังสินค้า |

## สิ่งที่ต้องคำนึง
- ผู้ใช้ต้องการอะไรจริง ๆ
- ต้นทุนที่เพิ่มคุ้มกับราคาขายที่เพิ่มหรือไม่
- ผลต่อสิ่งแวดล้อม
- มาตรฐานผลิตภัณฑ์ เช่น มาตรฐานผลิตภัณฑ์ชุมชน (มผช.)

:::doctor
มูลค่าที่เพิ่มขึ้น = ราคาขายใหม่ − ราคาขายเดิม แต่กำไรจริงต้องหักต้นทุนที่เพิ่มขึ้นด้วย อย่าลืมคิดเลขก่อนตัดสินใจลงทุนนะ!
:::
$md$),

(18, 'เปิดโลกทรัพย์สินทางปัญญา', $md$
## ทรัพย์สินทางปัญญาคืออะไร
ผลงานที่เกิดจาก **ความคิดสร้างสรรค์** ของมนุษย์ กฎหมายคุ้มครองให้เจ้าของมีสิทธิ์ในผลงานนั้น ในประเทศไทยดูแลโดย **กรมทรัพย์สินทางปัญญา**

## ประเภทต่าง ๆ
| ประเภท | คุ้มครองอะไร | ตัวอย่าง |
| --- | --- | --- |
| ลิขสิทธิ์ | งานสร้างสรรค์ เช่น หนังสือ เพลง ภาพ โปรแกรมคอมพิวเตอร์ | นิยาย เพลง เกม |
| สิทธิบัตรการประดิษฐ์ | สิ่งประดิษฐ์ใหม่ที่มีขั้นการประดิษฐ์สูงขึ้น | กลไกใหม่ของเครื่องจักร |
| สิทธิบัตรการออกแบบผลิตภัณฑ์ | รูปร่าง ลวดลาย สีของผลิตภัณฑ์ | รูปทรงขวดน้ำแบบใหม่ |
| อนุสิทธิบัตร | การประดิษฐ์ที่ไม่ซับซ้อนมาก เป็นการปรับปรุงเล็กน้อย | ด้ามจับกระทะแบบพับได้ |
| เครื่องหมายการค้า | ชื่อ โลโก้ สัญลักษณ์ ที่ใช้แยกสินค้า/บริการ | โลโก้แบรนด์ |
| ความลับทางการค้า | ข้อมูลที่มีมูลค่าเพราะเป็นความลับ | สูตรน้ำจิ้มของร้าน |
| สิ่งบ่งชี้ทางภูมิศาสตร์ (GI) | ชื่อสินค้าที่คุณภาพมาจากแหล่งผลิตเฉพาะถิ่น | ข้าวหอมมะลิทุ่งกุลาร้องไห้ |

:::doctor
ลิขสิทธิ์เกิดขึ้น **ทันที** ที่สร้างผลงาน ไม่ต้องจดทะเบียน ส่วนสิทธิบัตร อนุสิทธิบัตร และเครื่องหมายการค้าต้อง **ยื่นจดทะเบียน** จึงจะได้รับความคุ้มครอง
:::

## เคารพทรัพย์สินทางปัญญา
- อ้างอิงแหล่งที่มาทุกครั้ง
- ขออนุญาตเจ้าของก่อนนำไปใช้ โดยเฉพาะเชิงพาณิชย์
- ใช้สื่อที่เปิดให้ใช้ เช่น Creative Commons หรือคลังภาพฟรีที่ระบุเงื่อนไข
- ไม่ดาวน์โหลดหรือเผยแพร่ของละเมิดลิขสิทธิ์

:::tip
ระยะเวลาคุ้มครองแตกต่างกันในแต่ละประเภท ครูจะสรุปตัวเลขที่เป็นปัจจุบันให้ในชั่วโมงเรียน (ตรวจสอบได้จากเว็บไซต์กรมทรัพย์สินทางปัญญา)
:::
$md$),

(19, 'เพิ่มมูลค่าผลงานตนเอง', $md$
## กิจกรรมท้ายบท
นำชิ้นงานจากโครงงานหน่วยที่ 2 มาวางแผน **เพิ่มมูลค่า** โดยตอบคำถาม

1. ผู้ใช้กลุ่มเป้าหมายคือใคร ต้องการอะไร
2. จะเพิ่มมูลค่าด้านใด (ออกแบบ ฟังก์ชัน วัสดุ บรรจุภัณฑ์ การตลาด) เพราะอะไร
3. ร่างภาพผลงานหลังปรับปรุง และออกแบบโลโก้หรือชื่อแบรนด์
4. ประมาณต้นทุนที่เพิ่ม และราคาที่ควรขาย
5. ผลงานของเราได้รับความคุ้มครองทรัพย์สินทางปัญญาประเภทใด และเราใช้ผลงานของใครบ้างที่ต้องอ้างอิง

## เกณฑ์การให้คะแนน (2 คะแนน)
- แนวทางเพิ่มมูลค่าเหมาะสมกับผู้ใช้ มีเหตุผล (1 คะแนน)
- ระบุทรัพย์สินทางปัญญาได้ถูกต้อง อ้างอิงครบ (1 คะแนน)

:::doctor
โลโก้หรือชื่อแบรนด์ที่เราคิดเอง หากนำไปใช้ขายจริงสามารถยื่นจดเครื่องหมายการค้าได้ แต่ต้องตรวจก่อนว่าไม่ซ้ำหรือคล้ายของคนอื่น
:::
$md$),

(20, 'ทบทวนทุกหน่วยและสอบปลายภาค', $md$
## Final Quest
ด่านต่อเนื่อง 3 ด่าน หน่วยละ 1 ด่าน ใช้ทบทวนก่อนสอบปลายภาค

## ขอบเขตการสอบปลายภาค
ทุกหน่วย: เทคโนโลยีเปลี่ยนโลก · เทคโนโลยีแก้ปัญหา · เทคโนโลยีเพิ่มมูลค่า

## สอบหลังเรียน
ใช้ข้อสอบชุดเดียวกับสอบก่อนเรียน (คาบที่ 1) เพื่อดูว่าเราพัฒนาขึ้นเท่าไร

:::doctor
ขอบคุณที่ตั้งใจเรียนตลอดเทอม! ทักษะการระบุปัญหา ออกแบบ ทดสอบ และปรับปรุง ใช้ได้กับทุกเรื่องในชีวิต ไม่ใช่แค่วิชานี้
:::
$md$)
) as v(no, title, md)
join public.class_sessions cs on cs.session_no = v.no
where not exists (select 1 from public.lessons l where l.session_no = v.no);

-- ---------- E. งาน / รายการคะแนน ----------
-- งานรายคาบรวม 30 · โครงงาน 15 · ทดสอบท้ายหน่วย 15 · กลางภาค 20 · ปลายภาค 20
-- กำหนดส่ง (due_at) ปล่อยว่างไว้ให้ครูตั้งเองในหน้าแอดมิน
insert into public.assignments (session_no, unit_id, title, instructions_md, type, max_score, category, rubric, config, sort_order)
select v.no, cs.unit_id, v.title, v.md, v.type, v.max, v.cat, v.rubric::jsonb, v.config::jsonb, v.ord
from (values
  (2, 'กิจกรรม 1.1 ไทม์ไลน์เทคโนโลยี',
   'เลือกเทคโนโลยีการสื่อสาร 1 อย่าง แล้วกรอกตาราง "อดีต → ปัจจุบัน → อนาคต" พร้อมระบุปัจจัยที่ทำให้เปลี่ยนแปลงในแต่ละช่วง',
   'table', 3, 'work',
   '[{"criterion":"ระบุลักษณะเทคโนโลยีแต่ละช่วงได้ถูกต้อง","points":1},{"criterion":"วิเคราะห์ปัจจัยการเปลี่ยนแปลงได้สมเหตุสมผล","points":1},{"criterion":"คาดการณ์อนาคตได้มีเหตุผล","points":1}]',
   '{"columns":["ช่วงเวลา","ลักษณะเทคโนโลยี","ปัจจัยที่ทำให้เปลี่ยน"],"rows":3}', 1),
  (3, 'กิจกรรม 1.2 ยากแค่ไหนกว่าจะได้ใช้รถยนต์',
   'เปรียบเทียบรถยนต์ไฟฟ้า 2 ประเภท (เช่น HEV กับ BEV) ด้านแหล่งพลังงาน ข้อดี ข้อจำกัด และคำนวณค่าใช้จ่ายพลังงานต่อ 100 กิโลเมตรอย่างง่าย',
   'table', 3, 'work',
   '[{"criterion":"เปรียบเทียบได้ถูกต้องครบทุกหัวข้อ","points":2},{"criterion":"คำนวณค่าใช้จ่ายได้ถูกต้อง","points":1}]',
   '{"columns":["หัวข้อ","ประเภทที่ 1","ประเภทที่ 2"],"rows":4}', 1),
  (4, 'ใบงานวิเคราะห์ระบบส่งของ',
   'เลือกบริการส่งของ 1 แบบ (เช่น ส่งพัสดุ ส่งอาหาร) วิเคราะห์ขั้นตอนตั้งแต่รับของจนถึงผู้รับ และระบุเทคโนโลยีที่ใช้ในแต่ละขั้น',
   'table', 3, 'work',
   '[{"criterion":"ระบุขั้นตอนได้ครบ","points":1},{"criterion":"ระบุเทคโนโลยีได้ถูกต้องเหมาะสม","points":1},{"criterion":"เสนอแนวทางปรับปรุงได้","points":1}]',
   '{"columns":["ขั้นตอน","เทคโนโลยีที่ใช้","ประโยชน์"],"rows":5}', 1),
  (5, 'ชิ้นงานกลุ่ม: ข้าวมันไก่แสนอร่อย',
   'อัปโหลดภาพแผนภาพเส้นทางวัตถุดิบและเทคโนโลยีของกลุ่ม (ส่งคนเดียวต่อกลุ่ม หรือทุกคนตามที่ครูกำหนด) พร้อมพิมพ์รายชื่อสมาชิก',
   'file', 2, 'work',
   '[{"criterion":"ระบุเทคโนโลยีครบทุกขั้น","points":1},{"criterion":"วิเคราะห์ปัจจัยการเปลี่ยนแปลงได้","points":1}]', '{}', 1),
  (6, 'กิจกรรมท้ายบท: เทคโนโลยีเปลี่ยนโลก',
   'สรุปไทม์ไลน์เทคโนโลยีที่เลือก พร้อมความรู้วิทยาศาสตร์/คณิตศาสตร์ที่เกี่ยวข้อง และผลกระทบทางบวก-ลบ',
   'text', 2, 'work',
   '[{"criterion":"เชื่อมโยงกับวิทยาศาสตร์หรือคณิตศาสตร์ได้","points":1},{"criterion":"วิเคราะห์ผลกระทบได้","points":1}]', '{}', 1),
  (6, 'ทดสอบท้ายหน่วยที่ 1', 'คะแนนจากแบบทดสอบท้ายหน่วย (20 ข้อ แปลงเป็น 5 คะแนน)', 'score_only', 5, 'unit_test', '[]', '{}', 2),
  (7, 'ใบงานกรณีศึกษาอาชีพ',
   'เลือกอาชีพ 1 อาชีพในชุมชน ระบุปัญหา เทคโนโลยีที่ช่วยแก้ และเทียบกับขั้นตอนการออกแบบเชิงวิศวกรรม',
   'table', 2, 'work',
   '[{"criterion":"ระบุปัญหาและเทคโนโลยีได้ถูกต้อง","points":1},{"criterion":"เทียบกับขั้นตอนได้เหมาะสม","points":1}]',
   '{"columns":["ขั้นตอนการออกแบบเชิงวิศวกรรม","สิ่งที่อาชีพนี้ทำ"],"rows":6}', 1),
  (8, 'แบบบันทึกสัมภาษณ์ชุมชน',
   'สัมภาษณ์คนในชุมชน 1 คน บันทึกคำตอบตาม 5W1H แล้วสรุปกรอบของปัญหาในช่องสุดท้าย',
   'table', 2, 'work',
   '[{"criterion":"บันทึกข้อมูล 5W1H ครบ","points":1},{"criterion":"สรุปกรอบของปัญหาได้ชัดเจน มีเงื่อนไข","points":1}]',
   '{"columns":["หัวข้อ","คำตอบจากการสัมภาษณ์"],"rows":7}', 1),
  (9, 'กิจกรรม 2.3 หาทางแก้ปัญหา',
   'เสนอแนวคิดอย่างน้อย 3 แนวคิด ให้คะแนนตามเกณฑ์ ต้นทุน ความปลอดภัย ความเป็นไปได้ เวลา แล้วเลือกแนวคิดที่ดีที่สุดพร้อมเหตุผลและแหล่งอ้างอิง',
   'table', 2, 'work',
   '[{"criterion":"เปรียบเทียบด้วยเกณฑ์ได้ครบ","points":1},{"criterion":"ให้เหตุผลและอ้างอิงแหล่งข้อมูล","points":1}]',
   '{"columns":["แนวคิด","ต้นทุน","ความปลอดภัย","ความเป็นไปได้","เวลา","รวม"],"rows":3}', 1),
  (10, 'สอบกลางภาค', 'คะแนนสอบกลางภาค', 'score_only', 20, 'midterm', '[]', '{}', 1),
  (11, 'แบบร่างชิ้นงาน',
   'อัปโหลดภาพร่างชิ้นงาน (ระบุชื่อส่วนประกอบ ขนาด วัสดุ) และพิมพ์แผนขั้นตอนการสร้าง',
   'file', 3, 'work',
   '[{"criterion":"ภาพร่างมีส่วนประกอบ ขนาด วัสดุ","points":2},{"criterion":"แผนขั้นตอนชัดเจน","points":1}]', '{}', 1),
  (12, 'โครงงาน: บันทึกความก้าวหน้า',
   'บันทึกว่าวันนี้ทำอะไร มีปัญหาอะไร แก้อย่างไร และคาบหน้าจะทำอะไร',
   'text', 2, 'project', '[{"criterion":"บันทึกครบ 4 หัวข้อ","points":2}]', '{}', 1),
  (13, 'โครงงาน: ภาพต้นแบบ',
   'อัปโหลดภาพต้นแบบอย่างน้อย 2 มุม พร้อมคำอธิบายการทำงาน',
   'file', 3, 'project',
   '[{"criterion":"ต้นแบบตรงกับแบบร่าง","points":2},{"criterion":"อธิบายการทำงานได้","points":1}]', '{}', 1),
  (14, 'โครงงาน: ตารางบันทึกผลทดสอบ',
   'บันทึกผลการทดสอบอย่างน้อย 3 ครั้ง ระบุข้อบกพร่องและการปรับปรุง',
   'table', 3, 'project',
   '[{"criterion":"ทดสอบตามเกณฑ์และบันทึกจริง","points":2},{"criterion":"วิเคราะห์และปรับปรุงได้","points":1}]',
   '{"columns":["ครั้งที่","สิ่งที่วัด","ผลที่ได้","ผ่าน/ไม่ผ่าน","การปรับปรุง"],"rows":3}', 1),
  (15, 'โครงงาน: รายงาน',
   'อัปโหลดรายงานโครงงานเป็นไฟล์ PDF ตามองค์ประกอบที่เรียน',
   'file', 4, 'project',
   '[{"criterion":"องค์ประกอบครบ","points":2},{"criterion":"เนื้อหาชัดเจน มีผลทดสอบ","points":1},{"criterion":"อ้างอิงถูกต้อง","points":1}]', '{}', 1),
  (16, 'โครงงาน: การนำเสนอ', 'ครูให้คะแนนจากการนำเสนอในห้องเรียน', 'score_only', 3, 'project', '[]', '{}', 1),
  (16, 'ทดสอบท้ายหน่วยที่ 2', 'คะแนนจากแบบทดสอบท้ายหน่วย', 'score_only', 5, 'unit_test', '[]', '{}', 2),
  (17, 'กิจกรรม 3.1 เพิ่มมูลค่าให้กับเทคโนโลยี',
   'เลือกสินค้าท้องถิ่น 1 ชิ้น เสนอแนวทางเพิ่มมูลค่าอย่างน้อย 3 ด้าน พร้อมประมาณต้นทุนและราคาขายใหม่',
   'text', 3, 'work',
   '[{"criterion":"เสนอแนวทางได้หลากหลาย เหมาะสม","points":2},{"criterion":"คำนวณมูลค่าที่เพิ่มขึ้นได้","points":1}]', '{}', 1),
  (18, 'กิจกรรม 3.2 จัดประเภททรัพย์สินทางปัญญา',
   'ช่วยนนท์และน้ำหวานหาตัวอย่างทรัพย์สินทางปัญญาในชีวิตประจำวัน แล้วจัดประเภทพร้อมเหตุผล',
   'table', 3, 'work',
   '[{"criterion":"จัดประเภทถูกต้อง","points":2},{"criterion":"ให้เหตุผลได้","points":1}]',
   '{"columns":["ตัวอย่าง","ประเภททรัพย์สินทางปัญญา","เหตุผล"],"rows":7}', 1),
  (19, 'กิจกรรมท้ายบท: เพิ่มมูลค่าผลงานตนเอง',
   'อัปโหลดภาพร่างผลงานหลังปรับปรุง/โลโก้ และตอบคำถาม 5 ข้อในหน้าเนื้อหาไว้ในช่องหมายเหตุ',
   'file', 2, 'work',
   '[{"criterion":"แนวทางเพิ่มมูลค่าเหมาะสม มีเหตุผล","points":1},{"criterion":"ระบุทรัพย์สินทางปัญญาและอ้างอิงครบ","points":1}]', '{}', 1),
  (19, 'ทดสอบท้ายหน่วยที่ 3', 'คะแนนจากแบบทดสอบท้ายหน่วย', 'score_only', 5, 'unit_test', '[]', '{}', 2),
  (20, 'สอบปลายภาค', 'คะแนนสอบปลายภาค', 'score_only', 20, 'final', '[]', '{}', 1)
) as v(no, title, md, type, max, cat, rubric, config, ord)
join public.class_sessions cs on cs.session_no = v.no
where not exists (select 1 from public.assignments a where a.session_no = v.no and a.title = v.title);

-- >>>>>>>>>> seed_questions.sql
-- =============================================================
-- Seed คลังข้อสอบฉบับร่าง (สร้างอัตโนมัติจาก supabase/questions/questions.txt)
-- ห้ามแก้ไฟล์นี้ตรง ๆ — แก้ questions.txt แล้วรัน: node scripts/build-question-seed.mjs
-- รันหลัง seed.sql · รันซ้ำได้ (ไม่สร้างซ้ำ และไม่ทับข้อที่ครูแก้แล้ว)
-- ทุกข้อติดป้าย reviewed = false ("ร่างจาก AI ยังไม่ตรวจ") จนกว่าครูกด "ตรวจแล้ว"
-- ข้อสอบ 150 ข้อ · ชุดสอบ 25 ชุด
-- =============================================================

insert into public.questions (id, unit_id, topic, indicator, type, prompt, choices, correct_answer, explanation, difficulty, reviewed)
values
  ('95084506-a968-45d0-aa14-69ae457d65f4', null, '', null, 'mcq', 'วิชานี้แบ่งเนื้อหาเป็นกี่หน่วยการเรียนรู้', '["4 หน่วย","5 หน่วย","3 หน่วย","2 หน่วย"]'::jsonb, '{"index":2}'::jsonb, 'ตลอดเทอมเรียน 3 หน่วย: เปลี่ยนโลก แก้ปัญหา เพิ่มมูลค่า', 'easy', false),
  ('057a9dc2-255a-46d4-a28e-f36c73d47d75', null, '', null, 'mcq', 'ขั้นตอนใดอยู่ท้ายสุดของแต่ละคาบเรียน', '["สรุป","เกม","Exit ticket","เนื้อหา"]'::jsonb, '{"index":0}'::jsonb, 'ลำดับในคาบ: อุ่นเครื่อง เนื้อหา เกม งาน Exit ticket และสรุป', 'easy', false),
  ('185ab34b-636d-46cb-aa91-a0771bc5f5ec', null, '', null, 'true_false', 'นักเรียนสามารถให้เพื่อนยืมรหัสนักเรียนเข้าระบบแทนได้', '[]'::jsonb, '{"value":false}'::jsonb, 'ต้องใช้รหัสของตัวเองเท่านั้น', 'easy', false),
  ('d49bb688-e097-4790-a0d4-b2b2a0bd8826', null, '', null, 'mcq', 'ได้รับ XP ครบกี่ XP จึงจะเลื่อนขึ้น 1 เลเวล', '["100","200","500","150"]'::jsonb, '{"index":1}'::jsonb, 'ทุก 200 XP เลื่อน 1 เลเวล', 'easy', false),
  ('7ba4c06b-ffbf-447b-a1d4-752169c18515', null, '', null, 'mcq', 'คะแนนสอบกลางภาคและปลายภาครวมกันคิดเป็นกี่คะแนนจาก 100', '["30","60","20","40"]'::jsonb, '{"index":3}'::jsonb, 'กลางภาค 20 + ปลายภาค 20 = 40', 'medium', false),
  ('d331c688-1837-4ae9-ac54-ab93565683ff', (select id from public.units where no = 1), '1.1', 1, 'mcq', 'เครือข่ายยุคใดเริ่มส่งข้อความสั้น (SMS) ได้', '["4G","3G","2G","1G"]'::jsonb, '{"index":2}'::jsonb, '2G เป็นยุคดิจิทัลยุคแรกที่ส่ง SMS ได้', 'easy', false),
  ('b53f6419-139d-4c40-aff2-9cef0a102608', (select id from public.units where no = 1), '1.1', 1, 'mcq', 'ข้อใดเป็นจุดเด่นของ 5G ที่ทำให้เหมาะกับรถยนต์ไร้คนขับมากที่สุด', '["เสาสัญญาณน้อย","ใช้คลื่นความถี่ต่ำ","ความหน่วงต่ำ","ราคาถูก"]'::jsonb, '{"index":2}'::jsonb, 'รถไร้คนขับต้องตอบสนองทันที จึงต้องการความหน่วงต่ำ', 'easy', false),
  ('b9acb494-55d5-46d5-a472-28eefda90180', (select id from public.units where no = 1), '1.1', 1, 'true_false', 'IoT คือการเชื่อมต่อสิ่งของต่าง ๆ เข้ากับอินเทอร์เน็ตเพื่อส่งข้อมูลและสั่งงานได้', '[]'::jsonb, '{"value":true}'::jsonb, 'Internet of Things = อินเทอร์เน็ตของสรรพสิ่ง', 'easy', false),
  ('89d22c67-b51f-47e7-a3db-e86dcb34ac67', (select id from public.units where no = 1), '1.1', 1, 'matching', 'จับคู่ยุคของเครือข่ายกับความสามารถเด่น', '{"left":["1G","3G","4G","5G"],"right":["อินเทอร์เน็ตบนมือถือ วิดีโอคอล","โทรด้วยเสียงแบบแอนะล็อก","เชื่อมต่ออุปกรณ์ IoT จำนวนมหาศาล","ดูวิดีโอสตรีมมิงความเร็วสูง"]}'::jsonb, '{"pairs":[1,0,3,2]}'::jsonb, 'แต่ละยุคเพิ่มความสามารถใหม่จากยุคก่อน', 'medium', false),
  ('18210625-1b6a-4710-a37f-68aa3352c3e0', (select id from public.units where no = 1), '1.1', 1, 'mcq', 'ข้อใดเป็นปัจจัยด้าน "ความรู้วิทยาศาสตร์" ที่ทำให้เครือข่ายไร้สายพัฒนาขึ้น', '["รัฐบาลประกาศนโยบาย","บริษัทแข่งขันกันทางการตลาด","คนอยากดูคลิปมากขึ้น","ความเข้าใจเรื่องคลื่นแม่เหล็กไฟฟ้า"]'::jsonb, '{"index":3}'::jsonb, 'ความรู้เรื่องคลื่นแม่เหล็กไฟฟ้าเป็นพื้นฐานของการสื่อสารไร้สาย', 'medium', false),
  ('7eb316de-3e6d-4cf5-a1b3-ef3dddbe15f3', (select id from public.units where no = 1), '1.2', 1, 'mcq', 'รถยนต์ไฟฟ้าประเภทใดใช้มอเตอร์ไฟฟ้าและแบตเตอรี่เพียงอย่างเดียว', '["FCEV","PHEV","BEV","HEV"]'::jsonb, '{"index":2}'::jsonb, 'BEV = Battery Electric Vehicle ไม่มีเครื่องยนต์', 'easy', false),
  ('625c4795-8890-4e1d-a2ec-ed3106bf3806', (select id from public.units where no = 1), '1.2', 1, 'mcq', 'รถยนต์ประเภทใดผลิตไฟฟ้าจากไฮโดรเจนและปล่อยไอน้ำออกมา', '["BEV","HEV","PHEV","FCEV"]'::jsonb, '{"index":3}'::jsonb, 'FCEV ใช้เซลล์เชื้อเพลิงไฮโดรเจน', 'easy', false),
  ('23e8dc11-485b-4457-a02e-1a35bd0d4637', (select id from public.units where no = 1), '1.2', 1, 'true_false', 'รถ HEV ต้องเสียบปลั๊กชาร์จไฟจากบ้านจึงจะวิ่งได้', '[]'::jsonb, '{"value":false}'::jsonb, 'HEV ชาร์จแบตเตอรี่จากเครื่องยนต์และการเบรก เสียบปลั๊กไม่ได้ ส่วน PHEV เสียบได้', 'medium', false),
  ('0a5ab0cc-dbcf-4251-a76e-78b054beb39d', (select id from public.units where no = 1), '1.2', 1, 'fill', 'หน่วยที่ใช้บอกความจุแบตเตอรี่รถยนต์ไฟฟ้าคือ ______ (ตอบเป็นตัวย่อภาษาอังกฤษ)', '[]'::jsonb, '{"accept":["kWh","กิโลวัตต์-ชั่วโมง","กิโลวัตต์ชั่วโมง"]}'::jsonb, 'ความจุแบตเตอรี่วัดเป็นกิโลวัตต์-ชั่วโมง (kWh)', 'medium', false),
  ('fe07b0d2-edf9-4162-adb8-f58a8fccb17d', (select id from public.units where no = 1), '1.2', 1, 'mcq', 'แบตเตอรี่ 60 kWh รถใช้พลังงาน 0.15 kWh ต่อกิโลเมตร จะวิ่งได้ประมาณกี่กิโลเมตร', '["900 กม.","400 กม.","250 กม.","90 กม."]'::jsonb, '{"index":1}'::jsonb, '60 ÷ 0.15 = 400 กิโลเมตร', 'hard', false),
  ('e6f53ce1-b2d2-439b-ae54-ba3fabf1a798', (select id from public.units where no = 1), '1.3', 1, 'mcq', 'เทคโนโลยีใดอ่านข้อมูลได้หลายชิ้นพร้อมกันโดยไม่ต้องหันป้ายเข้าหาเครื่องอ่าน', '["GPS","Barcode","RFID","QR Code"]'::jsonb, '{"index":2}'::jsonb, 'RFID ใช้คลื่นวิทยุ อ่านผ่านกล่องและอ่านพร้อมกันได้หลายชิ้น', 'easy', false),
  ('0a4c4cf9-a511-4eb7-a5e9-653433e8289a', (select id from public.units where no = 1), '1.3', 1, 'mcq', 'ถ้าต้องการติดตามตำแหน่งรถขนส่งแบบเรียลไทม์ ควรใช้เทคโนโลยีใด', '["Barcode","บรรจุภัณฑ์กันกระแทก","ระบบชำระเงิน","GPS"]'::jsonb, '{"index":3}'::jsonb, 'GPS ระบุตำแหน่งด้วยดาวเทียม', 'easy', false),
  ('d3b313c9-e08a-435f-a4b1-ad27760e2209', (select id from public.units where no = 1), '1.3', 1, 'true_false', 'โลจิสติกส์เกี่ยวข้องเฉพาะการขนส่งสินค้าเท่านั้น ไม่เกี่ยวกับข้อมูล', '[]'::jsonb, '{"value":false}'::jsonb, 'โลจิสติกส์จัดการทั้งสินค้า ข้อมูล และบริการ', 'easy', false),
  ('3a04662d-2d35-4c80-afb8-e7a3a42ba097', (select id from public.units where no = 1), '1.3', 1, 'matching', 'จับคู่องค์ประกอบของโลจิสติกส์กับหน้าที่', '{"left":["การขนส่ง","คลังสินค้า","บรรจุภัณฑ์","ระบบสารสนเทศ"],"right":["ปกป้องสินค้าและระบุข้อมูล","บอกตำแหน่งและจำนวนคงเหลือ","เก็บ ตรวจนับ และคัดแยกสินค้า","เคลื่อนย้ายสินค้าจากที่หนึ่งไปอีกที่หนึ่ง"]}'::jsonb, '{"pairs":[3,2,0,1]}'::jsonb, 'องค์ประกอบทั้งหมดทำงานร่วมกัน', 'medium', false),
  ('34350ca6-93eb-4c57-a72d-7c9c2c0c8c09', (select id from public.units where no = 1), '1.3', 1, 'mcq', 'ร้านค้าออนไลน์ต้องการลดเวลาตรวจนับสินค้าในคลังขนาดใหญ่ ควรเลือกใช้ข้อใดมากที่สุด', '["เพิ่มพนักงานขนส่ง","ถ่ายรูปสินค้าทุกชิ้น","เขียนรายการด้วยมือ","ป้าย RFID กับเครื่องอ่าน"]'::jsonb, '{"index":3}'::jsonb, 'RFID ตรวจนับได้ทั้งพาเลทในครั้งเดียว', 'medium', false),
  ('a6967dd8-d46b-4706-a1bf-90e33ed27cf2', (select id from public.units where no = 1), '1', 1, 'mcq', 'หม้อหุงข้าวไฟฟ้าตัดไฟอัตโนมัติได้เพราะใช้ความรู้เรื่องใด', '["เสียง","ความร้อน","แสง","แม่เหล็กถาวร"]'::jsonb, '{"index":1}'::jsonb, 'อุปกรณ์ตรวจวัดความร้อนตัดไฟเมื่อน้ำงวด', 'easy', false),
  ('ef846ee7-f840-4290-a244-c554f7d14a2e', (select id from public.units where no = 1), '1', 1, 'true_false', 'อาหารหนึ่งจานเกี่ยวข้องกับเทคโนโลยีหลายอย่าง ตั้งแต่การผลิตวัตถุดิบจนถึงการขนส่ง', '[]'::jsonb, '{"value":true}'::jsonb, 'ทั้งฟาร์ม การแปรรูป การเก็บรักษา และการขนส่งล้วนใช้เทคโนโลยี', 'easy', false),
  ('a236f254-2692-4b9f-a4a2-1bc97fd72a6b', (select id from public.units where no = 1), '1', 1, 'mcq', 'การที่ร้านอาหารเปลี่ยนมารับออเดอร์ผ่านแอปเดลิเวอรี เป็นผลจากปัจจัยด้านใดมากที่สุด', '["สังคมและพฤติกรรมผู้บริโภคเปลี่ยน","ศาสนา","ทรัพยากรธรรมชาติลดลง","ภูมิอากาศ"]'::jsonb, '{"index":0}'::jsonb, 'พฤติกรรมคนสั่งอาหารออนไลน์มากขึ้น', 'medium', false),
  ('87a14241-93cc-4de6-a4e7-77bee711a88c', (select id from public.units where no = 1), '1', 1, 'mcq', 'บรรจุภัณฑ์เก็บความร้อนสำหรับส่งอาหาร ใช้ความรู้วิทยาศาสตร์เรื่องใด', '["แรงโน้มถ่วง","เสียงสะท้อน","การหักเหของแสง","การนำความร้อนของวัสดุ"]'::jsonb, '{"index":3}'::jsonb, 'วัสดุนำความร้อนต่ำช่วยเก็บความร้อน', 'medium', false),
  ('afbc56b8-fdae-4811-a843-09d6a2630005', (select id from public.units where no = 1), '1', 1, 'true_false', 'การทำงานกลุ่มควรแบ่งหน้าที่ให้ชัดเจนและสื่อสารกันตลอด', '[]'::jsonb, '{"value":true}'::jsonb, 'ช่วยให้งานเสร็จตรงเวลาและครบถ้วน', 'easy', false),
  ('db4857b3-ef8c-4b76-ab0a-ab1e09e036e4', (select id from public.units where no = 1), '1', 1, 'mcq', 'ข้อใดไม่ใช่ปัจจัยที่ทำให้เทคโนโลยีเปลี่ยนแปลง', '["สีที่เราชอบ","ความต้องการของมนุษย์","เศรษฐกิจ","ความรู้วิทยาศาสตร์"]'::jsonb, '{"index":0}'::jsonb, 'ความชอบส่วนตัวไม่ใช่ปัจจัยหลักของการเปลี่ยนแปลงเทคโนโลยี', 'easy', false),
  ('28d86a4f-d234-46a2-a0e2-9b25a7c368e5', (select id from public.units where no = 1), '1', 1, 'true_false', 'เทคโนโลยีใหม่มีแต่ผลดี ไม่มีผลกระทบด้านลบ', '[]'::jsonb, '{"value":false}'::jsonb, 'ต้องพิจารณาผลกระทบ เช่น ขยะแบตเตอรี่ ความเป็นส่วนตัว', 'medium', false),
  ('bfa08e89-818b-4f86-a19e-76e2a381dd1e', (select id from public.units where no = 1), '1', 1, 'mcq', 'การคำนวณค่าไฟในการชาร์จรถยนต์ไฟฟ้า เป็นการใช้ความรู้ศาสตร์ใดร่วมกับเทคโนโลยี', '["ประวัติศาสตร์","ศิลปะ","ภาษาไทย","คณิตศาสตร์"]'::jsonb, '{"index":3}'::jsonb, 'การคำนวณค่าใช้จ่ายใช้คณิตศาสตร์', 'medium', false),
  ('3954eee7-de1b-4d81-a075-3e2897e93885', (select id from public.units where no = 1), '1', 1, 'matching', 'จับคู่เทคโนโลยีกับปัญหาที่ช่วยแก้', '{"left":["5G","รถยนต์ไฟฟ้า","RFID"],"right":["มลพิษจากไอเสีย","ตรวจนับสินค้าช้า","สื่อสารล่าช้าในงานที่ต้องตอบสนองทันที"]}'::jsonb, '{"pairs":[2,0,1]}'::jsonb, 'เทคโนโลยีเกิดขึ้นเพื่อแก้ปัญหาหรือตอบความต้องการ', 'medium', false),
  ('33caec38-142d-4eab-a9e2-b94d83dd0a9e', (select id from public.units where no = 1), '1', 1, 'mcq', 'นโยบายลดภาษีรถยนต์ไฟฟ้าของรัฐ เป็นปัจจัยการเปลี่ยนแปลงเทคโนโลยีด้านใด', '["ความรู้วิทยาศาสตร์","นโยบายของรัฐและเศรษฐกิจ","วัฒนธรรมท้องถิ่น","ภัยธรรมชาติ"]'::jsonb, '{"index":1}'::jsonb, 'นโยบายรัฐส่งผลต่อราคาและการตัดสินใจซื้อ', 'hard', false),
  ('961c0913-e30a-450d-a7a1-39c04f098ea6', (select id from public.units where no = 2), '2.1', 3, 'ordering', 'เรียงลำดับกระบวนการออกแบบเชิงวิศวกรรมให้ถูกต้อง', '["วางแผนและดำเนินการแก้ปัญหา","ทดสอบ ประเมินผล และปรับปรุงแก้ไข","ระบุปัญหา","นำเสนอผลการแก้ปัญหา","รวบรวมข้อมูลและแนวคิดที่เกี่ยวข้อง","ออกแบบวิธีการแก้ปัญหา"]'::jsonb, '{"order":[2,4,5,0,1,3]}'::jsonb, 'กระบวนการ 6 ขั้น และวนกลับไปปรับปรุงได้', 'easy', false),
  ('62e2cb84-4e42-473d-adca-ed8020afa4d3', (select id from public.units where no = 2), '2.1', 3, 'mcq', 'เกษตรกรรดน้ำไม่ทัน ควรใช้เทคโนโลยีใดช่วยมากที่สุด', '["ป้ายบาร์โค้ด","เครื่องพิมพ์ 3 มิติ","ระบบรดน้ำอัตโนมัติด้วยเซนเซอร์ความชื้น","ลำโพงบลูทูท"]'::jsonb, '{"index":2}'::jsonb, 'เซนเซอร์ความชื้นสั่งรดน้ำเมื่อดินแห้ง', 'easy', false),
  ('55aa02a6-e40b-47b6-a121-54baeb24784d', (select id from public.units where no = 2), '2.1', 3, 'true_false', 'กระบวนการออกแบบเชิงวิศวกรรมต้องทำจากขั้นที่ 1 ถึง 6 เพียงรอบเดียวเท่านั้น', '[]'::jsonb, '{"value":false}'::jsonb, 'ถ้าทดสอบไม่ผ่านสามารถย้อนกลับไปปรับปรุงได้หลายรอบ', 'medium', false),
  ('f1805b3b-a3ba-46f1-a8d5-0f9ed7a5c827', (select id from public.units where no = 2), '2.1', 3, 'mcq', '"สร้างต้นแบบตามแผนที่วางไว้" อยู่ในขั้นใดของกระบวนการออกแบบเชิงวิศวกรรม', '["ระบุปัญหา","วางแผนและดำเนินการแก้ปัญหา","นำเสนอ","รวบรวมข้อมูล"]'::jsonb, '{"index":1}'::jsonb, 'การลงมือสร้างอยู่ในขั้นวางแผนและดำเนินการ', 'medium', false),
  ('76203c69-12c8-48fe-ab26-2694286b4b91', (select id from public.units where no = 2), '2.1', 3, 'mcq', 'แม่ค้าออนไลน์จัดการออเดอร์ไม่ทัน เทคโนโลยีใดช่วยได้ตรงที่สุด', '["เครื่องคิดเลข","ไฟฉาย","GPS","ระบบจัดการคำสั่งซื้ออัตโนมัติ"]'::jsonb, '{"index":3}'::jsonb, 'ระบบจัดการคำสั่งซื้อลดงานซ้ำและความผิดพลาด', 'easy', false),
  ('41ec6e4b-cfe6-4c18-a02d-784f8a9aa4bc', (select id from public.units where no = 2), '2.2', 2, 'mcq', 'คำถามข้อใดเป็นคำถามปลายเปิด', '["มีปัญหาไหม","ใช้มือถือหรือเปล่า","ปัญหาที่เจอบ่อยที่สุดคืออะไร","ร้านขายดีไหม"]'::jsonb, '{"index":2}'::jsonb, 'คำถามปลายเปิดให้ผู้ตอบเล่ารายละเอียด ไม่ใช่ตอบแค่ใช่/ไม่ใช่', 'easy', false),
  ('904e52e4-3ae9-46e2-a0f9-0eeb808532fe', (select id from public.units where no = 2), '2.2', 2, 'matching', 'จับคู่ 5W1H กับความหมาย', '{"left":["Who","Where","When","Why"],"right":["เกิดเมื่อไร บ่อยแค่ไหน","สาเหตุของปัญหา","เกิดปัญหาที่ไหน","ใครเจอปัญหา"]}'::jsonb, '{"pairs":[3,2,0,1]}'::jsonb, '5W1H ช่วยวิเคราะห์ปัญหาให้ครบทุกด้าน', 'medium', false),
  ('0539ef29-7d8c-49bc-aa61-b571052f54f6', (select id from public.units where no = 2), '2.2', 2, 'true_false', 'ก่อนบันทึกเสียงหรือถ่ายภาพผู้ให้สัมภาษณ์ ต้องขออนุญาตก่อน', '[]'::jsonb, '{"value":true}'::jsonb, 'เป็นการเคารพสิทธิส่วนบุคคล', 'easy', false),
  ('f1d7a5fd-d5ad-4400-ae61-c9c24c1c0df3', (select id from public.units where no = 2), '2.2', 2, 'mcq', 'ข้อใดเป็น "เงื่อนไข" ในกรอบของปัญหา', '["ผักมีหลายชนิด","ตลาดเปิดตอนเช้า","ป้าขายผักเหี่ยวเร็ว","ต้องใช้งบไม่เกิน 300 บาท"]'::jsonb, '{"index":3}'::jsonb, 'กรอบของปัญหาระบุเงื่อนไขและข้อจำกัด เช่น งบประมาณ', 'medium', false),
  ('4074cca7-5680-449b-a1f9-e6f1eed1cb99', (select id from public.units where no = 2), '2.2', 2, 'fill', 'การวิเคราะห์ปัญหาด้วยคำถาม ใคร อะไร ที่ไหน เมื่อไร ทำไม อย่างไร เรียกว่า ______', '[]'::jsonb, '{"accept":["5W1H","5w1h"]}'::jsonb, '5W1H = Who What Where When Why How', 'medium', false),
  ('a2fb3978-bedf-405e-ac17-edb5cfd8ff90', (select id from public.units where no = 2), '2.3', 2, 'mcq', 'ข้อใดเป็นข้อมูลปฐมภูมิ', '["ผลการสัมภาษณ์ที่นักเรียนเก็บเอง","งานวิจัยที่ตีพิมพ์แล้ว","บทความในเว็บไซต์","ข้อมูลจากหนังสือเรียน"]'::jsonb, '{"index":0}'::jsonb, 'ข้อมูลปฐมภูมิคือข้อมูลที่เก็บด้วยตนเอง', 'easy', false),
  ('c0de1c8d-f464-43a1-aee6-e65ec0e83cd1', (select id from public.units where no = 2), '2.3', 2, 'true_false', 'ระหว่างระดมสมอง ควรวิจารณ์และตัดแนวคิดที่ไม่ดีทิ้งทันที', '[]'::jsonb, '{"value":false}'::jsonb, 'ช่วงระดมสมองควรเสนอให้มากที่สุดก่อน ยังไม่ตัดสิน', 'easy', false),
  ('884f4ec4-5e80-44db-aa41-ef8e87007633', (select id from public.units where no = 2), '2.3', 2, 'mcq', 'ข้อใดช่วยตรวจความน่าเชื่อถือของข้อมูลบนอินเทอร์เน็ต', '["ดูว่ามีคนกดถูกใจมาก","เลือกเว็บที่สวยที่สุด","ดูผู้เขียน วันที่เผยแพร่ และเทียบกับแหล่งอื่น","เลือกข้อมูลที่สั้นที่สุด"]'::jsonb, '{"index":2}'::jsonb, 'ตรวจผู้เขียน ความทันสมัย หลักฐาน และความสอดคล้องกับแหล่งอื่น', 'medium', false),
  ('d7c6a5d9-f16c-4f1f-ace5-b1ca47bb65e8', (select id from public.units where no = 2), '2.3', 3, 'mcq', 'แนวคิด A ได้คะแนนรวมเท่ากับแนวคิด B ควรตัดสินใจอย่างไร', '["พิจารณาเกณฑ์ที่สำคัญที่สุดตามกรอบของปัญหา","เลือกแบบสุ่ม","ทิ้งทั้งสองแนวคิด","เลือกแนวคิดที่ชอบ"]'::jsonb, '{"index":0}'::jsonb, 'ใช้เกณฑ์ที่สำคัญที่สุดเป็นตัวตัดสินพร้อมเหตุผล', 'medium', false),
  ('dd634b3c-ac88-409f-a9e6-62c0ba29f3ea', (select id from public.units where no = 2), '2.3', 2, 'true_false', 'การนำภาพจากอินเทอร์เน็ตมาใช้ในรายงาน ควรอ้างอิงแหล่งที่มาทุกครั้ง', '[]'::jsonb, '{"value":true}'::jsonb, 'ภาพเป็นทรัพย์สินทางปัญญาของผู้สร้าง', 'easy', false),
  ('f1784e7f-e81c-48a5-affa-7c19cc8e8dd8', (select id from public.units where no = 2), '2.4', 3, 'mcq', 'ภาพแบบใดเหมาะกับการร่างแนวคิดอย่างรวดเร็วด้วยมือ', '["ภาพ 3 มิติจากโปรแกรม","ภาพถ่าย","ภาพร่าง (Sketch)","แผนที่"]'::jsonb, '{"index":2}'::jsonb, 'ภาพร่างวาดเร็วเพื่อสื่อสารรูปร่างและส่วนประกอบ', 'easy', false),
  ('2a32acc3-d97d-424a-a1ad-e5038f7e6c63', (select id from public.units where no = 2), '2.4', 3, 'true_false', 'ภาพร่างที่ดีควรระบุขนาดและวัสดุของแต่ละส่วน', '[]'::jsonb, '{"value":true}'::jsonb, 'ช่วยให้สร้างได้จริงและสื่อสารกับคนอื่นได้ชัด', 'easy', false),
  ('441b7553-0c8e-4434-aa0d-000589622c91', (select id from public.units where no = 2), '2.4', 3, 'mcq', 'ต้องการชิ้นงานที่ใช้กลางแจ้งและโดนฝนบ่อย ควรเลือกวัสดุใด', '["ผ้าฝ้าย","พลาสติกหรือไม้เคลือบกันน้ำ","กระดาษแข็ง","กระดาษลัง"]'::jsonb, '{"index":1}'::jsonb, 'เลือกวัสดุตามสมบัติให้ตรงเงื่อนไขการใช้งาน', 'medium', false),
  ('41a3ff36-817a-4d76-a1b5-a4b017f4fef4', (select id from public.units where no = 2), '2.4', 3, 'mcq', 'การทำต้นแบบเล็ก ๆ ด้วยกระดาษก่อนสร้างจริง มีประโยชน์อย่างไร', '["ทำให้ชิ้นงานสวยขึ้น","ใช้แทนรายงาน","ไม่ต้องทดสอบชิ้นงานจริง","เห็นข้อบกพร่องเร็วและประหยัดวัสดุ"]'::jsonb, '{"index":3}'::jsonb, 'Mock-up ช่วยลองแนวคิดก่อนลงทุนวัสดุจริง', 'medium', false),
  ('031ba8cf-0cf4-4806-a68a-44c9c6ced232', (select id from public.units where no = 2), '2.4', 3, 'fill', 'แผนภาพที่ใช้สัญลักษณ์แสดงลำดับขั้นตอนการทำงาน เรียกว่า ______', '[]'::jsonb, '{"accept":["ผังงาน","flowchart","โฟลวชาร์ต"]}'::jsonb, 'ผังงาน (Flowchart) แสดงขั้นตอนการทำงาน', 'medium', false),
  ('f561c9b0-a746-4ad9-a4e2-c5c6ca9fee2e', (select id from public.units where no = 2), '2.4', 4, 'mcq', 'ก่อนใช้สว่านเจาะ ควรปฏิบัติอย่างไร', '["เจาะเร็วที่สุด","รวบผมและสวมแว่นตานิรภัย","สวมถุงมือผ้าให้หนา","ปล่อยชิ้นงานให้ลอย"]'::jsonb, '{"index":1}'::jsonb, 'รวบผม สวมแว่น และจับชิ้นงานให้แน่น ห้ามถุงมือผ้าใกล้ดอกสว่าน', 'easy', false),
  ('2bdb388f-b174-4149-a63c-a50a31ef2c74', (select id from public.units where no = 2), '2.4', 4, 'true_false', 'เวลาตัดด้วยคัตเตอร์ควรตัดเข้าหาตัว เพื่อให้ควบคุมได้ง่าย', '[]'::jsonb, '{"value":false}'::jsonb, 'ต้องตัดออกจากตัวเพื่อความปลอดภัย', 'easy', false),
  ('10feaf04-a6f6-4699-aa3a-befc8f1e5b3e', (select id from public.units where no = 2), '2.4', 4, 'mcq', 'ข้อใดเป็นพฤติกรรมไม่ปลอดภัยในการใช้อุปกรณ์ไฟฟ้า', '["ถอดปลั๊กเมื่อเลิกใช้","จับปลั๊กขณะมือเปียก","วางหัวแร้งบนขาตั้ง","ตรวจสายไฟก่อนใช้"]'::jsonb, '{"index":1}'::jsonb, 'มือเปียกนำไฟฟ้า เสี่ยงไฟดูด', 'medium', false),
  ('d131f23e-7be6-490d-a6cf-de7f8732b8f9', (select id from public.units where no = 2), '2.4', 4, 'matching', 'จับคู่งานกับเครื่องมือที่เหมาะสม', '{"left":["ตัดไม้","เจาะรู","ติดชิ้นงานด้วยกาว","บัดกรีวงจร"],"right":["หัวแร้ง","ปืนกาวร้อน","สว่าน","เลื่อย"]}'::jsonb, '{"pairs":[3,2,1,0]}'::jsonb, 'ใช้เครื่องมือให้ถูกประเภทงาน', 'medium', false),
  ('14777cd5-d2b5-4e5c-af84-4931d175197c', (select id from public.units where no = 2), '2.4', 4, 'true_false', 'ถ้าไม่แน่ใจวิธีใช้เครื่องมือ ควรถามครูก่อนใช้งาน', '[]'::jsonb, '{"value":true}'::jsonb, 'ป้องกันอุบัติเหตุจากการใช้ผิดวิธี', 'easy', false),
  ('8b4c2816-37ae-4c04-af81-aaa7e211d2ca', (select id from public.units where no = 2), '2.4', 3, 'mcq', 'ต้นแบบ (Prototype) สร้างขึ้นเพื่ออะไร', '["ใช้ขายทันที","ใช้ตกแต่งห้อง","ทดแทนรายงาน","ทดสอบแนวคิดก่อนทำชิ้นจริง"]'::jsonb, '{"index":3}'::jsonb, 'ต้นแบบใช้ทดสอบว่าแนวคิดทำงานได้จริงหรือไม่', 'easy', false),
  ('9a3d4a0f-c747-471f-af0e-5ac32cdef616', (select id from public.units where no = 2), '2.4', 3, 'true_false', 'ต้นแบบต้องสวยงามสมบูรณ์เหมือนสินค้าจริงเสมอ', '[]'::jsonb, '{"value":false}'::jsonb, 'ต้นแบบต้องทำงานได้ตามหลักการ ยังไม่ต้องสวย', 'easy', false),
  ('dc777e4e-9031-4aec-a7d1-3b8b1c577ed3', (select id from public.units where no = 2), '2.4', 3, 'mcq', 'ระหว่างสร้างต้นแบบ ถ้าต้องเปลี่ยนวัสดุจากแผนเดิม ควรทำอย่างไร', '["ลบแผนเดิมทิ้ง","จดเหตุผลการเปลี่ยนไว้","หยุดทำโครงงาน","เปลี่ยนเงียบ ๆ"]'::jsonb, '{"index":1}'::jsonb, 'บันทึกการเปลี่ยนแปลงไว้ใช้ในรายงาน', 'medium', false),
  ('db375985-849f-43cf-aa9e-31c197fbec7c', (select id from public.units where no = 2), '2.4', 3, 'mcq', 'การวางไม้บรรทัดข้างชิ้นงานตอนถ่ายภาพมีประโยชน์อย่างไร', '["ไม่มีประโยชน์","ให้ภาพสว่าง","ให้เห็นขนาดจริงของชิ้นงาน","ให้ภาพสวย"]'::jsonb, '{"index":2}'::jsonb, 'ผู้ดูประมาณขนาดจริงได้', 'easy', false),
  ('60321cfa-c738-49dd-adc6-3d26434f379b', (select id from public.units where no = 2), '2.4', 3, 'true_false', 'ควรถ่ายภาพขั้นตอนสำคัญระหว่างสร้างชิ้นงานเก็บไว้', '[]'::jsonb, '{"value":true}'::jsonb, 'ใช้เป็นหลักฐานในรายงานและการนำเสนอ', 'easy', false),
  ('8ed36254-7a88-45e1-a76a-54fc06bcf9df', (select id from public.units where no = 2), '2.5', 4, 'mcq', 'การทดสอบชิ้นงานควรทำอย่างไรจึงน่าเชื่อถือ', '["ทดสอบครั้งเดียว","ไม่ต้องบันทึกผล","ให้เพื่อนเดาผล","ทดสอบหลายครั้งแล้วหาค่าเฉลี่ย"]'::jsonb, '{"index":3}'::jsonb, 'ทดสอบซ้ำหลายครั้งลดความคลาดเคลื่อน', 'easy', false),
  ('7e548010-fc2e-4db8-acba-f848c98016a0', (select id from public.units where no = 2), '2.5', 4, 'mcq', 'ทดสอบรับน้ำหนัก 3 ครั้งได้ 420, 480 และ 510 กรัม ค่าเฉลี่ยคือเท่าใด', '["450 กรัม","480 กรัม","510 กรัม","470 กรัม"]'::jsonb, '{"index":3}'::jsonb, '(420+480+510)/3 = 470', 'medium', false),
  ('57a20529-3cf6-43cb-a02b-88517dc53393', (select id from public.units where no = 2), '2.5', 4, 'true_false', 'ถ้าทดสอบแล้วชิ้นงานไม่ผ่าน แปลว่าโครงงานล้มเหลวและต้องเลิกทำ', '[]'::jsonb, '{"value":false}'::jsonb, 'ใช้ผลทดสอบหาสาเหตุแล้วปรับปรุง', 'easy', false),
  ('9fa2c3de-77a9-4e7b-a391-ca56150b003f', (select id from public.units where no = 2), '2.5', 4, 'ordering', 'เรียงขั้นตอนการปรับปรุงเมื่อพบข้อบกพร่อง', '["ระบุส่วนที่ไม่ทำงาน","ทดสอบซ้ำ","หาสาเหตุของข้อบกพร่อง","เสนอวิธีแก้ไข"]'::jsonb, '{"order":[0,2,3,1]}'::jsonb, 'วิเคราะห์ก่อนแก้ แล้วทดสอบซ้ำเพื่อยืนยัน', 'medium', false),
  ('7e85d3bf-7318-45e1-a0c3-690ace0886a3', (select id from public.units where no = 2), '2.5', 4, 'mcq', 'ขาตั้งงอเมื่อวางน้ำหนัก ข้อใดเป็นการปรับปรุงที่สมเหตุสมผล', '["ลดการทดสอบ","เสริมโครงขาตั้งด้วยวัสดุที่แข็งแรงขึ้น","เปลี่ยนชื่อชิ้นงาน","ทาสีใหม่"]'::jsonb, '{"index":1}'::jsonb, 'แก้ที่สาเหตุคือโครงสร้างไม่แข็งแรงพอ', 'medium', false),
  ('2edd6573-6c39-46ec-a959-d4c7f9d8b506', (select id from public.units where no = 2), '2.6', 4, 'ordering', 'เรียงส่วนของรายงานโครงงานตามลำดับ', '["ปก","บทนำ","บทคัดย่อ","สรุปและข้อเสนอแนะ","ผลการดำเนินงาน","วิธีดำเนินงาน","สารบัญ","บรรณานุกรม"]'::jsonb, '{"order":[0,2,6,1,5,4,3,7]}'::jsonb, 'ลำดับมาตรฐานของรายงาน', 'medium', false),
  ('424594cc-81aa-4539-abb7-3850670f885b', (select id from public.units where no = 2), '2.6', 4, 'mcq', 'ที่มาและความสำคัญของปัญหา อยู่ในส่วนใดของรายงาน', '["ผลการดำเนินงาน","บรรณานุกรม","ภาคผนวก","บทนำ"]'::jsonb, '{"index":3}'::jsonb, 'บทนำกล่าวถึงที่มา ปัญหา วัตถุประสงค์ และขอบเขต', 'easy', false),
  ('c6bf3f6a-cf2a-4cad-aac0-4c6f15f38fa6', (select id from public.units where no = 2), '2.6', 4, 'true_false', 'ควรเขียนบทคัดย่อเป็นส่วนสุดท้ายหลังรู้ผลทั้งหมดแล้ว', '[]'::jsonb, '{"value":true}'::jsonb, 'บทคัดย่อสรุปทั้งโครงงาน จึงเขียนเมื่อรู้ผลแล้ว', 'medium', false),
  ('6989fd59-cbfd-4221-a3ab-8171d06b6fe9', (select id from public.units where no = 2), '2.6', 4, 'mcq', 'รายชื่อหนังสือและเว็บไซต์ที่ใช้ค้นข้อมูล ใส่ไว้ในส่วนใด', '["ปก","บทคัดย่อ","บรรณานุกรม","สารบัญ"]'::jsonb, '{"index":2}'::jsonb, 'บรรณานุกรมรวบรวมแหล่งอ้างอิง', 'easy', false),
  ('6bcb8638-2a18-4239-a038-18e4b4b62c49', (select id from public.units where no = 2), '2.6', 4, 'mcq', 'ตารางและกราฟผลการทดสอบ ควรอยู่ในส่วนใด', '["กิตติกรรมประกาศ","ผลการดำเนินงาน","บทนำ","ปก"]'::jsonb, '{"index":1}'::jsonb, 'ผลการดำเนินงานแสดงผลการทดสอบ', 'medium', false),
  ('54231507-3223-468c-af41-e363debc5f32', (select id from public.units where no = 2), '2.7', 4, 'mcq', 'ข้อใดเป็นเทคนิคการนำเสนอที่ดี', '["ใส่ข้อความเต็มสไลด์","อ่านสไลด์ทุกคำ","สบตาผู้ฟังและซ้อมจับเวลา","พูดเบา ๆ"]'::jsonb, '{"index":2}'::jsonb, 'สบตา พูดชัด และซ้อมก่อน', 'easy', false),
  ('1176482b-a9fe-4bcd-aa3c-bb279afd3722', (select id from public.units where no = 2), '2.7', 4, 'true_false', 'การนำเสนอควรมีผลการทดสอบและการปรับปรุงชิ้นงานด้วย', '[]'::jsonb, '{"value":true}'::jsonb, 'แสดงว่าแก้ปัญหาได้จริงและพัฒนาอย่างไร', 'easy', false),
  ('8c51eb41-06c5-4687-a695-8e9a887708a6', (select id from public.units where no = 2), '2.7', 4, 'mcq', 'ถ้าต้องการให้ผู้ฟังเห็นการทำงานของชิ้นงานจริง ควรเลือกรูปแบบใด', '["โปสเตอร์อย่างเดียว","อ่านรายงาน","สาธิตจริงหรือคลิปวิดีโอ","ส่งไฟล์ให้อ่านเอง"]'::jsonb, '{"index":2}'::jsonb, 'การสาธิตเห็นการทำงานชัดที่สุด', 'medium', false),
  ('1601c54e-3643-4e7b-a040-1bb52545ccc0', (select id from public.units where no = 2), '2.7', 4, 'mcq', 'เมื่อผู้ฟังให้ข้อเสนอแนะ ควรทำอย่างไร', '["โต้แย้งทันที","จบการนำเสนอ","รับฟังและจดไว้พัฒนาต่อ","ไม่สนใจ"]'::jsonb, '{"index":2}'::jsonb, 'ข้อเสนอแนะช่วยพัฒนาผลงาน', 'easy', false),
  ('bb2025ac-61df-41d4-a6fb-3a6be23abf07', (select id from public.units where no = 2), '2.7', 4, 'true_false', 'สไลด์ที่ดีควรมีข้อความยาวมากเพื่อให้ผู้ฟังอ่านเองได้ครบ', '[]'::jsonb, '{"value":false}'::jsonb, 'สไลด์ควรข้อความน้อย ภาพเยอะ', 'medium', false),
  ('56cbcb95-a21b-4786-a027-79b40839f7da', (select id from public.units where no = 3), '3.1', 3, 'mcq', 'การเปลี่ยนกล่องข้าวเกรียบให้ปิดซ้ำได้และเก็บความกรอบ เป็นการเพิ่มมูลค่าด้านใด', '["ขยายร้าน","บรรจุภัณฑ์","ลดราคา","เปลี่ยนสูตร"]'::jsonb, '{"index":1}'::jsonb, 'เพิ่มมูลค่าด้วยการพัฒนาบรรจุภัณฑ์', 'easy', false),
  ('60e0bc70-b5e5-40d3-aa75-583affd94ad0', (select id from public.units where no = 3), '3.1', 3, 'mcq', 'กระติกน้ำที่บอกอุณหภูมิน้ำได้ เป็นการเพิ่มมูลค่าด้านใด', '["รูปลักษณ์","การตลาด","ฟังก์ชันการใช้งาน","วัสดุ"]'::jsonb, '{"index":2}'::jsonb, 'เพิ่มความสามารถใหม่ = เพิ่มฟังก์ชัน', 'medium', false),
  ('334931af-2bd5-4493-ad5f-226e582896f6', (select id from public.units where no = 3), '3.1', 3, 'true_false', 'การเล่าเรื่องภูมิปัญญาชุมชนที่อยู่เบื้องหลังสินค้า ช่วยเพิ่มมูลค่าได้', '[]'::jsonb, '{"value":true}'::jsonb, 'การเล่าเรื่องแบรนด์ทำให้สินค้ามีคุณค่าในใจผู้ซื้อ', 'easy', false),
  ('2aa2ca57-c86c-4653-a621-bb780b021616', (select id from public.units where no = 3), '3.1', 3, 'mcq', 'เดิมขายผ้าทอผืนละ 300 บาท หลังออกแบบใหม่ขาย 500 บาท ต้นทุนเพิ่ม 80 บาท กำไรเพิ่มขึ้นผืนละเท่าใด', '["500 บาท","80 บาท","200 บาท","120 บาท"]'::jsonb, '{"index":3}'::jsonb, 'มูลค่าเพิ่ม 200 − ต้นทุนเพิ่ม 80 = 120 บาท', 'hard', false),
  ('a9c60950-301e-4832-ae26-9945751678e5', (select id from public.units where no = 3), '3.1', 3, 'matching', 'จับคู่แนวทางเพิ่มมูลค่ากับตัวอย่าง', '{"left":["รูปลักษณ์","วัสดุ","การตลาด"],"right":["ใช้วัสดุธรรมชาติย่อยสลายได้","ขายผ่านช่องทางออนไลน์พร้อมเรื่องราวแบรนด์","เปลี่ยนลายผ้าให้ทันสมัย"]}'::jsonb, '{"pairs":[2,0,1]}'::jsonb, 'มูลค่าเพิ่มได้หลายด้าน', 'medium', false),
  ('5bb8ca86-3ee6-4977-aa56-c3321cb0d589', (select id from public.units where no = 3), '3.2', 3, 'mcq', 'เพลงที่แต่งขึ้นใหม่ได้รับความคุ้มครองตามทรัพย์สินทางปัญญาประเภทใด', '["สิทธิบัตร","เครื่องหมายการค้า","ลิขสิทธิ์","สิ่งบ่งชี้ทางภูมิศาสตร์"]'::jsonb, '{"index":2}'::jsonb, 'งานสร้างสรรค์ เช่น เพลง หนังสือ ภาพ ได้รับลิขสิทธิ์', 'easy', false),
  ('767ae732-b89d-4c64-abbb-659dedd6aa53', (select id from public.units where no = 3), '3.2', 3, 'mcq', 'โลโก้ของแบรนด์สินค้าควรจดทะเบียนเป็นทรัพย์สินทางปัญญาประเภทใด', '["ความลับทางการค้า","อนุสิทธิบัตร","เครื่องหมายการค้า","ลิขสิทธิ์"]'::jsonb, '{"index":2}'::jsonb, 'เครื่องหมายการค้าใช้แยกสินค้า/บริการของเรากับผู้อื่น', 'easy', false),
  ('33295c27-400e-4dd2-a6b6-184bad9988f4', (select id from public.units where no = 3), '3.2', 3, 'true_false', 'ลิขสิทธิ์เกิดขึ้นทันทีที่สร้างผลงาน โดยไม่ต้องจดทะเบียน', '[]'::jsonb, '{"value":true}'::jsonb, 'ต่างจากสิทธิบัตรและเครื่องหมายการค้าที่ต้องยื่นจดทะเบียน', 'medium', false),
  ('56f56510-1190-45d6-a643-207379bdaa48', (select id from public.units where no = 3), '3.2', 3, 'mcq', 'สูตรน้ำจิ้มของร้านที่ไม่เปิดเผยให้ใครรู้ จัดเป็นทรัพย์สินทางปัญญาประเภทใด', '["สิทธิบัตรการประดิษฐ์","ความลับทางการค้า","สิ่งบ่งชี้ทางภูมิศาสตร์","ลิขสิทธิ์"]'::jsonb, '{"index":1}'::jsonb, 'ข้อมูลที่มีมูลค่าเพราะเป็นความลับ', 'medium', false),
  ('ce4fa0b9-8706-47eb-aa45-39b12dd32223', (select id from public.units where no = 3), '3.2', 3, 'mcq', 'ข้าวหอมมะลิทุ่งกุลาร้องไห้ เป็นตัวอย่างของทรัพย์สินทางปัญญาประเภทใด', '["ลิขสิทธิ์","อนุสิทธิบัตร","สิ่งบ่งชี้ทางภูมิศาสตร์","เครื่องหมายการค้า"]'::jsonb, '{"index":2}'::jsonb, 'คุณภาพสินค้าเชื่อมโยงกับแหล่งผลิตเฉพาะถิ่น', 'medium', false),
  ('65fea9d7-9bcc-4488-a061-65bd82e9d382', (select id from public.units where no = 3), '3.2', 3, 'mcq', 'การประดิษฐ์ที่ปรับปรุงเล็กน้อย ไม่ซับซ้อนมาก เช่น ด้ามจับพับได้ เหมาะกับการขอรับความคุ้มครองแบบใด', '["อนุสิทธิบัตร","สิ่งบ่งชี้ทางภูมิศาสตร์","ลิขสิทธิ์","ความลับทางการค้า"]'::jsonb, '{"index":0}'::jsonb, 'อนุสิทธิบัตรเหมาะกับการประดิษฐ์ที่ไม่ซับซ้อน', 'medium', false),
  ('8b0d2271-735d-4379-a99c-1b052fa42eda', (select id from public.units where no = 3), '3.2', 3, 'true_false', 'การนำภาพของคนอื่นมาใช้ในโฆษณาสินค้าของเรา ควรขออนุญาตเจ้าของก่อน', '[]'::jsonb, '{"value":true}'::jsonb, 'การใช้เชิงพาณิชย์ต้องได้รับอนุญาต', 'easy', false),
  ('a26b9026-0980-4559-a4ba-be4ee0aaa8c3', (select id from public.units where no = 3), '3.1', 3, 'mcq', 'ก่อนตัดสินใจเพิ่มมูลค่าผลงาน ควรเริ่มจากข้อใด', '["ตั้งราคาสูงที่สุด","ลอกแบบสินค้าดัง","เลือกสีที่ตนชอบ","ศึกษาความต้องการของผู้ใช้กลุ่มเป้าหมาย"]'::jsonb, '{"index":3}'::jsonb, 'มูลค่าเพิ่มต้องตอบความต้องการจริงของผู้ใช้', 'medium', false),
  ('c89df1e2-ffc1-4a67-a988-08b4fbb2945f', (select id from public.units where no = 3), '3.2', 3, 'mcq', 'ก่อนนำชื่อแบรนด์ที่คิดเองไปจดเครื่องหมายการค้า ควรตรวจสอบสิ่งใด', '["มีสีสวย","ไม่ซ้ำหรือคล้ายของผู้อื่น","ยาวที่สุด","เป็นภาษาอังกฤษ"]'::jsonb, '{"index":1}'::jsonb, 'เครื่องหมายต้องไม่ซ้ำหรือคล้ายจนสับสน', 'medium', false),
  ('bfb9e4d9-7828-4f10-adf6-d714cde7d418', (select id from public.units where no = 3), '3.1', 3, 'true_false', 'การเพิ่มมูลค่าควรคำนึงถึงผลกระทบต่อสิ่งแวดล้อมด้วย', '[]'::jsonb, '{"value":true}'::jsonb, 'เช่น เลือกวัสดุที่ย่อยสลายได้', 'medium', false),
  ('e26d7b43-985d-436e-af80-301514608e63', (select id from public.units where no = 1), '1.1', 1, 'mcq', 'เครือข่ายยุคใดเป็นยุคแรกที่ใช้สัญญาณดิจิทัล', '["2G","1G","3G","5G"]'::jsonb, '{"index":0}'::jsonb, '1G เป็นแอนะล็อก 2G เริ่มดิจิทัล', 'easy', false),
  ('ad1ae853-7de1-4b58-a1fb-95504b0f9447', (select id from public.units where no = 1), '1.1', 1, 'mcq', 'การดูวิดีโอสตรีมมิงความละเอียดสูงบนมือถือได้ลื่นไหล เริ่มแพร่หลายในยุคใด', '["2G","1G","4G","ยังทำไม่ได้"]'::jsonb, '{"index":2}'::jsonb, '4G ความเร็วสูงรองรับสตรีมมิง', 'easy', false),
  ('962d8f5e-6fab-4a6b-af18-54655a10a513', (select id from public.units where no = 1), '1.1', 1, 'mcq', 'ข้อใดเป็นตัวอย่างของ Smart City', '["ไฟจราจรปรับเวลาตามปริมาณรถอัตโนมัติ","สร้างตึกสูง","เพิ่มป้ายรถเมล์","ปลูกต้นไม้ริมถนน"]'::jsonb, '{"index":0}'::jsonb, 'ใช้ข้อมูลและ IoT บริหารเมือง', 'medium', false),
  ('d7b6aa60-b092-47d3-a497-7c6634cfee11', (select id from public.units where no = 1), '1.1', 1, 'true_false', 'คลื่นความถี่สูงของ 5G เดินทางได้ไกลและทะลุสิ่งกีดขวางได้ดีกว่าคลื่นความถี่ต่ำ', '[]'::jsonb, '{"value":false}'::jsonb, 'คลื่นความถี่สูงเดินทางได้ใกล้กว่า จึงต้องมีเสาถี่ขึ้น', 'medium', false),
  ('b7bbae8e-e922-48a7-acee-263bd1cac21f', (select id from public.units where no = 1), '1.1', 1, 'mcq', 'การผ่าตัดทางไกลต้องอาศัยคุณสมบัติใดของเครือข่ายมากที่สุด', '["ราคาแพ็กเกจถูก","แบตเตอรี่อึด","หน้าจอใหญ่","ความหน่วงต่ำและเสถียร"]'::jsonb, '{"index":3}'::jsonb, 'แพทย์ต้องควบคุมเครื่องมือแบบทันที', 'medium', false),
  ('e453ffa6-55e2-44e6-a573-3e8e1984625d', (select id from public.units where no = 1), '1.2', 1, 'mcq', 'รถยนต์ประเภทใดมีทั้งเครื่องยนต์และมอเตอร์ไฟฟ้า และเสียบปลั๊กชาร์จได้', '["BEV","HEV","PHEV","FCEV"]'::jsonb, '{"index":2}'::jsonb, 'PHEV = Plug-in Hybrid', 'easy', false),
  ('dad1a993-fbb1-4e28-a161-6ddd3b786d6b', (select id from public.units where no = 1), '1.2', 1, 'mcq', 'ข้อใดเป็นข้อจำกัดของรถยนต์ไฟฟ้าในปัจจุบัน', '["สถานีชาร์จยังไม่ทั่วถึง","ไม่มีไอเสียจากท่อ","บำรุงรักษาง่าย","เสียงเงียบ"]'::jsonb, '{"index":0}'::jsonb, 'ข้ออื่นเป็นข้อดี', 'medium', false),
  ('cca04f17-b505-4499-ab25-c4449d886528', (select id from public.units where no = 1), '1.2', 1, 'true_false', 'เมื่อรถยนต์ไฟฟ้าเบรก มอเตอร์สามารถเปลี่ยนพลังงานกลกลับเป็นพลังงานไฟฟ้าเก็บในแบตเตอรี่ได้', '[]'::jsonb, '{"value":true}'::jsonb, 'เรียกว่า Regenerative braking', 'medium', false),
  ('3ce93ae8-737d-418d-a7dc-3eb79a703cd6', (select id from public.units where no = 1), '1.2', 1, 'mcq', 'ชาร์จแบตเตอรี่ 40 kWh เต็มหนึ่งครั้ง ค่าไฟหน่วยละ 4 บาท จะเสียค่าไฟประมาณเท่าใด', '["400 บาท","160 บาท","40 บาท","80 บาท"]'::jsonb, '{"index":1}'::jsonb, '40 × 4 = 160 บาท', 'hard', false),
  ('e0535157-5556-4bb7-aefa-46055b025fd1', (select id from public.units where no = 1), '1.2', 1, 'mcq', 'มอเตอร์ไฟฟ้าทำงานโดยอาศัยความรู้วิทยาศาสตร์เรื่องใด', '["การระเหย","การหักเหของแสง","เสียงก้อง","แม่เหล็กไฟฟ้า"]'::jsonb, '{"index":3}'::jsonb, 'มอเตอร์เปลี่ยนพลังงานไฟฟ้าเป็นพลังงานกลด้วยแม่เหล็กไฟฟ้า', 'medium', false),
  ('bd73493b-954a-476f-a742-9701fce9866b', (select id from public.units where no = 1), '1.3', 1, 'mcq', 'เครื่องสแกนที่จุดชำระเงินในร้านสะดวกซื้อ ส่วนใหญ่อ่านข้อมูลจากสิ่งใด', '["Barcode","ดาวเทียม","GPS","RFID ฝังในตัวลูกค้า"]'::jsonb, '{"index":0}'::jsonb, 'ป้ายบาร์โค้ดบนสินค้า', 'easy', false),
  ('06d8ff25-11ce-4822-a779-4f8b4fe6f911', (select id from public.units where no = 1), '1.3', 1, 'mcq', 'ลูกค้าใช้มือถือสแกนเพื่อดูสถานะพัสดุ ควรพิมพ์สิ่งใดบนใบปะหน้า', '["ภาพการ์ตูน","QR Code","ลายเซ็น","GPS"]'::jsonb, '{"index":1}'::jsonb, 'QR Code สแกนด้วยกล้องมือถือได้ง่าย', 'medium', false),
  ('f6358b10-275b-47f7-ac4a-f3eb0cf1a697', (select id from public.units where no = 1), '1.3', 1, 'true_false', 'ระบบจัดการคลังสินค้า (WMS) ช่วยบอกตำแหน่งที่เก็บและจำนวนสินค้าคงเหลือ', '[]'::jsonb, '{"value":true}'::jsonb, 'WMS = Warehouse Management System', 'easy', false),
  ('c7340a6e-85fb-4fb5-a828-98c4667817ca', (select id from public.units where no = 1), '1.3', 1, 'mcq', 'ขนส่งสินค้าสดจากเชียงใหม่ไปญี่ปุ่นให้ถึงภายใน 1 วัน ควรเลือกการขนส่งแบบใด', '["ทางอากาศ","ทางเรือ","ทางท่อ","ทางรถไฟ"]'::jsonb, '{"index":0}'::jsonb, 'ทางอากาศเร็วที่สุดสำหรับระยะไกลข้ามประเทศ', 'hard', false),
  ('c06e6bea-1d73-4c6a-a1be-75685b2ccd20', (select id from public.units where no = 1), '1', 1, 'mcq', 'ข้อใดเป็นปัจจัยด้านสิ่งแวดล้อมที่ผลักดันให้เกิดรถยนต์ไฟฟ้า', '["คนชอบรถสีขาว","ราคาน้ำมันลดลง","ปัญหามลพิษทางอากาศ","ถนนกว้างขึ้น"]'::jsonb, '{"index":2}'::jsonb, 'มลพิษจากไอเสียเป็นแรงผลักดันสำคัญ', 'medium', false),
  ('8546c1c9-7d7c-4173-a323-1133419c4edf', (select id from public.units where no = 1), '1', 1, 'matching', 'จับคู่ปัจจัยการเปลี่ยนแปลงเทคโนโลยีกับตัวอย่าง', '{"left":["ความต้องการของมนุษย์","เศรษฐกิจ","สิ่งแวดล้อม","ความรู้วิทยาศาสตร์"],"right":["ค้นพบวัสดุแบตเตอรี่แบบใหม่","ต้องการลดการปล่อยไอเสีย","บริษัทแข่งกันลดต้นทุน","อยากสื่อสารเห็นหน้ากันแม้อยู่ไกล"]}'::jsonb, '{"pairs":[3,2,1,0]}'::jsonb, 'ปัจจัยหลายด้านส่งผลร่วมกัน', 'medium', false),
  ('add88f27-0d48-4890-ad5e-866ce21420b9', (select id from public.units where no = 1), '1', 1, 'true_false', 'เทคโนโลยีกับวิทยาศาสตร์และคณิตศาสตร์ไม่มีความเกี่ยวข้องกัน', '[]'::jsonb, '{"value":false}'::jsonb, 'เทคโนโลยีนำความรู้วิทยาศาสตร์และคณิตศาสตร์มาใช้แก้ปัญหา', 'easy', false),
  ('ffb70467-1e03-497e-a129-9221f1885db3', (select id from public.units where no = 1), '1.1', 1, 'fill', 'อินเทอร์เน็ตของสรรพสิ่ง มีชื่อย่อภาษาอังกฤษว่า ______', '[]'::jsonb, '{"accept":["IoT","iot"]}'::jsonb, 'Internet of Things', 'medium', false),
  ('1a0bb3fc-9807-4b09-a3c6-1c6dc79b3767', (select id from public.units where no = 1), '1.1', 1, 'ordering', 'เรียงยุคของเครือข่ายโทรศัพท์เคลื่อนที่จากเก่าไปใหม่', '["4G สตรีมมิงความเร็วสูง","3G อินเทอร์เน็ตบนมือถือ","1G โทรด้วยเสียงแอนะล็อก","5G หน่วงต่ำ เชื่อมอุปกรณ์จำนวนมาก","2G ส่ง SMS ได้"]'::jsonb, '{"order":[2,4,1,0,3]}'::jsonb, '1G → 5G', 'medium', false),
  ('cd0fed41-2b9d-42d3-a926-3eb8add0caca', (select id from public.units where no = 1), '1', 1, 'short', 'เลือกเทคโนโลยี 1 อย่างจากหน่วยนี้ อธิบายว่าเกี่ยวข้องกับวิทยาศาสตร์หรือคณิตศาสตร์อย่างไร', '[]'::jsonb, null, 'ครูตรวจ: ระบุเทคโนโลยีและเชื่อมโยงความรู้วิทยาศาสตร์/คณิตศาสตร์ได้ถูกต้อง', 'medium', false),
  ('94ed83a4-c216-43a7-ad94-4acfc3319148', (select id from public.units where no = 2), '2.1', 3, 'mcq', 'ขั้นแรกของกระบวนการออกแบบเชิงวิศวกรรมคือข้อใด', '["นำเสนอ","ระบุปัญหา","ซื้อวัสดุ","ทดสอบชิ้นงาน"]'::jsonb, '{"index":1}'::jsonb, 'ต้องรู้ปัญหาก่อนจึงจะแก้ได้ตรงจุด', 'easy', false),
  ('0f2f88bd-950b-480b-aeb6-8bf9ce1396bf', (select id from public.units where no = 2), '2.1', 3, 'mcq', '"ค้นข้อมูลวิธีแก้ปัญหาที่คนอื่นเคยทำ" อยู่ในขั้นใด', '["ระบุปัญหา","นำเสนอ","ทดสอบ","รวบรวมข้อมูลและแนวคิดที่เกี่ยวข้อง"]'::jsonb, '{"index":3}'::jsonb, 'เป็นการรวบรวมข้อมูลและแนวคิด', 'medium', false),
  ('d07c006c-c75f-44a0-a8b7-68a3c4759cf2', (select id from public.units where no = 2), '2.1', 3, 'matching', 'จับคู่สถานการณ์กับขั้นตอนการออกแบบเชิงวิศวกรรม', '{"left":["สัมภาษณ์ชาวบ้านเรื่องปัญหาน้ำท่วมขัง","วาดภาพร่างชิ้นงาน","วัดว่าชิ้นงานรับน้ำหนักได้เท่าไร","ทำโปสเตอร์เล่าผลงาน"],"right":["ทดสอบ ประเมินผล ปรับปรุง","ออกแบบวิธีการแก้ปัญหา","นำเสนอ","ระบุปัญหา"]}'::jsonb, '{"pairs":[3,1,0,2]}'::jsonb, 'แต่ละกิจกรรมอยู่ในขั้นที่ต่างกัน', 'medium', false),
  ('41bf8586-2782-4eca-a059-ea5d0c2d7898', (select id from public.units where no = 2), '2.2', 2, 'mcq', 'เครื่องมือใดช่วยวิเคราะห์ปัญหาให้ครบทุกแง่มุม', '["ตารางสูตรคูณ","5W1H","SWOT ของบริษัท","ปฏิทิน"]'::jsonb, '{"index":1}'::jsonb, '5W1H ครอบคลุม ใคร อะไร ที่ไหน เมื่อไร ทำไม อย่างไร', 'easy', false),
  ('101b21f8-cc1b-4234-aa60-59a6dace6398', (select id from public.units where no = 2), '2.2', 2, 'mcq', 'ข้อใดเป็นกรอบของปัญหาที่ชัดเจนที่สุด', '["ออกแบบที่บังแดดแผงผัก งบไม่เกิน 300 บาท ไม่ใช้ไฟฟ้า ยกได้คนเดียว","ช่วยแม่ค้า","ทำให้ผักไม่เหี่ยว","ทำของสวย ๆ ให้ตลาด"]'::jsonb, '{"index":0}'::jsonb, 'ระบุสิ่งที่ต้องทำพร้อมเงื่อนไขชัดเจน', 'medium', false),
  ('93cec945-e551-427b-ad0e-b7c43ed85dc8', (select id from public.units where no = 2), '2.2', 2, 'true_false', 'การสังเกตและการสัมภาษณ์เป็นวิธีค้นหาปัญหาในชุมชนได้', '[]'::jsonb, '{"value":true}'::jsonb, 'ได้ข้อมูลจากผู้ที่เจอปัญหาจริง', 'easy', false),
  ('6860dc65-901b-4f59-a8ca-6ab3c1afc43a', (select id from public.units where no = 2), '2.3', 2, 'mcq', 'ข้อใดเป็นข้อมูลทุติยภูมิ', '["สำรวจจำนวนรถหน้าโรงเรียนด้วยตนเอง","ทดลองเอง","สถิติจากเว็บไซต์หน่วยงานรัฐ","สัมภาษณ์ครู"]'::jsonb, '{"index":2}'::jsonb, 'ข้อมูลที่ผู้อื่นรวบรวมไว้แล้ว', 'medium', false),
  ('45b5d5f7-d178-43dc-ab45-1ba6a69286eb', (select id from public.units where no = 2), '2.3', 3, 'mcq', 'เกณฑ์ใดไม่เหมาะใช้เปรียบเทียบแนวคิดแก้ปัญหา', '["ความปลอดภัย","ชื่อเพื่อนที่เสนอ","ความเป็นไปได้","ต้นทุน"]'::jsonb, '{"index":1}'::jsonb, 'ต้องใช้เกณฑ์ที่วัดคุณภาพของแนวคิด', 'medium', false),
  ('fb17cb2a-7314-4dd0-a71f-deb1b68b9453', (select id from public.units where no = 2), '2.3', 2, 'true_false', 'การคัดลอกข้อความจากเว็บไซต์มาใส่รายงานโดยไม่อ้างอิง ถือเป็นการละเมิดทรัพย์สินทางปัญญา', '[]'::jsonb, '{"value":true}'::jsonb, 'ต้องอ้างอิงแหล่งที่มา', 'medium', false),
  ('2d4d4754-29f7-4061-ac38-3da31316adf1', (select id from public.units where no = 2), '2.4', 3, 'mcq', 'การเลือกวัสดุควรพิจารณาข้อใดเป็นหลัก', '["วัสดุที่แพงที่สุด","สีที่ชอบ","สมบัติของวัสดุ ราคา และความปลอดภัย","ยี่ห้อดัง"]'::jsonb, '{"index":2}'::jsonb, 'เลือกตามความเหมาะสมกับงานและเงื่อนไข', 'easy', false),
  ('6b14547f-2606-4d2b-afb8-4df24cec9574', (select id from public.units where no = 2), '2.4', 3, 'mcq', 'ภาพที่แสดงด้านหน้า ด้านข้าง และด้านบนของชิ้นงาน พร้อมบอกขนาด เรียกว่าอะไร', '["ภาพถ่าย","การ์ตูน","ภาพฉาย","ภาพร่างอิสระ"]'::jsonb, '{"index":2}'::jsonb, 'ภาพฉายแสดงมุมมองหลายด้านพร้อมขนาด', 'medium', false),
  ('7fc4d507-f06b-4c24-a500-1f979e5acba9', (select id from public.units where no = 2), '2.4', 4, 'true_false', 'ระหว่างใช้เครื่องมือที่มีฝุ่นหรือเศษกระเด็น ควรสวมแว่นตานิรภัย', '[]'::jsonb, '{"value":true}'::jsonb, 'ป้องกันอันตรายต่อดวงตา', 'easy', false),
  ('6e7438e3-09ac-43d4-a22e-deb18a56244b', (select id from public.units where no = 2), '2.4', 4, 'mcq', 'การใช้ปืนกาวร้อนอย่างปลอดภัยคือข้อใด', '["วางบนขาตั้งเมื่อไม่ใช้","ใช้ใกล้น้ำ","เสียบทิ้งไว้ข้ามคืน","จับหัวปืนเพื่อทดสอบความร้อน"]'::jsonb, '{"index":0}'::jsonb, 'หัวปืนร้อนมาก ต้องวางบนขาตั้ง', 'medium', false),
  ('c5bb4ea3-437d-448f-a1f8-48c653c172a2', (select id from public.units where no = 2), '2.5', 4, 'mcq', 'ข้อใดเป็นเกณฑ์การทดสอบที่วัดผลได้ชัดเจน', '["เพื่อนชอบ","ชิ้นงานดูดี","ใช้งานได้พอสมควร","รับน้ำหนักได้อย่างน้อย 500 กรัม"]'::jsonb, '{"index":3}'::jsonb, 'เกณฑ์ที่ดีต้องวัดเป็นตัวเลขได้', 'medium', false),
  ('1ed32e32-050c-4459-a2e4-3000be73b5c2', (select id from public.units where no = 2), '2.5', 4, 'true_false', 'การบันทึกผลทดสอบควรบันทึกตามจริง แม้ผลจะไม่ผ่าน', '[]'::jsonb, '{"value":true}'::jsonb, 'ผลจริงใช้วิเคราะห์และปรับปรุง', 'medium', false),
  ('005d2f3e-c82c-4bee-a344-3b1742c95641', (select id from public.units where no = 2), '2.6', 4, 'mcq', 'วัตถุประสงค์และขอบเขตของโครงงาน อยู่ในส่วนใดของรายงาน', '["บรรณานุกรม","บทนำ","ภาคผนวก","ปก"]'::jsonb, '{"index":1}'::jsonb, 'อยู่ในบทนำ', 'easy', false),
  ('80ab36ba-9c35-4b20-a71f-1d963bf248fa', (select id from public.units where no = 2), '2.7', 4, 'mcq', 'โครงเรื่องการนำเสนอโครงงานข้อใดเหมาะสมที่สุด', '["ปัญหา → แนวคิด → การสร้าง → ผลทดสอบ → สรุป","สรุป → ปก → ผลทดสอบ","แสดงแต่ภาพสวย ๆ","เล่าแต่ความยากลำบาก"]'::jsonb, '{"index":0}'::jsonb, 'เล่าตามกระบวนการแก้ปัญหา', 'medium', false),
  ('13cdd027-8147-411c-a715-e561e6440ea5', (select id from public.units where no = 2), '2.4', 3, 'fill', 'ชิ้นงานที่สร้างขึ้นเพื่อทดสอบแนวคิดก่อนผลิตจริง เรียกว่า ______', '[]'::jsonb, '{"accept":["ต้นแบบ","ชิ้นงานต้นแบบ","prototype","โพรโทไทป์"]}'::jsonb, 'ต้นแบบ (Prototype)', 'medium', false),
  ('98405264-a3d6-4225-ac4c-710319f11e23', (select id from public.units where no = 2), '2.5', 4, 'ordering', 'เรียงขั้นตอนการทดสอบชิ้นงาน', '["วิเคราะห์ผลและปรับปรุง","บันทึกผลลงตาราง","ทดสอบหลายครั้ง","กำหนดสิ่งที่จะทดสอบและเกณฑ์ผ่าน"]'::jsonb, '{"order":[3,2,1,0]}'::jsonb, 'วางแผนก่อนทดสอบ แล้วบันทึกและวิเคราะห์', 'hard', false),
  ('b9270064-7f6b-4b9d-a95a-a44ae9bdcbab', (select id from public.units where no = 2), '2.2', 2, 'short', 'เขียนกรอบของปัญหาของโครงงานตนเอง พร้อมเงื่อนไขอย่างน้อย 2 ข้อ', '[]'::jsonb, null, 'ครูตรวจ: ระบุปัญหาชัดเจน มีเงื่อนไข/ข้อจำกัดอย่างน้อย 2 ข้อ', 'medium', false),
  ('80aaccdc-bf3c-4559-a8b9-22c844157196', (select id from public.units where no = 3), '3.1', 3, 'mcq', 'การเพิ่มมูลค่าให้ผลิตภัณฑ์หมายถึงข้อใด', '["ลดคุณภาพเพื่อลดต้นทุน","ขึ้นราคาโดยไม่ปรับปรุง","ทำให้ผู้ใช้เห็นคุณค่ามากขึ้น","เลิกผลิต"]'::jsonb, '{"index":2}'::jsonb, 'ทำให้ผลิตภัณฑ์มีคุณค่าในสายตาผู้ใช้มากขึ้น', 'easy', false),
  ('b17b2432-4ac4-483f-a3ec-c57bc18d0a61', (select id from public.units where no = 3), '3.1', 3, 'mcq', 'การออกแบบลวดลายผ้าทอให้ทันสมัยขึ้น เป็นการเพิ่มมูลค่าด้านใด', '["ฟังก์ชัน","การขนส่ง","รูปลักษณ์","บรรจุภัณฑ์"]'::jsonb, '{"index":2}'::jsonb, 'เปลี่ยนรูปลักษณ์ภายนอก', 'medium', false),
  ('713911b0-6b8e-411a-aac7-b5ae7f5305f6', (select id from public.units where no = 3), '3.1', 3, 'mcq', 'ข้อใดเป็นการเพิ่มมูลค่าด้านการตลาด', '["เปลี่ยนสี","ทำเพจเล่าเรื่องชุมชนและขายออนไลน์","ใช้วัสดุใหม่","เพิ่มช่องใส่ของ"]'::jsonb, '{"index":1}'::jsonb, 'การตลาดรวมถึงช่องทางขายและการเล่าเรื่อง', 'medium', false),
  ('9a322e11-25a1-401f-a672-5d3920689235', (select id from public.units where no = 3), '3.1', 3, 'true_false', 'การเพิ่มมูลค่าทุกครั้งต้องทำให้ต้นทุนลดลง', '[]'::jsonb, '{"value":false}'::jsonb, 'อาจเพิ่มต้นทุนได้ แต่ราคาขายหรือคุณค่าต้องเพิ่มขึ้นคุ้มค่า', 'medium', false),
  ('4dc38a5d-2d49-4024-ac97-914188f1406a', (select id from public.units where no = 3), '3.1', 3, 'mcq', 'ข้าวเกรียบขายถุงละ 20 บาท เปลี่ยนบรรจุภัณฑ์ใหม่ต้นทุนเพิ่ม 5 บาท ขายได้ 35 บาท มูลค่าที่เพิ่มขึ้น (ราคาขาย) เท่าใด', '["35 บาท","5 บาท","10 บาท","15 บาท"]'::jsonb, '{"index":3}'::jsonb, '35 − 20 = 15 บาท (กำไรเพิ่มจริง 10 บาท)', 'hard', false),
  ('eaa03df6-0930-40e3-a4d9-e260715a4fd1', (select id from public.units where no = 3), '3.1', 3, 'fill', 'มาตรฐานผลิตภัณฑ์ชุมชน มีชื่อย่อว่า ______', '[]'::jsonb, '{"accept":["มผช.","มผช"]}'::jsonb, 'มผช. = มาตรฐานผลิตภัณฑ์ชุมชน', 'easy', false),
  ('a65c7f6f-fbac-4fb0-a1d2-5c767e8d3ff4', (select id from public.units where no = 3), '3.2', 3, 'mcq', 'หน่วยงานที่ดูแลเรื่องทรัพย์สินทางปัญญาในประเทศไทยคือข้อใด', '["กรมการขนส่งทางบก","กรมทรัพย์สินทางปัญญา","กรมสรรพากร","กรมอุตุนิยมวิทยา"]'::jsonb, '{"index":1}'::jsonb, 'กรมทรัพย์สินทางปัญญา กระทรวงพาณิชย์', 'easy', false),
  ('d83dadcb-b16c-4873-a6c2-4ac647bce8ab', (select id from public.units where no = 3), '3.2', 3, 'mcq', 'โปรแกรมคอมพิวเตอร์ที่เขียนขึ้นใหม่ได้รับความคุ้มครองแบบใด', '["สิ่งบ่งชี้ทางภูมิศาสตร์","ความลับทางการค้าเท่านั้น","ลิขสิทธิ์","เครื่องหมายการค้า"]'::jsonb, '{"index":2}'::jsonb, 'โปรแกรมคอมพิวเตอร์เป็นงานอันมีลิขสิทธิ์', 'easy', false),
  ('538d14c2-5f16-4fe7-a59e-09dece24d6ba', (select id from public.units where no = 3), '3.2', 3, 'mcq', 'รูปทรงขวดน้ำแบบใหม่ที่สวยงามแปลกตา ควรขอรับความคุ้มครองแบบใด', '["ลิขสิทธิ์เพลง","สิ่งบ่งชี้ทางภูมิศาสตร์","สิทธิบัตรการออกแบบผลิตภัณฑ์","ความลับทางการค้า"]'::jsonb, '{"index":2}'::jsonb, 'คุ้มครองรูปร่าง ลวดลาย สีของผลิตภัณฑ์', 'medium', false),
  ('8004f195-3f6e-4160-a2ad-8c6f22a7ef89', (select id from public.units where no = 3), '3.2', 3, 'mcq', 'กลไกใหม่ของเครื่องจักรที่มีขั้นการประดิษฐ์สูงขึ้น ควรขอรับความคุ้มครองแบบใด', '["สิทธิบัตรการประดิษฐ์","ลิขสิทธิ์","สิ่งบ่งชี้ทางภูมิศาสตร์","เครื่องหมายการค้า"]'::jsonb, '{"index":0}'::jsonb, 'การประดิษฐ์ใหม่ที่มีขั้นการประดิษฐ์สูงขึ้น', 'medium', false),
  ('8a53af86-c93d-4824-ad71-9e1b0e3e3e40', (select id from public.units where no = 3), '3.2', 3, 'true_false', 'สิทธิบัตรและเครื่องหมายการค้าต้องยื่นจดทะเบียนจึงจะได้รับความคุ้มครอง', '[]'::jsonb, '{"value":true}'::jsonb, 'ต่างจากลิขสิทธิ์ที่เกิดขึ้นทันที', 'medium', false),
  ('29298ae0-bed9-46db-a107-d45a700d958c', (select id from public.units where no = 3), '3.2', 3, 'matching', 'จับคู่ตัวอย่างกับประเภททรัพย์สินทางปัญญา', '{"left":["นิยายที่แต่งเอง","โลโก้ร้านกาแฟ","สูตรลับของน้ำซุป","ส้มโอนครชัยศรี"],"right":["สิ่งบ่งชี้ทางภูมิศาสตร์","เครื่องหมายการค้า","ความลับทางการค้า","ลิขสิทธิ์"]}'::jsonb, '{"pairs":[3,1,2,0]}'::jsonb, 'แต่ละประเภทคุ้มครองต่างกัน', 'medium', false),
  ('f15b16a1-1ff1-459e-a203-9bc6a4f47cda', (select id from public.units where no = 3), '3.2', 3, 'true_false', 'ดาวน์โหลดภาพยนตร์ละเมิดลิขสิทธิ์มาแจกเพื่อน ไม่ผิดถ้าไม่ได้ขาย', '[]'::jsonb, '{"value":false}'::jsonb, 'การเผยแพร่โดยไม่ได้รับอนุญาตเป็นการละเมิด แม้ไม่ได้ขาย', 'easy', false),
  ('01d5cd60-ae34-4137-a323-cb96c983f1ba', (select id from public.units where no = 3), '3.2', 3, 'mcq', 'ข้อใดเป็นวิธีใช้ผลงานของผู้อื่นอย่างถูกต้อง', '["ใช้สื่อ Creative Commons ตามเงื่อนไขที่กำหนด","แก้สีแล้วอ้างว่าเป็นของตน","ลบชื่อเจ้าของออก","ใช้ได้เลยถ้าหาเจอในอินเทอร์เน็ต"]'::jsonb, '{"index":0}'::jsonb, 'ใช้ตามสัญญาอนุญาตและอ้างอิง', 'medium', false),
  ('04a51edc-f09d-46e5-ad48-ca14a61e9da4', (select id from public.units where no = 3), '3.2', 3, 'mcq', '"ด้ามจับกระทะแบบพับได้" ที่ปรับปรุงจากของเดิมเล็กน้อย เหมาะกับข้อใด', '["ลิขสิทธิ์","สิ่งบ่งชี้ทางภูมิศาสตร์","อนุสิทธิบัตร","ความลับทางการค้า"]'::jsonb, '{"index":2}'::jsonb, 'การประดิษฐ์ที่ไม่ซับซ้อนมาก', 'medium', false),
  ('635e4295-d0b9-437a-a127-2c27fea11ebb', (select id from public.units where no = 3), '3.1', 3, 'true_false', 'การเพิ่มมูลค่าควรคำนึงถึงความต้องการของผู้ใช้เป็นสำคัญ', '[]'::jsonb, '{"value":true}'::jsonb, 'ผู้ใช้เป็นผู้ตัดสินคุณค่า', 'easy', false),
  ('f9cab181-06fb-4556-a763-6d5d4a5db9df', (select id from public.units where no = 3), '3.1', 3, 'mcq', 'การใช้ใบตองหรือวัสดุธรรมชาติแทนพลาสติกในบรรจุภัณฑ์ เพิ่มมูลค่าด้านใดเด่นที่สุด', '["ราคาถูกที่สุดเสมอ","เป็นมิตรต่อสิ่งแวดล้อม","เก็บได้นานที่สุด","ทำให้สินค้าหนักขึ้น"]'::jsonb, '{"index":1}'::jsonb, 'ตอบกระแสผู้บริโภคที่ใส่ใจสิ่งแวดล้อม', 'medium', false),
  ('d61ca3e4-87f5-4834-a5b7-ef9ccdc78951', (select id from public.units where no = 3), '3.1', 3, 'ordering', 'เรียงขั้นตอนการวางแผนเพิ่มมูลค่าผลงาน', '["ศึกษาผู้ใช้กลุ่มเป้าหมาย","ประมาณต้นทุนและราคาขาย","เลือกแนวทางเพิ่มมูลค่า","ร่างแบบผลงานใหม่"]'::jsonb, '{"order":[0,2,3,1]}'::jsonb, 'เริ่มจากผู้ใช้ แล้วออกแบบและคำนวณความคุ้มค่า', 'medium', false),
  ('7dd1ebbe-b9fc-42b1-a400-ea2f209dcf9f', (select id from public.units where no = 3), '3.2', 3, 'fill', 'ชื่อสินค้าที่บ่งบอกว่าคุณภาพมาจากแหล่งผลิตเฉพาะ เรียกว่า สิ่งบ่งชี้ทาง ______', '[]'::jsonb, '{"accept":["ภูมิศาสตร์"]}'::jsonb, 'สิ่งบ่งชี้ทางภูมิศาสตร์ (GI)', 'medium', false),
  ('3875bf31-e08e-4278-aa60-79dfa9e55de6', (select id from public.units where no = 3), '3.1', 3, 'short', 'เสนอแนวทางเพิ่มมูลค่าผลงานโครงงานของตนเอง 2 ด้าน พร้อมเหตุผล', '[]'::jsonb, null, 'ครูตรวจ: เสนอได้ 2 ด้าน เหมาะสมกับผู้ใช้ มีเหตุผล', 'medium', false)
on conflict (id) do nothing;

insert into public.exams (id, title, kind, unit_id, session_no, assignment_id, question_ids, duration_min, shuffle, shuffle_choices, max_attempts, show_answers, require_fullscreen)
values
  ('523403fc-da1a-4623-a817-2d100d744a2d', 'Exit ticket คาบที่ 1', 'exit_ticket', null, 1, null, array['95084506-a968-45d0-aa14-69ae457d65f4', '057a9dc2-255a-46d4-a28e-f36c73d47d75', '185ab34b-636d-46cb-aa91-a0771bc5f5ec', 'd49bb688-e097-4790-a0d4-b2b2a0bd8826', '7ba4c06b-ffbf-447b-a1d4-752169c18515']::uuid[], 10, false, false, 1, true, false),
  ('50c7255c-e1e1-4f09-a841-d358855254df', 'Exit ticket คาบที่ 2', 'exit_ticket', (select id from public.units where no = 1), 2, null, array['d331c688-1837-4ae9-ac54-ab93565683ff', 'b53f6419-139d-4c40-aff2-9cef0a102608', 'b9acb494-55d5-46d5-a472-28eefda90180', '89d22c67-b51f-47e7-a3db-e86dcb34ac67', '18210625-1b6a-4710-a37f-68aa3352c3e0']::uuid[], 10, false, false, 1, true, false),
  ('5f5f79b0-48a9-493f-aa7c-4349eddce703', 'Exit ticket คาบที่ 3', 'exit_ticket', (select id from public.units where no = 1), 3, null, array['7eb316de-3e6d-4cf5-a1b3-ef3dddbe15f3', '625c4795-8890-4e1d-a2ec-ed3106bf3806', '23e8dc11-485b-4457-a02e-1a35bd0d4637', '0a5ab0cc-dbcf-4251-a76e-78b054beb39d', 'fe07b0d2-edf9-4162-adb8-f58a8fccb17d']::uuid[], 10, false, false, 1, true, false),
  ('d56fe9ea-5b5a-4dbf-aae8-943a71818fd1', 'Exit ticket คาบที่ 4', 'exit_ticket', (select id from public.units where no = 1), 4, null, array['e6f53ce1-b2d2-439b-ae54-ba3fabf1a798', '0a4c4cf9-a511-4eb7-a5e9-653433e8289a', 'd3b313c9-e08a-435f-a4b1-ad27760e2209', '3a04662d-2d35-4c80-afb8-e7a3a42ba097', '34350ca6-93eb-4c57-a72d-7c9c2c0c8c09']::uuid[], 10, false, false, 1, true, false),
  ('9ce54fcf-261f-417a-a135-53e7632e75ce', 'Exit ticket คาบที่ 5', 'exit_ticket', (select id from public.units where no = 1), 5, null, array['a6967dd8-d46b-4706-a1bf-90e33ed27cf2', 'ef846ee7-f840-4290-a244-c554f7d14a2e', 'a236f254-2692-4b9f-a4a2-1bc97fd72a6b', '87a14241-93cc-4de6-a4e7-77bee711a88c', 'afbc56b8-fdae-4811-a843-09d6a2630005']::uuid[], 10, false, false, 1, true, false),
  ('b292d8e7-0d5a-4618-a08e-4440b8498778', 'Exit ticket คาบที่ 6', 'exit_ticket', (select id from public.units where no = 1), 6, null, array['db4857b3-ef8c-4b76-ab0a-ab1e09e036e4', '28d86a4f-d234-46a2-a0e2-9b25a7c368e5', 'bfa08e89-818b-4f86-a19e-76e2a381dd1e', '3954eee7-de1b-4d81-a075-3e2897e93885', '33caec38-142d-4eab-a9e2-b94d83dd0a9e']::uuid[], 10, false, false, 1, true, false),
  ('ed564367-8cc6-468e-a757-79762761222a', 'Exit ticket คาบที่ 7', 'exit_ticket', (select id from public.units where no = 2), 7, null, array['961c0913-e30a-450d-a7a1-39c04f098ea6', '62e2cb84-4e42-473d-adca-ed8020afa4d3', '55aa02a6-e40b-47b6-a121-54baeb24784d', 'f1805b3b-a3ba-46f1-a8d5-0f9ed7a5c827', '76203c69-12c8-48fe-ab26-2694286b4b91']::uuid[], 10, false, false, 1, true, false),
  ('059d9b2c-0de2-4dc4-a67b-3b6e90eb659c', 'Exit ticket คาบที่ 8', 'exit_ticket', (select id from public.units where no = 2), 8, null, array['41ec6e4b-cfe6-4c18-a02d-784f8a9aa4bc', '904e52e4-3ae9-46e2-a0f9-0eeb808532fe', '0539ef29-7d8c-49bc-aa61-b571052f54f6', 'f1d7a5fd-d5ad-4400-ae61-c9c24c1c0df3', '4074cca7-5680-449b-a1f9-e6f1eed1cb99']::uuid[], 10, false, false, 1, true, false),
  ('82118a3d-0641-4664-aa63-3f2606282121', 'Exit ticket คาบที่ 9', 'exit_ticket', (select id from public.units where no = 2), 9, null, array['a2fb3978-bedf-405e-ac17-edb5cfd8ff90', 'c0de1c8d-f464-43a1-aee6-e65ec0e83cd1', '884f4ec4-5e80-44db-aa41-ef8e87007633', 'd7c6a5d9-f16c-4f1f-ace5-b1ca47bb65e8', 'dd634b3c-ac88-409f-a9e6-62c0ba29f3ea']::uuid[], 10, false, false, 1, true, false),
  ('64bc543a-2911-489c-a505-995c33147ac5', 'Exit ticket คาบที่ 11', 'exit_ticket', (select id from public.units where no = 2), 11, null, array['f1784e7f-e81c-48a5-affa-7c19cc8e8dd8', '2a32acc3-d97d-424a-a1ad-e5038f7e6c63', '441b7553-0c8e-4434-aa0d-000589622c91', '41a3ff36-817a-4d76-a1b5-a4b017f4fef4', '031ba8cf-0cf4-4806-a68a-44c9c6ced232']::uuid[], 10, false, false, 1, true, false),
  ('b4855628-aae9-4e8d-ac77-87231488c988', 'Exit ticket คาบที่ 12', 'exit_ticket', (select id from public.units where no = 2), 12, null, array['f561c9b0-a746-4ad9-a4e2-c5c6ca9fee2e', '2bdb388f-b174-4149-a63c-a50a31ef2c74', '10feaf04-a6f6-4699-aa3a-befc8f1e5b3e', 'd131f23e-7be6-490d-a6cf-de7f8732b8f9', '14777cd5-d2b5-4e5c-af84-4931d175197c']::uuid[], 10, false, false, 1, true, false),
  ('10de0c8a-c950-4450-a01b-8a726f20fd5f', 'Exit ticket คาบที่ 13', 'exit_ticket', (select id from public.units where no = 2), 13, null, array['8b4c2816-37ae-4c04-af81-aaa7e211d2ca', '9a3d4a0f-c747-471f-af0e-5ac32cdef616', 'dc777e4e-9031-4aec-a7d1-3b8b1c577ed3', 'db375985-849f-43cf-aa9e-31c197fbec7c', '60321cfa-c738-49dd-adc6-3d26434f379b']::uuid[], 10, false, false, 1, true, false),
  ('dadf779c-f588-4f52-ae36-f914ace8f856', 'Exit ticket คาบที่ 14', 'exit_ticket', (select id from public.units where no = 2), 14, null, array['8ed36254-7a88-45e1-a76a-54fc06bcf9df', '7e548010-fc2e-4db8-acba-f848c98016a0', '57a20529-3cf6-43cb-a02b-88517dc53393', '9fa2c3de-77a9-4e7b-a391-ca56150b003f', '7e85d3bf-7318-45e1-a0c3-690ace0886a3']::uuid[], 10, false, false, 1, true, false),
  ('73b193a0-05a6-4af5-aaad-4de91ee13acd', 'Exit ticket คาบที่ 15', 'exit_ticket', (select id from public.units where no = 2), 15, null, array['2edd6573-6c39-46ec-a959-d4c7f9d8b506', '424594cc-81aa-4539-abb7-3850670f885b', 'c6bf3f6a-cf2a-4cad-aac0-4c6f15f38fa6', '6989fd59-cbfd-4221-a3ab-8171d06b6fe9', '6bcb8638-2a18-4239-a038-18e4b4b62c49']::uuid[], 10, false, false, 1, true, false),
  ('efb97129-444d-4b38-a5d2-ce8a5c1a4a30', 'Exit ticket คาบที่ 16', 'exit_ticket', (select id from public.units where no = 2), 16, null, array['54231507-3223-468c-af41-e363debc5f32', '1176482b-a9fe-4bcd-aa3c-bb279afd3722', '8c51eb41-06c5-4687-a695-8e9a887708a6', '1601c54e-3643-4e7b-a040-1bb52545ccc0', 'bb2025ac-61df-41d4-a6fb-3a6be23abf07']::uuid[], 10, false, false, 1, true, false),
  ('545ef70d-2a5b-495e-a331-40a184377f3f', 'Exit ticket คาบที่ 17', 'exit_ticket', (select id from public.units where no = 3), 17, null, array['56cbcb95-a21b-4786-a027-79b40839f7da', '60e0bc70-b5e5-40d3-aa75-583affd94ad0', '334931af-2bd5-4493-ad5f-226e582896f6', '2aa2ca57-c86c-4653-a621-bb780b021616', 'a9c60950-301e-4832-ae26-9945751678e5']::uuid[], 10, false, false, 1, true, false),
  ('418609fe-31d7-4e1d-a076-140358c9e08c', 'Exit ticket คาบที่ 18', 'exit_ticket', (select id from public.units where no = 3), 18, null, array['5bb8ca86-3ee6-4977-aa56-c3321cb0d589', '767ae732-b89d-4c64-abbb-659dedd6aa53', '33295c27-400e-4dd2-a6b6-184bad9988f4', '56f56510-1190-45d6-a643-207379bdaa48', 'ce4fa0b9-8706-47eb-aa45-39b12dd32223']::uuid[], 10, false, false, 1, true, false),
  ('5192157d-5f8b-42b6-a5e9-6db4d5dfbebf', 'Exit ticket คาบที่ 19', 'exit_ticket', (select id from public.units where no = 3), 19, null, array['65fea9d7-9bcc-4488-a061-65bd82e9d382', '8b0d2271-735d-4379-a99c-1b052fa42eda', 'a26b9026-0980-4559-a4ba-be4ee0aaa8c3', 'c89df1e2-ffc1-4a67-a988-08b4fbb2945f', 'bfb9e4d9-7828-4f10-adf6-d714cde7d418']::uuid[], 10, false, false, 1, true, false),
  ('03631993-42af-4c24-a867-5e5f51ae8f4f', 'ทดสอบท้ายหน่วยที่ 1', 'unit_test', (select id from public.units where no = 1), 6, (select id from public.assignments where session_no = 6 and title = 'ทดสอบท้ายหน่วยที่ 1' limit 1), array['e26d7b43-985d-436e-af80-301514608e63', 'ad1ae853-7de1-4b58-a1fb-95504b0f9447', '962d8f5e-6fab-4a6b-af18-54655a10a513', 'd7b6aa60-b092-47d3-a497-7c6634cfee11', 'b7bbae8e-e922-48a7-acee-263bd1cac21f', 'e453ffa6-55e2-44e6-a573-3e8e1984625d', 'dad1a993-fbb1-4e28-a161-6ddd3b786d6b', 'cca04f17-b505-4499-ab25-c4449d886528', '3ce93ae8-737d-418d-a7dc-3eb79a703cd6', 'e0535157-5556-4bb7-aefa-46055b025fd1', 'bd73493b-954a-476f-a742-9701fce9866b', '06d8ff25-11ce-4822-a779-4f8b4fe6f911', 'f6358b10-275b-47f7-ac4a-f3eb0cf1a697', 'c7340a6e-85fb-4fb5-a828-98c4667817ca', 'c06e6bea-1d73-4c6a-a1be-75685b2ccd20', '8546c1c9-7d7c-4173-a323-1133419c4edf', 'add88f27-0d48-4890-ad5e-866ce21420b9', 'ffb70467-1e03-497e-a129-9221f1885db3', '1a0bb3fc-9807-4b09-a3c6-1c6dc79b3767', 'cd0fed41-2b9d-42d3-a926-3eb8add0caca']::uuid[], 30, true, true, 1, false, true),
  ('ccfced6b-1a0e-4e15-a7b7-ae124bb6a421', 'ทดสอบท้ายหน่วยที่ 2', 'unit_test', (select id from public.units where no = 2), 16, (select id from public.assignments where session_no = 16 and title = 'ทดสอบท้ายหน่วยที่ 2' limit 1), array['94ed83a4-c216-43a7-ad94-4acfc3319148', '0f2f88bd-950b-480b-aeb6-8bf9ce1396bf', 'd07c006c-c75f-44a0-a8b7-68a3c4759cf2', '41bf8586-2782-4eca-a059-ea5d0c2d7898', '101b21f8-cc1b-4234-aa60-59a6dace6398', '93cec945-e551-427b-ad0e-b7c43ed85dc8', '6860dc65-901b-4f59-a8ca-6ab3c1afc43a', '45b5d5f7-d178-43dc-ab45-1ba6a69286eb', 'fb17cb2a-7314-4dd0-a71f-deb1b68b9453', '2d4d4754-29f7-4061-ac38-3da31316adf1', '6b14547f-2606-4d2b-afb8-4df24cec9574', '7fc4d507-f06b-4c24-a500-1f979e5acba9', '6e7438e3-09ac-43d4-a22e-deb18a56244b', 'c5bb4ea3-437d-448f-a1f8-48c653c172a2', '1ed32e32-050c-4459-a2e4-3000be73b5c2', '005d2f3e-c82c-4bee-a344-3b1742c95641', '80ab36ba-9c35-4b20-a71f-1d963bf248fa', '13cdd027-8147-411c-a715-e561e6440ea5', '98405264-a3d6-4225-ac4c-710319f11e23', 'b9270064-7f6b-4b9d-a95a-a44ae9bdcbab']::uuid[], 30, true, true, 1, false, true),
  ('eb75aea9-f0be-4282-a7e0-b492c194ddca', 'ทดสอบท้ายหน่วยที่ 3', 'unit_test', (select id from public.units where no = 3), 19, (select id from public.assignments where session_no = 19 and title = 'ทดสอบท้ายหน่วยที่ 3' limit 1), array['80aaccdc-bf3c-4559-a8b9-22c844157196', 'b17b2432-4ac4-483f-a3ec-c57bc18d0a61', '713911b0-6b8e-411a-aac7-b5ae7f5305f6', '9a322e11-25a1-401f-a672-5d3920689235', '4dc38a5d-2d49-4024-ac97-914188f1406a', 'eaa03df6-0930-40e3-a4d9-e260715a4fd1', 'a65c7f6f-fbac-4fb0-a1d2-5c767e8d3ff4', 'd83dadcb-b16c-4873-a6c2-4ac647bce8ab', '538d14c2-5f16-4fe7-a59e-09dece24d6ba', '8004f195-3f6e-4160-a2ad-8c6f22a7ef89', '8a53af86-c93d-4824-ad71-9e1b0e3e3e40', '29298ae0-bed9-46db-a107-d45a700d958c', 'f15b16a1-1ff1-459e-a203-9bc6a4f47cda', '01d5cd60-ae34-4137-a323-cb96c983f1ba', '04a51edc-f09d-46e5-ad48-ca14a61e9da4', '635e4295-d0b9-437a-a127-2c27fea11ebb', 'f9cab181-06fb-4556-a763-6d5d4a5db9df', 'd61ca3e4-87f5-4834-a5b7-ef9ccdc78951', '7dd1ebbe-b9fc-42b1-a400-ea2f209dcf9f', '3875bf31-e08e-4278-aa60-79dfa9e55de6']::uuid[], 30, true, true, 1, false, true),
  ('8a52bf64-2da1-4c43-a628-3a8327ff694e', 'สอบกลางภาค', 'midterm', null, 10, (select id from public.assignments where session_no = 10 and title = 'สอบกลางภาค' limit 1), array['b7bbae8e-e922-48a7-acee-263bd1cac21f', '3ce93ae8-737d-418d-a7dc-3eb79a703cd6', 'e26d7b43-985d-436e-af80-301514608e63', 'cca04f17-b505-4499-ab25-c4449d886528', 'c7340a6e-85fb-4fb5-a828-98c4667817ca', 'dad1a993-fbb1-4e28-a161-6ddd3b786d6b', 'c06e6bea-1d73-4c6a-a1be-75685b2ccd20', '962d8f5e-6fab-4a6b-af18-54655a10a513', 'ad1ae853-7de1-4b58-a1fb-95504b0f9447', 'add88f27-0d48-4890-ad5e-866ce21420b9', '06d8ff25-11ce-4822-a779-4f8b4fe6f911', 'ffb70467-1e03-497e-a129-9221f1885db3', 'e6f53ce1-b2d2-439b-ae54-ba3fabf1a798', 'db4857b3-ef8c-4b76-ab0a-ab1e09e036e4', '18210625-1b6a-4710-a37f-68aa3352c3e0', '34350ca6-93eb-4c57-a72d-7c9c2c0c8c09', '625c4795-8890-4e1d-a2ec-ed3106bf3806', '33caec38-142d-4eab-a9e2-b94d83dd0a9e', '961c0913-e30a-450d-a7a1-39c04f098ea6', '904e52e4-3ae9-46e2-a0f9-0eeb808532fe', '62e2cb84-4e42-473d-adca-ed8020afa4d3', '55aa02a6-e40b-47b6-a121-54baeb24784d', '0539ef29-7d8c-49bc-aa61-b571052f54f6', '41ec6e4b-cfe6-4c18-a02d-784f8a9aa4bc', 'c0de1c8d-f464-43a1-aee6-e65ec0e83cd1', '76203c69-12c8-48fe-ab26-2694286b4b91', 'f1805b3b-a3ba-46f1-a8d5-0f9ed7a5c827', 'dd634b3c-ac88-409f-a9e6-62c0ba29f3ea', '4074cca7-5680-449b-a1f9-e6f1eed1cb99', '884f4ec4-5e80-44db-aa41-ef8e87007633']::uuid[], 60, true, true, 1, false, true),
  ('bc9c6c4e-3822-4758-a9f3-edbe5c8204d2', 'สอบปลายภาค', 'final', null, 20, (select id from public.assignments where session_no = 20 and title = 'สอบปลายภาค' limit 1), array['e453ffa6-55e2-44e6-a573-3e8e1984625d', 'f6358b10-275b-47f7-ac4a-f3eb0cf1a697', '8546c1c9-7d7c-4173-a323-1133419c4edf', 'd7b6aa60-b092-47d3-a497-7c6634cfee11', 'bd73493b-954a-476f-a742-9701fce9866b', 'e0535157-5556-4bb7-aefa-46055b025fd1', 'b53f6419-139d-4c40-aff2-9cef0a102608', '7eb316de-3e6d-4cf5-a1b3-ef3dddbe15f3', 'ef846ee7-f840-4290-a244-c554f7d14a2e', 'bfa08e89-818b-4f86-a19e-76e2a381dd1e', '2d4d4754-29f7-4061-ac38-3da31316adf1', '94ed83a4-c216-43a7-ad94-4acfc3319148', '98405264-a3d6-4225-ac4c-710319f11e23', '41bf8586-2782-4eca-a059-ea5d0c2d7898', '6b14547f-2606-4d2b-afb8-4df24cec9574', '80ab36ba-9c35-4b20-a71f-1d963bf248fa', '6860dc65-901b-4f59-a8ca-6ab3c1afc43a', '45b5d5f7-d178-43dc-ab45-1ba6a69286eb', 'fb17cb2a-7314-4dd0-a71f-deb1b68b9453', '0f2f88bd-950b-480b-aeb6-8bf9ce1396bf', '1ed32e32-050c-4459-a2e4-3000be73b5c2', '7fc4d507-f06b-4c24-a500-1f979e5acba9', 'bb2025ac-61df-41d4-a6fb-3a6be23abf07', 'd131f23e-7be6-490d-a6cf-de7f8732b8f9', 'f1784e7f-e81c-48a5-affa-7c19cc8e8dd8', '10feaf04-a6f6-4699-aa3a-befc8f1e5b3e', '6989fd59-cbfd-4221-a3ab-8171d06b6fe9', '7e85d3bf-7318-45e1-a0c3-690ace0886a3', 'f9cab181-06fb-4556-a763-6d5d4a5db9df', '9a322e11-25a1-401f-a672-5d3920689235', '29298ae0-bed9-46db-a107-d45a700d958c', '04a51edc-f09d-46e5-ad48-ca14a61e9da4', 'd61ca3e4-87f5-4834-a5b7-ef9ccdc78951', 'a65c7f6f-fbac-4fb0-a1d2-5c767e8d3ff4', 'b17b2432-4ac4-483f-a3ec-c57bc18d0a61', '8004f195-3f6e-4160-a2ad-8c6f22a7ef89', '60e0bc70-b5e5-40d3-aa75-583affd94ad0', '56cbcb95-a21b-4786-a027-79b40839f7da', '8b0d2271-735d-4379-a99c-1b052fa42eda', 'bfb9e4d9-7828-4f10-adf6-d714cde7d418']::uuid[], 60, true, true, 1, false, true),
  ('87f61662-a2f3-4ff8-a56d-b6b058a030cf', 'แบบทดสอบก่อนเรียน', 'pretest', null, 1, null, array['e26d7b43-985d-436e-af80-301514608e63', '3ce93ae8-737d-418d-a7dc-3eb79a703cd6', 'f6358b10-275b-47f7-ac4a-f3eb0cf1a697', 'e453ffa6-55e2-44e6-a573-3e8e1984625d', '962d8f5e-6fab-4a6b-af18-54655a10a513', 'dad1a993-fbb1-4e28-a161-6ddd3b786d6b', 'ad1ae853-7de1-4b58-a1fb-95504b0f9447', '6860dc65-901b-4f59-a8ca-6ab3c1afc43a', '98405264-a3d6-4225-ac4c-710319f11e23', '45b5d5f7-d178-43dc-ab45-1ba6a69286eb', '6e7438e3-09ac-43d4-a22e-deb18a56244b', '1ed32e32-050c-4459-a2e4-3000be73b5c2', 'd07c006c-c75f-44a0-a8b7-68a3c4759cf2', '7fc4d507-f06b-4c24-a500-1f979e5acba9', '29298ae0-bed9-46db-a107-d45a700d958c', 'eaa03df6-0930-40e3-a4d9-e260715a4fd1', 'a65c7f6f-fbac-4fb0-a1d2-5c767e8d3ff4', '8a53af86-c93d-4824-ad71-9e1b0e3e3e40', '7dd1ebbe-b9fc-42b1-a400-ea2f209dcf9f', '8004f195-3f6e-4160-a2ad-8c6f22a7ef89']::uuid[], 30, false, false, 1, false, false),
  ('aea07957-557b-43e7-a39d-236d4cd40572', 'แบบทดสอบหลังเรียน', 'posttest', null, 20, null, array['e26d7b43-985d-436e-af80-301514608e63', '3ce93ae8-737d-418d-a7dc-3eb79a703cd6', 'f6358b10-275b-47f7-ac4a-f3eb0cf1a697', 'e453ffa6-55e2-44e6-a573-3e8e1984625d', '962d8f5e-6fab-4a6b-af18-54655a10a513', 'dad1a993-fbb1-4e28-a161-6ddd3b786d6b', 'ad1ae853-7de1-4b58-a1fb-95504b0f9447', '6860dc65-901b-4f59-a8ca-6ab3c1afc43a', '98405264-a3d6-4225-ac4c-710319f11e23', '45b5d5f7-d178-43dc-ab45-1ba6a69286eb', '6e7438e3-09ac-43d4-a22e-deb18a56244b', '1ed32e32-050c-4459-a2e4-3000be73b5c2', 'd07c006c-c75f-44a0-a8b7-68a3c4759cf2', '7fc4d507-f06b-4c24-a500-1f979e5acba9', '29298ae0-bed9-46db-a107-d45a700d958c', 'eaa03df6-0930-40e3-a4d9-e260715a4fd1', 'a65c7f6f-fbac-4fb0-a1d2-5c767e8d3ff4', '8a53af86-c93d-4824-ad71-9e1b0e3e3e40', '7dd1ebbe-b9fc-42b1-a400-ea2f209dcf9f', '8004f195-3f6e-4160-a2ad-8c6f22a7ef89']::uuid[], 30, false, false, 1, true, false)
on conflict (id) do nothing;

-- >>>>>>>>>> seed_games.sql
-- =============================================================
-- Seed เกม 17 เกม และเหรียญ 8 เหรียญ (สร้างอัตโนมัติ — ห้ามแก้ตรง)
-- แก้ supabase/games/*.json แล้วรัน: node scripts/build-game-seed.mjs
-- รันหลัง seed.sql
-- =============================================================

insert into public.games (slug, unit_id, title, description, config, max_score, max_xp, min_duration_sec)
values
  ('warmup', null, 'อุ่นเครื่อง', 'เกมทดลองระบบ ตอบคำถามง่าย ๆ เกี่ยวกับเทคโนโลยีรอบตัว', '{"engine":"quiz","instructions":"ตอบคำถาม 5 ข้อ เลือกคำตอบที่ถูกที่สุด ตอบถูกได้เสียงติ๊ง!","timePerQuestionSec":20,"questions":[{"q":"ข้อใดเป็นเทคโนโลยี","choices":["ก้อนหิน","ดินสอ","เมฆ","ใบไม้"],"answer":1,"explain":"ดินสอเป็นสิ่งที่มนุษย์สร้างขึ้นเพื่อแก้ปัญหา จึงเป็นเทคโนโลยี"},{"q":"เทคโนโลยีสร้างขึ้นเพื่ออะไรเป็นหลัก","choices":["ทำให้ของแพงขึ้น","แก้ปัญหาหรือตอบความต้องการ","ใช้ประดับบ้าน","ไม่มีจุดประสงค์"],"answer":1,"explain":"เทคโนโลยีช่วยแก้ปัญหาและอำนวยความสะดวก"},{"q":"ช้อนส้อมเป็นเทคโนโลยีหรือไม่","choices":["เป็น","ไม่เป็น","เป็นเฉพาะช้อน","เป็นเฉพาะส้อม"],"answer":0,"explain":"เทคโนโลยีไม่จำเป็นต้องเป็นอุปกรณ์ไฟฟ้า"},{"q":"เว็บห้องเรียนนี้ ส่งงานได้รูปแบบใดบ้าง","choices":["ข้อความอย่างเดียว","ข้อความ ตาราง ไฟล์ และลิงก์","ไฟล์เสียงเท่านั้น","ส่งไม่ได้"],"answer":1,"explain":"ส่งงานได้หลายรูปแบบตามที่ครูกำหนด"},{"q":"เล่นเกมซ้ำในวันเดียวกัน ได้ XP สูงสุดกี่รอบต่อเกม","choices":["1 รอบ","3 รอบ","10 รอบ","ไม่จำกัด"],"answer":1,"explain":"ได้ XP วันละ 3 รอบต่อเกม รอบแรกได้เต็ม รอบต่อไปได้ 20%"}]}'::jsonb, 100, 10, 10),
  ('5g-time-machine', (select id from public.units where no = 1), '5G Time Machine', 'ลากความสามารถไปวางในยุคเครือข่าย 1G–5G ให้ถูกก่อนหมดเวลา', '{"engine":"sort","mode":"board","instructions":"ลาก (หรือแตะการ์ด แล้วแตะยุค) ความสามารถแต่ละอย่างไปไว้ในยุคที่เริ่มทำได้ แล้วกดตรวจคำตอบ","timeLimitSec":120,"buckets":[{"id":"1g","label":"1G","icon":"📞"},{"id":"2g","label":"2G","icon":"✉️"},{"id":"3g","label":"3G","icon":"🌐"},{"id":"4g","label":"4G","icon":"🎬"},{"id":"5g","label":"5G","icon":"🚗"}],"cards":[{"text":"โทรคุยด้วยเสียงแบบแอนะล็อก","bucket":"1g"},{"text":"ส่งข้อความสั้น SMS","bucket":"2g"},{"text":"สัญญาณดิจิทัลยุคแรก","bucket":"2g"},{"text":"เปิดเว็บไซต์บนมือถือ","bucket":"3g"},{"text":"วิดีโอคอลยุคแรก","bucket":"3g"},{"text":"ดูวิดีโอสตรีมมิงความละเอียดสูง","bucket":"4g"},{"text":"ไลฟ์สดผ่านโซเชียลมีเดีย","bucket":"4g"},{"text":"รถยนต์ไร้คนขับสื่อสารกันทันที","bucket":"5g"},{"text":"ผ่าตัดทางไกล","bucket":"5g"},{"text":"เชื่อมต่ออุปกรณ์ IoT นับล้านชิ้น","bucket":"5g"}]}'::jsonb, 100, 40, 20),
  ('ev-garage', (select id from public.units where no = 1), 'EV Garage', 'อ่านคำอธิบายรถทีละคัน แล้วจอดเข้าโรงรถ HEV / PHEV / BEV / FCEV', '{"engine":"sort","mode":"stream","instructions":"รถเข้ามาทีละคัน อ่านระบบขับเคลื่อนแล้วกดเลือกโรงรถที่ถูกต้อง จบแล้วมีคำถามโบนัส","buckets":[{"id":"hev","label":"HEV","icon":"⛽🔋"},{"id":"phev","label":"PHEV","icon":"🔌⛽"},{"id":"bev","label":"BEV","icon":"🔋"},{"id":"fcev","label":"FCEV","icon":"💧"}],"cards":[{"text":"มีเครื่องยนต์และมอเตอร์ ชาร์จแบตจากการเบรก เสียบปลั๊กไม่ได้","bucket":"hev"},{"text":"ใช้แบตเตอรี่และมอเตอร์ไฟฟ้าอย่างเดียว ไม่มีถังน้ำมัน","bucket":"bev"},{"text":"เติมไฮโดรเจน ผลิตไฟฟ้าในตัวรถ ปล่อยไอน้ำ","bucket":"fcev"},{"text":"มีเครื่องยนต์ แบตใหญ่ขึ้น เสียบชาร์จที่บ้านได้","bucket":"phev"},{"text":"วิ่งระยะสั้นด้วยไฟฟ้าล้วน หมดไฟแล้วใช้น้ำมันต่อ และชาร์จจากปลั๊กได้","bucket":"phev"},{"text":"ต้องหาสถานีชาร์จเมื่อแบตใกล้หมด เพราะไม่มีเครื่องยนต์เลย","bucket":"bev"},{"text":"รถไฮบริดทั่วไป ประหยัดน้ำมัน แต่ไม่มีช่องเสียบสายชาร์จ","bucket":"hev"},{"text":"ใช้เซลล์เชื้อเพลิง ต้องมีสถานีเติมไฮโดรเจน","bucket":"fcev"}],"bonus":[{"q":"ข้อใดเป็นข้อดีของรถยนต์ไฟฟ้า","choices":["ราคาเริ่มต้นถูกที่สุด","ไม่มีไอเสียจากท่อไอเสีย","ชาร์จเสร็จใน 1 นาที","สถานีชาร์จมีทุกซอย"],"answer":1,"explain":"ข้ออื่นยังเป็นข้อจำกัด"},{"q":"ข้อใดเป็นข้อจำกัดของรถยนต์ไฟฟ้า","choices":["เสียงเงียบ","ค่าพลังงานต่อกิโลเมตรต่ำ","ใช้เวลาชาร์จนานกว่าเติมน้ำมัน","บำรุงรักษาง่าย"],"answer":2,"explain":"เวลาชาร์จยังนานกว่าการเติมน้ำมัน"}]}'::jsonb, 100, 40, 20),
  ('logistics-rush', (select id from public.units where no = 1), 'Logistics Rush', 'เลือกเทคโนโลยีให้เหมาะกับงานขนส่ง แล้วหาเส้นทางส่งพัสดุที่สั้นที่สุด', '{"engine":"route","instructions":"ด่าน 1 เลือกเทคโนโลยีที่เหมาะกับสถานการณ์ · ด่าน 2 แตะช่องทีละช่องจาก 🏭 ไปถึง 🏠 ให้สั้นที่สุด หลบสิ่งกีดขวาง","scenarios":[{"q":"คลังสินค้าต้องตรวจนับสินค้าทั้งพาเลทโดยไม่ต้องแกะกล่อง","choices":["Barcode","RFID","GPS","เขียนด้วยมือ"],"answer":1,"explain":"RFID อ่านผ่านกล่องและอ่านหลายชิ้นพร้อมกัน"},{"q":"ลูกค้าอยากรู้ว่ารถส่งของอยู่ตรงไหนตอนนี้","choices":["GPS","Barcode","ใบเสร็จ","บรรจุภัณฑ์"],"answer":0,"explain":"GPS ติดตามตำแหน่งแบบเรียลไทม์"},{"q":"ร้านสะดวกซื้อต้องการคิดเงินเร็วที่จุดชำระเงิน","choices":["GPS","Barcode","ดาวเทียม","โดรน"],"answer":1,"explain":"สแกนบาร์โค้ดบนสินค้าได้เร็ว"},{"q":"บริษัทต้องรู้ว่าสินค้าแต่ละชนิดเก็บอยู่ชั้นไหน เหลือกี่ชิ้น","choices":["ระบบจัดการคลังสินค้า (WMS)","ไฟฉาย","รถบรรทุก","เทปกาว"],"answer":0,"explain":"WMS บอกตำแหน่งและจำนวนคงเหลือ"}],"grids":[{"label":"ส่งพัสดุในหมู่บ้าน","rows":5,"cols":6,"start":[0,0],"goal":[4,5],"walls":[[1,1],[1,2],[1,3],[3,2],[3,3],[3,4],[2,5]]},{"label":"ส่งของเข้าตัวเมือง","rows":6,"cols":6,"start":[5,0],"goal":[0,5],"walls":[[4,1],[3,1],[2,1],[2,2],[2,3],[4,3],[4,4],[1,4],[0,3]]}]}'::jsonb, 100, 40, 25),
  ('boss-unit-1', (select id from public.units where no = 1), 'Boss Battle หน่วย 1', 'ตอบถูกเพื่อลดพลังปีศาจเทคโนโลยีล้าหลัง ตอบผิดเสียหัวใจ', '{"engine":"boss","instructions":"มีหัวใจ 3 ดวง ตอบถูกโจมตีบอส ตอบผิดเสียหัวใจ 1 ดวง ล้มบอสให้ได้!","hearts":3,"timePerQuestionSec":25,"stages":[{"name":"ปีศาจเทคโนโลยีล้าหลัง","emoji":"👾","questions":[{"q":"ยุคใดเริ่มส่ง SMS ได้","choices":["1G","2G","4G","5G"],"answer":1},{"q":"จุดเด่นของ 5G ที่สำคัญต่อการผ่าตัดทางไกล","choices":["ความหน่วงต่ำ","ราคาถูก","เสาสัญญาณน้อย","ใช้คลื่นต่ำ"],"answer":0},{"q":"รถประเภทใดใช้ไฮโดรเจน","choices":["HEV","BEV","FCEV","PHEV"],"answer":2},{"q":"รถประเภทใดเสียบปลั๊กไม่ได้","choices":["HEV","PHEV","BEV","ทุกข้อเสียบได้"],"answer":0},{"q":"เทคโนโลยีใดอ่านป้ายได้หลายชิ้นพร้อมกันผ่านกล่อง","choices":["QR Code","Barcode","RFID","GPS"],"answer":2},{"q":"การคำนวณระยะทางที่รถไฟฟ้าวิ่งได้ ใช้ความรู้ศาสตร์ใด","choices":["คณิตศาสตร์","ดนตรี","พลศึกษา","ภาษาอังกฤษ"],"answer":0},{"q":"ข้อใดไม่ใช่ปัจจัยที่ทำให้เทคโนโลยีเปลี่ยนแปลง","choices":["ความต้องการของมนุษย์","ความรู้วิทยาศาสตร์","สิ่งแวดล้อม","สีโปรดของเรา"],"answer":3},{"q":"IoT ย่อมาจากอะไร","choices":["Internet of Things","Input of Tech","Island of Technology","Inside of Tablet"],"answer":0}]}]}'::jsonb, 100, 50, 30),
  ('process-puzzle', (select id from public.units where no = 2), 'Process Puzzle', 'เรียงกระบวนการออกแบบเชิงวิศวกรรม 6 ขั้น แล้วจับคู่สถานการณ์กับขั้นตอน', '{"engine":"sequence","instructions":"ด่าน 1 เรียงขั้นตอนด้วยปุ่มลูกศร · ด่าน 2 เลือกว่าแต่ละสถานการณ์อยู่ขั้นใด","items":["ระบุปัญหา","รวบรวมข้อมูลและแนวคิดที่เกี่ยวข้อง","ออกแบบวิธีการแก้ปัญหา","วางแผนและดำเนินการแก้ปัญหา","ทดสอบ ประเมินผล และปรับปรุงแก้ไข","นำเสนอผลการแก้ปัญหา"],"match":[{"situation":"สัมภาษณ์แม่ค้าว่าเจอปัญหาอะไร","step":0},{"situation":"ค้นวิธีที่คนอื่นเคยใช้แก้ปัญหาคล้ายกัน","step":1},{"situation":"วาดภาพร่างชิ้นงาน 3 มุม","step":2},{"situation":"ตัดไม้และประกอบชิ้นงานตามแผน","step":3},{"situation":"วัดว่าชิ้นงานรับน้ำหนักได้กี่กรัม","step":4},{"situation":"ทำโปสเตอร์เล่าผลงานให้เพื่อนฟัง","step":5}]}'::jsonb, 100, 40, 20),
  ('problem-detective', (select id from public.units where no = 2), 'Problem Detective', 'อ่านเรื่องราวชุมชน แยกข้อมูล 5W1H แล้วเลือกกรอบของปัญหาที่ดีที่สุด', '{"engine":"sort","mode":"board","instructions":"อ่านเรื่องราว แล้วจัดข้อมูลแต่ละชิ้นเข้ากล่อง 5W1H จากนั้นตอบคำถามโบนัส","story":"ทุกเช้าวันเสาร์ ป้าแดงขายผักที่ตลาดนัดหน้าโรงเรียน แผงของป้าอยู่กลางแดดไม่มีที่บัง ช่วง 9–11 โมงผักจะเหี่ยวเร็วเพราะร้อนจัด ทำให้ขายไม่ได้ราคา ป้าอยากได้ที่บังแดดที่ยกเก็บได้คนเดียว ใช้งบไม่เกิน 300 บาท","buckets":[{"id":"who","label":"Who ใคร"},{"id":"what","label":"What อะไร"},{"id":"where","label":"Where ที่ไหน"},{"id":"when","label":"When เมื่อไร"},{"id":"why","label":"Why ทำไม"},{"id":"how","label":"How ส่งผล/อยากให้แก้อย่างไร"}],"cards":[{"text":"ป้าแดงแม่ค้าขายผัก","bucket":"who"},{"text":"ผักเหี่ยวเร็ว","bucket":"what"},{"text":"แผงตลาดนัดหน้าโรงเรียน","bucket":"where"},{"text":"เช้าวันเสาร์ ช่วง 9–11 โมง","bucket":"when"},{"text":"แผงอยู่กลางแดด อากาศร้อนจัด","bucket":"why"},{"text":"ขายไม่ได้ราคา อยากได้ที่บังแดดยกเก็บได้","bucket":"how"}],"bonus":[{"q":"กรอบของปัญหาข้อใดดีที่สุด","choices":["ทำให้ผักสวย","ออกแบบที่บังแดดแผงผัก ยกเก็บได้คนเดียว งบไม่เกิน 300 บาท","ซื้อตู้เย็นให้ป้า","ย้ายตลาด"],"answer":1,"explain":"ระบุสิ่งที่ต้องทำพร้อมเงื่อนไขชัดเจน"}]}'::jsonb, 100, 40, 25),
  ('idea-picker', (select id from public.units where no = 2), 'Idea Picker', 'ให้คะแนนแนวคิดตามเกณฑ์ แล้วเลือกแนวคิดที่ดีที่สุดพร้อมเหตุผล', '{"engine":"idea","instructions":"อ่านข้อมูลแนวคิด ให้คะแนนแต่ละเกณฑ์ 1–3 (3 = ดีที่สุด) แล้วเลือกแนวคิดที่ดีที่สุดและเหตุผล","problem":"ที่บังแดดแผงผักของป้าแดง งบไม่เกิน 300 บาท ยกเก็บได้คนเดียว","criteria":["ต้นทุน","ความปลอดภัย","ความเป็นไปได้","เวลาที่ใช้สร้าง"],"ideas":[{"name":"ร่มชายหาดดัดแปลง","desc":"ร่มเก่า 150 บาท ปักกับขาตั้ง ลมแรงอาจล้ม สร้าง 1 ชั่วโมง","truth":[3,1,3,3]},{"name":"โครงท่อ PVC + ผ้าใบ","desc":"วัสดุ 280 บาท ต่อแน่น พับเก็บได้ สร้าง 1 วัน","truth":[2,3,3,2]},{"name":"หลังคาเหล็กเชื่อม","desc":"วัสดุ 1,500 บาท หนักมาก ต้องใช้ช่างเชื่อม สร้าง 1 สัปดาห์","truth":[1,3,1,1]}],"reasons":[{"text":"ไม่เกินงบ ปลอดภัย และยกเก็บได้คนเดียวตามกรอบของปัญหา","correct":true},{"text":"เพราะดูแข็งแรงที่สุด แม้จะเกินงบ","correct":false},{"text":"เพราะสร้างเร็วที่สุด ไม่ต้องคิดเรื่องอื่น","correct":false}]}'::jsonb, 100, 40, 30),
  ('blueprint-builder', (select id from public.units where no = 2), 'Blueprint Builder', 'จับคู่เครื่องมือและวัสดุให้เหมาะกับงานในแบบร่าง', '{"engine":"sort","mode":"board","instructions":"จัดงานแต่ละอย่างให้ตรงกับเครื่องมือที่เหมาะสม","buckets":[{"id":"saw","label":"เลื่อย","icon":"🪚"},{"id":"drill","label":"สว่าน","icon":"🔩"},{"id":"glue","label":"ปืนกาวร้อน","icon":"🔥"},{"id":"cutter","label":"คัตเตอร์ + แผ่นรองตัด","icon":"✂️"},{"id":"ruler","label":"ไม้บรรทัด/ตลับเมตร","icon":"📏"}],"cards":[{"text":"ตัดไม้ระแนงยาว 50 ซม.","bucket":"saw"},{"text":"เจาะรูยึดน็อตบนแผ่นไม้","bucket":"drill"},{"text":"ติดชิ้นฟิวเจอร์บอร์ดเข้าด้วยกัน","bucket":"glue"},{"text":"ตัดกระดาษลังตามแบบ","bucket":"cutter"},{"text":"วัดขนาดก่อนตัดตามแบบร่าง","bucket":"ruler"},{"text":"ตัดท่อ PVC ให้ได้ความยาวเท่ากัน","bucket":"saw"},{"text":"ทำรูร้อยเชือกบนแผ่นอะคริลิก","bucket":"drill"}]}'::jsonb, 100, 30, 15),
  ('safety-check', (select id from public.units where no = 2), 'Safety Check', 'แยกพฤติกรรมปลอดภัย / ไม่ปลอดภัย ในการใช้เครื่องมือ', '{"engine":"sort","mode":"stream","instructions":"พฤติกรรมขึ้นมาทีละข้อ กดเลือกว่าปลอดภัยหรือไม่ปลอดภัย","cardTimeSec":10,"buckets":[{"id":"safe","label":"ปลอดภัย","icon":"✅"},{"id":"unsafe","label":"ไม่ปลอดภัย","icon":"⛔"}],"cards":[{"text":"สวมแว่นตานิรภัยขณะเจาะ","bucket":"safe"},{"text":"ตัดคัตเตอร์เข้าหาตัว","bucket":"unsafe","explain":"ต้องตัดออกจากตัว"},{"text":"รวบผมยาวก่อนใช้สว่าน","bucket":"safe"},{"text":"จับปลั๊กไฟขณะมือเปียก","bucket":"unsafe","explain":"มือเปียกเสี่ยงไฟดูด"},{"text":"วางปืนกาวร้อนบนขาตั้งเมื่อไม่ใช้","bucket":"safe"},{"text":"วิ่งเล่นในห้องปฏิบัติการ","bucket":"unsafe"},{"text":"ใช้ปากกาจับชิ้นงานให้แน่นก่อนเลื่อย","bucket":"safe"},{"text":"สวมถุงมือผ้าขณะใช้สว่าน","bucket":"unsafe","explain":"ถุงมือผ้าอาจถูกดอกสว่านดึงพันเข้าไป"},{"text":"ถอดปลั๊กหัวแร้งเมื่อเลิกใช้","bucket":"safe"},{"text":"เก็บใบมีดคัตเตอร์ทิ้งไว้บนโต๊ะ","bucket":"unsafe"}]}'::jsonb, 100, 30, 15),
  ('fix-the-bug', (select id from public.units where no = 2), 'Fix the Bug', 'ดูผลทดสอบต้นแบบที่ล้มเหลว เลือกสาเหตุและวิธีปรับปรุง', '{"engine":"quiz","instructions":"อ่านผลทดสอบ แล้วเลือกสาเหตุหรือวิธีแก้ที่สมเหตุสมผลที่สุด","timePerQuestionSec":30,"questions":[{"q":"🧪 ชั้นวางหนังสือรับน้ำหนักได้ 400 กรัม (เป้าหมาย 1 กก.) ขาตั้งงอ — สาเหตุที่เป็นไปได้มากที่สุด?","choices":["สีไม่สวย","ขาตั้งบางเกินไป วัสดุไม่แข็งแรงพอ","ตั้งชื่อผิด","ทดสอบตอนกลางวัน"],"answer":1},{"q":"🧪 จากข้อที่แล้ว ควรปรับปรุงอย่างไร","choices":["เพิ่มค้ำยัน/ใช้วัสดุหนาขึ้น แล้วทดสอบซ้ำ","เลิกทดสอบ","ทาสีใหม่","ลดเป้าหมายเหลือ 100 กรัม"],"answer":0},{"q":"🧪 กระถางรดน้ำอัตโนมัติ น้ำไหลออกหมดใน 10 นาที (เป้าหมาย 1 วัน) — แก้ที่ใด","choices":["ทำรูน้ำหยดให้เล็กลง","เพิ่มน้ำให้มากขึ้น","เปลี่ยนสีกระถาง","ย้ายไปไว้กลางแดด"],"answer":0},{"q":"🧪 รถของเล่นพลังยางยืดวิ่งเบี้ยวไปทางซ้ายทุกครั้ง — สาเหตุที่ควรตรวจก่อน","choices":["แกนล้อไม่ตรง/ล้อไม่เท่ากัน","ยางยืดสีแดง","พื้นห้องสะอาด","คนทดสอบใส่เสื้อสีฟ้า"],"answer":0},{"q":"🧪 ทดสอบ 3 ครั้งได้ผล 12, 30, 13 วินาที ควรทำอย่างไรกับค่า 30","choices":["ตรวจว่าครั้งนั้นมีความผิดปกติไหม แล้วทดสอบเพิ่ม","ลบทิ้งโดยไม่บอกใคร","ใช้ค่า 30 อย่างเดียว","เลิกทำโครงงาน"],"answer":0},{"q":"🧪 ที่บังแดดผ้าใบพลิกเมื่อลมแรง — วิธีปรับปรุงที่ดีที่สุด","choices":["ถ่วงน้ำหนักฐานหรือยึดเชือกกับพื้น","เปลี่ยนเป็นผ้าสีเข้ม","ไม่ใช้ตอนกลางวัน","ทำให้สูงขึ้นอีก"],"answer":0}]}'::jsonb, 100, 40, 20),
  ('report-order', (select id from public.units where no = 2), 'Report Order', 'เรียงหัวข้อรายงานโครงงานให้ถูกต้อง', '{"engine":"sequence","instructions":"เรียงส่วนประกอบของรายงานโครงงานจากหน้าแรกถึงหน้าสุดท้าย","items":["ปก","บทคัดย่อ","กิตติกรรมประกาศ","สารบัญ","บทนำ","ข้อมูลและแนวคิดที่เกี่ยวข้อง","วิธีดำเนินงาน","ผลการดำเนินงาน","สรุป อภิปรายผล และข้อเสนอแนะ","บรรณานุกรม","ภาคผนวก"]}'::jsonb, 100, 30, 15),
  ('boss-unit-2', (select id from public.units where no = 2), 'Boss Battle หน่วย 2', 'ล้มบอสปัญหาเรื้อรังด้วยกระบวนการออกแบบเชิงวิศวกรรม', '{"engine":"boss","instructions":"มีหัวใจ 3 ดวง ตอบถูกโจมตีบอส ตอบผิดเสียหัวใจ","hearts":3,"timePerQuestionSec":25,"stages":[{"name":"บอสปัญหาเรื้อรัง","emoji":"🐲","questions":[{"q":"ขั้นแรกของกระบวนการออกแบบเชิงวิศวกรรม","choices":["ทดสอบ","ระบุปัญหา","นำเสนอ","สร้างชิ้นงาน"],"answer":1},{"q":"คำถามใดเป็นคำถามปลายเปิด","choices":["มีปัญหาไหม","ใช่หรือไม่","ปัญหาที่เจอบ่อยที่สุดคืออะไร","ชอบไหม"],"answer":2},{"q":"ข้อมูลที่เก็บเองจากการสัมภาษณ์เรียกว่า","choices":["ข้อมูลปฐมภูมิ","ข้อมูลทุติยภูมิ","ข้อมูลลับ","ข้อมูลเท็จ"],"answer":0},{"q":"ระหว่างระดมสมองควรทำอย่างไร","choices":["ตัดสินทันที","เสนอให้มากที่สุดก่อน","ให้คนเดียวพูด","เงียบ"],"answer":1},{"q":"ก่อนใช้สว่านควร","choices":["สวมถุงมือผ้า","รวบผม สวมแว่น","เจาะเร็ว ๆ","ไม่ต้องจับชิ้นงาน"],"answer":1},{"q":"เกณฑ์ทดสอบที่ดีต้อง","choices":["วัดเป็นตัวเลขได้","ใช้ความรู้สึก","เพื่อนชอบ","ดูสวย"],"answer":0},{"q":"ที่มาและความสำคัญอยู่ในส่วนใดของรายงาน","choices":["บทนำ","ภาคผนวก","บรรณานุกรม","ปก"],"answer":0},{"q":"สไลด์นำเสนอที่ดี","choices":["ข้อความเต็มหน้า","ข้อความน้อย ภาพประกอบชัด","ไม่มีภาพ","ตัวอักษรเล็กมาก"],"answer":1}]}]}'::jsonb, 100, 50, 30),
  ('value-up-shop', (select id from public.units where no = 3), 'Value Up Shop', 'อัปเกรดสินค้าท้องถิ่นภายใต้งบจำกัด ให้มูลค่าเพิ่มขึ้นมากที่สุด', '{"engine":"shop","instructions":"เลือกการอัปเกรดได้หลายอย่าง แต่ต้นทุนรวมต้องไม่เกินงบ ระบบจะคำนวณมูลค่าที่เพิ่มขึ้น เทียบกับแผนที่ดีที่สุด","products":[{"name":"ข้าวเกรียบสมุนไพร","emoji":"🍘","basePrice":20,"budget":12,"upgrades":[{"name":"ถุงซิปล็อกเก็บความกรอบ","kind":"บรรจุภัณฑ์","cost":4,"value":6},{"name":"โลโก้และเรื่องเล่าสูตรยาย","kind":"เล่าเรื่องแบรนด์","cost":3,"value":5},{"name":"เพิ่มรสต้มยำ","kind":"เพิ่มฟังก์ชัน/ตัวเลือก","cost":5,"value":4},{"name":"กล่องกระดาษพิมพ์ลายสวย","kind":"ออกแบบใหม่","cost":6,"value":7},{"name":"ขายผ่านเพจออนไลน์","kind":"การตลาด","cost":2,"value":3}]},{"name":"ผ้าทอมือ","emoji":"🧣","basePrice":300,"budget":150,"upgrades":[{"name":"ออกแบบลายร่วมสมัย","kind":"ออกแบบใหม่","cost":80,"value":150},{"name":"ตัดเป็นกระเป๋าใช้งานได้","kind":"เพิ่มฟังก์ชัน","cost":100,"value":180},{"name":"ป้ายเล่าเรื่องช่างทอ","kind":"เล่าเรื่องแบรนด์","cost":20,"value":60},{"name":"ย้อมสีธรรมชาติ","kind":"วัสดุ","cost":50,"value":90},{"name":"กล่องของขวัญ","kind":"บรรจุภัณฑ์","cost":30,"value":40}]}]}'::jsonb, 100, 40, 20),
  ('ip-hunter', (select id from public.units where no = 3), 'IP Hunter', 'การ์ดตัวอย่างไหลลงมา รีบจัดเข้าตะกร้าทรัพย์สินทางปัญญาให้ถูก', '{"engine":"sort","mode":"stream","instructions":"การ์ดตกลงมาทีละใบ กดตะกร้าทรัพย์สินทางปัญญาที่ถูกก่อนการ์ดตกถึงพื้น!","cardTimeSec":12,"buckets":[{"id":"copyright","label":"ลิขสิทธิ์","icon":"©️"},{"id":"invention","label":"สิทธิบัตรการประดิษฐ์","icon":"⚙️"},{"id":"design","label":"สิทธิบัตรการออกแบบผลิตภัณฑ์","icon":"🎨"},{"id":"petty","label":"อนุสิทธิบัตร","icon":"🔧"},{"id":"trademark","label":"เครื่องหมายการค้า","icon":"™️"},{"id":"secret","label":"ความลับทางการค้า","icon":"🤫"},{"id":"gi","label":"สิ่งบ่งชี้ทางภูมิศาสตร์","icon":"📍"}],"cards":[{"text":"เพลงที่แต่งขึ้นใหม่","bucket":"copyright"},{"text":"โลโก้ร้านกาแฟ","bucket":"trademark"},{"text":"สูตรน้ำจิ้มลับของร้าน","bucket":"secret"},{"text":"ข้าวหอมมะลิทุ่งกุลาร้องไห้","bucket":"gi"},{"text":"กลไกใหม่ของเครื่องยนต์ที่ประหยัดน้ำมันกว่าเดิมมาก","bucket":"invention"},{"text":"รูปทรงขวดน้ำหอมแบบใหม่","bucket":"design"},{"text":"ด้ามจับกระทะแบบพับได้ (ปรับปรุงเล็กน้อย)","bucket":"petty"},{"text":"โปรแกรมเกมที่เขียนขึ้นเอง","bucket":"copyright"},{"text":"ชื่อแบรนด์รองเท้า","bucket":"trademark"},{"text":"ส้มโอนครชัยศรี","bucket":"gi"}]}'::jsonb, 100, 40, 20),
  ('boss-unit-3', (select id from public.units where no = 3), 'Boss Battle หน่วย 3', 'ปกป้องผลงานจากจอมก๊อปปี้', '{"engine":"boss","instructions":"มีหัวใจ 3 ดวง ตอบถูกโจมตีจอมก๊อปปี้ ตอบผิดเสียหัวใจ","hearts":3,"timePerQuestionSec":25,"stages":[{"name":"จอมก๊อปปี้","emoji":"🦹","questions":[{"q":"เปลี่ยนถุงข้าวเกรียบให้ปิดซ้ำได้ เป็นการเพิ่มมูลค่าด้านใด","choices":["บรรจุภัณฑ์","ราคา","สูตร","ที่ตั้งร้าน"],"answer":0},{"q":"โลโก้แบรนด์คุ้มครองด้วย","choices":["ลิขสิทธิ์","เครื่องหมายการค้า","อนุสิทธิบัตร","สิ่งบ่งชี้ทางภูมิศาสตร์"],"answer":1},{"q":"ลิขสิทธิ์เกิดขึ้นเมื่อใด","choices":["ทันทีที่สร้างผลงาน","เมื่อจดทะเบียน","เมื่อขายได้","เมื่อครบ 1 ปี"],"answer":0},{"q":"สูตรลับของร้านอาหาร","choices":["ความลับทางการค้า","ลิขสิทธิ์","สิทธิบัตร","เครื่องหมายการค้า"],"answer":0},{"q":"หน่วยงานที่ดูแลทรัพย์สินทางปัญญาในไทย","choices":["กรมทรัพย์สินทางปัญญา","กรมป่าไม้","กรมอุตุนิยมวิทยา","กรมการปกครอง"],"answer":0},{"q":"ใช้ภาพคนอื่นในโฆษณาสินค้า ควร","choices":["ขออนุญาตเจ้าของ","ใช้ได้เลย","ลบชื่อเจ้าของ","แก้สีนิดหน่อย"],"answer":0},{"q":"ขายผ้าทอพร้อมเล่าเรื่องช่างทอ เป็นการเพิ่มมูลค่าด้าน","choices":["การตลาด/เล่าเรื่องแบรนด์","วัสดุ","ฟังก์ชัน","การขนส่ง"],"answer":0},{"q":"ส้มโอนครชัยศรี เป็นตัวอย่างของ","choices":["สิ่งบ่งชี้ทางภูมิศาสตร์","ลิขสิทธิ์","อนุสิทธิบัตร","ความลับทางการค้า"],"answer":0}]}]}'::jsonb, 100, 50, 30),
  ('final-quest', null, 'Final Quest', 'ด่านต่อเนื่อง 3 ด่าน ทบทวนทุกหน่วยก่อนสอบปลายภาค', '{"engine":"boss","instructions":"ผ่าน 3 ด่านด้วยหัวใจ 3 ดวง (ไม่เติมระหว่างด่าน) ด่านละหน่วย","hearts":3,"timePerQuestionSec":25,"stages":[{"name":"ด่าน 1: เทคโนโลยีเปลี่ยนโลก","emoji":"🤖","questions":[{"q":"ยุคใดเริ่มใช้อินเทอร์เน็ตบนมือถือ","choices":["1G","2G","3G","ไม่มี"],"answer":2},{"q":"รถไฟฟ้าล้วนคือ","choices":["BEV","HEV","FCEV","PHEV"],"answer":0},{"q":"ติดตามตำแหน่งรถส่งของแบบเรียลไทม์ใช้","choices":["GPS","Barcode","QR","WMS"],"answer":0},{"q":"ปัจจัยด้านสิ่งแวดล้อมที่ผลักดันรถไฟฟ้า","choices":["มลพิษทางอากาศ","แฟชั่น","ดนตรี","กีฬา"],"answer":0}]},{"name":"ด่าน 2: เทคโนโลยีแก้ปัญหา","emoji":"🐲","questions":[{"q":"ขั้นสุดท้ายของกระบวนการออกแบบเชิงวิศวกรรม","choices":["นำเสนอผลการแก้ปัญหา","ระบุปัญหา","ทดสอบ","ออกแบบ"],"answer":0},{"q":"When ใน 5W1H หมายถึง","choices":["เมื่อไร","ที่ไหน","ใคร","ทำไม"],"answer":0},{"q":"ทดสอบไม่ผ่าน ควร","choices":["หาสาเหตุแล้วปรับปรุง","เลิกทำ","แก้ผลทดสอบ","ไม่บอกใคร"],"answer":0},{"q":"รายชื่อแหล่งอ้างอิงอยู่ในส่วน","choices":["บรรณานุกรม","บทนำ","ปก","สารบัญ"],"answer":0}]},{"name":"ด่าน 3: เทคโนโลยีเพิ่มมูลค่า","emoji":"🦹","questions":[{"q":"ตัดผ้าทอเป็นกระเป๋า เป็นการเพิ่มมูลค่าด้าน","choices":["ฟังก์ชันการใช้งาน","ราคา","การขนส่ง","สี"],"answer":0},{"q":"รูปทรงผลิตภัณฑ์ใหม่คุ้มครองด้วย","choices":["สิทธิบัตรการออกแบบผลิตภัณฑ์","ความลับทางการค้า","ลิขสิทธิ์เพลง","GI"],"answer":0},{"q":"การประดิษฐ์ที่ไม่ซับซ้อนเหมาะกับ","choices":["อนุสิทธิบัตร","เครื่องหมายการค้า","ลิขสิทธิ์","GI"],"answer":0},{"q":"ใช้สื่อ Creative Commons ต้อง","choices":["ทำตามเงื่อนไขที่เจ้าของกำหนด","ลบชื่อเจ้าของ","ขายต่อได้เสมอ","ห้ามใช้"],"answer":0}]}]}'::jsonb, 100, 50, 45)
on conflict (slug) do nothing;

insert into public.badges (code, name, icon, rule)
values
  ('5g-master', 'เจ้าแห่ง 5G', '📡', '{"kind":"game_score","slug":"5g-time-machine","min_pct":80}'::jsonb),
  ('ev-fan', 'สายรถไฟฟ้า', '🚗', '{"kind":"game_score","slug":"ev-garage","min_pct":80}'::jsonb),
  ('fast-courier', 'นักส่งของเร็ว', '📦', '{"kind":"game_score","slug":"logistics-rush","min_pct":80}'::jsonb),
  ('problem-detective', 'นักสืบปัญหา', '🔍', '{"kind":"game_score","slug":"problem-detective","min_pct":80}'::jsonb),
  ('prototype-maker', 'ช่างต้นแบบ', '🛠️', '{"kind":"submission_session","session_no":13}'::jsonb),
  ('ip-guardian', 'ผู้พิทักษ์ลิขสิทธิ์', '🛡️', '{"kind":"game_score","slug":"ip-hunter","min_pct":80}'::jsonb),
  ('unit-complete', 'ส่งงานครบทั้งหน่วย', '📚', '{"kind":"unit_complete"}'::jsonb),
  ('attendance-5', 'ไม่ขาดเรียน 5 คาบ', '🗓️', '{"kind":"attendance","count":5}'::jsonb)
on conflict (code) do nothing;

-- >>>>>>>>>> seed_dbquest.sql
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

update public.dbq_lessons l set game_key = v.game_key
from (values
  (1, 'memory-match'),
  (2, 'db-terms-match')
) as v(session_no, game_key)
where l.session_no = v.session_no;

insert into public.dbq_assignments (item_id, session_no, title, max_score, type, sort_order) values
  ('ws-s01', 1, 'ใบงานที่ 1: ข้อมูลหรือสารสนเทศรอบตัวฉัน', 5, 'text', 1),
  ('ws-s02', 2, 'ใบงานที่ 2: ออกแบบตารางจากชีวิตจริง', 5, 'text', 2)
on conflict (item_id) do update
  set session_no = excluded.session_no, title = excluded.title, max_score = excluded.max_score,
      type = excluded.type, sort_order = excluded.sort_order;

insert into public.dbq_badges (key, name, description, icon, sort_order) values
  ('unit-complete', 'จบหน่วยแรก', 'เรียนครบทุกขั้นของหน่วยใดหน่วยหนึ่ง', '🎓', 1),
  ('all-units', 'นักผจญภัยครบ 7 หน่วย', 'เรียนครบทุกหน่วย', '🗺️', 2),
  ('three-stars', 'สามดาวแรก', 'ทำเกมใดเกมหนึ่งได้ 3 ดาว', '⭐', 3),
  ('on-time-5', 'ส่งตรงเวลา 5 ครั้งติด', 'ส่งใบงานก่อนกำหนด 5 ครั้งติดต่อกัน', '⏰', 4),
  ('sql-no-hint', 'SQL ไร้คำใบ้', 'ผ่านด่าน SQL Quest โดยไม่ใช้คำใบ้', '🧙', 5),
  ('streak-5', 'มาเรียนต่อเนื่อง 5 คาบ', 'เข้าเรียนต่อเนื่อง 5 คาบไม่ขาด', '🔥', 6)
on conflict (key) do update
  set name = excluded.name, description = excluded.description, icon = excluded.icon, sort_order = excluded.sort_order;

-- >>>>>>>>>> seed/answer_keys.sql
-- =============================================================
-- เฉลย DB Quest (สร้างอัตโนมัติจาก supabase/answer_keys/*.json — ห้ามแก้ตรง)
-- ต้องรันหลัง seed_dbquest.sql · รันซ้ำได้ (อัปเดตเฉลยตามไฟล์ต้นฉบับ)
-- ⚠️ ไฟล์นี้มีเฉลยทั้งหมด ห้ามนำไปไว้ใน src/ หรือ public/
-- =============================================================

insert into public.dbq_answer_keys (item_id, item_type, grade_type, unit_no, session_no, answer, explanation, hint, rubric, teacher_notes) values
  ('s01-c1-q', 'check', 'mcq', 1, 1, '{"choice":2}'::jsonb, 'คะแนนเฉลี่ยของห้องได้จากการนำคะแนนทุกคนมาคำนวณ จึงเป็นข้อมูลที่ประมวลผลแล้ว (สารสนเทศ) ส่วนข้ออื่นเป็นข้อเท็จจริงดิบ (ข้อมูล)', 'ลองดูว่าข้อไหนผ่านการ "คำนวณ" หรือ "สรุป" มาแล้ว ไม่ใช่ตัวเลขดิบ ๆ', null, 'นักเรียนมักตอบข้อ 1 เพราะเห็นคำว่า "คะแนน" ชวนถามต่อว่า "ถ้าเราจะรู้ว่าห้องเก่งไหม ดูข้อไหนแล้วรู้ทันที"'),
  ('s01-c2-q', 'check', 'classify', 1, 1, '{"pairs":{"i-1":"hw","i-2":"sw","i-3":"data"}}'::jsonb, 'เครื่องสแกนจับต้องได้ = ฮาร์ดแวร์, แอปเป็นชุดคำสั่ง = ซอฟต์แวร์, ประวัติการยืมคือสิ่งที่ระบบเก็บ = ข้อมูล', 'ถามตัวเองทีละชิ้น: จับได้ไหม? เป็นคำสั่งให้เครื่องทำงานไหม? หรือเป็นสิ่งที่ถูกเก็บไว้?', null, 'บางคนจัดแอปเป็นข้อมูล ให้เทียบว่า "แอปทำงานได้เอง ส่วนประวัติการยืมทำงานเองไม่ได้"'),
  ('s01-c3-q', 'check', 'order', 1, 1, '{"order":["o-x","o-m","o-k"]}'::jsonb, 'Client ส่งคำขอก่อน → Server ค้นข้อมูลในฐานข้อมูล → ส่งผลกลับมาแสดงที่ Client', 'เริ่มจากฝั่งที่เรากดปุ่มก่อน แล้วนึกว่าข้อมูลอยู่ที่ไหน', null, 'ใช้เวลาไม่เกิน 3 นาที ให้นักเรียนแสดงบทบาท Client/Server หน้าห้องจะเข้าใจเร็วขึ้น'),
  ('s01-p1', 'practice', 'match', 1, 1, '{"pairs":{"data":"m-f","info":"m-w","cloud":"m-q"}}'::jsonb, 'Data = ข้อเท็จจริงดิบ, Information = ข้อมูลที่ประมวลผลแล้ว, Cloud = บริการเครื่องแม่ข่ายผ่านอินเทอร์เน็ต', 'เริ่มจากคำที่มั่นใจที่สุดก่อน แล้วตัดตัวเลือกที่ใช้ไปแล้วออก', null, ''),
  ('s01-p2', 'practice', 'fill', 1, 1, '{"accept":["ฮาร์ดแวร์","hardware","ฮาร์ดแวร์ (Hardware)","ฮาร์ดแวร์(hardware)"]}'::jsonb, 'ฮาร์ดแวร์ (Hardware) คือส่วนที่จับต้องได้ของระบบคอมพิวเตอร์', 'นึกถึงจอ คีย์บอร์ด เมาส์ — สิ่งเหล่านี้เรียกรวมว่าอะไร', null, 'ระบบไม่สนใจตัวพิมพ์เล็ก-ใหญ่และช่องว่าง'),
  ('ws-s01', 'worksheet', 'rubric', 1, 1, '{"sample":"1) ร้านสะดวกซื้อ: ข้อมูล = รายการสินค้าที่ขายในแต่ละใบเสร็จ → สารสนเทศ = สินค้าขายดี 5 อันดับต่อวัน → ผู้จัดการร้านตัดสินใจสั่งสินค้าเพิ่ม\n2) โรงเรียน: ข้อมูล = เวลามาโรงเรียนของนักเรียนแต่ละคน → สารสนเทศ = ร้อยละนักเรียนมาสายของแต่ละห้อง → ครูประจำชั้นตัดสินใจนัดคุยผู้ปกครอง\n3) บ้าน: ข้อมูล = ค่าไฟแต่ละเดือน → สารสนเทศ = กราฟค่าไฟ 6 เดือน เห็นว่าเดือนเมษาสูงสุด → พ่อแม่ตัดสินใจลดการเปิดแอร์"}'::jsonb, 'คำตอบที่ดีต้องแยกข้อมูลดิบกับสารสนเทศได้ชัด และบอกได้ว่าสารสนเทศนั้นช่วยตัดสินใจเรื่องอะไร', '', '[{"criterion":"ยกตัวอย่างข้อมูล (Data) ได้ถูกต้องครบ 3 ตัวอย่าง","points":2},{"criterion":"บอกสารสนเทศที่ได้จากการประมวลผลได้สมเหตุสมผล","points":2},{"criterion":"บอกการนำสารสนเทศไปใช้ตัดสินใจ","points":1}]'::jsonb, 'จุดที่มักผิด: นักเรียนเขียนสารสนเทศเป็นข้อมูลอีกชุด (เช่น "ราคาสินค้า") ให้ถามว่า "ผ่านการคำนวณหรือสรุปอะไรมา"'),
  ('s02-c1-q', 'check', 'mcq', 1, 2, '{"choice":1}'::jsonb, 'ระบบทะเบียนเก็บข้อมูลนักเรียนที่เกี่ยวข้องกันไว้อย่างเป็นระเบียบและค้นหาได้ จึงเป็นฐานข้อมูล ส่วนกระดาษโน้ตกระจัดกระจาย รูป 1 รูป และเพลง 1 เพลง เป็นแค่ข้อมูลชิ้นเดียวหรือไม่เป็นระเบียบ', 'ฐานข้อมูลต้องมีข้อมูลหลายรายการที่เกี่ยวข้องกัน และจัดไว้เป็นระเบียบให้ค้นหาได้', null, 'ถ้านักเรียนเลือกกระดาษโน้ต ให้ถามว่า "ถ้ามี 500 แผ่น หาเบอร์หนึ่งเบอร์ใช้เวลาเท่าไร"'),
  ('s02-c2-q', 'check', 'classify', 1, 2, '{"pairs":{"i-1":"rec","i-2":"fld","i-3":"rec","i-4":"fld"}}'::jsonb, 'ข้อมูลทั้งแถวของสิ่งหนึ่งสิ่ง (นักเรียน 1 คน หนังสือ 1 เล่ม) คือระเบียน ส่วนคอลัมน์ (ห้อง ราคา) คือเขตข้อมูล', 'ถามตัวเองว่า เป็น "ของ 1 สิ่ง" (แถว) หรือ "คุณสมบัติ 1 อย่างของทุกสิ่ง" (คอลัมน์)', null, 'ชี้บนตารางจริงบนกระดาน ลากมือตามแนวนอน = ระเบียน ตามแนวตั้ง = เขตข้อมูล'),
  ('s02-c3-q', 'check', 'mcq', 1, 2, '{"choice":2}'::jsonb, 'รหัสนักเรียนไม่ซ้ำกันและทุกคนต้องมี จึงใช้เป็นคีย์หลักได้ ส่วนชื่อ ชื่อเล่น และห้อง ซ้ำกันได้', 'หาคอลัมน์ที่ "ไม่มีวันซ้ำกัน" แม้มีนักเรียนเป็นพันคน', null, 'ชวนคิดต่อ: ถ้าทั้งโรงเรียนมีคนชื่อจริงซ้ำกัน ระบบตัดเกรดจะเกิดอะไรขึ้น'),
  ('s02-p1', 'practice', 'match', 1, 2, '{"pairs":{"db":"m-c","rec":"m-a","fld":"m-d","pk":"m-b"}}'::jsonb, 'Database = ที่เก็บข้อมูลอย่างเป็นระเบียบ, Record = 1 แถว, Field = 1 คอลัมน์, Primary Key = เขตข้อมูลที่ค่าไม่ซ้ำ', 'เริ่มจากคู่ที่มั่นใจที่สุด เช่น "แถว" กับ "คอลัมน์" ก่อน', null, ''),
  ('s02-p2', 'practice', 'multi', 1, 2, '{"choices":[0,2]}'::jsonb, 'เลขประจำตัวประชาชนและหมายเลขพัสดุถูกออกแบบมาให้ไม่ซ้ำกัน ส่วนชื่อ วันเกิด และสีที่ชอบ มีคนซ้ำกันได้', 'ลองนึกว่าในประเทศมีคนเป็นล้าน ค่าไหนที่ไม่มีทางมีสองคนซ้ำกัน', null, 'ถ้านักเรียนเลือกวันเกิด ให้ถามว่าในห้องมีคนเกิดวันเดียวกันไหม'),
  ('s02-p3', 'practice', 'fill', 1, 2, '{"accept":["30","30 ระเบียน","30ระเบียน","30 record","30 records"]}'::jsonb, 'จำนวนระเบียนเท่ากับจำนวนแถว คือ 30 ส่วน 6 คอลัมน์คือจำนวนเขตข้อมูล', 'ระเบียน = แถว หรือ คอลัมน์?', null, 'ข้อนี้ดักคนที่ตอบ 6 หรือ 180'),
  ('ws-s02', 'worksheet', 'rubric', 1, 2, '{"sample":"ระบบ: ร้านชานม\n1) ตาราง: สมาชิก\n2) เขตข้อมูล: รหัสสมาชิก, ชื่อเล่น, เบอร์โทร, แต้มสะสม\n3) ระเบียน: (M001, มิว, 0812345678, 7) (M002, โอ๊ต, 0898765432, 2) (M003, แพรว, 0861112222, 10)\n4) คีย์หลัก: รหัสสมาชิก เพราะร้านออกให้ใหม่ทุกครั้งที่สมัคร ไม่มีทางซ้ำ ส่วนชื่อเล่นซ้ำกันได้"}'::jsonb, 'คำตอบที่ดีต้องมีเขตข้อมูลที่เข้ากับระบบ ตัวอย่างระเบียนกรอกครบทุกเขตข้อมูล และเลือกคีย์หลักที่ไม่ซ้ำพร้อมเหตุผล', '', '[{"criterion":"ตั้งชื่อตารางและระบุเขตข้อมูลอย่างน้อย 4 เขตข้อมูลที่เหมาะกับระบบ","points":2},{"criterion":"ตัวอย่างระเบียน 3 ระเบียน กรอกครบทุกเขตข้อมูล","points":1},{"criterion":"เลือกคีย์หลักที่ไม่ซ้ำ และอธิบายเหตุผลได้","points":2}]'::jsonb, 'จุดที่มักผิด: เลือกชื่อหรือเบอร์โทรเป็นคีย์หลัก (เบอร์โทรเปลี่ยนได้/ใช้ร่วมกันได้) ให้คะแนนเหตุผลครึ่งเดียวถ้าอธิบายไม่ได้ว่าทำไมไม่ซ้ำ')
on conflict (item_id) do update
  set item_type = excluded.item_type, grade_type = excluded.grade_type, unit_no = excluded.unit_no,
      session_no = excluded.session_no, answer = excluded.answer, explanation = excluded.explanation,
      hint = excluded.hint, rubric = excluded.rubric, teacher_notes = excluded.teacher_notes, updated_at = now();

-- สำรับเกม <- supabase/dbq_games/*.json
insert into public.dbq_game_decks (game_key, config) values
  ('db-terms-match', '{"title":"🗂️ Memory Match: ศัพท์ฐานข้อมูล","instructions":"เปิดไพ่ทีละ 2 ใบ หาคู่ศัพท์ฐานข้อมูลกับความหมายให้ครบ 6 คู่ภายในเวลา ยิ่งเปิดผิดน้อยยิ่งได้คะแนนสูง","time_limit_sec":150,"pairs":[{"id":"db","term":"ฐานข้อมูล (Database)","meaning":"ที่เก็บข้อมูลที่เกี่ยวข้องกันอย่างเป็นระเบียบ"},{"id":"table","term":"ตาราง (Table)","meaning":"ที่เก็บข้อมูลเรื่องเดียว เป็นแถวและคอลัมน์"},{"id":"rec","term":"ระเบียน (Record)","meaning":"ข้อมูล 1 แถวของสิ่งหนึ่งสิ่ง"},{"id":"fld","term":"เขตข้อมูล (Field)","meaning":"คอลัมน์ที่เก็บคุณสมบัติ 1 อย่าง"},{"id":"pk","term":"คีย์หลัก (Primary Key)","meaning":"ค่าไม่ซ้ำและไม่ว่าง ใช้ระบุแต่ละระเบียน"},{"id":"query","term":"การสืบค้น (Query)","meaning":"การถามคำถามเพื่อดึงข้อมูลจากฐานข้อมูล"}]}'::jsonb),
  ('memory-match', '{"title":"🃏 Memory Match","instructions":"เปิดไพ่ทีละ 2 ใบ หาคู่คำศัพท์กับความหมายให้ครบ 8 คู่ภายในเวลา ยิ่งเปิดผิดน้อยยิ่งได้คะแนนสูง","time_limit_sec":180,"pairs":[{"id":"data","term":"ข้อมูล (Data)","meaning":"ข้อเท็จจริงดิบที่ยังไม่ผ่านการประมวลผล"},{"id":"info","term":"สารสนเทศ (Information)","meaning":"ข้อมูลที่ประมวลผลแล้ว นำไปใช้ตัดสินใจได้"},{"id":"hw","term":"ฮาร์ดแวร์ (Hardware)","meaning":"ส่วนของคอมพิวเตอร์ที่จับต้องได้"},{"id":"sw","term":"ซอฟต์แวร์ (Software)","meaning":"ชุดคำสั่งที่สั่งให้ฮาร์ดแวร์ทำงาน"},{"id":"people","term":"บุคลากร (Peopleware)","meaning":"คนที่ใช้งานและดูแลระบบ"},{"id":"server","term":"เครื่องแม่ข่าย (Server)","meaning":"รับคำขอแล้วค้นข้อมูลส่งกลับไปให้"},{"id":"client","term":"เครื่องลูกข่าย (Client)","meaning":"เครื่องของผู้ใช้ที่ส่งคำขอไปขอข้อมูล"},{"id":"cloud","term":"คลาวด์ (Cloud)","meaning":"ใช้เครื่องแม่ข่ายของผู้ให้บริการผ่านอินเทอร์เน็ต"}]}'::jsonb)
on conflict (game_key) do update set config = excluded.config, updated_at = now();
