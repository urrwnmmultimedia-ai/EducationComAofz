-- =============================================================
-- คาบที่ 1 (ม.3): เปลี่ยนจาก "ปฐมนิเทศ" เป็น "หลักการทำงานพื้นฐานของคอมพิวเตอร์ (IPO Model)"
-- สอนแบบ DB Quest 6 ขั้น: เปิดคาบ → บทเรียน (การ์ด + เช็กความเข้าใจ) → เกม IPO Sorter → ใบงาน → Exit ticket → ปิดคาบ
-- ใช้กับฐานข้อมูลที่ติดตั้งแล้ว: SQL Editor → วางทั้งไฟล์ → Run (รันซ้ำได้)
-- ⚠️ ทับขั้นตอน เนื้อหาบทเรียน และ Exit ticket 5 ข้อของคาบ 1 ถ้าครูแก้เองในหน้าแอดมินไว้ จะถูกแทนที่
-- (สร้างจาก supabase/seed.sql, lessons/01.md, games/games.json, questions/questions.txt)
-- =============================================================

begin;

-- 1) หัวข้อ เกม และขั้นตอนในคาบ
update public.class_sessions set
  title = 'หลักการทำงานพื้นฐานของคอมพิวเตอร์ (IPO Model)',
  summary = 'คอมพิวเตอร์ทำงาน 3 ขั้น: Input รับข้อมูลเข้า → Process ประมวลผลด้วย CPU → Output แสดงผลลัพธ์ (มีแบบทดสอบก่อนเรียน ไม่คิดคะแนน)',
  work_label = 'ใบงาน IPO ของอุปกรณ์รอบตัว (ฝึกทำ ไม่คิดคะแนน)',
  game_slug = 'ipo-sorter',
  steps = '[{"key":"warmup","label":"เปิดคาบ","minutes":15,
      "question":"กด 7 × 8 = บนเครื่องคิดเลขในมือถือ ก่อนเลข 56 จะโผล่บนจอ เครื่องทำอะไรไปบ้าง?",
      "why":"คอมพิวเตอร์ทุกเครื่อง ตั้งแต่มือถือ โน้ตบุ๊ก จนถึงตู้ ATM ทำงานด้วยหลักการเดียวกัน ถ้าเข้าใจหลักนี้ จะเข้าใจเทคโนโลยีทุกชิ้นที่เราจะเรียนตลอดเทอม",
      "goals":["บอกความหมายของ Input, Process และ Output ได้","ยกตัวอย่างอุปกรณ์รับเข้าและอุปกรณ์แสดงผลได้","วิเคราะห์การทำงานของอุปกรณ์รอบตัวตามขั้นตอน IPO ได้"],
      "items":["วันนี้เราใช้คอมพิวเตอร์หรือมือถือทำอะไรไปแล้วบ้าง?","ตอนพูดสั่งมือถือว่า \"เปิดเพลง\" เครื่องรู้ได้อย่างไรว่าเราพูดอะไร?"]},
     {"key":"content","label":"บทเรียน","minutes":35},
     {"key":"game","label":"เกม","minutes":20},
     {"key":"work","label":"ใบงาน","minutes":30},
     {"key":"exit","label":"Exit ticket","minutes":10},
     {"key":"summary","label":"ปิดคาบ","minutes":10,
      "items":["คอมพิวเตอร์ทำงาน 3 ขั้น: Input → Process → Output (IPO Model)","Input รับข้อมูลเข้าผ่านคีย์บอร์ด เมาส์ ไมโครโฟน สแกนเนอร์/กล้อง","Process ใช้ CPU คำนวณ ตรวจสอบ จัดเรียง เปลี่ยนข้อมูลเป็นสารสนเทศ โดยใช้ RAM/Storage","Output แสดงผลผ่านจอภาพ เครื่องพิมพ์ ลำโพง"]}]'::jsonb
where session_no = 1;

-- 2) เนื้อหาบทเรียน (การ์ดพร้อมเช็กความเข้าใจ)
update public.lessons set title = 'หลักการทำงานพื้นฐานของคอมพิวเตอร์ (IPO Model)', content_md = $md$
## คอมพิวเตอร์ทำงานอย่างไร?
ไม่ว่าจะเป็นมือถือ โน้ตบุ๊ก เครื่องคิดเงินในร้านสะดวกซื้อ หรือตู้ ATM ทุกเครื่องทำงานด้วยหลักการเดียวกัน 3 ขั้นตอน เรียกว่า **IPO Model**

