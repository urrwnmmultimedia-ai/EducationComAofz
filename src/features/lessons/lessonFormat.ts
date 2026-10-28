// รูปแบบเนื้อหาบทเรียน (Markdown + บล็อกพิเศษ)
//   "## หัวข้อ"          เริ่มการ์ดใหม่
//   ":::tip ... :::"     กล่องเกร็ดน่ารู้
//   ":::doctor ... :::"  กล่องด็อกเตอร์อธิบาย
//   ":::example ... :::" กล่องตัวอย่างใกล้ตัว
//   ":::think ... --- ... :::"  กล่องลองคิดดู: คำถาม แล้วบรรทัด "---" ตามด้วยแนวคิด (นักเรียนกดดูเอง)
//   ":::embed URL"       ฝังวิดีโอ YouTube หรือสไลด์ Canva (บรรทัดเดียว)

type CalloutKind = 'tip' | 'doctor' | 'example'

export type Segment =
  | { kind: 'markdown'; text: string }
  | { kind: CalloutKind; text: string }
  | { kind: 'think'; question: string; answer: string }
  | { kind: 'embed'; url: string; embedUrl: string | null }

export interface LessonCard {
  title: string
  segments: Segment[]
}

const CALLOUT_OPEN = /^:::(tip|doctor|example|think)\s*$/
const CALLOUT_CLOSE = /^:::\s*$/
const EMBED = /^:::embed\s+(\S+)\s*$/

function closeCallout(kind: CalloutKind | 'think', lines: string[]): Segment {
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
  let callout: { kind: CalloutKind | 'think'; lines: string[] } | null = null

  const flush = () => {
    const text = buf.join('\n').trim()
    if (text) out.push({ kind: 'markdown', text })
    buf = []
  }

  for (const line of md.replace(/\r\n/g, '\n').split('\n')) {
    if (callout) {
      if (CALLOUT_CLOSE.test(line.trim())) {
        out.push(closeCallout(callout.kind, callout.lines))
        callout = null
      } else {
        callout.lines.push(line)
      }
      continue
    }
    const open = CALLOUT_OPEN.exec(line.trim())
    if (open) {
      flush()
      callout = { kind: open[1] as CalloutKind | 'think', lines: [] }
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
  if (callout) out.push(closeCallout(callout.kind, callout.lines))
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
