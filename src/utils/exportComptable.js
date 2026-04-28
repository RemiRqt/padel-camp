/**
 * Export comptable — rapport financier prêt pour le comptable.
 * Excel : 4 feuilles (Synthèse / Encaissement caisse / Déclaration TVA / Détail)
 * PDF : Synthèse + Déclaration TVA + Détail
 *
 * Tous les libs sont lazy-loadés.
 */

const FMT_EUR = '#,##0.00 "€"'
const FMT_DATE = 'dd/mm/yyyy'

const TYPE_LABELS = {
  debit_session: 'Session',
  debit_product: 'Article',
  credit: 'Recharge',
  credit_bonus: 'Bonus',
  external_payment: 'Paiement externe',
  refund: 'Remboursement',
}
const METHOD_LABELS = { balance: 'Wallet', cb: 'CB', cash: 'Espèces', mixed: 'Mixte' }

function formatDateFR(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
}

// ======================================================================
// EXCEL
// ======================================================================

export async function exportComptableExcel({ from, to, txs, kpis, tvaBreakdown, filename }) {
  const XLSX = await import('xlsx')
  const wb = XLSX.utils.book_new()

  // ---- Feuille 1 : Synthèse ----
  const synthRows = [
    ['Rapport financier — Padel Camp Achères'],
    [`Période : du ${from} au ${to}`],
    [`Édité le ${new Date().toLocaleDateString('fr-FR')}`],
    [],
    ['INDICATEUR', 'MONTANT'],
    ['CA Sessions (TTC)', kpis.sessions.total],
    ['CA Articles (TTC)', kpis.articles.total],
    ['Total Recharges encaissées', kpis.recharges.total],
    [],
    ['ENCAISSEMENT CAISSE'],
    ['Total CB', kpis.encaissement.cb],
    ['Total Espèces', kpis.encaissement.cash],
    ['Total caisse (CB + espèces)', kpis.encaissement.total],
    ['Wallet débité (info, déjà encaissé via recharges)', kpis.encaissement.walletDebited],
    ['Bonus consommé (cadeau formule, sans contrepartie caisse)', kpis.encaissement.bonusConsumed || 0],
    [],
    ['TVA COLLECTÉE TOTALE', tvaBreakdown.reduce((s, b) => s + b.tva, 0)],
  ]
  const wsSynth = XLSX.utils.aoa_to_sheet(synthRows)
  // Format € sur la colonne B des lignes financières
  ;[5, 6, 7, 10, 11, 12, 13, 14, 16].forEach((rowIdx) => {
    const ref = XLSX.utils.encode_cell({ r: rowIdx, c: 1 })
    if (wsSynth[ref]) wsSynth[ref].z = FMT_EUR
  })
  // Style header (gras sur ligne 4)
  ;['A5', 'B5'].forEach((ref) => {
    if (wsSynth[ref]) wsSynth[ref].s = { font: { bold: true } }
  })
  wsSynth['!cols'] = [{ wch: 50 }, { wch: 18 }]
  wsSynth['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 1 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: 1 } },
    { s: { r: 9, c: 0 }, e: { r: 9, c: 1 } },
    { s: { r: 15, c: 0 }, e: { r: 15, c: 1 } },
  ]
  XLSX.utils.book_append_sheet(wb, wsSynth, 'Synthèse')

  // ---- Feuille 2 : Encaissement caisse (CB + espèces uniquement) ----
  const caisseTxs = txs.filter((t) => t.payment_method === 'cb' || t.payment_method === 'cash')
  const caisseRows = [
    ['Date', 'Type', 'Méthode', 'Membre', 'Description', 'HT', 'TVA', 'Taux TVA', 'TTC'],
    ...caisseTxs.map((t) => [
      formatDateFR(t.created_at),
      TYPE_LABELS[t.type] || t.type,
      METHOD_LABELS[t.payment_method] || t.payment_method,
      t.profile?.display_name || 'Non-membre',
      t.description || '',
      Number(t.amount_ht) || 0,
      Number(t.amount_tva) || 0,
      t.tva_rate != null ? `${Number(t.tva_rate)}%` : '—',
      Number(t.amount) || 0,
    ]),
    // Ligne TOTAL
    [
      'TOTAL', '', '', '', '',
      caisseTxs.reduce((s, t) => s + (Number(t.amount_ht) || 0), 0),
      caisseTxs.reduce((s, t) => s + (Number(t.amount_tva) || 0), 0),
      '',
      caisseTxs.reduce((s, t) => s + (Number(t.amount) || 0), 0),
    ],
  ]
  const wsCaisse = XLSX.utils.aoa_to_sheet(caisseRows)
  // Format dates colonne A, € colonnes F G I
  for (let r = 1; r < caisseRows.length; r++) {
    const dateRef = XLSX.utils.encode_cell({ r, c: 0 })
    if (wsCaisse[dateRef]) wsCaisse[dateRef].z = FMT_DATE
    ;[5, 6, 8].forEach((c) => {
      const ref = XLSX.utils.encode_cell({ r, c })
      if (wsCaisse[ref]) wsCaisse[ref].z = FMT_EUR
    })
  }
  wsCaisse['!cols'] = [
    { wch: 12 }, { wch: 14 }, { wch: 10 }, { wch: 22 }, { wch: 36 },
    { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 12 },
  ]
  XLSX.utils.book_append_sheet(wb, wsCaisse, 'Encaissement caisse')

  // ---- Feuille 3 : Déclaration TVA ----
  const tvaRows = [
    ['Taux TVA', 'Base HT', 'TVA collectée', 'Total TTC', 'Nb transactions'],
    ...tvaBreakdown.map((b) => [
      `${Number(b.rate)}%`,
      Number(b.ht) || 0,
      Number(b.tva) || 0,
      Number(b.ttc) || 0,
      b.count,
    ]),
    [
      'TOTAL',
      tvaBreakdown.reduce((s, b) => s + (Number(b.ht) || 0), 0),
      tvaBreakdown.reduce((s, b) => s + (Number(b.tva) || 0), 0),
      tvaBreakdown.reduce((s, b) => s + (Number(b.ttc) || 0), 0),
      tvaBreakdown.reduce((s, b) => s + (Number(b.count) || 0), 0),
    ],
  ]
  const wsTva = XLSX.utils.aoa_to_sheet(tvaRows)
  for (let r = 1; r < tvaRows.length; r++) {
    ;[1, 2, 3].forEach((c) => {
      const ref = XLSX.utils.encode_cell({ r, c })
      if (wsTva[ref]) wsTva[ref].z = FMT_EUR
    })
  }
  wsTva['!cols'] = [{ wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }]
  XLSX.utils.book_append_sheet(wb, wsTva, 'Déclaration TVA')

  // ---- Feuille 4 : Détail (toutes transactions) ----
  const detailRows = [
    ['Date', 'Membre', 'Type', 'Méthode', 'Description', 'HT', 'TVA', 'Taux', 'TTC'],
    ...txs.map((t) => [
      formatDateFR(t.created_at),
      t.profile?.display_name || 'Non-membre',
      TYPE_LABELS[t.type] || t.type,
      METHOD_LABELS[t.payment_method] || t.payment_method,
      t.description || '',
      Number(t.amount_ht) || 0,
      Number(t.amount_tva) || 0,
      t.tva_rate != null ? `${Number(t.tva_rate)}%` : '—',
      Number(t.amount) || 0,
    ]),
    [
      'TOTAL', '', '', '', '',
      txs.reduce((s, t) => s + (Number(t.amount_ht) || 0), 0),
      txs.reduce((s, t) => s + (Number(t.amount_tva) || 0), 0),
      '',
      txs.reduce((s, t) => s + (Number(t.amount) || 0), 0),
    ],
  ]
  const wsDetail = XLSX.utils.aoa_to_sheet(detailRows)
  for (let r = 1; r < detailRows.length; r++) {
    const dateRef = XLSX.utils.encode_cell({ r, c: 0 })
    if (wsDetail[dateRef]) wsDetail[dateRef].z = FMT_DATE
    ;[5, 6, 8].forEach((c) => {
      const ref = XLSX.utils.encode_cell({ r, c })
      if (wsDetail[ref]) wsDetail[ref].z = FMT_EUR
    })
  }
  wsDetail['!cols'] = [
    { wch: 12 }, { wch: 22 }, { wch: 14 }, { wch: 10 }, { wch: 36 },
    { wch: 12 }, { wch: 12 }, { wch: 8 }, { wch: 12 },
  ]
  XLSX.utils.book_append_sheet(wb, wsDetail, 'Détail')

  XLSX.writeFile(wb, `${filename}.xlsx`)
}

