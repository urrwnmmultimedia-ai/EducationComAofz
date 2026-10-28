import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'

// ไม่เปิด raw HTML (ปลอดภัยจาก XSS) — ลิงก์ภายนอกเปิดแท็บใหม่
const components: Components = {
  h2: ({ children }) => <h3 className="mt-4 text-lg text-brand-900">{children}</h3>,
  h3: ({ children }) => <h4 className="mt-3 font-display text-brand-800">{children}</h4>,
  p: ({ children }) => <p className="my-2">{children}</p>,
  ul: ({ children }) => <ul className="my-2 list-disc space-y-1 pl-6 marker:text-brand-500">{children}</ul>,
  ol: ({ children }) => <ol className="my-2 list-decimal space-y-1 pl-6 marker:font-semibold marker:text-brand-600">{children}</ol>,
  strong: ({ children }) => <strong className="font-semibold text-brand-900">{children}</strong>,
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-brand-700 underline underline-offset-2">
      {children}
    </a>
  ),
  img: ({ src, alt }) => (
    <img src={typeof src === 'string' ? src : undefined} alt={alt ?? ''} loading="lazy" className="my-3 max-h-96 rounded-2xl" />
  ),
  table: ({ children }) => (
    <div className="my-3 overflow-x-auto rounded-2xl ring-1 ring-brand-100">
      <table className="w-full min-w-[480px] border-collapse text-left text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-brand-100 text-brand-900">{children}</thead>,
  th: ({ children }) => <th className="px-3 py-2 font-display font-medium">{children}</th>,
  td: ({ children }) => <td className="border-t border-brand-50 px-3 py-2 align-top">{children}</td>,
  blockquote: ({ children }) => <blockquote className="my-3 rounded-2xl bg-brand-50 px-4 py-2 italic text-slate-600">{children}</blockquote>,
  code: ({ children }) => <code className="rounded bg-brand-50 px-1 py-0.5 text-sm">{children}</code>,
}

export function Markdown({ text }: { text: string }) {
  return (
    <div className="leading-relaxed text-slate-700">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {text}
      </ReactMarkdown>
    </div>
  )
}
