-- =============================================================
-- 011 DB Quest: ส่งผลเกม (เกมผูกกับคาบผ่าน dbq_lessons.game_key)
--   * ดาว: >= 90 = 3, >= 70 = 2, >= 40 = 1
--   * XP ได้ครั้งเดียวต่อดาว (ดาวละ 5) เล่นซ้ำคะแนนเดิมไม่ได้ XP เพิ่ม
--   * กันส่งรัว: เวลาเล่นขั้นต่ำ 10 วินาที และห่างกันอย่างน้อย 5 วินาที
-- =============================================================

create or replace function public.dbq_game_stars(p_score int)
returns int
language sql immutable
set search_path = ''
as $$
  select case when p_score >= 90 then 3 when p_score >= 70 then 2 when p_score >= 40 then 1 else 0 end
$$;

create or replace function public.dbq_submit_game_result(p_game_key text, p_score int, p_duration_sec int)
returns jsonb
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_sid    uuid := public.dbq_student_id();
  v_unit   int;
  v_stars  int;
  v_xp     int := 0;
  v_badges text[] := '{}';
  v_best   record;
begin
  perform public.dbq_require_member();
  select min(l.unit_no) into v_unit from public.dbq_lessons l where l.game_key = p_game_key;
  if not exists (select 1 from public.dbq_lessons l where l.game_key = p_game_key) then
    raise exception 'game_not_found' using errcode = 'P0002';
  end if;
  if p_score is null or p_score < 0 or p_score > 100 then
    raise exception 'invalid_score' using errcode = '22023';
  end if;
  if p_duration_sec is null or p_duration_sec < 10 or p_duration_sec > 7200 then
    raise exception 'invalid_duration' using errcode = '22023';
  end if;
  v_stars := public.dbq_game_stars(p_score);

  if v_sid is null then
    -- ครูดูตัวอย่าง: ไม่บันทึก
    return jsonb_build_object('ok', true, 'preview', true, 'score', p_score, 'stars', v_stars, 'xp', 0,
      'best_score', p_score, 'best_stars', v_stars, 'badges', '[]'::jsonb);
  end if;
  if not exists (
    select 1 from public.dbq_lessons l
    where l.game_key = p_game_key and public.dbq_is_session_open(v_sid, l.session_no)
  ) then
    raise exception 'locked' using errcode = '42501';
  end if;
  if exists (
    select 1 from public.dbq_game_scores
    where student_id = v_sid and game_key = p_game_key and played_at > now() - interval '5 seconds'
  ) then
    raise exception 'too_fast' using errcode = '42501';
  end if;

  for i in 1..v_stars loop
    v_xp := v_xp + public.dbq_award_xp(v_sid, format('game:%s:star%s', p_game_key, i), 5);
  end loop;
  if v_stars = 3 and public.dbq_award_badge(v_sid, 'three-stars') then
    v_badges := array_append(v_badges, 'three-stars');
  end if;

  insert into public.dbq_game_scores (game_key, unit_no, student_id, score, stars, xp)
  values (p_game_key, v_unit, v_sid, p_score, v_stars, v_xp);

  select max(score) as score, max(stars) as stars into v_best
  from public.dbq_game_scores where student_id = v_sid and game_key = p_game_key;

  return jsonb_build_object('ok', true, 'score', p_score, 'stars', v_stars, 'xp', v_xp,
    'best_score', v_best.score, 'best_stars', v_best.stars, 'badges', to_jsonb(v_badges));
end;
$$;

revoke execute on function
  public.dbq_game_stars(int),
  public.dbq_submit_game_result(text, int, int)
from public, anon;
revoke execute on function public.dbq_game_stars(int) from authenticated;
grant execute on function public.dbq_submit_game_result(text, int, int) to authenticated;
