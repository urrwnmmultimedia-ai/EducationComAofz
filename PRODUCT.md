# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Students, ม.3 (lower secondary, ~14–15 y/o):** study the Technology (Design & Technology) course in class, session by session. Log in with their student code only, no password.
- **Students, ม.5 (upper secondary, ~16–17 y/o):** study the database course "DB Quest" at their own pace inside class; unlock sessions as they finish the previous one.
- **The teacher (one teacher runs both courses):** opens/closes sessions per classroom, grades worksheets, keeps the gradebook, previews student pages, edits M.3 content.
- Devices are a real mix during class: school lab computers, tablets, and students' own phones. Every student surface must work equally well on a phone and a desktop.

## Product Purpose

A gamified LMS where a Thai secondary-school class learns a whole course inside one website: each 2-hour session runs as a fixed 6-step flow (warm-up → lesson → practice → game → worksheet/task → wrap-up), with games, worksheets, exams, XP, levels, badges and a leaderboard. Success = students finish sessions on their own during class and the teacher can see progress and grades without paperwork.

## Positioning

One teacher's own classroom platform, not a generic LMS: course content, answer keys, games and grading are built for the exact Thai curriculum (สสวท. 2560) and the teacher's 20-session plans. Answer keys never ship to the browser; the server checks every answer.

## Operating Context

- Used live during class periods on school Wi-Fi; teacher projects some pages on a projector.
- Login: student code → device-bound session; teacher uses a teacher code and can preview the student side.
- Two courses share one login and one backend (Supabase), routed by the student's classroom: ม.3 → `/home`, `/sessions/:no`… ; ม.5 DB Quest → `/db/*`; teacher → `/admin/*` and `/db/admin/*`.
- Teacher exports gradebooks to Excel (ปพ.5).

## Capabilities and Constraints

- Stack: React + Vite + TypeScript, Tailwind CSS v4, Supabase, deployed on Vercel. Thai-first UI.
- ม.3: 3 units / 20 sessions, lessons in Markdown, 18 games, exit tickets, exams, gradebook (no attendance tracking).
- ม.5 DB Quest: 7 units / 20 sessions, JSON session content, server-checked questions, memory-match games, worksheets, scoring by weighted categories, teacher back office.
- Content after DB Quest session 2 is still to be written; UI must handle "content coming soon" states.
- DB Quest already has light/dark mode; the M.3 site is light only today.

## Brand Commitments

- Parent brand: **TechQuest**. The two courses are sub-brands under it: "ห้องเรียนเทคโนโลยี ม.3" (Design & Technology) and "DB Quest" (ม.5 databases), told apart by a per-course accent inside one shared visual language.
- Keep the mascots: น้องดาต้า (DB Quest) and the M.3 characters (Non and friends in `src/components/characters`).
- Keep and feature the XP / level / badge / leaderboard system.
- School name and logo must appear; the teacher will supply them later (leave a single config spot, never invent a name or logo).

## Evidence on Hand

- Mascot SVG components: `src/components/illustrations/NongData.tsx`, `src/components/characters/Characters.tsx`.
- Real course structure: `src/content/units/course.json` (DB Quest), M.3 lessons in `supabase/lessons/*.md`.
- No testimonials, school logo, photography, or school name yet — do not fabricate them.

## Product Principles

1. A student should always know the one next thing to do in the current session.
2. Progress is felt, not just counted: XP, stars and unlocks are celebrated, but never block learning.
3. Same grammar for both courses, so a teacher and siblings in different grades feel at home on either.
4. The teacher's tools optimize for speed during class: scan, act, move on.
5. Answers stay on the server; nothing on screen leaks them.

## Accessibility & Inclusion

Thai text throughout (needs generous line-height for tone marks), readable on low-end phones and projected screens, large touch targets for younger students, works without relying on color alone for status.
