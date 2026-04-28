import { formatTime } from '@/utils/formatDate'
import PageWrapper from '@/components/layout/PageWrapper'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import ConfirmModal from '@/components/ui/ConfirmModal'
import ExportButtons from '@/components/ui/ExportButtons'
import { exportExcel, exportPDF } from '@/utils/export'
import {
  Pencil, Users, Clock, Check, X,
  ArrowUp, Award, ArrowLeft
} from 'lucide-react'

const STATUS_COLORS = { draft: 'gray', open: 'success', full: 'warning', closed: 'primary', cancelled: 'danger', completed: 'lime' }
const STATUS_LABELS = { draft: 'Brouillon', open: 'Ouvert', full: 'Complet', closed: 'Fermé', cancelled: 'Annulé', completed: 'Terminé' }
const CAT_LABELS = { hommes: 'Hommes', femmes: 'Femmes', mixte: 'Mixte' }
const REG_LABELS = {
  pending_partner: 'Attente partenaire', pending_admin: 'Attente validation',
  approved: 'Valid\u00e9e', waitlist: 'File d\'attente', confirmed: 'Confirm\u00e9e', cancelled: 'Annul\u00e9e'
}
const REG_COLORS = {
  pending_partner: 'warning', pending_admin: 'warning', approved: 'success',
  waitlist: 'gray', confirmed: 'primary', cancelled: 'danger'
}

export default function TournamentDetailView({
  tournament, regCounts, registrations,
  onBack, onEdit,
  onValidate, onReject, onCancelAndPromote,
  actionLoading,
  modalOpen, onCloseModal, modalContent,
  confirmProps,
}) {
  const t = tournament
  const count = regCounts[t.id] || 0
  const spotsLeft = t.max_teams - count

  const sortedRegs = [...registrations].sort((a, b) => {
    const order = { confirmed: 0, approved: 1, pending_admin: 2, pending_partner: 3, waitlist: 4, cancelled: 5 }
    const diff = (order[a.status] ?? 9) - (order[b.status] ?? 9)
    if (diff !== 0) return diff
    if (a.status === 'waitlist' && b.status === 'waitlist') return (a.position || 0) - (b.position || 0)
    return new Date(a.created_at) - new Date(b.created_at)
  })
  const activeRegs = sortedRegs.filter((r) => r.status !== 'cancelled')
  const cancelledRegs = sortedRegs.filter((r) => r.status === 'cancelled')

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

  return (
    <PageWrapper wide>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
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
          <Button size="sm" variant="outline" onClick={(e) => onEdit(e, t)}>
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
            <p className="text-sm font-bold text-text mt-0.5">{t.judge_arbiter || '\u2014'}</p>
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
            onPDF={() => exportPDF(regExportRows, regExportCols, `inscriptions_${t.name}`, `Inscriptions \u2014 ${t.name}`)}
          />
        </div>

        {activeRegs.length === 0 ? (
          <Card className="text-center !py-8">
            <Users className="w-8 h-8 text-text-tertiary mx-auto mb-2" />
            <p className="text-sm text-text-tertiary">Aucune inscription</p>
          </Card>
        ) : (
          <div className="divide-y divide-separator border border-separator rounded-[12px] bg-white overflow-hidden">
            {activeRegs.map((reg, i) => (
              <div key={reg.id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-bg/50 transition-colors">
                <span className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                  {reg.status === 'waitlist' ? `W${reg.position}` : i + 1}
                </span>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-text truncate">{reg.player1_name} & {reg.player2_name}</p>
                  <div className="flex items-center gap-2 text-[11px] text-text-tertiary truncate">
                    <span className="flex items-center gap-0.5"><Award className="w-3 h-3" />{reg.player1_license}</span>
                    <span>/</span>
                    <span className="flex items-center gap-0.5"><Award className="w-3 h-3" />{reg.player2_license}</span>
                    {reg.player2_is_external && <span className="text-text-secondary">{'\u00B7'} Externe</span>}
                    {reg.status === 'approved' && (
                      <>
                        <span>{'\u00B7'}</span>
                        <span className={reg.player1_confirmed ? 'text-success' : 'text-text-tertiary'}>
                          {reg.player1_confirmed ? '\u2713' : '\u25CB'} {reg.player1_name.split(' ')[0]}
                        </span>
                        <span className={reg.player2_confirmed ? 'text-success' : 'text-text-tertiary'}>
                          {reg.player2_confirmed ? '\u2713' : '\u25CB'} {reg.player2_name.split(' ')[0]}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <Badge color={REG_COLORS[reg.status]}>{REG_LABELS[reg.status]}</Badge>

                <div className="flex items-center gap-1 shrink-0">
                  {reg.status === 'pending_admin' && (
                    <>
                      <Button size="sm" loading={actionLoading === reg.id} onClick={() => onValidate(reg.id)}>
                        <Check className="w-3.5 h-3.5 mr-1" />Valider
                      </Button>
                      <Button size="sm" variant="ghost" className="!text-danger" loading={actionLoading === reg.id} onClick={() => onReject(reg.id)}>
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </>
                  )}
                  {reg.status === 'waitlist' && (
                    <>
                      <Button size="sm" variant="ghost" loading={actionLoading === reg.id} onClick={() => onValidate(reg.id)}>
                        <ArrowUp className="w-3.5 h-3.5 mr-1" />Promouvoir
                      </Button>
                      <Button size="sm" variant="ghost" className="!text-danger" loading={actionLoading === reg.id} onClick={() => onCancelAndPromote(reg.id)}>
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </>
                  )}
                  {['approved', 'confirmed'].includes(reg.status) && (
                    <Button size="sm" variant="ghost" className="!text-danger" loading={actionLoading === reg.id} onClick={() => onCancelAndPromote(reg.id)}>
                      <X className="w-3.5 h-3.5 mr-1" />Annuler
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Cancelled */}
        {cancelledRegs.length > 0 && (
          <details className="text-xs">
            <summary className="cursor-pointer text-text-tertiary font-medium">
              {cancelledRegs.length} inscription{cancelledRegs.length > 1 ? 's' : ''} {'annul\u00e9e'}{cancelledRegs.length > 1 ? 's' : ''}
            </summary>
            <div className="mt-2 space-y-1">
              {cancelledRegs.map((reg) => (
                <div key={reg.id} className="flex items-center justify-between py-2 px-3 rounded-[12px] bg-bg opacity-60">
                  <span className="text-text-secondary">{reg.player1_name} & {reg.player2_name}</span>
                  <Badge color="danger">{'Annul\u00e9e'}</Badge>
                </div>
              ))}
            </div>
          </details>
        )}
      </div>

      {/* Edit modal (from detail) */}
      <Modal isOpen={modalOpen} onClose={onCloseModal} title="Modifier tournoi">
        {modalContent}
      </Modal>
      <ConfirmModal {...confirmProps} />
    </PageWrapper>
  )
}
