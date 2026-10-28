import { useCallback, useEffect, useState } from 'react'
import type { AssignmentRow, SubmissionRow } from '@/lib/database.types'
import {
  isContentEmpty,
  isValidHttpUrl,
  normalizeRows,
  parseContent,
  parseTableConfig,
  validateFile,
  type SubmissionContent,
} from './assignmentModel'
import { removeSubmissionFile, saveSubmission, signedUrls, uploadSubmissionFile } from './assignmentsApi'

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

// state และการบันทึกของฟอร์มส่งงาน (แยก logic ออกจาก UI)
export function useAssignmentForm(assignment: AssignmentRow, studentId: string, initial: SubmissionRow | null) {
  const tableConfig = parseTableConfig(assignment.config)
  const [submission, setSubmission] = useState<SubmissionRow | null>(initial)
  const [content, setContent] = useState<SubmissionContent>(() => {
    const c = parseContent(initial?.content ?? {})
    return assignment.type === 'table' ? { ...c, rows: normalizeRows(c.rows, tableConfig) } : c
  })
  const [files, setFiles] = useState<string[]>(initial?.file_paths ?? [])
  const [fileUrls, setFileUrls] = useState<Map<string, string>>(new Map())
  const [status, setStatus] = useState<SaveStatus>('idle')
  const [message, setMessage] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  const locked = submission?.status === 'graded'
  const busy = status === 'saving' || uploading

  useEffect(() => {
    let cancelled = false
    signedUrls(files).then(
      (m) => !cancelled && setFileUrls(m),
      () => undefined,
    )
    return () => {
      cancelled = true
    }
  }, [files])

  const update = useCallback((patch: Partial<SubmissionContent>) => {
    setContent((c) => ({ ...c, ...patch }))
    setStatus('idle')
  }, [])

  const persist = useCallback(
    async (nextStatus: 'draft' | 'submitted', nextFiles = files) => {
      const saved = await saveSubmission({ assignmentId: assignment.id, studentId, content, filePaths: nextFiles, status: nextStatus })
      setSubmission(saved)
      return saved
    },
    [assignment.id, studentId, content, files],
  )

  const save = useCallback(
    async (nextStatus: 'draft' | 'submitted') => {
      if (busy || locked) return
      if (nextStatus === 'submitted') {
        if (isContentEmpty(assignment.type, content, files.length)) {
          setStatus('error')
          setMessage('ยังไม่มีคำตอบ กรอกงานก่อนกดส่งนะ')
          return
        }
        if (assignment.type === 'link' && !isValidHttpUrl(content.url ?? '')) {
          setStatus('error')
          setMessage('ลิงก์ไม่ถูกต้อง ต้องขึ้นต้นด้วย https://')
          return
        }
      }
      setStatus('saving')
      setMessage(null)
      try {
        await persist(nextStatus)
        setStatus('saved')
        setMessage(nextStatus === 'submitted' ? 'ส่งงานแล้ว ✓' : 'บันทึกฉบับร่างแล้ว ✓')
      } catch {
        setStatus('error')
        setMessage('บันทึกไม่สำเร็จ ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่')
      }
    },
    [assignment.type, busy, content, files.length, locked, persist],
  )

  const addFiles = useCallback(
    async (list: FileList | File[]) => {
      if (busy || locked) return
      const arr = Array.from(list)
      const problem = arr.map(validateFile).find((m) => m !== null)
      if (problem) {
        setStatus('error')
        setMessage(problem)
        return
      }
      if (files.length + arr.length > 10) {
        setStatus('error')
        setMessage('แนบไฟล์ได้ไม่เกิน 10 ไฟล์')
        return
      }
      setUploading(true)
      setMessage(null)
      try {
        const paths: string[] = []
        for (const f of arr) paths.push(await uploadSubmissionFile(studentId, assignment.id, f))
        const next = [...files, ...paths]
        setFiles(next)
        // บันทึกรายชื่อไฟล์ทันที กันไฟล์หายถ้าเน็ตหลุด (สถานะเดิมคงไว้)
        await persist(submission?.status === 'submitted' ? 'submitted' : 'draft', next)
        setStatus('saved')
        setMessage('อัปโหลดแล้ว ✓')
      } catch {
        setStatus('error')
        setMessage('อัปโหลดไม่สำเร็จ ลองใหม่อีกครั้ง')
      } finally {
        setUploading(false)
      }
    },
    [assignment.id, busy, files, locked, persist, studentId, submission?.status],
  )

  const removeFile = useCallback(
    async (path: string) => {
      if (busy || locked) return
      setUploading(true)
      try {
        const next = files.filter((p) => p !== path)
        await persist(submission?.status === 'submitted' ? 'submitted' : 'draft', next)
        setFiles(next)
        await removeSubmissionFile(path).catch(() => undefined)
      } catch {
        setStatus('error')
        setMessage('ลบไฟล์ไม่สำเร็จ')
      } finally {
        setUploading(false)
      }
    },
    [busy, files, locked, persist, submission?.status],
  )

  return { tableConfig, submission, content, files, fileUrls, status, message, uploading, locked, busy, update, save, addFiles, removeFile }
}
