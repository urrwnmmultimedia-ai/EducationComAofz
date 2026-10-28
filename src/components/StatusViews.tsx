import type { ReactNode } from 'react'
import { Button, Spinner } from './Button'

export function LoadingBlock({ label = 'กำลังโหลด…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 rounded-3xl bg-white p-8 text-slate-500 ring-1 ring-brand-100" role="status">
      <Spinner className="size-6 text-brand-600" />
      {label}
    </div>
  )
}

export function ErrorBlock({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-3xl bg-rose-50 p-6 text-center text-rose-700 ring-1 ring-rose-100" role="alert">
      <p>{message}</p>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          ลองใหม่
        </Button>
      )}
    </div>
  )
}

export function EmptyBlock({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-3xl border-2 border-dashed border-brand-200 bg-white/60 p-6 text-center text-slate-500">{children}</div>
  )
}

export function ProgressBar({ value, className = '' }: { value: number; className?: string }) {
  const pct = Math.max(0, Math.min(100, value))
  return (
    <div
      className={`h-2.5 overflow-hidden rounded-full bg-brand-100 ${className}`}
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className="h-full rounded-full bg-gradient-to-r from-mint-400 to-mint-500 transition-[width] duration-500" style={{ width: `${pct}%` }} />
    </div>
  )
}
