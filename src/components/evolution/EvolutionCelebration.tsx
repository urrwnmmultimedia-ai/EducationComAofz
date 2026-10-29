import { useEffect, useMemo, useState, type ComponentType, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'

type Art = ComponentType<{ stage: number; className?: string; title?: string }>

const COLORS = ['#f1c443', '#1f56d6', '#3cc48a', '#f0686a', '#8b5cf6', '#38bdf8', '#ffffff']

// พลุ 1 ลูก: ประกายกระจายเป็นวงจากจุดเดียว
function Firework({ x, y, delay, seed }: { x: string; y: string; delay: number; seed: number }) {
  const sparks = useMemo(
    () =>
      Array.from({ length: 22 }, (_, i) => {
        const angle = (i / 22) * Math.PI * 2 + seed
        const dist = 70 + ((i * 37 + seed * 100) % 50)
        return { dx: Math.cos(angle) * dist, dy: Math.sin(angle) * dist, color: COLORS[(i + Math.round(seed * 10)) % COLORS.length] }
      }),
    [seed],
  )
  return (
    <span className="pointer-events-none absolute" style={{ left: x, top: y }} aria-hidden>
      {sparks.map((s, i) => (
        <span
          key={i}
          className="tq-spark absolute size-2 rounded-full"
          style={{ '--dx': `${s.dx}px`, '--dy': `${s.dy}px`, background: s.color, boxShadow: `0 0 8px ${s.color}`, animationDelay: `${delay}ms` } as CSSProperties}
        />
      ))}
    </span>
  )
}

// กระดาษสีโปรยลงทั้งจอ
function Confetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 40 }, (_, i) => ({
        left: `${(i * 97) % 100}%`,
        delay: (i * 113) % 1400,
        dur: 2200 + ((i * 71) % 1600),
        color: COLORS[i % COLORS.length],
        rot: (i * 53) % 360,
      })),
    [],
  )
  return (
    <>
      {pieces.map((p, i) => (
        <span
          key={i}
          className="tq-confetti pointer-events-none absolute -top-4 h-3 w-2 rounded-sm"
          style={{ left: p.left, background: p.color, animationDelay: `${p.delay}ms`, animationDuration: `${p.dur}ms`, rotate: `${p.rot}deg` } as CSSProperties}
          aria-hidden
        />
      ))}
    </>
  )
}

// หน้าต่างแสดงความยินดีกลางจอเมื่อวิวัฒนาการขึ้นขั้นใหม่ (พลุ + กระดาษสี + ตัวละครเด้ง)
export function EvolutionCelebrationModal({
  art: ArtC,
  from,
  to,
  fromName,
  toName,
  tagline,
  onClose,
}: {
  art: Art
  from: number
  to: number
  fromName: string
  toName: string
  tagline: string
  onClose: () => void
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return createPortal(
    <div className="fixed inset-0 z-[60] grid place-items-center overflow-hidden p-4" role="dialog" aria-modal="true" aria-label={`ยินดีด้วย วิวัฒนาการเป็น ${toName}`}>
      <button type="button" className="tq-fade-in absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgb(31_86_214/0.55),rgb(10_21_48/0.85))] backdrop-blur-sm" onClick={onClose} aria-label="ปิด" />
      <Confetti />
      <Firework x="22%" y="26%" delay={150} seed={0.3} />
      <Firework x="78%" y="22%" delay={550} seed={1.1} />
      <Firework x="50%" y="14%" delay={950} seed={2.2} />
      <Firework x="30%" y="72%" delay={1350} seed={0.8} />
      <Firework x="72%" y="70%" delay={1750} seed={1.7} />

      <section className="tq-celebrate relative w-full max-w-sm overflow-hidden rounded-[2rem] bg-gradient-to-b from-white to-brand-50 p-6 text-center shadow-[0_30px_80px_-20px_rgb(0_0_0/0.7)] ring-4 ring-gold-300">
        <span className="tq-rays pointer-events-none absolute left-1/2 top-[5.5rem] size-[26rem] -translate-x-1/2 -translate-y-1/2 rounded-full" aria-hidden />
        <p className="relative font-display text-sm tracking-wide text-gold-600">🎉 วิวัฒนาการสำเร็จ!</p>
        <h2 className="relative mt-1 text-2xl font-bold text-ink">ยินดีด้วย!</h2>

        <div className="relative mt-4 flex items-end justify-center gap-3">
          <span className="grid size-16 place-items-center rounded-full bg-white/80 opacity-70 shadow-inner ring-2 ring-line">
            <ArtC stage={from} className="size-14 grayscale" title={fromName} />
          </span>
          <span className="pb-6 font-display text-2xl text-gold-500" aria-hidden>
            ➜
          </span>
          <span className="tq-hero-pop grid size-36 place-items-center rounded-full bg-[radial-gradient(circle_at_50%_32%,#ffffff,#fff6d6_55%,#f6d77a)] shadow-[inset_0_-8px_16px_rgb(180_130_0/0.25),0_0_40px_rgb(241_196_67/0.7)] ring-4 ring-gold-400">
            <ArtC stage={to} className="size-32 drop-shadow-[0_8px_8px_rgb(20_45_100/0.3)]" title={toName} />
          </span>
        </div>

        <p className="relative mt-4 text-sm text-ink-2">
          จาก “{fromName}” กลายเป็น
        </p>
        <p className="relative text-[1.6rem] font-bold leading-tight text-action-strong">{toName}</p>
        <p className="relative mt-1 text-sm text-ink-2">{tagline}</p>
        <button
          type="button"
          autoFocus
          onClick={onClose}
          className="tq-press relative mt-5 inline-flex min-h-12 items-center justify-center rounded-2xl bg-gradient-to-b from-gold-300 to-gold-400 px-8 font-display text-lg text-ink shadow-[inset_0_1px_0_rgb(255_255_255/0.7),0_5px_0_#a97c06,0_14px_26px_-10px_rgb(0_0_0/0.45)] active:translate-y-1"
        >
          เยี่ยมเลย! 🚀
        </button>
      </section>
    </div>,
    document.body,
  )
}

// จำขั้นล่าสุดที่นักเรียนเห็นไว้ในเบราว์เซอร์ ขึ้นขั้นสูงกว่าเดิมเมื่อไร = เปิดหน้าต่างแสดงความยินดี
// ครั้งแรกที่ยังไม่เคยจำ: จำไว้เฉย ๆ ไม่แสดง (กันเด้งตอนเปิดเว็บครั้งแรก)
export function useEvolutionCelebration(storageKey: string | null, index: number): { from: number; to: number; close: () => void } | null {
  const [shown, setShown] = useState<{ from: number; to: number } | null>(null)
  useEffect(() => {
    if (!storageKey) return
    let prev: number | null = null
    try {
      const raw = localStorage.getItem(storageKey)
      prev = raw == null ? null : Number(raw)
    } catch {
      return
    }
    if (prev != null && Number.isFinite(prev) && index > prev) setShown({ from: prev, to: index })
    if (prev == null || !Number.isFinite(prev) || index > prev) {
      try {
        localStorage.setItem(storageKey, String(index))
      } catch {
        // เก็บไม่ได้: ไม่แสดงซ้ำในรอบนี้อยู่แล้ว
      }
    }
  }, [storageKey, index])
  return shown ? { ...shown, close: () => setShown(null) } : null
}
