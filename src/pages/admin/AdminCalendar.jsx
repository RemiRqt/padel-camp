import { useEffect, useState, useMemo } from 'react'
import useConfirm from '@/hooks/useConfirm'
import ConfirmModal from '@/components/ui/ConfirmModal'
import {
  adminValidateRegistration, adminRejectRegistration, cancelRegistrationAndPromote,
  fetchTournaments, fetchRegistrations, fetchRegistrationCount, saveTournament, deleteTournament
} from '@/services/tournamentService'
import { fetchAllEventsAdmin, saveEvent, deleteEvent } from '@/services/eventService'
import PageWrapper from '@/components/layout/PageWrapper'
import Button from '@/components/ui/Button'
import CalendarGrid from '@/components/admin/calendar/CalendarGrid'
import CalendarTournamentModal from '@/components/admin/calendar/CalendarTournamentModal'
import CalendarEventModal from '@/components/admin/calendar/CalendarEventModal'
import CalendarRegistrationModal from '@/components/admin/calendar/CalendarRegistrationModal'
import toast from 'react-hot-toast'
import { Calendar, ChevronLeft, ChevronRight, Plus } from 'lucide-react'

function getMonthDays(year, month) {
  const firstDay = new Date(year, month, 1)
  let startDow = (firstDay.getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells = []
  for (let i = 0; i < startDow; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  return cells
}

export default function AdminCalendar() {
  const { askConfirm, confirmProps } = useConfirm()
  const today = new Date()
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())

  const [tournaments, setTournaments] = useState([])
  const [events, setEvents] = useState([])
  const [regCounts, setRegCounts] = useState({})
  const [loading, setLoading] = useState(true)

  // Tournament modal
  const [tModalOpen, setTModalOpen] = useState(false)
  const [editingT, setEditingT] = useState(null)
  const [tForm, setTForm] = useState({
    name: '', description: '', date: '', start_time: '09:00', end_time: '18:00',
    level: 'P250', category: 'hommes', max_teams: 16, judge_arbiter: '', status: 'draft',
    registration_deadline: '',
  })
  const [savingT, setSavingT] = useState(false)

  // Event modal
  const [eModalOpen, setEModalOpen] = useState(false)
  const [editingE, setEditingE] = useState(null)
  const [eForm, setEForm] = useState({ name: '', description: '', date: '', start_time: '', end_time: '', is_public: true })
  const [savingE, setSavingE] = useState(false)

  // Registration detail
  const [regOpen, setRegOpen] = useState(false)
  const [selTournament, setSelTournament] = useState(null)
  const [registrations, setRegistrations] = useState([])
  const [actionLoading, setActionLoading] = useState(null)

  const fetchAll = async () => {
    setLoading(true)
    const [tourneys, evts] = await Promise.all([fetchTournaments(), fetchAllEventsAdmin()])
    setTournaments(tourneys)
    setEvents(evts)
    const counts = {}
    await Promise.all(tourneys.map(async (t) => { counts[t.id] = await fetchRegistrationCount(t.id) }))
    setRegCounts(counts)
    setLoading(false)
  }

  useEffect(() => { fetchAll() }, [])

  const monthCells = useMemo(() => getMonthDays(viewYear, viewMonth), [viewYear, viewMonth])

  const changeMonth = (offset) => {
    let m = viewMonth + offset
    let y = viewYear
    if (m < 0) { m = 11; y-- }
    if (m > 11) { m = 0; y++ }
    setViewMonth(m)
    setViewYear(y)
  }

  const monthLabel = new Date(viewYear, viewMonth).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })

  // Tournament CRUD
  const openCreateT = (prefillDate) => {
    setEditingT(null)
    setTForm({ name: '', description: '', date: prefillDate || '', start_time: '09:00', end_time: '18:00', level: 'P250', category: 'hommes', max_teams: 16, judge_arbiter: '', status: 'draft', registration_deadline: '' })
    setTModalOpen(true)
  }
  const openEditT = (t) => {
    setEditingT(t)
    setTForm({
      name: t.name, description: t.description || '', date: t.date,
      start_time: t.start_time.slice(0, 5), end_time: t.end_time.slice(0, 5),
      level: t.level, category: t.category, max_teams: t.max_teams,
      judge_arbiter: t.judge_arbiter || '', status: t.status,
      registration_deadline: t.registration_deadline ? t.registration_deadline.slice(0, 16) : '',
    })
    setTModalOpen(true)
  }
  const handleSaveT = async () => {
    if (!tForm.name || !tForm.date) { toast.error('Nom et date requis'); return }
    setSavingT(true)
    try {
      const data = { ...tForm, max_teams: parseInt(tForm.max_teams), registration_deadline: tForm.registration_deadline || null }
      await saveTournament(editingT?.id, data)
      toast.success(editingT ? 'Tournoi mis à jour' : 'Tournoi créé')
      setTModalOpen(false); fetchAll()
    } catch (err) { toast.error(err.message) }
    finally { setSavingT(false) }
  }
  const handleDeleteT = (t) => {
    askConfirm({
      title: `Supprimer "${t.name}" ?`,
      confirmLabel: 'Supprimer',
      onConfirm: async () => {
        try { await deleteTournament(t.id); toast.success('Supprimé'); fetchAll() }
        catch (err) { toast.error(err.message) }
      },
    })
  }

  // Event CRUD
  const openCreateE = (prefillDate) => {
    setEditingE(null)
    setEForm({ name: '', description: '', date: prefillDate || '', start_time: '', end_time: '', is_public: true })
    setEModalOpen(true)
  }
  const openEditE = (e) => {
    setEditingE(e)
    setEForm({ name: e.name, description: e.description || '', date: e.date, start_time: e.start_time?.slice(0, 5) || '', end_time: e.end_time?.slice(0, 5) || '', is_public: e.is_public })
    setEModalOpen(true)
  }
  const handleSaveE = async () => {
    if (!eForm.name || !eForm.date) { toast.error('Nom et date requis'); return }
    setSavingE(true)
    try {
      const data = { name: eForm.name, description: eForm.description || null, date: eForm.date, start_time: eForm.start_time || null, end_time: eForm.end_time || null, is_public: eForm.is_public }
      await saveEvent(editingE?.id, data)
      toast.success(editingE ? 'Événement mis à jour' : 'Événement créé')
      setEModalOpen(false); fetchAll()
    } catch (err) { toast.error(err.message) }
    finally { setSavingE(false) }
  }
  const handleDeleteE = (e) => {
    askConfirm({
      title: `Supprimer "${e.name}" ?`,
      confirmLabel: 'Supprimer',
      onConfirm: async () => {
        try { await deleteEvent(e.id); toast.success('Supprimé'); fetchAll() }
        catch (err) { toast.error(err.message) }
      },
    })
  }

  // Registrations
  const viewRegistrations = async (t) => {
    setSelTournament(t)
    const data = await fetchRegistrations(t.id)
    setRegistrations(data)
    setRegOpen(true)
  }
  const handleValidate = async (regId) => {
    if (!selTournament) return
    setActionLoading(regId)
    try {
      const result = await adminValidateRegistration(regId, selTournament.id, selTournament.max_teams)
      toast.success(result.status === 'waitlist' ? `File d'attente (#${result.position})` : 'Validée')
      viewRegistrations(selTournament)
    } catch (err) { toast.error(err.message) }
    finally { setActionLoading(null) }
  }
  const handleReject = async (regId) => {
    setActionLoading(regId)
    try { await adminRejectRegistration(regId); toast.success('Refusée'); viewRegistrations(selTournament) }
    catch (err) { toast.error(err.message) }
    finally { setActionLoading(null) }
  }
  const handleCancelAndPromote = (regId) => {
    if (!selTournament) return
    askConfirm({
      title: 'Annuler cette inscription ?',
      message: 'Le premier en file d\'attente sera promu.',
      confirmLabel: 'Annuler l\'inscription',
      onConfirm: async () => {
        setActionLoading(regId)
        try {
          const promoted = await cancelRegistrationAndPromote(regId, selTournament.id)
          toast.success(promoted ? `Annulée. ${promoted.player1_name} & ${promoted.player2_name} promus !` : 'Annulée')
          viewRegistrations(selTournament)
        } catch (err) { toast.error(err.message) }
        finally { setActionLoading(null) }
      },
    })
  }

  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  return (
    <PageWrapper wide>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            <h1 className="text-2xl font-bold text-text">Calendrier</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={() => openCreateE()}>
              <Plus className="w-4 h-4 mr-1" />Événement
            </Button>
            <Button size="sm" onClick={() => openCreateT()}>
              <Plus className="w-4 h-4 mr-1" />Tournoi
            </Button>
          </div>
        </div>

        {/* Month navigation */}
        <div className="flex items-center justify-between">
          <button onClick={() => changeMonth(-1)} className="p-2 rounded-[10px] hover:bg-bg cursor-pointer">
            <ChevronLeft className="w-5 h-5 text-text-secondary" />
          </button>
          <h2 className="text-lg font-semibold text-text capitalize">{monthLabel}</h2>
          <button onClick={() => changeMonth(1)} className="p-2 rounded-[10px] hover:bg-bg cursor-pointer">
            <ChevronRight className="w-5 h-5 text-text-secondary" />
          </button>
        </div>

        <CalendarGrid
          monthCells={monthCells} viewYear={viewYear} viewMonth={viewMonth} todayStr={todayStr}
          tournaments={tournaments} events={events} regCounts={regCounts}
          onEditTournament={openEditT} onDeleteTournament={handleDeleteT} onViewRegistrations={viewRegistrations}
          onEditEvent={openEditE} onDeleteEvent={handleDeleteE}
        />
      </div>

      <CalendarTournamentModal
        isOpen={tModalOpen} onClose={() => setTModalOpen(false)}
        form={tForm} setForm={setTForm} editing={editingT} saving={savingT} onSave={handleSaveT}
      />
      <CalendarEventModal
        isOpen={eModalOpen} onClose={() => setEModalOpen(false)}
        form={eForm} setForm={setEForm} editing={editingE} saving={savingE} onSave={handleSaveE}
      />
      <CalendarRegistrationModal
        isOpen={regOpen} onClose={() => setRegOpen(false)}
        tournament={selTournament} registrations={registrations}
        onValidate={handleValidate} onReject={handleReject}
        onCancelAndPromote={handleCancelAndPromote} actionLoading={actionLoading}
      />
      <ConfirmModal {...confirmProps} />
    </PageWrapper>
  )
}