// ======================================================================
// PDF
// ======================================================================

export async function exportComptablePDF({ from, to, txs, kpis, tvaBreakdown, filename }) {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ])
  const doc = new jsPDF()
  const fmt = (n) => Number(n || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'

  // ----- Page de garde -----
  doc.setFontSize(20)
  doc.text('Rapport financier', 14, 22)
  doc.setFontSize(11)
  doc.text('Padel Camp Achères', 14, 30)
  doc.setFontSize(10)
  doc.setTextColor(100)
  doc.text(`Période : du ${from} au ${to}`, 14, 38)
  doc.text(`Édité le ${new Date().toLocaleDateString('fr-FR')}`, 14, 44)
  doc.setTextColor(0)

  // ----- Section Synthèse -----
  let cursorY = 56
  doc.setFontSize(13)
  doc.text('Synthèse', 14, cursorY)
  cursorY += 4

  autoTable(doc, {
    startY: cursorY,
    head: [['Indicateur', 'Montant']],
    body: [
      ['CA Sessions (TTC)', fmt(kpis.sessions.total)],
      ['CA Articles (TTC)', fmt(kpis.articles.total)],
      ['Total Recharges', fmt(kpis.recharges.total)],
      ['Total CB encaissé', fmt(kpis.encaissement.cb)],
      ['Total Espèces encaissées', fmt(kpis.encaissement.cash)],
      [{ content: 'Total caisse (CB + Espèces)', styles: { fontStyle: 'bold' } },
       { content: fmt(kpis.encaissement.total), styles: { fontStyle: 'bold' } }],
      ['Wallet débité (info)', fmt(kpis.encaissement.walletDebited)],
      ['Bonus consommé (info)', fmt(kpis.encaissement.bonusConsumed || 0)],
      [{ content: 'TVA collectée totale', styles: { fontStyle: 'bold' } },
       { content: fmt(tvaBreakdown.reduce((s, b) => s + b.tva, 0)), styles: { fontStyle: 'bold' } }],
    ],
    styles: { fontSize: 9, font: 'helvetica' },
    headStyles: { fillColor: [11, 39, 120] },
    columnStyles: { 1: { halign: 'right', cellWidth: 50 } },
  })
  cursorY = doc.lastAutoTable.finalY + 10

  // ----- Section Déclaration TVA -----
  doc.setFontSize(13)
  doc.text('Déclaration TVA par taux', 14, cursorY)
  cursorY += 4
  autoTable(doc, {
    startY: cursorY,
    head: [['Taux', 'Base HT', 'TVA collectée', 'Total TTC', 'Nb transactions']],
    body: [
      ...tvaBreakdown.map((b) => [
        `${Number(b.rate)}%`,
        fmt(b.ht),
        fmt(b.tva),
        fmt(b.ttc),
        b.count,
      ]),
      [
        { content: 'TOTAL', styles: { fontStyle: 'bold' } },
        { content: fmt(tvaBreakdown.reduce((s, b) => s + (Number(b.ht) || 0), 0)), styles: { fontStyle: 'bold' } },
        { content: fmt(tvaBreakdown.reduce((s, b) => s + (Number(b.tva) || 0), 0)), styles: { fontStyle: 'bold' } },
        { content: fmt(tvaBreakdown.reduce((s, b) => s + (Number(b.ttc) || 0), 0)), styles: { fontStyle: 'bold' } },
        { content: tvaBreakdown.reduce((s, b) => s + (Number(b.count) || 0), 0), styles: { fontStyle: 'bold' } },
      ],
    ],
    styles: { fontSize: 9, font: 'helvetica' },
    headStyles: { fillColor: [11, 39, 120] },
    columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } },
  })

  // ----- Section Détail (nouvelle page) -----
  doc.addPage()
  doc.setFontSize(13)
  doc.text('Détail des transactions', 14, 18)
  autoTable(doc, {
    startY: 24,
    head: [['Date', 'Membre', 'Type', 'Méthode', 'HT', 'TVA', 'Taux', 'TTC']],
    body: txs.map((t) => [
      t.created_at ? new Date(t.created_at).toLocaleDateString('fr-FR') : '',
      t.profile?.display_name || 'Non-membre',
      TYPE_LABELS[t.type] || t.type,
      METHOD_LABELS[t.payment_method] || t.payment_method,
      fmt(t.amount_ht),
      fmt(t.amount_tva),
      t.tva_rate != null ? `${Number(t.tva_rate)}%` : '—',
      fmt(t.amount),
    ]),
    styles: { fontSize: 7, font: 'helvetica' },
    headStyles: { fillColor: [11, 39, 120] },
    columnStyles: { 4: { halign: 'right' }, 5: { halign: 'right' }, 7: { halign: 'right' } },
  })

  // Pied de page : numérotation
  const totalPages = doc.internal.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(120)
    doc.text(`Page ${i} / ${totalPages}`, doc.internal.pageSize.getWidth() - 30, doc.internal.pageSize.getHeight() - 10)
  }

  doc.save(`${filename}.pdf`)
}
