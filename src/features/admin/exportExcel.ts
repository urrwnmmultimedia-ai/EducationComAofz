// โหลด SheetJS เฉพาะตอนใช้ (ไฟล์ค่อนข้างใหญ่)
export async function downloadWorkbook(fileName: string, sheets: { name: string; rows: unknown[][]; colWidths?: number[] }[]) {
  const XLSX = await import('xlsx')
  const wb = XLSX.utils.book_new()
  for (const s of sheets) {
    const ws = XLSX.utils.aoa_to_sheet(s.rows)
    if (s.colWidths) ws['!cols'] = s.colWidths.map((wch) => ({ wch }))
    XLSX.utils.book_append_sheet(wb, ws, s.name.slice(0, 31))
  }
  XLSX.writeFile(wb, fileName)
}

export async function readTableFile(file: File): Promise<unknown[][]> {
  const XLSX = await import('xlsx')
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array', codepage: 874 }) // 874 = Thai (สำหรับ CSV ที่บันทึกจาก Excel ไทย)
  const first = wb.SheetNames[0]
  const ws = first ? wb.Sheets[first] : undefined
  if (!ws) return []
  return XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '', raw: false })
}
