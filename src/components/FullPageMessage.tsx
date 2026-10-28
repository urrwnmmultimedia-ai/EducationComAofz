import type { ReactNode } from 'react'
import { CrestMedallion } from './shell/Shell'
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
      <div className="tq-card flex w-full max-w-md flex-col items-center gap-4 p-8 text-center">
        {loading ? (
          <>
            <CrestMedallion className="size-16" alt="" />
            <Spinner className="size-8 text-action" />
          </>
        ) : (
          <Doctor className="size-28" />
        )}
        <h1 className="text-xl text-ink">{title}</h1>
        {detail && <div className="text-ink-2">{detail}</div>}
        {action}
      </div>
    </main>
  )
}
