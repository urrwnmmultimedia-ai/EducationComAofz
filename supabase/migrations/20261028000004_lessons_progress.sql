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
