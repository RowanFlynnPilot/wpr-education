// Per-chart CSV export: exactly the series the reader is looking at.
// Suppressed cells export as the word "suppressed" — never blank, never 0 —
// so downstream spreadsheets can't mistake redaction for data.

function esc(field) {
  const s = String(field)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function chartCSV(seriesList) {
  const years = [...new Set(seriesList.flatMap((s) => Object.keys(s.cells)))].sort()
  const header = ['school_year', ...seriesList.map((s) => s.label)]
  const rows = years.map((year) => [
    year,
    ...seriesList.map((s) => {
      const cell = s.cells[year]
      if (!cell) return ''
      return cell.suppressed ? 'suppressed' : cell.value
    }),
  ])
  return [header, ...rows].map((r) => r.map(esc).join(',')).join('\n') + '\n'
}

export function downloadCSV(filename, text) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
