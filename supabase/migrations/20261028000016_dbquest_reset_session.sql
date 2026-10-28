-- =============================================================
-- 016 DB Quest: ครูรีเซ็ตบทเรียนของนักเรียนรายคน รายคาบ
--   ลบ: ความคืบหน้าทุกขั้นของคาบ · ประวัติตอบคำถาม (เช็ก/ฝึก) ของคาบ · XP ที่ได้จากคาบนั้น
--   เก็บไว้: ใบงานที่ส่ง/คะแนนที่ครูตรวจ · คะแนนเกม · เหรียญ (เป็นคะแนนจริงของนักเรียน)
--   นักเรียนเรียนคาบนั้นใหม่ได้ตั้งแต่ขั้นแรก และได้ XP ของคาบนั้นใหม่
-- =============================================================

create or replace function public.dbq_admin_reset_session(p_student_id uuid, p_session int)
returns jsonb
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_steps int;
  v_items int;
  v_xp    int;
begin
  perform public.dbq_require_admin();
  if not exists (
    select 1 from public.students st join public.classrooms c on c.id = st.classroom_id
    where st.id = p_student_id and c.course = 'dbquest_m5'
  ) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if not exists (select 1 from public.dbq_lessons where session_no = p_session) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  delete from public.dbq_progress where student_id = p_student_id and session_no = p_session;
  get diagnostics v_steps = row_count;

  delete from public.dbq_xp_events e
  where e.student_id = p_student_id
    and (
      e.source like format('step:%s:%%', p_session)
      or e.source = format('session:%s', p_session)
      or (e.source like 'item:%' and substr(e.source, 6) in (
        select k.item_id from public.dbq_answer_keys k where k.session_no = p_session and k.item_type in ('check', 'practice')
      ))
    );
  get diagnostics v_xp = row_count;

  delete from public.dbq_item_attempts a
  using public.dbq_answer_keys k
  where a.student_id = p_student_id and a.item_id = k.item_id
    and k.session_no = p_session and k.item_type in ('check', 'practice');
  get diagnostics v_items = row_count;

  return jsonb_build_object('ok', true, 'steps', v_steps, 'items', v_items, 'xp_events', v_xp);
end;
$$;

revoke execute on function public.dbq_admin_reset_session(uuid, int) from public, anon;
grant execute on function public.dbq_admin_reset_session(uuid, int) to authenticated;
