import { useState, useEffect } from 'react'
import PageWrapper from '@/components/layout/PageWrapper'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { fetchTransactionsByPeriod } from '@/services/transactionService'
import { groupTvaByRate, formatTvaRate } from '@/utils/tva'
import toast from 'react-hot-toast'
import { FileBarChart, Download, Printer, RefreshCw, Receipt } from 'lucide-react'

const TYPE_LABELS = {
  debit_session: 'Session',
  debit_product: 'Article',
  credit: 'Rechargement',
  external_payment: 'Ext.',
}
const METHOD_LABELS = { balance: 'Wallet', cb: 'CB', cash: 'Espèces', mixed: 'Mixte' }

const TX_COLUMNS = [
  { label: 'Date', key: 'date' },
  { label: 'Membre', key: 'member' },
  { label: 'Type', key: 'type_label' },
  { label: 'Paiement', key: 'method_label' },
  { label: 'HT (€)', key: 'amount_ht' },
  { label: 'TVA (€)', key: 'amount_tva' },
  { label: 'Taux', key: 'tva_rate' },
  { label: 'TTC (€)', key: 'amount' },
  { label: 'Description', key: 'description' },
]

const TVA_SUMMARY_COLUMNS = [
  { label: 'Taux', key: 'rate_label' },
  { label: 'Base HT (€)', key: 'ht' },
  { label: 'TVA collectée (€)', key: 'tva' },
  { label: 'Total TTC (€)', key: 'ttc' },
  { label: 'Nb transactions', key: 'count' },
]

function toToday() { return new Date().toISOString().split('T')[0] }
function toMonthStart() {
  const d = new Date(); d.setDate(1)
  return d.toISOString().split('T')[0]
}

function computeKPIs(txs) {
  const sessions = txs.filter((t) => t.type === 'debit_session')
  const articles = txs.filter((t) => t.type === 'debit_product')
  const recharges = txs.filter((t) => t.type === 'credit')
  const externals = txs.filter((t) => t.type === 'external_payment')

  const sumHt = (arr) => arr.reduce((s, t) => s + (Number(t.amount_ht) || 0), 0)
  const sumTtc = (arr) => arr.reduce((s, t) => s + (Number(t.amount) || 0), 0)
  const sumByMethod = (method) => txs
    .filter((t) => t.payment_method === method)
    .reduce((s, t) => s + (Number(t.amount) || 0), 0)

  // Encaissements caisse réels = tout ce qui est entré en CB ou Espèces
  // (rechargements + sessions/articles payés directement + paiements externes)
  const encaissementsCb = sumByMethod('cb')
  const encaissementsCash = sumByMethod('cash')
  const encaissementsTotal = encaissementsCb + encaissementsCash

  // Conso wallet = ce qui a été dépensé depuis le solde (déjà encaissé via recharge antérieure)
  const consoWallet = sessions.filter((t) => t.payment_method === 'balance').reduce((s, t) => s + (Number(t.amount) || 0), 0)
                    + articles.filter((t) => t.payment_method === 'balance').reduce((s, t) => s + (Number(t.amount) || 0), 0)

  return {
    sessions: { count: sessions.length, total: sumTtc(sessions), ht: sumHt(sessions) },
    articles: { count: articles.length, total: sumTtc(articles), ht: sumHt(articles) },
    recharges: {
      count: recharges.length,
      total: recharges.reduce((s, t) => s + (Number(t.amount) || 0), 0),
      cb: recharges.filter((t) => t.payment_method === 'cb').reduce((s, t) => s + (Number(t.amount) || 0), 0),
      cash: recharges.filter((t) => t.payment_method === 'cash').reduce((s, t) => s + (Number(t.amount) || 0), 0),
    },
    externals: { count: externals.length, total: sumTtc(externals) },
    consoWallet,
    encaissementsCb,
    encaissementsCash,
    encaissementsTotal,
  }
}

