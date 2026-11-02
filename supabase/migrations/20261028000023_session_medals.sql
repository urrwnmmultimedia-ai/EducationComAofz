-- =============================================================
-- 023 เหรียญรายคาบ (ทั้ง ม.3 และ DB Quest ม.5) + อันดับตามเหรียญ + นับการเข้าสู่ระบบ
--   * เหรียญ: ทุกคาบที่มีงานคิดคะแนน นักเรียนได้เหรียญตามคะแนนของตัวเองในคาบนั้น
--       ทอง ≥ 90% · เงิน ≥ 75% · ทองแดง ≥ 50% (ยังไม่ตรวจ/ยังไม่เล่น = 0 เหรียญจะขึ้นเมื่อครูตรวจ)
--       ม.3:      คะแนนงานที่ตรวจแล้วในคาบ / คะแนนเต็มของงานในคาบ (หักส่งช้าตามตั้งค่า)
--       DB Quest: เฉลี่ย (ใบงานที่ตรวจแล้ว / เต็ม) กับ (คะแนนเกมดีที่สุด / 100) ของคาบนั้น
--     คำนวณสดทุกครั้ง ไม่เก็บลงตาราง (ครูแก้คะแนนแล้วเหรียญเปลี่ยนตามทันที)
--   * อันดับในห้อง: เรียงตามเหรียญ ทอง → เงิน → ทองแดง (เลิกใช้ XP — ข้อมูล XP เดิมยังเก็บไว้)
--   * students.login_count + register_login(): หน้าเว็บใช้แสดงความยินดีกับวิวัฒนาการทุกครั้งที่เข้าสู่ระบบ ยกเว้นครั้งแรก
-- =============================================================

create or replace function public.medal_tier(p_pct numeric)
returns text
language sql immutable
set search_path = ''
as $$
  select case when p_pct >= 90 then 'gold' when p_pct >= 75 then 'silver' when p_pct >= 50 then 'bronze' end
$$;

-- ---------- ม.3 ----------
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
  per as (
    select session_no, round(100 * sum(earned) / sum(max_score), 2) as pct from items group by session_no
  )
  select coalesce(jsonb_agg(jsonb_build_object('session_no', session_no, 'pct', pct, 'tier', public.medal_tier(pct)) order by session_no), '[]'::jsonb)
  from per
$$;

-- เหรียญของฉัน (ม.3) — ครูดูตัวอย่าง = รายการว่าง
create or replace function public.my_medals()
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_sid uuid := public.current_student_id();
begin
  if public.current_app_role() is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_sid is null then
    return '[]'::jsonb;
  end if;
  return public.m3_session_medals(v_sid);
end;
$$;

-- ---------- DB Quest ----------
create or replace function public.dbq_session_medals(p_sid uuid)
returns jsonb
language sql stable security definer
set search_path = ''
as $$
  with ws as (
    select a.session_no,
           coalesce(sum(s.score) filter (where s.graded_at is not null), 0) / sum(a.max_score) as ratio
    from public.dbq_assignments a
    left join public.dbq_submissions s on s.assignment_id = a.id and s.student_id = p_sid
    where a.session_no is not null and a.max_score > 0
    group by a.session_no
  ),
  gm as (
    select l.session_no,
           least(coalesce((select max(g.score) from public.dbq_game_scores g where g.student_id = p_sid and g.game_key = l.game_key), 0), 100) / 100.0 as ratio
    from public.dbq_lessons l where l.game_key is not null
  ),
  parts as (select * from ws union all select * from gm),
  per as (select session_no, round(100 * avg(ratio), 2) as pct from parts group by session_no)
  select coalesce(jsonb_agg(jsonb_build_object('session_no', session_no, 'pct', pct, 'tier', public.medal_tier(pct)) order by session_no), '[]'::jsonb)
  from per
$$;

-- นับเหรียญจากรายการ (ใช้จัดอันดับ)
create or replace function public.medal_counts(p_medals jsonb)
returns table (gold int, silver int, bronze int)
language sql immutable
set search_path = ''
as $$
  select count(*) filter (where m ->> 'tier' = 'gold')::int,
         count(*) filter (where m ->> 'tier' = 'silver')::int,
         count(*) filter (where m ->> 'tier' = 'bronze')::int
  from jsonb_array_elements(coalesce(p_medals, '[]'::jsonb)) m
$$;

