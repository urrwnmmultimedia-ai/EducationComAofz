-- =============================================================
-- 025 DB Quest (ม.5): คะแนนที่ทำได้ตอนนี้ (so_far) สำหรับวิวัฒนาการ
--   คะแนนรวม (total) ยังแบ่ง 17 คาบเหมือนเดิม — แต่วิวัฒนาการใช้ so_far
--   = ผลงานเฉพาะคาบที่ครูเปิดให้ห้องแล้ว (เฉลี่ยตามน้ำหนักของหมวดที่มีให้นับ)
--   ใบงานที่ส่งแล้วแต่ครูยังไม่ตรวจไม่นับ (ไม่ดึงคะแนนลง) · ยังไม่ส่ง = 0
-- =============================================================

create or replace function public.dbq_student_scores(p_sid uuid)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_w      jsonb := coalesce((select value from public.dbq_settings where key = 'score_weights'), '{}'::jsonb);
  v_cat    text;
  v_earned numeric;
  v_max    numeric;
  v_pct    numeric;
  v_weight numeric;
  v_cats   jsonb := '{}'::jsonb;
  v_total  numeric := 0;
  v_avail  numeric := 0;
  v_ratio  numeric;
  v_sf_sum numeric := 0;
  v_sf_w   numeric := 0;
begin
  foreach v_cat in array array['worksheet', 'unit_quiz', 'game', 'project', 'attendance', 'midterm', 'final'] loop
    v_weight := coalesce((v_w ->> v_cat)::numeric, 0);
    if v_cat = 'worksheet' then
      -- ช่อง = คาบเนื้อหาทุกคาบ + คาบอื่นที่มีใบงาน (ใบงานไม่ผูกคาบ = ช่องของตัวเอง)
      with slots as (
        select 's' || l.session_no as k from public.dbq_lessons l where l.kind = 'lesson'
        union
        select coalesce('s' || a.session_no, 'a' || a.id) from public.dbq_assignments a where a.max_score > 0
      ),
      per_slot as (
        select coalesce('s' || a.session_no, 'a' || a.id) as k,
               coalesce(sum(s.score) filter (where s.graded_at is not null), 0) / sum(a.max_score) as ratio
        from public.dbq_assignments a
        left join public.dbq_submissions s on s.assignment_id = a.id and s.student_id = p_sid
        where a.max_score > 0
        group by 1
      )
      select coalesce(sum(p.ratio), 0), count(*)
        into v_earned, v_max
      from slots sl left join per_slot p on p.k = sl.k;
    elsif v_cat = 'game' then
      with slots as (
        select l.session_no, l.game_key from public.dbq_lessons l where l.kind = 'lesson' or l.game_key is not null
      )
      , best as (
        select gs.game_key, max(gs.score) as best from public.dbq_game_scores gs
        where gs.student_id = p_sid group by gs.game_key
      )
      -- least() ข้าม null จึงต้อง coalesce ก่อน (ยังไม่เล่น = 0)
      select coalesce(sum(least(coalesce(b.best, 0), 100)), 0) / 100.0, count(*)
        into v_earned, v_max
      from slots sl
      left join best b on b.game_key = sl.game_key;
    else
      select m.score, m.max_score into v_earned, v_max
      from public.dbq_manual_scores m where m.student_id = p_sid and m.category = v_cat;
      if not found then
        v_earned := null;
        v_max := null;
      end if;
    end if;

    v_earned := round(v_earned, 2);
    v_pct := case when coalesce(v_max, 0) > 0 then round(100 * v_earned / v_max, 2) end;
    v_cats := v_cats || jsonb_build_object(v_cat, jsonb_build_object(
      'weight', v_weight,
      'earned', v_earned,
      'max', v_max,
      'unit', case when v_cat in ('worksheet', 'game') then 'session' end,
      'pct', v_pct,
      'points', case when v_pct is null then null else round(v_pct * v_weight / 100, 2) end
    ));
    if v_pct is not null then
      v_total := v_total + v_pct * v_weight / 100;
      v_avail := v_avail + v_weight;
    end if;

    -- คะแนนที่ทำได้ตอนนี้ (วิวัฒนาการ): เฉพาะคาบที่เปิดให้ห้องแล้ว
    --   ใบงาน: ตรวจแล้ว = คะแนนจริง · ยังไม่ส่ง = 0 · ส่งแล้วรอตรวจ = ยังไม่นับ
    --   เกม: คาบที่เปิดและมีเกม คะแนนดีที่สุด / 100 (ยังไม่เล่น = 0)
    --   หมวดที่ครูกรอก: นับเมื่อกรอกแล้ว
    v_ratio := null;
    if v_weight > 0 then
      if v_cat = 'worksheet' then
        select avg(x.ratio) into v_ratio from (
          select coalesce(sum(s.score) filter (where s.graded_at is not null), 0)
                 / sum(a.max_score) filter (where s.id is null or s.graded_at is not null) as ratio
          from public.dbq_assignments a
          left join public.dbq_submissions s on s.assignment_id = a.id and s.student_id = p_sid
          where a.max_score > 0 and a.session_no is not null and public.dbq_is_session_open(p_sid, a.session_no)
          group by a.session_no
        ) x where x.ratio is not null;
      elsif v_cat = 'game' then
        select avg(least(coalesce(b.best, 0), 100) / 100.0) into v_ratio
        from public.dbq_lessons l
        left join (
          select gs.game_key, max(gs.score) as best from public.dbq_game_scores gs where gs.student_id = p_sid group by gs.game_key
        ) b on b.game_key = l.game_key
        where l.game_key is not null and public.dbq_is_session_open(p_sid, l.session_no);
      elsif v_pct is not null then
        v_ratio := v_pct / 100;
      end if;
      if v_ratio is not null then
        v_sf_sum := v_sf_sum + v_ratio * v_weight;
        v_sf_w := v_sf_w + v_weight;
      end if;
    end if;
  end loop;

  return jsonb_build_object(
    'categories', v_cats,
    'total', round(v_total, 2),           -- คะแนนสะสมเต็ม 100 (หมวดที่ยังไม่มีคะแนน = 0)
    'available', v_avail,                 -- น้ำหนักรวมของหมวดที่มีคะแนนแล้ว
    'current_pct', case when v_avail > 0 then round(100 * v_total / v_avail, 2) end,
    'so_far', case when v_sf_w > 0 then round(100 * v_sf_sum / v_sf_w, 2) else 0 end  -- ใช้กับวิวัฒนาการ
  );
end;
$$;
