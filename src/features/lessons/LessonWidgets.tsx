import { useState, type ComponentType, type ReactNode } from 'react'
import { motion } from 'framer-motion'

// สื่อโต้ตอบเฉพาะเรื่องในบทเรียน ม.3 — เรียกในเนื้อหาด้วยบรรทัด ":::widget ชื่อ"
//   latency-brake   คาบ 2  ความหน่วงของเครือข่ายกับระยะเบรกรถไร้คนขับ

function WidgetFrame({ title, hint, children }: { title: string; hint: string; children: ReactNode }) {
  return (
    <section className="tq-raised my-5 overflow-hidden">
      <div className="tq-banner px-4 py-3 text-white sm:px-5">
        <p className="font-display text-lg">🕹️ {title}</p>
        <p className="text-sm text-brand-100">{hint}</p>
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  )
}

const btn = 'tq-press rounded-xl px-3 py-2 font-display transition disabled:cursor-not-allowed disabled:opacity-50'

// ---------- คาบ 2: ความหน่วงกับระยะเบรก ----------
const LATENCIES = [100, 50, 20, 5, 1]
const HAZARD_M = 1 // คนข้ามถนนอยู่ห่างจุดที่ระบบตรวจเจอ 1 เมตร (สมมุติ)

function LatencyBrake() {
  const [speed, setSpeed] = useState(60)
  const [ms, setMs] = useState(100)
  const [run, setRun] = useState(0)
  const mps = (speed * 1000) / 3600
  const dist = mps * (ms / 1000)
  const roadM = 4 // ถนนในภาพยาว 4 เมตร
  const pos = Math.min(dist / roadM, 1) * 100
  const hit = dist >= HAZARD_M
  return (
    <WidgetFrame title="ความหน่วงกับรถไร้คนขับ" hint="เลือกความเร็วรถและความหน่วงของเครือข่าย แล้วกดส่งคำสั่งเบรก">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="font-display text-ink">ความเร็วรถ: {speed} กม./ชม.</span>
          <input type="range" min={20} max={120} step={10} value={speed} onChange={(e) => setSpeed(Number(e.target.value))} className="mt-1 w-full accent-[var(--color-action)]" />
        </label>
        <div>
          <span className="font-display text-ink">ความหน่วงของเครือข่าย</span>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {LATENCIES.map((l) => (
              <button
                key={l}
                type="button"
                aria-pressed={ms === l}
                onClick={() => setMs(l)}
                className={`${btn} text-sm ${ms === l ? 'bg-action text-white' : 'bg-white text-ink ring-1 ring-slate-200'}`}
              >
                {l} ms
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="relative mt-4 h-24 overflow-hidden rounded-2xl bg-slate-700">
        <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 bg-[repeating-linear-gradient(90deg,#fde68a_0_24px,transparent_24px_44px)]" aria-hidden />
        {/* ราง: ซ้ายสุด = จุดที่ระบบเห็นคนข้ามถนน ขวาสุด = 4 เมตร */}
        <div className="absolute inset-y-0 left-12 right-4">
          <div className="absolute inset-y-0 border-l-4 border-dashed border-rose-400" style={{ left: `${(HAZARD_M / roadM) * 100}%` }} aria-hidden />
          <span className="absolute top-1 text-2xl" style={{ left: `calc(${(HAZARD_M / roadM) * 100}% + 0.25rem)` }} aria-hidden>
            🚶
          </span>
          <motion.span
            key={run}
            className="absolute bottom-2 -ml-11 text-4xl"
            initial={{ left: '0%' }}
            animate={{ left: run ? `${pos}%` : '0%' }}
            transition={{ duration: run ? Math.max(0.4, ms / 60) : 0, ease: 'linear' }}
            aria-hidden
          >
            <span className="inline-block -scale-x-100">🚗</span>
          </motion.span>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={() => setRun((r) => r + 1)} className={`${btn} bg-rose-600 text-white hover:bg-rose-700`}>
          🛑 ส่งคำสั่งเบรก!
        </button>
        <p className="text-sm text-slate-500">ภาพช้าลงให้เห็นชัด · เส้นแดง = คนข้ามถนนห่าง {HAZARD_M} เมตร</p>
      </div>
      <div aria-live="polite" className="mt-3 rounded-2xl bg-brand-50 p-3">
        <p className="text-ink">
          ความเร็ว {speed} กม./ชม. = {speed.toLocaleString()} × 1,000 ÷ 3,600 ≈ <b>{mps.toFixed(1)} เมตร/วินาที</b>
        </p>
        <p className="text-ink">
          ระหว่างรอคำสั่ง {ms} ms ({(ms / 1000).toString()} วินาที) รถวิ่งไปอีก {mps.toFixed(1)} × {ms / 1000} ≈{' '}
          <b className={hit ? 'text-rose-700' : 'text-emerald-700'}>{dist < 0.1 ? `${(dist * 100).toFixed(1)} เซนติเมตร` : `${dist.toFixed(2)} เมตร`}</b>
        </p>
        {run > 0 && (
          <p className={`tq-verdict mt-1 font-display ${hit ? 'text-rose-700' : 'text-emerald-700'}`}>
            {hit ? '💥 รถไปถึงคนข้ามถนนก่อนได้รับคำสั่ง — อันตราย!' : '✅ รถได้รับคำสั่งทัน หยุดก่อนถึงคนข้ามถนน'}
          </p>
        )}
      </div>
    </WidgetFrame>
  )
}

export const LESSON_WIDGETS: Record<string, ComponentType> = {
  'latency-brake': LatencyBrake,
}
