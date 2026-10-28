import type { ReactNode } from 'react'
import { Spinner } from './Button'
import { Doctor } from './characters/Characters'

interface Props {
  title: string
  detail?: ReactNode
  loading?: boolean
  action?: ReactNode
}

export function FullPageMessage({ title, detail, loading, action }: Props) {
  return (
    <main className="grid min-h-dvh place-items-center p-6">
      <div className="flex max-w-md flex-col items-center gap-4 text-center">
        {loading ? <Spinner className="size-10 text-brand-600" /> : <Doctor className="size-28" />}
        <h1 className="text-xl text-brand-900">{title}</h1>
        {detail && <div className="text-slate-600">{detail}</div>}
        {action}
      </div>
    </main>
  )
}
