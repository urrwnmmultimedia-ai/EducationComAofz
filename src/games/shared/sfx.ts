import { useCallback, useEffect, useRef, useState } from 'react'

export interface Sfx {
  enabled: boolean
  toggle: () => void
  correct: () => void
  wrong: () => void
  tick: () => void
  win: () => void
}

const KEY = 'tech-m3-sfx'

// เสียงเอฟเฟกต์สังเคราะห์ด้วย Web Audio (ไม่ต้องโหลดไฟล์เสียง) ปิดได้และจำค่าไว้
export function useSfx(): Sfx {
  const [enabled, setEnabled] = useState(() => {
    try {
      return localStorage.getItem(KEY) !== 'off'
    } catch {
      return true
    }
  })
  const ctx = useRef<AudioContext | null>(null)

  useEffect(() => {
    try {
      localStorage.setItem(KEY, enabled ? 'on' : 'off')
    } catch {
      // เบราว์เซอร์บล็อก storage — ใช้ค่าในหน่วยความจำต่อ
    }
  }, [enabled])

  useEffect(() => () => void ctx.current?.close().catch(() => undefined), [])

  const play = useCallback(
    (notes: [number, number][], type: OscillatorType = 'sine') => {
      if (!enabled) return
      try {
        ctx.current ??= new AudioContext()
        const ac = ctx.current
        let t = ac.currentTime
        for (const [freq, dur] of notes) {
          const osc = ac.createOscillator()
          const gain = ac.createGain()
          osc.type = type
          osc.frequency.value = freq
          gain.gain.setValueAtTime(0.15, t)
          gain.gain.exponentialRampToValueAtTime(0.001, t + dur)
          osc.connect(gain).connect(ac.destination)
          osc.start(t)
          osc.stop(t + dur)
          t += dur * 0.9
        }
      } catch {
        // อุปกรณ์ไม่รองรับเสียง — เล่นต่อแบบเงียบ
      }
    },
    [enabled],
  )

  return {
    enabled,
    toggle: () => setEnabled((v) => !v),
    correct: useCallback(() => play([[660, 0.08], [990, 0.12]]), [play]),
    wrong: useCallback(() => play([[220, 0.18]], 'square'), [play]),
    tick: useCallback(() => play([[880, 0.06]]), [play]),
    win: useCallback(() => play([[523, 0.1], [659, 0.1], [784, 0.1], [1047, 0.25]], 'triangle'), [play]),
  }
}
