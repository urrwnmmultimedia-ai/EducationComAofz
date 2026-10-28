// รวม migration ทั้งหมด + seed ทั้งหมด เป็นไฟล์เดียว supabase/setup_all.sql
// สำหรับโปรเจกต์ Supabase ใหม่: เปิด SQL Editor → วางทั้งไฟล์ → Run ครั้งเดียวจบ
// ใช้: node scripts/build-setup-sql.mjs (หรือ npm run seed:build)
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dir = join(root, 'supabase/migrations')
const parts = [
  ...readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((f) => [`migrations/${f}`, readFileSync(join(dir, f), 'utf8')]),
  ...['seed.sql', 'seed_questions.sql', 'seed_games.sql'].map((f) => [f, readFileSync(join(root, 'supabase', f), 'utf8')]),
]

const out =
  `-- =============================================================
-- ติดตั้งฐานข้อมูลทั้งหมดในครั้งเดียว (สร้างอัตโนมัติ — ห้ามแก้ตรง)
-- ใช้กับโปรเจกต์ Supabase ที่ยังว่างเท่านั้น
-- ถ้าเคยติดตั้งแล้วและมี migration ใหม่ ให้รันเฉพาะไฟล์ใหม่ใน supabase/migrations/
-- =============================================================

` + parts.map(([name, sql]) => `-- >>>>>>>>>> ${name}\n${sql.trim()}\n`).join('\n')

writeFileSync(join(root, 'supabase/setup_all.sql'), out)
console.log(`setup_all.sql: ${parts.length} parts, ${(out.length / 1024).toFixed(0)} KB`)
