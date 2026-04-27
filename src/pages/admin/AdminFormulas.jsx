import { useEffect, useState } from 'react'
import { fetchFormulas, saveFormula, toggleFormula, deleteFormula } from '@/services/clubService'
import PageWrapper from '@/components/layout/PageWrapper'
import Card from '@/components/ui/Card'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import toast from 'react-hot-toast'
import { CreditCard, Plus, Pencil, Trash2, Gift } from 'lucide-react'
import ConfirmModal from '@/components/ui/ConfirmModal'
import useConfirm from '@/hooks/useConfirm'

export default function AdminFormulas() {
  const { confirmProps, askConfirm } = useConfirm()
  const [formulas, setFormulas] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ amount_paid: '', amount_credited: '' })
  const [saving, setSaving] = useState(false)

  const fetch = async () => {
    setLoading(true)
    try {
      const data = await fetchFormulas(false)
      setFormulas(data)
    } catch (err) {
      toast.error('Erreur chargement formules')
      console.error('[AdminFormulas] fetch error:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetch() }, [])

  const openCreate = () => {
    setEditing(null)
    setForm({ amount_paid: '', amount_credited: '' })
    setModalOpen(true)
  }

  const openEdit = (f) => {
    setEditing(f)
    setForm({ amount_paid: f.amount_paid.toString(), amount_credited: f.amount_credited.toString() })
    setModalOpen(true)
  }

  const handleSave = async () => {
    const paid = parseFloat(form.amount_paid)
    const credited = parseFloat(form.amount_credited)
    if (isNaN(paid) || isNaN(credited) || paid <= 0 || credited < paid) {
      toast.error('Montants invalides (crédité ≥ payé)')
      return
    }
    setSaving(true)
    try {
      await saveFormula(editing?.id, { amount_paid: paid, amount_credited: credited })
      toast.success(editing ? 'Formule mise à jour' : 'Formule créée')
      setModalOpen(false)
      fetch()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleToggle = async (f) => {
    try {
      await toggleFormula(f.id, f.is_active)
      fetch()
    } catch (err) {
      toast.error(err.message)
    }
  }

  const handleDelete = async (f) => {
    askConfirm({
      title: 'Supprimer la formule',
      message: `Supprimer la formule ${f.amount_paid}€ ?`,
      confirmLabel: 'Supprimer',
      variant: 'danger',
      onConfirm: async () => {
        try {
          await deleteFormula(f.id)
          toast.success('Supprimée')
          fetch()
        } catch (err) { toast.error(err.message) }
      },
    })
  }

  return (
    <PageWrapper wide>
      <div className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-primary" />
            <h1 className="text-2xl font-bold text-text">Formules de recharge</h1>
          </div>
          <Button size="sm" onClick={openCreate}>
            <Plus className="w-4 h-4 mr-1" />Ajouter
          </Button>
        </div>

        {/* Table */}
        <Card className="!p-0 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-separator bg-bg/50">
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Payé</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Crédité</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Bonus</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-text-secondary">Statut</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-text-secondary">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [1, 2, 3].map((i) => (
                  <tr key={i}><td colSpan={5} className="p-3"><div className="h-10 rounded bg-bg animate-pulse" /></td></tr>
                ))
              ) : formulas.length === 0 ? (
                <tr><td colSpan={5} className="p-8 text-center text-sm text-text-tertiary">Aucune formule</td></tr>
              ) : (
                formulas.map((f) => (
                  <tr key={f.id} className="border-b border-separator last:border-0 hover:bg-bg/30">
                    <td className="px-4 py-3 text-sm font-semibold text-text">{parseFloat(f.amount_paid).toFixed(0)}€</td>
                    <td className="px-4 py-3 text-sm font-semibold text-primary">{parseFloat(f.amount_credited).toFixed(0)}€</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <Gift className="w-3.5 h-3.5 text-lime-dark" />
                        <span className="text-sm font-semibold text-lime-dark">+{parseFloat(f.bonus).toFixed(0)}€</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => handleToggle(f)} className="cursor-pointer">
                        <Badge color={f.is_active ? 'success' : 'gray'}>
                          {f.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEdit(f)} className="p-1.5 rounded-lg hover:bg-bg cursor-pointer">
                          <Pencil className="w-3.5 h-3.5 text-text-secondary" />
                        </button>
                        <button onClick={() => handleDelete(f)} className="p-1.5 rounded-lg hover:bg-danger/10 cursor-pointer">
                          <Trash2 className="w-3.5 h-3.5 text-danger" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </Card>
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Modifier la formule' : 'Nouvelle formule'}>
        <div className="space-y-4">
          <Input
            label="Montant payé (€)"
            type="number" min="0" step="1"
            value={form.amount_paid}
            onChange={(e) => setForm({ ...form, amount_paid: e.target.value })}
          />
          <Input
            label="Montant crédité (€)"
            type="number" min="0" step="1"
            value={form.amount_credited}
            onChange={(e) => setForm({ ...form, amount_credited: e.target.value })}
          />
          {form.amount_paid && form.amount_credited && parseFloat(form.amount_credited) >= parseFloat(form.amount_paid) && (
            <div className="bg-lime/10 rounded-[12px] p-3 text-center">
              <p className="text-xs text-text-secondary">Bonus</p>
              <p className="text-xl font-bold text-lime-dark">
                +{(parseFloat(form.amount_credited) - parseFloat(form.amount_paid)).toFixed(0)}€
              </p>
            </div>
          )}
          <Button className="w-full" loading={saving} onClick={handleSave}>
            {editing ? 'Enregistrer' : 'Créer'}
          </Button>
        </div>
      </Modal>
      <ConfirmModal {...confirmProps} />
    </PageWrapper>
  )
}
