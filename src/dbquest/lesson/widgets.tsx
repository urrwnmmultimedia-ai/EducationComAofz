import { useEffect, useRef, useState, type ComponentType, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Pause, Play, RotateCcw } from 'lucide-react'
import { DbqMarkdown } from './DbqMarkdown'

// สื่อโต้ตอบในการ์ดบทเรียน DB Quest — ไม่เก็บคะแนน เล่นซ้ำได้ (มีโหมดมืด)
// ใช้ในเนื้อหา sNN.json ด้วย { "kind": "widget", "name": "<ชื่อ>" } หรือ { "kind": "flow", … }
//   search-race     แข่งค้นหาเบอร์: สมุดจดมั่ว vs รายชื่อในมือถือ (เลื่อนจำนวนเพื่อนได้)
//   table-explorer  แตะแถว = ระเบียน (Record) แตะหัวคอลัมน์ = เขตข้อมูล (Field) + ภารกิจสั้น ๆ
//   pk-tester       ลองตั้งแต่ละคอลัมน์ของตารางหนังสือเป็นคีย์หลัก ระบบไล่ตรวจค่าซ้ำ/ค่าว่าง
//   query-filter    เลือกเงื่อนไข WHERE แล้วดูแถวที่ตรงเงื่อนไขเหลืออยู่ + SQL เปลี่ยนตาม

function Frame({ badge, title, children }: { badge: string; title: string; children: ReactNode }) {
  return (
    <section className="tq-raised p-4 sm:p-5">
      <p className="font-display text-sm text-action dark:text-dq-300">{badge}</p>
      <p className="mb-3 font-display text-lg text-dq-900 dark:text-white">{title}</p>
      {children}
    </section>
  )
}

function Chip({ on, onClick, children, label }: { on: boolean; onClick: () => void; children: ReactNode; label?: string }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={label}
      onClick={onClick}
      className={`tq-press min-h-10 rounded-xl px-3 font-display text-base transition ${
        on
          ? 'bg-action text-white shadow-action'
          : 'bg-white text-dq-700 ring-1 ring-dq-200 hover:bg-dq-50 dark:bg-dq-900 dark:text-dq-100 dark:ring-dq-700 dark:hover:bg-dq-800'
      }`}
    >
      {children}
    </button>
  )
}

function Verdict({ good, children }: { good: boolean; children: ReactNode }) {
  return (
    <motion.p
      role="status"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={`mt-3 rounded-2xl px-4 py-3 font-display ${
        good
          ? 'bg-emerald-50 text-emerald-900 ring-2 ring-mint-400 dark:bg-emerald-950/50 dark:text-emerald-100'
          : 'bg-rose-50 text-rose-900 ring-2 ring-rose-300 dark:bg-rose-950/50 dark:text-rose-100'
      }`}
    >
      {children}
    </motion.p>
  )
}

// ---------- แผนภาพลำดับขั้น ----------
export function DbqFlow({ title, cycle, nodes }: { title: string; cycle?: boolean; nodes: { icon: string; label: string; md: string }[] }) {
  const [active, setActive] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [seen, setSeen] = useState<ReadonlySet<number>>(() => new Set([0]))
  const visit = (i: number) => {
    setActive(i)
    setSeen((s) => (s.has(i) ? s : new Set(s).add(i)))
  }
  useEffect(() => {
    if (!playing) return
    const t = setTimeout(() => {
      const next = active + 1
      if (next < nodes.length) visit(next)
      else {
        if (cycle) visit(0)
        setPlaying(false)
      }
    }, 1500)
    return () => clearTimeout(t)
  }, [playing, active, nodes.length, cycle])
  const node = nodes[active]
  return (
    <Frame badge={cycle ? '🔄 แผนภาพวงจร · แตะแต่ละขั้น' : '🎬 ดูทีละขั้น · แตะแต่ละกล่อง'} title={title}>
      <ol className="flex flex-col items-stretch sm:flex-row sm:flex-wrap sm:items-center">
        {nodes.map((n, i) => {
          const on = i === active
          return (
            <li key={n.label} className="flex flex-col items-center sm:flex-row">
              <button
                type="button"
                aria-pressed={on}
                onClick={() => {
                  setPlaying(false)
                  visit(i)
                }}
                className={`flex w-full min-w-28 items-center gap-2 rounded-2xl px-3 py-2.5 text-left transition sm:w-auto sm:flex-col sm:text-center ${
                  on
                    ? 'tq-glow scale-[1.04] bg-action text-white shadow-action'
                    : 'bg-white text-dq-900 ring-1 ring-dq-200 hover:bg-dq-50 dark:bg-dq-900 dark:text-dq-50 dark:ring-dq-700'
                }`}
              >
                <span className="text-3xl" aria-hidden>
                  {n.icon}
                </span>
                <span className="font-display leading-tight">{n.label}</span>
                {seen.has(i) && !on && <span className="ml-auto text-sm text-mint-500 sm:ml-0">✓</span>}
              </button>
              {i < nodes.length - 1 && (
                <span aria-hidden className={`flex items-center justify-center ${i < active ? 'text-action' : 'text-dq-300 dark:text-dq-600'}`}>
                  <span className="tq-flow-line-v block h-6 w-1 rounded-full sm:hidden" />
                  <span className="tq-flow-line hidden h-1 w-8 rounded-full sm:block" />
                </span>
              )}
            </li>
          )
        })}
        {cycle && (
          <li aria-hidden className="mt-2 self-center rounded-full bg-xp-300/50 px-3 py-1 text-sm font-display text-xp-600 sm:ml-2 sm:mt-0 dark:text-xp-300">
            ↺ วนใหม่ทุกแก้ว
          </li>
        )}
      </ol>
      <div aria-live="polite" className="mt-3 min-h-20">
        <AnimatePresence mode="wait">
          {node && (
            <motion.div
              key={active}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.22 }}
              className="rounded-2xl bg-dq-50 p-3 ring-1 ring-dq-100 dark:bg-dq-950 dark:ring-dq-800"
            >
              <p className="font-display text-dq-700 dark:text-dq-200">
                ขั้นที่ {active + 1}: {node.icon} {node.label}
              </p>
              <DbqMarkdown text={node.md} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => {
            if (!playing && active >= nodes.length - 1) visit(0)
            setPlaying(!playing)
          }}
          className="tq-press inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-action px-3 font-display text-white hover:bg-brand-600"
        >
          {playing ? <Pause className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />}
          {playing ? 'หยุด' : 'เล่นอัตโนมัติ'}
        </button>
        <span className="text-base text-slate-500 dark:text-dq-300">
          ดูแล้ว {seen.size}/{nodes.length} ขั้น{seen.size === nodes.length ? ' 🎉' : ''}
        </span>
      </div>
    </Frame>
  )
}

