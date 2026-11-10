import { useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CircleCheck, KeyRound, Plus, X } from 'lucide-react'
import { addField, missingParts, pageMissing, pkHasDuplicates, removeField, sheetPages, type TableSheet, type TableSheetConfig } from './tableSheetModel'

// ใบงานตารางแบบทีละหน้า (คาบแบบใหม่): เลือกระบบ → ตาราง/เขตข้อมูล → ระเบียน → คีย์หลัก → สืบค้น → ตรวจทานแล้วส่ง
// เก็บรูปแบบเดียวกับ TableWorksheetEditor (serializeSheet) ครูตรวจหน้าเดิมได้

const input =
  'w-full rounded-xl border-2 bg-white px-3 py-2.5 outline-none shadow-[inset_0_2px_4px_rgb(15_31_61/0.06)] focus:border-dq-500 disabled:opacity-70 dark:bg-dq-950'
const tone = (v: string) => (v.trim() ? 'border-mint-400 dark:border-emerald-600' : 'border-dq-200 dark:border-dq-700')
const navBtn =
  'tq-press min-h-12 rounded-2xl px-4 font-display text-dq-700 ring-2 ring-dq-200 hover:bg-dq-50 disabled:opacity-50 dark:text-dq-200 dark:ring-dq-700 dark:hover:bg-dq-800'
const nextBtn =
  'tq-press min-h-12 rounded-2xl bg-action px-6 font-semibold text-white shadow-action hover:bg-brand-600 disabled:opacity-50 disabled:shadow-none'

const SYSTEMS = ['ร้านชานม', 'ห้องสมุด', 'ชมรมในโรงเรียน', 'แอปเกม', 'ร้านค้าออนไลน์']

function Field({ label, hint, children }: { label: ReactNode; hint?: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="block font-display text-dq-900 dark:text-white">{label}</span>
      {hint && <span className="block text-sm text-slate-500 dark:text-dq-300">{hint}</span>}
      {children}
    </label>
  )
}

function Tip({ children }: { children: ReactNode }) {
  return <p className="rounded-2xl bg-xp-300/35 px-4 py-2.5 text-base dark:bg-xp-500/15">💡 {children}</p>
}

