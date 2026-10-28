import { useMemo, useRef, useState } from 'react'
import { Button } from '@/components/Button'
import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/StatusViews'
import type { QuestionRow, UnitRow } from '@/lib/database.types'
import { supabase } from '@/lib/supabase'
import { useAsync } from '@/lib/useAsync'
import { QUESTION_TYPES, QUESTION_TYPE_LABELS, type QuestionType } from '@/features/exams/examModel'
import { downloadWorkbook, readTableFile } from './exportExcel'
import { CSV_HEADER, decodeAnswerFields, encodeAnswerFields, parseQuestionTable, questionToCsvRow, type CsvParseResult } from './questionCsv'

const INPUT = 'w-full rounded-xl border-2 border-brand-100 bg-white px-3 py-2 outline-none focus:border-brand-500'
const DIFF_LABEL = { easy: 'ง่าย', medium: 'กลาง', hard: 'ยาก' } as const

async function fetchBank() {
  const [q, u] = await Promise.all([
    supabase.from('questions').select('*').order('created_at'),
    supabase.from('units').select('*').order('no'),
  ])
  if (q.error) throw q.error
  if (u.error) throw u.error
  return { questions: q.data, units: u.data }
}

export function AdminQuestionsPage() {
  const state = useAsync(fetchBank, [])
  const [unit, setUnit] = useState('all')
  const [indicator, setIndicator] = useState('all')
  const [type, setType] = useState('all')
  const [reviewed, setReviewed] = useState('all')
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<string | 'new' | null>(null)
  const [bulkBusy, setBulkBusy] = useState(false)

  const data = state.status === 'success' ? state.data : null
  const filtered = useMemo(() => {
    if (!data) return []
    const s = search.trim().toLowerCase()
    return data.questions.filter(
      (q) =>
        (unit === 'all' || (unit === 'none' ? !q.unit_id : q.unit_id === unit)) &&
        (indicator === 'all' || String(q.indicator) === indicator) &&
        (type === 'all' || q.type === type) &&
        (reviewed === 'all' || String(q.reviewed) === reviewed) &&
        (!s || q.prompt.toLowerCase().includes(s) || q.topic.includes(s)),
    )
  }, [data, unit, indicator, type, reviewed, search])

  if (state.status === 'loading') return <LoadingBlock />
  if (state.status === 'error') return <ErrorBlock message={state.error} onRetry={state.reload} />
  const { questions, units } = state.data
  const unitNo = new Map(units.map((u) => [u.id, u.no]))
  const unreviewed = questions.filter((q) => !q.reviewed).length

  const markAllReviewed = async () => {
    const ids = filtered.filter((q) => !q.reviewed).map((q) => q.id)
    if (!ids.length || bulkBusy) return
    setBulkBusy(true)
    await supabase.from('questions').update({ reviewed: true }).in('id', ids)
    setBulkBusy(false)
    state.reload()
  }

  const exportCsv = () =>
    void downloadWorkbook('คลังข้อสอบ-เทคโนโลยี-ม3.xlsx', [
      { name: 'ข้อสอบ', rows: [CSV_HEADER, ...questions.map((q) => questionToCsvRow(q, unitNo))], colWidths: [10, 6, 8, 8, 10, 8, 50, 40, 12, 40, 8] },
    ])

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl text-brand-900">คลังข้อสอบ</h1>
          <p className="text-sm text-slate-500">
            ทั้งหมด {questions.length} ข้อ · <span className="text-amber-700">ยังไม่ตรวจ {unreviewed} ข้อ</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" onClick={exportCsv}>
            ⬇ ส่งออก Excel
          </Button>
          <Button onClick={() => setEditing('new')}>+ เพิ่มข้อสอบ</Button>
        </div>
      </div>

      <ImportPanel units={units} onDone={state.reload} />

      <section className="grid gap-2 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-brand-100 sm:grid-cols-5">
        <select className={INPUT} value={unit} onChange={(e) => setUnit(e.target.value)} aria-label="หน่วย">
          <option value="all">ทุกหน่วย</option>
          {units.map((u) => (
            <option key={u.id} value={u.id}>
              หน่วยที่ {u.no}
            </option>
          ))}
          <option value="none">ไม่อยู่ในหน่วย</option>
        </select>
        <select className={INPUT} value={indicator} onChange={(e) => setIndicator(e.target.value)} aria-label="ตัวชี้วัด">
          <option value="all">ทุกตัวชี้วัด</option>
          {[1, 2, 3, 4].map((i) => (
            <option key={i} value={i}>
              ว 4.1 ม.3/{i}
            </option>
          ))}
        </select>
        <select className={INPUT} value={type} onChange={(e) => setType(e.target.value)} aria-label="ประเภท">
          <option value="all">ทุกประเภท</option>
          {QUESTION_TYPES.map((t) => (
            <option key={t} value={t}>
              {QUESTION_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
        <select className={INPUT} value={reviewed} onChange={(e) => setReviewed(e.target.value)} aria-label="สถานะตรวจ">
          <option value="all">ทุกสถานะ</option>
          <option value="false">ยังไม่ตรวจ</option>
          <option value="true">ตรวจแล้ว</option>
        </select>
        <input className={INPUT} placeholder="ค้นหาคำถาม" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="ค้นหา" />
      </section>

      <div className="flex items-center justify-between gap-2 text-sm text-slate-500">
        แสดง {filtered.length} ข้อ
        {filtered.some((q) => !q.reviewed) && (
          <Button variant="secondary" loading={bulkBusy} onClick={() => void markAllReviewed()}>
            ✓ ทำเครื่องหมาย "ตรวจแล้ว" ทุกข้อที่แสดง
          </Button>
        )}
      </div>

      {editing === 'new' && <QuestionEditor question={null} units={units} onDone={() => (setEditing(null), state.reload())} onCancel={() => setEditing(null)} />}

      {filtered.length === 0 ? (
        <EmptyBlock>ไม่พบข้อสอบตามตัวกรอง</EmptyBlock>
      ) : (
        <ul className="flex flex-col gap-3">
          {filtered.map((q) =>
            editing === q.id ? (
              <li key={q.id}>
                <QuestionEditor question={q} units={units} onDone={() => (setEditing(null), state.reload())} onCancel={() => setEditing(null)} />
              </li>
            ) : (
              <QuestionCard key={q.id} q={q} unitNo={q.unit_id ? unitNo.get(q.unit_id) : undefined} onEdit={() => setEditing(q.id)} onChanged={state.reload} />
            ),
          )}
        </ul>
      )}
    </div>
  )
}

function QuestionCard({ q, unitNo, onEdit, onChanged }: { q: QuestionRow; unitNo?: number; onEdit: () => void; onChanged: () => void }) {
  const [busy, setBusy] = useState(false)
  const { choices, answer } = decodeAnswerFields(q)

  const toggleReviewed = async () => {
    setBusy(true)
    await supabase.from('questions').update({ reviewed: !q.reviewed }).eq('id', q.id)
    setBusy(false)
    onChanged()
  }

  return (
    <li className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-brand-100">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {!q.reviewed && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-800">ร่างจาก AI ยังไม่ตรวจ</span>}
        <span className="rounded-full bg-brand-100 px-2 py-0.5 text-brand-700">{QUESTION_TYPE_LABELS[q.type]}</span>
        {unitNo && <span className="text-slate-500">หน่วย {unitNo}</span>}
        {q.topic && <span className="text-slate-500">เรื่อง {q.topic}</span>}
        {q.indicator && <span className="text-slate-500">ตัวชี้วัด {q.indicator}</span>}
        <span className="text-slate-500">{DIFF_LABEL[q.difficulty]}</span>
      </div>
      <p className="mt-2 font-display text-slate-800">{q.prompt}</p>
      {choices && <p className="mt-1 text-sm text-slate-600">ตัวเลือก: {choices.split(';').join(' · ')}</p>}
      {answer && <p className="text-sm text-emerald-700">เฉลย: {answer}</p>}
      {q.explanation && <p className="text-sm text-slate-500">💡 {q.explanation}</p>}
      <div className="mt-2 flex flex-wrap gap-2">
        <Button variant={q.reviewed ? 'ghost' : 'secondary'} className="min-h-8 px-3 py-1 text-sm" loading={busy} onClick={() => void toggleReviewed()}>
          {q.reviewed ? 'ตรวจแล้ว ✓ (กดเพื่อยกเลิก)' : 'ตรวจแล้ว'}
        </Button>
        <Button variant="ghost" className="min-h-8 px-3 py-1 text-sm" onClick={onEdit}>
          แก้ไข
        </Button>
      </div>
    </li>
  )
}

function QuestionEditor({ question, units, onDone, onCancel }: { question: QuestionRow | null; units: UnitRow[]; onDone: () => void; onCancel: () => void }) {
  const decoded = question ? decodeAnswerFields(question) : { choices: '', answer: '' }
  const [type, setType] = useState<QuestionType>(question?.type ?? 'mcq')
  const [unitId, setUnitId] = useState(question?.unit_id ?? units[0]?.id ?? '')
  const [topic, setTopic] = useState(question?.topic ?? '')
  const [indicator, setIndicator] = useState(question?.indicator?.toString() ?? '')
  const [difficulty, setDifficulty] = useState<QuestionRow['difficulty']>(question?.difficulty ?? 'medium')
  const [prompt, setPrompt] = useState(question?.prompt ?? '')
  const [choices, setChoices] = useState(decoded.choices)
  const [answer, setAnswer] = useState(decoded.answer)
  const [explanation, setExplanation] = useState(question?.explanation ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const hint: Record<QuestionType, string> = {
    mcq: 'ตัวเลือกคั่นด้วย ; (เช่น ก;ข;ค;ง) · เฉลยเป็นเลขข้อ 1–4',
    true_false: 'เฉลย: ถูก หรือ ผิด',
    fill: 'เฉลย: คำตอบที่ยอมรับ คั่นด้วย ; (ไม่สนช่องว่างและตัวพิมพ์เล็ก-ใหญ่)',
    matching: 'ตัวเลือก: ซ้าย=ขวา;ซ้าย=ขวา (ระบบสลับฝั่งขวาให้นักเรียนเอง)',
    ordering: 'ตัวเลือก: เรียงตามลำดับที่ถูก คั่นด้วย ; (ระบบสลับให้นักเรียนเอง)',
    short: 'ข้อเขียน ครูตรวจในหน้าผลสอบ · ใส่แนวคำตอบในคำอธิบายได้',
  }

  const save = async () => {
    if (saving) return
    if (!prompt.trim()) return setError('กรุณากรอกคำถาม')
    let encoded
    try {
      const unchanged = question && question.type === type && decoded.choices === choices && decoded.answer === answer
      encoded = unchanged ? { choices: question.choices, correct_answer: question.correct_answer } : encodeAnswerFields(type, choices, answer)
    } catch (e) {
      return setError(e instanceof Error ? e.message : 'ข้อมูลไม่ถูกต้อง')
    }
    setSaving(true)
    setError(null)
    const row = {
      type,
      unit_id: unitId || null,
      topic: topic.trim(),
      indicator: indicator ? Number(indicator) : null,
      difficulty,
      prompt: prompt.trim(),
      explanation: explanation.trim(),
      reviewed: true, // ครูบันทึกเอง = ตรวจแล้ว
      ...encoded,
    }
    const { error: err } = question ? await supabase.from('questions').update(row).eq('id', question.id) : await supabase.from('questions').insert(row)
    setSaving(false)
    if (err) setError('บันทึกไม่สำเร็จ')
    else onDone()
  }

  const remove = async () => {
    if (!question) return
    setSaving(true)
    const { error: err } = await supabase.from('questions').delete().eq('id', question.id)
    setSaving(false)
    if (err) setError('ลบไม่สำเร็จ')
    else onDone()
  }

  return (
    <div className="grid gap-3 rounded-2xl bg-sun-300/20 p-4 ring-2 ring-sun-400/60 sm:grid-cols-4">
      <select className={INPUT} value={type} onChange={(e) => setType(e.target.value as QuestionType)} aria-label="ประเภท">
        {QUESTION_TYPES.map((t) => (
          <option key={t} value={t}>
            {QUESTION_TYPE_LABELS[t]}
          </option>
        ))}
      </select>
      <select className={INPUT} value={unitId} onChange={(e) => setUnitId(e.target.value)} aria-label="หน่วย">
        <option value="">ไม่อยู่ในหน่วย</option>
        {units.map((u) => (
          <option key={u.id} value={u.id}>
            หน่วยที่ {u.no}
          </option>
        ))}
      </select>
      <input className={INPUT} placeholder="หัวข้อ เช่น 1.1" value={topic} onChange={(e) => setTopic(e.target.value)} aria-label="หัวข้อ" />
      <div className="flex gap-2">
        <select className={INPUT} value={indicator} onChange={(e) => setIndicator(e.target.value)} aria-label="ตัวชี้วัด">
          <option value="">ตัวชี้วัด –</option>
          {[1, 2, 3, 4].map((i) => (
            <option key={i} value={i}>
              ม.3/{i}
            </option>
          ))}
        </select>
        <select className={INPUT} value={difficulty} onChange={(e) => setDifficulty(e.target.value as QuestionRow['difficulty'])} aria-label="ระดับ">
          <option value="easy">ง่าย</option>
          <option value="medium">กลาง</option>
          <option value="hard">ยาก</option>
        </select>
      </div>
      <textarea className={`${INPUT} sm:col-span-4`} rows={2} placeholder="คำถาม" value={prompt} onChange={(e) => setPrompt(e.target.value)} aria-label="คำถาม" />
      {['mcq', 'matching', 'ordering'].includes(type) && (
        <textarea className={`${INPUT} sm:col-span-3`} rows={2} placeholder="ตัวเลือก" value={choices} onChange={(e) => setChoices(e.target.value)} aria-label="ตัวเลือก" />
      )}
      {['mcq', 'true_false', 'fill'].includes(type) && (
        <input className={INPUT} placeholder="เฉลย" value={answer} onChange={(e) => setAnswer(e.target.value)} aria-label="เฉลย" />
      )}
      <p className="text-xs text-slate-600 sm:col-span-4">{hint[type]}</p>
      <textarea className={`${INPUT} sm:col-span-4`} rows={2} placeholder="คำอธิบายเฉลย" value={explanation} onChange={(e) => setExplanation(e.target.value)} aria-label="คำอธิบาย" />
      <div className="flex flex-wrap items-center gap-2 sm:col-span-4">
        <Button loading={saving} onClick={() => void save()}>
          บันทึก (= ตรวจแล้ว)
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          ยกเลิก
        </Button>
        {question &&
          (confirmDelete ? (
            <>
              <span className="text-sm">ลบข้อนี้? (จะหายจากทุกชุดสอบ)</span>
              <Button variant="danger" className="min-h-8 px-3 py-1 text-sm" onClick={() => void remove()}>
                ยืนยันลบ
              </Button>
            </>
          ) : (
            <Button variant="ghost" className="text-rose-600" onClick={() => setConfirmDelete(true)}>
              ลบ
            </Button>
          ))}
        {question && question.type !== type && <span className="text-xs text-amber-700">เปลี่ยนประเภทแล้ว ควรตรวจผลสอบเก่าใหม่ (กด "ตรวจใหม่" ในหน้าผลสอบ)</span>}
        {error && <span className="text-sm text-rose-600">{error}</span>}
      </div>
    </div>
  )
}

function ImportPanel({ units, onDone }: { units: UnitRow[]; onDone: () => void }) {
  const input = useRef<HTMLInputElement>(null)
  const [result, setResult] = useState<CsvParseResult | null>(null)
  const [status, setStatus] = useState<'idle' | 'reading' | 'saving'>('idle')
  const [message, setMessage] = useState<string | null>(null)

  const onFile = async (file: File) => {
    setStatus('reading')
    setMessage(null)
    try {
      setResult(parseQuestionTable(await readTableFile(file)))
    } catch {
      setMessage('อ่านไฟล์ไม่ได้ ใช้ไฟล์ .xlsx หรือ .csv')
    }
    setStatus('idle')
  }

  const confirm = async () => {
    if (!result || status === 'saving') return
    setStatus('saving')
    const byNo = new Map(units.map((u) => [u.no, u.id]))
    const rows = result.drafts.map((d) => ({
      id: d.id ?? crypto.randomUUID(),
      unit_id: d.unitNo != null ? (byNo.get(d.unitNo) ?? null) : null,
      topic: d.topic,
      indicator: d.indicator,
      type: d.type,
      difficulty: d.difficulty,
      prompt: d.prompt,
      choices: d.choices,
      correct_answer: d.correct_answer,
      explanation: d.explanation,
      reviewed: d.reviewed,
    }))
    const { error } = await supabase.from('questions').upsert(rows, { onConflict: 'id' })
    setStatus('idle')
    if (error) {
      setMessage('นำเข้าไม่สำเร็จ')
      return
    }
    setMessage(`นำเข้าแล้ว ✓ ${rows.length} ข้อ`)
    setResult(null)
    onDone()
  }

  return (
    <section className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-brand-100">
      <div className="flex flex-wrap items-center gap-2">
        <p className="mr-auto text-sm text-slate-600">
          นำเข้าจาก Excel/CSV — คอลัมน์: {CSV_HEADER.join(', ')} (ส่งออกไปแก้แล้วนำเข้ากลับได้ · มี id = อัปเดตข้อเดิม)
        </p>
        <input
          ref={input}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void onFile(f)
            e.target.value = ''
          }}
        />
        <Button variant="secondary" loading={status === 'reading'} loadingText="กำลังอ่าน…" onClick={() => input.current?.click()}>
          📂 นำเข้าไฟล์
        </Button>
      </div>
      {result && (
        <div className="mt-3 rounded-2xl bg-brand-50 p-3 text-sm">
          <p>
            พร้อมนำเข้า <b>{result.drafts.length}</b> ข้อ{result.issues.length > 0 && <span className="text-amber-700"> · ข้าม {result.issues.length} แถว</span>}
          </p>
          {result.issues.length > 0 && (
            <ul className="max-h-28 overflow-y-auto text-amber-800">
              {result.issues.map((i) => (
                <li key={i.line}>
                  แถว {i.line}: {i.message}
                </li>
              ))}
            </ul>
          )}
          <div className="mt-2 flex gap-2">
            <Button loading={status === 'saving'} disabled={result.drafts.length === 0} onClick={() => void confirm()}>
              ยืนยันนำเข้า
            </Button>
            <Button variant="ghost" onClick={() => setResult(null)}>
              ยกเลิก
            </Button>
          </div>
        </div>
      )}
      {message && <p className="mt-2 text-sm text-slate-600">{message}</p>}
    </section>
  )
}
