import { useState } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/Button'
import { gradeShop } from '@/games/shared/logic'
import type { ShopConfig } from '@/games/shared/schemas'
import type { GameProps, Mistake } from '@/games/shared/types'

// Value Up Shop: เลือกอัปเกรดภายใต้งบ ระบบคำนวณมูลค่าที่เพิ่มขึ้น เทียบแผนที่ดีที่สุด
export function ValueUpShop({ config, onFinish, sfx }: GameProps<ShopConfig>) {
  const [pi, setPi] = useState(0)
  const [picked, setPicked] = useState<boolean[]>(() => (config.products[0]?.upgrades ?? []).map(() => false))
  const [scores, setScores] = useState<number[]>([])
  const [mistakes, setMistakes] = useState<Mistake[]>([])
  const product = config.products[pi]
  if (!product) return null
  const r = gradeShop(product, picked)

  const confirm = () => {
    if (r.overBudget) return
    if (r.pct >= 80) sfx.correct()
    else sfx.wrong()
    const s = [...scores, r.pct]
    const m =
      r.pct < 100
        ? [...mistakes, { prompt: `${product.emoji} ${product.name}`, yours: `มูลค่าเพิ่ม ${r.value} บาท`, correct: `แผนที่ดีที่สุดเพิ่มได้ ${r.best} บาท ภายในงบ ${product.budget} บาท`, explain: 'เลือกอัปเกรดที่ให้มูลค่าต่อต้นทุนคุ้มที่สุด' }]
        : mistakes
    if (pi + 1 >= config.products.length) {
      onFinish({ correct: s.filter((x) => x === 100).length, total: config.products.length, mistakes: m, scoreOverride: s.reduce((a, b) => a + b, 0) / s.length })
    } else {
      setScores(s)
      setMistakes(m)
      setPi(pi + 1)
      setPicked((config.products[pi + 1]?.upgrades ?? []).map(() => false))
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-4 rounded-3xl bg-gradient-to-r from-sun-300/50 to-mint-400/30 p-4">
        <span className="text-6xl" aria-hidden>
          {product.emoji}
        </span>
        <div className="flex-1">
          <p className="font-display text-xl text-slate-800">
            {product.name} {config.products.length > 1 && <span className="text-sm text-slate-500">({pi + 1}/{config.products.length})</span>}
          </p>
          <p className="text-slate-700">
            ราคาเดิม {product.basePrice} บาท →{' '}
            <motion.b key={r.value} initial={{ scale: 1.4 }} animate={{ scale: 1 }} className="inline-block text-emerald-800">
              {product.basePrice + r.value} บาท
            </motion.b>
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm text-slate-600">งบที่ใช้</p>
          <p className={`font-display text-2xl ${r.overBudget ? 'text-rose-600' : 'text-brand-700'}`}>
            {r.cost} / {product.budget}
          </p>
        </div>
      </div>

      <ul className="grid gap-2 sm:grid-cols-2">
        {product.upgrades.map((u, i) => (
          <li key={u.name}>
            <button
              type="button"
              aria-pressed={picked[i]}
              onClick={() => setPicked(picked.map((p, j) => (j === i ? !p : p)))}
              className={`flex w-full items-start justify-between gap-3 rounded-2xl p-3 text-left ring-2 transition ${picked[i] ? 'bg-brand-600 text-white ring-brand-600' : 'bg-white ring-brand-100 hover:ring-brand-300'}`}
            >
              <span>
                <span className="block font-display">{u.name}</span>
                <span className={`text-xs ${picked[i] ? 'text-brand-100' : 'text-slate-500'}`}>{u.kind}</span>
              </span>
              <span className="shrink-0 text-right text-sm">
                ต้นทุน {u.cost}
                <span className={`block font-display ${picked[i] ? 'text-sun-300' : 'text-emerald-700'}`}>+{u.value}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      {r.overBudget && <p className="text-center text-rose-600">เกินงบแล้ว! ยกเลิกบางรายการก่อน</p>}
      <Button className="self-end" disabled={r.overBudget || !picked.some(Boolean)} onClick={confirm}>
        ✓ ยืนยันแผนเพิ่มมูลค่า
      </Button>
    </div>
  )
}
