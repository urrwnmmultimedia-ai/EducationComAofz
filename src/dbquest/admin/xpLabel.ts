import { course } from '@/content/course'

// แปลงรหัสแหล่ง XP (dbq_xp_events.source) เป็นข้อความที่ครูอ่านได้
//   step:1:lesson · session:1 · item:s01-c2-q · item:s01-p1 · game:memory-match:star2 · worksheet:ws-s01

const STEP_TITLE: Record<string, string> = Object.fromEntries(course.steps.map((s) => [s.id, s.title]))

export function xpLabel(source: string): string {
  const [kind, a = '', b = ''] = source.split(':')
  switch (kind) {
    case 'step':
      return `คาบ ${a} · ทำขั้น "${STEP_TITLE[b] ?? b}" เสร็จ`
    case 'session':
      return `คาบ ${a} · เรียนครบทุกขั้น`
    case 'item': {
      const m = /^s(\d+)-(?:c(\d+)-q|p(\d+))$/.exec(a)
      if (!m) return `ตอบถูก ${a}`
      const no = Number(m[1])
      return m[2] ? `คาบ ${no} · ตอบถูก เช็กความเข้าใจการ์ด ${m[2]}` : `คาบ ${no} · ตอบถูก ฝึกปฏิบัติข้อ ${m[3]}`
    }
    case 'game': {
      const star = /^star(\d)$/.exec(b)
      return star ? `เกม ${a} · ได้ดาวที่ ${star[1]}` : `เกม ${a}`
    }
    case 'worksheet': {
      const m = /^ws-s(\d+)$/.exec(a)
      return m ? `คาบ ${Number(m[1])} · ส่งใบงาน` : `ส่งใบงาน ${a}`
    }
    default:
      return source
  }
}
