import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import PageWrapper from '@/components/layout/PageWrapper'
import Card from '@/components/ui/Card'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import DateRangePicker from '@/components/ui/DateRangePicker'
import ExportButtons from '@/components/ui/ExportButtons'
import { exportExcel, exportPDF } from '@/utils/export'
import { toDateString } from '@/utils/formatDate'
import toast from 'react-hot-toast'
import { CreditCard, Search, Wallet, Gift, ChevronRight, Check } from 'lucide-react'

export default function AdminRecharge() {
  const { user: admin } = useAuth()
  const today = toDateString(new Date())
  const thirtyAgo = toDateString(new Date(Date.now() - 30 * 86400000))

  const [search, setSearch] = useState('')
  const [results, setResults] = useState([])
  const [selectedMember, setSelectedMember] = useState(null)
  const [formulas, setFormulas] = useState([])
  const [selectedFormula, setSelectedFormula] = useState(null)
  const [mode, setMode] = useState('formula')
  const [freeAmount, setFreeAmount] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // History
  const [from, setFrom] = useState(thirtyAgo)
  const [to, setTo] = useState(today)
  const [history, setHistory] = useState([])

  useEffect(() => {
    supabase.from('recharge_formulas').select('*').eq('is_active', true).order('amount_paid')
      .then(({ data }) => { if (data) { setFormulas(data); setSelectedFormula(data[0] || null) } })
  }, [])

  useEffect(() => {
    supabase.from('transactions').select('*, profile:profiles!transactions_user_id_fkey(display_name)')
      .in('type', ['credit', 'credit_bonus'])
      .gte('created_at', from + 'T00:00:00').lte('created_at', to + 'T23:59:59')
      .order('created_at', { ascending: false }).limit(50)
      .then(({ data }) => setHistory(data || []))
  }, [from, to, submitting])

  useEffect(() => {
    if (search.length < 2) { setResults([]); return }
    const t = setTimeout(async () => {
      const { data } = await supabase.from('profiles').select('id, display_name, email, balance, balance_bonus')
        .ilike('display_name', `%${search}%`).limit(5)
      setResults(data || [])
    }, 300)
    return () => clearTimeout(t)
  }, [search])

  const handleCredit = async () => {
    if (!selectedMember || !admin) return
    const amountPaid = mode === 'formula' ? parseFloat(selectedFormula?.amount_paid) : parseFloat(freeAmount)
    const amountCredited = mode === 'formula' ? parseFloat(selectedFormula?.amount_credited) : null

    if (isNaN(amountPaid) || amountPaid <= 0) { toast.error('Montant invalide'); return }
    setSubmitting(true)
    try {
      const { error } = await supabase.rpc('credit_user', {
        p_user_id: selectedMember.id,
        p_performed_by: admin.id,
        p_amount_paid: amountPaid,
        p_amount_credited: amountCredited,
        p_description: mode === 'formula'
          ? `Recharge formule ${amountPaid}€ → ${amountCredited}€`
          : `Crédit libre ${amountPaid}€`,
      })
      if (error) throw error
      toast.success(`${selectedMember.display_name} crédité !`)
      setSelectedMember(null)
      setSearch('')
      setFreeAmount('')
    } catch (err) { toast.error(err.message) }
    finally { setSubmitting(false) }
  }

  const exportCols = [
    { key: 'date', label: 'Date' },
    { key: 'member', label: 'Membre' },
    { key: 'type', label: 'Type' },
    { key: 'amount', label: 'Montant' },
    { key: 'description', label: 'Description' },
  ]
  const exportRows = history.map((tx) => ({
    date: new Date(tx.created_at).toLocaleDateString('fr-FR'),
    member: tx.profile?.display_name || '—',
    type: tx.type === 'credit' ? 'Crédit' : 'Bonus',
    amount: parseFloat(tx.amount).toFixed(2) + '€',
    description: tx.description,
  }))

  return (
    <PageWrapper>
      <div className="space-y-5">
        <div className="flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-primary" />
          <h1 className="text-2xl font-bold text-text">Recharger</h1>
        </div>

        {/* Step 1: Select member */}
        <Card>
          <h3 className="font-semibold text-text mb-3">1. Sélectionner un membre</h3>
          {selectedMember ? (
            <div className="flex items-center justify-between p-3 rounded-[12px] bg-primary/5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="font-bold text-primary">{selectedMember.display_name.charAt(0).toUpperCase()}</span>
                </div>
                <div>
                  <p className="text-sm font-semibold">{selectedMember.display_name}</p>
                  <p className="text-xs text-text-secondary">
                    Solde: {(parseFloat(selectedMember.balance) + parseFloat(selectedMember.balance_bonus)).toFixed(2)}€
                  </p>
                </div>
              </div>
              <button onClick={() => { setSelectedMember(null); setSearch('') }} className="text-xs text-danger font-medium cursor-pointer">Changer</button>
            </div>
          ) : (
            <>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
                <input
                  type="text" placeholder="Rechercher un membre..."
                  value={search} onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-[10px] bg-bg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  autoFocus
                />
              </div>
              {results.length > 0 && (
                <div className="mt-2 space-y-1">
                  {results.map((m) => (
                    <button key={m.id} onClick={() => { setSelectedMember(m); setSearch('') }}
                      className="w-full flex items-center gap-3 p-2.5 rounded-[10px] hover:bg-bg text-left text-sm cursor-pointer">
                      <span className="font-medium">{m.display_name}</span>
                      <span className="text-text-tertiary text-xs">{m.email}</span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </Card>

        {/* Step 2: Choose amount */}
        {selectedMember && (
          <Card>
            <h3 className="font-semibold text-text mb-3">2. Montant</h3>
            <div className="flex rounded-[12px] bg-bg p-1 mb-4">
              <button onClick={() => setMode('formula')}
                className={`flex-1 py-2 rounded-[10px] text-sm font-medium transition-all cursor-pointer ${mode === 'formula' ? 'bg-primary text-white' : 'text-text-secondary'}`}>
                Formule
              </button>
              <button onClick={() => setMode('free')}
                className={`flex-1 py-2 rounded-[10px] text-sm font-medium transition-all cursor-pointer ${mode === 'free' ? 'bg-primary text-white' : 'text-text-secondary'}`}>
                Libre
              </button>
            </div>
            {mode === 'formula' ? (
              <div className="grid grid-cols-2 gap-2">
                {formulas.map((f) => {
                  const active = selectedFormula?.id === f.id
                  return (
                    <button key={f.id} onClick={() => setSelectedFormula(f)}
                      className={`p-4 rounded-[14px] text-center transition-all cursor-pointer ${
                        active ? 'bg-primary text-white shadow-[0_4px_12px_rgba(11,39,120,0.3)]' : 'bg-bg hover:bg-primary/5'}`}>
                      <p className={`text-2xl font-bold ${active ? 'text-white' : 'text-primary'}`}>{parseFloat(f.amount_paid).toFixed(0)}€</p>
                      <p className={`text-xs mt-1 ${active ? 'text-white/60' : 'text-text-secondary'}`}>→ {parseFloat(f.amount_credited).toFixed(0)}€</p>
                      <p className={`text-xs font-semibold mt-0.5 ${active ? 'text-lime' : 'text-lime-dark'}`}>+{parseFloat(f.bonus).toFixed(0)}€ bonus</p>
                    </button>
                  )
                })}
              </div>
            ) : (
              <Input label="Montant (€)" type="number" min="0" step="0.01" value={freeAmount}
                onChange={(e) => setFreeAmount(e.target.value)} placeholder="50.00" />
            )}
            <Button className="w-full mt-4" loading={submitting} onClick={handleCredit}>
              <Check className="w-4 h-4 mr-1" />
              Créditer {mode === 'formula' && selectedFormula ? `${parseFloat(selectedFormula.amount_paid).toFixed(0)}€` : freeAmount ? `${freeAmount}€` : ''}
            </Button>
          </Card>
        )}

        {/* History */}
        <Card>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <h3 className="font-semibold text-text">Historique recharges</h3>
            <div className="flex items-center gap-2">
              <DateRangePicker from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t) }} />
              <ExportButtons
                onExcel={() => exportExcel(exportRows, exportCols, `recharges_${from}_${to}`)}
                onPDF={() => exportPDF(exportRows, exportCols, `recharges_${from}_${to}`, 'Padel Camp — Recharges')}
              />
            </div>
          </div>
          {history.length === 0 ? (
            <p className="text-sm text-text-tertiary text-center py-4">Aucune recharge sur cette période</p>
          ) : (
            <div className="space-y-1.5 max-h-72 overflow-y-auto">
              {history.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between py-2 px-3 rounded-[10px] bg-bg">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-text truncate">{tx.profile?.display_name || '—'}</p>
                    <p className="text-[10px] text-text-tertiary">{tx.description}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-sm font-semibold ${tx.type === 'credit_bonus' ? 'text-lime-dark' : 'text-success'}`}>
                      +{parseFloat(tx.amount).toFixed(2)}€
                    </p>
                    <p className="text-[10px] text-text-tertiary">
                      {new Date(tx.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </PageWrapper>
  )
}
