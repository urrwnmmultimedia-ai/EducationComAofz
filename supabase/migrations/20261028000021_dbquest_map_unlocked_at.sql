-- =============================================================
-- 021 DB Quest (ม.5): แผนที่คาบส่งเวลาที่ครูปลดล็อกให้ห้องของนักเรียน (unlocked_at)
--   หน้าแรกใช้เลือก "คาบปัจจุบัน" = คาบที่ครูเปิดล่าสุด (เหมือนหน้าแรก ม.3)
--   ครู/ดูตัวอย่าง: unlocked_at = null (เห็นทุกคาบเปิด)
-- =============================================================

create or replace function public.dbq_my_map()
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_sid   uuid := public.dbq_student_id();
  v_admin boolean := public.is_admin();
begin
  perform public.dbq_require_member();
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'session_no', l.session_no,
      'unit_no', l.unit_no,
      'kind', l.kind,
      'title', l.title,
      'open', v_admin or public.dbq_is_session_open(v_sid, l.session_no),
      'pct', case when v_sid is null then null else public.dbq_session_pct(v_sid, l.session_no) end,
      'unlocked_at', u.unlocked_at
    ) order by l.session_no)
    from public.dbq_lessons l
    left join public.students st on st.id = v_sid
    left join public.dbq_classroom_unlocks u on u.classroom_id = st.classroom_id and u.session_no = l.session_no
  ), '[]'::jsonb);
end;
$$;
