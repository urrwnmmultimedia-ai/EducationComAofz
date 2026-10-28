import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  loading?: boolean
  loadingText?: string
  children: ReactNode
}

// primary = สีน้ำเงินของทั้งเว็บ (สิ่งที่กดแล้วไปต่อ) · secondary = ขาวมีขอบ · ghost = ข้อความ
const VARIANTS: Record<Variant, string> = {
  primary: 'bg-action text-white shadow-action hover:bg-brand-600 hover:-translate-y-px',
  secondary:
    'bg-white text-ink ring-1 ring-line shadow-[inset_0_1px_0_rgb(255_255_255),0_1px_2px_rgb(20_45_100/0.1),0_6px_14px_-8px_rgb(20_45_100/0.35)] hover:-translate-y-px hover:ring-brand-300',
  ghost: 'text-ink-2 hover:bg-white/70 hover:text-ink',
  danger: 'bg-white text-rose-700 ring-1 ring-rose-200 hover:bg-rose-50',
}

// ปุ่มกลางของระบบ: ระหว่าง loading จะ disabled เสมอ (กันกดซ้ำ)
export function Button({
  variant = 'primary',
  loading = false,
  loadingText = 'กำลังบันทึก…',
  disabled,
  className = '',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      aria-busy={loading}
      className={`tq-press inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl px-5 py-2.5 text-base font-semibold disabled:cursor-not-allowed disabled:opacity-55 disabled:shadow-none ${VARIANTS[variant]} ${className}`}
    >
      {loading && <Spinner />}
      {loading ? loadingText : children}
    </button>
  )
}

export function Spinner({ className = 'size-4' }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="4" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    </svg>
  )
}
