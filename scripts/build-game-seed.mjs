// สร้าง supabase/seed_games.sql จาก supabase/games/games.json และ badges.json
// ใช้: node scripts/build-game-seed.mjs
// รันซ้ำได้ — เกม/เหรียญที่มีอยู่แล้วจะไม่ถูกทับ (ครูแก้ในหน้าแอดมินได้)
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const games = JSON.parse(readFileSync(join(root, 'supabase/games/games.json'), 'utf8'))
const badges = JSON.parse(readFileSync(join(root, 'supabase/games/badges.json'), 'utf8'))

const s = (v) => (v == null ? 'null' : `'${String(v).replace(/'/g, "''")}'`)
const j = (v) => `${s(JSON.stringify(v))}::jsonb`
const unit = (n) => (n == null ? 'null' : `(select id from public.units where no = ${n})`)

let sql = `-- =============================================================
-- Seed เกม ${games.length} เกม และเหรียญ ${badges.length} เหรียญ (สร้างอัตโนมัติ — ห้ามแก้ตรง)
-- แก้ supabase/games/*.json แล้วรัน: node scripts/build-game-seed.mjs
-- รันหลัง seed.sql
-- =============================================================

insert into public.games (slug, unit_id, title, description, config, max_score, max_xp, min_duration_sec)
values
`
sql += games
  .map((g) => `  (${s(g.slug)}, ${unit(g.unit)}, ${s(g.title)}, ${s(g.description)}, ${j(g.config)}, 100, ${g.max_xp}, ${g.min_duration_sec})`)
  .join(',\n')
sql += '\non conflict (slug) do nothing;\n\n'

sql += 'insert into public.badges (code, name, icon, rule)\nvalues\n'
sql += badges.map((b) => `  (${s(b.code)}, ${s(b.name)}, ${s(b.icon)}, ${j(b.rule)})`).join(',\n')
sql += '\non conflict (code) do nothing;\n'

writeFileSync(join(root, 'supabase/seed_games.sql'), sql)
console.log(`games: ${games.length}, badges: ${badges.length} -> supabase/seed_games.sql`)
