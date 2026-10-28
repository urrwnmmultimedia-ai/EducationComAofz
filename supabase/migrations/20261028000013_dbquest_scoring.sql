-- =============================================================
-- 013 DB Quest: ระบบคะแนนและหลังบ้านครู
--   * คะแนนรายวิชา 100 ตามน้ำหนักใน dbq_settings.score_weights
--       worksheet  = คะแนนใบงานที่ตรวจแล้ว / คะแนนเต็มใบงานทั้งหมด (ยังไม่ส่ง = 0)
--       game       = คะแนนดีที่สุดของแต่ละเกม เฉลี่ยทุกเกมที่ผูกกับคาบ
--       unit_quiz, project, attendance, midterm, final = ครูกรอกเอง (dbq_manual_scores)
--   * คำนวณที่เซิร์ฟเวอร์ที่เดียว (dbq_student_scores) หน้าครูและนักเรียนเห็นเลขเดียวกัน
-- =============================================================

create table public.dbq_manual_scores (
  student_id uuid not null references public.students(id) on delete cascade,
  category   text not null check (category in ('unit_quiz', 'project', 'attendance', 'midterm', 'final')),
  score      numeric(6,2) not null check (score >= 0),
  max_score  numeric(6,2) not null check (max_score > 0),
  updated_at timestamptz not null default now(),
  primary key (student_id, category),
  check (score <= max_score)
);
alter table public.dbq_manual_scores enable row level security;
revoke all on public.dbq_manual_scores from anon, authenticated;

-- ---------- คำนวณคะแนน (ภายใน) ----------
create or replace function public.dbq_student_scores(p_sid uuid)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_w      jsonb := coalesce((select value from public.dbq_settings where key = 'score_weights'), '{}'::jsonb);
  v_cat    text;
  v_earned numeric;
  v_max    numeric;
  v_pct    numeric;
  v_weight numeric;
  v_cats   jsonb := '{}'::jsonb;
  v_total  numeric := 0;
  v_avail  numeric := 0;
begin
  foreach v_cat in array array['worksheet', 'unit_quiz', 'game', 'project', 'attendance', 'midterm', 'final'] loop
    v_weight := coalesce((v_w ->> v_cat)::numeric, 0);
    if v_cat = 'worksheet' then
      select coalesce(sum(s.score) filter (where s.graded_at is not null), 0), coalesce(sum(a.max_score), 0)
        into v_earned, v_max
      from public.dbq_assignments a
      left join public.dbq_submissions s on s.assignment_id = a.id and s.student_id = p_sid;
    elsif v_cat = 'game' then
      select coalesce(sum(b.best), 0), 100 * count(*)
        into v_earned, v_max
      from (select distinct game_key from public.dbq_lessons where game_key is not null) g
      left join lateral (
        select max(gs.score) as best from public.dbq_game_scores gs where gs.student_id = p_sid and gs.game_key = g.game_key
      ) b on true;
    else
      select m.score, m.max_score into v_earned, v_max
      from public.dbq_manual_scores m where m.student_id = p_sid and m.category = v_cat;
      if not found then
        v_earned := null;
        v_max := null;
      end if;
    end if;

    v_pct := case when coalesce(v_max, 0) > 0 then round(100 * v_earned / v_max, 2) end;
    v_cats := v_cats || jsonb_build_object(v_cat, jsonb_build_object(
      'weight', v_weight,
      'earned', v_earned,
      'max', v_max,
      'pct', v_pct,
      'points', case when v_pct is null then null else round(v_pct * v_weight / 100, 2) end
    ));
    if v_pct is not null then
      v_total := v_total + v_pct * v_weight / 100;
      v_avail := v_avail + v_weight;
    end if;
  end loop;

  return jsonb_build_object(
    'categories', v_cats,
    'total', round(v_total, 2),           -- คะแนนสะสมเต็ม 100 (หมวดที่ยังไม่มีคะแนน = 0)
    'available', v_avail,                 -- น้ำหนักรวมของหมวดที่มีคะแนนแล้ว
    'current_pct', case when v_avail > 0 then round(100 * v_total / v_avail, 2) end
  );
end;
$$;

-- สรุปนักเรียน 1 คน (ใช้ในรายการนักเรียน/สมุดคะแนน)
create or replace function public.dbq_student_brief(p_sid uuid)
returns jsonb
language sql stable security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', st.id,
    'student_code', st.student_code,
    'number', st.number,
    'name', btrim(st.prefix || st.first_name || ' ' || st.last_name),
    'nickname', st.nickname,
    'classroom_id', st.classroom_id,
    'classroom_name', c.name,
    'is_active', st.is_active
  )
  from public.students st
  left join public.classrooms c on c.id = st.classroom_id
  where st.id = p_sid
