import { Link, useParams } from 'react-router'
import { ErrorBlock, LoadingBlock, ProgressBar } from '@/components/StatusViews'
import type { SessionListItem } from '@/lib/database.types'
import { useAsync } from '@/lib/useAsync'
import { fetchSessionList, fetchUnitByNo, parseMindmap, type MindmapBranch } from '@/features/lessons/lessonsApi'
import { progressPercent } from '@/features/lessons/sessionSteps'

const BRANCH_COLORS = ['bg-sky2-400/15 ring-sky2-400/50', 'bg-mint-400/15 ring-mint-400/60', 'bg-sun-300/40 ring-sun-400/60', 'bg-coral-400/15 ring-coral-400/50']

export function UnitPage() {
  const unitNo = Number(useParams().unitId)
  const state = useAsync(async () => {
    const [unit, sessions] = await Promise.all([fetchUnitByNo(unitNo), fetchSessionList()])
    return { unit, sessions: unit ? sessions.filter((s) => s.unit_id === unit.id) : [] }
  }, [unitNo])

  if (state.status === 'loading') return <LoadingBlock />
  if (state.status === 'error') return <ErrorBlock message={state.error} onRetry={state.reload} />
  const { unit, sessions } = state.data
  if (!unit) return <ErrorBlock message="ไม่พบหน่วยการเรียนรู้นี้" />

  const percent = progressPercent(sessions)
  const mindmap = parseMindmap(unit.mindmap)

  return (
    <div className="flex flex-col gap-6">
      <nav className="text-sm text-slate-500">
        <Link to="/home" className="hover:text-brand-700">
          หน้าหลัก
        </Link>
        {' / '}หน่วยที่ {unit.no}
      </nav>

      <header className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-brand-100 sm:p-7">
        <p className="font-display text-brand-600">หน่วยที่ {unit.no}</p>
        <h1 className="text-2xl text-brand-900 sm:text-3xl">{unit.title}</h1>
        <p className="mt-2 text-slate-600">{unit.description}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {unit.indicators.map((i) => (
            <span key={i} className="rounded-full bg-brand-100 px-3 py-0.5 text-sm text-brand-700">
              ตัวชี้วัด ว 4.1 ม.3/{i}
            </span>
          ))}
        </div>
        <div className="mt-4 flex items-center gap-3">
          <ProgressBar value={percent} className="flex-1" />
          <span className="font-display text-brand-700">{percent}%</span>
        </div>
      </header>

      {unit.objectives.length > 0 && (
        <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-brand-100 sm:p-7">
          <h2 className="mb-3 text-xl text-brand-900">🎯 จุดประสงค์การเรียนรู้</h2>
          <ul className="space-y-2">
            {unit.objectives.map((o) => (
              <li key={o} className="flex gap-2">
                <span className="text-mint-500" aria-hidden>
                  ✓
                </span>
                {o}
              </li>
            ))}
          </ul>
        </section>
      )}

      {mindmap.length > 0 && <Mindmap center={unit.title} branches={mindmap} />}

      <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-brand-100 sm:p-7">
        <h2 className="mb-3 text-xl text-brand-900">📅 คาบเรียนในหน่วยนี้</h2>
        <ul className="flex flex-col gap-2">
          {sessions.map((s) => (
            <SessionRow key={s.session_no} item={s} />
          ))}
        </ul>
      </section>
    </div>
  )
}

function Mindmap({ center, branches }: { center: string; branches: MindmapBranch[] }) {
  return (
    <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-brand-100 sm:p-7">
      <h2 className="mb-4 text-xl text-brand-900">🧠 แผนผังความคิด</h2>
      <div className="flex flex-col items-center gap-4">
        <div className="rounded-full bg-brand-600 px-6 py-3 text-center font-display text-lg text-white shadow-md">{center}</div>
        <div className="h-4 w-0.5 bg-brand-200" aria-hidden />
        <div className="grid w-full gap-3 sm:grid-cols-2">
          {branches.map((b, i) => (
            <div key={b.title} className={`rounded-2xl p-4 ring-1 ${BRANCH_COLORS[i % BRANCH_COLORS.length]}`}>
              <p className="font-display text-slate-800">{b.title}</p>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {b.children.map((c) => (
                  <li key={c} className="rounded-full bg-white px-2.5 py-0.5 text-sm text-slate-700">
                    {c}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function SessionRow({ item }: { item: SessionListItem }) {
  const pct = progressPercent([item])
  const body = (
    <>
      <span
        className={`grid size-10 shrink-0 place-items-center rounded-xl font-display ${
          item.is_unlocked ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-400'
        }`}
      >
        {item.is_unlocked ? item.session_no : '🔒'}
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block truncate font-display ${item.is_unlocked ? 'text-slate-800' : 'text-slate-400'}`}>
          คาบที่ {item.session_no} · {item.title}
        </span>
        {item.is_unlocked && <ProgressBar value={pct} className="mt-1.5 max-w-48" />}
      </span>
      {item.is_unlocked && <span className="text-sm text-slate-500">{pct === 100 ? 'ครบแล้ว ✓' : `${pct}%`}</span>}
    </>
  )
  return (
    <li>
      {item.is_unlocked ? (
        <Link to={`/sessions/${item.session_no}`} className="flex items-center gap-3 rounded-2xl p-2 hover:bg-brand-50">
          {body}
        </Link>
      ) : (
        <div className="flex items-center gap-3 rounded-2xl p-2" aria-label={`คาบที่ ${item.session_no} ยังไม่เปิด`}>
          {body}
        </div>
      )}
    </li>
  )
}
