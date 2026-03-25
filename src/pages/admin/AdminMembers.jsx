import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import PageWrapper from '@/components/layout/PageWrapper'
import Card from '@/components/ui/Card'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import Select from '@/components/ui/Select'
import ExportButtons from '@/components/ui/ExportButtons'
import { exportExcel, exportPDF } from '@/utils/export'
import toast from 'react-hot-toast'
import {
  Search, UserPlus, Wallet, Gift, ChevronRight, Shield, Users, Filter,
  CreditCard, Banknote
} from 'lucide-react'

export default function AdminMembers() {
  const { user: adminUser } = useAuth()
  const [members, setMembers] = useState([])
  const [filtered, setFiltered] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [formulas, setFormulas] = useState([])

  // Modals
  const [creditOpen, setCreditOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [selectedMember, setSelectedMember] = useState(null)

  // Credit form
  const [creditMode, setCreditMode] = useState('formula') // 'formula' | 'free'
  const [selectedFormula, setSelectedFormula] = useState(null)
  const [freeAmount, setFreeAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('cb') // 'cb' | 'cash'
  const [crediting, setCrediting] = useState(false)

  // Create member form
  const [newMember, setNewMember] = useState({ email: '', password: '', display_name: '', phone: '' })
  const [creating, setCreating] = useState(false)

  const fetchMembers = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })
    if (!error && data) {
      setMembers(data)
      applyFilters(data, search, roleFilter)
    }
    setLoading(false)
  }

  const fetchFormulas = async () => {
    try {
      const { data, error } = await supabase
        .from('recharge_formulas')
        .select('*')
        .eq('is_active', true)
        .order('amount_paid')
      if (error) throw error
      if (data) setFormulas(data)
    } catch (err) {
      console.error('[AdminMembers] fetchFormulas error:', err)
    }
  }

  useEffect(() => { fetchMembers(); fetchFormulas() }, [])

  const applyFilters = (data, q, role) => {
    let result = data
    if (q) {
      const lq = q.toLowerCase()
      result = result.filter((m) =>
        m.display_name?.toLowerCase().includes(lq) ||
        m.email?.toLowerCase().includes(lq) ||
        m.phone?.includes(q)
      )
    }
    if (role !== 'all') result = result.filter((m) => m.role === role)
    setFiltered(result)
  }

  useEffect(() => { applyFilters(members, search, roleFilter) }, [search, roleFilter])

  const openCredit = (member) => {
    setSelectedMember(member)
    setCreditMode('formula')
    setSelectedFormula(formulas[0] || null)
    setFreeAmount('')
    setPaymentMethod('cb')
    setCreditOpen(true)
  }

  const handleCredit = async () => {
    if (!selectedMember || !adminUser) return
    setCrediting(true)
    try {
      const amountPaid = creditMode === 'formula'
        ? parseFloat(selectedFormula.amount_paid)
        : parseFloat(freeAmount)
      const amountCredited = creditMode === 'formula'
        ? parseFloat(selectedFormula.amount_credited)
        : null

      if (isNaN(amountPaid) || amountPaid <= 0) {
        toast.error('Montant invalide')
        setCrediting(false)
        return
      }

      const methodLabel = paymentMethod === 'cb' ? 'CB' : 'Espèces'
      const { error } = await supabase.rpc('credit_user', {
        p_user_id: selectedMember.id,
        p_performed_by: adminUser.id,
        p_amount_paid: amountPaid,
        p_amount_credited: amountCredited,
        p_description: creditMode === 'formula'
          ? `Recharge formule ${amountPaid}€ → ${amountCredited}€ (${methodLabel})`
          : `Crédit libre ${amountPaid}€ (${methodLabel})`,
      })
      if (error) throw error

      toast.success(`${selectedMember.display_name} crédité de ${amountPaid}€`)
      setCreditOpen(false)
      fetchMembers()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setCrediting(false)
    }
  }

  const handleCreateMember = async () => {
    if (!newMember.email || !newMember.password || !newMember.display_name) {
      toast.error('Email, mot de passe et nom requis')
      return
    }
    setCreating(true)
    try {
      const { error } = await supabase.auth.signUp({
        email: newMember.email,
        password: newMember.password,
        options: { data: { display_name: newMember.display_name, phone: newMember.phone } },
      })
      if (error) throw error
      toast.success('Membre créé')
      setCreateOpen(false)
      setNewMember({ email: '', password: '', display_name: '', phone: '' })
      setTimeout(fetchMembers, 1000) // le trigger crée le profil
    } catch (err) {
      toast.error(err.message)
    } finally {
      setCreating(false)
    }
  }

  const exportCols = [
    { key: 'display_name', label: 'Nom' },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Tél' },
    { key: 'role', label: 'Rôle' },
    { key: 'balance', label: 'Solde' },
    { key: 'balance_bonus', label: 'Bonus' },
    { key: 'license_number', label: 'Licence FFT' },
  ]
  const exportRows = filtered.map((m) => ({
    ...m,
    balance: parseFloat(m.balance).toFixed(2) + '€',
    balance_bonus: parseFloat(m.balance_bonus).toFixed(2) + '€',
  }))

  return (
    <PageWrapper wide>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            <h1 className="text-2xl font-bold text-text">Membres</h1>
            <Badge color="primary">{members.length}</Badge>
          </div>
          <div className="flex items-center gap-2">
            <ExportButtons
              onExcel={() => exportExcel(exportRows, exportCols, 'membres')}
              onPDF={() => exportPDF(exportRows, exportCols, 'membres', 'Padel Camp — Membres')}
            />
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <UserPlus className="w-4 h-4 mr-1" />Créer
            </Button>
          </div>
        </div>

        {/* Search & Filters */}
        <Card className="!p-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
              <input
                type="text"
                placeholder="Rechercher un membre..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-[10px] bg-bg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-text-tertiary" />
              <select
                aria-label="Filtrer par rôle"
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="px-3 py-2.5 rounded-[10px] bg-bg text-sm border-0 focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="all">Tous les rôles</option>
                <option value="user">Membres</option>
                <option value="admin">Admins</option>
              </select>
            </div>
          </div>
        </Card>

        {/* Members List */}
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-20 rounded-[16px] bg-white animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <Card className="text-center !py-8">
            <Users className="w-8 h-8 text-text-tertiary mx-auto mb-2" />
            <p className="text-sm text-text-tertiary">Aucun membre trouvé</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-2">
            {filtered.map((m) => {
              const total = parseFloat(m.balance) + parseFloat(m.balance_bonus)
              return (
                <Card key={m.id} className="!p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-lg font-bold text-primary">
                        {m.display_name?.charAt(0)?.toUpperCase() || '?'}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-text truncate">{m.display_name}</p>
                        {m.role === 'admin' && <Badge color="primary"><Shield className="w-2.5 h-2.5 mr-0.5 inline" />Admin</Badge>}
                      </div>
                      <p className="text-xs text-text-secondary truncate">{m.email}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-primary">{total.toFixed(2)}€</p>
                      {parseFloat(m.balance_bonus) > 0 && (
                        <p className="text-[10px] text-lime-dark">+{parseFloat(m.balance_bonus).toFixed(2)}€ bonus</p>
                      )}
                    </div>
                    <button
                      onClick={() => openCredit(m)}
                      className="p-2 rounded-[10px] hover:bg-bg transition-colors cursor-pointer"
                      title="Créditer"
                    >
                      <Wallet className="w-4 h-4 text-primary" />
                    </button>
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      {/* Modal créditer */}
      <Modal
        isOpen={creditOpen}
        onClose={() => setCreditOpen(false)}
        title={`Créditer ${selectedMember?.display_name || ''}`}
      >
        {selectedMember && (
          <div className="space-y-4">
            <div className="bg-bg rounded-[12px] p-3">
              <p className="text-xs text-text-secondary">Solde actuel</p>
              <p className="text-lg font-bold text-primary">
                {(parseFloat(selectedMember.balance) + parseFloat(selectedMember.balance_bonus)).toFixed(2)}€
              </p>
              <p className="text-[10px] text-text-tertiary">
                {parseFloat(selectedMember.balance).toFixed(2)}€ réel + {parseFloat(selectedMember.balance_bonus).toFixed(2)}€ bonus
              </p>
            </div>

            {/* Toggle mode */}
            <div className="flex rounded-[12px] bg-bg p-1">
              <button
                onClick={() => setCreditMode('formula')}
                className={`flex-1 py-2 rounded-[10px] text-sm font-medium transition-all cursor-pointer ${
                  creditMode === 'formula' ? 'bg-primary text-white' : 'text-text-secondary'
                }`}
              >
                Via formule
              </button>
              <button
                onClick={() => setCreditMode('free')}
                className={`flex-1 py-2 rounded-[10px] text-sm font-medium transition-all cursor-pointer ${
                  creditMode === 'free' ? 'bg-primary text-white' : 'text-text-secondary'
                }`}
              >
                Crédit libre
              </button>
            </div>

            {creditMode === 'formula' ? (
              <div className="space-y-2">
                {formulas.map((f) => {
                  const active = selectedFormula?.id === f.id
                  return (
                    <button
                      key={f.id}
                      onClick={() => setSelectedFormula(f)}
                      className={`w-full flex items-center justify-between p-3.5 rounded-[12px] transition-all cursor-pointer ${
                        active ? 'bg-primary text-white' : 'bg-bg hover:bg-primary/5'
                      }`}
                    >
                      <div className="text-left">
                        <p className={`text-sm font-semibold ${active ? 'text-white' : 'text-text'}`}>
                          {parseFloat(f.amount_paid).toFixed(0)}€
                        </p>
                        <p className={`text-xs ${active ? 'text-white/60' : 'text-text-secondary'}`}>payé</p>
                      </div>
                      <ChevronRight className={`w-4 h-4 ${active ? 'text-white/60' : 'text-text-tertiary'}`} />
                      <div className="text-right">
                        <p className={`text-sm font-semibold ${active ? 'text-lime' : 'text-primary'}`}>
                          {parseFloat(f.amount_credited).toFixed(0)}€
                        </p>
                        <p className={`text-xs ${active ? 'text-white/60' : 'text-lime-dark'}`}>
                          +{parseFloat(f.bonus).toFixed(0)}€ bonus
                        </p>
                      </div>
                    </button>
                  )
                })}
                {formulas.length === 0 && (
                  <p className="text-sm text-text-tertiary text-center py-3">Aucune formule configurée</p>
                )}
              </div>
            ) : (
              <Input
                label="Montant à créditer (€)"
                type="number"
                min="0"
                step="0.01"
                value={freeAmount}
                onChange={(e) => setFreeAmount(e.target.value)}
                placeholder="50.00"
              />
            )}

            {/* Choix mode de paiement */}
            <div>
              <p className="text-xs font-medium text-text-secondary mb-2">Mode de paiement</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPaymentMethod('cb')}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-[12px] text-sm font-medium transition-all cursor-pointer ${
                    paymentMethod === 'cb'
                      ? 'bg-primary text-white'
                      : 'bg-bg hover:bg-primary/5 text-text-secondary'
                  }`}
                >
                  <CreditCard className="w-4 h-4" />CB
                </button>
                <button
                  onClick={() => setPaymentMethod('cash')}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-[12px] text-sm font-medium transition-all cursor-pointer ${
                    paymentMethod === 'cash'
                      ? 'bg-primary text-white'
                      : 'bg-bg hover:bg-primary/5 text-text-secondary'
                  }`}
                >
                  <Banknote className="w-4 h-4" />Espèces
                </button>
              </div>
            </div>

            <Button className="w-full" loading={crediting} onClick={handleCredit}>
              <Wallet className="w-4 h-4 mr-1" />
              Créditer
            </Button>
          </div>
        )}
      </Modal>

      {/* Modal créer membre */}
      <Modal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Créer un membre"
      >
        <div className="space-y-4">
          <Input
            label="Nom complet"
            value={newMember.display_name}
            onChange={(e) => setNewMember({ ...newMember, display_name: e.target.value })}
            required
          />
          <Input
            label="Email"
            type="email"
            value={newMember.email}
            onChange={(e) => setNewMember({ ...newMember, email: e.target.value })}
            required
          />
          <Input
            label="Téléphone"
            type="tel"
            value={newMember.phone}
            onChange={(e) => setNewMember({ ...newMember, phone: e.target.value })}
          />
          <Input
            label="Mot de passe"
            type="password"
            value={newMember.password}
            onChange={(e) => setNewMember({ ...newMember, password: e.target.value })}
            required
          />
          <Button className="w-full" loading={creating} onClick={handleCreateMember}>
            <UserPlus className="w-4 h-4 mr-1" />
            Créer le membre
          </Button>
        </div>
      </Modal>
    </PageWrapper>
  )
}