$$;

-- ---------- RPC ครู ----------
-- ภาพรวม: รายห้อง + ความคืบหน้ารายคาบ + งานรอตรวจ
create or replace function public.dbq_admin_overview()
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
begin
  perform public.dbq_require_admin();
  return jsonb_build_object(
    'pending_grading', (
      select count(*) from public.dbq_submissions s
      join public.students st on st.id = s.student_id
      join public.classrooms c on c.id = st.classroom_id and c.course = 'dbquest_m5'
      where s.graded_at is null
    ),
    'classrooms', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id,
        'name', c.name,
        'students', (select count(*) from public.students st where st.classroom_id = c.id and st.is_active),
        'active_7d', (
          select count(distinct p.student_id) from public.dbq_progress p
          join public.students st on st.id = p.student_id
          where st.classroom_id = c.id and p.completed_at > now() - interval '7 days'
        ),
        'avg_xp', coalesce((
          select round(avg(x.total)) from (
            select coalesce(sum(e.amount), 0) as total
            from public.students st
            left join public.dbq_xp_events e on e.student_id = st.id
            where st.classroom_id = c.id and st.is_active
            group by st.id
          ) x
        ), 0),
        'pending_grading', (
          select count(*) from public.dbq_submissions s
          join public.students st on st.id = s.student_id
          where st.classroom_id = c.id and s.graded_at is null
        )
      ) order by c.sort_order, c.name)
      from public.classrooms c where c.course = 'dbquest_m5'
    ), '[]'::jsonb),
    'sessions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'session_no', l.session_no,
        'title', l.title,
        'kind', l.kind,
        'started', (select count(distinct p.student_id) from public.dbq_progress p where p.session_no = l.session_no),
        'completed', (
          select count(*) from public.students st
          join public.classrooms c on c.id = st.classroom_id and c.course = 'dbquest_m5'
          where st.is_active and public.dbq_session_pct(st.id, l.session_no) = 100
        )
      ) order by l.session_no)
      from public.dbq_lessons l
    ), '[]'::jsonb)
  );
end;
$$;

-- รายชื่อนักเรียน DB Quest (p_classroom_id = null => ทุกห้อง)
create or replace function public.dbq_admin_students(p_classroom_id uuid default null)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
begin
  perform public.dbq_require_admin();
  return coalesce((
    select jsonb_agg(public.dbq_student_brief(st.id) || jsonb_build_object(
      'xp', coalesce((select sum(e.amount) from public.dbq_xp_events e where e.student_id = st.id), 0),
      'sessions_done', (
        select count(*) from public.dbq_lessons l
        where l.kind = 'lesson' and public.dbq_session_pct(st.id, l.session_no) = 100
      ),
      'current_session', (select max(p.session_no) from public.dbq_progress p where p.student_id = st.id),
      'badges', (select count(*) from public.dbq_student_badges b where b.student_id = st.id),
      'last_active', greatest(
        (select max(p.completed_at) from public.dbq_progress p where p.student_id = st.id),
        (select max(e.created_at) from public.dbq_xp_events e where e.student_id = st.id)
      )
    ) order by c.sort_order, c.name, st.number nulls last, st.student_code)
    from public.students st
    join public.classrooms c on c.id = st.classroom_id and c.course = 'dbquest_m5'
    where p_classroom_id is null or st.classroom_id = p_classroom_id
  ), '[]'::jsonb);
end;
$$;

create or replace function public.dbq_admin_student_detail(p_student_id uuid)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
begin
  perform public.dbq_require_admin();
  if not exists (
    select 1 from public.students st join public.classrooms c on c.id = st.classroom_id
    where st.id = p_student_id and c.course = 'dbquest_m5'
  ) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  return jsonb_build_object(
    'student', public.dbq_student_brief(p_student_id),
    'xp', coalesce((select sum(amount) from public.dbq_xp_events where student_id = p_student_id), 0),
    'scores', public.dbq_student_scores(p_student_id),
    'sessions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'session_no', l.session_no,
        'title', l.title,
        'kind', l.kind,
        'open', public.dbq_is_session_open(p_student_id, l.session_no),
        'pct', public.dbq_session_pct(p_student_id, l.session_no),
        'steps_done', coalesce((
          select jsonb_agg(p.step order by p.completed_at) from public.dbq_progress p
          where p.student_id = p_student_id and p.session_no = l.session_no
        ), '[]'::jsonb)
      ) order by l.session_no)
      from public.dbq_lessons l
    ), '[]'::jsonb),
    'games', coalesce((
      select jsonb_agg(to_jsonb(g) order by g.game_key) from (
        select game_key, max(score) as best_score, max(stars) as best_stars, count(*) as plays, max(played_at) as last_played
        from public.dbq_game_scores where student_id = p_student_id group by game_key
      ) g
    ), '[]'::jsonb),
    'badges', coalesce((
      select jsonb_agg(jsonb_build_object('key', b.key, 'name', b.name, 'icon', b.icon, 'earned_at', sb.earned_at) order by sb.earned_at)
      from public.dbq_student_badges sb join public.dbq_badges b on b.key = sb.badge_key
      where sb.student_id = p_student_id
    ), '[]'::jsonb),
    'recent_xp', coalesce((
      select jsonb_agg(x order by x.created_at desc) from (
        select source, amount, created_at from public.dbq_xp_events
        where student_id = p_student_id order by created_at desc limit 20
      ) x
    ), '[]'::jsonb)
  );
