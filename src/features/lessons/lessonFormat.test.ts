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
  it('กล่องลองคิดดู แยกคำถามกับแนวคิดด้วย ---', () => {
    expect(parseSegments(':::think\nทำไม?\n---\nเพราะ\nอธิบาย\n:::')).toEqual([
      { kind: 'think', question: 'ทำไม?', answer: 'เพราะ\nอธิบาย' },
    ])
  })
  it('กล่องลองคิดดูไม่มีแนวคิด และกล่องตัวอย่าง', () => {
    expect(parseSegments(':::think\nคิดเอง\n:::\n:::example\nร้านข้างบ้าน\n:::')).toEqual([
      { kind: 'think', question: 'คิดเอง', answer: '' },
      { kind: 'example', text: 'ร้านข้างบ้าน' },
    ])
  })
  it('ตาราง markdown (| --- |) ในกล่องลองคิดดูไม่ถูกตัดเป็นแนวคิด', () => {
    const [seg] = parseSegments(':::think\n| a | b |\n| --- | --- |\n---\nตอบ\n:::')
    expect(seg).toEqual({ kind: 'think', question: '| a | b |\n| --- | --- |', answer: 'ตอบ' })
  })
  it('กล่องเช็กความเข้าใจ: คำถาม ตัวเลือก ข้อถูก และคำอธิบาย', () => {
    expect(parseSegments(':::check\nข้อใดคือ Input\n- [ ] จอภาพ\n- [x] คีย์บอร์ด\n- [ ] ลำโพง\n---\nคีย์บอร์ดรับข้อมูลเข้า\n:::')).toEqual([
      { kind: 'check', question: 'ข้อใดคือ Input', choices: ['จอภาพ', 'คีย์บอร์ด', 'ลำโพง'], correct: 1, explain: 'คีย์บอร์ดรับข้อมูลเข้า' },
    ])
  })
  it('กล่องเช็กความเข้าใจที่ไม่มีข้อถูก แสดงเป็นกล่องลองคิดดูแทน', () => {
    expect(parseSegments(':::check\nถาม\n- [ ] ก\n- [ ] ข\n:::')).toEqual([{ kind: 'think', question: 'ถาม\n- [ ] ก\n- [ ] ข', answer: '' }])
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

describe('บล็อกภาพเคลื่อนไหว/กิจกรรม', () => {
  it('flow: ไอคอน | ชื่อ | คำอธิบาย และ cycle', () => {
    expect(parseSegments(':::flow cycle\nดูการทำงาน\n- 🗑️ | เซนเซอร์ | วัดขยะ\n- 🚛 | รถ | ไปเก็บ\n:::')).toEqual([
      {
        kind: 'flow',
        prompt: 'ดูการทำงาน',
        cycle: true,
        nodes: [
          { icon: '🗑️', label: 'เซนเซอร์', detail: 'วัดขยะ' },
          { icon: '🚛', label: 'รถ', detail: 'ไปเก็บ' },
        ],
      },
    ])
  })
  it('sort: กลุ่ม และข้อความ => กลุ่ม (ข้อที่กลุ่มไม่ตรงถูกตัดทิ้ง)', () => {
    const [seg] = parseSegments(':::sort\nจัดกลุ่ม\nกลุ่ม: เร็ว | หน่วงต่ำ\n- ดูหนัง 4K => เร็ว\n- รถเบรก => หน่วงต่ำ\n- ผิด => ไม่มีกลุ่มนี้\n:::')
    expect(seg).toEqual({
      kind: 'sort',
      prompt: 'จัดกลุ่ม',
      groups: ['เร็ว', 'หน่วงต่ำ'],
      items: [
        { text: 'ดูหนัง 4K', group: 0 },
        { text: 'รถเบรก', group: 1 },
      ],
    })
  })
  it('order / flip / timeline / bars', () => {
    expect(parseSegments(':::order\n- ก\n- ข\n:::')).toEqual([{ kind: 'order', prompt: '', items: ['ก', 'ข'] }])
    expect(parseSegments(':::flip\n- หน้า | หลัง\n:::')).toEqual([{ kind: 'flip', prompt: '', cards: [{ front: 'หน้า', back: 'หลัง' }] }])
    expect(parseSegments(':::timeline\n- 📞 | 1G | 1980 | โทร\n- ✉️ | 2G | 1990 | SMS\n:::')[0]).toMatchObject({ kind: 'timeline', events: [{ label: '1G', when: '1980' }, { label: '2G' }] })
    expect(parseSegments(':::bars Mbps log\n- 3G | 2\n- 4G | 1,000 | 1 Gbps\n:::')).toEqual([
      { kind: 'bars', prompt: '', unit: 'Mbps', log: true, bars: [{ label: '3G', value: 2, text: '' }, { label: '4G', value: 1000, text: '1 Gbps' }] },
    ])
  })
  it('widget บรรทัดเดียว', () => {
    expect(parseSegments('ก่อน\n:::widget latency-brake\nหลัง')).toEqual([
      { kind: 'markdown', text: 'ก่อน' },
      { kind: 'widget', name: 'latency-brake' },
      { kind: 'markdown', text: 'หลัง' },
    ])
  })
  it('เขียนผิดรูปแบบ แสดงเป็นข้อความธรรมดา', () => {
    expect(parseSegments(':::sort\nไม่มีกลุ่ม\n- ก => ข\n:::')).toEqual([{ kind: 'markdown', text: 'ไม่มีกลุ่ม\n- ก => ข' }])
  })
  it('หัวข้อ ## ในบล็อกกิจกรรมไม่ตัดการ์ด', () => {
    expect(splitCards('## A\n:::order\n## ไม่ใช่หัวข้อ\n- ก\n- ข\n:::', 'x')).toHaveLength(1)
  })
})
