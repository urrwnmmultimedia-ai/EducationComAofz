import type { AssignmentRow, SubmissionRow } from '@/lib/database.types'
import { normalizeRows, parseContent, parseTableConfig } from './assignmentModel'

// แสดงงานที่นักเรียนส่ง (ใช้ในหน้าตรวจงานของครู)
export function SubmissionView({
  assignment,
  submission,
  fileUrls,
}: {
  assignment: AssignmentRow
  submission: SubmissionRow
  fileUrls: Map<string, string>
}) {
  const content = parseContent(submission.content)
  const config = parseTableConfig(assignment.config)

  return (
    <div className="flex flex-col gap-3">
      {assignment.type === 'table' && (
        <div className="overflow-x-auto rounded-2xl ring-1 ring-brand-100">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead className="bg-brand-100 text-brand-900">
              <tr>
                {config.columns.map((c) => (
                  <th key={c} className="px-3 py-2 font-display font-medium">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {normalizeRows(content.rows, config).map((row, r) => (
                <tr key={r} className="border-t border-brand-50">
                  {row.map((cell, c) => (
                    <td key={c} className="whitespace-pre-wrap px-3 py-2 align-top">
                      {cell || <span className="text-slate-300">–</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {content.text && <p className="whitespace-pre-wrap rounded-2xl bg-brand-50 p-4">{content.text}</p>}
      {content.url && (
        <a href={content.url} target="_blank" rel="noopener noreferrer" className="break-all text-brand-700 underline">
          {content.url}
        </a>
      )}
      {submission.file_paths.length > 0 && <FileList paths={submission.file_paths} urls={fileUrls} />}
      {!content.text && !content.url && !content.rows && submission.file_paths.length === 0 && (
        <p className="text-slate-500">ยังไม่มีเนื้อหา</p>
      )}
    </div>
  )
}

export function FileList({ paths, urls, onRemove, disabled }: { paths: string[]; urls: Map<string, string>; onRemove?: (p: string) => void; disabled?: boolean }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {paths.map((p, i) => {
        const url = urls.get(p)
        const isPdf = p.toLowerCase().endsWith('.pdf')
        return (
          <li key={p} className="overflow-hidden rounded-2xl bg-white ring-1 ring-brand-100">
            {url && !isPdf ? (
              <a href={url} target="_blank" rel="noopener noreferrer">
                <img src={url} alt={`ไฟล์แนบ ${i + 1}`} className="h-44 w-full bg-slate-50 object-contain" loading="lazy" />
              </a>
            ) : (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="grid h-24 place-items-center bg-brand-50 font-display text-brand-700"
              >
                📄 {isPdf ? 'เปิดไฟล์ PDF' : 'กำลังโหลด…'}
              </a>
            )}
            <div className="flex items-center justify-between px-3 py-2 text-sm text-slate-500">
              ไฟล์ที่ {i + 1}
              {onRemove && (
                <button type="button" disabled={disabled} onClick={() => onRemove(p)} className="text-rose-600 disabled:opacity-40">
                  ลบ
                </button>
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
