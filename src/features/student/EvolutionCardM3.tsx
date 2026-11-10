import { ScoreEvolutionCard, type EvoInfo } from '@/components/evolution/ScoreEvolutionCard'
import type { GradeStep } from '@/lib/grade'
import { EvolutionArtM3 } from './EvolutionArtM3'
import { M3_STAGES } from './evolutionM3'
import { useViewer } from './viewer'

export type { EvoInfo }

// วิวัฒนาการของ ม.3: ลิง → คน ตามคะแนนรวม 0–100 (ขึ้นขั้นใหม่มีหน้าต่างแสดงความยินดี — เฉพาะนักเรียน)
export function EvolutionCardM3(props: { score: number; gradeScale?: readonly GradeStep[]; info?: EvoInfo; compact?: boolean; className?: string }) {
  const { student, isPreview } = useViewer()
  return (
    <ScoreEvolutionCard
      {...props}
      stages={M3_STAGES}
      art={EvolutionArtM3}
      pathLabel="ลิงสู่คน"
      celebrateKey={student && !isPreview ? `tq-evo12-m3-${student.id}` : null}
    />
  )
}
