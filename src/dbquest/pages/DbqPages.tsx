import type { ReactNode } from 'react'
import { Link, useParams } from 'react-router'
import { NongDataSays } from '@/components/illustrations/NongData'
import { course, findSession, findUnit } from '@/content/course'

// หน้านักเรียน DB Quest ช่วงเฟส 1 — โครงหน้าพร้อมเส้นทาง เนื้อหาจริงมาในเฟสที่ระบุ

function ComingSoon({ title, phase, children }: { title: string; phase: number; children?: ReactNode }) {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl text-dq-900 dark:text-white">{title}</h1>
      <NongDataSays mood="think">
        หน้านี้กำลังสร้างอยู่ จะเปิดใช้ในเฟส {phase}
      </NongDataSays>
      {children}
    </div>
  )
}

export function DbqHomePage() {
  return (
    <div className="space-y-6">
      <NongDataSays mood="cheer">
        <p className="font-display text-xl text-dq-800 dark:text-white">ยินดีต้อนรับสู่ DB Quest!</p>
        <p>ผจญภัยในโลกข้อมูล 7 หน่วย 20 คาบ เรียนจบได้ในเว็บนี้เว็บเดียว</p>
      </NongDataSays>
      <Link
        to="/db/map"
        className="flex min-h-14 items-center justify-center rounded-3xl bg-dq-600 px-6 font-display text-xl text-white shadow-[0_4px_0_0_var(--color-dq-900)] hover:bg-dq-700"
      >
        ไปที่แผนที่การเรียน
      </Link>
      <section className="rounded-3xl bg-white p-5 ring-1 ring-dq-100 dark:bg-dq-900 dark:ring-dq-800">
        <h2 className="mb-3 text-xl text-dq-900 dark:text-white">เรียนจบแล้วเราจะทำอะไรได้</h2>
        <ol className="list-decimal space-y-1 pl-6">
          {course.objectives.map((o) => (
            <li key={o.no}>{o.text}</li>
          ))}
        </ol>
      </section>
    </div>
  )
}

export function DbqLessonPage() {
  const no = Number(useParams().sessionNo)
  const session = findSession(no)
  if (!session) return <ComingSoon title="ไม่พบคาบนี้" phase={3} />
  const unit = findUnit(session.unit)
  return (
    <ComingSoon title={`คาบ ${session.no}: ${session.title}`} phase={3}>
      {unit && (
        <p className="text-slate-600 dark:text-dq-300">
          {unit.icon} หน่วย {unit.no} {unit.title}
        </p>
      )}
      <ol className="grid gap-2 sm:grid-cols-3">
        {course.steps.map((step, i) => (
          <li key={step.id} className="rounded-2xl bg-white p-3 ring-1 ring-dq-100 dark:bg-dq-900 dark:ring-dq-800">
            <span className="block text-sm text-slate-500 dark:text-dq-300">ขั้นที่ {i + 1}</span>
            <span className="font-display">{step.title}</span>
            <span className="block text-sm text-xp-600 dark:text-xp-400">{step.minutes} นาที</span>
          </li>
        ))}
      </ol>
    </ComingSoon>
  )
}

export function DbqGamePage() {
  return <ComingSoon title={`เกม ${useParams().gameKey ?? ''}`} phase={4} />
}

export function DbqSqlPage() {
  return <ComingSoon title="SQL Playground" phase={6} />
}

export function DbqGlossaryPage() {
  return <ComingSoon title="พจนานุกรมศัพท์" phase={4} />
}

export function DbqAssignmentsPage() {
  return <ComingSoon title="งานของฉัน" phase={8} />
}

export function DbqExamPage() {
  return <ComingSoon title="แบบทดสอบ" phase={8} />
}

export function DbqMePage() {
  return <ComingSoon title="คะแนนของฉัน" phase={8} />
}
