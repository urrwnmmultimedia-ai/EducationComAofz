import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  loading?: boolean
  loadingText?: string
  children: ReactNode
}

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700 shadow-[0_4px_0_0_var(--color-brand-900)] active:translate-y-0.5 active:shadow-[0_2px_0_0_var(--color-brand-900)]',
  secondary: 'bg-white text-brand-700 ring-2 ring-brand-200 hover:bg-brand-100',
  ghost: 'text-brand-700 hover:bg-brand-100',
  danger: 'bg-coral-400 text-white hover:brightness-95',
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
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl px-5 py-2.5 font-display text-base font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${VARIANTS[variant]} ${className}`}
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
