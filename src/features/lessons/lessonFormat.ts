// รูปแบบเนื้อหาบทเรียน (Markdown + บล็อกพิเศษ)
//   "## หัวข้อ"          เริ่มการ์ดใหม่
//   ":::tip ... :::"     กล่องเกร็ดน่ารู้
//   ":::doctor ... :::"  กล่องด็อกเตอร์อธิบาย
//   ":::example ... :::" กล่องตัวอย่างใกล้ตัว
//   ":::think ... --- ... :::"  กล่องลองคิดดู: คำถาม แล้วบรรทัด "---" ตามด้วยแนวคิด (นักเรียนกดดูเอง)
//   ":::embed URL"       ฝังวิดีโอ YouTube หรือสไลด์ Canva (บรรทัดเดียว)
//   ":::check ... :::"   เช็กความเข้าใจท้ายการ์ด: คำถาม แล้วตัวเลือก "- [ ] ผิด" / "- [x] ถูก" (ถูกได้ข้อเดียว)
//                        ตามด้วยบรรทัด "---" และคำอธิบายเฉลย (ไม่บังคับ)
// บล็อกภาพเคลื่อนไหว/กิจกรรม (บรรทัดแรกที่ไม่ขึ้นต้นด้วย "- " = คำชี้แจง ไม่บังคับ):
//   ":::flow [cycle]"    แผนภาพลำดับขั้นมีลูกศรวิ่ง กดดูทีละกล่อง:  "- ไอคอน | ชื่อ | คำอธิบาย"  (cycle = วนกลับขั้นแรก)
//   ":::sort"            เกมจัดกลุ่ม: บรรทัด "กลุ่ม: ก | ข | ค" แล้ว "- ข้อความ => กลุ่ม"
//   ":::order"           เกมเรียงลำดับ: "- ขั้นที่ 1" "- ขั้นที่ 2" … (เขียนตามลำดับที่ถูก ระบบสลับให้เอง)
//   ":::flip"            การ์ดพลิก: "- ด้านหน้า | ด้านหลัง"
//   ":::timeline"        เส้นเวลาเลื่อนดูได้: "- ไอคอน | ชื่อ | ช่วงเวลา | คำอธิบาย"
//   ":::bars หน่วย [log]" กราฟแท่งให้ทายก่อนดูผล: "- ชื่อ | ตัวเลข | ข้อความที่แสดง (ไม่บังคับ)"  (log = สเกลลอการิทึม)
//   ":::widget ชื่อ"      สื่อโต้ตอบเฉพาะเรื่อง (บรรทัดเดียว) ดูรายชื่อใน LessonWidgets.tsx

type CalloutKind = 'tip' | 'doctor' | 'example'
type ActivityKind = 'flow' | 'sort' | 'order' | 'flip' | 'timeline' | 'bars'
type BlockKind = CalloutKind | 'think' | 'check' | ActivityKind

export interface FlowNode {
  icon: string
  label: string
  detail: string
}
export interface TimelineEvent {
  icon: string
  label: string
  when: string
  detail: string
}

export type Segment =
  | { kind: 'markdown'; text: string }
  | { kind: CalloutKind; text: string }
  | { kind: 'think'; question: string; answer: string }
  | { kind: 'embed'; url: string; embedUrl: string | null }
  | { kind: 'check'; question: string; choices: string[]; correct: number; explain: string }
  | { kind: 'flow'; prompt: string; cycle: boolean; nodes: FlowNode[] }
  | { kind: 'sort'; prompt: string; groups: string[]; items: { text: string; group: number }[] }
  | { kind: 'order'; prompt: string; items: string[] }
  | { kind: 'flip'; prompt: string; cards: { front: string; back: string }[] }
  | { kind: 'timeline'; prompt: string; events: TimelineEvent[] }
  | { kind: 'bars'; prompt: string; unit: string; log: boolean; bars: { label: string; value: number; text: string }[] }
  | { kind: 'widget'; name: string }

export interface LessonCard {
  title: string
  segments: Segment[]
}

const CALLOUT_OPEN = /^:::(tip|doctor|example|think|check|flow|sort|order|flip|timeline|bars)(?:\s+(.*?))?\s*$/
const CALLOUT_CLOSE = /^:::\s*$/
const EMBED = /^:::embed\s+(\S+)\s*$/
const WIDGET = /^:::widget\s+([a-z0-9-]+)\s*$/

