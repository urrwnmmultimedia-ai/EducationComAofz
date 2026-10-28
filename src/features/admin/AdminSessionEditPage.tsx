import { useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router'
import { Button } from '@/components/Button'
import { ErrorBlock, LoadingBlock } from '@/components/StatusViews'
import type { LessonRow } from '@/lib/database.types'
import { useAsync } from '@/lib/useAsync'
import { LessonCards } from '@/features/lessons/LessonCards'
import { parseSteps, totalMinutes, type SessionStep } from '@/features/lessons/sessionSteps'
import {
  createLesson,
  deleteLesson,
  fetchSessionForEdit,
  saveLesson,
  saveSession,
  type SessionEditData,
} from './adminLessonsApi'

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

const INPUT = 'w-full rounded-xl border-2 border-brand-100 bg-white px-3 py-2 outline-none focus:border-brand-500'

export function AdminSessionEditPage() {
  const no = Number(useParams().no)
  const state = useAsync(() => fetchSessionForEdit(no), [no])

  if (state.status === 'loading') return <LoadingBlock />
  if (state.status === 'error') return <ErrorBlock message={state.error} onRetry={state.reload} />
  if (!state.data) return <ErrorBlock message={`ไม่พบคาบที่ ${no}`} />

  return (
    <div className="flex flex-col gap-6">
      <nav className="text-sm text-slate-500">
        <Link to="/admin/sessions" className="hover:text-brand-700">
          บทเรียน / คาบเรียน
        </Link>
        {' / '}คาบที่ {no}
      </nav>
      <SessionForm key={state.data.session.id} data={state.data} />
      <LessonsEditor data={state.data} onChanged={state.reload} />
    </div>
  )
}

function SessionForm({ data }: { data: SessionEditData }) {
  const { session, units } = data
  const [title, setTitle] = useState(session.title)
  const [summary, setSummary] = useState(session.summary)
  const [workLabel, setWorkLabel] = useState(session.work_label)
  const [gameSlug, setGameSlug] = useState(session.game_slug ?? '')
  const [unitId, setUnitId] = useState(session.unit_id ?? '')
  const [steps, setSteps] = useState<SessionStep[]>(() => parseSteps(session.steps))
  const [save, setSave] = useState<SaveState>('idle')

  const touch = () => setSave('idle')
  const updateStep = (i: number, patch: Partial<SessionStep>) => {
    setSteps((list) => list.map((s, j) => (j === i ? { ...s, ...patch } : s)))
    touch()
  }

  const submit = async () => {
    if (save === 'saving') return
    if (!title.trim()) {
      setSave('error')
      return
    }
    setSave('saving')
    try {
      await saveSession(session.id, {
        title: title.trim(),
        summary: summary.trim(),
        work_label: workLabel.trim(),
        game_slug: gameSlug.trim() || null,
        unit_id: unitId || null,
        steps,
      })
      setSave('saved')
    } catch {
      setSave('error')
    }
  }

  const minutes = totalMinutes(steps)

  return (
    <Card title={`ข้อมูลคาบที่ ${session.session_no}`}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="ชื่อเรื่อง" className="sm:col-span-2">
          <input className={INPUT} value={title} onChange={(e) => (setTitle(e.target.value), touch())} />
        </Field>
        <Field label="คำอธิบายสั้น" className="sm:col-span-2">
          <textarea className={INPUT} rows={2} value={summary} onChange={(e) => (setSummary(e.target.value), touch())} />
        </Field>
        <Field label="หน่วย">
          <select className={INPUT} value={unitId} onChange={(e) => (setUnitId(e.target.value), touch())}>
            <option value="">– ไม่อยู่ในหน่วย –</option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                หน่วยที่ {u.no} {u.title}
              </option>
            ))}
          </select>
        </Field>
        <Field label="รหัสเกม (slug)">
          <input className={INPUT} value={gameSlug} placeholder="เช่น 5g-time-machine" onChange={(e) => (setGameSlug(e.target.value), touch())} />
        </Field>
        <Field label="งาน / คะแนนเก็บ" className="sm:col-span-2">
          <input className={INPUT} value={workLabel} onChange={(e) => (setWorkLabel(e.target.value), touch())} />
        </Field>
      </div>

      <h3 className="mt-6 font-display text-brand-900">
        ขั้นตอนในคาบ{' '}
        <span className={`text-sm ${minutes === 120 ? 'text-mint-500' : 'text-amber-600'}`}>(รวม {minutes} นาที)</span>
      </h3>
      <div className="mt-2 flex flex-col gap-3">
        {steps.map((s, i) => (
          <div key={s.key} className="grid gap-2 rounded-2xl bg-brand-50 p-3 sm:grid-cols-[1fr_7rem]">
            <input
              className={INPUT}
              aria-label={`ชื่อขั้นตอน ${s.key}`}
              value={s.label}
              onChange={(e) => updateStep(i, { label: e.target.value })}
            />
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                className={INPUT}
                type="number"
                min={0}
                max={120}
                value={s.minutes}
                onChange={(e) => updateStep(i, { minutes: Math.max(0, Math.round(Number(e.target.value) || 0)) })}
              />
              นาที
            </label>
            {(s.key === 'warmup' || s.key === 'summary') && (
              <textarea
                className={`${INPUT} sm:col-span-2`}
                rows={3}
                aria-label={s.key === 'warmup' ? 'คำถามชวนคิด (บรรทัดละ 1 ข้อ)' : 'ประเด็นสรุป (บรรทัดละ 1 ข้อ)'}
                placeholder={s.key === 'warmup' ? 'คำถามชวนคิด บรรทัดละ 1 ข้อ' : 'ประเด็นสรุป บรรทัดละ 1 ข้อ'}
                value={(s.items ?? []).join('\n')}
                onChange={(e) => updateStep(i, { items: e.target.value.split('\n').filter((l) => l.trim() !== '') })}
              />
            )}
          </div>
        ))}
      </div>

      <SaveRow state={save} onSave={() => void submit()} errorText={title.trim() ? 'บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง' : 'กรุณากรอกชื่อเรื่อง'} />
    </Card>
  )
}

