-- =============================================================
-- 015 DB Quest: ปลดล็อกคาบ = ปลดล็อกงานทุกอย่างในคาบ
--   * เดิม: สำรับเกมแจกเมื่อทำขั้นก่อนเกม (เปิดคาบ/บทเรียน/ฝึกปฏิบัติ) ครบแล้ว
--   * ใหม่: แจกทันทีที่คาบเปิด (ตามเกณฑ์ หรือครูปลดล็อก) — นักเรียนเลือกทำขั้นไหนก่อนก็ได้
-- =============================================================

create or replace function public.dbq_game_deck(p_game_key text)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_sid     uuid := public.dbq_student_id();
  v_config  jsonb;
  v_session int;
begin
  perform public.dbq_require_member();
  select config into v_config from public.dbq_game_decks where game_key = p_game_key;
  select min(session_no) into v_session from public.dbq_lessons where game_key = p_game_key;
  if v_config is null or v_session is null then
    raise exception 'game_not_found' using errcode = 'P0002';
  end if;
  if v_sid is not null and not exists (
    select 1 from public.dbq_lessons l
    where l.game_key = p_game_key and public.dbq_is_session_open(v_sid, l.session_no)
  ) then
    raise exception 'locked' using errcode = '42501';
  end if;
  return v_config || jsonb_build_object('game_key', p_game_key, 'session_no', v_session);
end;
$$;

revoke execute on function public.dbq_game_deck(text) from public, anon;
grant execute on function public.dbq_game_deck(text) to authenticated;