| ขั้นตอน | ชื่อไทย | ทำหน้าที่ |
| --- | --- | --- |
| **I**nput | การรับเข้า | รับข้อมูลหรือคำสั่งเข้าสู่ระบบ |
| **P**rocess | การประมวลผล | คิด คำนวณ จัดการข้อมูลให้เป็นสารสนเทศ |
| **O**utput | การแสดงผล | แสดงผลลัพธ์ให้คนหรือระบบอื่นเข้าใจ |

:::example
กด **7 × 8 =** บนเครื่องคิดเลขในมือถือ
- **Input** — นิ้วแตะปุ่ม 7, ×, 8, = บนหน้าจอสัมผัส
- **Process** — CPU คำนวณ 7 × 8
- **Output** — เลข **56** ขึ้นบนจอ
:::

:::check
IPO Model ย่อมาจากอะไร
- [ ] Internet, Phone, Online
- [x] Input, Process, Output
- [ ] Information, Program, Operation
- [ ] Insert, Print, Open
---
**I**nput (การรับเข้า) → **P**rocess (การประมวลผล) → **O**utput (การแสดงผล) เรียงตามลำดับการทำงานของคอมพิวเตอร์
:::

## 1. Input — หน่วยรับเข้า
**ความหมาย:** ขั้นตอนการนำข้อมูลหรือคำสั่งเข้าสู่ระบบคอมพิวเตอร์ ผ่าน **อุปกรณ์รับเข้า (Input Device)**

| อุปกรณ์ | รับอะไรเข้าไป |
| --- | --- |
| ⌨️ คีย์บอร์ด (Keyboard) | พิมพ์ข้อความหรือตัวเลข |
| 🖱️ เมาส์ (Mouse) | คลิกหรือเลื่อนเพื่อสั่งงาน |
| 🎤 ไมโครโฟน (Microphone) | รับเสียงเข้าสู่ระบบ |
| 📷 สแกนเนอร์ / กล้อง (Scanner / Camera) | รับภาพหรือเอกสาร |

:::tip
หน้าจอสัมผัสของมือถือเป็นได้ทั้ง **Input** (รับการแตะของนิ้ว) และ **Output** (แสดงภาพ) ในชิ้นเดียว
:::

:::check
ตอนสแกน QR Code เพื่อจ่ายเงินที่โรงอาหาร อุปกรณ์ใดทำหน้าที่ **Input**
- [ ] ลำโพงที่ส่งเสียง "ชำระเงินสำเร็จ"
- [x] กล้องของมือถือที่อ่าน QR Code
- [ ] จอที่แสดงยอดเงินคงเหลือ
- [ ] เครื่องพิมพ์ใบเสร็จ
---
กล้อง **รับภาพ QR Code เข้าสู่ระบบ** จึงเป็นหน่วยรับเข้า ส่วนลำโพง จอ และเครื่องพิมพ์ เป็นหน่วยแสดงผล
:::

## 2. Process — หน่วยประมวลผล
**ความหมาย:** ขั้นตอนที่ **ซีพียู (CPU – Central Processing Unit)** นำข้อมูลที่รับเข้ามามา **คิดคำนวณ จัดเรียง ตรวจสอบ** หรือประมวลผล ให้กลายเป็น **สารสนเทศ (Information)**

การทำงานหลัก ๆ ของหน่วยประมวลผล
- **คำนวณทางคณิตศาสตร์และตรรกะ** — บวก ลบ คูณ หาร เปรียบเทียบมากกว่า/น้อยกว่า
- **จัดเก็บหรือดึงข้อมูลในหน่วยความจำ** — RAM (เก็บชั่วคราวระหว่างทำงาน) และ Storage (เก็บถาวร เช่น SSD)
- **จัดหมวดหมู่และประมวลผลตามคำสั่งของโปรแกรม**

:::doctor
CPU เปรียบเหมือน **สมอง** ของคอมพิวเตอร์ ส่วน RAM เหมือน **โต๊ะทำงาน** ที่วางของที่กำลังใช้อยู่ และ Storage เหมือน **ตู้เก็บเอกสาร** ที่เก็บของไว้ได้นาน ๆ แม้ปิดเครื่อง
:::

