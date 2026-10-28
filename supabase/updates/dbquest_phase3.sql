-- =============================================================
-- อัปเดต DB Quest เฟส 3 สำหรับฐานข้อมูลที่ติดตั้งเฟส 2 แล้ว (รันครั้งเดียวใน SQL Editor)
-- = migrations 010 + 011 + 012 + seed_dbquest.sql + seed/answer_keys.sql
-- ⚠️ มีเฉลยทั้งหมด ห้ามนำไปไว้ใน src/ หรือ public/
-- =============================================================

begin;

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
  (1, 'memory-match')
) as v(session_no, game_key)
where l.session_no = v.session_no;

insert into public.dbq_assignments (item_id, session_no, title, max_score, type, sort_order) values
  ('ws-s01', 1, 'ใบงานที่ 1: ข้อมูลหรือสารสนเทศรอบตัวฉัน', 5, 'text', 1)
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
  ('ws-s01', 'worksheet', 'rubric', 1, 1, '{"sample":"1) ร้านสะดวกซื้อ: ข้อมูล = รายการสินค้าที่ขายในแต่ละใบเสร็จ → สารสนเทศ = สินค้าขายดี 5 อันดับต่อวัน → ผู้จัดการร้านตัดสินใจสั่งสินค้าเพิ่ม\n2) โรงเรียน: ข้อมูล = เวลามาโรงเรียนของนักเรียนแต่ละคน → สารสนเทศ = ร้อยละนักเรียนมาสายของแต่ละห้อง → ครูประจำชั้นตัดสินใจนัดคุยผู้ปกครอง\n3) บ้าน: ข้อมูล = ค่าไฟแต่ละเดือน → สารสนเทศ = กราฟค่าไฟ 6 เดือน เห็นว่าเดือนเมษาสูงสุด → พ่อแม่ตัดสินใจลดการเปิดแอร์"}'::jsonb, 'คำตอบที่ดีต้องแยกข้อมูลดิบกับสารสนเทศได้ชัด และบอกได้ว่าสารสนเทศนั้นช่วยตัดสินใจเรื่องอะไร', '', '[{"criterion":"ยกตัวอย่างข้อมูล (Data) ได้ถูกต้องครบ 3 ตัวอย่าง","points":2},{"criterion":"บอกสารสนเทศที่ได้จากการประมวลผลได้สมเหตุสมผล","points":2},{"criterion":"บอกการนำสารสนเทศไปใช้ตัดสินใจ","points":1}]'::jsonb, 'จุดที่มักผิด: นักเรียนเขียนสารสนเทศเป็นข้อมูลอีกชุด (เช่น "ราคาสินค้า") ให้ถามว่า "ผ่านการคำนวณหรือสรุปอะไรมา"')
on conflict (item_id) do update
  set item_type = excluded.item_type, grade_type = excluded.grade_type, unit_no = excluded.unit_no,
      session_no = excluded.session_no, answer = excluded.answer, explanation = excluded.explanation,
      hint = excluded.hint, rubric = excluded.rubric, teacher_notes = excluded.teacher_notes, updated_at = now();

-- สำรับเกม <- supabase/dbq_games/*.json
insert into public.dbq_game_decks (game_key, config) values
  ('memory-match', '{"title":"🃏 Memory Match","instructions":"เปิดไพ่ทีละ 2 ใบ หาคู่คำศัพท์กับความหมายให้ครบ 8 คู่ภายในเวลา ยิ่งเปิดผิดน้อยยิ่งได้คะแนนสูง","time_limit_sec":180,"pairs":[{"id":"data","term":"ข้อมูล (Data)","meaning":"ข้อเท็จจริงดิบที่ยังไม่ผ่านการประมวลผล"},{"id":"info","term":"สารสนเทศ (Information)","meaning":"ข้อมูลที่ประมวลผลแล้ว นำไปใช้ตัดสินใจได้"},{"id":"hw","term":"ฮาร์ดแวร์ (Hardware)","meaning":"ส่วนของคอมพิวเตอร์ที่จับต้องได้"},{"id":"sw","term":"ซอฟต์แวร์ (Software)","meaning":"ชุดคำสั่งที่สั่งให้ฮาร์ดแวร์ทำงาน"},{"id":"people","term":"บุคลากร (Peopleware)","meaning":"คนที่ใช้งานและดูแลระบบ"},{"id":"server","term":"เครื่องแม่ข่าย (Server)","meaning":"รับคำขอแล้วค้นข้อมูลส่งกลับไปให้"},{"id":"client","term":"เครื่องลูกข่าย (Client)","meaning":"เครื่องของผู้ใช้ที่ส่งคำขอไปขอข้อมูล"},{"id":"cloud","term":"คลาวด์ (Cloud)","meaning":"ใช้เครื่องแม่ข่ายของผู้ให้บริการผ่านอินเทอร์เน็ต"}]}'::jsonb)
on conflict (game_key) do update set config = excluded.config, updated_at = now();

commit;
