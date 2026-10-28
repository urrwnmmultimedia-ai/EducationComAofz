export interface GradeStep {
  min: number
  grade: number
}

// เกณฑ์เริ่มต้นตามแนวทางไทย (ครูแก้ได้ใน app_settings.grade_scale)
export const DEFAULT_GRADE_SCALE: readonly GradeStep[] = [
  { min: 80, grade: 4 },
  { min: 75, grade: 3.5 },
  { min: 70, grade: 3 },
  { min: 65, grade: 2.5 },
  { min: 60, grade: 2 },
  { min: 55, grade: 1.5 },
  { min: 50, grade: 1 },
  { min: 0, grade: 0 },
]

// คืนเกรดจากคะแนนรวม (0–100) — ใช้ขั้นที่ min สูงสุดที่คะแนนถึง
export function computeGrade(total: number, scale: readonly GradeStep[] = DEFAULT_GRADE_SCALE): number {
  if (!Number.isFinite(total)) return 0
  const sorted = [...scale].sort((a, b) => b.min - a.min)
  for (const step of sorted) {
    if (total >= step.min) return step.grade
  }
  return 0
}

export function formatGrade(grade: number): string {
  return Number.isInteger(grade) ? `${grade}` : grade.toFixed(1)
}
