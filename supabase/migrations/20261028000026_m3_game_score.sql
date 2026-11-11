-- =============================================================
-- 026 ม.3: เกมประจำคาบนับเป็นหมวด "เกม" ในคะแนนรวม (เหมือน DB Quest ม.5)
--   * คาบที่มีเกม (class_sessions.game_slug → games ที่เปิดใช้) = 1 ช่อง คาบละส่วนเท่ากัน
--     คะแนนช่อง = คะแนนเกมดีที่สุด / คะแนนเต็มของเกม · ยังไม่เล่น = 0
--   * m3_game_best(): คะแนนเกมดีที่สุดรายคาบ — นักเรียนได้ของตัวเอง · ครูได้ทุกคน
--   * น้ำหนัก: ตั้งค่าที่ยังไม่มี "game" → แบ่งจากงาน 10 (งาน 30 → งาน 20 + เกม 10) ครูปรับได้ในตั้งค่า
--   * เหรียญรายคาบ ม.3: เฉลี่ย (งานที่ตรวจแล้ว / เต็ม) กับ (เกมดีที่สุด / เต็ม) ของคาบนั้น
-- =============================================================

create or replace function public.m3_game_best()
returns table (student_id uuid, session_no int, best numeric)
language sql stable security definer
set search_path = ''
as $$
  select gp.student_id, cs.session_no, least(greatest(max(gp.score), 0), max(g.max_score))::numeric as best
  from public.class_sessions cs
  join public.games g on g.slug = cs.game_slug and g.is_active
  join public.game_plays gp on gp.game_id = g.id
  where public.is_admin() or gp.student_id = public.current_student_id()
  group by gp.student_id, cs.session_no
$$;

revoke execute on function public.m3_game_best() from public, anon;
grant execute on function public.m3_game_best() to authenticated;

-- น้ำหนักเกม (ครั้งเดียว: เฉพาะตั้งค่าที่ยังไม่มี game)
update public.app_settings
set score_weights = score_weights || jsonb_build_object(
      'game', case when coalesce((score_weights ->> 'work')::numeric, 0) >= 10 then 10 else 0 end,
      'work', case when coalesce((score_weights ->> 'work')::numeric, 0) >= 10
                   then (score_weights ->> 'work')::numeric - 10
                   else coalesce((score_weights ->> 'work')::numeric, 0) end),
    updated_at = now()
where not (score_weights ? 'game');

alter table public.app_settings alter column score_weights set default
  '{"work":20,"game":10,"project":15,"unit_test":15,"midterm":20,"final":20,"affective":0}'::jsonb;

-- เหรียญรายคาบ ม.3 (รวมเกม)
create or replace function public.m3_session_medals(p_sid uuid)
returns jsonb
language sql stable security definer
set search_path = ''
as $$
  with st as (
    select coalesce(late_penalty_enabled, false) as pen, coalesce(late_penalty_pct, 0) as pct from public.app_settings where id = 1
  ),
  items as (
    select a.session_no, a.max_score,
           case
             when s.status = 'graded' and s.score is not null then
               least(greatest(s.score, 0), a.max_score)
               * case when (select pen from st) and a.due_at is not null and s.submitted_at > a.due_at
                      then 1 - (select pct from st) / 100 else 1 end
             else 0
           end as earned
    from public.assignments a
    left join public.submissions s on s.assignment_id = a.id and s.student_id = p_sid
    where a.session_no is not null and a.max_score > 0
  ),
  ws as (
    select session_no, sum(earned) / sum(max_score) as ratio from items group by session_no
  ),
  gm as (
    select cs.session_no,
           least(greatest(coalesce((select max(gp.score) from public.game_plays gp where gp.student_id = p_sid and gp.game_id = g.id), 0), 0), g.max_score)::numeric
             / g.max_score as ratio
    from public.class_sessions cs
    join public.games g on g.slug = cs.game_slug and g.is_active
  ),
  parts as (select * from ws union all select * from gm),
  per as (select session_no, round(100 * avg(ratio), 2) as pct from parts group by session_no)
  select coalesce(jsonb_agg(jsonb_build_object('session_no', session_no, 'pct', pct, 'tier', public.medal_tier(pct)) order by session_no), '[]'::jsonb)
  from per
$$;

revoke execute on function public.m3_session_medals(uuid) from public, anon, authenticated;
