-- =============================================================
-- อัปเดต: รีเซ็ตคาบของนักเรียนแบบล้างคะแนนด้วย (ม.3 และ ม.5)
-- = migrations/20261028000019_reset_session_scores.sql · รันใน SQL Editor (รันซ้ำได้)
-- =============================================================

begin;

-- =============================================================
-- 019 รีเซ็ตคาบของนักเรียน 1 คนแบบล้างคะแนนด้วย (ให้ทำคาบนั้นใหม่ได้จริง)
--   เดิมรีเซ็ตแค่ขั้นที่ทำเสร็จ — งาน/ข้อสอบ/เกมที่ส่งแล้วยังอยู่ ทำให้ระบบล็อกขั้น
--   นับว่าผ่านเองทันที และข้อสอบที่ทำได้ครั้งเดียวทำใหม่ไม่ได้
--   * ม.3  admin_reset_session_scores: ลบขั้นที่ทำเสร็จ งานที่ส่ง (รวมคะแนนที่ครูตรวจ)
--          ผลสอบ/Exit ticket ผลเกมประจำคาบ และ XP ที่ได้จากสิ่งเหล่านั้น
--   * ม.5  dbq_admin_reset_session: ลบใบงานที่ส่ง และคะแนนเกมประจำคาบเพิ่มด้วย
--   เหรียญที่ได้ไปแล้วยังอยู่ · ไฟล์ที่อัปโหลดไว้ใน storage ไม่ถูกลบ
-- =============================================================

create or replace function public.admin_reset_session_scores(p_student_id uuid, p_session_no int)
returns jsonb
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_steps int;
  v_subs  int;
  v_exams int;
  v_games int;
  v_xp    int := 0;
  v_n     int;
begin
  if not public.is_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;
  if not exists (select 1 from public.students where id = p_student_id) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  delete from public.session_progress where student_id = p_student_id and session_no = p_session_no;
  get diagnostics v_steps = row_count;

  -- XP จากการส่งงาน และ Exit ticket ของคาบนี้
  delete from public.xp_events x
  where x.student_id = p_student_id
    and ((x.source = 'assignment' and x.ref_id in (select id from public.assignments where session_no = p_session_no))
      or (x.source = 'exit_ticket' and x.ref_id in (select id from public.exams where session_no = p_session_no)));
  get diagnostics v_n = row_count;
  v_xp := v_xp + v_n;

  -- งานที่ส่ง + คะแนนสมุดคะแนนที่มาจากชุดสอบของคาบนี้
  delete from public.submissions s
  where s.student_id = p_student_id
    and s.assignment_id in (
      select id from public.assignments where session_no = p_session_no
      union
      select assignment_id from public.exams where session_no = p_session_no and assignment_id is not null
    );
  get diagnostics v_subs = row_count;

  delete from public.exam_attempts a
  where a.student_id = p_student_id
    and a.exam_id in (select id from public.exams where session_no = p_session_no);
  get diagnostics v_exams = row_count;

  -- เกมประจำคาบ: XP ของแต่ละรอบ แล้วจึงลบรอบที่เล่น
  delete from public.xp_events x
  where x.student_id = p_student_id and x.source = 'game'
    and x.ref_id in (
      select gp.id from public.game_plays gp
      join public.games g on g.id = gp.game_id
      join public.class_sessions cs on cs.game_slug = g.slug
      where gp.student_id = p_student_id and cs.session_no = p_session_no
    );
  get diagnostics v_n = row_count;
  v_xp := v_xp + v_n;

  delete from public.game_plays gp
  using public.games g, public.class_sessions cs
  where gp.student_id = p_student_id and gp.game_id = g.id
    and cs.game_slug = g.slug and cs.session_no = p_session_no;
  get diagnostics v_games = row_count;

  return jsonb_build_object('ok', true, 'steps', v_steps, 'submissions', v_subs, 'exam_attempts', v_exams, 'game_plays', v_games, 'xp_events', v_xp);
end;
$$;

revoke execute on function public.admin_reset_session_scores(uuid, int) from public, anon;
grant execute on function public.admin_reset_session_scores(uuid, int) to authenticated;

-- ม.5: รีเซ็ตคาบล้างใบงานที่ส่งและคะแนนเกมประจำคาบด้วย
create or replace function public.dbq_admin_reset_session(p_student_id uuid, p_session int)
returns jsonb
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_steps int;
  v_items int;
  v_xp    int;
  v_ws    int;
  v_games int;
  v_game  text;
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
  select game_key into v_game from public.dbq_lessons where session_no = p_session;

  delete from public.dbq_progress where student_id = p_student_id and session_no = p_session;
  get diagnostics v_steps = row_count;

  delete from public.dbq_xp_events e
  where e.student_id = p_student_id
    and (
      e.source like format('step:%s:%%', p_session)
      or e.source = format('session:%s', p_session)
      or (e.source like 'item:%' and substr(e.source, 6) in (
        select k.item_id from public.dbq_answer_keys k where k.session_no = p_session and k.item_type in ('check', 'practice', 'wrapup')
      ))
      or (e.source like 'worksheet:%' and substr(e.source, 11) in (
        select a.item_id from public.dbq_assignments a where a.session_no = p_session
      ))
      or (v_game is not null and e.source like format('game:%s:%%', v_game))
    );
  get diagnostics v_xp = row_count;

  delete from public.dbq_item_attempts a
  using public.dbq_answer_keys k
  where a.student_id = p_student_id and a.item_id = k.item_id
    and k.session_no = p_session and k.item_type in ('check', 'practice', 'wrapup');
  get diagnostics v_items = row_count;

  delete from public.dbq_submissions s
  using public.dbq_assignments a
  where s.student_id = p_student_id and s.assignment_id = a.id and a.session_no = p_session;
  get diagnostics v_ws = row_count;

  -- เกมที่ใช้หลายคาบ: ล้างเฉพาะเมื่อคาบนี้เป็นคาบแรกของเกม (คาบที่ผลเกมนับเข้า)
  delete from public.dbq_game_scores g
  where g.student_id = p_student_id and v_game is not null and g.game_key = v_game
    and p_session = (select min(session_no) from public.dbq_lessons where game_key = v_game);
  get diagnostics v_games = row_count;

  return jsonb_build_object('ok', true, 'steps', v_steps, 'items', v_items, 'xp_events', v_xp, 'worksheets', v_ws, 'game_scores', v_games);
end;
$$;

commit;
