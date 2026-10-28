const KEY = 'tech-m3-device-key'

// รหัสประจำเบราว์เซอร์ที่คงอยู่แม้ออกจากระบบ ใช้กับตัวเลือก "ล็อกอุปกรณ์"
export function getDeviceKey(): string {
  try {
    const existing = localStorage.getItem(KEY)
    if (existing) return existing
    const created = crypto.randomUUID()
    localStorage.setItem(KEY, created)
    return created
  } catch {
    return ''
  }
}
