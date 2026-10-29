// แยกชนิดข้อผิดพลาดตอนต่อระบบ เพื่อแก้ให้ถูกทาง
//   busy   = Supabase จำกัดจำนวนครั้งต่อ IP (ทั้งห้องใช้เน็ตโรงเรียน IP เดียวกัน เข้าพร้อมกันหลายเครื่องจะชนเพดาน) → รอแล้วลองใหม่
//   auth   = session ในเบราว์เซอร์หมดอายุ/เสีย (refresh token ใช้ไม่ได้) → ล้าง session ในเครื่องแล้วขอใหม่
//   network = เน็ตหลุด/เซิร์ฟเวอร์ไม่ตอบ → ลองใหม่สั้น ๆ
export type ConnectionProblem = 'busy' | 'auth' | 'network'

interface ErrLike {
  status?: number
  code?: string
  message?: string
  name?: string
}

export function classifyError(err: unknown): ConnectionProblem {
  const e = (typeof err === 'object' && err !== null ? err : {}) as ErrLike
  const msg = `${e.message ?? ''} ${e.code ?? ''} ${e.name ?? ''}`.toLowerCase()
  if (e.status === 429 || msg.includes('rate limit') || msg.includes('too many requests') || msg.includes('over_request_rate_limit')) return 'busy'
  if (
    e.status === 401 ||
    e.code === 'PGRST301' ||
    e.code === 'PGRST303' ||
    msg.includes('jwt') ||
    msg.includes('refresh token') ||
    msg.includes('refresh_token') ||
    msg.includes('session_not_found') ||
    msg.includes('invalid claim') ||
    msg.includes('authsessionmissing')
  ) {
    return 'auth'
  }
  return 'network'
}

// หน่วงก่อนลองใหม่ครั้งที่ n (เริ่ม 0): busy รอนานกว่า และสุ่มเพิ่มนิดหน่อยกันทุกเครื่องยิงพร้อมกันอีก
export function retryDelayMs(problem: ConnectionProblem, attempt: number, random: () => number = Math.random): number {
  const base = problem === 'busy' ? 8000 : 1000
  const capped = Math.min(base * 2 ** attempt, problem === 'busy' ? 60000 : 8000)
  return Math.round(capped * (0.75 + random() * 0.5))
}

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))
