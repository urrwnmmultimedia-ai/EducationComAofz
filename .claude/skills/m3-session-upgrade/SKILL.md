---
name: m3-session-upgrade
description: Upgrade one M.3 (ม.3) class session to the "deluxe" format first built for session 2 (5G) — warm-up answers in guided boxes (ขั้นที่ 1), animated/interactive lesson blocks (ขั้นที่ 2), game that auto-starts after the lesson and auto-advances (ขั้นที่ 3), guided card worksheet (ขั้นที่ 4), 3D "depth" styling on every step, plus the SQL update file. Use when the user asks to do "คาบที่ N / บทที่ N" like คาบ 2, add ช่องไกด์คำตอบ, ภาพเคลื่อนไหว/กิจกรรมในบทเรียน, ใบงานแบบไกด์, or make a session's steps สวยงามมีมิติ.
---

# Upgrade an M.3 session (template: session 2 / 5G)

Reference implementation: session 2. Read `supabase/lessons/02.md` and `supabase/updates/m3_session2_5g.sql` before starting. Do **one session at a time** (user asked for that).

## Rules (from the user)
- Ask before using Chrome (claude-in-chrome). Test DB Quest/sessions only in teacher mode.
- Ask before `git commit`.
- Live Supabase is not reachable: write a SQL file in `supabase/updates/`, the user runs it in SQL Editor. Tell them which file and what the check query should return.
- Reply in Thai.

## What "deluxe" means and how it switches on
A session is deluxe when its warmup step has `guide` in `class_sessions.steps` (`deluxe = steps.some(s => s.guide?.length)` in `src/features/lessons/SessionPage.tsx`). Deluxe gives:
- `StepStage` wrapper: 3D stage + icon orb header per step (`.tq-stage`, `.tq-orb` in `src/index.css`).
- Step 1: `GuideBoxes` — one card per question, labeled slots; all slots must be filled. Answers stored in localStorage `tq-guide-<n>`, composed into the summary guess (`composeGuess`).
- Step 2: `LessonCards depth` — raised cards, 3D flip between cards.
- Step 3: game embedded in the session page with `autoStart` (skips intro, countdown immediately); pass ≥ `GAME_PASS_SCORE` (50) then `AutoAdvance` to next step.
- Non-deluxe sessions must look and behave exactly as before.

## Step 1 — warm-up guide (data)
Questions come from the warmup step: `question` (one big question) or `items` (several). `guide` is `GuideSlot[][]`: one array per question, index-aligned. Slot = `{ label, hint? }`. Label = what to write (emoji + short), hint = sentence starter "เช่น …" — never the answer (pre-lesson, ไม่มีถูกผิด). 2–3 slots per question.

Find the current questions in `supabase/seed.sql` (`pg_temp.steps(array[...]`). SQL (non-destructive, only adds `guide`):
```sql
update public.class_sessions cs set steps = (
  select jsonb_agg(case when s->>'key' = 'warmup' then s || jsonb_build_object('guide', $g$[ [...], [...] ]$g$::jsonb) else s end order by ord)
  from jsonb_array_elements(cs.steps) with ordinality as t(s, ord)
)
where cs.session_no = N and jsonb_typeof(cs.steps) = 'array';
```
Put the same statement in `supabase/seed.sql` right after the `class_sessions` insert (`on conflict (session_no) do nothing;`) so fresh installs get it. Teachers can edit it in admin (`GuideField`: line `ป้าย | ตัวอย่าง`, `---` = next question).

## Step 2 — lesson blocks (content in `supabase/lessons/NN.md`)
Syntax (parser `src/features/lessons/lessonFormat.ts`, renderers `ActivityBlocks.tsx`, `LessonWidgets.tsx`). Optional first non-`-` line = prompt. Close with `:::`. Malformed block falls back to plain markdown.
```
:::flow [cycle]            - ไอคอน | ชื่อ | คำอธิบาย          (animated pipeline, tap nodes, autoplay)
:::sort                    กลุ่ม: ก | ข | ค   then  - ข้อความ => ก   (tap card → tap group)
:::order                   - ขั้นที่ถูกลำดับ 1 / 2 / …        (written in correct order; shuffled deterministically)
:::flip                    - ด้านหน้า | ด้านหลัง
:::timeline                - ไอคอน | ชื่อ | ช่วงเวลา | คำอธิบาย
:::bars <หน่วย> [log]      - ชื่อ | ตัวเลข | ข้อความแสดง       (guess the biggest, bars grow)
:::widget <name>           one line; bespoke component registered in LESSON_WIDGETS
```
Plan per card (`## heading` = one card): aim for one activity on most cards, mix kinds, base every item on the card's own content. Place activities before a card's `:::check` (checks gate card progress; activities do not). If an activity would reveal a `:::think` answer, reword the think into "explain why".
Bespoke widget only when the topic has a calculation/simulation worth playing (session 2: `latency-brake`). Add it to `LessonWidgets.tsx`, document it in the file header and in the admin help list (`AdminSessionEditPage.tsx`). Earlier drafts for other sessions (IPO calculator, EV charge time, EAN-13 check digit with real barcode, delivery route planner) were removed for scope — rebuild when that session is done.

Then regenerate: `node scripts/build-lessons.mjs 2 3 4 5 6 7 8 9 11 12 13 14 15 16` (updates seed section D + `lessons_update.sql`; check `git diff` only touched the target session) and copy that session's `update public.lessons …` statement into the session SQL file.