:::check
ข้อใดเป็นงานของขั้น **Process**
- [ ] ครูพิมพ์คะแนนสอบของนักเรียนลงในโปรแกรม
- [x] โปรแกรมหาค่าเฉลี่ยคะแนนและเรียงลำดับจากมากไปน้อย
- [ ] เครื่องพิมพ์พิมพ์ใบรายงานผลการเรียน
- [ ] ลำโพงอ่านชื่อนักเรียนที่ได้คะแนนสูงสุด
---
การ **คำนวณค่าเฉลี่ยและเรียงลำดับ** คือการประมวลผล เปลี่ยนข้อมูล (คะแนนดิบ) ให้เป็นสารสนเทศที่นำไปใช้ได้
:::

## 3. Output — หน่วยแสดงผล
**ความหมาย:** ขั้นตอนการแสดงผลลัพธ์ที่ได้จากการประมวลผล ออกมาในรูปแบบที่ **มนุษย์หรือระบบอื่นเข้าใจได้** ผ่าน **อุปกรณ์แสดงผล (Output Device)**

| อุปกรณ์ | แสดงผลแบบไหน |
| --- | --- |
| 🖥️ จอภาพ (Monitor) | ภาพหรือข้อความ |
| 🖨️ เครื่องพิมพ์ (Printer) | พิมพ์ข้อมูลออกมาเป็นกระดาษ |
| 🔊 ลำโพง (Speaker) | เสียง |

:::check
ข้อใดเป็น **อุปกรณ์แสดงผล (Output) ทั้งหมด**
- [ ] คีย์บอร์ด เมาส์ ไมโครโฟน
- [ ] กล้อง สแกนเนอร์ จอภาพ
- [x] จอภาพ เครื่องพิมพ์ ลำโพง
- [ ] CPU RAM ลำโพง
---
จอภาพแสดงภาพ เครื่องพิมพ์แสดงผลบนกระดาษ ลำโพงแสดงผลเป็นเสียง — ทั้งหมดส่งผลลัพธ์ **ออก** จากเครื่อง
:::

## ต่อให้ครบวงจร IPO
ทุกระบบรอบตัวเราทำงานครบ 3 ขั้นเสมอ ลองดูตัวอย่าง **ถอนเงินจากตู้ ATM**

| ขั้น | เกิดอะไรขึ้น |
| --- | --- |
| Input | เสียบบัตร กดรหัส PIN และจำนวนเงินบนแป้นกด |
| Process | ตรวจรหัส ตรวจยอดเงินในบัญชี หักยอดเงิน |
| Output | จอแสดงยอดคงเหลือ เครื่องจ่ายธนบัตร พิมพ์สลิป |

:::think
ลองแยก IPO ของ **การสั่งงานลำโพงอัจฉริยะด้วยเสียง** ("เปิดเพลงหน่อย")
---
- **Input** — ไมโครโฟนรับเสียงพูด
- **Process** — แปลงเสียงเป็นคำสั่ง ค้นหาเพลง
- **Output** — ลำโพงเล่นเพลง (บางรุ่นมีไฟกะพริบด้วย)
:::

:::check
เรียงลำดับการทำงานของ "ถ่ายรูปแล้วแต่งรูปด้วยฟิลเตอร์" ให้ถูกต้อง
- [ ] เห็นรูปที่แต่งแล้วบนจอ → กล้องรับภาพ → แอปปรับสีด้วยฟิลเตอร์
- [x] กล้องรับภาพ → แอปปรับสีด้วยฟิลเตอร์ → เห็นรูปที่แต่งแล้วบนจอ
- [ ] แอปปรับสีด้วยฟิลเตอร์ → กล้องรับภาพ → เห็นรูปที่แต่งแล้วบนจอ
- [ ] กล้องรับภาพ → เห็นรูปที่แต่งแล้วบนจอ → แอปปรับสีด้วยฟิลเตอร์
---
Input (กล้องรับภาพ) → Process (ปรับสีด้วยฟิลเตอร์) → Output (แสดงบนจอ) ต้องเรียงตามนี้เสมอ
:::
$md$
where session_no = 1 and sort_order = 1;