-- คะแนนของฉัน: เพิ่ม medals
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
    'medals', public.dbq_session_medals(v_sid),
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

-- อันดับในห้อง DB Quest: เรียงตามเหรียญ (แสดงแค่ชื่อเล่น)
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
    select jsonb_agg(jsonb_build_object(
      'rank', r.rank, 'nickname', r.nickname, 'avatar', r.avatar,
      'gold', r.gold, 'silver', r.silver, 'bronze', r.bronze, 'is_me', r.id = v_sid
    ) order by r.rank, r.nickname)
    from (
      select t.*, rank() over (order by t.gold desc, t.silver desc, t.bronze desc) as rank
      from (
        select st.id, coalesce(nullif(st.nickname, ''), st.first_name) as nickname, st.avatar, mc.gold, mc.silver, mc.bronze
        from public.students st
        cross join lateral public.medal_counts(public.dbq_session_medals(st.id)) mc
        where st.is_active and st.classroom_id = v_room
      ) t
    ) r
    where r.rank <= 10 or r.id = v_sid
  ), '[]'::jsonb));
end;
$$;

-- ลีดเดอร์บอร์ด ม.3: เรียงตามเหรียญ (เฉพาะห้อง ม.3) — เปลี่ยนคอลัมน์ผลลัพธ์จึงต้อง drop ก่อน
drop function if exists public.leaderboard(text, uuid);
create function public.leaderboard(p_scope text default 'class', p_classroom_id uuid default null)
returns table (rank int, nickname text, avatar text, classroom_name text, gold int, silver int, bronze int, is_me boolean)
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_mode  text;
  v_admin boolean := public.is_admin();
  v_room  uuid;
  v_me    uuid := public.current_student_id();
begin
  if public.current_app_role() is null then
    return;
  end if;
  select leaderboard_mode into v_mode from public.app_settings where id = 1;
  if v_mode = 'hidden' and not v_admin then
    return;
  end if;
  v_room := case when p_scope = 'class' then coalesce(case when v_admin then p_classroom_id end, public.current_classroom_id()) end;

  return query
  with totals as (
    select s.id, coalesce(nullif(s.nickname, ''), s.first_name) as nick, s.avatar, c.name as room, mc.gold, mc.silver, mc.bronze
    from public.students s
    left join public.classrooms c on c.id = s.classroom_id
    cross join lateral public.medal_counts(public.m3_session_medals(s.id)) mc
    where s.is_active and coalesce(c.course, 'design_m3') = 'design_m3' and (v_room is null or s.classroom_id = v_room)
  ), ranked as (
    select (rank() over (order by t.gold desc, t.silver desc, t.bronze desc))::int as r, t.* from totals t
  )
  select r.r, r.nick, r.avatar, r.room, r.gold, r.silver, r.bronze, r.id = v_me
  from ranked r
  where v_admin or v_mode <> 'top10' or r.r <= 10 or r.id = v_me
  order by r.r, r.nick;
end;
$$;

-- ตรวจงานแล้วเหรียญเปลี่ยน: ให้หน้าลีดเดอร์บอร์ดโหลดใหม่
drop trigger if exists submissions_tick on public.submissions;
create trigger submissions_tick after insert or update of score, status or delete on public.submissions
  for each statement execute function public._tick_leaderboard();

-- ---------- นับการเข้าสู่ระบบ ----------
alter table public.students add column if not exists login_count int not null default 0;

-- เรียกหลังเข้าสู่ระบบสำเร็จ: +1 แล้วคืนจำนวนครั้ง "ก่อนหน้า" (0 = ครั้งแรก)
create or replace function public.register_login()
returns int
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_sid  uuid := public.current_student_id();
  v_prev int;
begin
  if v_sid is null then
    return 0;
  end if;
  update public.students set login_count = login_count + 1 where id = v_sid
  returning login_count - 1 into v_prev;
  return coalesce(v_prev, 0);
end;
$$;

revoke execute on function
  public.m3_session_medals(uuid),
  public.dbq_session_medals(uuid)
from public, anon, authenticated;

revoke execute on function
  public.my_medals(),
  public.leaderboard(text, uuid),
  public.register_login(),
  public.dbq_my_scores(),
  public.dbq_leaderboard()
from public, anon;

grant execute on function
  public.my_medals(),
  public.leaderboard(text, uuid),
  public.register_login(),
  public.dbq_my_scores(),
  public.dbq_leaderboard()
to authenticated;