function KPICard({ label, count, total, ht, sub }) {
  return (
    <Card elevated>
      <p className="text-xs text-text-tertiary mb-1">{label}</p>
      <p className="text-xl font-bold text-primary">{(total || 0).toFixed(2)} €</p>
      <p className="text-xs text-text-secondary">
        {count} transaction{count !== 1 ? 's' : ''}
        {sub ? ` · ${sub}` : ''}
        {ht != null ? ` · HT ${ht.toFixed(2)}€` : ''}
      </p>
    </Card>
  )
}

function formatTx(t) {
  return {
    date: t.created_at ? new Date(t.created_at).toLocaleDateString('fr-FR') : '',
    member: t.profile?.display_name || 'Non-membre',
    type_label: TYPE_LABELS[t.type] || t.type || '-',
    method_label: METHOD_LABELS[t.payment_method] || t.payment_method || '-',
    amount_ht: (Number(t.amount_ht) || 0).toFixed(2),
    amount_tva: (Number(t.amount_tva) || 0).toFixed(2),
    tva_rate: t.tva_rate != null ? formatTvaRate(t.tva_rate) : '—',
    amount: (Number(t.amount) || 0).toFixed(2),
    description: t.description || '',
  }
}

function formatSummary(b) {
  return {
    rate_label: formatTvaRate(b.rate),
    ht: b.ht.toFixed(2),
    tva: b.tva.toFixed(2),
    ttc: b.ttc.toFixed(2),
    count: b.count,
  }
}

