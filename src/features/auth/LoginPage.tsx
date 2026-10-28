import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { useAuth } from '@/app/AuthContext'
import { Button } from '@/components/Button'
import { FullPageMessage } from '@/components/FullPageMessage'
import { Doctor, NamWan, Non } from '@/components/characters/Characters'
import { checkCodeFormat, loginErrorMessage, sanitizeStudentInput, type CodeMode } from './code'
import { useStudentCodeLength } from './useStudentCodeLength'

export function LoginPage() {
  const { status, identity, login, refresh } = useAuth()
  const navigate = useNavigate()
  const codeLength = useStudentCodeLength(status === 'ready')
  const [mode, setMode] = useState<CodeMode>('student')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (status === 'unconfigured') {
    return (
      <FullPageMessage
        title="ยังไม่ได้ตั้งค่าการเชื่อมต่อฐานข้อมูล"
        detail="ครู: สร้างไฟล์ .env จาก .env.example แล้วใส่ VITE_SUPABASE_URL และ VITE_SUPABASE_ANON_KEY"
      />
    )
  }
  if (status === 'loading') return <FullPageMessage loading title="กำลังเตรียมห้องเรียน…" />
  if (status === 'error') {
    return (
      <FullPageMessage
        title="เชื่อมต่อระบบไม่สำเร็จ"
        detail="ตรวจสอบอินเทอร์เน็ต แล้วกดลองใหม่"
        action={<Button onClick={() => void refresh()}>ลองใหม่</Button>}
      />
    )
  }
  if (identity.role === 'student') return <Navigate to="/home" replace />
  if (identity.role === 'admin') return <Navigate to="/admin" replace />

  const switchMode = (next: CodeMode) => {
    setMode(next)
    setCode('')
    setError(null)
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (submitting) return
    const check = checkCodeFormat(code, mode, codeLength)
    if (!check.ok) {
      setError(check.message)
      return
    }
    setSubmitting(true)
    setError(null)
    const result = await login(check.value)
    setSubmitting(false)
    if (result.ok) {
      navigate(result.identity.role === 'admin' ? '/admin' : '/home', { replace: true })
      return
    }
    // โหมดครูไม่บอกว่าผิดเพราะอะไร เพื่อไม่ให้เดาง่าย
    setError(
      mode === 'admin' && result.error === 'not_found'
        ? 'รหัสสำหรับครูไม่ถูกต้อง'
        : loginErrorMessage(result.error, result.retryAfterSec),
    )
  }

  const isStudent = mode === 'student'

  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden px-4 py-10">
      <div aria-hidden className="pointer-events-none absolute -left-24 -top-24 size-72 rounded-full bg-sun-300/50 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-24 -right-24 size-80 rounded-full bg-sky2-400/30 blur-3xl" />

      <div className="relative w-full max-w-md">
        <div className="mb-[-18px] flex items-end justify-center gap-1">
          <NamWan className="size-20 drop-shadow" />
          <Doctor className="size-24 drop-shadow" />
          <Non className="size-20 drop-shadow" />
        </div>

        <section className="rounded-3xl bg-white p-6 pt-8 shadow-xl ring-1 ring-brand-100 sm:p-8 sm:pt-10">
          <p className="text-center text-sm font-medium text-brand-600">วิชาเทคโนโลยี (การออกแบบและเทคโนโลยี) ม.3</p>
          <h1 className="mt-1 text-center text-2xl text-brand-900 sm:text-3xl">
            {isStudent ? 'ห้องเรียนนักออกแบบ' : 'เข้าสู่ระบบสำหรับครู'}
          </h1>

          <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4" noValidate>
            <label htmlFor="code" className="font-display text-slate-700">
              {isStudent ? 'กรอกรหัสนักเรียน' : 'รหัสสำหรับครู'}
            </label>
            <input
              id="code"
              name="code"
              autoFocus
              autoComplete="off"
              spellCheck={false}
              type={isStudent ? 'text' : 'password'}
              inputMode={isStudent ? 'numeric' : 'text'}
              pattern={isStudent ? '[0-9]*' : undefined}
              maxLength={isStudent ? codeLength : 64}
              placeholder={isStudent ? '•'.repeat(codeLength) : ''}
              value={code}
              onChange={(e) => {
                setCode(isStudent ? sanitizeStudentInput(e.target.value, codeLength) : e.target.value)
                setError(null)
              }}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? 'code-error' : undefined}
              className={`w-full rounded-2xl border-2 bg-brand-50 px-4 py-3 text-center font-display text-2xl outline-none transition focus:bg-white ${
                isStudent ? 'tracking-[0.5em]' : 'tracking-wide'
              } ${error ? 'border-coral-400' : 'border-brand-200 focus:border-brand-500'}`}
            />

            {error && (
              <p id="code-error" role="alert" className="rounded-xl bg-coral-400/10 px-3 py-2 text-center text-sm text-rose-700">
                {error}
              </p>
            )}

            <Button type="submit" loading={submitting} loadingText="กำลังตรวจสอบ…" className="w-full text-lg">
              {isStudent ? 'เข้าเรียน' : 'เข้าสู่หน้าครู'}
            </Button>
          </form>

          <div className="mt-5 text-center">
            <button
              type="button"
              onClick={() => switchMode(isStudent ? 'admin' : 'student')}
              className="text-sm text-slate-500 underline-offset-4 hover:text-brand-700 hover:underline"
            >
              {isStudent ? 'สำหรับครู' : '← กลับไปหน้านักเรียน'}
            </button>
          </div>
        </section>
      </div>
    </main>
  )
}
