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