-- 3) เกม IPO Sorter (เกมใหม่)
insert into public.games (slug, unit_id, title, description, config, max_score, max_xp, min_duration_sec)
values
  ('ipo-sorter', null, 'IPO Sorter', 'แยกอุปกรณ์และการทำงานของคอมพิวเตอร์ลงกล่อง Input / Process / Output', '{"engine":"sort","mode":"board","instructions":"ลาก (หรือแตะการ์ด แล้วแตะกล่อง) อุปกรณ์หรือการทำงานแต่ละอย่างไปไว้ในขั้นที่ถูกต้อง แล้วกดตรวจคำตอบ จบแล้วมีคำถามโบนัส","timeLimitSec":150,"buckets":[{"id":"input","label":"Input (รับเข้า)","icon":"⌨️"},{"id":"process","label":"Process (ประมวลผล)","icon":"🧠"},{"id":"output","label":"Output (แสดงผล)","icon":"🖥️"}],"cards":[{"text":"คีย์บอร์ดพิมพ์ข้อความ","bucket":"input"},{"text":"เมาส์คลิกสั่งงาน","bucket":"input"},{"text":"ไมโครโฟนรับเสียงพูด","bucket":"input"},{"text":"สแกนเนอร์รับภาพเอกสาร","bucket":"input"},{"text":"กล้องมือถืออ่าน QR Code","bucket":"input"},{"text":"CPU คำนวณผลบวกคะแนน","bucket":"process","explain":"การคำนวณเป็นงานของหน่วยประมวลผล"},{"text":"จัดเรียงรายชื่อจาก ก-ฮ","bucket":"process"},{"text":"ตรวจว่ารหัสผ่านถูกต้องไหม","bucket":"process","explain":"การตรวจสอบ/เปรียบเทียบเป็นการประมวลผลเชิงตรรกะ"},{"text":"ดึงไฟล์จากหน่วยความจำมาใช้งาน","bucket":"process"},{"text":"จอภาพแสดงข้อความ","bucket":"output"},{"text":"เครื่องพิมพ์พิมพ์ใบเสร็จ","bucket":"output"},{"text":"ลำโพงเล่นเพลง","bucket":"output"}],"bonus":[{"q":"CPU ย่อมาจากอะไร","choices":["Computer Personal Unit","Central Processing Unit","Control Print Unit","Central Program User"],"answer":1,"explain":"CPU = Central Processing Unit หน่วยประมวลผลกลาง"},{"q":"ข้อมูลที่ผ่านการประมวลผลแล้ว นำไปใช้ตัดสินใจได้ เรียกว่าอะไร","choices":["ข้อมูลดิบ","สารสนเทศ (Information)","อุปกรณ์รับเข้า","โปรแกรม"],"answer":1,"explain":"Process เปลี่ยนข้อมูลให้เป็นสารสนเทศ"}]}'::jsonb, 100, 40, 20)
on conflict (slug) do update set
  title = excluded.title, description = excluded.description, config = excluded.config, max_xp = excluded.max_xp,
  min_duration_sec = excluded.min_duration_sec, is_active = true;

-- 4) ใบงานคาบ 1
insert into public.assignments (session_no, unit_id, title, instructions_md, type, max_score, category, rubric, config, sort_order)
select v.no, cs.unit_id, v.title, v.md, v.type, v.max, v.cat, v.rubric::jsonb, v.config::jsonb, v.ord
from (values
(1, 'ใบงาน IPO ของอุปกรณ์รอบตัว',
   'เลือกอุปกรณ์หรือสถานการณ์รอบตัว 3 อย่าง (เช่น ตู้ ATM, สแกนจ่ายเงินที่โรงอาหาร, สั่งงานลำโพงอัจฉริยะด้วยเสียง) แล้ววิเคราะห์ว่าแต่ละขั้น Input → Process → Output เกิดอะไรขึ้น และใช้อุปกรณ์ใด',
   'table', 0, 'work', '[]',
   '{"columns":["อุปกรณ์ / สถานการณ์","Input (รับอะไร ผ่านอุปกรณ์ใด)","Process (ประมวลผลอะไร)","Output (แสดงผลอะไร ผ่านอุปกรณ์ใด)"],"rows":3}', 1)
) as v(no, title, md, type, max, cat, rubric, config, ord)
join public.class_sessions cs on cs.session_no = v.no
where not exists (select 1 from public.assignments a where a.session_no = v.no and a.title = v.title);

