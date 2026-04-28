import { useState, useEffect } from 'react'
import PageWrapper from '@/components/layout/PageWrapper'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import {
  fetchFinancialSummary,
  fetchTransactionsPage,
  fetchAllTransactionsByPeriod,
} from '@/services/transactionService'
import { formatTvaRate } from '@/utils/tva'
import toast from 'react-hot-toast'
import {
  FileBarChart, Download, Printer, RefreshCw, Receipt,
  ChevronLeft, ChevronRight,
} from 'lucide-react'

const PAGE_SIZE = 100

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
function toWeekAgo() {
  const d = new Date(); d.setDate(d.getDate() - 6)
  return d.toISOString().split('T')[0]
}

const PRESETS = {
  week: () => {
    const today = new Date()
    const dow = today.getDay()
    const offsetToMonday = (dow + 6) % 7
    const monday = new Date(today)
    monday.setDate(today.getDate() - offsetToMonday)
    return { from: monday.toISOString().split('T')[0], to: toToday() }
  },
  month: () => {
    const d = new Date(); d.setDate(1)
    return { from: d.toISOString().split('T')[0], to: toToday() }
  },
  year: () => {
    const d = new Date(new Date().getFullYear(), 0, 1)
    return { from: d.toISOString().split('T')[0], to: toToday() }
  },
}

const EMPTY_SUMMARY = {
  sessions: { count: 0, total: 0, wallet: 0, cb: 0, cash: 0 },
  articles: { count: 0, total: 0, wallet: 0, cb: 0, cash: 0 },
  recharges: { count: 0, total: 0, cb: 0, cash: 0 },
  encaissement: { cb: 0, cash: 0, total: 0, walletDebited: 0, bonusConsumed: 0 },
  totals: { ht: 0, tva: 0, ttc: 0 },
  counts: { balance: 0, cb: 0, cash: 0, total: 0 },
}