export default function AdminFinancialExport() {
  const [from, setFrom] = useState(toMonthStart())
  const [to, setTo] = useState(toToday())
  const [txs, setTxs] = useState([])
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('all')
  const [exporting, setExporting] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const data = await fetchTransactionsByPeriod(from, to)
      setTxs(data)
    } catch (err) { toast.error(err.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const kpis = computeKPIs(txs)

  // Ventilation TVA : on exclut les crédits (pas de TVA à la collecte — cf. migration)
  const taxableTxs = txs.filter((t) => t.type !== 'credit' && t.tva_rate != null && Number(t.tva_rate) > 0)
  const tvaBreakdown = groupTvaByRate(taxableTxs)
  const totalTvaCollected = tvaBreakdown.reduce((s, b) => s + b.tva, 0)

  const filteredTxs = activeTab === 'all' ? txs
    : txs.filter((t) => t.payment_method === activeTab)

  const handleExcelExport = async () => {
    setExporting(true)
    try {
      const { exportExcelMultiSheet } = await import('@/utils/export')
      const byMethod = (m) => txs.filter((t) => t.payment_method === m).map(formatTx)
      await exportExcelMultiSheet([
        { name: 'Toutes', columns: TX_COLUMNS, data: txs.map(formatTx) },
        { name: 'Wallet', columns: TX_COLUMNS, data: byMethod('balance') },
        { name: 'CB', columns: TX_COLUMNS, data: byMethod('cb') },
        { name: 'Espèces', columns: TX_COLUMNS, data: byMethod('cash') },
        { name: 'Déclaration TVA', columns: TVA_SUMMARY_COLUMNS, data: tvaBreakdown.map(formatSummary) },
      ], `rapport-financier-${from}-${to}`)
    } catch { toast.error('Erreur export Excel') }
    finally { setExporting(false) }
  }

  const handlePDFExport = async () => {
    setExporting(true)
    try {
      const { exportPDF, exportPDFMultiTable } = await import('@/utils/export')
      const title = `Rapport financier ${from} → ${to}`
      const tables = [
        { heading: 'Transactions', columns: TX_COLUMNS, data: txs.map(formatTx) },
        { heading: 'Déclaration TVA par taux', columns: TVA_SUMMARY_COLUMNS, data: tvaBreakdown.map(formatSummary) },
      ]
      if (typeof exportPDFMultiTable === 'function') {
        await exportPDFMultiTable(tables, `rapport-financier-${from}-${to}`, title)
      } else {
        await exportPDF(txs.map(formatTx), TX_COLUMNS, `rapport-financier-${from}-${to}`, title)
      }
    } catch { toast.error('Erreur export PDF') }
    finally { setExporting(false) }
  }

  const countMethod = (m) => txs.filter((t) => t.payment_method === m).length
  const tabs = [
    { id: 'all', label: `Tout (${txs.length})` },
    { id: 'balance', label: `Wallet (${countMethod('balance')})` },
    { id: 'cb', label: `CB (${countMethod('cb')})` },
    { id: 'cash', label: `Espèces (${countMethod('cash')})` },
  ]

  const filteredTotal = filteredTxs.reduce((s, t) => s + (Number(t.amount) || 0), 0)
  const filteredHt = filteredTxs.reduce((s, t) => s + (Number(t.amount_ht) || 0), 0)
  const filteredTva = filteredTxs.reduce((s, t) => s + (Number(t.amount_tva) || 0), 0)

  return (
    <PageWrapper>
      <div className="space-y-5">
        <div className="flex items-center gap-2">
          <FileBarChart className="w-5 h-5 text-primary" />
          <h1 className="text-2xl font-bold text-text">Rapport financier</h1>
        </div>

        {/* Période */}
        <Card>
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="text-xs text-text-secondary block mb-1">Du</label>
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
                className="border border-separator rounded-[12px] px-3 py-2 text-sm text-text bg-bg" />
            </div>
            <div>
              <label className="text-xs text-text-secondary block mb-1">Au</label>
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
                className="border border-separator rounded-[12px] px-3 py-2 text-sm text-text bg-bg" />
            </div>
            <Button onClick={load} loading={loading} variant="ghost">
              <RefreshCw className="w-4 h-4 mr-2" />Actualiser
            </Button>
          </div>
        </Card>

        {/* KPIs Activité */}
        <div className="grid grid-cols-2 gap-3">
          <KPICard label="Sessions" count={kpis.sessions.count} total={kpis.sessions.total} ht={kpis.sessions.ht} />
          <KPICard label="Articles" count={kpis.articles.count} total={kpis.articles.total} ht={kpis.articles.ht} />
          <KPICard label="Rechargements" count={kpis.recharges.count} total={kpis.recharges.total}
            sub={`CB ${kpis.recharges.cb.toFixed(2)}€ · Esp. ${kpis.recharges.cash.toFixed(2)}€`} />
          <KPICard label="Paiements externes" count={kpis.externals.count} total={kpis.externals.total} sub="non-membres" />
        </div>

        {/* Encaissements caisse — argent réellement entré */}
        <Card elevated>
          <p className="text-xs font-semibold text-text-secondary uppercase mb-2">Encaissements caisse</p>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <p className="text-xs text-text-tertiary">CB</p>
              <p className="text-lg font-bold text-primary">{kpis.encaissementsCb.toFixed(2)} €</p>
            </div>
            <div>
              <p className="text-xs text-text-tertiary">Espèces</p>
              <p className="text-lg font-bold text-primary">{kpis.encaissementsCash.toFixed(2)} €</p>
            </div>
            <div>
              <p className="text-xs text-text-tertiary">Total</p>
              <p className="text-lg font-bold text-lime-600">{kpis.encaissementsTotal.toFixed(2)} €</p>
            </div>
          </div>
          <p className="text-xs text-text-tertiary mt-2">
            Argent réellement entré dans la caisse (rechargements + paiements directs CB/Espèces).
          </p>
          <div className="mt-3 pt-3 border-t border-separator flex justify-between text-xs">
            <span className="text-text-secondary">Conso wallet (déjà encaissée via recharges antérieures)</span>
            <span className="font-semibold text-text">{kpis.consoWallet.toFixed(2)} €</span>
          </div>
        </Card>

        {/* Récap TVA collectée */}
        <Card elevated>
          <div className="flex items-center gap-2 mb-3">
            <Receipt className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-text">TVA collectée sur la période</h3>
            <span className="ml-auto text-lg font-bold text-primary">{totalTvaCollected.toFixed(2)} €</span>
          </div>
          {tvaBreakdown.length === 0 ? (
            <p className="text-xs text-text-tertiary">Aucune TVA à déclarer sur cette période.</p>
          ) : (
            <div className="overflow-x-auto -mx-4 sm:mx-0">
              <table className="w-full text-sm min-w-[420px]">
                <thead>
                  <tr className="border-b border-separator">
                    {TVA_SUMMARY_COLUMNS.map((c) => (
                      <th key={c.key} className="text-left text-xs font-semibold text-text-secondary pb-2 pr-3 last:pr-0">{c.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-separator">
                  {tvaBreakdown.map((b) => {
                    const row = formatSummary(b)
                    return (
                      <tr key={b.rate}>
                        <td className="py-2 pr-3 text-xs font-semibold text-text">{row.rate_label}</td>
                        <td className="py-2 pr-3 text-xs text-text-secondary">{row.ht} €</td>
                        <td className="py-2 pr-3 text-xs font-semibold text-primary">{row.tva} €</td>
                        <td className="py-2 pr-3 text-xs text-text-secondary">{row.ttc} €</td>
                        <td className="py-2 pr-3 last:pr-0 text-xs text-text-tertiary">{row.count}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Export */}
        <div className="flex gap-2 flex-wrap">
          <Button variant="ghost" size="sm" onClick={handleExcelExport} loading={exporting}>
            <Download className="w-4 h-4 mr-1.5" />Excel
          </Button>
          <Button variant="ghost" size="sm" onClick={handlePDFExport} loading={exporting}>
            <Download className="w-4 h-4 mr-1.5" />PDF
          </Button>
          <Button variant="ghost" size="sm" onClick={() => window.print()}>
            <Printer className="w-4 h-4 mr-1.5" />Imprimer
          </Button>
        </div>

        {/* Table */}
        <Card>
          <div className="flex gap-1 mb-4 overflow-x-auto pb-1">
            {tabs.map((t) => (
              <button key={t.id} onClick={() => setActiveTab(t.id)}
                className={`px-3 py-1.5 rounded-[10px] text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                  activeTab === t.id ? 'bg-primary text-white' : 'bg-bg text-text-secondary hover:bg-primary/10'
                }`}
              >{t.label}</button>
            ))}
          </div>

          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-10 bg-bg rounded-[8px] animate-pulse" />)}
            </div>
          ) : filteredTxs.length === 0 ? (
            <p className="text-sm text-text-tertiary text-center py-8">Aucune transaction sur cette période</p>
          ) : (
            <div className="overflow-x-auto -mx-4 sm:mx-0">
              <table className="w-full text-sm min-w-[780px]">
                <thead>
                  <tr className="border-b border-separator">
                    {TX_COLUMNS.map((c) => (
                      <th key={c.key} className="text-left text-xs font-semibold text-text-secondary pb-2 pr-3 last:pr-0">{c.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-separator">
                  {filteredTxs.map((t) => {
                    const row = formatTx(t)
                    return (
                      <tr key={t.id} className="hover:bg-bg/50 transition-colors">
                        {TX_COLUMNS.map((c) => (
                          <td key={c.key} className={`py-2 pr-3 last:pr-0 text-xs ${c.key === 'amount' ? 'font-semibold text-text' : 'text-text-secondary'}`}>
                            {row[c.key]}
                          </td>
                        ))}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {filteredTxs.length > 0 && (
            <div className="mt-3 pt-3 border-t border-separator flex flex-wrap justify-between gap-2 text-xs text-text-secondary">
              <span>{filteredTxs.length} transaction{filteredTxs.length > 1 ? 's' : ''}</span>
              <span className="text-text-tertiary">HT : {filteredHt.toFixed(2)} €</span>
              <span className="text-text-tertiary">TVA : {filteredTva.toFixed(2)} €</span>
              <span className="font-semibold text-text">TTC : {filteredTotal.toFixed(2)} €</span>
            </div>
          )}
        </Card>
      </div>
    </PageWrapper>
  )
}
