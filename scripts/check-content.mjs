// กันเฉลยหลุดไปกับเว็บ: ไฟล์ใน src/content/ ต้องไม่มีคีย์ answer / correct / solution / key
// รันก่อน build ทุกครั้ง (ดู package.json) — พบคีย์ต้องห้าม = build ล้ม
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

export const FORBIDDEN_KEYS = ['answer', 'answers', 'correct', 'solution', 'solutions', 'key', 'keys']

const forbidden = new Set(FORBIDDEN_KEYS)

// คืนรายการ "พาธ.ของ.คีย์" ที่ผิดกฎใน object หนึ่ง
export function findForbiddenKeys(value, path = '$') {
  if (Array.isArray(value)) return value.flatMap((v, i) => findForbiddenKeys(v, `${path}[${i}]`))
  if (value === null || typeof value !== 'object') return []
  return Object.entries(value).flatMap(([k, v]) => [
    ...(forbidden.has(k.toLowerCase()) ? [`${path}.${k}`] : []),
    ...findForbiddenKeys(v, `${path}.${k}`),
  ])
}

// ไฟล์ .md/.mdx/.yaml: หาคีย์แบบ frontmatter/object literal เช่น `answer:` หรือ {"correct": …}
// (ตัวพิมพ์เล็ก ต้นบรรทัดหรือหลัง { , เท่านั้น — ข้อความบทเรียนอย่าง "Primary Key: …" ไม่โดน)
const TEXT_KEY_RE = new RegExp(`(^\\s*-?\\s*|[{,]\\s*)["']?(${FORBIDDEN_KEYS.join('|')})["']?\\s*:`)

export function checkFile(file, text) {
  if (file.endsWith('.json')) {
    return findForbiddenKeys(JSON.parse(text)).map((p) => `${file}: ${p}`)
  }
  return text
    .split(/\r?\n/)
    .flatMap((line, i) => (TEXT_KEY_RE.test(line) ? [`${file}:${i + 1}: ${line.trim()}`] : []))
}

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name)
    return statSync(full).isDirectory() ? walk(full) : [full]
  })
}

export function checkContentDir(dir) {
  return walk(dir)
    .filter((f) => /\.(json|mdx?|ya?ml)$/.test(f))
    .flatMap((f) => checkFile(relative(process.cwd(), f), readFileSync(f, 'utf8')))
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const dir = fileURLToPath(new URL('../src/content', import.meta.url))
  const problems = checkContentDir(dir)
  if (problems.length > 0) {
    console.error('✖ พบคีย์เฉลยในไฟล์เนื้อหา (src/content) — ย้ายไปไว้ที่ supabase/seed/answer_keys.sql:')
    for (const p of problems) console.error('  ' + p)
    process.exit(1)
  }
  console.log('✔ src/content ไม่มีคีย์เฉลย')
}