## Step 4 — guided worksheet (`assignments.config`, type `table`)
Extra optional config keys (`tableConfigSchema` in `assignmentModel.ts`, each `.catch(undefined)`): `rowLabels` (fills column 0, read-only), `hints` (per column placeholder), `chips` (per column tap-to-append words), `steps` (3 how-to steps), `topic {label, hint, choices}` (stored in `content.text`), `example {topic, rows}` (finished example on a *different* topic). Any of `rowLabels/topic/steps` → `GuidedWorksheet` card layout; submit requires every editable cell + topic (`guidedProgress`). Answers stay in `content.rows`, so grading/exports are unchanged. Update both the seed row (section E of `seed.sql`) and the session SQL (`update public.assignments … where session_no = N and type = 'table' and sort_order = 1`). Warn the user: existing submissions get column 0 replaced by the row labels.

## Session SQL file
`supabase/updates/m3_sessionN_<topic>.sql`: header comment listing what changes per step and what gets overwritten, `begin;` → guide update → lesson update → assignment update → `commit;` → a check `select` returning booleans (has_guide, has_widget, has_guided_sheet…). Re-runnable. Then `node scripts/build-setup-sql.mjs`.

## Tests to add / run
- `lessonFormat.test.ts` for any new syntax; `seedLessons.test.tsx`: the session's md contains the expected block kinds and every `SegmentView` renders (`renderToString`, strip `<!-- -->`).
- `sessionSteps.test.ts` for guide helpers; `assignmentModel.test.ts` / `GuidedWorksheet.test.tsx` parse the seed config and render.
- `npx tsc -b`, `npx vitest run`, `npm run build` — all green before reporting.

## Gotchas
- Don't write TS/regex through Python heredocs: `\n`, `\b`, `\s` get mangled (happened twice). Use Write/Edit for code with escapes.
- `ring-*` utilities override `.tq-raised`/`.tq-stage` box-shadow (utilities layer wins) — don't put `ring-1` on depth cards.
- Keep colors on brand tokens (brand/action/gold/mint/sky/amber); design hook flags violet/purple.
- Tailwind custom classes can't take variants (`md:tq-flow-line` does nothing).
- Content is AI draft: approximate numbers must be labeled as such in a `:::tip`.

## DB Quest (ม.5) variant — reference: DB Quest session 2
Different system: content is frontend JSON `src/content/units/sNN.json` (no SQL; deploy only). Never use keys `answer/correct/solution/key` (check-content fails build).
- Deluxe switch: `intro.guide` present → `Deluxe` context in `src/dbquest/lesson/DbqLessonPage.tsx` (StepStage `tq-stage`, orb `StepHeader`, `tq-raised` panels; dark mode overrides in `index.css`).
- Step 1: `intro.guide` (required slots for the big question) + `warmupGuide` (index-aligned with `warmup`, optional). Saved as `{ guess, answers, slots }`; helpers `src/dbquest/lesson/warmupGuide.ts`.
- Step 2: per card `icon` + `goal` (ภารกิจการ์ดนี้); 3-step how-to strip + card rail. Blocks `{ "kind": "flow", title, cycle, nodes[{icon,label,md}] }` and `{ "kind": "widget", "name" }` → `DBQ_WIDGETS` in `src/dbquest/lesson/widgets.tsx` (session 2: search-race, table-explorer, pk-tester, query-filter). Widgets need `dark:` classes. Use a different dataset than the card's check question so the widget doesn't hand out the answer.
- Tests: `src/dbquest/lesson/widgets.test.tsx`.
- Step 3 (ฝึกปฏิบัติ): `practiceLevels` (index-aligned with `practice`: icon, title, tip, optional helper `widget`) → `QuizRunner levels` (level map, banner, tip, collapsible helper, combo, star burst). `practiceBonus` blocks (e.g. `{ "kind": "drill", title, groups, items[{text, group}], rounds }` quick-fire, ungraded, best score in localStorage). Graded questions/answer keys unchanged → no SQL. Drill items must not repeat graded question text (test checks).
- Step 3 must be one screen at a time (user: ไม่ขึ้นมาพร้อมกันให้งง): `LevelPractice` stages intro → levels (one question) → result → bonus drills one by one; tip lives inside the level banner.
- Step 4 (เกม): deluxe adds how-to strip + raised frame around `GameView` (game itself already 3D).
- Step 5 (ใบงาน): table cfg `why`/`query` flags add parts (sheet fields `why`, `query`, `queryResult`) so the sheet covers every card; deluxe uses `WorksheetWizard` (one page per part, next disabled until page complete, review page holds submit). Rubric lives in `supabase/answer_keys/sNN.json` → `node scripts/build-dbquest-seed.mjs && node scripts/build-setup-sql.mjs` → user runs `supabase/updates/dbquest_content.sql`. Teacher view `TableWorksheetView` shows new parts.
- Step 6 (ปิดคาบ): needs `recap { items[{icon,term,md}], widget: 'recap-table' }`, `intro.recap` (explains the big question), `closing.levels`. `DeluxeWrapup` stages: สรุป (RecapBoard + 3 summary) → ภารกิจ (QuizRunner levels) → ก่อน–หลังเรียน (guess vs after slots, recap revealed after writing, goals self-check) → `finish('wrapup', { after, goals })`. No SQL.
- Server limit: `dbq_complete_step` rejects `p_data` > 8000 bytes (Thai = 3 bytes/char). Keep slot maxLength 160 and don't duplicate answers in payload.
