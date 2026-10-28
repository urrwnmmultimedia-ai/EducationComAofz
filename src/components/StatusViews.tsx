import type { ReactNode } from 'react'
import { AlertTriangle, Inbox } from 'lucide-react'
import { Button, Spinner } from './Button'

export function LoadingBlock({ label = 'กำลังโหลด…' }: { label?: string }) {
  return (
    <div
      className="tq-card flex items-center justify-center gap-3 p-8 text-ink-2 dark:bg-dq-900 dark:text-dq-200 dark:ring-dq-800"
      role="status"
    >
      <Spinner className="size-6 text-action" />
      {label}
    </div>
  )
}

export function ErrorBlock({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div
      className="flex flex-col items-center gap-3 rounded-[1.75rem] bg-rose-50 p-6 text-center text-rose-800 ring-1 ring-rose-200 dark:bg-rose-950/40 dark:text-rose-100 dark:ring-rose-900"
      role="alert"
    >
      <AlertTriangle className="size-7" aria-hidden />
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
    <div className="flex flex-col items-center gap-2 rounded-[1.75rem] border-2 border-dashed border-line bg-white/50 p-6 text-center text-ink-2">
      <Inbox className="size-7 text-slate-400" aria-hidden />
      {children}
    </div>
  )
}

export function ProgressBar({ value, className = '' }: { value: number; className?: string }) {
  const pct = Math.max(0, Math.min(100, value))
  return (
    <div
      className={`h-2.5 overflow-hidden rounded-full bg-surface dark:bg-dq-800 ${className}`}
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className="h-full rounded-full bg-mint-500 transition-[width] duration-700 ease-[var(--ease-out-expo)]" style={{ width: `${pct}%` }} />
    </div>
  )
}