const CHOICE = /^\s*-\s*\[( |x|X)\]\s+(.+)$/
const BULLET = /^\s*-\s+(.+)$/
const GROUPS = /^\s*กลุ่ม\s*:\s*(.+)$/

// แยกคำชี้แจง (บรรทัดที่ไม่ใช่รายการ) กับรายการ "- …" ของบล็อกกิจกรรม
function splitList(lines: string[]): { prompt: string; items: string[] } {
  const prompt: string[] = []
  const items: string[] = []
  for (const l of lines) {
    const m = BULLET.exec(l)
    if (m) items.push(m[1]?.trim() ?? '')
    else if (items.length === 0) prompt.push(l)
  }
  return { prompt: prompt.join('\n').trim(), items }
}

const cells = (item: string) => item.split('|').map((c) => c.trim())

// บล็อกกิจกรรมที่เขียนผิดรูปแบบ แสดงเป็นข้อความธรรมดาแทน ไม่ให้หน้าเรียนพัง
function closeActivity(kind: ActivityKind, args: string, lines: string[]): Segment {
  const fallback: Segment = { kind: 'markdown', text: lines.join('\n').trim() }
  if (kind === 'sort') {
    const gi = lines.findIndex((l) => GROUPS.test(l))
    const groups = gi >= 0 ? cells(GROUPS.exec(lines[gi] ?? '')?.[1] ?? '').filter(Boolean) : []
    const { prompt, items } = splitList(lines.filter((_, i) => i !== gi))
    const parsed = items.flatMap((it) => {
      const at = it.lastIndexOf('=>')
      if (at < 0) return []
      const group = groups.indexOf(it.slice(at + 2).trim())
      return group >= 0 ? [{ text: it.slice(0, at).trim(), group }] : []
    })
    return groups.length >= 2 && parsed.length >= 2 ? { kind, prompt, groups, items: parsed } : fallback
  }
  const { prompt, items } = splitList(lines)
  switch (kind) {
    case 'flow': {
      const nodes = items.map((it) => {
        const [icon = '', label = '', ...rest] = cells(it)
        return { icon, label, detail: rest.join(' | ') }
      })
      return nodes.length >= 2 ? { kind, prompt, cycle: /\bcycle\b/.test(args), nodes } : fallback
    }
    case 'order':
      return items.length >= 2 ? { kind, prompt, items } : fallback
    case 'flip': {
      const cards = items.flatMap((it) => {
        const [front = '', ...rest] = cells(it)
        return front && rest.length ? [{ front, back: rest.join(' | ') }] : []
      })
      return cards.length >= 1 ? { kind, prompt, cards } : fallback
    }
    case 'timeline': {
      const events = items.map((it) => {
        const [icon = '', label = '', when = '', ...rest] = cells(it)
        return { icon, label, when, detail: rest.join(' | ') }
      })
      return events.length >= 2 ? { kind, prompt, events } : fallback
    }
    case 'bars': {
      const log = /\blog\b/.test(args)
      const unit = args.replace(/\blog\b/, '').trim()
      const bars = items.flatMap((it) => {
        const [label = '', raw = '', text = ''] = cells(it)
        const value = Number(raw.replace(/,/g, ''))
        return label && Number.isFinite(value) && value >= 0 && (!log || value > 0) ? [{ label, value, text }] : []
      })
      return bars.length >= 2 ? { kind, prompt, unit, log, bars } : fallback
    }
  }
}

function closeCallout(kind: BlockKind, lines: string[], args = ''): Segment {
  if (kind === 'flow' || kind === 'sort' || kind === 'order' || kind === 'flip' || kind === 'timeline' || kind === 'bars') {
    return closeActivity(kind, args, lines)
  }
  if (kind === 'check') {
    const sep = lines.findIndex((l) => l.trim() === '---')
    const body = sep >= 0 ? lines.slice(0, sep) : lines
    const question: string[] = []
    const choices: string[] = []
    let correct = -1
    for (const l of body) {
      const m = CHOICE.exec(l)
      if (!m) {
        if (choices.length === 0) question.push(l)
        continue
      }
      if (m[1] !== ' ' && correct < 0) correct = choices.length
      choices.push(m[2]?.trim() ?? '')
    }
    // เขียนผิดรูปแบบ (ไม่มีตัวเลือก/ไม่มีข้อถูก) แสดงเป็นกล่องลองคิดดูแทน ไม่ให้หน้าเรียนพัง
    if (choices.length < 2 || correct < 0) return { kind: 'think', question: body.join('\n').trim(), answer: '' }
    const explain = sep >= 0 ? lines.slice(sep + 1).join('\n').trim() : ''
    return { kind: 'check', question: question.join('\n').trim(), choices, correct, explain }
  }
  if (kind === 'think') {
    const sep = lines.findIndex((l) => l.trim() === '---')
    const q = sep >= 0 ? lines.slice(0, sep) : lines
    const a = sep >= 0 ? lines.slice(sep + 1) : []
    return { kind: 'think', question: q.join('\n').trim(), answer: a.join('\n').trim() }
  }
  return { kind, text: lines.join('\n').trim() }
}