function LessonsEditor({ data, onChanged }: { data: SessionEditData; onChanged: () => void }) {
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const add = async () => {
    if (adding) return
    setAdding(true)
    setError(null)
    try {
      await createLesson(data.session.session_no, data.session.unit_id, data.lessons.length + 1)
      onChanged()
    } catch {
      setError('เพิ่มบทเรียนไม่สำเร็จ')
    } finally {
      setAdding(false)
    }
  }

  return (
    <Card title="เนื้อหาบทเรียน">
      <details className="mb-4 rounded-2xl bg-brand-50 p-3 text-sm text-slate-600">
        <summary className="cursor-pointer font-display text-brand-700">วิธีเขียนเนื้อหา</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            <code>## หัวข้อ</code> = เริ่มการ์ด/สไลด์ใหม่
          </li>
          <li>
            <code>**ตัวหนา**</code>, รายการ <code>- ข้อ</code>, ตาราง <code>| a | b |</code>, รูป <code>![คำอธิบาย](ลิงก์รูป)</code>
          </li>
          <li>
            <code>:::tip</code> … <code>:::</code> = กล่องเกร็ดน่ารู้ / <code>:::doctor</code> … <code>:::</code> = ด็อกเตอร์อธิบาย
          </li>
          <li>
            <code>:::embed https://youtu.be/…</code> = ฝังวิดีโอ YouTube หรือลิงก์ Canva (บรรทัดเดียว)
          </li>
        </ul>
      </details>

      <div className="flex flex-col gap-6">
        {data.lessons.map((l) => (
          <LessonEditor key={l.id} lesson={l} onDeleted={onChanged} />
        ))}
      </div>

      <div className="mt-4 flex items-center gap-3">
        <Button variant="secondary" loading={adding} loadingText="กำลังเพิ่ม…" onClick={() => void add()}>
          + เพิ่มบทเรียน
        </Button>
        {error && <span className="text-sm text-rose-600">{error}</span>}
      </div>
    </Card>
  )
}

function LessonEditor({ lesson, onDeleted }: { lesson: LessonRow; onDeleted: () => void }) {
  const [title, setTitle] = useState(lesson.title)
  const [md, setMd] = useState(lesson.content_md)
  const [save, setSave] = useState<SaveState>('idle')
  const [tab, setTab] = useState<'edit' | 'preview'>('edit')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const submit = async () => {
    if (save === 'saving') return
    setSave('saving')
    try {
      await saveLesson({ id: lesson.id, title: title.trim() || 'บทเรียน', content_md: md })
      setSave('saved')
    } catch {
      setSave('error')
    }
  }

  const remove = async () => {
    setDeleting(true)
    try {
      await deleteLesson(lesson.id)
      onDeleted()
    } catch {
      setDeleting(false)
      setSave('error')
    }
  }

  return (
    <div className="rounded-2xl ring-1 ring-brand-100">
      <div className="flex flex-wrap items-center gap-2 border-b border-brand-100 p-3">
        <input
          className={`${INPUT} min-w-48 flex-1`}
          aria-label="ชื่อบทเรียน"
          value={title}
          onChange={(e) => (setTitle(e.target.value), setSave('idle'))}
        />
        <div className="flex rounded-xl bg-brand-50 p-1" role="tablist">
          {(['edit', 'preview'] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={`rounded-lg px-3 py-1 font-display text-sm ${tab === t ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500'}`}
            >
              {t === 'edit' ? 'แก้ไข' : 'ดูตัวอย่าง'}
            </button>
          ))}
        </div>
      </div>
      <div className="p-3">
        {tab === 'edit' ? (
          <textarea
            className={`${INPUT} min-h-96 font-mono text-sm`}
            aria-label="เนื้อหา Markdown"
            value={md}
            onChange={(e) => (setMd(e.target.value), setSave('idle'))}
          />
        ) : (
          <div className="rounded-2xl bg-brand-50 p-3">
            <LessonCards title={title} markdown={md} />
          </div>
        )}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <SaveRow state={save} onSave={() => void submit()} errorText="บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง" />
          {confirmDelete ? (
            <span className="flex items-center gap-2 text-sm">
              ลบบทเรียนนี้ถาวร?
              <Button variant="danger" className="min-h-8 px-3 py-1 text-sm" loading={deleting} loadingText="กำลังลบ…" onClick={() => void remove()}>
                ยืนยันลบ
              </Button>
              <Button variant="ghost" className="min-h-8 px-3 py-1 text-sm" onClick={() => setConfirmDelete(false)}>
                ยกเลิก
              </Button>
            </span>
          ) : (
            <Button variant="ghost" className="min-h-8 px-3 py-1 text-sm text-rose-600" onClick={() => setConfirmDelete(true)}>
              ลบบทเรียน
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

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

function SaveRow({ state, onSave, errorText }: { state: SaveState; onSave: () => void; errorText: string }) {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-3">
      <Button loading={state === 'saving'} onClick={onSave}>
        บันทึก
      </Button>
      {state === 'saved' && <span className="text-mint-500">บันทึกแล้ว ✓</span>}
      {state === 'error' && <span className="text-rose-600">{errorText}</span>}
    </div>
  )
}
