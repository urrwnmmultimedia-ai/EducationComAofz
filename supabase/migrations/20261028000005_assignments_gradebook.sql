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
