import { useEffect, useState } from 'react'
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
import ConfirmModal from '@/components/ui/ConfirmModal'
import useConfirm from '@/hooks/useConfirm'
import ExportButtons from '@/components/ui/ExportButtons'
import { exportExcel, exportPDF } from '@/utils/export'
import toast from 'react-hot-toast'
import {
  Trophy, Plus, Pencil, Trash2, Users, Clock, Check, X,
  ArrowUp, Award, ArrowLeft, ChevronRight
} from 'lucide-react'

const STATUS_COLORS = { draft: 'gray', open: 'success', full: 'warning', closed: 'primary', cancelled: 'danger', completed: 'lime' }
const STATUS_LABELS = { draft: 'Brouillon', open: 'Ouvert', full: 'Complet', closed: 'Fermé', cancelled: 'Annulé', completed: 'Terminé' }
const LEVELS = ['P25', 'P50', 'P100', 'P250', 'P500', 'P1000', 'P2000']
const CATEGORIES = ['hommes', 'femmes', 'mixte']
const CAT_LABELS = { hommes: 'Hommes', femmes: 'Femmes', mixte: 'Mixte' }
const STATUSES = ['draft', 'open', 'full', 'closed', 'cancelled', 'completed']
const REG_LABELS = {
  pending_partner: 'Attente partenaire', pending_admin: 'Attente validation',
  approved: 'Validée', waitlist: 'File d\'attente', confirmed: 'Confirmée', cancelled: 'Annulée'
}
const REG_COLORS = {
  pending_partner: 'warning', pending_admin: 'warning', approved: 'success',
  waitlist: 'gray', confirmed: 'primary', cancelled: 'danger'
}

