import type { ReactNode } from 'react'
import { NongDataSays } from '@/components/illustrations/NongData'

// หน้านักเรียน DB Quest ช่วงเฟส 1 — โครงหน้าพร้อมเส้นทาง เนื้อหาจริงมาในเฟสที่ระบุ

function ComingSoon({ title, phase, children }: { title: string; phase: number; children?: ReactNode }) {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl text-ink dark:text-white">{title}</h1>
      <NongDataSays mood="think">
        หน้านี้ยังไม่เปิดใช้ จะเปิดเมื่อเรียนถึงช่วงนั้น (เฟส {phase})
      </NongDataSays>
      {children}
    </div>
  )
}


export function DbqSqlPage() {
  return <ComingSoon title="SQL Playground" phase={6} />
}

export function DbqGlossaryPage() {
  return <ComingSoon title="พจนานุกรมศัพท์" phase={4} />
}

export function DbqExamPage() {
  return <ComingSoon title="แบบทดสอบ" phase={8} />
}
