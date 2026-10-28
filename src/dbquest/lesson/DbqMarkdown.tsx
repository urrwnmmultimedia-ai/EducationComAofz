import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'

// Markdown ธีม DB Quest (มีโหมดมืด) — ไม่เปิด raw HTML
const components: Components = {
  p: ({ children }) => <p className="my-2">{children}</p>,
  ul: ({ children }) => <ul className="my-2 list-disc space-y-1 pl-6 marker:text-dq-500">{children}</ul>,
  ol: ({ children }) => <ol className="my-2 list-decimal space-y-1 pl-6 marker:font-semibold marker:text-dq-600">{children}</ol>,
  strong: ({ children }) => <strong className="font-semibold text-dq-900 dark:text-white">{children}</strong>,
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-dq-700 underline underline-offset-2 dark:text-dq-300">
      {children}
    </a>
  ),
  code: ({ children }) => <code className="rounded bg-dq-100 px-1 py-0.5 font-mono text-base dark:bg-dq-800">{children}</code>,
}

export function DbqMarkdown({ text }: { text: string }) {
  return (
    <div className="leading-relaxed">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {text}
      </ReactMarkdown>
    </div>
  )
}
