import { useEffect, useState, useMemo } from 'react'
import useConfirm from '@/hooks/useConfirm'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { supabase } from '@/lib/supabase'
import {
  adminValidateRegistration, adminRejectRegistration, cancelRegistrationAndPromote
} from '@/services/tournamentService'
import { formatTime } from '@/utils/formatDate'
import PageWrapper from '@/components/layout/PageWrapper'
import Card from '@/components/ui/Card'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import toast from 'react-hot-toast'
import {
  Calendar, ChevronLeft, ChevronRight, Plus, Pencil, Trash2,
  Trophy, Star, Users, Clock, Check, X, ArrowUp, Award
} from 'lucide-react'

const STATUS_COLORS = { draft: 'gray', open: 'success', full: 'warning', closed: 'primary', cancelled: 'danger', completed: 'lime' }
const STATUS_LABELS = { draft: 'Brouillon', open: 'Ouvert', full: 'Complet', closed: 'Fermé', cancelled: 'Annulé', completed: 'Terminé' }
const LEVELS = ['P25', 'P50', 'P100', 'P250', 'P500', 'P1000', 'P2000']
const CATEGORIES = ['hommes', 'femmes', 'mixte']
const T_STATUSES = ['draft', 'open', 'full', 'closed', 'cancelled', 'completed']
const REG_LABELS = {
  pending_partner: 'Attente partenaire', pending_admin: 'Attente validation',
  approved: 'Validée', waitlist: 'File d\'attente', confirmed: 'Confirmée', cancelled: 'Annulée'
}
const REG_COLORS = {
  pending_partner: 'warning', pending_admin: 'warning', approved: 'success',
  waitlist: 'gray', confirmed: 'primary', cancelled: 'danger'
}

const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