// ---------- แข่งค้นหาเบอร์เพื่อน ----------
export function searchSteps(n: number) {
  // สมุดจดกระจัดกระจาย: ต้องไล่ดูทีละชื่อ เฉลี่ยครึ่งเล่ม · รายชื่อเรียงในมือถือ: ตัดครึ่งไปเรื่อย ๆ
  return { notebook: Math.ceil(n / 2), phone: Math.max(1, Math.ceil(Math.log2(n))) }
}

function SearchRace() {
  const [n, setN] = useState(500)
  const [t, setT] = useState(0) // เวลาที่ผ่านไป (มิลลิวินาที) ของการแข่ง
  const [running, setRunning] = useState(false)
  const start = useRef(0)
  const steps = searchSteps(n)
  const nbDur = 1500 + (n / 1000) * 4500
  const phDur = 450
  useEffect(() => {
    if (!running) return
    let raf = 0
    const tick = (now: number) => {
      const el = now - start.current
      setT(el)
      if (el < nbDur) raf = requestAnimationFrame(tick)
      else setRunning(false)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [running, nbDur])
  const nb = Math.min(1, t / nbDur)
  const ph = Math.min(1, t / phDur)
  const finished = !running && t > 0
  const lane = (label: string, icon: string, p: number, count: number, unit: string, tone: string) => (
    <div className="rounded-2xl bg-white p-3 ring-1 ring-dq-100 dark:bg-dq-950 dark:ring-dq-800">
      <div className="flex items-center gap-2">
        <motion.span
          className="text-3xl"
          aria-hidden
          animate={running && p < 1 ? { rotate: [0, -12, 12, 0] } : { rotate: 0 }}
          transition={{ repeat: running && p < 1 ? Infinity : 0, duration: 0.5 }}
        >
          {icon}
        </motion.span>
        <span className="font-display">{label}</span>
        <span className="ml-auto font-display tabular-nums text-dq-700 dark:text-dq-200">
          {count.toLocaleString()} {unit}
          {p >= 1 && (running || finished) ? ' ✓ เจอแล้ว' : ''}
        </span>
      </div>
      <div className="mt-2 h-3 overflow-hidden rounded-full bg-dq-100 shadow-[inset_0_1px_3px_rgb(20_45_100/0.18)] dark:bg-dq-800">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${p * 100}%` }} />
      </div>
    </div>
  )
  return (
    <Frame badge="🏁 ลองแข่งดู" title="หาเบอร์ของ “มิว” ใครเจอก่อน?">
      <label className="flex flex-wrap items-center gap-3">
        <span className="font-semibold">มีเพื่อน</span>
        <input
          type="range"
          min={50}
          max={1000}
          step={50}
          value={n}
          disabled={running}
          onChange={(e) => {
            setN(Number(e.target.value))
            setT(0)
          }}
          className="min-w-40 flex-1 accent-action"
        />
        <span className="font-display tabular-nums text-dq-700 dark:text-dq-200">{n.toLocaleString()} คน</span>
      </label>
      <div className="mt-3 space-y-2">
        {lane('สมุดจดกระจัดกระจาย', '📒', nb, Math.round(nb * steps.notebook), 'ชื่อที่ไล่ดู', 'bg-gradient-to-r from-rose-300 to-rose-500')}
        {lane('รายชื่อในมือถือ (เรียงไว้แล้ว)', '📱', ph, Math.round(ph * steps.phone), 'ครั้งที่ค้น', 'bg-gradient-to-r from-action to-mint-400')}
      </div>
      <button
        type="button"
        disabled={running}
        onClick={() => {
          start.current = performance.now()
          setT(0)
          setRunning(true)
        }}
        className="tq-press mt-3 inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-action px-4 font-display text-white shadow-action hover:bg-brand-600 disabled:opacity-60"
      >
        {finished ? <RotateCcw className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />}
        {running ? 'กำลังค้นหา…' : finished ? 'แข่งอีกครั้ง' : 'เริ่มแข่ง'}
      </button>
      {finished && (
        <Verdict good>
          สมุดต้องไล่ดูราว {steps.notebook.toLocaleString()} ชื่อ แต่มือถือค้นแค่ราว {steps.phone} ครั้ง เร็วกว่าประมาณ{' '}
          {Math.round(steps.notebook / steps.phone).toLocaleString()} เท่า เพราะข้อมูลจัดไว้เป็นระเบียบ ลองเลื่อนให้เพื่อนเยอะขึ้นดู
        </Verdict>
      )}
      <p className="mt-2 text-sm text-slate-500 dark:text-dq-400">ตัวเลขเป็นค่าประมาณ: สมุดเฉลี่ยต้องดูครึ่งเล่ม ส่วนรายชื่อที่เรียงแล้วตัดครึ่งไปเรื่อย ๆ</p>
    </Frame>
  )
}

// ---------- ระเบียน (Record) / เขตข้อมูล (Field) ----------
const EXP_COLS = ['รหัสนักเรียน', 'ชื่อเล่น', 'ห้อง', 'ชมรม']
const EXP_ROWS = [
  ['55501', 'มิว', 'ม.5/1', 'ดนตรี'],
  ['55502', 'โอ๊ต', 'ม.5/1', 'ฟุตบอล'],
  ['55503', 'แพรว', 'ม.5/2', 'หุ่นยนต์'],
  ['55504', 'ต้นข้าว', 'ม.5/2', 'ดนตรี'],
]
type Pick = { type: 'row' | 'col'; i: number } | null
const EXP_MISSIONS: { text: string; hit: (p: NonNullable<Pick>) => boolean }[] = [
  { text: 'แตะ “ระเบียน” ของโอ๊ต (ข้อมูลทั้งแถว)', hit: (p) => p.type === 'row' && p.i === 1 },
  { text: 'แตะ “เขตข้อมูล” ที่บอกว่าแต่ละคนอยู่ชมรมอะไร', hit: (p) => p.type === 'col' && p.i === 3 },
  { text: 'แตะ “ระเบียน” ของคนที่อยู่ห้อง ม.5/2 และชมรมดนตรี', hit: (p) => p.type === 'row' && p.i === 3 },
]

function TableExplorer() {
  const [pick, setPick] = useState<Pick>(null)
  const [done, setDone] = useState<ReadonlySet<number>>(() => new Set())
  const choose = (p: NonNullable<Pick>) => {
    setPick(p)
    const m = EXP_MISSIONS.findIndex((x, i) => !done.has(i) && x.hit(p))
    if (m >= 0) setDone((s) => new Set(s).add(m))
  }
  const rowOn = (r: number) => pick?.type === 'row' && pick.i === r
  const colOn = (c: number) => pick?.type === 'col' && pick.i === c
  const allDone = done.size === EXP_MISSIONS.length
  return (
    <Frame badge="👆 แตะเล่นได้" title="แตะเลขแถว = ระเบียน · แตะหัวคอลัมน์ = เขตข้อมูล">
      <div className="overflow-x-auto rounded-2xl ring-1 ring-dq-100 dark:ring-dq-800">
        <table className="w-full border-collapse text-left text-base">
          <thead>
            <tr>
              <th className="w-14 bg-dq-50 dark:bg-dq-900" />
              {EXP_COLS.map((c, i) => (
                <th key={c} className="p-1">
                  <button
                    type="button"
                    aria-pressed={colOn(i)}
                    onClick={() => choose({ type: 'col', i })}
                    className={`w-full rounded-xl px-2 py-2 font-display whitespace-nowrap transition ${
                      colOn(i) ? 'bg-xp-400 text-ink shadow-[0_3px_0_var(--color-xp-600)]' : 'bg-dq-100 text-dq-900 hover:bg-dq-200 dark:bg-dq-800 dark:text-white'
                    }`}
                  >
                    {c} ▾
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {EXP_ROWS.map((row, r) => (
              <tr key={row[0]} className={`transition ${rowOn(r) ? 'bg-db-100 dark:bg-db-700/40' : ''}`}>
                <th className="p-1">
                  <button
                    type="button"
                    aria-pressed={rowOn(r)}
                    aria-label={`แถวที่ ${r + 1}`}
                    onClick={() => choose({ type: 'row', i: r })}
                    className={`grid size-10 place-items-center rounded-xl font-display transition ${
                      rowOn(r) ? 'bg-action text-white shadow-action' : 'bg-dq-100 text-dq-700 hover:bg-dq-200 dark:bg-dq-800 dark:text-dq-100'
                    }`}
                  >
                    {r + 1}
                  </button>
                </th>
                {row.map((cell, c) => (
                  <td
                    key={c}
                    onClick={() => choose({ type: 'row', i: r })}
                    className={`cursor-pointer border-t border-dq-100 px-3 py-2 transition dark:border-dq-800 ${colOn(c) ? 'bg-xp-300/60 dark:bg-xp-500/30' : ''}`}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div aria-live="polite" className="mt-3 min-h-16">
        <AnimatePresence mode="wait">
          {pick ? (
            <motion.div
              key={`${pick.type}${pick.i}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={`rounded-2xl p-3 ${pick.type === 'row' ? 'bg-db-50 dark:bg-db-900/60' : 'bg-xp-300/30 dark:bg-xp-500/15'}`}
            >
              {pick.type === 'row' ? (
                <>
                  <p className="font-display text-db-700 dark:text-db-100">ระเบียน (Record) 1 แถว = ข้อมูลของ “{EXP_ROWS[pick.i]?.[1]}” 1 คน</p>
                  <p className="mt-1 flex flex-wrap gap-1.5">
                    {EXP_ROWS[pick.i]?.map((v, c) => (
                      <span key={c} className="rounded-lg bg-white px-2 py-0.5 text-base ring-1 ring-db-200 dark:bg-dq-950 dark:ring-db-700">
                        {EXP_COLS[c]}: {v}
                      </span>
                    ))}
                  </p>
                </>
              ) : (
                <>
                  <p className="font-display text-xp-600 dark:text-xp-300">เขตข้อมูล (Field) 1 คอลัมน์ = “{EXP_COLS[pick.i]}” ของทุกคน</p>
                  <p className="mt-1">{EXP_ROWS.map((row) => row[pick.i]).join(' · ')}</p>
                </>
              )}
            </motion.div>
          ) : (
            <p className="text-slate-500 dark:text-dq-300">ลองแตะเลข 1–4 หน้าแถว หรือหัวคอลัมน์ดูก่อน</p>
          )}
        </AnimatePresence>
      </div>
      <ol className="mt-3 space-y-1.5">
        {EXP_MISSIONS.map((m, i) => (
          <li key={m.text} className={`flex items-center gap-2 rounded-xl px-3 py-2 ${done.has(i) ? 'bg-emerald-50 dark:bg-emerald-950/40' : 'bg-dq-50 dark:bg-dq-900'}`}>
            <span
              className={`grid size-7 shrink-0 place-items-center rounded-full text-sm font-display ${done.has(i) ? 'bg-mint-500 text-white' : 'bg-white text-dq-700 ring-1 ring-dq-200 dark:bg-dq-950 dark:text-dq-200 dark:ring-dq-700'}`}
            >
              {done.has(i) ? '✓' : i + 1}
            </span>
            <span className={done.has(i) ? 'text-emerald-900 dark:text-emerald-100' : ''}>ภารกิจ: {m.text}</span>
          </li>
        ))}
      </ol>
      {allDone && <Verdict good>ครบ 3 ภารกิจ! ตารางนี้มี {EXP_ROWS.length} ระเบียน และ {EXP_COLS.length} เขตข้อมูล</Verdict>}
    </Frame>
  )
}

