import type { ComponentType } from 'react'
import { BossBattle } from './BossBattle/BossBattle'
import { IdeaPicker } from './IdeaPicker/IdeaPicker'
import { LogisticsRush } from './LogisticsRush/LogisticsRush'
import { QuizGame } from './QuizGame/QuizGame'
import { SequenceGame } from './SequenceGame/SequenceGame'
import { SortGame } from './SortGame/SortGame'
import { ValueUpShop } from './ValueUpShop/ValueUpShop'
import type { GameConfig } from './shared/schemas'
import type { GameProps } from './shared/types'

// เลือกตัวเกมจาก config.engine (ครูเปลี่ยนเนื้อหาเกมได้โดยไม่ต้องแก้โค้ด)
//   sort     → 5G Time Machine, EV Garage, Problem Detective, Blueprint Builder, Safety Check, IP Hunter
//   sequence → Process Puzzle, Report Order
//   quiz     → อุ่นเครื่อง, Fix the Bug
//   boss     → Boss Battle หน่วย 1–3, Final Quest
//   route    → Logistics Rush · idea → Idea Picker · shop → Value Up Shop
const ENGINES = {
  sort: SortGame,
  sequence: SequenceGame,
  quiz: QuizGame,
  boss: BossBattle,
  route: LogisticsRush,
  idea: IdeaPicker,
  shop: ValueUpShop,
} as const

export function gameComponent(config: GameConfig): ComponentType<GameProps<GameConfig>> {
  return ENGINES[config.engine] as ComponentType<GameProps<GameConfig>>
}

export const ENGINE_LABELS: Record<GameConfig['engine'], string> = {
  sort: 'จัดกลุ่ม',
  sequence: 'เรียงลำดับ',
  quiz: 'ตอบคำถาม',
  boss: 'Boss Battle',
  route: 'ส่งของ + เส้นทาง',
  idea: 'เลือกแนวคิด',
  shop: 'ร้านเพิ่มมูลค่า',
}
