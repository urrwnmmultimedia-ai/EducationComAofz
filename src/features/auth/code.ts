export type CodeMode = 'student' | 'admin'

export type CodeCheck = { ok: true; value: string } | { ok: false; message: string }

// ตรวจรูปแบบเบื้องต้นก่อนส่งไปเซิร์ฟเวอร์ (การตรวจว่ารหัสถูกต้องทำใน RPC เท่านั้น)
export function checkCodeFormat(raw: string, mode: CodeMode, studentCodeLength: number): CodeCheck {
  const value = raw.trim()
  if (value.length === 0) {
    return { ok: false, message: mode === 'student' ? 'กรุณากรอกรหัสนักเรียน' : 'กรุณากรอกรหัสสำหรับครู' }
  }
  if (mode === 'student') {
    if (!/^[0-9]+$/.test(value)) return { ok: false, message: 'รหัสนักเรียนต้องเป็นตัวเลขเท่านั้น' }
    if (value.length !== studentCodeLength) {
      return { ok: false, message: `รหัสนักเรียนต้องมี ${studentCodeLength} หลัก` }
    }
  }
  if (value.length > 64) return { ok: false, message: 'รหัสยาวเกินไป' }
  return { ok: true, value }
}

// เก็บเฉพาะตัวเลข และไม่เกินความยาวที่กำหนด (ใช้ตอนพิมพ์ในช่องรหัสนักเรียน)
export function sanitizeStudentInput(raw: string, studentCodeLength: number): string {
  return raw.replace(/[^0-9]/g, '').slice(0, studentCodeLength)
}

export type LoginErrorCode = 'not_signed_in' | 'rate_limited' | 'not_found' | 'device_locked' | 'network'

export function loginErrorMessage(code: LoginErrorCode, retryAfterSec?: number): string {
  switch (code) {
    case 'not_found':
      return 'ไม่พบรหัสนักเรียนนี้ กรุณาติดต่อครู'
    case 'rate_limited': {
      const min = Math.max(1, Math.ceil((retryAfterSec ?? 300) / 60))
      return `กรอกรหัสผิดหลายครั้งเกินไป กรุณารออีกประมาณ ${min} นาทีแล้วลองใหม่`
    }
    case 'device_locked':
      return 'รหัสนี้ถูกใช้กับเครื่องอื่นอยู่ กรุณาแจ้งครูให้รีเซ็ตอุปกรณ์'
    case 'not_signed_in':
      return 'ระบบยังเตรียมตัวไม่เสร็จ ลองรีเฟรชหน้าเว็บอีกครั้ง'
    case 'network':
      return 'เชื่อมต่ออินเทอร์เน็ตไม่ได้ ตรวจสอบเน็ตแล้วลองใหม่'
  }
}
