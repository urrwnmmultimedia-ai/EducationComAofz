-- =============================================================
-- อัปเดต: ข้อสอบตรวจทีละข้อ (ตอบแล้วรู้ผลทันที เฉพาะชุดที่เปิดให้ดูเฉลย เช่น Exit ticket)
-- = migrations/20261028000018_exam_instant_check.sql · รันใน SQL Editor (รันซ้ำได้)
-- =============================================================

begin;

-- =============================================================
-- 018 ตรวจข้อสอบทีละข้อ (ม.3): ตอบแล้วรู้ทันทีว่าถูกหรือผิด
--   * ใช้ได้เฉพาะชุดที่ครูเปิดให้ดูเฉลย (exams.show_answers) เช่น Exit ticket
--     ชุดสอบอื่น (กลางภาค/ปลายภาค ฯลฯ) ยังทำทีละข้อ แต่ไม่บอกผลจนกว่าจะส่ง
--   * ข้อที่ตรวจแล้วล็อกคำตอบ (exam_attempts.checked) แก้ไม่ได้ ส่งซ้ำได้ผลเดิม
--   * ข้อเขียน (short) ไม่ตรวจทันที — บันทึกคำตอบแล้วครูตรวจทีหลัง
-- =============================================================

alter table public.exam_attempts
  add column if not exists checked uuid[] not null default '{}';

-- บันทึกคำตอบระหว่างสอบ (เดิม) + ห้ามแก้ข้อที่ตรวจทันทีไปแล้ว
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
  if p_question_id = any(v_att.checked) then
    raise exception 'answer_locked' using errcode = '42501';
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

-- ผลตรวจของข้อที่ล็อกแล้ว { points, correct, explanation, answer }
create or replace function public._checked_feedback(p_att public.exam_attempts, p_question_id uuid)
returns jsonb
language sql stable security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'question_id', q.id,
    'points', public.grade_answer(q.type, q.correct_answer, p_att.answers -> q.id::text),
    'correct', q.correct_answer,
    'explanation', q.explanation,
    'answer', p_att.answers -> q.id::text
  )
  from public.questions q
  where q.id = p_question_id
$$;

-- ตอบข้อนี้แล้วตรวจทันที: บันทึกคำตอบ ล็อกข้อ แล้วคืนผล (ข้อที่ล็อกแล้วคืนผลเดิม ไม่รับคำตอบใหม่)
create or replace function public.check_exam_answer(p_attempt_id uuid, p_question_id uuid, p_answer jsonb)
returns jsonb
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_att  public.exam_attempts%rowtype;
  v_show boolean;
  v_type text;
begin
  select * into v_att from public.exam_attempts where id = p_attempt_id for update;
  if not found or v_att.student_id is distinct from public.current_student_id() then
    raise exception 'attempt_not_found' using errcode = '42501';
  end if;
  select show_answers into v_show from public.exams where id = v_att.exam_id;
  if not coalesce(v_show, false) then
    raise exception 'instant_check_off' using errcode = '42501';
  end if;
  if not (p_question_id = any(v_att.question_order)) then
    raise exception 'question_not_in_exam' using errcode = '22023';
  end if;
  select type into v_type from public.questions where id = p_question_id;
  if v_type = 'short' then
    raise exception 'needs_teacher' using errcode = '22023';
  end if;

  if not (p_question_id = any(v_att.checked)) then
    if v_att.submitted_at is not null then
      raise exception 'already_submitted' using errcode = '42501';
    end if;
    if v_att.deadline_at is not null and now() > v_att.deadline_at + interval '30 seconds' then
      raise exception 'time_up' using errcode = '42501';
    end if;
    if p_answer is null or length(p_answer::text) > 5000 then
      raise exception 'answer_too_long' using errcode = '22023';
    end if;
    update public.exam_attempts
    set answers = answers || jsonb_build_object(p_question_id::text, p_answer),
        checked = checked || p_question_id,
        saved_at = now()
    where id = p_attempt_id
    returning * into v_att;
  end if;

  return public._checked_feedback(v_att, p_question_id);
end;
$$;

-- ผลตรวจของทุกข้อที่ล็อกแล้ว (กลับมาทำต่อหลังเน็ตหลุด/รีเฟรช)
create or replace function public.exam_checked_feedback(p_attempt_id uuid)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_att public.exam_attempts%rowtype;
begin
  select * into v_att from public.exam_attempts where id = p_attempt_id;
  if not found or v_att.student_id is distinct from public.current_student_id() then
    raise exception 'attempt_not_found' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_object_agg(c.id::text, public._checked_feedback(v_att, c.id))
    from unnest(v_att.checked) as c(id)
  ), '{}'::jsonb);
end;
$$;

revoke execute on function
  public._checked_feedback(public.exam_attempts, uuid),
  public.check_exam_answer(uuid, uuid, jsonb),
  public.exam_checked_feedback(uuid)
from public, anon, authenticated;

grant execute on function
  public.check_exam_answer(uuid, uuid, jsonb),
  public.exam_checked_feedback(uuid)
to authenticated;

commit;