export function parseSegments(md: string): Segment[] {
  const out: Segment[] = []
  let buf: string[] = []
  let callout: { kind: BlockKind; args: string; lines: string[] } | null = null

  const flush = () => {
    const text = buf.join('\n').trim()
    if (text) out.push({ kind: 'markdown', text })
    buf = []
  }

  for (const line of md.replace(/\r\n/g, '\n').split('\n')) {
    if (callout) {
      if (CALLOUT_CLOSE.test(line.trim())) {
        out.push(closeCallout(callout.kind, callout.lines, callout.args))
        callout = null
      } else {
        callout.lines.push(line)
      }
      continue
    }
    const open = CALLOUT_OPEN.exec(line.trim())
    if (open) {
      flush()
      callout = { kind: open[1] as BlockKind, args: open[2] ?? '', lines: [] }
      continue
    }
    const widget = WIDGET.exec(line.trim())
    if (widget) {
      flush()
      out.push({ kind: 'widget', name: widget[1] ?? '' })
      continue
    }
    const embed = EMBED.exec(line.trim())
    if (embed) {
      flush()
      const url = embed[1] ?? ''
      out.push({ kind: 'embed', url, embedUrl: toEmbedUrl(url) })
      continue
    }
    buf.push(line)
  }
  // กล่องที่ลืมปิด ให้ถือว่าจบที่ท้ายเนื้อหา
  if (callout) out.push(closeCallout(callout.kind, callout.lines, callout.args))
  flush()
  return out
}

// แบ่งเนื้อหาเป็นการ์ดตามหัวข้อ "## "
export function splitCards(md: string, fallbackTitle: string): LessonCard[] {
  const cards: { title: string; lines: string[] }[] = []
  let current: { title: string; lines: string[] } | null = null
  let inCallout = false

  for (const line of md.replace(/\r\n/g, '\n').split('\n')) {
    const t = line.trim()
    if (CALLOUT_OPEN.test(t)) inCallout = true
    else if (inCallout && CALLOUT_CLOSE.test(t)) inCallout = false

    const heading = !inCallout && /^##\s+(.+)$/.exec(t)
    if (heading) {
      current = { title: heading[1]?.trim() ?? '', lines: [] }
      cards.push(current)
      continue
    }
    if (!current) {
      if (t === '') continue
      current = { title: fallbackTitle, lines: [] }
      cards.push(current)
    }
    current.lines.push(line)
  }

  return cards
    .map((c) => ({ title: c.title, segments: parseSegments(c.lines.join('\n')) }))
    .filter((c) => c.segments.length > 0 || c.title)
}

// รับเฉพาะ YouTube และ Canva เพื่อไม่ให้ฝังเว็บอื่นในหน้าเรียน
export function toEmbedUrl(raw: string): string | null {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return null
  }
  if (url.protocol !== 'https:') return null
  const host = url.hostname.replace(/^www\./, '').replace(/^m\./, '')

  if (host === 'youtu.be') {
    const id = url.pathname.slice(1).split('/')[0] ?? ''
    return isYoutubeId(id) ? `https://www.youtube-nocookie.com/embed/${id}` : null
  }
  if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    let id = url.searchParams.get('v') ?? ''
    const m = /^\/(?:embed|shorts|live)\/([^/?]+)/.exec(url.pathname)
    if (m?.[1]) id = m[1]
    return isYoutubeId(id) ? `https://www.youtube-nocookie.com/embed/${id}` : null
  }
  if (host === 'canva.com') {
    const m = /^\/design\/([A-Za-z0-9_-]+)\/([A-Za-z0-9_-]+)\//.exec(url.pathname)
    return m ? `https://www.canva.com/design/${m[1]}/${m[2]}/view?embed` : null
  }
  return null
}

function isYoutubeId(id: string): boolean {
  return /^[A-Za-z0-9_-]{11}$/.test(id)
}