// ---------- ทดสอบคีย์หลัก ----------
const PK_COLS = ['รหัสหนังสือ', 'ชื่อหนังสือ', 'ผู้แต่ง', 'หมวด']
const PK_ROWS = [
  ['B101', 'เริ่มต้นเขียนโปรแกรม', 'ครูเอ', 'คอมพิวเตอร์'],
  ['B102', 'เริ่มต้นเขียนโปรแกรม', 'ครูเอ', 'คอมพิวเตอร์'],
  ['B103', 'นิทานดวงดาว', 'ป้าแดง', 'วรรณกรรม'],
  ['B104', 'วิทย์สนุก', '', 'วิทยาศาสตร์'],
  ['B105', 'ดาราศาสตร์ฉบับพกพา', 'ป้าแดง', 'วิทยาศาสตร์'],
]

// ผลตรวจคอลัมน์หนึ่ง: แถวที่ค่าซ้ำ แถวที่ว่าง
export function pkProblems(values: string[]) {
  const count = new Map<string, number>()
  for (const v of values) if (v.trim()) count.set(v, (count.get(v) ?? 0) + 1)
  const dup = values.flatMap((v, i) => (v.trim() && (count.get(v) ?? 0) > 1 ? [i] : []))
  const empty = values.flatMap((v, i) => (v.trim() ? [] : [i]))
  return { dup, empty, ok: dup.length === 0 && empty.length === 0 }
}

