import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import {
  UserPlus, X, Check, Wallet, CreditCard, Banknote
} from 'lucide-react'

export default function DashboardInvitations({
  invitations, loading, respondingTo, setRespondingTo,
  submitting, total, onAccept, onDecline,
  formatTime, formatDateFull, dayNum, monthTiny,
}) {
  if (loading || invitations.length === 0) return null

  return (
    <>
      <Card className="!border-l-4 !border-l-warning">
        <div className="flex items-center gap-2 mb-3">
          <UserPlus className="w-4 h-4 text-warning" />
          <h3 className="font-semibold text-text text-sm">
            Invitations ({invitations.length})
          </h3>
        </div>
        <div className="space-y-2.5">
          {invitations.map((inv) => {
            const courtLabel = `Terrain ${inv.booking?.court_id?.replace('terrain_', '') || '?'}`
            return (
              <div key={inv.id} className="rounded-[12px] bg-bg p-3">
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-[10px] bg-primary/10 flex flex-col items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-primary leading-none">
                      {inv.booking?.date ? dayNum(inv.booking.date + 'T00:00') : '?'}
                    </span>
                    <span className="text-[9px] text-primary/70 uppercase">
                      {inv.booking?.date ? monthTiny(inv.booking.date + 'T00:00') : ''}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text">{courtLabel}</p>
                    <p className="text-xs text-text-secondary">
                      {formatTime(inv.booking?.start_time)} – {formatTime(inv.booking?.end_time)}
                    </p>
                    <p className="text-xs text-text-tertiary mt-0.5">
                      Invité par {inv.booking?.user_name}
                    </p>
                  </div>
                  <p className="text-sm font-bold text-primary shrink-0">
                    {parseFloat(inv.amount).toFixed(2)}€
                  </p>
                </div>
                <div className="flex gap-2 mt-3 pt-2.5 border-t border-separator/50">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="flex-1 !text-danger !border-danger/20"
                    onClick={() => onDecline(inv)}
                    loading={submitting}
                  >
                    <X className="w-3.5 h-3.5 mr-1" />Refuser
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1"
                    onClick={() => setRespondingTo(inv)}
                  >
                    <Check className="w-3.5 h-3.5 mr-1" />Accepter
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      </Card>

      {/* Modal choix de paiement */}
      <Modal
        isOpen={!!respondingTo}
        onClose={() => setRespondingTo(null)}
        title="Choisir mon mode de paiement"
      >
        {respondingTo && (
          <div className="space-y-4">
            <div className="rounded-[12px] bg-bg p-4 text-center">
              <p className="text-xs text-text-secondary mb-1">Ma part</p>
              <p className="text-2xl font-bold text-primary">
                {parseFloat(respondingTo.amount).toFixed(2)}€
              </p>
              <p className="text-xs text-text-tertiary mt-1">
                {respondingTo.booking?.date && formatDateFull(respondingTo.booking.date + 'T00:00')}
                {' · '}
                {formatTime(respondingTo.booking?.start_time)} – {formatTime(respondingTo.booking?.end_time)}
              </p>
            </div>

            <div className="space-y-2">
              <Button
                className="w-full"
                onClick={() => onAccept(respondingTo, 'balance')}
                loading={submitting}
              >
                <Wallet className="w-4 h-4 mr-2" />
                Payer avec mon solde ({total.toFixed(2)}€)
              </Button>
              <Button
                variant="ghost"
                className="w-full"
                onClick={() => onAccept(respondingTo, 'cb')}
                loading={submitting}
              >
                <CreditCard className="w-4 h-4 mr-2" />
                Carte bancaire (sur place)
              </Button>
              <Button
                variant="ghost"
                className="w-full"
                onClick={() => onAccept(respondingTo, 'cash')}
                loading={submitting}
              >
                <Banknote className="w-4 h-4 mr-2" />
                Espèces (sur place)
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}
