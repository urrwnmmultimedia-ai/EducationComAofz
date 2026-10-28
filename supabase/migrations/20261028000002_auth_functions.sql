-- =============================================================
-- 002 ฟังก์ชันช่วย + RPC เข้าสู่ระบบด้วยรหัส (ไม่มีรหัสผ่าน)
-- ทุกฟังก์ชันใช้ search_path = '' และอ้างชื่อเต็ม schema
-- =============================================================

-- หมายเหตุ: ชื่อ current_role ชนกับ keyword ของ SQL (CURRENT_ROLE)
-- จึงใช้ชื่อ current_app_role() แทน
create or replace function public.current_app_role()
returns text
language sql stable security definer
set search_path = ''
as $$
  select s.role
  from public.sessions s
  left join public.students st on st.id = s.student_id
  where s.auth_uid = auth.uid()
    and (s.role = 'admin' or st.is_active)
$$;

create or replace function public.current_student_id()
returns uuid
language sql stable security definer
set search_path = ''
as $$
  select s.student_id
  from public.sessions s
  join public.students st on st.id = s.student_id
  where s.auth_uid = auth.uid() and s.role = 'student' and st.is_active
$$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select coalesce(public.current_app_role() = 'admin', false)
$$;

create or replace function public.current_classroom_id()
returns uuid
language sql stable security definer
set search_path = ''
as $$
  select st.classroom_id from public.students st where st.id = public.current_student_id()
$$;

-- คาบนี้ปลดล็อกให้ห้องของนักเรียนที่ล็อกอินอยู่หรือไม่ (แอดมิน = true เสมอ)
create or replace function public.is_session_unlocked(p_session_no int)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select public.is_admin() or exists (
    select 1 from public.classroom_session_unlocks u
    where u.session_no = p_session_no
      and u.classroom_id = public.current_classroom_id()
      and u.is_unlocked
  )
$$;

-- ข้อมูลนักเรียนแบบที่ส่งให้ client ได้ (ไม่มี bound_*)
create or replace function public.student_profile_json(p_student_id uuid)
returns jsonb
language sql stable security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', st.id,
    'student_code', st.student_code,
    'prefix', st.prefix,
    'first_name', st.first_name,
    'last_name', st.last_name,
    'nickname', st.nickname,
    'number', st.number,
    'avatar', st.avatar,
    'classroom_id', st.classroom_id,
    'classroom_name', c.name
  )
  from public.students st
  left join public.classrooms c on c.id = st.classroom_id
  where st.id = p_student_id
$$;

