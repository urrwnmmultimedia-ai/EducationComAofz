import { useState, type FormEvent, type ReactNode } from 'react'
import { Button } from '@/components/Button'
import type { AppSettingsRow } from '@/lib/database.types'
import type { GradeStep } from '@/lib/grade'
import { CATEGORY_LABELS, parseGradeScale, parseWeights, weightsTotal, type ScoreWeights } from '@/lib/scoring'
import {
  adminCodeSchema,
  generalSettingsSchema,
  scoringSettingsSchema,
  useAppSettings,
  type GeneralSettings,
  type ScoringSettings,
} from './useAppSettings'

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

export function AdminSettingsPage() {
  const { settings, error, saveGeneral, saveScoring, changeAdminCode } = useAppSettings()

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl text-brand-900">ตั้งค่า</h1>
      {error && <p className="rounded-xl bg-rose-50 p-3 text-rose-700">{error}</p>}
      {!error && !settings && <p className="text-slate-500">กำลังโหลด…</p>}
      {settings && <GeneralForm initial={settings} onSave={saveGeneral} />}
      {settings && <ScoringForm initial={settings} onSave={saveScoring} />}
      <AdminCodeForm onSave={changeAdminCode} />
    </div>
  )
}

function GeneralForm({ initial, onSave }: { initial: AppSettingsRow; onSave: (v: GeneralSettings) => Promise<void> }) {
  const [values, setValues] = useState<GeneralSettings>({
    school_name: initial.school_name,
    term: initial.term === 2 ? 2 : 1,
    year: initial.year,
    student_code_length: initial.student_code_length,
    device_lock: initial.device_lock,
    leaderboard_mode: initial.leaderboard_mode,
  })
  const [state, setState] = useState<SaveState>('idle')
  const [message, setMessage] = useState<string | null>(null)

  const set = <K extends keyof GeneralSettings>(key: K, value: GeneralSettings[K]) => {
    setValues((v) => ({ ...v, [key]: value }))
    setState('idle')
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (state === 'saving') return
    const parsed = generalSettingsSchema.safeParse(values)
    if (!parsed.success) {
      setState('error')
      setMessage(parsed.error.issues[0]?.message ?? 'ข้อมูลไม่ถูกต้อง')
      return
    }
    setState('saving')
    try {
      await onSave(parsed.data)
      setState('saved')
      setMessage(null)
    } catch {
      setState('error')
      setMessage('บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง')
    }
  }

  return (
    <Card title="ข้อมูลทั่วไปและการเข้าสู่ระบบ (ใช้ทั้ง ม.3 และ DB Quest)">
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <Field label="ชื่อโรงเรียน" className="sm:col-span-2">
          <input className={INPUT} value={values.school_name} onChange={(e) => set('school_name', e.target.value)} />
        </Field>
        <Field label="ภาคเรียน">
          <select className={INPUT} value={values.term} onChange={(e) => set('term', e.target.value === '2' ? 2 : 1)}>
            <option value={1}>1</option>
            <option value={2}>2</option>
          </select>
        </Field>
        <Field label="ปีการศึกษา (พ.ศ.)">
          <input
            className={INPUT}
            type="number"
            inputMode="numeric"
            value={values.year}
            onChange={(e) => set('year', Number(e.target.value))}
          />
        </Field>
        <Field label="ความยาวรหัสนักเรียน (หลัก)">
          <input
            className={INPUT}
            type="number"
            inputMode="numeric"
            min={3}
            max={12}
            value={values.student_code_length}
            onChange={(e) => set('student_code_length', Number(e.target.value))}
          />
        </Field>
        <Field label="ลีดเดอร์บอร์ดของนักเรียน ม.3">
          <select
            className={INPUT}
            value={values.leaderboard_mode}
            onChange={(e) => set('leaderboard_mode', e.target.value as GeneralSettings['leaderboard_mode'])}
          >
            <option value="top10">แสดง 10 อันดับแรก (+ อันดับของตัวเอง)</option>
            <option value="all">แสดงทุกคน</option>
            <option value="hidden">ซ่อน (ครูดูได้คนเดียว)</option>
          </select>
        </Field>
        <label className="flex items-start gap-3 rounded-2xl bg-brand-50 p-3 sm:col-span-2">
          <input
            type="checkbox"
            className="mt-1 size-5 accent-brand-600"
            checked={values.device_lock}
            onChange={(e) => set('device_lock', e.target.checked)}
          />
          <span>
            <span className="font-display text-slate-800">ล็อกอุปกรณ์</span>
            <span className="block text-sm text-slate-600">
              รหัสนักเรียน 1 รหัสใช้ได้กับเบราว์เซอร์เดียว (กันเพื่อนใช้รหัสกันเล่น) — รีเซ็ตได้ที่หน้าแดชบอร์ด
            </span>
          </span>
        </label>
        <SaveRow state={state} message={message} className="sm:col-span-2" />
      </form>
    </Card>
  )
}

