import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { Button } from '@/components/Button'
import { ErrorBlock, LoadingBlock } from '@/components/StatusViews'
import type { GameRow } from '@/lib/database.types'
import { supabase } from '@/lib/supabase'
import { useAsync } from '@/lib/useAsync'
import { ENGINE_LABELS } from '@/games/registry'
import { parseGameConfig } from '@/games/shared/schemas'

async function fetchGamesWithStats() {
  const [g, p] = await Promise.all([
    supabase.from('games').select('*').order('title'),
    supabase.from('game_plays').select('game_id, student_id, score'),
  ])
  if (g.error) throw g.error
  if (p.error) throw p.error
  return { games: g.data, plays: p.data }
}

export function AdminGamesPage() {
  const state = useAsync(fetchGamesWithStats, [])
  if (state.status === 'loading') return <LoadingBlock />
  if (state.status === 'error') return <ErrorBlock message={state.error} onRetry={state.reload} />
  const { games, plays } = state.data

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl text-brand-900">เกม</h1>
        <p className="text-sm text-slate-500">แก้คำถาม/การ์ดของเกม ดูสถิติ และทดลองเล่น (ทดลองเล่นไม่บันทึกคะแนน)</p>
      </div>
      <div className="overflow-x-auto rounded-3xl bg-white shadow-sm ring-1 ring-brand-100">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-brand-50 text-slate-600">
            <tr>
              <th className="px-3 py-2 font-medium">เกม</th>
              <th className="px-3 py-2 font-medium">รูปแบบ</th>
              <th className="px-3 py-2 font-medium">XP สูงสุด</th>
              <th className="px-3 py-2 font-medium">เล่น (คน / รอบ)</th>
              <th className="px-3 py-2 font-medium">คะแนนเฉลี่ย</th>
              <th className="px-3 py-2 font-medium">จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {games.map((g) => {
              const mine = plays.filter((p) => p.game_id === g.id)
              const players = new Set(mine.map((p) => p.student_id)).size
              const avg = mine.length ? Math.round(mine.reduce((s, p) => s + p.score, 0) / mine.length) : null
              const parsed = parseGameConfig(g.config)
              return (
                <tr key={g.id} className={`border-t border-brand-50 ${g.is_active ? '' : 'opacity-50'}`}>
                  <td className="px-3 py-2">
                    <span className="font-display">{g.title}</span>
                    <span className="block text-xs text-slate-400">{g.slug}</span>
                  </td>
                  <td className="px-3 py-2">{parsed.ok ? ENGINE_LABELS[parsed.config.engine] : <span className="text-rose-600">config ผิดรูปแบบ</span>}</td>
                  <td className="px-3 py-2">{g.max_xp}</td>
                  <td className="px-3 py-2">
                    {players} / {mine.length}
                  </td>
                  <td className="px-3 py-2">{avg ?? '–'}</td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1">
                      <Link to={`/admin/games/${g.slug}`} className="rounded-lg px-2 py-1 font-display text-brand-700 hover:bg-brand-100">
                        แก้ไข
                      </Link>
                      <Link to={`/games/${g.slug}?preview=1`} className="rounded-lg px-2 py-1 text-slate-600 hover:bg-brand-100">
                        ทดลองเล่น
                      </Link>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function AdminGameEditPage() {
  const slug = useParams().slug ?? ''
  const state = useAsync(async () => {
    const { data, error } = await supabase.from('games').select('*').eq('slug', slug).maybeSingle()
    if (error) throw error
    return data
  }, [slug])
  if (state.status === 'loading') return <LoadingBlock />
  if (state.status === 'error') return <ErrorBlock message={state.error} onRetry={state.reload} />
  if (!state.data) return <ErrorBlock message="ไม่พบเกม" />
  return <GameForm key={state.data.id} game={state.data} />
}

const INPUT = 'w-full rounded-xl border-2 border-brand-100 bg-white px-3 py-2 outline-none focus:border-brand-500'

function GameForm({ game }: { game: GameRow }) {
  const [title, setTitle] = useState(game.title)
  const [description, setDescription] = useState(game.description)
  const [maxXp, setMaxXp] = useState(game.max_xp)
  const [minDuration, setMinDuration] = useState(game.min_duration_sec)
  const [active, setActive] = useState(game.is_active)
  const [json, setJson] = useState(() => JSON.stringify(game.config, null, 2))
  const [status, setStatus] = useState<{ kind: 'idle' | 'saving' | 'saved' | 'error'; text?: string }>({ kind: 'idle' })

  let jsonError: string | null = null
  let parsedJson: unknown = null
  try {
    parsedJson = JSON.parse(json)
    const r = parseGameConfig(parsedJson)
    if (!r.ok) jsonError = r.error
  } catch {
    jsonError = 'JSON ไม่ถูกต้อง (ตรวจเครื่องหมาย , " { } ให้ครบ)'
  }

  const save = async () => {
    if (status.kind === 'saving' || jsonError) return
    if (maxXp < 0 || maxXp > 500) return setStatus({ kind: 'error', text: 'XP สูงสุดต้องอยู่ระหว่าง 0–500' })
    setStatus({ kind: 'saving' })
    const { error } = await supabase
      .from('games')
      .update({ title: title.trim(), description: description.trim(), max_xp: maxXp, min_duration_sec: Math.max(0, minDuration), is_active: active, config: parsedJson as GameRow['config'] })
      .eq('id', game.id)
    setStatus(error ? { kind: 'error', text: 'บันทึกไม่สำเร็จ' } : { kind: 'saved' })
  }

  return (
    <div className="flex flex-col gap-5">
      <nav className="text-sm text-slate-500">
        <Link to="/admin/games" className="hover:text-brand-700">
          เกม
        </Link>
        {' / '}
        {game.title}
      </nav>
      <section className="grid gap-4 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-brand-100 sm:grid-cols-2 sm:p-6">
        <label className="flex flex-col gap-1">
          <span className="text-sm text-slate-600">ชื่อเกม</span>
          <input className={INPUT} value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-slate-600">คำอธิบาย</span>
          <input className={INPUT} value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-slate-600">XP สูงสุด (รอบแรก)</span>
          <input className={INPUT} type="number" min={0} max={500} value={maxXp} onChange={(e) => setMaxXp(Number(e.target.value))} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-slate-600">เวลาเล่นขั้นต่ำ (วินาที) — กันกดข้ามเพื่อเก็บ XP</span>
          <input className={INPUT} type="number" min={0} value={minDuration} onChange={(e) => setMinDuration(Number(e.target.value))} />
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" className="size-5 accent-brand-600" checked={active} onChange={(e) => setActive(e.target.checked)} />
          เปิดให้เล่น
        </label>
        <label className="flex flex-col gap-1 sm:col-span-2">
          <span className="text-sm text-slate-600">
            เนื้อหาเกม (JSON) — ดัชนีคำตอบ <code>answer</code> เริ่มที่ 0 · รูปแบบเกม: <code>engine</code>
          </span>
          <textarea className={`${INPUT} min-h-[28rem] font-mono text-xs`} spellCheck={false} value={json} onChange={(e) => setJson(e.target.value)} />
        </label>
        <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
          <Button loading={status.kind === 'saving'} disabled={!!jsonError} onClick={() => void save()}>
            บันทึก
          </Button>
          <Link to={`/games/${game.slug}?preview=1`} className="font-display text-brand-700 underline underline-offset-4">
            ทดลองเล่น (บันทึกก่อน)
          </Link>
          {jsonError ? <span className="text-sm text-rose-600">⚠️ {jsonError}</span> : <span className="text-sm text-mint-500">รูปแบบถูกต้อง ✓</span>}
          {status.kind === 'saved' && <span className="text-mint-500">บันทึกแล้ว ✓</span>}
          {status.kind === 'error' && <span className="text-rose-600">{status.text}</span>}
        </div>
      </section>
    </div>
  )
}