-- -------------------------------------------------------------
-- login_with_code: ตรวจรหัสฝั่งเซิร์ฟเวอร์เท่านั้น
-- คืน jsonb เสมอ (ไม่ raise) เพื่อให้บันทึก login_attempts ได้
--   { ok: true, role, student }  หรือ  { ok: false, error, retry_after_sec? }
-- error: not_signed_in | rate_limited | not_found | device_locked
-- -------------------------------------------------------------
create or replace function public.login_with_code(p_code text, p_device_key text default null)
returns jsonb
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_uid       uuid := auth.uid();
  v_code      text := btrim(coalesce(p_code, ''));
  v_fail      int;
  v_oldest    timestamptz;
  v_hash      text;
  v_student   public.students%rowtype;
  v_lock      boolean;
  v_device    jsonb;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'not_signed_in');
  end if;

  -- จำกัดการเดา: ผิดเกิน 10 ครั้งใน 5 นาที ต่อ auth_uid => ล็อก 5 นาที
  select count(*), min(attempted_at) into v_fail, v_oldest
  from public.login_attempts
  where auth_uid = v_uid and not success and attempted_at > now() - interval '5 minutes';

  if v_fail >= 10 then
    return jsonb_build_object(
      'ok', false, 'error', 'rate_limited',
      'retry_after_sec', greatest(1, ceil(extract(epoch from (v_oldest + interval '5 minutes' - now())))::int)
    );
  end if;

  if length(v_code) = 0 or length(v_code) > 64 then
    insert into public.login_attempts (auth_uid, success) values (v_uid, false);
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  v_device := jsonb_build_object(
    'device_key', left(coalesce(p_device_key, ''), 64),
    'user_agent', left(coalesce(current_setting('request.headers', true)::jsonb ->> 'user-agent', ''), 300)
  );

  -- 1) รหัสแอดมิน
  select value into v_hash from public.app_secrets where key = 'admin_code';
  if v_hash is not null and v_hash = extensions.crypt(v_code, v_hash) then
    insert into public.sessions (auth_uid, role, student_id, device_info)
    values (v_uid, 'admin', null, v_device)
    on conflict (auth_uid) do update
      set role = 'admin', student_id = null, device_info = excluded.device_info,
          created_at = now(), last_seen_at = now();
    insert into public.login_attempts (auth_uid, success) values (v_uid, true);
    return jsonb_build_object('ok', true, 'role', 'admin', 'student', null);
  end if;

  -- 2) รหัสนักเรียน
  select * into v_student
  from public.students
  where student_code = v_code and is_active
  for update;

  if not found then
    insert into public.login_attempts (auth_uid, success) values (v_uid, false);
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  select device_lock into v_lock from public.app_settings where id = 1;

  if coalesce(v_lock, false)
     and v_student.bound_device_key is not null
     and v_student.bound_device_key is distinct from nullif(p_device_key, '') then
    -- ไม่นับเป็นการเดารหัสผิด แต่ไม่ให้เข้า
    return jsonb_build_object('ok', false, 'error', 'device_locked');
  end if;

  update public.students
  set bound_auth_uid = v_uid,
      bound_device_key = case
        when coalesce(v_lock, false) then coalesce(bound_device_key, nullif(p_device_key, ''))
        else nullif(p_device_key, '')
      end
  where id = v_student.id;

  insert into public.sessions (auth_uid, role, student_id, device_info)
  values (v_uid, 'student', v_student.id, v_device)
  on conflict (auth_uid) do update
    set role = 'student', student_id = excluded.student_id, device_info = excluded.device_info,
        created_at = now(), last_seen_at = now();

  insert into public.login_attempts (auth_uid, success) values (v_uid, true);

  return jsonb_build_object('ok', true, 'role', 'student', 'student', public.student_profile_json(v_student.id));
end;
$$;

-- ใครกำลังล็อกอินอยู่ (ใช้ตอนรีเฟรชหน้า)
create or replace function public.whoami()
returns jsonb
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_role text := public.current_app_role();
  v_sid  uuid;
begin
  if v_role is null then
    return jsonb_build_object('role', null, 'student', null);
  end if;
  update public.sessions set last_seen_at = now() where auth_uid = auth.uid();
  v_sid := public.current_student_id();
  return jsonb_build_object(
    'role', v_role,
    'student', case when v_sid is null then null else public.student_profile_json(v_sid) end
  );
end;
$$;

create or replace function public.logout()
returns void
language sql volatile security definer
set search_path = ''
as $$
  delete from public.sessions where auth_uid = auth.uid()
$$;

-- -------------------------------------------------------------
-- RPC ฝั่งแอดมิน
-- -------------------------------------------------------------
create or replace function public.admin_set_admin_code(p_new_code text)
returns void
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_code text := btrim(coalesce(p_new_code, ''));
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if length(v_code) < 6 or v_code ~ '^[0-9]+$' then
    -- ห้ามเป็นตัวเลขล้วน เพื่อไม่ให้ชนกับรหัสนักเรียน
    raise exception 'invalid_admin_code' using errcode = '22023';
  end if;
  update public.app_secrets
  set value = extensions.crypt(v_code, extensions.gen_salt('bf'))
  where key = 'admin_code';
end;
$$;

create or replace function public.admin_reset_device(p_student_id uuid)
returns void
language plpgsql volatile security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.students set bound_device_key = null, bound_auth_uid = null where id = p_student_id;
  delete from public.sessions where student_id = p_student_id;
end;
$$;

-- -------------------------------------------------------------
-- สิทธิ์เรียกใช้ฟังก์ชัน
-- -------------------------------------------------------------
revoke execute on all functions in schema public from public, anon;

grant execute on function
  public.current_app_role(),
  public.current_student_id(),
  public.is_admin(),
  public.current_classroom_id(),
  public.is_session_unlocked(int),
  public.login_with_code(text, text),
  public.whoami(),
  public.logout(),
  public.admin_set_admin_code(text),
  public.admin_reset_device(uuid)
to authenticated;

-- student_profile_json ใช้ภายในเท่านั้น
revoke execute on function public.student_profile_json(uuid) from authenticated;