-- 5) Exit ticket คาบ 1: เปลี่ยน 5 ข้อเป็นเรื่อง IPO (id เดิม ชุดสอบเดิมใช้ต่อได้เลย)
insert into public.questions (id, unit_id, topic, indicator, type, prompt, choices, correct_answer, explanation, difficulty, reviewed)
values
  ('95084506-a968-45d0-aa14-69ae457d65f4', null, 'IPO', null, 'mcq', 'ขั้นตอนการทำงานพื้นฐานของคอมพิวเตอร์ (IPO Model) เรียงลำดับอย่างไร', '["Output → Process → Input","Input → Output → Process","Process → Input → Output","Input → Process → Output"]'::jsonb, '{"index":3}'::jsonb, 'รับข้อมูลเข้า → ประมวลผล → แสดงผล', 'easy', false),
  ('057a9dc2-255a-46d4-a28e-f36c73d47d75', null, 'IPO', null, 'mcq', 'ข้อใดเป็นอุปกรณ์รับเข้า (Input Device) ทั้งหมด', '["ลำโพง เมาส์ จอภาพ","คีย์บอร์ด เมาส์ ไมโครโฟน","CPU RAM SSD","จอภาพ ลำโพง เครื่องพิมพ์"]'::jsonb, '{"index":1}'::jsonb, 'คีย์บอร์ด เมาส์ ไมโครโฟน ใช้นำข้อมูลหรือคำสั่งเข้าสู่ระบบ', 'easy', false),
  ('185ab34b-636d-46cb-aa91-a0771bc5f5ec', null, 'IPO', null, 'true_false', 'CPU ทำหน้าที่แสดงผลลัพธ์ออกทางจอภาพ', '[]'::jsonb, '{"value":false}'::jsonb, 'CPU อยู่ในขั้น Process ทำหน้าที่คำนวณและประมวลผล ส่วนจอภาพเป็นหน่วยแสดงผล', 'easy', false),
  ('d49bb688-e097-4790-a0d4-b2b2a0bd8826', null, 'IPO', null, 'matching', 'จับคู่อุปกรณ์กับขั้นตอนใน IPO Model', '{"left":["สแกนเนอร์","CPU","เครื่องพิมพ์"],"right":["Output (พิมพ์ออกเป็นกระดาษ)","Input (รับภาพหรือเอกสาร)","Process (คำนวณและประมวลผล)"]}'::jsonb, '{"pairs":[1,2,0]}'::jsonb, 'แต่ละอุปกรณ์ทำหน้าที่ต่างกันในวงจร IPO', 'medium', false),
  ('7ba4c06b-ffbf-447b-a1d4-752169c18515', null, 'IPO', null, 'mcq', 'ร้านสะดวกซื้อยิงบาร์โค้ดสินค้า แล้วระบบรวมราคาและพิมพ์ใบเสร็จ ข้อใดเป็นขั้น Process', '["ระบบรวมราคาสินค้าทั้งหมด","จอแสดงยอดเงิน","ยิงบาร์โค้ดด้วยเครื่องอ่าน","พิมพ์ใบเสร็จ"]'::jsonb, '{"index":0}'::jsonb, 'การรวมราคาเป็นการคำนวณ จึงเป็นการประมวลผล', 'medium', false)
on conflict (id) do update set
  topic = excluded.topic, indicator = excluded.indicator, type = excluded.type, prompt = excluded.prompt,
  choices = excluded.choices, correct_answer = excluded.correct_answer, explanation = excluded.explanation,
  difficulty = excluded.difficulty, reviewed = false;

commit;

-- ตรวจผล: ควรได้ 1 แถว title = IPO, game = ipo-sorter, has_check = true, worksheets = 1
select cs.session_no, cs.title, cs.game_slug,
  (select content_md like '%:::check%' from public.lessons l where l.session_no = 1 and l.sort_order = 1) as has_check,
  (select count(*) from public.assignments a where a.session_no = 1) as worksheets,
  exists (select 1 from public.games g where g.slug = 'ipo-sorter' and g.is_active) as game_ok
from public.class_sessions cs where cs.session_no = 1;
