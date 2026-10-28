-- =============================================================
-- อัปเดต DB Quest เฟส 8: ภารกิจปิดคาบ (คำถามคิดรวบยอด)
-- = migrations/20261028000017_dbquest_closing_mission.sql · รันใน SQL Editor (รันซ้ำได้)
-- ⚠️ รันไฟล์นี้ก่อน แล้วค่อยรัน dbquest_content.sql (ไม่งั้นเฉลยข้อปิดคาบจะใส่ไม่ได้)
-- =============================================================

begin;

-- =============================================================
-- 017 DB Quest: ภารกิจปิดคาบ (คำถามคิดรวบยอด ตรวจที่เซิร์ฟเวอร์)
--   * answer_keys.item_type เพิ่ม 'wrapup'
--   * dbq_check_answer ตรวจข้อ wrapup ได้ (ได้ถูก/ผิด/คำใบ้/XP เหมือนข้อฝึก)
--   * dbq_complete_step('wrapup'): คาบที่มีภารกิจปิดคาบ ต้องลองตอบครบทุกข้อ · คาบที่ไม่มี ใช้ข้อความสรุปเหมือนเดิม
--   * dbq_admin_reset_session ลบคำตอบ/XP ของข้อปิดคาบด้วย
-- =============================================================

alter table public.dbq_answer_keys drop constraint if exists dbq_answer_keys_item_type_check;
alter table public.dbq_answer_keys add constraint dbq_answer_keys_item_type_check
  check (item_type in ('check', 'practice', 'game', 'worksheet', 'quiz', 'project', 'wrapup'));

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
  if not found or v_key.item_type not in ('check', 'practice', 'game', 'wrapup') then
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
      if exists (select 1 from public.dbq_answer_keys k where k.session_no = p_session and k.item_type = 'wrapup') then
        -- ภารกิจปิดคาบ: ต้องลองตอบทุกข้อ (ผิดได้ ตอบใหม่ได้)
        if exists (
          select 1 from public.dbq_answer_keys k
          where k.session_no = p_session and k.item_type = 'wrapup'
            and not exists (select 1 from public.dbq_item_attempts a where a.student_id = v_sid and a.item_id = k.item_id)
        ) then
          raise exception 'incomplete' using errcode = '22023';
        end if;
      else
        v_text := btrim(coalesce(p_data ->> 'reflection', ''));
        if length(v_text) = 0 then
          raise exception 'incomplete' using errcode = '22023';
        end if;
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
        select k.item_id from public.dbq_answer_keys k where k.session_no = p_session and k.item_type in ('check', 'practice', 'wrapup')
      ))
    );
  get diagnostics v_xp = row_count;

  delete from public.dbq_item_attempts a
  using public.dbq_answer_keys k
  where a.student_id = p_student_id and a.item_id = k.item_id
    and k.session_no = p_session and k.item_type in ('check', 'practice', 'wrapup');
  get diagnostics v_items = row_count;

  return jsonb_build_object('ok', true, 'steps', v_steps, 'items', v_items, 'xp_events', v_xp);
end;
$$;

commit;
