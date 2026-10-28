import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { useAuth } from '@/app/AuthContext'
import { Button } from '@/components/Button'
import { FullPageMessage } from '@/components/FullPageMessage'
import { ArrowLeft, ArrowRight, GraduationCap } from 'lucide-react'
import { COURSES } from '@/app/brand'
import { Avatar, Non } from '@/components/characters/Characters'
import { NongData } from '@/components/illustrations/NongData'
import { Backdrop, BrandLockup, CourseChip } from '@/components/shell/Shell'
import { homePathFor, type Identity } from './authApi'
import { checkCodeFormat, loginErrorMessage, sanitizeStudentInput, type CodeMode } from './code'
import { useStudentCodeLength } from './useStudentCodeLength'

export function LoginPage() {
  const { status, identity, login, logout, refresh } = useAuth()
  const navigate = useNavigate()
  const codeLength = useStudentCodeLength(status === 'ready')
  const [mode, setMode] = useState<CodeMode>('student')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  // นักเรียนต้องกด "ใช่ฉัน" ก่อนเข้า (กันพิมพ์รหัสเพื่อนผิด)
  const [confirming, setConfirming] = useState<Identity | null>(null)
  const [cancelling, setCancelling] = useState(false)

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
  if (confirming?.student) {
    const st = confirming.student
    const notMe = async () => {
      setCancelling(true)
      await logout()
      setCancelling(false)
      setConfirming(null)
      setCode('')
    }
    return (
      <main className="grid min-h-dvh place-items-center px-4 py-10">
        <Backdrop variant="hero" />
        <section className="tq-card w-full max-w-md p-6 text-center shadow-raise sm:p-8">
          <h1 className="text-2xl text-ink">ใช่ฉันไหม?</h1>
          <Avatar name={st.avatar} className="mx-auto mt-4 size-24 rounded-full bg-surface p-1" />
          <p className="mt-3 text-xl font-semibold text-ink">
            {st.prefix}
            {st.first_name} {st.last_name}
            {st.nickname && <span className="text-slate-500"> ({st.nickname})</span>}
          </p>
          <p className="text-slate-600">
            {st.classroom_name ?? 'ยังไม่ระบุห้อง'}
            {st.number != null && ` · เลขที่ ${st.number}`}
          </p>
          <div className="mt-6 flex flex-col gap-3">
            <Button className="w-full text-lg" disabled={cancelling} onClick={() => navigate(homePathFor(confirming), { replace: true })}>
              ใช่ ฉันเอง เข้าเรียนเลย
            </Button>
            <Button variant="secondary" className="w-full" loading={cancelling} loadingText="กำลังยกเลิก…" onClick={() => void notMe()}>
              ไม่ใช่ฉัน กรอกรหัสใหม่
            </Button>
          </div>
        </section>
      </main>
    )
  }
  if (identity.role) return <Navigate to={homePathFor(identity)} replace />

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
      if (result.identity.role === 'student') setConfirming(result.identity)
      else navigate(homePathFor(result.identity), { replace: true })
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
    <main className="relative min-h-dvh overflow-hidden">
      <Backdrop variant="hero" />
      <div className="mx-auto grid min-h-dvh max-w-6xl items-center gap-10 px-4 py-8 lg:grid-cols-[1.1fr_1fr] lg:gap-16 lg:py-12">
        <BrandStory />

        <section className="tq-card relative mx-auto w-full max-w-md p-6 sm:p-8 lg:shadow-raise">
          <h1 className="text-[1.75rem] leading-tight text-ink sm:text-3xl">{isStudent ? 'เข้าห้องเรียน' : 'เข้าสู่ระบบสำหรับครู'}</h1>
          <p className="mt-1 text-ink-2">{isStudent ? 'ใช้รหัสนักเรียนของตัวเอง' : 'ใช้รหัสครูของระบบ'}</p>

          <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4" noValidate>
            <label htmlFor="code" className="text-sm font-semibold text-ink">
              {isStudent ? 'รหัสนักเรียน' : 'รหัสสำหรับครู'}
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
              className={`min-h-16 w-full rounded-2xl border-2 bg-surface/60 px-4 py-3 text-center text-[1.75rem] font-semibold tabular-nums text-ink outline-none transition placeholder:text-slate-300 focus:bg-white ${
                isStudent ? 'tracking-[0.45em]' : 'tracking-wide'
              } ${error ? 'border-coral-400' : 'border-line focus:border-action'}`}
            />

            {error && (
              <p id="code-error" role="alert" className="rounded-2xl bg-rose-50 px-4 py-2.5 text-center text-sm text-rose-800 ring-1 ring-rose-200">
                {error}
              </p>
            )}

            <Button type="submit" loading={submitting} loadingText="กำลังตรวจสอบ…" className="w-full text-lg">
              {isStudent ? 'เข้าเรียน' : 'เข้าสู่หน้าครู'}
              <ArrowRight className="size-5" aria-hidden />
            </Button>
          </form>

          <div className="mt-6 border-t border-line pt-4 text-center">
            <button
              type="button"
              onClick={() => switchMode(isStudent ? 'admin' : 'student')}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-ink-2 hover:bg-surface hover:text-ink"
            >
              {isStudent ? (
                <>
                  <GraduationCap className="size-4" aria-hidden /> สำหรับครู
                </>
              ) : (
                <>
                  <ArrowLeft className="size-4" aria-hidden /> กลับไปหน้านักเรียน
                </>
              )}
            </button>
          </div>
        </section>
      </div>
    </main>
  )
}

// ฝั่งซ้าย: ตราโรงเรียน + TechQuest + สองวิชาซ้อนกันเป็นชั้น ๆ (มาสคอตยื่นออกนอกการ์ด)
function BrandStory() {
  return (
    <div className="mx-auto w-full max-w-md lg:max-w-none">
      <BrandLockup />

      <div className="mt-14 hidden grid-cols-2 gap-5 lg:grid">
        <article className="relative -rotate-2 rounded-[1.75rem] bg-m3-500 p-5 pr-16 text-white shadow-raise">
          <p className="text-xl font-semibold leading-snug">{COURSES.m3.subject}</p>
          <p className="mt-4 text-sm text-m3-100">ม.3 · 3 หน่วย · 20 คาบ</p>
          <Non className="absolute -right-4 -top-10 size-24 drop-shadow-lg" />
        </article>
        <article className="relative mt-6 rotate-2 rounded-[1.75rem] bg-db-600 p-5 pr-16 text-white shadow-raise">
          <p className="text-xl font-semibold leading-snug">{COURSES.db.name}</p>
          <p className="text-base text-db-100">{COURSES.db.subject}</p>
          <p className="mt-4 text-sm text-db-100">7 หน่วย · 20 คาบ</p>
          <NongData mood="cheer" className="absolute -right-4 -top-11 size-24 drop-shadow-lg" />
        </article>
      </div>

      <div className="mt-5 flex flex-wrap gap-2 lg:hidden">
        <CourseChip course="m3" />
        <CourseChip course="db" />
      </div>
    </div>
  )
}
