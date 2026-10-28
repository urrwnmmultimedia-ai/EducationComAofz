import { describe, expect, it } from 'vitest'
import { parseSegments, splitCards, toEmbedUrl } from './lessonFormat'

describe('parseSegments', () => {
  it('แยก markdown กับกล่อง tip/doctor', () => {
    const segs = parseSegments('ย่อหน้า\n\n:::tip\nเกร็ด\n:::\nต่อ\n:::doctor\nอธิบาย\n:::')
    expect(segs).toEqual([
      { kind: 'markdown', text: 'ย่อหน้า' },
      { kind: 'tip', text: 'เกร็ด' },
      { kind: 'markdown', text: 'ต่อ' },
      { kind: 'doctor', text: 'อธิบาย' },
    ])
  })
  it('กล่องที่ลืมปิดยังแสดงได้', () => {
    expect(parseSegments(':::tip\nไม่ได้ปิด')).toEqual([{ kind: 'tip', text: 'ไม่ได้ปิด' }])
  })
  it('embed YouTube', () => {
    const [seg] = parseSegments(':::embed https://youtu.be/dQw4w9WgXcQ')
    expect(seg).toEqual({
      kind: 'embed',
      url: 'https://youtu.be/dQw4w9WgXcQ',
      embedUrl: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
    })
  })
})

describe('splitCards', () => {
  it('แบ่งการ์ดตาม ## และเนื้อหาก่อนหัวข้อใช้ชื่อสำรอง', () => {
    const cards = splitCards('นำ\n## A\nเนื้อ A\n## B\n:::tip\n## ไม่ใช่หัวข้อ\n:::', 'บทเรียน')
    expect(cards.map((c) => c.title)).toEqual(['บทเรียน', 'A', 'B'])
    expect(cards[2]?.segments[0]).toEqual({ kind: 'tip', text: '## ไม่ใช่หัวข้อ' })
  })
  it('เนื้อหาว่างได้ 0 การ์ด', () => {
    expect(splitCards('  \n', 'x')).toEqual([])
  })
})

describe('toEmbedUrl', () => {
  it.each([
    ['https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ'],
    ['https://youtube.com/shorts/dQw4w9WgXcQ', 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ'],
    ['https://www.canva.com/design/DAF123abc/XyZ987/view', 'https://www.canva.com/design/DAF123abc/XyZ987/view?embed'],
  ])('%s', (input, expected) => {
    expect(toEmbedUrl(input)).toBe(expected)
  })
  it.each(['http://youtube.com/watch?v=dQw4w9WgXcQ', 'https://evil.example/embed', 'not a url', 'https://youtube.com/watch?v=short'])(
    'ปฏิเสธ %s',
    (input) => {
      expect(toEmbedUrl(input)).toBeNull()
    },
  )
})
