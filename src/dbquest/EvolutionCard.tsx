import { useAuth } from '@/app/AuthContext'
import { ScoreEvolutionCard, type EvoInfo } from '@/components/evolution/ScoreEvolutionCard'
import { EVO_STAGES } from './evolution'
import { EvolutionArt } from './EvolutionArt'

// วิวัฒนาการของ DB Quest: ควาย → คน ตามคะแนนสะสม 0–100 (ขึ้นขั้นใหม่มีหน้าต่างแสดงความยินดี — เฉพาะนักเรียน)
export function EvolutionCard(props: { score: number; info?: EvoInfo; compact?: boolean; className?: string }) {
  const { identity } = useAuth()
  const sid = identity.role === 'student' ? identity.student?.id : null
  return (
    <ScoreEvolutionCard
      {...props}
      stages={EVO_STAGES}
      art={EvolutionArt}
      pathLabel="ควายสู่คน"
      celebrateKey={sid ? `tq-evo-dbq-${sid}` : null}
    />
  )
}
