import { BookOpen, Compass, Flag, Hammer, Layers, Network, NotebookPen, ShieldCheck, SquareTerminal, Stethoscope, type LucideIcon } from 'lucide-react'
import type { CourseSession } from '@/content/course'

// ไอคอนหน่วยของ DB Quest (แทนอีโมจิใน course.json)
const UNIT_ICON: Record<number, LucideIcon> = {
  1: BookOpen,
  2: Layers,
  3: Compass,
  4: Network,
  5: Stethoscope,
  6: SquareTerminal,
  7: ShieldCheck,
}

const KIND_ICON: Record<Exclude<CourseSession['kind'], 'lesson'>, LucideIcon> = {
  midterm: NotebookPen,
  project: Hammer,
  final: Flag,
}

export function sessionIcon(s: Pick<CourseSession, 'unit' | 'kind'>): LucideIcon {
  if (s.kind !== 'lesson') return KIND_ICON[s.kind]
  return UNIT_ICON[s.unit ?? 0] ?? BookOpen
}

export function unitIcon(no: number): LucideIcon {
  return UNIT_ICON[no] ?? BookOpen
}
