-- =============================================================
-- อัปเดต DB Quest เฟส 5 (ชื่อเกมจริง) สำหรับฐานข้อมูลที่ติดตั้งเฟส 4 แล้ว
-- = migrations/20261028000014_dbquest_game_titles.sql · รันใน SQL Editor (รันซ้ำได้)
-- =============================================================

begin;

-- =============================================================
-- 014 DB Quest: ชื่อเกม (จากสำรับ) ให้หน้าเว็บแสดงชื่อจริงแทนรหัสเกม
--   * คืนเฉพาะ game_key -> title (ไม่มีคู่คำในสำรับ)
-- =============================================================

create or replace function public.dbq_game_titles()
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
begin
  perform public.dbq_require_member();
  return coalesce((
    select jsonb_object_agg(game_key, coalesce(config ->> 'title', game_key)) from public.dbq_game_decks
  ), '{}'::jsonb);
end;
$$;

revoke execute on function public.dbq_game_titles() from public, anon;
grant execute on function public.dbq_game_titles() to authenticated;

commit;
