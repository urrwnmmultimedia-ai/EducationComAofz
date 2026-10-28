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
