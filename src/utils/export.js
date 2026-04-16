/**
 * Export utilities — libraries loaded on demand to keep bundle small
 */

export async function exportExcel(data, columns, filename = 'export') {
  const XLSX = await import('xlsx')
  const rows = data.map((row) =>
    columns.reduce((acc, col) => {
      acc[col.label] = row[col.key] ?? ''
      return acc
    }, {})
  )
  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Données')
  XLSX.writeFile(wb, `${filename}.xlsx`)
}

/**
 * Multi-sheet Excel export
 * @param {Array<{name: string, columns: Array<{label, key}>, data: Array<object>}>} sheets
 */
export async function exportExcelMultiSheet(sheets, filename = 'export') {
  const XLSX = await import('xlsx')
  const wb = XLSX.utils.book_new()
  sheets.forEach(({ name, columns, data }) => {
    const rows = data.map((row) =>
      columns.reduce((acc, col) => {
        acc[col.label] = row[col.key] ?? ''
        return acc
      }, {})
    )
    const ws = XLSX.utils.json_to_sheet(rows)
    // Auto-width columns
    const colWidths = columns.map((col) => ({
      wch: Math.max(col.label.length, ...data.map((r) => String(r[col.key] ?? '').length)) + 2,
    }))
    ws['!cols'] = colWidths
    XLSX.utils.book_append_sheet(wb, ws, name)
  })
  XLSX.writeFile(wb, `${filename}.xlsx`)
}

export async function exportPDF(data, columns, filename = 'export', title = '') {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ])
  const doc = new jsPDF()

  if (title) {
    doc.setFontSize(16)
    doc.text(title, 14, 20)
    doc.setFontSize(10)
    doc.text(`Exporté le ${new Date().toLocaleDateString('fr-FR')}`, 14, 28)
  }

  autoTable(doc, {
    startY: title ? 35 : 15,
    head: [columns.map((c) => c.label)],
    body: data.map((row) => columns.map((c) => row[c.key] ?? '')),
    styles: { fontSize: 8, font: 'helvetica' },
    headStyles: { fillColor: [11, 39, 120] },
  })

  doc.save(`${filename}.pdf`)
}

/**
 * Multi-table PDF export — tables are appended sequentially with a heading each.
 * @param {Array<{heading: string, columns: Array<{label,key}>, data: Array<object>}>} tables
 */
export async function exportPDFMultiTable(tables, filename = 'export', title = '') {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ])
  const doc = new jsPDF()

  if (title) {
    doc.setFontSize(16)
    doc.text(title, 14, 20)
    doc.setFontSize(10)
    doc.text(`Exporté le ${new Date().toLocaleDateString('fr-FR')}`, 14, 28)
  }

  let cursorY = title ? 35 : 15
  tables.forEach(({ heading, columns, data }, idx) => {
    if (idx > 0) cursorY += 6
    if (heading) {
      doc.setFontSize(12)
      doc.text(heading, 14, cursorY)
      cursorY += 4
    }
    autoTable(doc, {
      startY: cursorY,
      head: [columns.map((c) => c.label)],
      body: data.map((row) => columns.map((c) => row[c.key] ?? '')),
      styles: { fontSize: 8, font: 'helvetica' },
      headStyles: { fillColor: [11, 39, 120] },
    })
    cursorY = doc.lastAutoTable.finalY + 6
  })

  doc.save(`${filename}.pdf`)
}