function KPICard({ label, total, breakdown, count }) {
  return (
    <Card elevated>
      <p className="text-xs text-text-tertiary mb-1">{label}</p>
      <p className="text-xl font-bold text-primary mb-2">{(total || 0).toFixed(2)} €</p>
      <div className="space-y-0.5">
        {breakdown.map((b) => (
          <div key={b.label} className="flex justify-between text-xs">
            <span className="text-text-secondary">{b.label}</span>
            <span className="font-medium text-text">{(b.value || 0).toFixed(2)} €</span>
          </div>
        ))}
      </div>
      {count != null && (
        <p className="text-[11px] text-text-tertiary mt-2 pt-2 border-t border-separator">
          {count} transaction{count !== 1 ? 's' : ''}
        </p>
      )}
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
  const [from, setFrom] = useState(toWeekAgo())
  const [to, setTo] = useState(toToday())

  // Données server-side (RPCs)
  const [summary, setSummary] = useState(EMPTY_SUMMARY)
  const [tvaBreakdown, setTvaBreakdown] = useState([])

  // Détail paginé
  const [pageTxs, setPageTxs] = useState([])
  const [pageCount, setPageCount] = useState(0)
  const [page, setPage] = useState(0)
  const [activeTab, setActiveTab] = useState('all')

  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)

  const totalTvaCollected = tvaBreakdown.reduce((s, b) => s + b.tva, 0)
  const methodFilter = activeTab === 'all' ? null : activeTab

  const loadAll = async () => {
    setLoading(true)
    try {
      const [s, p] = await Promise.all([
        fetchFinancialSummary(from, to),
        fetchTransactionsPage(from, to, { page: 0, pageSize: PAGE_SIZE, method: methodFilter }),
      ])
      setSummary(s.summary)
      setTvaBreakdown(s.tvaBreakdown)
      setPageTxs(p.data)
      setPageCount(p.count)
      setPage(0)
    } catch (err) {
      console.error(err)
      toast.error(err.message || 'Erreur chargement rapport')
    } finally { setLoading(false) }
  }

  useEffect(() => { loadAll() }, [from, to])

  // Pagination dans la table : on ne recharge que la page (pas la summary)
  useEffect(() => {
    let alive = true
    async function loadPage() {
      try {
        const p = await fetchTransactionsPage(from, to, {
          page, pageSize: PAGE_SIZE, method: methodFilter,
        })
        if (!alive) return
        setPageTxs(p.data)
        setPageCount(p.count)
      } catch (err) {
        console.error(err)
      }
    }
    loadPage()
    return () => { alive = false }
  }, [page, activeTab])

  const handleExport = async (kind) => {
    setExporting(true)
    try {
      // Fetch toutes les tx pour la période en batches (contourne le cap)
      const allTxs = await fetchAllTransactionsByPeriod(from, to)
      const kpis = {
        sessions: summary.sessions,
        articles: summary.articles,
        recharges: summary.recharges,
        encaissement: summary.encaissement,
      }
      const mod = await import('@/utils/exportComptable')
      const fn = kind === 'excel' ? mod.exportComptableExcel : mod.exportComptablePDF
      await fn({
        from, to,
        txs: allTxs,
        kpis,
        tvaBreakdown,
        filename: `rapport-financier-${from}-${to}`,
      })
      toast.success(`Export ${kind === 'excel' ? 'Excel' : 'PDF'} prêt (${allTxs.length} tx)`)
    } catch (err) {
      console.error(err)
      toast.error(`Erreur export ${kind}`)
    } finally { setExporting(false) }
  }

  const tabs = [
    { id: 'all',     label: `Tout (${summary.counts.total})` },
    { id: 'balance', label: `Wallet (${summary.counts.balance})` },
    { id: 'cb',      label: `CB (${summary.counts.cb})` },
    { id: 'cash',    label: `Espèces (${summary.counts.cash})` },
  ]

  const totalPages = Math.max(1, Math.ceil(pageCount / PAGE_SIZE))

  return (
    <PageWrapper>
      <div className="space-y-5">
        <div className="flex items-center gap-2">
          <FileBarChart className="w-5 h-5 text-primary" />
          <h1 className="text-2xl font-bold text-text">Rapport financier</h1>
        </div>

        {/* Période */}
        <Card>
          <div className="flex flex-wrap gap-2 mb-3">
            {[
              { id: 'week', label: 'Cette semaine' },
              { id: 'month', label: 'Ce mois' },
              { id: 'year', label: 'Cette année' },
            ].map((preset) => (
              <button
                key={preset.id}
                onClick={() => {
                  const { from: f, to: t } = PRESETS[preset.id]()
                  setFrom(f); setTo(t)
                }}
                className="px-3 py-1.5 rounded-[10px] text-xs font-medium bg-bg text-text-secondary hover:bg-primary/10 hover:text-primary cursor-pointer transition-colors"
              >
                {preset.label}
              </button>
            ))}
          </div>
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
            <Button onClick={loadAll} loading={loading} variant="ghost">
              <RefreshCw className="w-4 h-4 mr-2" />Actualiser
            </Button>
          </div>
        </Card>

        {/* KPIs Activité */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <KPICard
            label="Sessions"
            total={summary.sessions.total}
            count={summary.sessions.count}
            breakdown={[
              { label: 'Wallet', value: summary.sessions.wallet },
              { label: 'CB', value: summary.sessions.cb },
              { label: 'Espèces', value: summary.sessions.cash },
            ]}
          />
          <KPICard
            label="Articles"
            total={summary.articles.total}
            count={summary.articles.count}
            breakdown={[
              { label: 'Wallet', value: summary.articles.wallet },
              { label: 'CB', value: summary.articles.cb },
              { label: 'Espèces', value: summary.articles.cash },
            ]}
          />
          <KPICard
            label="Rechargements"
            total={summary.recharges.total}
            count={summary.recharges.count}
            breakdown={[
              { label: 'CB', value: summary.recharges.cb },
              { label: 'Espèces', value: summary.recharges.cash },
            ]}
          />
        </div>

        {/* Encaissement caisse */}
        <Card elevated>
          <p className="text-xs font-semibold text-text-secondary uppercase mb-3">Encaissement caisse</p>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div>
              <p className="text-xs text-text-tertiary mb-0.5">Total CB</p>
              <p className="text-lg font-bold text-primary">{summary.encaissement.cb.toFixed(2)} €</p>
            </div>
            <div>
              <p className="text-xs text-text-tertiary mb-0.5">Total espèces</p>
              <p className="text-lg font-bold text-primary">{summary.encaissement.cash.toFixed(2)} €</p>
            </div>
            <div>
              <p className="text-xs text-text-tertiary mb-0.5">Wallet débité</p>
              <p className="text-lg font-bold text-text-secondary">{summary.encaissement.walletDebited.toFixed(2)} €</p>
              <p className="text-[10px] text-text-tertiary leading-tight">déjà encaissé via recharges</p>
            </div>
            <div>
              <p className="text-xs text-text-tertiary mb-0.5">Bonus consommé</p>
              <p className="text-lg font-bold text-warning">{summary.encaissement.bonusConsumed.toFixed(2)} €</p>
              <p className="text-[10px] text-text-tertiary leading-tight">cadeau formule, sans contrepartie caisse</p>
            </div>
            <div className="border-l border-separator pl-3">
              <p className="text-xs text-text-tertiary mb-0.5">Total caisse</p>
              <p className="text-lg font-bold text-lime-600">{summary.encaissement.total.toFixed(2)} €</p>
              <p className="text-[10px] text-text-tertiary leading-tight">CB + espèces</p>
            </div>
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
          <Button variant="ghost" size="sm" onClick={() => handleExport('excel')} loading={exporting}>
            <Download className="w-4 h-4 mr-1.5" />Excel comptable
          </Button>
          <Button variant="ghost" size="sm" onClick={() => handleExport('pdf')} loading={exporting}>
            <Download className="w-4 h-4 mr-1.5" />PDF
          </Button>
          <Button variant="ghost" size="sm" onClick={() => window.print()}>
            <Printer className="w-4 h-4 mr-1.5" />Imprimer
          </Button>
        </div>

        {/* Détail des transactions (paginé) */}
        <Card>
          <div className="flex gap-1 mb-4 overflow-x-auto pb-1">
            {tabs.map((t) => (
              <button key={t.id} onClick={() => { setActiveTab(t.id); setPage(0) }}
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
          ) : pageTxs.length === 0 ? (
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
                  {pageTxs.map((t) => {
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

          {/* Footer paginé */}
          {pageCount > 0 && (
            <div className="mt-3 pt-3 border-t border-separator flex flex-wrap items-center justify-between gap-3 text-xs text-text-secondary">
              <span>
                {pageCount} transaction{pageCount > 1 ? 's' : ''} au total · page {page + 1} / {totalPages}
              </span>
              <div className="flex items-center gap-1">
                <button
                  disabled={page === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  className="p-1.5 rounded-[8px] disabled:opacity-30 disabled:cursor-not-allowed hover:bg-bg cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  className="p-1.5 rounded-[8px] disabled:opacity-30 disabled:cursor-not-allowed hover:bg-bg cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </PageWrapper>
  )
}
