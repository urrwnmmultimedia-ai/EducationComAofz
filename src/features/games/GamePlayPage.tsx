import { useCallback } from 'react'
import { useParams, useSearchParams } from 'react-router'
import { ErrorBlock, LoadingBlock } from '@/components/StatusViews'
import { useAsync } from '@/lib/useAsync'
import { GameShell } from '@/games/shared/GameShell'
import { parseGameConfig } from '@/games/shared/schemas'
import { gameComponent } from '@/games/registry'
import { markStepDone } from '@/features/lessons/lessonsApi'
import { fetchGame, submitGameResult } from './gamesApi'

export function GamePlayPage() {
  const slug = useParams().slug ?? ''
  const [params] = useSearchParams()
  const preview = params.get('preview') === '1' // ครูทดลองเล่น: ไม่ส่งผล
  // เปิดจากขั้น "เกม" ในคาบ: เล่นจบแล้วกลับคาบเดิม และบันทึกขั้นเกมให้เลย
  const fromSession = Number(params.get('session')) || null
  const state = useAsync(() => fetchGame(slug), [slug])
  const onSubmit = useCallback(
    async (score: number, duration: number) => {
      if (preview) return { xp: 0, first_play: false, plays_today: 0, daily_limit: 3, capped: false, best_score: score, new_badges: [] }
      const result = await submitGameResult(slug, score, duration)
      if (fromSession) await markStepDone(fromSession, 'game').catch(() => undefined)
      return result
    },
    [slug, preview, fromSession],
  )

  if (state.status === 'loading') return <LoadingBlock label="กำลังโหลดเกม…" />
  if (state.status === 'error') return <ErrorBlock message={state.error} onRetry={state.reload} />
  if (!state.data || !state.data.is_active) return <ErrorBlock message="ไม่พบเกมนี้" />
  const parsed = parseGameConfig(state.data.config)
  if (!parsed.ok) return <ErrorBlock message={`ข้อมูลเกมไม่ถูกต้อง กรุณาแจ้งครู (${parsed.error})`} />

  return (
    <GameShell
      title={state.data.title}
      description={state.data.description}
      config={parsed.config}
      Game={gameComponent(parsed.config)}
      onSubmit={onSubmit}
      backTo={preview ? '/admin/games' : fromSession ? `/sessions/${fromSession}?after=game` : '/games'}
      backLabel={fromSession ? `ไปขั้นต่อไปของคาบ ${fromSession}` : 'กลับหน้าเกม'}
      maxXp={state.data.max_xp}
    />
  )
}