end;
$$;

-- งานที่ส่งมา: p_filter { status: pending|graded|all, session_no?, classroom_id?, item_id? }
-- แนบเกณฑ์ (rubric) และคำตอบตัวอย่างจากเฉลยมาด้วย (เฉพาะครู)
create or replace function public.dbq_admin_submissions(p_filter jsonb default '{}'::jsonb)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_status text := coalesce(p_filter ->> 'status', 'pending');
begin
  perform public.dbq_require_admin();
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', s.id,
      'assignment', jsonb_build_object('id', a.id, 'item_id', a.item_id, 'title', a.title, 'max_score', a.max_score, 'session_no', a.session_no),
      'student', public.dbq_student_brief(st.id),
      'content', s.content,
      'score', s.score,
      'feedback', s.feedback,
      'submitted_at', s.submitted_at,
      'graded_at', s.graded_at,
      'rubric', k.rubric,
      'sample', k.answer -> 'sample'
    ) order by s.submitted_at)
    from public.dbq_submissions s
    join public.dbq_assignments a on a.id = s.assignment_id
    join public.students st on st.id = s.student_id
    join public.classrooms c on c.id = st.classroom_id and c.course = 'dbquest_m5'
    left join public.dbq_answer_keys k on k.item_id = a.item_id
    where (v_status = 'all' or (v_status = 'pending') = (s.graded_at is null))
      and (p_filter ->> 'session_no' is null or a.session_no = (p_filter ->> 'session_no')::int)
      and (p_filter ->> 'classroom_id' is null or st.classroom_id = (p_filter ->> 'classroom_id')::uuid)
      and (p_filter ->> 'item_id' is null or a.item_id = p_filter ->> 'item_id')
  ), '[]'::jsonb);
end;
$$;

-- ตรวจงาน: p_score = null => ยกเลิกการตรวจ (นักเรียนแก้แล้วส่งใหม่ได้)
create or replace function public.dbq_admin_grade_submission(p_submission_id uuid, p_score numeric, p_feedback text default null)
returns jsonb
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_max numeric;
begin
  perform public.dbq_require_admin();
  select a.max_score into v_max
  from public.dbq_submissions s join public.dbq_assignments a on a.id = s.assignment_id
  where s.id = p_submission_id;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if p_score is not null and (p_score < 0 or p_score > v_max) then
    raise exception 'invalid_score' using errcode = '22023';
  end if;
  if length(coalesce(p_feedback, '')) > 2000 then
    raise exception 'feedback_too_long' using errcode = '22023';
  end if;
  update public.dbq_submissions
  set score = p_score,
      feedback = nullif(btrim(coalesce(p_feedback, '')), ''),
      graded_at = case when p_score is null then null else now() end
  where id = p_submission_id;
  return jsonb_build_object('ok', true, 'score', p_score, 'graded', p_score is not null);
end;
$$;

-- คะแนนที่ครูกรอกเอง: p_score = null => ลบ
create or replace function public.dbq_admin_set_manual_score(p_student_id uuid, p_category text, p_score numeric, p_max_score numeric default 100)
returns void
language plpgsql volatile security definer
set search_path = ''
as $$
begin
  perform public.dbq_require_admin();
  if p_category not in ('unit_quiz', 'project', 'attendance', 'midterm', 'final') then
    raise exception 'invalid_category' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.students st join public.classrooms c on c.id = st.classroom_id
    where st.id = p_student_id and c.course = 'dbquest_m5'
  ) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if p_score is null then
    delete from public.dbq_manual_scores where student_id = p_student_id and category = p_category;
    return;
  end if;
  if p_max_score is null or p_max_score <= 0 or p_score < 0 or p_score > p_max_score then
    raise exception 'invalid_score' using errcode = '22023';
  end if;
  insert into public.dbq_manual_scores (student_id, category, score, max_score, updated_at)
  values (p_student_id, p_category, p_score, p_max_score, now())
  on conflict (student_id, category) do update
    set score = excluded.score, max_score = excluded.max_score, updated_at = now();
