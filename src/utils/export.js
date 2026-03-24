import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

/**
 * Export data to Excel (.xlsx)
 * @param {Array<object>} data - rows
 * @param {Array<{key: string, label: string}>} columns - column definitions
 * @param {string} filename - without extension
 */
export function exportExcel(data, columns, filename = 'export') {
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
 * Export data to PDF
 * @param {Array<object>} data - rows
 * @param {Array<{key: string, label: string}>} columns - column definitions
 * @param {string} filename - without extension
 * @param {string} title - document title
 */
export function exportPDF(data, columns, filename = 'export', title = '') {
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