const WEIGHT_KEYS: (keyof ScoreWeights)[] = ['work', 'project', 'unit_test', 'midterm', 'final', 'affective']

function ScoringForm({ initial, onSave }: { initial: AppSettingsRow; onSave: (v: ScoringSettings) => Promise<void> }) {
  const [weights, setWeights] = useState<ScoreWeights>(parseWeights(initial.score_weights))
  const [scale, setScale] = useState<GradeStep[]>(parseGradeScale(initial.grade_scale))
  const [lateOn, setLateOn] = useState(initial.late_penalty_enabled)
  const [latePct, setLatePct] = useState(Number(initial.late_penalty_pct))
  const [fullXp, setFullXp] = useState(initial.affective_full_xp)
  const [state, setState] = useState<SaveState>('idle')
  const [message, setMessage] = useState<string | null>(null)
  const total = weightsTotal(weights)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (state === 'saving') return
    const parsed = scoringSettingsSchema.safeParse({
      score_weights: weights,
      grade_scale: [...scale].sort((a, b) => b.min - a.min),
      late_penalty_enabled: lateOn,
      late_penalty_pct: latePct,
      affective_full_xp: fullXp,
    })
    if (!parsed.success) {
      setState('error')
      setMessage(parsed.error.issues[0]?.message ?? 'ข้อมูลไม่ถูกต้อง')
      return
    }
    setState('saving')
    try {
      await onSave(parsed.data)
      setScale(parsed.data.grade_scale)
      setState('saved')
      setMessage(null)
    } catch {
      setState('error')
      setMessage('บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง')
    }
  }

  return (
    <Card title="คะแนนและเกรด ม.3">
      <form onSubmit={submit} className="flex flex-col gap-5">
        <div>
          <p className="mb-2 text-sm text-slate-600">
            สัดส่วนคะแนน (รวมต้องได้ 100) —{' '}
            <span className={total === 100 ? 'text-mint-500' : 'text-rose-600'}>ตอนนี้รวม {total}</span>
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {WEIGHT_KEYS.map((k) => (
              <Field key={k} label={CATEGORY_LABELS[k]}>
                <input
                  className={INPUT}
                  type="number"
                  min={0}
                  max={100}
                  value={weights[k]}
                  onChange={(e) => {
                    setWeights((w) => ({ ...w, [k]: Math.max(0, Number(e.target.value) || 0) }))
                    setState('idle')
                  }}
                />
              </Field>
            ))}
          </div>
          {weights.affective > 0 && (
            <Field label="XP ที่ได้คะแนนจิตพิสัยเต็ม" className="mt-3 max-w-xs">
              <input className={INPUT} type="number" min={1} value={fullXp} onChange={(e) => setFullXp(Number(e.target.value))} />
            </Field>
          )}
        </div>

        <div>
          <p className="mb-2 text-sm text-slate-600">เกณฑ์เกรด (คะแนนขั้นต่ำ ได้เกรด)</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {scale.map((g, i) => (
              <div key={g.grade} className="flex items-center gap-2 rounded-xl bg-brand-50 p-2">
                <input
                  className={`${INPUT} w-16`}
                  type="number"
                  min={0}
                  max={100}
                  aria-label={`คะแนนขั้นต่ำเกรด ${g.grade}`}
                  value={g.min}
                  onChange={(e) => {
                    setScale((s) => s.map((x, j) => (j === i ? { ...x, min: Number(e.target.value) } : x)))
                    setState('idle')
                  }}
                />
                <span className="text-sm text-slate-500">ขึ้นไป = เกรด</span>
                <span className="font-display text-brand-700">{g.grade}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-brand-50 p-3">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              className="size-5 accent-brand-600"
              checked={lateOn}
              onChange={(e) => {
                setLateOn(e.target.checked)
                setState('idle')
              }}
            />
            <span className="font-display">หักคะแนนส่งช้า</span>
          </label>
          <input
            className={`${INPUT} w-20`}
            type="number"
            min={0}
            max={100}
            disabled={!lateOn}
            aria-label="เปอร์เซ็นต์ที่หัก"
            value={latePct}
            onChange={(e) => {
              setLatePct(Number(e.target.value))
              setState('idle')
            }}
          />
          <span>% ของคะแนนที่ได้</span>
        </div>

        <SaveRow state={state} message={message} />
      </form>
    </Card>
  )
}

function AdminCodeForm({ onSave }: { onSave: (code: string) => Promise<void> }) {
  const [code, setCode] = useState('')
  const [confirm, setConfirm] = useState('')
  const [state, setState] = useState<SaveState>('idle')
  const [message, setMessage] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (state === 'saving') return
    const parsed = adminCodeSchema.safeParse(code)
    if (!parsed.success) {
      setState('error')
      setMessage(parsed.error.issues[0]?.message ?? 'รหัสไม่ถูกต้อง')
      return
    }
    if (parsed.data !== confirm.trim()) {
      setState('error')
      setMessage('รหัสทั้งสองช่องไม่ตรงกัน')
      return
    }
    setState('saving')
    try {
      await onSave(parsed.data)
      setState('saved')
      setMessage('ครั้งหน้าให้ใช้รหัสใหม่ในการเข้าหน้าครู')
      setCode('')
      setConfirm('')
    } catch {
      setState('error')
      setMessage('เปลี่ยนรหัสไม่สำเร็จ ลองใหม่อีกครั้ง')
    }
  }

  return (
    <Card title="เปลี่ยนรหัสสำหรับครู (ใช้เข้าได้ทั้งสองวิชา)">
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <Field label="รหัสใหม่">
          <input className={INPUT} type="password" autoComplete="new-password" value={code} onChange={(e) => setCode(e.target.value)} />
        </Field>
        <Field label="พิมพ์รหัสใหม่อีกครั้ง">
          <input className={INPUT} type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </Field>
        <SaveRow state={state} message={message} className="sm:col-span-2" label="เปลี่ยนรหัส" />
      </form>
    </Card>
  )
}

const INPUT =
  'w-full rounded-xl border-2 border-brand-100 bg-white px-3 py-2 outline-none focus:border-brand-500'

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-brand-100 sm:p-6">
      <h2 className="mb-4 text-lg text-brand-900">{title}</h2>
      {children}
    </section>
  )
}

function Field({ label, children, className = '' }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={`flex flex-col gap-1 ${className}`}>
      <span className="text-sm text-slate-600">{label}</span>
      {children}
    </label>
  )
}

function SaveRow({
  state,
  message,
  className = '',
  label = 'บันทึก',
}: {
  state: SaveState
  message: string | null
  className?: string
  label?: string
}) {
  return (
    <div className={`flex flex-wrap items-center gap-3 ${className}`}>
      <Button type="submit" loading={state === 'saving'}>
        {label}
      </Button>
      {state === 'saved' && <span className="text-mint-500">บันทึกแล้ว ✓</span>}
      {message && <span className={state === 'error' ? 'text-rose-600' : 'text-slate-600'}>{message}</span>}
    </div>
  )
}
