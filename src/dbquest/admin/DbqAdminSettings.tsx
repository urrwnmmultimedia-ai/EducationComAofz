import { useState } from 'react'
import { Link } from 'react-router'
import { ErrorBlock, LoadingBlock } from '@/components/StatusViews'
import { useAsync } from '@/lib/useAsync'
import { btn, input, PageHeader, panel } from './adminUi'
import { CATEGORIES, CATEGORY_LABEL, fetchSettings, saveSetting, type DbqSettings } from './dbqAdminApi'
import { weightsTotal } from './gradebookModel'

export function DbqAdminSettings() {
  const res = useAsync(fetchSettings, [])
  if (res.status === 'loading') return <LoadingBlock />
  if (res.status === 'error') return <ErrorBlock message={res.error} onRetry={res.reload} />
  return <SettingsForm initial={res.data} />
}

function SettingsForm({ initial }: { initial: DbqSettings }) {
  const [weights, setWeights] = useState<Record<string, string>>(() =>
    Object.fromEntries(CATEGORIES.map((c) => [c, String(initial.score_weights[c] ?? 0)])),
  )
  const [leaderboard, setLeaderboard] = useState(initial.leaderboard_enabled)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  const nums = Object.fromEntries(CATEGORIES.map((c) => [c, Number(weights[c])]))
  const sum = weightsTotal(nums)
  const weightsOk = CATEGORIES.every((c) => Number.isFinite(nums[c]) && (nums[c] ?? -1) >= 0) && sum === 100

  const save = async () => {
    setBusy(true)
    setMsg(null)
    try {
      await saveSetting('score_weights', nums)
      await saveSetting('leaderboard_enabled', leaderboard)
      setMsg({ ok: true, text: 'บันทึกแล้ว' })
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="max-w-2xl space-y-4">
      <PageHeader title="ตั้งค่า DB Quest" />
      <p className="text-sm text-slate-600">
        ชื่อโรงเรียน ความยาวรหัสนักเรียน การล็อกอุปกรณ์ และรหัสครู ใช้ร่วมกันทั้งเว็บ ตั้งได้ที่{' '}
        <Link to="/admin/settings" className="font-semibold text-action-strong hover:underline">
          ตั้งค่าระบบ
        </Link>
      </p>
      <section className={`${panel} space-y-3`}>
        <h2 className="text-lg text-dq-900">น้ำหนักคะแนน (รวม 100)</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {CATEGORIES.map((c) => (
            <label key={c} className="flex items-center justify-between gap-2 rounded-xl bg-dq-50 px-3 py-2">
              <span>{CATEGORY_LABEL[c]}</span>
              <input
                className={`${input} w-20 text-right`}
                inputMode="decimal"
                value={weights[c]}
                onChange={(e) => setWeights((w) => ({ ...w, [c]: e.target.value }))}
              />
            </label>
          ))}
        </div>
        <p className={`font-display ${sum === 100 ? 'text-emerald-700' : 'text-rose-600'}`}>รวม {sum} / 100</p>
      </section>

      <section className={`${panel} space-y-3`}>
        <h2 className="text-lg text-dq-900">การเรียน</h2>
        <p className="text-sm text-slate-600">คาบเปิดเฉพาะที่ครูเปิดในหน้า “ปลดล็อกคาบ” เท่านั้น</p>
        <label className="flex items-center gap-2">
          <input type="checkbox" className="size-5" checked={leaderboard} onChange={(e) => setLeaderboard(e.target.checked)} />
          <span>แสดงอันดับ XP ในห้องให้นักเรียนเห็น</span>
        </label>
      </section>

      <div className="flex items-center gap-3">
        <button type="button" className={btn.primary} disabled={busy || !weightsOk} onClick={() => void save()}>
          {busy ? 'กำลังบันทึก…' : 'บันทึก'}
        </button>
        {msg && <p className={msg.ok ? 'text-emerald-700' : 'text-rose-600'}>{msg.text}</p>}
      </div>
    </div>
  )
}
