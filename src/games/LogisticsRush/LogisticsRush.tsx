import { useState } from 'react'
import { Button } from '@/components/Button'
import { gradeQuizAnswer, gradeRoute, isAdjacent, shortestPathLength, type Cell } from '@/games/shared/logic'
import { QuizCard } from '@/games/shared/QuizCard'
import type { RouteConfig } from '@/games/shared/schemas'
import type { GameProps, Mistake } from '@/games/shared/types'

// Logistics Rush: ด่านเลือกเทคโนโลยี + ด่านหาเส้นทางสั้นที่สุดบนตาราง
export function LogisticsRush({ config, onFinish, sfx }: GameProps<RouteConfig>) {
  const [phase, setPhase] = useState<'quiz' | 'route'>(config.scenarios.length ? 'quiz' : 'route')
  const [qi, setQi] = useState(0)
  const [gi, setGi] = useState(0)
  const [correct, setCorrect] = useState(0)
  const [mistakes, setMistakes] = useState<Mistake[]>([])
  const total = config.scenarios.length + config.grids.length

  const finishOrNext = (c: number, m: Mistake[], nextGrid: number) => {
    if (nextGrid >= config.grids.length) onFinish({ correct: c, total, mistakes: m })
    else {
      setCorrect(c)
      setMistakes(m)
      setGi(nextGrid)
      setPhase('route')
    }
  }

  if (phase === 'quiz') {
    const item = config.scenarios[qi]
    if (!item) return null
    return (
      <div className="flex flex-col gap-3">
        <p className="font-display text-brand-700">🚚 ด่าน 1: เลือกเทคโนโลยีให้เหมาะกับงาน</p>
        <QuizCard
          key={qi}
          item={item}
          index={qi}
          total={config.scenarios.length}
          onAnswered={(chosen) => {
            const r = gradeQuizAnswer(item, chosen)
            if (r.ok) sfx.correct()
            else sfx.wrong()
            const c = correct + (r.ok ? 1 : 0)
            const m = r.mistake ? [...mistakes, r.mistake] : mistakes
            if (qi + 1 < config.scenarios.length) {
              setCorrect(c)
              setMistakes(m)
              setQi(qi + 1)
            } else finishOrNext(c, m, 0)
          }}
        />
      </div>
    )
  }

  const grid = config.grids[gi]
  if (!grid) return null
  return (
    <RouteBoard
      key={gi}
      grid={grid}
      index={gi}
      count={config.grids.length}
      onDone={(points, path) => {
        if (points === 1) sfx.correct()
        else sfx.wrong()
        const best = shortestPathLength(grid)
        const m =
          points < 1
            ? [...mistakes, { prompt: `เส้นทาง: ${grid.label}`, yours: points === 0 ? 'ไปไม่ถึงปลายทาง' : `${path.length - 1} ช่อง`, correct: `สั้นที่สุด ${best ?? '-'} ช่อง` }]
            : mistakes
        finishOrNext(correct + points, m, gi + 1)
      }}
    />
  )
}

function RouteBoard({
  grid,
  index,
  count,
  onDone,
}: {
  grid: RouteConfig['grids'][number]
  index: number
  count: number
  onDone: (points: number, path: Cell[]) => void
}) {
  const [path, setPath] = useState<Cell[]>([grid.start])
  const walls = new Set(grid.walls.map((w) => `${w[0]},${w[1]}`))
  const last = path[path.length - 1] as Cell
  const inPath = (r: number, c: number) => path.findIndex((p) => p[0] === r && p[1] === c)
  const atGoal = last[0] === grid.goal[0] && last[1] === grid.goal[1]

  const tap = (r: number, c: number) => {
    const idx = inPath(r, c)
    if (idx >= 0) {
      setPath(path.slice(0, idx + 1)) // แตะช่องเดิม = ย้อนกลับถึงตรงนั้น
      return
    }
    if (atGoal || walls.has(`${r},${c}`) || !isAdjacent(last, [r, c])) return
    setPath([...path, [r, c]])
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="font-display text-brand-700">
        🗺️ ด่าน 2 ({index + 1}/{count}): {grid.label}
      </p>
      <p className="text-sm text-slate-500">แตะช่องที่ติดกันทีละช่องจาก 🏭 ไป 🏠 · แตะช่องเดิมเพื่อย้อน · เดินแล้ว {path.length - 1} ช่อง</p>
      <div className="mx-auto grid w-full max-w-md gap-1" style={{ gridTemplateColumns: `repeat(${grid.cols}, minmax(0, 1fr))` }}>
        {Array.from({ length: grid.rows }).flatMap((_, r) =>
          Array.from({ length: grid.cols }).map((__, c) => {
            const isStart = r === grid.start[0] && c === grid.start[1]
            const isGoal = r === grid.goal[0] && c === grid.goal[1]
            const wall = walls.has(`${r},${c}`)
            const step = inPath(r, c)
            const canStep = !wall && step < 0 && !atGoal && isAdjacent(last, [r, c])
            return (
              <button
                key={`${r}-${c}`}
                type="button"
                onClick={() => tap(r, c)}
                aria-label={`แถว ${r + 1} คอลัมน์ ${c + 1}${wall ? ' สิ่งกีดขวาง' : ''}`}
                className={`grid aspect-square place-items-center rounded-lg text-lg font-display transition ${
                  wall
                    ? 'bg-slate-700 text-white'
                    : step >= 0
                      ? 'bg-sun-400 text-amber-950'
                      : canStep
                        ? 'bg-brand-100 ring-2 ring-brand-400'
                        : 'bg-brand-50'
                }`}
              >
                {isStart ? '🏭' : isGoal ? '🏠' : wall ? '🌳' : step > 0 ? step : ''}
              </button>
            )
          }),
        )}
      </div>
      <div className="flex justify-between gap-2">
        <Button variant="ghost" onClick={() => setPath([grid.start])}>
          เริ่มใหม่
        </Button>
        <Button disabled={!atGoal} onClick={() => onDone(gradeRoute(grid, path), path)}>
          🚚 ส่งพัสดุ
        </Button>
      </div>
    </div>
  )
}
