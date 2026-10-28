import { isRouteErrorResponse, useRouteError } from 'react-router'
import { Button } from '@/components/Button'
import { FullPageMessage } from '@/components/FullPageMessage'

// หน้าแสดงเมื่อเกิดข้อผิดพลาดที่ไม่คาดคิด (แทนจอขาว)
export function RouteError() {
  const error = useRouteError()
  console.error('[route error]', error)
  const message = error instanceof Error ? error.message : ''
  // หลัง deploy เวอร์ชันใหม่ ไฟล์ชิ้นเก่าอาจหาไม่เจอ — แค่รีเฟรชก็หาย
  const staleChunk = /dynamically imported module|Failed to fetch|Importing a module script failed/i.test(message)
  const notFound = isRouteErrorResponse(error) && error.status === 404

  return (
    <FullPageMessage
      title={notFound ? 'ไม่พบหน้านี้' : staleChunk ? 'เว็บมีการอัปเดตใหม่' : 'เกิดข้อผิดพลาด'}
      detail={
        staleChunk
          ? 'กดรีเฟรชเพื่อโหลดเวอร์ชันล่าสุด'
          : 'ลองรีเฟรชหน้าอีกครั้ง ถ้ายังเป็นอยู่ให้แจ้งครู (งานและคำตอบที่บันทึกแล้วไม่หาย)'
      }
      action={
        <div className="flex gap-2">
          <Button onClick={() => window.location.reload()}>รีเฟรช</Button>
          <Button variant="secondary" onClick={() => window.location.assign('/')}>
            หน้าแรก
          </Button>
        </div>
      }
    />
  )
}
