import { Link } from 'react-router'
import { ArrowRight, BookOpen, ChevronRight, CircleCheck, Lock } from 'lucide-react'
import { ErrorBlock, LoadingBlock, ProgressBar } from '@/components/StatusViews'
import type { SessionListItem, UnitRow } from '@/lib/database.types'
import { useAsync } from '@/lib/useAsync'
import { fetchSessionList, fetchUnits } from './lessonsApi'

const pctOf = (s: SessionListItem) => (s.total_steps ? Math.round((Math.min(s.completed_steps.length, s.total_steps) / s.total_steps) * 100) : 0)

// คาบที่ควรเรียนต่อ: คาบแรกที่เปิดแล้วแต่ยังไม่ครบ
function nextSession(list: SessionListItem[]): SessionListItem | undefined {
  return list.find((s) => s.is_unlocked && pctOf(s) < 100)
}

function Status({ s, isNext }: { s: SessionListItem; isNext: boolean }) {
  if (!s.is_unlocked)
    return (
      <span className="shrink-0 text-slate-400" aria-label="ยังล็อก">
        <Lock className="size-5" aria-hidden />
      </span>
    )
  if (isNext)
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-action px-3 py-1 text-sm font-semibold text-white shadow-action">
        {pctOf(s) ? 'เรียนต่อ' : 'เริ่ม'} <ArrowRight className="size-4" aria-hidden />
      </span>
    )
  if (pctOf(s) === 100)
    return (
      <span className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-mint-500">
        <CircleCheck className="size-5" aria-hidden /> ครบแล้ว
      </span>
    )
  return <ChevronRight className="size-5 shrink-0 text-slate-400" aria-hidden />
}

function Row({ s, unit, isNext }: { s: SessionListItem; unit?: UnitRow; isNext: boolean }) {
  const open = s.is_unlocked
  const pct = pctOf(s)
  const body = (
    <>
      <span
        className={`grid size-11 shrink-0 place-items-center rounded-2xl text-lg font-bold tabular-nums ${
          !open ? 'bg-surface text-slate-400' : isNext ? 'bg-action-soft text-action-strong' : 'bg-m3-50 text-m3-700'
        }`}
      >
        {s.session_no}
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block font-semibold leading-snug ${open ? 'text-ink' : 'text-slate-500'}`}>{s.title}</span>
        <span className="mt-0.5 flex items-center gap-1.5 text-sm text-ink-2">
          <BookOpen className="size-4 shrink-0" aria-hidden />
          {unit ? `หน่วย ${unit.no} · ${unit.title}` : 'คาบพิเศษ'}
        </span>
        {open && pct > 0 && pct < 100 && <ProgressBar value={pct} className="mt-2 h-1.5 max-w-48" />}
      </span>
      <Status s={s} isNext={isNext} />
    </>
  )
  return open ? (
    <Link to={`/sessions/${s.session_no}`} className="tq-press flex items-center gap-3 px-4 py-3.5 hover:bg-surface/60 sm:px-5">
      {body}
    </Link>
  ) : (
    <div className="flex items-center gap-3 px-4 py-3.5 opacity-75 sm:px-5" aria-disabled="true">
      {body}
    </div>
  )
}

// หน้าบทเรียนทุกคาบของ ม.3 (แบบเดียวกับ DB Quest): การ์ดเดียว แถวเรียงต่อกัน ปุ่มน้ำเงินอยู่ที่คาบที่ควรเรียนต่อ
export function LessonsMapPage() {
  const state = useAsync(async () => {
    const [units, sessions] = await Promise.all([fetchUnits(), fetchSessionList()])
    return { units, sessions: [...sessions].sort((a, b) => a.session_no - b.session_no) }
  }, [])
  const units = new Map(state.data?.units.map((u) => [u.id, u]))
  const next = state.data ? nextSession(state.data.sessions) : undefined

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-[1.45rem] leading-tight text-ink sm:text-[2.1rem]">บทเรียน</h1>
        {state.data && (
          <p className="mt-1 text-ink-2">
            {state.data.sessions.length} คาบ · {state.data.units.length} หน่วย
          </p>
        )}
      </header>
      {state.status === 'loading' && <LoadingBlock />}
      {state.status === 'error' && <ErrorBlock message={state.error} onRetry={state.reload} />}
      {state.status === 'success' && (
        <ol className="tq-card divide-y divide-line overflow-hidden">
          {state.data.sessions.map((s) => (
            <li key={s.session_no}>
              <Row s={s} unit={s.unit_id ? units.get(s.unit_id) : undefined} isNext={next?.session_no === s.session_no} />
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
