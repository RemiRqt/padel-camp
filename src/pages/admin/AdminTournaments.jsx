import { useEffect, useState } from 'react'
import {
  adminValidateRegistration, adminRejectRegistration, cancelRegistrationAndPromote,
  fetchTournamentsWithRegCounts, fetchRegistrations, saveTournament, deleteTournament
} from '@/services/tournamentService'
import PageWrapper from '@/components/layout/PageWrapper'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import ConfirmModal from '@/components/ui/ConfirmModal'
import useConfirm from '@/hooks/useConfirm'
import ExportButtons from '@/components/ui/ExportButtons'
import { exportExcel, exportPDF } from '@/utils/export'
import TournamentDetailView from '@/components/admin/tournaments/TournamentDetailView'
import TournamentFormModal from '@/components/admin/tournaments/TournamentFormModal'
import TournamentListView from '@/components/admin/tournaments/TournamentListView'
import toast from 'react-hot-toast'
import { Trophy, Plus } from 'lucide-react'

const STATUS_LABELS = { draft: 'Brouillon', open: 'Ouvert', full: 'Complet', closed: 'Ferm\u00e9', cancelled: 'Annul\u00e9', completed: 'Termin\u00e9' }

const INITIAL_FORM = {
  name: '', description: '', date: '', start_time: '09:00', end_time: '18:00',
  level: 'P250', category: 'hommes', max_teams: 16, judge_arbiter: '', status: 'draft',
  registration_deadline: '',
}

