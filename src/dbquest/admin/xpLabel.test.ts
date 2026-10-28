import { describe, expect, it } from 'vitest'
import { xpLabel } from './xpLabel'

describe('ข้อความแหล่ง XP', () => {
  it('แปลงทุกรูปแบบที่เซิร์ฟเวอร์บันทึก', () => {
    expect(xpLabel('step:1:lesson')).toBe('คาบ 1 · ทำขั้น "บทเรียน" เสร็จ')
    expect(xpLabel('step:2:warmup')).toBe('คาบ 2 · ทำขั้น "เปิดคาบ" เสร็จ')
    expect(xpLabel('session:1')).toBe('คาบ 1 · เรียนครบทุกขั้น')
    expect(xpLabel('item:s01-c2-q')).toBe('คาบ 1 · ตอบถูก เช็กความเข้าใจการ์ด 2')
    expect(xpLabel('item:s02-p3')).toBe('คาบ 2 · ตอบถูก ฝึกปฏิบัติข้อ 3')
    expect(xpLabel('game:memory-match:star2', { 'memory-match': '🃏 Memory Match' })).toBe('🃏 Memory Match · ได้ดาวที่ 2')
    expect(xpLabel('game:memory-match:star2')).toBe('memory-match · ได้ดาวที่ 2')
    expect(xpLabel('worksheet:ws-s01')).toBe('คาบ 1 · ส่งใบงาน')
  })

  it('รูปแบบที่ไม่รู้จัก แสดงตามเดิม', () => {
    expect(xpLabel('bonus')).toBe('bonus')
    expect(xpLabel('item:q-u1-01')).toBe('ตอบถูก q-u1-01')
  })
})