function getMonthDays(year, month) {
  const firstDay = new Date(year, month, 1)
  // Monday-based: 0=Mon..6=Sun
  let startDow = (firstDay.getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells = []
  // Fill leading blanks
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
    const [tRes, eRes] = await Promise.all([
      supabase.from('tournaments').select('*').order('date'),
      supabase.from('events').select('*').order('date'),
    ])
    const tourneys = tRes.data || []
    setTournaments(tourneys)
    setEvents(eRes.data || [])
    // Reg counts
    const counts = {}
    await Promise.all(tourneys.map(async (t) => {
      const { count } = await supabase
        .from('tournament_registrations')
        .select('id', { count: 'exact', head: true })
        .eq('tournament_id', t.id)
        .not('status', 'eq', 'cancelled')
      counts[t.id] = count || 0
    }))
    setRegCounts(counts)
    setLoading(false)
  }

  useEffect(() => { fetchAll() }, [])

  const monthCells = useMemo(() => getMonthDays(viewYear, viewMonth), [viewYear, viewMonth])

  const getItemsForDay = (day) => {
    if (!day) return { t: [], e: [] }
    const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return {
      t: tournaments.filter((x) => x.date === dateStr),
      e: events.filter((x) => x.date === dateStr),
    }
  }

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
      if (editingT) {
        const { error } = await supabase.from('tournaments').update(data).eq('id', editingT.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('tournaments').insert(data)
        if (error) throw error
      }
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
        const { error } = await supabase.from('tournaments').delete().eq('id', t.id)
        if (error) toast.error(error.message); else { toast.success('Supprimé'); fetchAll() }
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
      if (editingE) {
        const { error } = await supabase.from('events').update(data).eq('id', editingE.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('events').insert(data)
        if (error) throw error
      }
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
        const { error } = await supabase.from('events').delete().eq('id', e.id)
        if (error) toast.error(error.message); else { toast.success('Supprimé'); fetchAll() }
      },
    })
  }

  // Registrations
  const viewRegistrations = async (t) => {
    setSelTournament(t)
    const { data } = await supabase.from('tournament_registrations').select('*').eq('tournament_id', t.id).order('created_at')
    setRegistrations(data || [])
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

  const sortedRegs = [...registrations].sort((a, b) => {
    const order = { confirmed: 0, approved: 1, pending_admin: 2, pending_partner: 3, waitlist: 4, cancelled: 5 }
    return (order[a.status] ?? 9) - (order[b.status] ?? 9) || new Date(a.created_at) - new Date(b.created_at)
  })
  const activeRegs = sortedRegs.filter((r) => r.status !== 'cancelled')

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

        {/* Calendar grid */}
        <Card className="!p-0 overflow-hidden">
          {/* Day headers */}
          <div className="grid grid-cols-7 border-b border-separator bg-bg/50">
            {DAYS.map((d) => (
              <div key={d} className="p-2 text-center text-xs font-semibold text-text-secondary uppercase">{d}</div>
            ))}
          </div>

          {/* Date cells */}
          <div className="grid grid-cols-7">
            {monthCells.map((day, idx) => {
              const items = getItemsForDay(day)
              const dateStr = day ? `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}` : ''
              const isTodayCell = dateStr === todayStr

              return (
                <div
                  key={idx}
                  className={`min-h-[80px] lg:min-h-[100px] border-b border-r border-separator p-1.5 ${
                    !day ? 'bg-bg/30' : isTodayCell ? 'bg-primary/5' : ''
                  }`}
                >
                  {day && (
                    <>
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-xs font-medium ${isTodayCell ? 'text-primary font-bold' : 'text-text-secondary'}`}>
                          {day}
                        </span>
                      </div>
                      <div className="space-y-0.5">
                        {items.t.map((t) => (
                          <button
                            key={t.id}
                            onClick={() => openEditT(t)}
                            className="w-full text-left px-1.5 py-1 rounded-md bg-primary/10 hover:bg-primary/20 transition-colors cursor-pointer truncate"
                          >
                            <div className="flex items-center gap-1">
                              <Trophy className="w-3 h-3 text-primary shrink-0" />
                              <span className="text-[10px] font-medium text-primary truncate">{t.name}</span>
                            </div>
                            <div className="flex items-center gap-1 mt-0.5">
                              <Badge color={STATUS_COLORS[t.status]} className="!text-[8px] !px-1 !py-0">{STATUS_LABELS[t.status]}</Badge>
                              <span className="text-[9px] text-text-tertiary">{regCounts[t.id] || 0}/{t.max_teams}</span>
                              <button
                                onClick={(ev) => { ev.stopPropagation(); viewRegistrations(t) }}
                                className="ml-auto p-0.5 hover:bg-primary/10 rounded cursor-pointer"
                              >
                                <Users className="w-3 h-3 text-text-secondary" />
                              </button>
                              <button
                                onClick={(ev) => { ev.stopPropagation(); handleDeleteT(t) }}
                                className="p-0.5 hover:bg-danger/10 rounded cursor-pointer"
                              >
                                <Trash2 className="w-3 h-3 text-danger" />
                              </button>
                            </div>
                          </button>
                        ))}
                        {items.e.map((e) => (
                          <button
                            key={e.id}
                            onClick={() => openEditE(e)}
                            className="w-full text-left px-1.5 py-1 rounded-md bg-lime/20 hover:bg-lime/30 transition-colors cursor-pointer truncate"
                          >
                            <div className="flex items-center gap-1">
                              <Star className="w-3 h-3 text-lime-dark shrink-0" />
                              <span className="text-[10px] font-medium text-text truncate">{e.name}</span>
                              <button
                                onClick={(ev) => { ev.stopPropagation(); handleDeleteE(e) }}
                                className="ml-auto p-0.5 hover:bg-danger/10 rounded cursor-pointer shrink-0"
                              >
                                <Trash2 className="w-3 h-3 text-danger" />
                              </button>
                            </div>
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </Card>

        {/* Legend */}
        <div className="flex items-center gap-4 px-1">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-primary/10 border border-primary/20" />
            <span className="text-xs text-text-secondary">Tournoi</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-lime/20 border border-lime/40" />
            <span className="text-xs text-text-secondary">Événement</span>
          </div>
        </div>
      </div>

      {/* Tournament modal */}
      <Modal isOpen={tModalOpen} onClose={() => setTModalOpen(false)} title={editingT ? 'Modifier tournoi' : 'Nouveau tournoi'}>
        <div className="space-y-3 max-h-[65vh] overflow-y-auto">
          <Input label="Nom" value={tForm.name} onChange={(e) => setTForm({ ...tForm, name: e.target.value })} />
          <Input label="Description" value={tForm.description} onChange={(e) => setTForm({ ...tForm, description: e.target.value })} />
          <Input label="Date" type="date" value={tForm.date} onChange={(e) => setTForm({ ...tForm, date: e.target.value })} />
          <div className="grid grid-cols-2 gap-2">
            <Input label="Début" type="time" value={tForm.start_time} onChange={(e) => setTForm({ ...tForm, start_time: e.target.value })} />
            <Input label="Fin" type="time" value={tForm.end_time} onChange={(e) => setTForm({ ...tForm, end_time: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-sm font-medium text-text mb-1.5">Niveau</label>
              <select value={tForm.level} onChange={(e) => setTForm({ ...tForm, level: e.target.value })}
                className="w-full px-3 py-3 rounded-[12px] bg-white border border-separator text-sm">
                {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-text mb-1.5">Catégorie</label>
              <select value={tForm.category} onChange={(e) => setTForm({ ...tForm, category: e.target.value })}
                className="w-full px-3 py-3 rounded-[12px] bg-white border border-separator text-sm capitalize">
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <Input label="Max équipes" type="number" min="2" value={tForm.max_teams} onChange={(e) => setTForm({ ...tForm, max_teams: e.target.value })} />
          <Input label="Juge-Arbitre" value={tForm.judge_arbiter} onChange={(e) => setTForm({ ...tForm, judge_arbiter: e.target.value })} placeholder="Nom du JA" />
          <Input label="Deadline inscriptions" type="datetime-local" value={tForm.registration_deadline} onChange={(e) => setTForm({ ...tForm, registration_deadline: e.target.value })} />
          {editingT && (
            <div>
              <label className="block text-sm font-medium text-text mb-1.5">Statut</label>
              <select value={tForm.status} onChange={(e) => setTForm({ ...tForm, status: e.target.value })}
                className="w-full px-3 py-3 rounded-[12px] bg-white border border-separator text-sm">
                {T_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
              </select>
            </div>
          )}
          <Button className="w-full" loading={savingT} onClick={handleSaveT}>{editingT ? 'Enregistrer' : 'Créer'}</Button>
        </div>
      </Modal>

      {/* Event modal */}
      <Modal isOpen={eModalOpen} onClose={() => setEModalOpen(false)} title={editingE ? 'Modifier événement' : 'Nouvel événement'}>
        <div className="space-y-4">
          <Input label="Nom" value={eForm.name} onChange={(e) => setEForm({ ...eForm, name: e.target.value })} />
          <Input label="Description" value={eForm.description} onChange={(e) => setEForm({ ...eForm, description: e.target.value })} />
          <Input label="Date" type="date" value={eForm.date} onChange={(e) => setEForm({ ...eForm, date: e.target.value })} />
          <div className="grid grid-cols-2 gap-2">
            <Input label="Début" type="time" value={eForm.start_time} onChange={(e) => setEForm({ ...eForm, start_time: e.target.value })} />
            <Input label="Fin" type="time" value={eForm.end_time} onChange={(e) => setEForm({ ...eForm, end_time: e.target.value })} />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={eForm.is_public} onChange={(e) => setEForm({ ...eForm, is_public: e.target.checked })} className="w-4 h-4 rounded text-primary" />
            <span className="text-sm font-medium text-text">Visible publiquement</span>
          </label>
          <Button className="w-full" loading={savingE} onClick={handleSaveE}>{editingE ? 'Enregistrer' : 'Créer'}</Button>
        </div>
      </Modal>

      <ConfirmModal {...confirmProps} />

      {/* Registrations modal */}
      <Modal isOpen={regOpen} onClose={() => setRegOpen(false)} title={`Inscriptions — ${selTournament?.name || ''}`} className="!max-w-lg">
        {selTournament && (
          <div className="space-y-4">
            <div className="flex items-center justify-between py-2 px-3 rounded-[10px] bg-bg">
              <span className="text-xs text-text-secondary">{activeRegs.length} / {selTournament.max_teams} paires</span>
            </div>
            <div className="space-y-2 max-h-[50vh] overflow-y-auto">
              {activeRegs.length === 0 ? (
                <p className="text-sm text-text-tertiary text-center py-6">Aucune inscription</p>
              ) : activeRegs.map((reg, i) => (
                <div key={reg.id} className="p-3 rounded-[12px] bg-bg space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2">
                      <span className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary shrink-0 mt-0.5">
                        {reg.status === 'waitlist' ? `W${reg.position}` : i + 1}
                      </span>
                      <div>
                        <p className="text-sm font-semibold">{reg.player1_name} & {reg.player2_name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-text-tertiary flex items-center gap-0.5"><Award className="w-3 h-3" />{reg.player1_license}</span>
                          <span className="text-[10px] text-text-tertiary">/</span>
                          <span className="text-[10px] text-text-tertiary flex items-center gap-0.5"><Award className="w-3 h-3" />{reg.player2_license}</span>
                        </div>
                      </div>
                    </div>
                    <Badge color={REG_COLORS[reg.status]}>{REG_LABELS[reg.status]}</Badge>
                  </div>
                  {reg.status === 'pending_admin' && (
                    <div className="flex gap-2">
                      <Button size="sm" className="flex-1" loading={actionLoading === reg.id} onClick={() => handleValidate(reg.id)}>
                        <Check className="w-3.5 h-3.5 mr-1" />Valider
                      </Button>
                      <Button size="sm" variant="danger" className="flex-1" loading={actionLoading === reg.id} onClick={() => handleReject(reg.id)}>
                        <X className="w-3.5 h-3.5 mr-1" />Refuser
                      </Button>
                    </div>
                  )}
                  {reg.status === 'waitlist' && (
                    <div className="flex gap-2">
                      <Button size="sm" variant="ghost" className="flex-1" loading={actionLoading === reg.id} onClick={() => handleValidate(reg.id)}>
                        <ArrowUp className="w-3.5 h-3.5 mr-1" />Promouvoir
                      </Button>
                      <Button size="sm" variant="ghost" className="flex-1 !text-danger" loading={actionLoading === reg.id} onClick={() => handleCancelAndPromote(reg.id)}>Annuler</Button>
                    </div>
                  )}
                  {['approved', 'confirmed'].includes(reg.status) && (
                    <Button size="sm" variant="ghost" className="w-full !text-danger" loading={actionLoading === reg.id} onClick={() => handleCancelAndPromote(reg.id)}>
                      Annuler + promouvoir waitlist
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>
    </PageWrapper>
  )
}
