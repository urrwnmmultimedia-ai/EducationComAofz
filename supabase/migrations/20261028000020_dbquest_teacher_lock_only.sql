-- =============================================================
-- 020 DB Quest (ม.5): คาบเปิดเฉพาะเมื่อครูปลดล็อกให้ห้องเท่านั้น
--   เดิม: คาบ 1 เปิดเสมอ (is_unlocked_default) และคาบถัดไปเปิดเองเมื่อทำคาบก่อนหน้าครบ 80%
--         ครูล็อกคาบไว้แล้ว นักเรียนที่ทำคาบก่อนหน้าครบก็ยังเปิดจากหน้าบทเรียนได้
--   ใหม่: เปิดได้ก็ต่อเมื่อมีแถวใน dbq_classroom_unlocks ของห้องนักเรียน (ครูกดเปิด/ปิดในหน้าปลดล็อกคาบ)
--   ห้องที่มีอยู่แล้ว: เปิดคาบที่เคย "เปิดเสมอ" (คาบ 1) ให้ต่อ ครูล็อกทีหลังได้
--   เกณฑ์ unlock_threshold_pct ไม่ใช้เปิดคาบอีกต่อไป (คงค่าไว้ในตาราง)
-- =============================================================

create or replace function public.dbq_is_session_open(p_student uuid, p_session int)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.dbq_classroom_unlocks u
    join public.students st on st.classroom_id = u.classroom_id
    where st.id = p_student and u.session_no = p_session
  )
$$;

insert into public.dbq_classroom_unlocks (classroom_id, session_no)
select c.id, l.session_no
from public.classrooms c
cross join public.dbq_lessons l
where c.course = 'dbquest_m5' and l.is_unlocked_default
on conflict do nothing;

-- ห้อง ม.5 ที่สร้างใหม่ / คาบที่ตั้งเป็น "เปิดตั้งแต่ต้น": ใส่แถวปลดล็อกให้ห้องไว้ก่อน (ครูกดล็อกทีหลังได้)
create or replace function public.dbq_default_unlocks_for_room()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if new.course = 'dbquest_m5' then
    insert into public.dbq_classroom_unlocks (classroom_id, session_no)
    select new.id, l.session_no from public.dbq_lessons l where l.is_unlocked_default
    on conflict do nothing;
  end if;
  return new;
end;
$$;

create or replace function public.dbq_default_unlocks_for_lesson()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if new.is_unlocked_default and (tg_op = 'INSERT' or not old.is_unlocked_default) then
    insert into public.dbq_classroom_unlocks (classroom_id, session_no)
    select c.id, new.session_no from public.classrooms c where c.course = 'dbquest_m5'
    on conflict do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists dbq_default_unlocks_room on public.classrooms;
create trigger dbq_default_unlocks_room
  after insert or update of course on public.classrooms
  for each row execute function public.dbq_default_unlocks_for_room();

drop trigger if exists dbq_default_unlocks_lesson on public.dbq_lessons;
create trigger dbq_default_unlocks_lesson
  after insert or update of is_unlocked_default on public.dbq_lessons
  for each row execute function public.dbq_default_unlocks_for_lesson();

revoke execute on function public.dbq_default_unlocks_for_room(), public.dbq_default_unlocks_for_lesson() from public, anon, authenticated;
