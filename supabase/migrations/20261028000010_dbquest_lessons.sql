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
