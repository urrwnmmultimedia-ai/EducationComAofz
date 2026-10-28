import type { ComponentType } from 'react'

// ภาพประกอบบทเรียน (SVG ในโค้ด) — ชื่อต้องตรงกับ "name" ของบล็อก figure ใน sNN.json
// สีใช้ currentColor + คลาสธีม เพื่อให้อ่านได้ทั้งโหมดสว่างและมืด

function DataToInformation() {
  const raw = ['72', '65', '88', '91', '54', '70']
  return (
    <svg viewBox="0 0 360 200" className="h-auto w-full max-w-md text-dq-700 dark:text-dq-200" role="presentation">
      {raw.map((n, i) => (
        <g key={n} transform={`translate(${30 + (i % 3) * 38}, ${20 + Math.floor(i / 3) * 34})`}>
          <rect width="32" height="26" rx="6" className="fill-dq-100 dark:fill-dq-800" />
          <text x="16" y="18" textAnchor="middle" fontSize="13" fill="currentColor">
            {n}
          </text>
        </g>
      ))}
      <text x="85" y="108" textAnchor="middle" fontSize="12" fill="currentColor">
        ข้อมูล (Data)
      </text>
      <path d="M150 30 L210 30 L192 80 L192 110 L168 110 L168 80 Z" className="fill-xp-300 dark:fill-xp-500" />
      <text x="180" y="130" textAnchor="middle" fontSize="11" fill="currentColor">
        ประมวลผล
      </text>
      <path d="M215 70 L240 70" stroke="currentColor" strokeWidth="2" markerEnd="url(#dti-arrow)" />
      <defs>
        <marker id="dti-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0 0 L10 5 L0 10 Z" fill="currentColor" />
        </marker>
      </defs>
      {[40, 62, 50, 80].map((h, i) => (
        <rect key={i} x={255 + i * 22} y={110 - h} width="16" height={h} rx="3" className="fill-dq-500" />
      ))}
      <line x1="250" y1="110" x2="345" y2="110" stroke="currentColor" strokeWidth="1.5" />
      <text x="298" y="130" textAnchor="middle" fontSize="12" fill="currentColor">
        สารสนเทศ (Information)
      </text>
      <text x="298" y="150" textAnchor="middle" fontSize="11" fill="currentColor">
        เฉลี่ย 73 คะแนน
      </text>
    </svg>
  )
}

export const FIGURES: Record<string, ComponentType> = {
  DataToInformation,
}