end;
$$;

-- สมุดคะแนนทั้งห้อง: งานแต่ละชิ้น + คะแนนทุกหมวด
create or replace function public.dbq_admin_gradebook(p_classroom_id uuid default null)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
begin
  perform public.dbq_require_admin();
  return jsonb_build_object(
    'weights', coalesce((select value from public.dbq_settings where key = 'score_weights'), '{}'::jsonb),
    'assignments', coalesce((
      select jsonb_agg(jsonb_build_object('id', a.id, 'item_id', a.item_id, 'title', a.title, 'max_score', a.max_score, 'session_no', a.session_no)
        order by a.session_no nulls last, a.sort_order)
      from public.dbq_assignments a
    ), '[]'::jsonb),
    'manual_max', coalesce((
      select jsonb_object_agg(category, max_score) from (
        select distinct on (category) category, max_score from public.dbq_manual_scores order by category, updated_at desc
      ) m
    ), '{}'::jsonb),
    'rows', coalesce((
      select jsonb_agg(public.dbq_student_brief(st.id) || jsonb_build_object(
        'work', coalesce((
          select jsonb_object_agg(a.id, jsonb_build_object(
            'status', case when s.id is null then 'missing' when s.graded_at is null then 'submitted' else 'graded' end,
            'score', s.score,
            'submission_id', s.id
          ))
          from public.dbq_assignments a
          left join public.dbq_submissions s on s.assignment_id = a.id and s.student_id = st.id
        ), '{}'::jsonb),
        'manual', coalesce((
          select jsonb_object_agg(m.category, jsonb_build_object('score', m.score, 'max', m.max_score))
          from public.dbq_manual_scores m where m.student_id = st.id
        ), '{}'::jsonb),
        'xp', coalesce((select sum(e.amount) from public.dbq_xp_events e where e.student_id = st.id), 0),
        'scores', public.dbq_student_scores(st.id)
      ) order by c.sort_order, c.name, st.number nulls last, st.student_code)
      from public.students st
      join public.classrooms c on c.id = st.classroom_id and c.course = 'dbquest_m5'
      where st.is_active and (p_classroom_id is null or st.classroom_id = p_classroom_id)
    ), '[]'::jsonb)
  );
end;
$$;

-- ตั้งค่า: ตรวจรูปแบบค่าก่อนบันทึก
create or replace function public.dbq_admin_set_setting(p_key text, p_value jsonb)
returns void
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_keys text[] := array['worksheet', 'unit_quiz', 'game', 'project', 'attendance', 'midterm', 'final'];
  v_sum  numeric := 0;
  v_k    text;
