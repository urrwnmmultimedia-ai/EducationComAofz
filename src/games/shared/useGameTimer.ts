import { useEffect, useRef, useState } from 'react'

// นับเวลาถอยหลัง (วินาที) — reset เมื่อ resetKey เปลี่ยน; เรียก onExpire ครั้งเดียวเมื่อเหลือ 0
export function useCountdown(seconds: number | undefined, onExpire: () => void, resetKey: unknown, paused = false) {
  const [left, setLeft] = useState(seconds ?? 0)
  const expire = useRef(onExpire)
  expire.current = onExpire

  useEffect(() => {
    setLeft(seconds ?? 0)
  }, [seconds, resetKey])

  useEffect(() => {
    if (!seconds || paused) return
    if (left <= 0) {
      expire.current()
      return
    }
    const id = setTimeout(() => setLeft((s) => s - 1), 1000)
    return () => clearTimeout(id)
  }, [left, seconds, paused])

  return seconds ? left : null
}

// เวลาที่เล่นจริง (ส่งไปตรวจขั้นต่ำที่เซิร์ฟเวอร์)
export function useElapsed(running: boolean) {
  const start = useRef<number | null>(null)
  useEffect(() => {
    if (running && start.current == null) start.current = Date.now()
    if (!running) start.current = null
  }, [running])
  return () => (start.current == null ? 0 : Math.round((Date.now() - start.current) / 1000))
}
