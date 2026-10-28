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
