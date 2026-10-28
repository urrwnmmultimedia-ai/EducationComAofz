-- =============================================================
-- 007 Phase 5: เกม XP เหรียญ ลีดเดอร์บอร์ด
-- =============================================================

create index if not exists game_plays_game_idx on public.game_plays(game_id);

-- -------------------------------------------------------------
-- เหรียญ: ตรวจกฎทุกเหรียญที่ยังไม่ได้ แล้วมอบให้ (คืนรายการเหรียญใหม่)
-- rule:
--   {"kind":"game_score","slug":"...","min_pct":80}
--   {"kind":"submission_session","session_no":13}
--   {"kind":"unit_complete"}            ส่งงานครบทุกชิ้นของหน่วยใดหน่วยหนึ่ง
--   {"kind":"attendance","count":5}
-- -------------------------------------------------------------
create or replace function public._award_badges(p_student_id uuid)
returns jsonb
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_b    public.badges%rowtype;
  v_ok   boolean;
  v_new  jsonb := '[]'::jsonb;
begin
  for v_b in
    select b.* from public.badges b
    where not exists (select 1 from public.student_badges sb where sb.student_id = p_student_id and sb.badge_id = b.id)
  loop
    v_ok := case v_b.rule ->> 'kind'
      when 'game_score' then exists (
        select 1 from public.game_plays gp join public.games g on g.id = gp.game_id
        where gp.student_id = p_student_id and g.slug = v_b.rule ->> 'slug'
          and gp.score * 100 >= coalesce((v_b.rule ->> 'min_pct')::numeric, 80) * g.max_score)
      when 'submission_session' then exists (
        select 1 from public.submissions s join public.assignments a on a.id = s.assignment_id
        where s.student_id = p_student_id and a.session_no = (v_b.rule ->> 'session_no')::int
          and s.status in ('submitted', 'graded'))
      when 'unit_complete' then exists (
        select 1 from public.units u
        where exists (select 1 from public.assignments a where a.unit_id = u.id and a.type <> 'score_only')
          and not exists (
            select 1 from public.assignments a
            where a.unit_id = u.id and a.type <> 'score_only'
              and not exists (
                select 1 from public.submissions s
                where s.assignment_id = a.id and s.student_id = p_student_id and s.status in ('submitted', 'graded'))))
      when 'attendance' then (
        select count(*) from public.attendance at
        where at.student_id = p_student_id and at.status in ('present', 'late')) >= coalesce((v_b.rule ->> 'count')::int, 5)
      else false
    end;
    if v_ok then
      insert into public.student_badges (student_id, badge_id) values (p_student_id, v_b.id) on conflict do nothing;
      v_new := v_new || jsonb_build_object('code', v_b.code, 'name', v_b.name, 'icon', v_b.icon);
    end if;
  end loop;
  return v_new;
end;
$$;

create or replace function public._badges_after_change()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  perform public._award_badges(new.student_id);
  return new;
end;
$$;

drop trigger if exists submissions_badges on public.submissions;
create trigger submissions_badges after insert or update of status on public.submissions
  for each row execute function public._badges_after_change();
drop trigger if exists attendance_badges on public.attendance;
create trigger attendance_badges after insert or update of status on public.attendance
  for each row execute function public._badges_after_change();

-- -------------------------------------------------------------
-- ส่งผลเกม (กันโกง XP)
--   - คะแนน 0..max_score และเวลาเล่น >= min_duration_sec
--   - เกมต้องอยู่ในคาบที่ปลดล็อก (ถ้าเกมผูกกับคาบ)
--   - XP เต็มครั้งแรก ครั้งต่อไป 20% · วันละ 3 รอบต่อเกมที่ได้ XP (รอบที่เกินเล่นได้แต่ไม่ได้ XP)
--   - กันส่งรัว: ห่างกันอย่างน้อย 5 วินาที
-- -------------------------------------------------------------
create or replace function public.submit_game_result(p_slug text, p_score int, p_duration_sec int)
returns jsonb
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_sid    uuid := public.current_student_id();
  v_game   public.games%rowtype;
  v_today  int;
  v_first  boolean;
  v_full   int;
  v_xp     int;
  v_play   uuid;
  v_best   int;
  v_day_start timestamptz := (date_trunc('day', now() at time zone 'Asia/Bangkok')) at time zone 'Asia/Bangkok';
begin
  if v_sid is null then
    raise exception 'not_student' using errcode = '42501';
  end if;
  select * into v_game from public.games where slug = p_slug and is_active;
  if not found then
    raise exception 'game_not_found' using errcode = '22023';
  end if;
  if exists (select 1 from public.class_sessions where game_slug = p_slug)
     and not exists (select 1 from public.class_sessions cs where cs.game_slug = p_slug and public.is_session_unlocked(cs.session_no)) then
    raise exception 'game_locked' using errcode = '42501';
  end if;
  if p_score is null or p_score < 0 or p_score > v_game.max_score then
    raise exception 'invalid_score' using errcode = '22023';
  end if;
  if p_duration_sec is null or p_duration_sec < v_game.min_duration_sec or p_duration_sec > 7200 then
    raise exception 'invalid_duration' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.game_plays
    where student_id = v_sid and game_id = v_game.id and played_at > now() - interval '5 seconds'
  ) then
    raise exception 'too_fast' using errcode = '42501';
  end if;

  select count(*) into v_today from public.game_plays
  where student_id = v_sid and game_id = v_game.id and played_at >= v_day_start;
  v_first := not exists (select 1 from public.game_plays where student_id = v_sid and game_id = v_game.id);
  v_full := round(v_game.max_xp::numeric * p_score / v_game.max_score);
  v_xp := case when v_today >= 3 then 0 when v_first then v_full else round(v_full * 0.2) end;

  insert into public.game_plays (game_id, student_id, score, duration_sec, xp_earned)
  values (v_game.id, v_sid, p_score, p_duration_sec, v_xp)
  returning id into v_play;
  if v_xp > 0 then
    insert into public.xp_events (student_id, source, ref_id, xp) values (v_sid, 'game', v_play, v_xp);
  end if;
  select max(score) into v_best from public.game_plays where student_id = v_sid and game_id = v_game.id;

  return jsonb_build_object(
    'xp', v_xp,
    'first_play', v_first,
    'plays_today', v_today + 1,
    'daily_limit', 3,
    'capped', v_today >= 3,
    'best_score', v_best,
    'new_badges', public._award_badges(v_sid)
  );