// ตารางของนักเรียนเอง (ใช้ซ้ำหลายหน้า)
export function SheetPreview({ sheet, highlightPk = true }: { sheet: TableSheet; highlightPk?: boolean }) {
  const cols = sheet.fields.map((f, i) => ({ f, i })).filter((c) => c.f.trim())
  if (cols.length === 0) return null
  return (
    <div className="overflow-x-auto rounded-2xl ring-1 ring-dq-100 dark:ring-dq-800">
      <p className="bg-dq-50 px-3 py-1.5 font-display text-base dark:bg-dq-900">ตาราง: {sheet.table.trim() || '(ยังไม่ตั้งชื่อ)'}</p>
      <table className="w-full border-collapse text-left text-base">
        <thead className="bg-dq-100 text-dq-900 dark:bg-dq-800 dark:text-white">
          <tr>
            {cols.map(({ f, i }) => (
              <th key={i} className={`px-3 py-2 font-display font-medium whitespace-nowrap ${highlightPk && sheet.pk === i ? 'bg-xp-300 text-ink' : ''}`}>
                {f}
                {highlightPk && sheet.pk === i && <span className="ml-1 rounded bg-ink px-1 text-xs text-white">PK</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sheet.rows.map((row, r) => (
            <tr key={r}>
              {cols.map(({ i }) => (
                <td key={i} className={`border-t border-dq-100 px-3 py-2 dark:border-dq-800 ${highlightPk && sheet.pk === i ? 'bg-xp-300/25 dark:bg-xp-500/15' : ''}`}>
                  {row[i] || <span className="text-slate-400">…</span>}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function WorksheetWizard({
  sheet,
  cfg,
  disabled,
  onChange,
  submit,
}: {
  sheet: TableSheet
  cfg: TableSheetConfig
  disabled: boolean
  onChange: (s: TableSheet) => void
  // ปุ่มส่ง + ข้อความผล (แสดงหน้าสุดท้าย)
  submit: ReactNode
}) {
  const pages = sheetPages(cfg)
  const all = [...pages, { id: 'review' as const, icon: '📋', title: 'ตรวจทานแล้วส่ง', parts: [] as string[] }]
  const [at, setAt] = useState(() => {
    const first = pages.findIndex((p) => pageMissing(sheet, cfg, p).length > 0)
    return first < 0 ? pages.length : first
  })
  const page = all[at]!
  const set = (patch: Partial<TableSheet>) => onChange({ ...sheet, ...patch })
  const setField = (c: number, v: string) => set({ fields: sheet.fields.map((f, i) => (i === c ? v : f)) })
  const setCell = (r: number, c: number, v: string) => set({ rows: sheet.rows.map((row, ri) => (ri === r ? row.map((x, ci) => (ci === c ? v : x)) : row)) })
  const missingHere = page.id === 'review' ? missingParts(sheet, cfg) : pageMissing(sheet, cfg, page)
  const doneAt = (i: number) => {
    const p = all[i]!
    return p.id === 'review' ? missingParts(sheet, cfg).length === 0 : pageMissing(sheet, cfg, p).length === 0
  }
  // ไปหน้าไหนได้: หน้าที่ผ่านมาแล้วทุกหน้าครบ (ครูตรวจแล้ว = ดูได้ทุกหน้า)
  const reachable = (i: number) => disabled || all.slice(0, i).every((_, k) => k >= pages.length || doneAt(k))
  const go = (i: number) => setAt(Math.max(0, Math.min(all.length - 1, i)))
  const named = sheet.fields.map((f, i) => ({ f: f.trim(), i })).filter((x) => x.f)
  const dup = pkHasDuplicates(sheet)

  return (
    <div className="space-y-5">
      <nav aria-label="หน้าของใบงาน" className="tq-raised overflow-x-auto p-3 sm:p-4">
        <ol className="mx-auto flex w-max items-start">
          {all.map((p, i) => {
            const on = i === at
            const ok = doneAt(i)
            const can = reachable(i)
            return (
              <li key={p.id} className="flex items-start">
                <button
                  type="button"
                  disabled={!can}
                  onClick={() => go(i)}
                  aria-current={on ? 'step' : undefined}
                  aria-label={`หน้า ${i + 1} ${p.title}${ok ? ' ครบแล้ว' : ''}`}
                  className="flex w-20 flex-col items-center gap-1 text-center disabled:opacity-45 sm:w-24"
                >
                  <span
                    className={`relative grid size-12 place-items-center rounded-full text-2xl transition ${
                      on
                        ? 'tq-orb tq-glow scale-110'
                        : ok
                          ? 'bg-radial-[at_32%_28%] from-mint-400 to-mint-500 shadow-[inset_0_3px_6px_rgb(255_255_255/0.45)]'
                          : 'bg-white ring-2 ring-dq-200 dark:bg-dq-900 dark:ring-dq-700'
                    }`}
                  >
                    <span aria-hidden>{p.icon}</span>
                  </span>
                  <span className={`text-sm leading-tight ${on ? 'font-semibold text-action dark:text-dq-200' : 'text-ink-2 dark:text-dq-300'}`}>
                    {i + 1}. {p.title}
                  </span>
                </button>
                {i < all.length - 1 && (
                  <span aria-hidden className={`mt-6 ${ok ? 'text-mint-500' : 'text-dq-300 dark:text-dq-600'}`}>
                    <span className="tq-flow-line block h-1 w-5 rounded-full sm:w-10" />
                  </span>
                )}
              </li>
            )
          })}
        </ol>
      </nav>

      <AnimatePresence mode="wait">
        <motion.section
          key={page.id}
          initial={{ opacity: 0, rotateY: -10, x: 32 }}
          animate={{ opacity: 1, rotateY: 0, x: 0 }}
          exit={{ opacity: 0, x: -24 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          style={{ transformPerspective: 1300 }}
          className="tq-raised space-y-4 p-5 sm:p-6"
        >
          <div className="flex items-center gap-3">
            <span className="tq-orb grid size-12 shrink-0 place-items-center rounded-full text-2xl" aria-hidden>
              {page.icon}
            </span>
            <div>
              <p className="text-sm font-semibold text-action dark:text-dq-300">
                หน้า {at + 1}/{all.length}
              </p>
              <h3 className="text-xl leading-tight text-dq-900 dark:text-white">{page.title}</h3>
            </div>
          </div>

          {page.id === 'system' && (
            <>
              <Field label="ระบบที่เลือก" hint="ระบบที่เราเคยใช้จริง แตะเลือกหรือพิมพ์เองก็ได้">
                <input className={`${input} ${tone(sheet.system)}`} maxLength={100} disabled={disabled} placeholder="เช่น ร้านชานม" value={sheet.system} onChange={(e) => set({ system: e.target.value })} />
              </Field>
              {!disabled && (
                <div className="flex flex-wrap gap-2">
                  {SYSTEMS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      aria-pressed={sheet.system === s}
                      onClick={() => set({ system: s })}
                      className={`tq-press min-h-10 rounded-xl px-3 font-display ${
                        sheet.system === s ? 'bg-action text-white shadow-action' : 'bg-white text-dq-700 ring-1 ring-dq-200 hover:bg-dq-50 dark:bg-dq-900 dark:text-dq-100 dark:ring-dq-700'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
              {cfg.why && (
                <Field label="1. ระบบนี้ใช้ฐานข้อมูลเก็บอะไร และทำไมต้องใช้ฐานข้อมูล" hint="นึกถึงการ์ด 1: ข้อมูลเยอะ ต้องเป็นระเบียบ ค้นหาให้เร็ว">
                  <textarea
                    className={`${input} ${tone(sheet.why)} min-h-24`}
                    maxLength={800}
                    disabled={disabled}
                    placeholder="เช่น ร้านเก็บข้อมูลสมาชิกและแต้มสะสม เพราะมีลูกค้าหลายร้อยคน ต้อง…"
                    value={sheet.why}
                    onChange={(e) => set({ why: e.target.value })}
                  />
                </Field>
              )}
            </>
          )}

          {page.id === 'fields' && (
            <>
              <Field label="2. ชื่อตาราง" hint="1 ตารางเก็บเรื่องเดียว">
                <input className={`${input} ${tone(sheet.table)}`} maxLength={100} disabled={disabled} placeholder="เช่น สมาชิก" value={sheet.table} onChange={(e) => set({ table: e.target.value })} />
              </Field>
              <div className="space-y-2">
                <p className="font-display text-dq-900 dark:text-white">เขตข้อมูล (Field) อย่างน้อย {cfg.minFields} เขตข้อมูล</p>
                <p className="text-sm text-slate-500 dark:text-dq-300">เขตข้อมูล = คอลัมน์ = คุณสมบัติ 1 อย่างที่ต้องเก็บ</p>
                <ol className="space-y-2">
                  {sheet.fields.map((f, c) => (
                    <li key={c} className="flex items-center gap-2">
                      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-xp-300 font-display text-ink">{c + 1}</span>
                      <input
                        className={`${input} ${tone(f)}`}
                        maxLength={60}
                        disabled={disabled}
                        placeholder={c === 0 ? 'เช่น รหัสสมาชิก' : c === 1 ? 'เช่น ชื่อเล่น' : `เขตข้อมูลที่ ${c + 1}`}
                        aria-label={`ชื่อเขตข้อมูลที่ ${c + 1}`}
                        value={f}
                        onChange={(e) => setField(c, e.target.value)}
                      />
                      {sheet.fields.length > cfg.minFields && !disabled && (
                        <button
                          type="button"
                          aria-label={`ลบเขตข้อมูลที่ ${c + 1}`}
                          className="grid size-10 shrink-0 place-items-center rounded-xl text-dq-500 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950"
                          onClick={() => onChange(removeField(sheet, c))}
                        >
                          <X className="size-4" aria-hidden />
                        </button>
                      )}
                    </li>
                  ))}
                </ol>
                {!disabled && sheet.fields.length < cfg.maxFields && (
                  <button type="button" className={`${navBtn} inline-flex items-center gap-1`} onClick={() => onChange(addField(sheet))}>
                    <Plus className="size-4" aria-hidden /> เพิ่มเขตข้อมูล
                  </button>
                )}
              </div>
              <Tip>ควรมีเขตข้อมูลที่ไม่ซ้ำกันเลยไว้ 1 ช่อง (เช่น รหัส…) เพราะหน้าคีย์หลักจะต้องใช้</Tip>
            </>
          )}

          {page.id === 'records' && (
            <>
              <p>
                3. กรอกตัวอย่าง <strong>ระเบียน (Record) {cfg.rows} ระเบียน</strong> · 1 ระเบียน = ข้อมูล 1 แถวของ 1 สิ่ง กรอกให้ครบทุกเขตข้อมูล
              </p>
              <div className="grid gap-3 md:grid-cols-3">
                {sheet.rows.map((row, r) => {
                  const full = named.length > 0 && named.every(({ i }) => row[i]?.trim())
                  return (
                    <fieldset key={r} className={`space-y-2 rounded-2xl p-3 ring-2 ${full ? 'bg-emerald-50 ring-mint-400 dark:bg-emerald-950/30' : 'bg-dq-50 ring-dq-100 dark:bg-dq-950 dark:ring-dq-800'}`}>
                      <legend className="flex items-center gap-1.5 px-1 font-display">
                        {full ? <CircleCheck className="size-4 text-mint-500" aria-hidden /> : '📄'} ระเบียนที่ {r + 1}
                      </legend>
                      {named.map(({ f, i }) => (
                        <label key={i} className="block">
                          <span className="text-sm text-slate-600 dark:text-dq-300">{f}</span>
                          <input
                            className={`${input} ${tone(row[i] ?? '')} py-2`}
                            maxLength={100}
                            disabled={disabled}
                            aria-label={`ระเบียนที่ ${r + 1} ${f}`}
                            value={row[i] ?? ''}
                            onChange={(e) => setCell(r, i, e.target.value)}
                          />
                        </label>
                      ))}
                    </fieldset>
                  )
                })}
              </div>
              <p className="font-display text-dq-700 dark:text-dq-200">ตารางของเราตอนนี้</p>
              <SheetPreview sheet={sheet} highlightPk={false} />
            </>
          )}

          {page.id === 'pk' && (
            <>
              <p>
                4. แตะเลือก <strong>คีย์หลัก (Primary Key)</strong> 1 เขตข้อมูล ต้อง <strong>ไม่ซ้ำ</strong> และ <strong>ห้ามว่าง</strong>
              </p>
              <div className="flex flex-wrap gap-2">
                {named.map(({ f, i }) => (
                  <button
                    key={i}
                    type="button"
                    disabled={disabled}
                    aria-pressed={sheet.pk === i}
                    onClick={() => set({ pk: sheet.pk === i ? null : i })}
                    className={`tq-press inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 font-display ${
                      sheet.pk === i ? 'bg-xp-400 text-ink shadow-[0_3px_0_var(--color-xp-600)]' : 'bg-white text-dq-700 ring-1 ring-dq-200 hover:bg-dq-50 dark:bg-dq-900 dark:text-dq-100 dark:ring-dq-700'
                    }`}
                  >
                    <KeyRound className="size-4" aria-hidden /> {f}
                  </button>
                ))}
              </div>
              <SheetPreview sheet={sheet} />
              {dup && <p className="rounded-2xl bg-amber-50 px-4 py-2 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">⚠️ ค่าในคอลัมน์คีย์หลักซ้ำกัน ลองเลือกเขตข้อมูลอื่น หรือกลับไปแก้ระเบียน</p>}
              <Field
                label={
                  <>
                    ทำไม <span className="rounded bg-xp-300 px-1.5 text-ink">{sheet.pk != null && sheet.fields[sheet.pk]?.trim() ? sheet.fields[sheet.pk] : 'คีย์หลัก'}</span> จึงไม่ซ้ำกัน
                  </>
                }
              >
                <textarea
                  className={`${input} ${tone(sheet.reason)} min-h-24`}
                  maxLength={1000}
                  disabled={disabled}
                  placeholder="เช่น เพราะร้านออกรหัสใหม่ให้ทุกคนตอนสมัคร ไม่มีทางซ้ำ ส่วนชื่อเล่น…"
                  value={sheet.reason}
                  onChange={(e) => set({ reason: e.target.value })}
                />
              </Field>
            </>
          )}

          {page.id === 'query' && (
            <>
              <p>
                5. ตั้ง <strong>คำถามสืบค้น (Query)</strong> 1 ข้อที่ถามตารางของเราได้ แล้วตอบจากระเบียนตัวอย่าง
              </p>
              <SheetPreview sheet={sheet} />
              <Field label="คำถามสืบค้น" hint="ขึ้นต้นแบบ “ใครบ้างที่…” “มีกี่…ที่…” “…ของ…คืออะไร”">
                <input className={`${input} ${tone(sheet.query)}`} maxLength={200} disabled={disabled} placeholder="เช่น ใครบ้างที่มีแต้มสะสมครบ 10 แก้ว" value={sheet.query} onChange={(e) => set({ query: e.target.value })} />
              </Field>
              <Field label="คำตอบจากตารางของเรา">
                <textarea
                  className={`${input} ${tone(sheet.queryResult)} min-h-20`}
                  maxLength={500}
                  disabled={disabled}
                  placeholder="เช่น แพรว (M003)"
                  value={sheet.queryResult}
                  onChange={(e) => set({ queryResult: e.target.value })}
                />
              </Field>
              <Tip>เหมือนตัวอย่าง SQL ในการ์ด 3: เลือกเงื่อนไขจากเขตข้อมูล แล้วดูว่าแถวไหนตรงเงื่อนไข</Tip>
            </>
          )}

          {page.id === 'review' && (
            <>
              <dl className="grid gap-2 sm:grid-cols-2">
                <div className="rounded-2xl bg-dq-50 p-3 dark:bg-dq-950">
                  <dt className="text-sm text-slate-500 dark:text-dq-300">ระบบ</dt>
                  <dd className="font-display">{sheet.system || '-'}</dd>
                </div>
                {cfg.why && (
                  <div className="rounded-2xl bg-dq-50 p-3 dark:bg-dq-950">
                    <dt className="text-sm text-slate-500 dark:text-dq-300">ทำไมใช้ฐานข้อมูล</dt>
                    <dd className="whitespace-pre-wrap">{sheet.why || '-'}</dd>
                  </div>
                )}
              </dl>
              <SheetPreview sheet={sheet} />
              <p className="whitespace-pre-wrap">
                <span className="text-slate-500 dark:text-dq-300">เหตุผลคีย์หลัก:</span> {sheet.reason || '-'}
              </p>
              {cfg.query && (
                <p className="whitespace-pre-wrap">
                  <span className="text-slate-500 dark:text-dq-300">🔍 {sheet.query || '(ยังไม่มีคำถาม)'}</span>
                  <br />→ {sheet.queryResult || '-'}
                </p>
              )}
              {submit}
            </>
          )}

          {!disabled && missingHere.length > 0 && <p className="text-slate-600 dark:text-dq-300">ยังขาด: {missingHere.join(' · ')}</p>}
        </motion.section>
      </AnimatePresence>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" className={navBtn} disabled={at === 0} onClick={() => go(at - 1)}>
          ← ก่อนหน้า
        </button>
        {at < all.length - 1 && (
          <button type="button" className={nextBtn} disabled={!disabled && missingHere.length > 0} onClick={() => go(at + 1)}>
            {at === all.length - 2 ? 'ตรวจทานก่อนส่ง →' : 'ถัดไป →'}
          </button>
        )}
      </div>
    </div>
  )
}
