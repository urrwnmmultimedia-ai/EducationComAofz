import { KeyRound, Plus, X } from 'lucide-react'
import { addField, pkHasDuplicates, removeField, type TableSheet, type TableSheetConfig } from './tableSheetModel'

// ใบงานแบบตาราง: ช่องกรอกสำหรับนักเรียน + มุมมองอ่านอย่างเดียวสำหรับครู

const input =
  'w-full rounded-xl border-2 border-dq-200 bg-white px-3 py-2 outline-none focus:border-dq-500 disabled:opacity-70 dark:border-dq-700 dark:bg-dq-950'
const cellInput =
  'w-full min-w-28 rounded-lg border border-transparent bg-transparent px-2 py-1.5 outline-none hover:border-dq-200 focus:border-dq-500 focus:bg-white disabled:hover:border-transparent dark:hover:border-dq-700 dark:focus:bg-dq-950'

export function TableWorksheetEditor({
  sheet,
  cfg,
  disabled,
  onChange,
}: {
  sheet: TableSheet
  cfg: TableSheetConfig
  disabled: boolean
  onChange: (s: TableSheet) => void
}) {
  const set = (patch: Partial<TableSheet>) => onChange({ ...sheet, ...patch })
  const setField = (c: number, v: string) => set({ fields: sheet.fields.map((f, i) => (i === c ? v : f)) })
  const setCell = (r: number, c: number, v: string) =>
    set({ rows: sheet.rows.map((row, ri) => (ri === r ? row.map((x, ci) => (ci === c ? v : x)) : row)) })
  const dup = pkHasDuplicates(sheet)

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1">
          <span className="block font-semibold">ระบบที่เลือก</span>
          <input className={input} maxLength={100} disabled={disabled} placeholder="เช่น ร้านชานม" value={sheet.system} onChange={(e) => set({ system: e.target.value })} />
        </label>
        <label className="block space-y-1">
          <span className="block font-semibold">1. ชื่อตาราง</span>
          <input className={input} maxLength={100} disabled={disabled} placeholder="เช่น เมนูเครื่องดื่ม" value={sheet.table} onChange={(e) => set({ table: e.target.value })} />
        </label>
      </div>

      <div className="space-y-2">
        <p className="font-semibold">
          2–3. เขตข้อมูล (Field) และระเบียน (Record)
          <span className="block text-sm font-normal text-slate-500 dark:text-dq-300">
            แถวหัวตาราง = ชื่อเขตข้อมูล (อย่างน้อย {cfg.minFields}) · แถวล่าง = ระเบียนตัวอย่าง {cfg.rows} ระเบียน · กด <KeyRound className="inline size-4 align-[-0.15em]" aria-hidden /> เพื่อเลือกคีย์หลัก
          </span>
        </p>
        <div className="overflow-x-auto rounded-2xl ring-1 ring-dq-100 dark:ring-dq-800">
          <table className="w-full border-collapse text-left text-base">
            <thead className="bg-dq-100 text-dq-900 dark:bg-dq-800 dark:text-white">
              <tr>
                <th className="w-10 px-2 py-2 text-center text-sm font-normal text-slate-500 dark:text-dq-300">#</th>
                {sheet.fields.map((f, c) => {
                  const isPk = sheet.pk === c
                  return (
                    <th key={c} className={`px-1 py-1 align-top font-medium ${isPk ? 'bg-xp-300/60 dark:bg-xp-300/20' : ''}`}>
                      <div className="flex items-center gap-1">
                        <input
                          className={`${cellInput} font-display`}
                          maxLength={60}
                          disabled={disabled}
                          placeholder={`เขตข้อมูล ${c + 1}`}
                          aria-label={`ชื่อเขตข้อมูลที่ ${c + 1}`}
                          value={f}
                          onChange={(e) => setField(c, e.target.value)}
                        />
                        <button
                          type="button"
                          disabled={disabled}
                          aria-pressed={isPk}
                          aria-label={`เลือกเขตข้อมูลที่ ${c + 1} เป็นคีย์หลัก`}
                          title="เลือกเป็นคีย์หลัก"
                          className={`grid size-8 shrink-0 place-items-center rounded-lg ${isPk ? 'bg-xp-300 text-ink' : 'text-dq-500 hover:bg-dq-50 hover:text-dq-700 dark:text-dq-300 dark:hover:bg-dq-700'}`}
                          onClick={() => set({ pk: isPk ? null : c })}
                        >
                          <KeyRound className="size-4" aria-hidden />
                        </button>
                        {sheet.fields.length > cfg.minFields && !disabled && (
                          <button
                            type="button"
                            aria-label={`ลบเขตข้อมูลที่ ${c + 1}`}
                            title="ลบเขตข้อมูลนี้"
                            className="grid size-8 shrink-0 place-items-center rounded-lg text-dq-500 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950"
                            onClick={() => onChange(removeField(sheet, c))}
                          >
                            <X className="size-4" aria-hidden />
                          </button>
                        )}
                      </div>
                      {isPk && <span className="ml-2 rounded bg-xp-300 px-1 text-xs text-ink">PK</span>}
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {sheet.rows.map((row, r) => (
                <tr key={r}>
                  <td className="border-t border-dq-100 px-2 text-center text-sm text-slate-500 dark:border-dq-800 dark:text-dq-300">{r + 1}</td>
                  {row.map((cell, c) => (
                    <td key={c} className={`border-t border-dq-100 px-1 py-1 dark:border-dq-800 ${sheet.pk === c ? 'bg-xp-300/20 dark:bg-xp-300/10' : ''}`}>
                      <input
                        className={cellInput}
                        maxLength={100}
                        disabled={disabled}
                        aria-label={`ระเบียนที่ ${r + 1} ${sheet.fields[c] || `เขตข้อมูลที่ ${c + 1}`}`}
                        value={cell}
                        onChange={(e) => setCell(r, c, e.target.value)}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!disabled && sheet.fields.length < cfg.maxFields && (
          <button
            type="button"
            className="inline-flex min-h-10 items-center gap-1 rounded-xl px-3 text-dq-700 ring-2 ring-dq-200 hover:bg-dq-50 dark:text-dq-200 dark:ring-dq-700 dark:hover:bg-dq-800"
            onClick={() => onChange(addField(sheet))}
          >
            <Plus className="size-4" aria-hidden /> เพิ่มเขตข้อมูล
          </button>
        )}
        {dup && <p className="text-amber-700 dark:text-amber-300">ค่าในคอลัมน์คีย์หลักซ้ำกัน คีย์หลักต้องไม่ซ้ำ ลองเลือกเขตข้อมูลอื่นหรือแก้ข้อมูล</p>}
      </div>

      <label className="block space-y-1">
        <span className="block font-semibold">
          4. คีย์หลักคือ{' '}
          <span className="rounded bg-xp-300 px-1.5 text-ink">{sheet.pk != null && sheet.fields[sheet.pk]?.trim() ? sheet.fields[sheet.pk] : 'ยังไม่ได้เลือก'}</span>{' '}
          ทำไมจึงไม่ซ้ำกัน
        </span>
        <textarea className={`${input} min-h-24`} maxLength={1000} disabled={disabled} value={sheet.reason} onChange={(e) => set({ reason: e.target.value })} />
      </label>
    </div>
  )
}

// ครูดูใบงานที่ส่งมา
export function TableWorksheetView({ sheet }: { sheet: TableSheet }) {
  return (
    <div className="space-y-3">
      <p>
        <span className="text-slate-500">ระบบ:</span> {sheet.system || '-'} · <span className="text-slate-500">ชื่อตาราง:</span>{' '}
        <span className="font-display">{sheet.table || '-'}</span>
      </p>
      <div className="overflow-x-auto rounded-xl bg-white ring-1 ring-dq-100">
        <table className="w-full border-collapse text-left">
          <thead className="bg-dq-100 text-dq-900">
            <tr>
              {sheet.fields.map((f, c) => (
                <th key={c} className="px-3 py-2 font-display font-medium whitespace-nowrap">
                  {f || <span className="text-slate-400">(ว่าง)</span>}
                  {sheet.pk === c && <span className="ml-1 rounded bg-xp-300 px-1 text-xs text-ink">PK</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sheet.rows.map((row, r) => (
              <tr key={r}>
                {row.map((cell, c) => (
                  <td key={c} className="border-t border-dq-100 px-3 py-2 align-top">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pkHasDuplicates(sheet) && <p className="text-sm text-amber-700">ค่าในคอลัมน์คีย์หลักซ้ำกัน</p>}
      <p className="whitespace-pre-wrap">
        <span className="text-slate-500">เหตุผลที่คีย์หลักไม่ซ้ำ:</span> {sheet.reason || '-'}
      </p>
    </div>
  )
}
