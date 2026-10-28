import { useCallback, useEffect, useRef, useState, type DependencyList } from 'react'

export type AsyncState<T> =
  | { status: 'loading'; data: null; error: null }
  | { status: 'success'; data: T; error: null }
  | { status: 'error'; data: null; error: string }

// โหลดข้อมูลแบบ async พร้อมสถานะ loading/error
// reload() โหลดใหม่โดยคงข้อมูลเดิมไว้ระหว่างรอ (หน้าจอไม่กระพริบ)
export function useAsync<T>(fn: () => Promise<T>, deps: DependencyList, errorMessage = 'โหลดข้อมูลไม่สำเร็จ ลองใหม่อีกครั้ง') {
  const [state, setState] = useState<AsyncState<T>>({ status: 'loading', data: null, error: null })
  const [nonce, setNonce] = useState(0)
  const lastRun = useRef<unknown>(null)

  const run = useCallback(fn, deps)

  useEffect(() => {
    let cancelled = false
    const isReload = lastRun.current === run
    lastRun.current = run
    if (!isReload) setState({ status: 'loading', data: null, error: null })
    run().then(
      (data) => {
        if (!cancelled) setState({ status: 'success', data, error: null })
      },
      (err: unknown) => {
        console.error(err)
        if (!cancelled) setState({ status: 'error', data: null, error: errorMessage })
      },
    )
    return () => {
      cancelled = true
    }
  }, [run, nonce, errorMessage])

  const reload = useCallback(() => setNonce((n) => n + 1), [])
  return { ...state, reload }
}
