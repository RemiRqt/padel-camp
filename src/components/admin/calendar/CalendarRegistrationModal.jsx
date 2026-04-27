import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import { Check, X, ArrowUp, Award } from 'lucide-react'

const REG_LABELS = {
  pending_partner: 'Attente partenaire', pending_admin: 'Attente validation',
  approved: 'Validée', waitlist: 'File d\'attente', confirmed: 'Confirmée', cancelled: 'Annulée'
}
const REG_COLORS = {
  pending_partner: 'warning', pending_admin: 'warning', approved: 'success',
  waitlist: 'gray', confirmed: 'primary', cancelled: 'danger'
}

export default function CalendarRegistrationModal({
  isOpen, onClose, tournament, registrations,
  onValidate, onReject, onCancelAndPromote, actionLoading,
}) {
  const sortedRegs = [...registrations].sort((a, b) => {
    const order = { confirmed: 0, approved: 1, pending_admin: 2, pending_partner: 3, waitlist: 4, cancelled: 5 }
    return (order[a.status] ?? 9) - (order[b.status] ?? 9) || new Date(a.created_at) - new Date(b.created_at)
  })
  const activeRegs = sortedRegs.filter((r) => r.status !== 'cancelled')

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Inscriptions — ${tournament?.name || ''}`} className="!max-w-lg">
      {tournament && (
        <div className="space-y-4">
          <div className="flex items-center justify-between py-2 px-3 rounded-[10px] bg-bg">
            <span className="text-xs text-text-secondary">{activeRegs.length} / {tournament.max_teams} paires</span>
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
                    <Button size="sm" className="flex-1" loading={actionLoading === reg.id} onClick={() => onValidate(reg.id)}>
                      <Check className="w-3.5 h-3.5 mr-1" />Valider
                    </Button>
                    <Button size="sm" variant="danger" className="flex-1" loading={actionLoading === reg.id} onClick={() => onReject(reg.id)}>
                      <X className="w-3.5 h-3.5 mr-1" />Refuser
                    </Button>
                  </div>
                )}
                {reg.status === 'waitlist' && (
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" className="flex-1" loading={actionLoading === reg.id} onClick={() => onValidate(reg.id)}>
                      <ArrowUp className="w-3.5 h-3.5 mr-1" />Promouvoir
                    </Button>
                    <Button size="sm" variant="ghost" className="flex-1 !text-danger" loading={actionLoading === reg.id} onClick={() => onCancelAndPromote(reg.id)}>Annuler</Button>
                  </div>
                )}
                {['approved', 'confirmed'].includes(reg.status) && (
                  <Button size="sm" variant="ghost" className="w-full !text-danger" loading={actionLoading === reg.id} onClick={() => onCancelAndPromote(reg.id)}>
                    Annuler + promouvoir waitlist
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </Modal>
  )
}
