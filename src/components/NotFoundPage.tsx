import { Link } from 'react-router'
import { FullPageMessage } from './FullPageMessage'

export function NotFoundPage() {
  return (
    <FullPageMessage
      title="ไม่พบหน้านี้"
      detail="ลิงก์อาจผิด หรือหน้านี้ยังไม่เปิดให้ใช้งาน"
      action={
        <Link to="/" className="rounded-2xl bg-brand-600 px-5 py-2.5 font-display text-white">
          กลับหน้าแรก
        </Link>
      }
    />
  )
}