begin
  perform public.dbq_require_admin();
  if p_key not in ('score_weights', 'leaderboard_enabled', 'pin_enabled', 'unlock_threshold_pct') then
    raise exception 'unknown setting %', p_key using errcode = '22023';
  end if;
  if p_key in ('leaderboard_enabled', 'pin_enabled') and jsonb_typeof(p_value) <> 'boolean' then
    raise exception 'invalid_value' using errcode = '22023';
  end if;
  if p_key = 'unlock_threshold_pct' and (jsonb_typeof(p_value) <> 'number' or (p_value #>> '{}')::numeric not between 0 and 100) then
    raise exception 'invalid_value' using errcode = '22023';
  end if;
  if p_key = 'score_weights' then
    if jsonb_typeof(p_value) <> 'object' or (select count(*) from jsonb_object_keys(p_value)) <> cardinality(v_keys) then
      raise exception 'invalid_value' using errcode = '22023';
    end if;
    foreach v_k in array v_keys loop
      if jsonb_typeof(p_value -> v_k) is distinct from 'number' or (p_value ->> v_k)::numeric < 0 then
        raise exception 'invalid_value' using errcode = '22023';
      end if;
      v_sum := v_sum + (p_value ->> v_k)::numeric;
    end loop;
    if v_sum <> 100 then
      raise exception 'weights_must_sum_100' using errcode = '22023';
    end if;
  end if;
  insert into public.dbq_settings (key, value, updated_at) values (p_key, p_value, now())
  on conflict (key) do update set value = excluded.value, updated_at = now();
end;
$$;

-- ---------- RPC นักเรียน ----------
-- คะแนนของฉัน: ทุกหมวด + ใบงานทุกชิ้น + เกม
create or replace function public.dbq_my_scores()
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_sid uuid := public.dbq_student_id();
begin
  perform public.dbq_require_member();
  if v_sid is null then
    return jsonb_build_object('preview', true);
  end if;
  return jsonb_build_object(
    'preview', false,
    'scores', public.dbq_student_scores(v_sid),
    'assignments', coalesce((
      select jsonb_agg(jsonb_build_object(
        'item_id', a.item_id,
        'title', a.title,
        'session_no', a.session_no,
        'max_score', a.max_score,
        'open', a.session_no is null or public.dbq_is_session_open(v_sid, a.session_no),
        'status', case when s.id is null then 'missing' when s.graded_at is null then 'submitted' else 'graded' end,
        'score', s.score,
        'feedback', s.feedback,
        'submitted_at', s.submitted_at,
        'graded_at', s.graded_at
      ) order by a.session_no nulls last, a.sort_order)
      from public.dbq_assignments a
      left join public.dbq_submissions s on s.assignment_id = a.id and s.student_id = v_sid
    ), '[]'::jsonb),
    'games', coalesce((
      select jsonb_agg(jsonb_build_object(
        'game_key', l.game_key,
        'session_no', l.session_no,
        'best_score', (select max(g.score) from public.dbq_game_scores g where g.student_id = v_sid and g.game_key = l.game_key),
        'best_stars', (select max(g.stars) from public.dbq_game_scores g where g.student_id = v_sid and g.game_key = l.game_key),
        'plays', (select count(*) from public.dbq_game_scores g where g.student_id = v_sid and g.game_key = l.game_key)
      ) order by l.session_no)
      from public.dbq_lessons l where l.game_key is not null
    ), '[]'::jsonb)
  );
end;
$$;

-- อันดับ XP ในห้องของฉัน (ครูปิดได้ใน leaderboard_enabled) — แสดงแค่ชื่อเล่น
create or replace function public.dbq_leaderboard()
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_sid  uuid := public.dbq_student_id();
  v_room uuid;
begin
  perform public.dbq_require_member();
  if not coalesce((select (value #>> '{}')::boolean from public.dbq_settings where key = 'leaderboard_enabled'), true) then
    return jsonb_build_object('enabled', false, 'rows', '[]'::jsonb);
  end if;
  select classroom_id into v_room from public.students where id = v_sid;
  return jsonb_build_object('enabled', true, 'rows', coalesce((
    select jsonb_agg(jsonb_build_object('rank', r.rank, 'nickname', r.nickname, 'avatar', r.avatar, 'xp', r.xp, 'is_me', r.id = v_sid) order by r.rank, r.nickname)
    from (
      select st.id, coalesce(nullif(st.nickname, ''), st.first_name) as nickname, st.avatar,
             coalesce(sum(e.amount), 0) as xp,
             rank() over (order by coalesce(sum(e.amount), 0) desc) as rank
      from public.students st
      left join public.dbq_xp_events e on e.student_id = st.id
      where st.is_active and st.classroom_id = v_room
      group by st.id
    ) r
    where r.rank <= 10 or r.id = v_sid
  ), '[]'::jsonb));
end;
$$;

-- ---------- สิทธิ์ ----------
revoke execute on function
  public.dbq_student_scores(uuid),
  public.dbq_student_brief(uuid),
  public.dbq_admin_overview(),
  public.dbq_admin_students(uuid),
  public.dbq_admin_student_detail(uuid),
  public.dbq_admin_submissions(jsonb),
  public.dbq_admin_grade_submission(uuid, numeric, text),
  public.dbq_admin_set_manual_score(uuid, text, numeric, numeric),
  public.dbq_admin_gradebook(uuid),
  public.dbq_admin_set_setting(text, jsonb),
  public.dbq_my_scores(),
  public.dbq_leaderboard()
from public, anon;

revoke execute on function
  public.dbq_student_scores(uuid),
  public.dbq_student_brief(uuid)
from authenticated;

grant execute on function
  public.dbq_admin_overview(),
  public.dbq_admin_students(uuid),
  public.dbq_admin_student_detail(uuid),
  public.dbq_admin_submissions(jsonb),
  public.dbq_admin_grade_submission(uuid, numeric, text),
  public.dbq_admin_set_manual_score(uuid, text, numeric, numeric),
  public.dbq_admin_gradebook(uuid),
  public.dbq_admin_set_setting(text, jsonb),
  public.dbq_my_scores(),
  public.dbq_leaderboard()
to authenticated;
