import { useEffect, useState } from 'react'

export type ThemeChoice = 'light' | 'dark'

const STORAGE_KEY = 'dbq-theme'

function readStored(): ThemeChoice | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    return v === 'light' || v === 'dark' ? v : null
  } catch {
    return null
  }
}


// โหมดมืดของ DB Quest: ค่าเริ่มต้นสว่าง (ใช้ในห้องเรียนตอนกลางวัน) กดสลับแล้วจำไว้ในเบราว์เซอร์นี้
export function useTheme() {
  const [theme, setTheme] = useState<ThemeChoice>(() => readStored() ?? 'light')

  useEffect(() => {
    // สีแถบเบราว์เซอร์บนมือถือให้ตรงกับหน้า
    const meta = document.querySelector('meta[name="theme-color"]')
    const prev = meta?.getAttribute('content')
    meta?.setAttribute('content', theme === 'dark' ? '#0a1530' : '#ffffff')
    return () => {
      if (prev) meta?.setAttribute('content', prev)
    }
  }, [theme])

  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // เก็บไม่ได้ (โหมดส่วนตัว) ก็ใช้ได้เฉพาะครั้งนี้
    }
  }

  return { theme, toggle }
}
