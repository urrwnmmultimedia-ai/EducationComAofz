-- =============================================================
-- 012 DB Quest: สำรับเกม (คู่คำ-ความหมาย) เก็บที่เซิร์ฟเวอร์
--   * คู่ในเกมซ้ำกับเฉลยแบบฝึก จึงไม่ใส่ไว้ใน src/ (ไม่หลุดไปกับเว็บ)
--   * นักเรียนได้สำรับเมื่อคาบเปิดแล้ว และทำทุกขั้นก่อนขั้นเกมครบ
-- =============================================================

create table public.dbq_game_decks (
  game_key   text primary key check (game_key ~ '^[a-z0-9-]{1,64}$'),
  config     jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.dbq_game_decks enable row level security;
revoke all on public.dbq_game_decks from anon, authenticated;

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
    where l.game_key = p_game_key
      and public.dbq_is_session_open(v_sid, l.session_no)
      -- ทุกขั้นที่อยู่ก่อน 'game' ต้องทำแล้ว
      and not exists (
        select 1
        from unnest(public.dbq_applicable_steps(l.session_no)) with ordinality as s(step, pos)
        where s.pos < array_position(public.dbq_applicable_steps(l.session_no), 'game')
          and not exists (select 1 from public.dbq_progress p where p.student_id = v_sid and p.session_no = l.session_no and p.step = s.step)
      )
  ) then
    raise exception 'locked' using errcode = '42501';
  end if;
  return v_config || jsonb_build_object('game_key', p_game_key, 'session_no', v_session);
end;
$$;

revoke execute on function public.dbq_game_deck(text) from public, anon;
grant execute on function public.dbq_game_deck(text) to authenticated;