end;
$$;

-- เกมของฉัน: เปิดแล้วหรือยัง สถิติการเล่น
create or replace function public.my_games()
returns table (
  slug text, title text, description text, unit_no int, max_xp int, is_unlocked boolean,
  session_nos int[], plays int, best_score int, plays_today int
)
language sql stable security definer
set search_path = ''
as $$
  select
    g.slug, g.title, g.description, u.no, g.max_xp,
    public.is_admin()
      or not exists (select 1 from public.class_sessions cs where cs.game_slug = g.slug)
      or exists (select 1 from public.class_sessions cs where cs.game_slug = g.slug and public.is_session_unlocked(cs.session_no)),
    coalesce((select array_agg(cs.session_no order by cs.session_no) from public.class_sessions cs where cs.game_slug = g.slug), '{}'),
    (select count(*)::int from public.game_plays gp where gp.game_id = g.id and gp.student_id = public.current_student_id()),
    (select max(gp.score) from public.game_plays gp where gp.game_id = g.id and gp.student_id = public.current_student_id()),
    (select count(*)::int from public.game_plays gp where gp.game_id = g.id and gp.student_id = public.current_student_id()
       and gp.played_at >= (date_trunc('day', now() at time zone 'Asia/Bangkok')) at time zone 'Asia/Bangkok')
  from public.games g
  left join public.units u on u.id = g.unit_id
  where g.is_active and public.current_app_role() is not null
  order by coalesce((select min(cs.session_no) from public.class_sessions cs where cs.game_slug = g.slug), 99), g.title
$$;

-- -------------------------------------------------------------
-- ลีดเดอร์บอร์ด (แสดงเฉพาะชื่อเล่น ห้อง และ XP)
--   p_scope = 'class' (ห้องตัวเอง) | 'all'
--   app_settings.leaderboard_mode: all | top10 (แสดง 10 อันดับ + แถวของฉัน) | hidden (เฉพาะครู)
-- -------------------------------------------------------------
create or replace function public.leaderboard(p_scope text default 'class', p_classroom_id uuid default null)
returns table (rank int, nickname text, avatar text, classroom_name text, xp int, is_me boolean)
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
    select s.id, coalesce(nullif(s.nickname, ''), s.first_name) as nick, s.avatar, c.name as room,
           coalesce((select sum(e.xp) from public.xp_events e where e.student_id = s.id), 0)::int as total
    from public.students s
    left join public.classrooms c on c.id = s.classroom_id
    where s.is_active and (v_room is null or s.classroom_id = v_room)
  ), ranked as (
    select (rank() over (order by t.total desc))::int as r, t.* from totals t
  )
  select r.r, r.nick, r.avatar, r.room, r.total, r.id = v_me
  from ranked r
  where v_admin or v_mode <> 'top10' or r.r <= 10 or r.id = v_me
  order by r.r, r.nick;
end;
$$;

-- สัญญาณให้หน้าลีดเดอร์บอร์ดโหลดใหม่ (Realtime) — แถวเดียว ไม่มีข้อมูลส่วนตัว
create table if not exists public.leaderboard_ticks (
  id int primary key default 1 check (id = 1),
  updated_at timestamptz not null default now()
);
insert into public.leaderboard_ticks (id) values (1) on conflict do nothing;
alter table public.leaderboard_ticks enable row level security;
revoke all on public.leaderboard_ticks from anon;
create policy leaderboard_ticks_read on public.leaderboard_ticks for select to authenticated using (true);

create or replace function public._tick_leaderboard()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  update public.leaderboard_ticks set updated_at = now() where id = 1;
  return null;
end;
$$;
drop trigger if exists xp_events_tick on public.xp_events;
create trigger xp_events_tick after insert or delete on public.xp_events
  for each statement execute function public._tick_leaderboard();

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.leaderboard_ticks;
  end if;
end $$;

-- เลือกอวาตาร์
create or replace function public.set_my_avatar(p_avatar text)
returns void
language plpgsql volatile security definer
set search_path = ''
as $$
begin
  if public.current_student_id() is null then
    raise exception 'not_student' using errcode = '42501';
  end if;
  if p_avatar not in ('non', 'namwan', 'doctor', 'robot', 'cat', 'owl') then
    raise exception 'invalid_avatar' using errcode = '22023';
  end if;
  update public.students set avatar = p_avatar where id = public.current_student_id();
end;
$$;

revoke execute on function
  public._award_badges(uuid),
  public._badges_after_change(),
  public._tick_leaderboard(),
  public.submit_game_result(text, int, int),
  public.my_games(),
  public.leaderboard(text, uuid),
  public.set_my_avatar(text)
from public, anon, authenticated;

grant execute on function
  public.submit_game_result(text, int, int),
  public.my_games(),
  public.leaderboard(text, uuid),
  public.set_my_avatar(text)
to authenticated;
