// ตัวละครนำทาง วาดเองแบบเรียบง่าย (ไม่ได้ลอกจากหนังสือเรียน)
interface CharacterProps {
  className?: string
  title?: string
}

export function Doctor({ className = 'size-20', title = 'ด็อกเตอร์' }: CharacterProps) {
  return (
    <svg viewBox="0 0 120 120" className={className} role="img" aria-label={title}>
      <circle cx="60" cy="60" r="58" fill="#e0f2fe" />
      <path d="M22 118c4-26 18-38 38-38s34 12 38 38z" fill="#fff" stroke="#94a3b8" strokeWidth="2" />
      <path d="M52 80l8 14 8-14" fill="#38bdf8" />
      <circle cx="60" cy="52" r="24" fill="#fcd9b6" />
      <path d="M36 46c0-18 12-26 24-26s24 8 24 26c-6-8-14-10-24-10s-18 2-24 10z" fill="#cbd5e1" />
      <circle cx="51" cy="54" r="7" fill="none" stroke="#334155" strokeWidth="2.5" />
      <circle cx="69" cy="54" r="7" fill="none" stroke="#334155" strokeWidth="2.5" />
      <path d="M58 54h4" stroke="#334155" strokeWidth="2.5" />
      <circle cx="51" cy="54" r="2" fill="#334155" />
      <circle cx="69" cy="54" r="2" fill="#334155" />
      <path d="M52 66c4 4 12 4 16 0" stroke="#334155" strokeWidth="2.5" fill="none" strokeLinecap="round" />
    </svg>
  )
}

export function NamWan({ className = 'size-20', title = 'น้ำหวาน' }: CharacterProps) {
  return (
    <svg viewBox="0 0 120 120" className={className} role="img" aria-label={title}>
      <circle cx="60" cy="60" r="58" fill="#fce7f3" />
      <path d="M24 118c4-24 18-36 36-36s32 12 36 36z" fill="#fb7185" />
      <path d="M30 60c-4-28 12-42 30-42s34 14 30 42l-6 22H36z" fill="#3f2a1d" />
      <circle cx="60" cy="56" r="22" fill="#fde2c8" />
      <path d="M38 50c4-14 14-18 22-18s18 4 22 18c-8-6-14-8-22-8s-14 2-22 8z" fill="#3f2a1d" />
      <circle cx="86" cy="36" r="7" fill="#facc15" />
      <circle cx="52" cy="57" r="3" fill="#1e293b" />
      <circle cx="68" cy="57" r="3" fill="#1e293b" />
      <circle cx="46" cy="64" r="3.5" fill="#fda4af" opacity="0.8" />
      <circle cx="74" cy="64" r="3.5" fill="#fda4af" opacity="0.8" />
      <path d="M54 67c3 3 9 3 12 0" stroke="#1e293b" strokeWidth="2.5" fill="none" strokeLinecap="round" />
    </svg>
  )
}

export function Non({ className = 'size-20', title = 'นนท์' }: CharacterProps) {
  return (
    <svg viewBox="0 0 120 120" className={className} role="img" aria-label={title}>
      <circle cx="60" cy="60" r="58" fill="#dcfce7" />
      <path d="M24 118c4-24 18-36 36-36s32 12 36 36z" fill="#38bdf8" />
      <circle cx="60" cy="56" r="22" fill="#f5c9a0" />
      <path d="M36 52c-2-18 10-28 24-28s28 8 24 28c-4-8-8-10-12-10l-6-6-4 6c-8 0-18 2-26 10z" fill="#1f2937" />
      <path d="M38 40h44l6-6H44z" fill="#7c3aed" />
      <circle cx="52" cy="57" r="3" fill="#1e293b" />
      <circle cx="68" cy="57" r="3" fill="#1e293b" />
      <path d="M52 67c4 4 12 4 16 0" stroke="#1e293b" strokeWidth="2.5" fill="none" strokeLinecap="round" />
    </svg>
  )
}

export function Robot({ className = 'size-20', title = 'หุ่นยนต์' }: CharacterProps) {
  return (
    <svg viewBox="0 0 120 120" className={className} role="img" aria-label={title}>
      <circle cx="60" cy="60" r="58" fill="#ede9fe" />
      <line x1="60" y1="18" x2="60" y2="32" stroke="#64748b" strokeWidth="4" />
      <circle cx="60" cy="16" r="6" fill="#fb7185" />
      <rect x="30" y="32" width="60" height="46" rx="14" fill="#94a3b8" />
      <rect x="38" y="42" width="44" height="22" rx="8" fill="#1e293b" />
      <circle cx="51" cy="53" r="5" fill="#34d399" />
      <circle cx="69" cy="53" r="5" fill="#34d399" />
      <rect x="40" y="82" width="40" height="30" rx="8" fill="#7c3aed" />
      <circle cx="60" cy="96" r="5" fill="#facc15" />
    </svg>
  )
}

export function Cat({ className = 'size-20', title = 'แมวน้อย' }: CharacterProps) {
  return (
    <svg viewBox="0 0 120 120" className={className} role="img" aria-label={title}>
      <circle cx="60" cy="60" r="58" fill="#fef3c7" />
      <path d="M32 46l6-26 18 16zM88 46l-6-26-18 16z" fill="#f59e0b" />
      <circle cx="60" cy="62" r="30" fill="#fbbf24" />
      <circle cx="49" cy="58" r="4" fill="#1e293b" />
      <circle cx="71" cy="58" r="4" fill="#1e293b" />
      <path d="M56 68h8l-4 4z" fill="#fb7185" />
      <path d="M60 72c-2 4-8 4-10 1M60 72c2 4 8 4 10 1" stroke="#1e293b" strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M30 66h14M30 72h14M76 66h14M76 72h14" stroke="#92400e" strokeWidth="1.5" />
    </svg>
  )
}

export function Owl({ className = 'size-20', title = 'นกฮูกนักปราชญ์' }: CharacterProps) {
  return (
    <svg viewBox="0 0 120 120" className={className} role="img" aria-label={title}>
      <circle cx="60" cy="60" r="58" fill="#dcfce7" />
      <path d="M30 40l10-14 10 10h20l10-10 10 14v40c0 18-14 30-30 30S30 98 30 80z" fill="#8b5a2b" />
      <ellipse cx="60" cy="86" rx="18" ry="20" fill="#d6b48c" />
      <circle cx="47" cy="54" r="12" fill="#fff" />
      <circle cx="73" cy="54" r="12" fill="#fff" />
      <circle cx="47" cy="54" r="5" fill="#1e293b" />
      <circle cx="73" cy="54" r="5" fill="#1e293b" />
      <path d="M56 64h8l-4 7z" fill="#f59e0b" />
      <rect x="36" y="22" width="48" height="8" rx="2" fill="#1e293b" />
    </svg>
  )
}

export const AVATARS = {
  non: { label: 'นนท์', Component: Non },
  namwan: { label: 'น้ำหวาน', Component: NamWan },
  doctor: { label: 'ด็อกเตอร์', Component: Doctor },
  robot: { label: 'หุ่นยนต์', Component: Robot },
  cat: { label: 'แมวน้อย', Component: Cat },
  owl: { label: 'นกฮูก', Component: Owl },
} as const

export type AvatarKey = keyof typeof AVATARS

export function Avatar({ name, className }: { name: string; className?: string }) {
  const entry = name in AVATARS ? AVATARS[name as AvatarKey] : AVATARS.non
  const { Component } = entry
  return <Component className={className} title={entry.label} />
}
