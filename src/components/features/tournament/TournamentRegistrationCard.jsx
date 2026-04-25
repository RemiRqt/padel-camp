import { memo } from 'react'
import { Link } from 'react-router-dom'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import { formatDateShort, formatTime } from '@/utils/formatDate'
import { Users, Clock, Check, AlertCircle } from 'lucide-react'

const REG_STATUS_LABELS = {
  pending_partner: 'En attente partenaire',
  pending_admin: 'En attente validation',
  approved: 'Validée — confirmation requise',
  waitlist: 'File d\'attente',
  confirmed: 'Confirmée',
  cancelled: 'Annulée',
}
const REG_STATUS_COLORS = {
  pending_partner: 'warning', pending_admin: 'warning', approved: 'success',
  waitlist: 'gray', confirmed: 'primary', cancelled: 'danger',
}

function TournamentRegistrationCard({
  reg, userId, actionLoading, onConfirm, onCancel,
}) {
  const isPlayer1 = reg.player1_uid === userId
  const isPlayer2 = reg.player2_uid === userId
  const myPlayerNumber = isPlayer1 ? 1 : 2
  const myConfirmed = isPlayer1 ? reg.player1_confirmed : reg.player2_confirmed
  const t = reg.tournament

  const isConfirmationWindow = (() => {
    if (!t?.confirmation_deadline) return false
    const deadline = new Date(t.confirmation_deadline)
    const now = new Date()
    return now >= deadline && reg.status === 'approved'
  })()

  const needsConfirmation = reg.status === 'approved' && !myConfirmed

  return (
    <Card>
      <div className="space-y-3">
        <div className="flex items-start justify-between">
          <Link to={`/tournaments/${reg.tournament_id}`} className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-text truncate hover:text-primary transition-colors">
              {t?.name}
            </h3>
            <p className="text-xs text-text-secondary mt-0.5">
              {t?.date && formatDateShort(t.date + 'T00:00')}
              {t?.start_time && ` · ${formatTime(t.start_time)}`}
              {' · '}{t?.level}
            </p>
          </Link>
          <Badge color={REG_STATUS_COLORS[reg.status]}>
            {REG_STATUS_LABELS[reg.status]}
          </Badge>
        </div>

        {/* Pair info */}
        <div className="flex items-center gap-2 py-2 px-3 rounded-[10px] bg-bg">
          <Users className="w-4 h-4 text-primary shrink-0" />
          <p className="text-sm">
            <span className="font-medium">{reg.player1_name}</span>
            <span className="text-text-tertiary"> & </span>
            <span className="font-medium">{reg.player2_name}</span>
            {reg.player2_is_external && <span className="text-xs text-text-tertiary"> (ext.)</span>}
          </p>
        </div>

        {/* Waitlist position */}
        {reg.status === 'waitlist' && reg.position && (
          <div className="flex items-center gap-2 text-xs text-text-secondary">
            <Clock className="w-3.5 h-3.5" />
            Position en file d'attente: <strong>#{reg.position}</strong>
          </div>
        )}

        {/* Confirmation status for approved */}
        {reg.status === 'approved' && (
          <div className="space-y-2">
            <div className="flex items-center gap-4 text-xs">
              <span className={`flex items-center gap-1 ${reg.player1_confirmed ? 'text-success' : 'text-text-tertiary'}`}>
                {reg.player1_confirmed ? <Check className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                {reg.player1_name}: {reg.player1_confirmed ? 'Confirmé' : 'En attente'}
              </span>
              <span className={`flex items-center gap-1 ${reg.player2_confirmed ? 'text-success' : 'text-text-tertiary'}`}>
                {reg.player2_confirmed ? <Check className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                {reg.player2_name}: {reg.player2_confirmed ? 'Confirmé' : 'En attente'}
              </span>
            </div>

            {needsConfirmation && isConfirmationWindow && (
              <Button
                size="sm"
                className="w-full"
                loading={actionLoading === reg.id}
                onClick={() => onConfirm(reg)}
              >
                <Check className="w-4 h-4 mr-1" />
                Confirmer ma participation
              </Button>
            )}

            {needsConfirmation && !isConfirmationWindow && (
              <div className="flex items-center gap-2 py-2 px-3 rounded-[10px] bg-warning/5 border border-warning/20">
                <AlertCircle className="w-4 h-4 text-warning shrink-0" />
                <p className="text-xs text-text-secondary">
                  La confirmation sera possible 48h avant le tournoi
                  {t?.confirmation_deadline && (
                    <> (à partir du {new Date(t.confirmation_deadline).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })})</>
                  )}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Confirmed status */}
        {reg.status === 'confirmed' && (
          <div className="flex items-center gap-2 py-2 px-3 rounded-[10px] bg-success/5 border border-success/20">
            <Check className="w-4 h-4 text-success shrink-0" />
            <p className="text-xs text-success font-medium">Inscription confirmée par les deux joueurs</p>
          </div>
        )}

        {/* Cancel button (only for non-confirmed, non-cancelled) */}
        {!['confirmed', 'cancelled'].includes(reg.status) && isPlayer1 && (
          <Button
            size="sm"
            variant="ghost"
            className="w-full !text-danger"
            loading={actionLoading === reg.id}
            onClick={() => onCancel(reg)}
          >
            Annuler mon inscription
          </Button>
        )}
      </div>
    </Card>
  )
}

export default memo(TournamentRegistrationCard)