export default function AdminTournaments() {
  const [tournaments, setTournaments] = useState([])
  const [regCounts, setRegCounts] = useState({})
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ ...INITIAL_FORM })
  const [saving, setSaving] = useState(false)
  const { askConfirm, confirmProps } = useConfirm()

  // Detail view
  const [selectedTournament, setSelectedTournament] = useState(null)
  const [registrations, setRegistrations] = useState([])
  const [actionLoading, setActionLoading] = useState(null)

  const fetchAll = async () => {
    setLoading(true)
    const { tournaments: tourneys, regCounts: counts } = await fetchTournamentsWithRegCounts()
    setTournaments(tourneys)
    setRegCounts(counts)
    setLoading(false)
  }

  useEffect(() => { fetchAll() }, [])

  // --- CRUD ---
  const openCreate = () => {
    setEditing(null)
    setForm({ ...INITIAL_FORM })
    setModalOpen(true)
  }

  const openEdit = (e, t) => {
    e.stopPropagation()
    setEditing(t)
    setForm({
      name: t.name, description: t.description || '', date: t.date,
      start_time: t.start_time.slice(0, 5), end_time: t.end_time.slice(0, 5),
      level: t.level, category: t.category, max_teams: t.max_teams,
      judge_arbiter: t.judge_arbiter || '', status: t.status,
      registration_deadline: t.registration_deadline ? t.registration_deadline.slice(0, 16) : '',
    })
    setModalOpen(true)
  }

  const handleSave = async () => {
    if (!form.name || !form.date) { toast.error('Nom et date requis'); return }
    const maxTeams = parseInt(form.max_teams)
    if (isNaN(maxTeams) || maxTeams < 2) { toast.error('Max \u00e9quipes doit \u00eatre \u2265 2'); return }
    setSaving(true)
    try {
      const data = { ...form, max_teams: maxTeams, registration_deadline: form.registration_deadline || null }
      await saveTournament(editing?.id, data)
      toast.success(editing ? 'Tournoi mis \u00e0 jour' : 'Tournoi cr\u00e9\u00e9')
      setModalOpen(false)
      fetchAll()
    } catch (err) { toast.error(err.message) }
    finally { setSaving(false) }
  }

  const handleDelete = async (e, t) => {
    e.stopPropagation()
    askConfirm({
      title: 'Supprimer le tournoi',
      message: `Supprimer "${t.name}" et toutes ses inscriptions ?`,
      confirmLabel: 'Supprimer',
      onConfirm: async () => {
        try {
          await deleteTournament(t.id)
          toast.success('Supprim\u00e9'); fetchAll()
        } catch (err) { toast.error(err.message) }
      },
    })
  }

  // --- Detail view ---
  const openDetail = async (t) => {
    setSelectedTournament(t)
    const data = await fetchRegistrations(t.id)
    setRegistrations(data)
  }

  const refreshRegistrations = async () => {
    if (!selectedTournament) return
    const regs = await fetchRegistrations(selectedTournament.id)
    setRegistrations(regs)
    setRegCounts((prev) => ({ ...prev, [selectedTournament.id]: regs.filter((r) => r.status !== 'cancelled').length }))
  }

  const handleValidate = async (regId) => {
    if (!selectedTournament) return
    setActionLoading(regId)
    try {
      const result = await adminValidateRegistration(regId, selectedTournament.id, selectedTournament.max_teams)
      toast.success(result.status === 'waitlist' ? `File d'attente (position #${result.position})` : 'Inscription valid\u00e9e')
      refreshRegistrations()
    } catch (err) { toast.error(err.message) }
    finally { setActionLoading(null) }
  }

  const handleReject = async (regId) => {
    setActionLoading(regId)
    try {
      await adminRejectRegistration(regId)
      toast.success('Inscription refus\u00e9e')
      refreshRegistrations()
    } catch (err) { toast.error(err.message) }
    finally { setActionLoading(null) }
  }

  const handleCancelAndPromote = async (regId) => {
    if (!selectedTournament) return
    askConfirm({
      title: 'Annuler cette inscription ?',
      message: 'Le premier en file d\'attente sera promu.',
      confirmLabel: 'Annuler l\'inscription',
      onConfirm: async () => {
        setActionLoading(regId)
        try {
          const promoted = await cancelRegistrationAndPromote(regId, selectedTournament.id)
          toast.success(promoted ? `Annul\u00e9e. ${promoted.player1_name} & ${promoted.player2_name} promus !` : 'Inscription annul\u00e9e')
          refreshRegistrations()
        } catch (err) { toast.error(err.message) }
        finally { setActionLoading(null) }
      },
    })
  }

  // --- Exports ---
  const exportCols = [
    { key: 'name', label: 'Tournoi' }, { key: 'date', label: 'Date' },
    { key: 'level', label: 'Niveau' }, { key: 'category', label: 'Cat\u00e9gorie' },
    { key: 'teams', label: 'Inscriptions' }, { key: 'max', label: 'Max' },
    { key: 'status', label: 'Statut' },
  ]
  const exportRows = tournaments.map((t) => ({
    name: t.name, date: new Date(t.date + 'T00:00').toLocaleDateString('fr-FR'),
    level: t.level, category: t.category, teams: regCounts[t.id] || 0,
    max: t.max_teams, status: STATUS_LABELS[t.status],
  }))

  // =============================================
  // DETAIL VIEW
  // =============================================
  if (selectedTournament) {
    return (
      <TournamentDetailView
        tournament={selectedTournament}
        regCounts={regCounts}
        registrations={registrations}
        onBack={() => setSelectedTournament(null)}
        onEdit={openEdit}
        onValidate={handleValidate}
        onReject={handleReject}
        onCancelAndPromote={handleCancelAndPromote}
        actionLoading={actionLoading}
        modalOpen={modalOpen}
        onCloseModal={() => setModalOpen(false)}
        modalContent={<TournamentFormModal form={form} setForm={setForm} editing={editing} saving={saving} onSave={handleSave} />}
        confirmProps={confirmProps}
      />
    )
  }

  // =============================================
  // LIST VIEW
  // =============================================
  return (
    <PageWrapper wide>
      <div className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-primary" />
            <h1 className="text-2xl font-bold text-text">Tournois</h1>
            <Badge color="primary">{tournaments.length}</Badge>
          </div>
          <div className="flex items-center gap-2">
            <ExportButtons
              onExcel={() => exportExcel(exportRows, exportCols, 'tournois')}
              onPDF={() => exportPDF(exportRows, exportCols, 'tournois', 'Padel Camp \u2014 Tournois')}
            />
            <Button size="sm" onClick={openCreate}><Plus className="w-4 h-4 mr-1" />Cr\u00e9er</Button>
          </div>
        </div>

        {loading ? (
          <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-16 rounded-[16px] bg-white animate-pulse" />)}</div>
        ) : tournaments.length === 0 ? (
          <Card className="text-center !py-8">
            <Trophy className="w-8 h-8 text-text-tertiary mx-auto mb-2" />
            <p className="text-sm text-text-tertiary">Aucun tournoi</p>
          </Card>
        ) : (
          <TournamentListView
            tournaments={tournaments} regCounts={regCounts}
            onOpenDetail={openDetail} onEdit={openEdit} onDelete={handleDelete}
          />
        )}
      </div>

      {/* Create/Edit modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Modifier tournoi' : 'Nouveau tournoi'}>
        <TournamentFormModal form={form} setForm={setForm} editing={editing} saving={saving} onSave={handleSave} />
      </Modal>
      <ConfirmModal {...confirmProps} />
    </PageWrapper>
  )
}