export default function AdminTournaments() {
  const [tournaments, setTournaments] = useState([])
  const [regCounts, setRegCounts] = useState({})
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({
    name: '', description: '', date: '', start_time: '09:00', end_time: '18:00',
    level: 'P250', category: 'hommes', max_teams: 16, judge_arbiter: '', status: 'draft',
    registration_deadline: '',
  })
  const [saving, setSaving] = useState(false)
  const { askConfirm, confirmProps } = useConfirm()

  // Detail view
  const [selectedTournament, setSelectedTournament] = useState(null)
  const [registrations, setRegistrations] = useState([])
  const [actionLoading, setActionLoading] = useState(null)

  const fetchAll = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('tournaments')
      .select('*, tournament_registrations(id, status)')
      .order('date', { ascending: false })
    const tourneys = data || []
    const counts = {}
    tourneys.forEach((t) => {
      const regs = t.tournament_registrations || []
      counts[t.id] = regs.filter((r) => r.status !== 'cancelled').length
      delete t.tournament_registrations
    })
    setTournaments(tourneys)
    setRegCounts(counts)
    setLoading(false)
  }

  useEffect(() => { fetchAll() }, [])

  // --- CRUD ---
  const openCreate = () => {
    setEditing(null)
    setForm({ name: '', description: '', date: '', start_time: '09:00', end_time: '18:00', level: 'P250', category: 'hommes', max_teams: 16, judge_arbiter: '', status: 'draft', registration_deadline: '' })
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
    if (isNaN(maxTeams) || maxTeams < 2) { toast.error('Max équipes doit être ≥ 2'); return }
    setSaving(true)
    try {
      const data = { ...form, max_teams: maxTeams, registration_deadline: form.registration_deadline || null }
      if (editing) {
        const { error } = await supabase.from('tournaments').update(data).eq('id', editing.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('tournaments').insert(data)
        if (error) throw error
      }
      toast.success(editing ? 'Tournoi mis à jour' : 'Tournoi créé')
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
        const { error } = await supabase.from('tournaments').delete().eq('id', t.id)
        if (error) toast.error(error.message)
        else { toast.success('Supprimé'); fetchAll() }
      },
    })
  }

  // --- Detail view ---
  const openDetail = async (t) => {
    setSelectedTournament(t)
    const { data } = await supabase
      .from('tournament_registrations')
      .select('*')
      .eq('tournament_id', t.id)
      .order('created_at')
    setRegistrations(data || [])
  }

  const refreshRegistrations = async () => {
    if (!selectedTournament) return
    const { data } = await supabase
      .from('tournament_registrations')
      .select('*')
      .eq('tournament_id', selectedTournament.id)
      .order('created_at')
    const regs = data || []
    setRegistrations(regs)
    setRegCounts((prev) => ({ ...prev, [selectedTournament.id]: regs.filter((r) => r.status !== 'cancelled').length }))
  }

  const handleValidate = async (regId) => {
    if (!selectedTournament) return
    setActionLoading(regId)
    try {
      const result = await adminValidateRegistration(regId, selectedTournament.id, selectedTournament.max_teams)
      toast.success(result.status === 'waitlist' ? `File d'attente (position #${result.position})` : 'Inscription validée')
      refreshRegistrations()
    } catch (err) { toast.error(err.message) }
    finally { setActionLoading(null) }
  }

  const handleReject = async (regId) => {
    setActionLoading(regId)
    try {
      await adminRejectRegistration(regId)
      toast.success('Inscription refusée')
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
          toast.success(promoted ? `Annulée. ${promoted.player1_name} & ${promoted.player2_name} promus !` : 'Inscription annulée')
          refreshRegistrations()
        } catch (err) { toast.error(err.message) }
        finally { setActionLoading(null) }
      },
    })
  }

  // --- Sorted regs ---
  const sortedRegs = [...registrations].sort((a, b) => {
    const order = { confirmed: 0, approved: 1, pending_admin: 2, pending_partner: 3, waitlist: 4, cancelled: 5 }
    const diff = (order[a.status] ?? 9) - (order[b.status] ?? 9)
    if (diff !== 0) return diff
    if (a.status === 'waitlist' && b.status === 'waitlist') return (a.position || 0) - (b.position || 0)
    return new Date(a.created_at) - new Date(b.created_at)
  })
  const activeRegs = sortedRegs.filter((r) => r.status !== 'cancelled')
  const cancelledRegs = sortedRegs.filter((r) => r.status === 'cancelled')

  // --- Exports ---
  const exportCols = [
    { key: 'name', label: 'Tournoi' }, { key: 'date', label: 'Date' },
    { key: 'level', label: 'Niveau' }, { key: 'category', label: 'Catégorie' },
    { key: 'teams', label: 'Inscriptions' }, { key: 'max', label: 'Max' },
    { key: 'status', label: 'Statut' },
  ]
  const exportRows = tournaments.map((t) => ({
    name: t.name, date: new Date(t.date + 'T00:00').toLocaleDateString('fr-FR'),
    level: t.level, category: t.category, teams: regCounts[t.id] || 0,
    max: t.max_teams, status: STATUS_LABELS[t.status],
  }))

  const regExportCols = [
    { key: 'pos', label: '#' }, { key: 'player1', label: 'Joueur 1' },
    { key: 'license1', label: 'Licence 1' }, { key: 'player2', label: 'Joueur 2' },
    { key: 'license2', label: 'Licence 2' }, { key: 'external', label: 'Externe' },
    { key: 'status', label: 'Statut' }, { key: 'date', label: 'Inscrit le' },
  ]
  const regExportRows = activeRegs.map((r, i) => ({
    pos: r.status === 'waitlist' ? `W${r.position}` : i + 1,
    player1: r.player1_name, license1: r.player1_license,
    player2: r.player2_name, license2: r.player2_license,
    external: r.player2_is_external ? 'Oui' : 'Non',
    status: REG_LABELS[r.status], date: new Date(r.created_at).toLocaleDateString('fr-FR'),
  }))

  // =============================================
  // DETAIL VIEW
  // =============================================
  if (selectedTournament) {
    const t = selectedTournament
    const count = regCounts[t.id] || 0
    const spotsLeft = t.max_teams - count

    return (
      <PageWrapper wide>
        <div className="space-y-5">
          {/* Header */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSelectedTournament(null)}
              className="w-9 h-9 rounded-[10px] bg-bg flex items-center justify-center hover:bg-primary/5 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4.5 h-4.5 text-text-secondary" />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold text-text truncate">{t.name}</h1>
              <div className="flex flex-wrap items-center gap-1.5 mt-1">
                <Badge color="primary">{t.level}</Badge>
                <Badge color="lime">{CAT_LABELS[t.category]}</Badge>
                <Badge color={STATUS_COLORS[t.status]}>{STATUS_LABELS[t.status]}</Badge>
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={(e) => openEdit(e, t)}>
              <Pencil className="w-3.5 h-3.5 mr-1" />Modifier
            </Button>
          </div>

          {/* Info cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Card className="!p-3 text-center">
              <p className="text-[10px] text-text-tertiary uppercase font-medium">Date</p>
              <p className="text-sm font-bold text-text mt-0.5">
                {new Date(t.date + 'T00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
            </Card>
            <Card className="!p-3 text-center">
              <p className="text-[10px] text-text-tertiary uppercase font-medium">Horaires</p>
              <p className="text-sm font-bold text-text mt-0.5">{formatTime(t.start_time)} – {formatTime(t.end_time)}</p>
            </Card>
            <Card className="!p-3 text-center">
              <p className="text-[10px] text-text-tertiary uppercase font-medium">Paires</p>
              <p className="text-sm font-bold text-text mt-0.5">
                {count} / {t.max_teams}
                {spotsLeft > 0 && <span className="text-success ml-1 text-xs font-normal">({spotsLeft} dispo)</span>}
              </p>
            </Card>
            <Card className="!p-3 text-center">
              <p className="text-[10px] text-text-tertiary uppercase font-medium">Juge-Arbitre</p>
              <p className="text-sm font-bold text-text mt-0.5">{t.judge_arbiter || '—'}</p>
            </Card>
          </div>

          {t.confirmation_deadline && (
            <div className="flex items-center gap-2 text-xs text-text-secondary py-2.5 px-3 rounded-[12px] bg-warning/5">
              <Clock className="w-3.5 h-3.5 text-warning shrink-0" />
              Confirmation 48h avant : {new Date(t.confirmation_deadline).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </div>
          )}

          {/* Inscriptions */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              <h2 className="text-lg font-bold text-text">Inscriptions</h2>
              <Badge color="primary">{activeRegs.length}</Badge>
            </div>
            <ExportButtons
              onExcel={() => exportExcel(regExportRows, regExportCols, `inscriptions_${t.name}`)}
              onPDF={() => exportPDF(regExportRows, regExportCols, `inscriptions_${t.name}`, `Inscriptions — ${t.name}`)}
            />
          </div>

          {activeRegs.length === 0 ? (
            <Card className="text-center !py-8">
              <Users className="w-8 h-8 text-text-tertiary mx-auto mb-2" />
              <p className="text-sm text-text-tertiary">Aucune inscription</p>
            </Card>
          ) : (
            <div className="space-y-2">
              {activeRegs.map((reg, i) => (
                <Card key={reg.id} className="!p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <span className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0 mt-0.5">
                        {reg.status === 'waitlist' ? `W${reg.position}` : i + 1}
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-text">{reg.player1_name} & {reg.player2_name}</p>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          <span className="text-[11px] text-text-tertiary flex items-center gap-0.5">
                            <Award className="w-3 h-3" />{reg.player1_license}
                          </span>
                          <span className="text-[11px] text-text-tertiary">/</span>
                          <span className="text-[11px] text-text-tertiary flex items-center gap-0.5">
                            <Award className="w-3 h-3" />{reg.player2_license}
                          </span>
                          {reg.player2_is_external && <Badge color="gray">Externe</Badge>}
                        </div>
                        <p className="text-[10px] text-text-tertiary mt-1">
                          Inscrit le {new Date(reg.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </p>

                        {/* Confirmation status */}
                        {reg.status === 'approved' && (
                          <div className="flex gap-3 mt-1.5 text-[11px]">
                            <span className={reg.player1_confirmed ? 'text-success' : 'text-text-tertiary'}>
                              {reg.player1_confirmed ? '✓' : '○'} {reg.player1_name.split(' ')[0]}
                            </span>
                            <span className={reg.player2_confirmed ? 'text-success' : 'text-text-tertiary'}>
                              {reg.player2_confirmed ? '✓' : '○'} {reg.player2_name.split(' ')[0]}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    <Badge color={REG_COLORS[reg.status]}>{REG_LABELS[reg.status]}</Badge>
                  </div>

                  {/* Actions */}
                  {reg.status === 'pending_admin' && (
                    <div className="flex gap-2 mt-3">
                      <Button size="sm" className="flex-1" loading={actionLoading === reg.id} onClick={() => handleValidate(reg.id)}>
                        <Check className="w-3.5 h-3.5 mr-1" />Valider
                      </Button>
                      <Button size="sm" variant="danger" className="flex-1" loading={actionLoading === reg.id} onClick={() => handleReject(reg.id)}>
                        <X className="w-3.5 h-3.5 mr-1" />Refuser
                      </Button>
                    </div>
                  )}

                  {reg.status === 'waitlist' && (
                    <div className="flex gap-2 mt-3">
                      <Button size="sm" variant="ghost" className="flex-1" loading={actionLoading === reg.id} onClick={() => handleValidate(reg.id)}>
                        <ArrowUp className="w-3.5 h-3.5 mr-1" />Promouvoir
                      </Button>
                      <Button size="sm" variant="ghost" className="flex-1 !text-danger" loading={actionLoading === reg.id} onClick={() => handleCancelAndPromote(reg.id)}>
                        Annuler
                      </Button>
                    </div>
                  )}

                  {['approved', 'confirmed'].includes(reg.status) && (
                    <div className="mt-3">
                      <Button size="sm" variant="ghost" className="w-full !text-danger" loading={actionLoading === reg.id} onClick={() => handleCancelAndPromote(reg.id)}>
                        Annuler + promouvoir waitlist
                      </Button>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}

          {/* Cancelled */}
          {cancelledRegs.length > 0 && (
            <details className="text-xs">
              <summary className="cursor-pointer text-text-tertiary font-medium">
                {cancelledRegs.length} inscription{cancelledRegs.length > 1 ? 's' : ''} annulée{cancelledRegs.length > 1 ? 's' : ''}
              </summary>
              <div className="mt-2 space-y-1">
                {cancelledRegs.map((reg) => (
                  <div key={reg.id} className="flex items-center justify-between py-2 px-3 rounded-[12px] bg-bg opacity-60">
                    <span className="text-text-secondary">{reg.player1_name} & {reg.player2_name}</span>
                    <Badge color="danger">Annulée</Badge>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>

        {/* Edit modal (from detail) */}
        <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Modifier tournoi">
          <TournamentForm form={form} setForm={setForm} editing={editing} saving={saving} onSave={handleSave} />
        </Modal>
        <ConfirmModal {...confirmProps} />
      </PageWrapper>
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
              onPDF={() => exportPDF(exportRows, exportCols, 'tournois', 'Padel Camp — Tournois')}
            />
            <Button size="sm" onClick={openCreate}><Plus className="w-4 h-4 mr-1" />Créer</Button>
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
          <>
            {/* Desktop table */}
            <div className="hidden sm:block">
              <Card className="!p-0 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-separator bg-bg/50">
                      <th className="text-left px-4 py-3 text-[11px] font-semibold text-text-tertiary uppercase">Date</th>
                      <th className="text-left px-4 py-3 text-[11px] font-semibold text-text-tertiary uppercase">Nom</th>
                      <th className="text-left px-4 py-3 text-[11px] font-semibold text-text-tertiary uppercase">Niveau</th>
                      <th className="text-left px-4 py-3 text-[11px] font-semibold text-text-tertiary uppercase">Inscrits</th>
                      <th className="text-left px-4 py-3 text-[11px] font-semibold text-text-tertiary uppercase">JA</th>
                      <th className="text-left px-4 py-3 text-[11px] font-semibold text-text-tertiary uppercase">Statut</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {tournaments.map((t) => {
                      const count = regCounts[t.id] || 0
                      return (
                        <tr
                          key={t.id}
                          onClick={() => openDetail(t)}
                          className="border-b border-separator last:border-0 hover:bg-primary/[0.02] cursor-pointer transition-colors"
                        >
                          <td className="px-4 py-3 whitespace-nowrap text-text-secondary">
                            {new Date(t.date + 'T00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: '2-digit' })}
                          </td>
                          <td className="px-4 py-3 font-medium text-text">{t.name}</td>
                          <td className="px-4 py-3">
                            <Badge color="primary">{t.level}</Badge>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`font-semibold ${count >= t.max_teams ? 'text-warning' : 'text-text'}`}>
                              {count}/{t.max_teams}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-text-secondary">{t.judge_arbiter || '—'}</td>
                          <td className="px-4 py-3">
                            <Badge color={STATUS_COLORS[t.status]}>{STATUS_LABELS[t.status]}</Badge>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1 justify-end">
                              <button onClick={(e) => openEdit(e, t)} className="p-1.5 rounded-lg hover:bg-bg cursor-pointer">
                                <Pencil className="w-3.5 h-3.5 text-text-tertiary" />
                              </button>
                              <button onClick={(e) => handleDelete(e, t)} className="p-1.5 rounded-lg hover:bg-danger/10 cursor-pointer">
                                <Trash2 className="w-3.5 h-3.5 text-danger" />
                              </button>
                              <ChevronRight className="w-4 h-4 text-text-tertiary" />
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </Card>
            </div>

            {/* Mobile list */}
            <div className="sm:hidden space-y-2">
              {tournaments.map((t) => {
                const count = regCounts[t.id] || 0
                return (
                  <Card key={t.id} className="!p-3 cursor-pointer" onClick={() => openDetail(t)}>
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-[10px] bg-primary/10 flex flex-col items-center justify-center shrink-0">
                        <span className="text-xs font-bold text-primary leading-none">
                          {new Date(t.date + 'T00:00').getDate()}
                        </span>
                        <span className="text-[9px] text-primary/70 uppercase">
                          {new Date(t.date + 'T00:00').toLocaleDateString('fr-FR', { month: 'short' })}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-text truncate">{t.name}</p>
                        <div className="flex items-center gap-1.5 mt-1">
                          <Badge color="primary">{t.level}</Badge>
                          <span className="text-xs text-text-secondary font-medium">{count}/{t.max_teams}</span>
                          {t.judge_arbiter && (
                            <span className="text-xs text-text-tertiary">· {t.judge_arbiter}</span>
                          )}
                        </div>
                      </div>
                      <Badge color={STATUS_COLORS[t.status]}>{STATUS_LABELS[t.status]}</Badge>
                      <ChevronRight className="w-4 h-4 text-text-tertiary shrink-0" />
                    </div>
                  </Card>
                )
              })}
            </div>
          </>
        )}
      </div>

      {/* Create/Edit modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Modifier tournoi' : 'Nouveau tournoi'}>
        <TournamentForm form={form} setForm={setForm} editing={editing} saving={saving} onSave={handleSave} />
      </Modal>
      <ConfirmModal {...confirmProps} />
    </PageWrapper>
  )
}

function TournamentForm({ form, setForm, editing, saving, onSave }) {
  return (
    <div className="space-y-3 max-h-[65vh] overflow-y-auto">
      <Input label="Nom" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      <Input label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
      <Input label="Date" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
      <div className="grid grid-cols-2 gap-2">
        <Input label="Début" type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} />
        <Input label="Fin" type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-sm font-medium text-text mb-1.5">Niveau</label>
          <select value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })}
            className="w-full px-3 py-3 rounded-[12px] bg-white border border-separator text-sm">
            {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-text mb-1.5">Catégorie</label>
          <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
            className="w-full px-3 py-3 rounded-[12px] bg-white border border-separator text-sm capitalize">
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>
      <Input label="Max équipes" type="number" min="2" value={form.max_teams} onChange={(e) => setForm({ ...form, max_teams: e.target.value })} />
      <Input label="Juge-Arbitre" value={form.judge_arbiter} onChange={(e) => setForm({ ...form, judge_arbiter: e.target.value })} placeholder="Nom du JA" />
      <Input label="Deadline inscriptions" type="datetime-local" value={form.registration_deadline} onChange={(e) => setForm({ ...form, registration_deadline: e.target.value })} />
      {editing && (
        <div>
          <label className="block text-sm font-medium text-text mb-1.5">Statut</label>
          <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}
            className="w-full px-3 py-3 rounded-[12px] bg-white border border-separator text-sm">
            {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
          </select>
        </div>
      )}
      <Button className="w-full" loading={saving} onClick={onSave}>{editing ? 'Enregistrer' : 'Créer'}</Button>
    </div>
  )
}
