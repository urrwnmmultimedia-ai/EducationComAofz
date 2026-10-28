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
