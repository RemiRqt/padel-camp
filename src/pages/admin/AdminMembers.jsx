import { useEffect, useState } from 'react'
import { fetchAllMembers, creditMember, createMember } from '@/services/userService'
import { fetchFormulas as fetchFormulasService } from '@/services/clubService'
import { useAuth } from '@/context/AuthContext'
import PageWrapper from '@/components/layout/PageWrapper'
import Card from '@/components/ui/Card'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import Pagination from '@/components/ui/Pagination'
import CreditModal from '@/components/admin/members/CreditModal'
import toast from 'react-hot-toast'
import { Search, UserPlus, Wallet, Shield, Users } from 'lucide-react'

export default function AdminMembers() {
  const { user: adminUser } = useAuth()
  const [members, setMembers] = useState([])
  const [filtered, setFiltered] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter] = useState('all')
  const [formulas, setFormulas] = useState([])
  const [page, setPage] = useState(0)
  const PAGE_SIZE = 20

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
    try {
      const all = await fetchAllMembers()
      // Exclure les admins de la liste : ils n'ont pas de wallet et ne sont pas membres
      const data = all.filter((m) => m.role !== 'admin')
      setMembers(data)
      applyFilters(data, search, roleFilter)
    } catch (err) {
      toast.error('Erreur chargement membres')
      console.error('[AdminMembers] fetchMembers error:', err)
    } finally {
      setLoading(false)
    }
  }

  // Normalisation pour recherche insensible aux accents/majuscules : Rémi == Remi == REMI
  const normalize = (s) => (s || '')
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')

  const fetchFormulas = async () => {
    try {
      const data = await fetchFormulasService()
      setFormulas(data)
    } catch (err) {
      console.error('[AdminMembers] fetchFormulas error:', err)
    }
  }

  useEffect(() => { fetchMembers(); fetchFormulas() }, [])

  const applyFilters = (data, q, role) => {
    let result = data
    if (q) {
      const nq = normalize(q)
      result = result.filter((m) =>
        normalize(m.display_name).includes(nq) ||
        normalize(m.email).includes(nq) ||
        (m.phone || '').includes(q)
      )
    }
    if (role !== 'all') result = result.filter((m) => m.role === role)
    setFiltered(result)
  }

  useEffect(() => { applyFilters(members, search, roleFilter); setPage(0) }, [search, roleFilter])

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
      const description = creditMode === 'formula'
        ? `Recharge formule ${amountPaid}€ → ${amountCredited}€ (${methodLabel})`
        : `Crédit libre ${amountPaid}€ (${methodLabel})`
      await creditMember(selectedMember.id, adminUser.id, amountPaid, amountCredited, description, paymentMethod)

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
      await createMember(newMember.email, newMember.password, newMember.display_name, newMember.phone)
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
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <UserPlus className="w-4 h-4 mr-1" />Créer
          </Button>
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
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-2">
              {filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map((m) => {
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
            <Pagination page={page} totalPages={Math.ceil(filtered.length / PAGE_SIZE)} onChange={setPage} />
          </>
        )}
      </div>

      <CreditModal
        isOpen={creditOpen} onClose={() => setCreditOpen(false)} member={selectedMember}
        formulas={formulas} creditMode={creditMode} setCreditMode={setCreditMode}
        selectedFormula={selectedFormula} setSelectedFormula={setSelectedFormula}
        freeAmount={freeAmount} setFreeAmount={setFreeAmount}
        paymentMethod={paymentMethod} setPaymentMethod={setPaymentMethod}
        crediting={crediting} onCredit={handleCredit}
      />

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
