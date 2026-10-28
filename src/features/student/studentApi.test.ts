import { describe, expect, it } from 'vitest'
import { dueCountdown } from './studentApi'

const now = new Date('2026-11-01T08:00:00Z')

describe('dueCountdown', () => {
  it('ไม่มีกำหนดส่ง', () => {
    expect(dueCountdown(null, now)).toBe('ไม่มีกำหนดส่ง')
  })
  it('นับเป็นวัน', () => {
    expect(dueCountdown('2026-11-03T09:00:00Z', now)).toBe('อีก 2 วัน')
  })
  it('นับเป็นชั่วโมง', () => {
    expect(dueCountdown('2026-11-01T13:30:00Z', now)).toBe('อีก 5 ชั่วโมง')
  })
  it('นับเป็นนาที', () => {
    expect(dueCountdown('2026-11-01T08:10:00Z', now)).toBe('อีก 10 นาที')
  })
  it('เลยกำหนด', () => {
    expect(dueCountdown('2026-10-31T07:00:00Z', now)).toBe('เลยกำหนด 1 วัน')
  })
})