function PkTester() {
  const [col, setCol] = useState<number | null>(null)
  const [scan, setScan] = useState(0) // ไล่ตรวจไปแล้วกี่แถว
  const [tested, setTested] = useState<ReadonlyMap<number, boolean>>(() => new Map())
  const values = col == null ? [] : PK_ROWS.map((r) => r[col] ?? '')
  const res = pkProblems(values)
  const scanning = col != null && scan < PK_ROWS.length
  useEffect(() => {
    if (col == null || scan >= PK_ROWS.length) return
    const t = setTimeout(() => setScan((s) => s + 1), 320)
    return () => clearTimeout(t)
  }, [col, scan])
  useEffect(() => {
    if (col != null && scan >= PK_ROWS.length) setTested((m) => (m.has(col) ? m : new Map(m).set(col, res.ok)))
  }, [col, scan, res.ok])
  const seenDup = (r: number) => res.dup.includes(r) && values.slice(0, scan).filter((v) => v === values[r]).length > 1 && r < scan
  return (
    <Frame badge="🔑 ลองเป็นคีย์หลัก" title="ตารางหนังสือห้องสมุด: คอลัมน์ไหนเป็นคีย์หลักได้?">
      <p className="mb-2 text-base text-slate-600 dark:text-dq-300">แตะชื่อคอลัมน์ ระบบจะไล่ตรวจทีละแถวว่ามีค่า “ซ้ำ” หรือ “ว่าง” ไหม</p>
      <div className="mb-3 flex flex-wrap gap-2">
        {PK_COLS.map((c, i) => (
          <Chip
            key={c}
            on={col === i}
            onClick={() => {
              setCol(i)
              setScan(0)
            }}
          >
            {tested.has(i) ? (tested.get(i) ? '✅ ' : '❌ ') : ''}
            {c}
          </Chip>
        ))}
      </div>
      <div className="overflow-x-auto rounded-2xl ring-1 ring-dq-100 dark:ring-dq-800">
        <table className="w-full border-collapse text-left text-base">
          <thead className="bg-dq-100 text-dq-900 dark:bg-dq-800 dark:text-white">
            <tr>
              {PK_COLS.map((c, i) => (
                <th key={c} className={`px-3 py-2 font-display font-medium whitespace-nowrap ${col === i ? 'bg-xp-400 text-ink' : ''}`}>
                  {c}
                  {col === i && <span className="ml-1 rounded bg-ink px-1 text-xs text-white">PK?</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PK_ROWS.map((row, r) => (
              <tr key={row[0]}>
                {row.map((cell, c) => {
                  const active = col === c
                  const checked = active && r < scan
                  const bad = checked && (seenDup(r) || res.empty.includes(r))
                  return (
                    <td
                      key={c}
                      className={`border-t border-dq-100 px-3 py-2 transition-colors duration-200 dark:border-dq-800 ${
                        active && r === scan - 1 && scanning ? 'bg-db-100 dark:bg-db-700/40' : ''
                      } ${bad ? 'tq-shake bg-rose-100 dark:bg-rose-950' : checked ? 'bg-emerald-50 dark:bg-emerald-950/40' : ''}`}
                    >
                      {cell || <span className="text-amber-700 dark:text-amber-300">(ว่าง)</span>}
                      {checked && res.empty.includes(r) && <span className="ml-1 text-sm font-display text-amber-700 dark:text-amber-300">ว่าง!</span>}
                      {checked && seenDup(r) && <span className="ml-1 text-sm font-display text-rose-700 dark:text-rose-300">ซ้ำ!</span>}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {col != null && !scanning && (
        <Verdict good={res.ok}>
          {res.ok
            ? `“${PK_COLS[col]}” ใช้เป็นคีย์หลักได้ ค่าไม่ซ้ำและไม่ว่างเลยสักแถว`
            : `“${PK_COLS[col]}” ใช้ไม่ได้ เพราะ${res.dup.length ? `มีค่าซ้ำ ${res.dup.length} แถว` : ''}${res.dup.length && res.empty.length ? ' และ' : ''}${res.empty.length ? `มีช่องว่าง ${res.empty.length} แถว` : ''}`}
        </Verdict>
      )}
      {tested.size === PK_COLS.length && (
        <p className="mt-2 font-display text-mint-500 dark:text-emerald-300">ทดสอบครบทุกคอลัมน์แล้ว 🎉 คีย์หลักต้องไม่ซ้ำ และห้ามว่าง</p>
      )}
    </Frame>
  )
}

// ---------- สืบค้นด้วย WHERE ----------
const Q_ROWS = [
  { id: '55501', name: 'ณิชา', nickname: 'มิว', room: 'ม.5/1' },
  { id: '55502', name: 'ธนพล', nickname: 'โอ๊ต', room: 'ม.5/1' },
  { id: '55507', name: 'พิมพ์ชนก', nickname: 'มิว', room: 'ม.5/2' },
  { id: '55510', name: 'กานต์', nickname: 'แพรว', room: 'ม.5/2' },
  { id: '55512', name: 'ภูมิ', nickname: 'โอ๊ต', room: 'ม.5/3' },
  { id: '55515', name: 'ปาย', nickname: 'มิว', room: 'ม.5/3' },
]
type QField = 'nickname' | 'room'
const Q_FIELDS: { id: QField; label: string }[] = [
  { id: 'nickname', label: 'nickname (ชื่อเล่น)' },
  { id: 'room', label: 'room (ห้อง)' },
]

export function runQuery(field: QField, value: string | null) {
  return value == null ? Q_ROWS : Q_ROWS.filter((r) => r[field] === value)
}

function QueryFilter() {
  const [field, setField] = useState<QField>('nickname')
  const [value, setValue] = useState<string | null>('มิว')
  const options = [...new Set(Q_ROWS.map((r) => r[field]))]
  const rows = runQuery(field, value)
  return (
    <Frame badge="🔍 ลองสืบค้นเอง" title="เลือกเงื่อนไข แล้วดูว่าฐานข้อมูลตอบอะไรกลับมา">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-16 font-semibold">ค้นจาก</span>
          {Q_FIELDS.map((f) => (
            <Chip
              key={f.id}
              on={field === f.id}
              onClick={() => {
                setField(f.id)
                setValue(null)
              }}
            >
              {f.label}
            </Chip>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-16 font-semibold">เท่ากับ</span>
          <Chip on={value == null} onClick={() => setValue(null)}>
            ทุกคน
          </Chip>
          {options.map((o) => (
            <Chip key={o} on={value === o} onClick={() => setValue(o)}>
              {o}
            </Chip>
          ))}
        </div>
      </div>
      <pre className="mt-3 overflow-x-auto rounded-2xl bg-dq-950 p-4 font-mono text-base text-dq-50 ring-1 ring-dq-800">
        <code>
          <span className="text-db-300">SELECT</span> name, room{'\n'}
          <span className="text-db-300">FROM</span> students
          {value != null && (
            <>
              {'\n'}
              <span className="text-db-300">WHERE</span> {field} = <span className="text-xp-300">'{value}'</span>
            </>
          )}
          ;
        </code>
      </pre>
      <p className="mt-3 font-display text-dq-700 dark:text-dq-200" aria-live="polite">
        ได้ผลลัพธ์ {rows.length} แถว จากทั้งหมด {Q_ROWS.length} แถว
      </p>
      <ul className="mt-2 grid gap-2 sm:grid-cols-2">
        <AnimatePresence initial={false}>
          {rows.map((r) => (
            <motion.li
              key={r.id}
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.2 }}
              className="flex items-center gap-3 rounded-2xl bg-white px-3 py-2 ring-1 ring-dq-100 dark:bg-dq-950 dark:ring-dq-800"
            >
              <span className="grid size-9 place-items-center rounded-full bg-db-50 text-lg dark:bg-db-700/30" aria-hidden>
                🧑‍🎓
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-display">{r.name}</span>
                <span className="text-sm text-slate-500 dark:text-dq-300">
                  {r.nickname} · {r.room}
                </span>
              </span>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
      <p className="mt-2 text-sm text-slate-500 dark:text-dq-400">ไม่ใส่ WHERE = ขอทุกแถว · ใส่ WHERE = ขอเฉพาะแถวที่ตรงเงื่อนไข</p>
    </Frame>
  )
}

// ---------- ดาวกระจายตอนตอบถูก ----------
export function StarBurst() {
  return (
    <span aria-hidden className="pointer-events-none absolute inset-0 grid place-items-center overflow-visible">
      {Array.from({ length: 10 }, (_, i) => {
        const a = (i / 10) * Math.PI * 2
        return (
          <motion.span
            key={i}
            className="absolute text-2xl"
            initial={{ x: 0, y: 0, scale: 0.4, opacity: 1 }}
            animate={{ x: Math.cos(a) * 130, y: Math.sin(a) * 90, scale: 1.1, opacity: 0, rotate: 180 }}
            transition={{ duration: 0.9, ease: 'easeOut' }}
          >
            {i % 3 === 0 ? '✨' : '⭐'}
          </motion.span>
        )
      })}
    </span>
  )
}

// ---------- ตัวช่วยทบทวน: ประตูคีย์หลัก 2 บาน ----------
const PK_CANDIDATES = [
  { text: 'ชื่อเล่น', fail: 0, why: 'เพื่อนชื่อเล่นซ้ำกันได้' },
  { text: 'เบอร์โทร (ไม่บังคับกรอก)', fail: 1, why: 'บางคนไม่กรอก ช่องจึงว่างได้' },
  { text: 'รหัสนักเรียน', fail: -1, why: 'ไม่ซ้ำ และทุกคนต้องมี' },
]
const GATES = ['ประตู 1: ค่าไม่ซ้ำ', 'ประตู 2: ไม่ว่าง']

function PkRules() {
  const [pick, setPick] = useState<number | null>(null)
  const c = pick == null ? null : PK_CANDIDATES[pick]
  // ตำแหน่งที่หยุด: 0 = ตกประตู 1, 1 = ตกประตู 2, 2 = ผ่านเข้าเส้นชัย
  const stop = c == null ? -1 : c.fail < 0 ? 2 : c.fail
  return (
    <Frame badge="🚪 ประตูคีย์หลัก" title="คีย์หลักต้องผ่านทั้ง 2 ประตู">
      <div className="mb-3 flex flex-wrap gap-2">
        {PK_CANDIDATES.map((x, i) => (
          <Chip key={x.text} on={pick === i} onClick={() => setPick(i)}>
            {x.text}
          </Chip>
        ))}
      </div>
      <div className="relative grid grid-cols-3 items-center gap-2 rounded-2xl bg-dq-50 p-3 dark:bg-dq-950">
        {[...GATES, '🏁 เป็นคีย์หลักได้'].map((g, i) => {
          const blocked = c != null && i === stop && stop < 2
          const reached = c != null && i <= stop
          return (
            <div
              key={g}
              className={`relative grid min-h-24 place-items-center rounded-xl p-2 text-center font-display text-base transition ${
                blocked
                  ? 'tq-shake bg-rose-100 text-rose-900 ring-2 ring-rose-300 dark:bg-rose-950 dark:text-rose-100'
                  : reached
                    ? 'bg-emerald-50 text-emerald-900 ring-2 ring-mint-400 dark:bg-emerald-950/50 dark:text-emerald-100'
                    : 'bg-white text-dq-700 ring-1 ring-dq-200 dark:bg-dq-900 dark:text-dq-200 dark:ring-dq-700'
              }`}
            >
              <span>
                {g}
                {blocked && <span className="block text-2xl">⛔</span>}
                {reached && !blocked && <span className="block text-2xl">{i === 2 ? '🔑' : '✅'}</span>}
              </span>
            </div>
          )
        })}
        {c && (
          <motion.span
            key={pick}
            aria-hidden
            className="absolute top-1 left-0 grid size-9 place-items-center rounded-full bg-action text-white shadow-action"
            initial={{ left: '2%' }}
            animate={{ left: `${[14, 47, 80][stop] ?? 80}%` }}
            transition={{ duration: 0.4 + stop * 0.35, ease: 'easeOut' }}
          >
            🧳
          </motion.span>
        )}
      </div>
      {c && (
        <Verdict good={c.fail < 0}>
          {c.text}: {c.fail < 0 ? 'ผ่านทั้ง 2 ประตู' : `ไม่ผ่าน${GATES[c.fail]}`} เพราะ{c.why}
        </Verdict>
      )}
    </Frame>
  )
}

// ---------- ตัวช่วยทบทวน: นับแถว/คอลัมน์ ----------
const GRID_R = 5
const GRID_C = 4

function RecordsGrid() {
  const [mode, setMode] = useState<'row' | 'col' | null>(null)
  const [n, setN] = useState(0)
  const max = mode === 'row' ? GRID_R : GRID_C
  useEffect(() => {
    if (!mode || n >= max) return
    const t = setTimeout(() => setN((x) => x + 1), 420)
    return () => clearTimeout(t)
  }, [mode, n, max])
  const run = (m: 'row' | 'col') => {
    setMode(m)
    setN(0)
  }
  return (
    <Frame badge="🔢 ฝึกนับ" title={`ตารางตัวอย่าง ${GRID_R} แถว × ${GRID_C} คอลัมน์ มีกี่ระเบียน?`}>
      <div className="mb-3 flex flex-wrap gap-2">
        <Chip on={mode === 'row'} onClick={() => run('row')}>
          นับแถว (ระเบียน)
        </Chip>
        <Chip on={mode === 'col'} onClick={() => run('col')}>
          นับคอลัมน์ (เขตข้อมูล)
        </Chip>
      </div>
      <div className="inline-grid gap-1.5" style={{ gridTemplateColumns: `repeat(${GRID_C}, minmax(2.5rem, 4rem))` }}>
        {Array.from({ length: GRID_R * GRID_C }, (_, k) => {
          const r = Math.floor(k / GRID_C)
          const c = k % GRID_C
          const on = mode === 'row' ? r < n : mode === 'col' ? c < n : false
          const label = mode === 'row' && c === 0 && r < n ? r + 1 : mode === 'col' && r === 0 && c < n ? c + 1 : ''
          return (
            <span
              key={k}
              className={`grid h-9 place-items-center rounded-lg font-display text-sm transition-colors duration-300 ${
                on ? (mode === 'row' ? 'bg-db-400 text-white' : 'bg-xp-400 text-ink') : 'bg-dq-100 dark:bg-dq-800'
              }`}
            >
              {label}
            </span>
          )
        })}
      </div>
      <p className="mt-3 min-h-7 font-display text-dq-700 dark:text-dq-200" aria-live="polite">
        {mode && n >= max && (mode === 'row' ? `${GRID_R} แถว = ${GRID_R} ระเบียน (Record)` : `${GRID_C} คอลัมน์ = ${GRID_C} เขตข้อมูล (Field)`)}
      </p>
    </Frame>
  )
}

// ---------- เกมซ้อมสายฟ้าแลบ ----------
const DRILL_SECONDS = 7

export function drillStars(right: number, rounds: number) {
  const p = rounds ? right / rounds : 0
  return p >= 0.9 ? 3 : p >= 0.7 ? 2 : p >= 0.5 ? 1 : 0
}

function readBest(id: string) {
  try {
    return Number(localStorage.getItem(id)) || 0
  } catch {
    return 0
  }
}

export function DrillBlock({ title, groups, items, rounds = 10 }: { title: string; groups: string[]; items: { text: string; group: number }[]; rounds?: number }) {
  const storeId = `dbq-drill:${title}`
  const total = Math.min(rounds, items.length)
  const [phase, setPhase] = useState<'ready' | 'play' | 'end'>('ready')
  const [deck, setDeck] = useState<number[]>([])
  const [i, setI] = useState(0)
  const [score, setScore] = useState(0)
  const [right, setRight] = useState(0)
  const [streak, setStreak] = useState(0)
  const [missed, setMissed] = useState<number[]>([])
  const [feedback, setFeedback] = useState<{ ok: boolean; picked: number | null } | null>(null)
  const [best, setBest] = useState(0)
  const [prevBest, setPrevBest] = useState(0)
  useEffect(() => setBest(readBest(storeId)), [storeId])
  const item = items[deck[i] ?? 0]

  const answer = (g: number | null) => {
    if (feedback || !item) return
    const ok = g === item.group
    setFeedback({ ok, picked: g })
    if (ok) {
      setRight((x) => x + 1)
      setScore((x) => x + 10 + Math.min(streak, 5) * 2)
      setStreak((x) => x + 1)
    } else {
      setStreak(0)
      setMissed((m) => [...m, deck[i] ?? 0])
    }
  }

  // หมดเวลา = นับว่าตอบไม่ทัน
  useEffect(() => {
    if (phase !== 'play' || feedback) return
    const t = setTimeout(() => answer(null), DRILL_SECONDS * 1000)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- นับเวลาใหม่เฉพาะตอนเปลี่ยนข้อ
  }, [phase, feedback, i])

  // แสดงผลสักครู่แล้วไปข้อถัดไป
  useEffect(() => {
    if (!feedback) return
    const t = setTimeout(
      () => {
        setFeedback(null)
        if (i + 1 >= total) {
          setPhase('end')
          setBest((b) => {
            const nb = Math.max(b, score)
            try {
              localStorage.setItem(storeId, String(nb))
            } catch {
              /* โหมดส่วนตัว: ไม่จำสถิติ */
            }
            return nb
          })
        } else setI(i + 1)
      },
      feedback.ok ? 650 : 1500,
    )
    return () => clearTimeout(t)
  }, [feedback, i, total, score, storeId])

  const start = () => {
    const idx = items.map((_, k) => k)
    for (let k = idx.length - 1; k > 0; k--) {
      const j = Math.floor(Math.random() * (k + 1))
      ;[idx[k], idx[j]] = [idx[j] as number, idx[k] as number]
    }
    setPrevBest(best)
    setDeck(idx.slice(0, total))
    setI(0)
    setScore(0)
    setRight(0)
    setStreak(0)
    setMissed([])
    setFeedback(null)
    setPhase('play')
  }

  const stars = drillStars(right, total)
  return (
    <Frame badge="🎮 ซ้อมเร็ว · ไม่คิดคะแนน" title={title}>
      {phase === 'ready' && (
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <p>
            {total} ข้อ ข้อละ {DRILL_SECONDS} วินาที ตอบถูกติดกันได้โบนัสคอมโบ 🔥
          </p>
          {best > 0 && <p className="font-display text-xp-600 dark:text-xp-300">สถิติของฉัน: {best} คะแนน</p>}
          <button type="button" onClick={start} className="tq-press min-h-12 rounded-2xl bg-action px-8 font-display text-lg text-white shadow-action hover:bg-brand-600">
            ▶ เริ่มเลย
          </button>
        </div>
      )}
      {phase === 'play' && item && (
        <div>
          <div className="mb-2 flex items-center justify-between font-display text-base">
            <span>
              ข้อ {i + 1}/{total}
            </span>
            <AnimatePresence>
              {streak >= 2 && (
                <motion.span key={streak} initial={{ scale: 1.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-coral-400">
                  🔥 คอมโบ {streak}
                </motion.span>
              )}
            </AnimatePresence>
            <span className="tabular-nums text-action dark:text-dq-300">{score} คะแนน</span>
          </div>
          <div className="mb-3 h-2 overflow-hidden rounded-full bg-dq-100 dark:bg-dq-800">
            {!feedback && (
              <motion.div
                key={i}
                className="h-full rounded-full bg-gradient-to-r from-mint-400 via-xp-400 to-coral-400"
                initial={{ width: '100%' }}
                animate={{ width: '0%' }}
                transition={{ duration: DRILL_SECONDS, ease: 'linear' }}
              />
            )}
          </div>
          <AnimatePresence mode="wait">
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 24, rotateX: -25 }}
              animate={{ opacity: 1, y: 0, rotateX: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.25 }}
              style={{ transformPerspective: 800 }}
              className={`relative grid min-h-28 place-items-center rounded-2xl px-4 py-5 text-center font-display text-xl shadow-[0_4px_0_var(--color-dq-200)] dark:shadow-[0_4px_0_#0b1630] ${
                feedback ? (feedback.ok ? 'bg-emerald-50 ring-2 ring-mint-400 dark:bg-emerald-950/50' : 'tq-shake bg-rose-50 ring-2 ring-rose-300 dark:bg-rose-950/50') : 'bg-white ring-1 ring-dq-100 dark:bg-dq-900 dark:ring-dq-800'
              }`}
            >
              {item.text}
              {feedback?.ok && <StarBurst />}
            </motion.div>
          </AnimatePresence>
          <div className={`mt-3 grid gap-2 ${groups.length > 2 ? 'sm:grid-cols-3' : 'grid-cols-2'}`}>
            {groups.map((g, k) => {
              const isRight = feedback && k === item.group
              const isWrongPick = feedback && !feedback.ok && feedback.picked === k
              return (
                <button
                  key={g}
                  type="button"
                  disabled={!!feedback}
                  onClick={() => answer(k)}
                  className={`tq-press min-h-14 rounded-2xl px-3 font-display text-base transition ${
                    isRight
                      ? 'bg-mint-500 text-white'
                      : isWrongPick
                        ? 'bg-rose-500 text-white'
                        : 'bg-gradient-to-b from-action to-action-strong text-white shadow-action hover:brightness-110'
                  }`}
                >
                  {g}
                </button>
              )
            })}
          </div>
          <p className="mt-2 min-h-6 text-center font-display" aria-live="polite">
            {feedback && (feedback.ok ? '✓ ถูก!' : feedback.picked == null ? `⏰ หมดเวลา คำตอบคือ ${groups[item.group]}` : `✗ คำตอบคือ ${groups[item.group]}`)}
          </p>
        </div>
      )}
      {phase === 'end' && (
        <div className="space-y-3 text-center">
          <p className="text-4xl" aria-label={`ได้ ${stars} ดาว`}>
            {[0, 1, 2].map((k) => (
              <motion.span
                key={k}
                className="inline-block"
                initial={{ scale: 0, rotate: -90 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.15 * k, type: 'spring', stiffness: 260 }}
              >
                {k < stars ? '⭐' : '☆'}
              </motion.span>
            ))}
          </p>
          <p className="font-display text-xl">
            ถูก {right}/{total} ข้อ · {score} คะแนน
          </p>
          <p className="text-xp-600 dark:text-xp-300">{score > prevBest ? '🏆 สถิติใหม่!' : `สถิติของฉัน: ${best} คะแนน`}</p>
          {missed.length > 0 && (
            <div className="rounded-2xl bg-dq-50 p-3 text-left dark:bg-dq-950">
              <p className="mb-1 font-display">ทบทวนข้อที่พลาด</p>
              <ul className="space-y-1">
                {missed.map((k) => (
                  <li key={k}>
                    {items[k]?.text} → <span className="font-semibold text-action dark:text-dq-300">{groups[items[k]?.group ?? 0]}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <button type="button" onClick={start} className="tq-press inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-action px-5 font-display text-white shadow-action hover:bg-brand-600">
            <RotateCcw className="size-4" aria-hidden /> เล่นอีกครั้ง ทำลายสถิติ
          </button>
        </div>
      )}
    </Frame>
  )
}

// ---------- ผังสรุปปิดคาบ: คำสำคัญทีละคำ + ตารางเดียวกันที่ไฮไลต์ส่วนของคำนั้น ----------
// ลำดับไฮไลต์ตามคำ: ฐานข้อมูล → ตาราง → ระเบียน → เขตข้อมูล → คีย์หลัก → สืบค้น
const RC_TABS = ['นักเรียน', 'หนังสือ', 'การยืมร่ม']
const RC_COLS = ['รหัสนักเรียน', 'ชื่อเล่น', 'ห้อง']
const RC_ROWS = [
  ['55501', 'มิว', 'ม.5/1'],
  ['55502', 'โอ๊ต', 'ม.5/1'],
  ['55507', 'มิว', 'ม.5/2'],
  ['55510', 'แพรว', 'ม.5/2'],
]

function RecapTable({ mode }: { mode: number }) {
  const rowOn = (r: number) => mode === 2 && r === 1
  const colOn = (c: number) => (mode === 3 && c === 1) || (mode === 4 && c === 0)
  const dim = (r: number) => mode === 5 && RC_ROWS[r]?.[1] !== 'มิว'
  return (
    <div className={`rounded-2xl p-3 transition ${mode === 0 ? 'tq-glow bg-db-50 ring-2 ring-db-300 dark:bg-db-900/50' : 'bg-dq-50 dark:bg-dq-950'}`}>
      <p className="mb-2 font-display text-base text-dq-700 dark:text-dq-200">🗄️ ฐานข้อมูลโรงเรียน</p>
      <div className="flex gap-1">
        {RC_TABS.map((t, i) => (
          <span
            key={t}
            className={`rounded-t-xl px-3 py-1 text-sm font-display ${i === 0 ? (mode === 1 ? 'bg-action text-white' : 'bg-white text-dq-900 dark:bg-dq-900 dark:text-white') : 'bg-dq-100 text-slate-500 dark:bg-dq-800 dark:text-dq-300'}`}
          >
            ตาราง{t}
          </span>
        ))}
      </div>
      <div className={`overflow-x-auto rounded-b-xl rounded-tr-xl bg-white transition dark:bg-dq-900 ${mode === 1 ? 'ring-4 ring-action' : 'ring-1 ring-dq-100 dark:ring-dq-800'}`}>
        <table className="w-full border-collapse text-left text-base">
          <thead className="bg-dq-100 text-dq-900 dark:bg-dq-800 dark:text-white">
            <tr>
              {RC_COLS.map((c, i) => (
                <th key={c} className={`px-3 py-2 font-display font-medium whitespace-nowrap transition ${colOn(i) ? 'bg-xp-400 text-ink' : ''}`}>
                  {c}
                  {mode === 4 && i === 0 && <span className="ml-1 rounded bg-ink px-1 text-xs text-white">PK</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {RC_ROWS.map((row, r) => (
              <tr key={row[0]} className={`transition duration-300 ${rowOn(r) ? 'bg-db-100 dark:bg-db-700/40' : ''} ${dim(r) ? 'opacity-25' : ''} ${mode === 5 && !dim(r) ? 'bg-emerald-50 dark:bg-emerald-950/40' : ''}`}>
                {row.map((cell, c) => (
                  <td key={c} className={`border-t border-dq-100 px-3 py-2 transition dark:border-dq-800 ${colOn(c) ? 'bg-xp-300/50 dark:bg-xp-500/25' : ''}`}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <AnimatePresence>
        {mode === 5 && (
          <motion.pre
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-2 overflow-x-auto rounded-xl bg-dq-950 px-3 py-2 font-mono text-sm text-dq-50"
          >
            <span className="text-db-300">SELECT</span> * <span className="text-db-300">FROM</span> students <span className="text-db-300">WHERE</span> nickname = <span className="text-xp-300">'มิว'</span>;
          </motion.pre>
        )}
      </AnimatePresence>
    </div>
  )
}

export function RecapBoard({ items, withTable }: { items: { icon: string; term: string; md: string }[]; withTable: boolean }) {
  const [active, setActive] = useState(0)
  const [seen, setSeen] = useState<ReadonlySet<number>>(() => new Set([0]))
  const [playing, setPlaying] = useState(false)
  const visit = (i: number) => {
    setActive(i)
    setSeen((s) => (s.has(i) ? s : new Set(s).add(i)))
  }
  useEffect(() => {
    if (!playing) return
    const t = setTimeout(() => {
      if (active + 1 < items.length) visit(active + 1)
      else setPlaying(false)
    }, 2600)
    return () => clearTimeout(t)
  }, [playing, active, items.length])
  const item = items[active]
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <ol className="space-y-2">
        {items.map((it, i) => {
          const on = i === active
          return (
            <li key={it.term}>
              <button
                type="button"
                aria-pressed={on}
                onClick={() => {
                  setPlaying(false)
                  visit(i)
                }}
                className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition ${
                  on
                    ? 'tq-glow bg-action text-white shadow-action'
                    : 'bg-white text-dq-900 ring-1 ring-dq-200 hover:bg-dq-50 dark:bg-dq-900 dark:text-dq-50 dark:ring-dq-700'
                }`}
              >
                <span className={`grid size-10 shrink-0 place-items-center rounded-full text-xl ${on ? 'bg-white/20' : 'bg-dq-50 dark:bg-dq-950'}`} aria-hidden>
                  {it.icon}
                </span>
                <span className="min-w-0 flex-1 font-display leading-tight">{it.term}</span>
                {seen.has(i) && !on && <span className="text-mint-500">✓</span>}
              </button>
            </li>
          )
        })}
      </ol>
      <div className="space-y-3">
        <div aria-live="polite" className="min-h-20">
          <AnimatePresence mode="wait">
            {item && (
              <motion.div
                key={active}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="rounded-2xl bg-xp-300/35 p-3 dark:bg-xp-500/15"
              >
                <p className="font-display text-lg text-dq-900 dark:text-white">
                  {item.icon} {item.term}
                </p>
                <DbqMarkdown text={item.md} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        {withTable && <RecapTable mode={active} />}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => {
              if (!playing && active >= items.length - 1) visit(0)
              setPlaying(!playing)
            }}
            className="tq-press inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-action px-3 font-display text-white hover:bg-brand-600"
          >
            {playing ? <Pause className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />}
            {playing ? 'หยุด' : 'เล่นสรุปอัตโนมัติ'}
          </button>
          <span className="text-base text-slate-500 dark:text-dq-300">
            ทบทวนแล้ว {seen.size}/{items.length} คำ{seen.size === items.length ? ' 🎉' : ''}
          </span>
        </div>
      </div>
    </div>
  )
}

export const DBQ_WIDGETS: Record<string, ComponentType> = {
  'search-race': SearchRace,
  'table-explorer': TableExplorer,
  'pk-tester': PkTester,
  'query-filter': QueryFilter,
  'pk-rules': PkRules,
  'records-grid': RecordsGrid,
}
