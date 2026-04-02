import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import { UserPlus, Wallet, CreditCard, Banknote } from 'lucide-react'

const PAY_BADGE = {
  paid: { color: 'success', label: 'Payé' },
  external: { color: 'primary', label: 'CB/Espèces' },
  pending: { color: 'warning', label: 'En attente' },
}

const INVITE_BADGE = {
  pending: { color: 'warning', label: 'Invitation envoyée' },
  accepted: { color: 'success', label: 'Acceptée' },
  declined: { color: 'danger', label: 'Refusée' },
}

export default function BookingPlayerCard({
  player, idx, userId, isOwner, isPaid, share, submitting,
  onPayBalance, onPayExternal, onClearSlot, onOpenAdd,
}) {
  const isPlayer1 = idx === 0
  const isEmpty = player.player_name === 'Place disponible'
  const badge = PAY_BADGE[player.payment_status] || PAY_BADGE.pending
  const isPending = player.payment_status === 'pending'
  const isMember = !!player.user_id
  const isMe = player.user_id === userId
  const inviteBadge = INVITE_BADGE[player.invitation_status] || null
  const isInvitePending = player.invitation_status === 'pending'

  // Empty slot
  if (isEmpty) {
    return (
      <div className="rounded-[12px] border-2 border-dashed border-separator p-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-bg flex items-center justify-center shrink-0">
            <span className="text-sm text-text-tertiary">{idx + 1}</span>
          </div>
          <div className="flex-1">
            <p className="text-sm text-text-tertiary">Place disponible</p>
            <p className="text-xs text-text-tertiary">{share.toFixed(2)}€</p>
          </div>
          {!isPaid && isOwner && (
            <Button
              variant="ghost" size="sm"
              onClick={() => onOpenAdd(player.id)}
            >
              <UserPlus className="w-4 h-4 mr-1" />Inviter
            </Button>
          )}
        </div>
      </div>
    )
  }

  // Filled slot
  return (
    <div className="rounded-[12px] bg-bg p-3">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <span className="text-sm font-bold text-primary">
            {player.player_name.charAt(0).toUpperCase()}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-medium text-text truncate">{player.player_name}</p>
            {isPlayer1 && <span className="text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium">Réservant</span>}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            <Badge color={isMember ? 'primary' : 'gray'}>
              {isMember ? 'Membre' : 'Externe'}
            </Badge>
            {isMember && !isPlayer1 && inviteBadge && (
              <Badge color={inviteBadge.color}>{inviteBadge.label}</Badge>
            )}
            {(!isInvitePending || isPlayer1) && (
              <Badge color={badge.color}>{badge.label}</Badge>
            )}
          </div>
        </div>
        <p className="text-sm font-bold text-primary">{parseFloat(player.amount).toFixed(2)}€</p>
      </div>

      {/* Payment actions — only for yourself */}
      {isPending && !isPaid && isMe && !isInvitePending && (
        <div className="flex gap-2 mt-2.5 pt-2.5 border-t border-separator/50">
          <Button size="sm" className="flex-1" onClick={() => onPayBalance(player)} loading={submitting}>
            <Wallet className="w-3.5 h-3.5 mr-1" />Solde
          </Button>
          <Button size="sm" variant="ghost" className="flex-1" onClick={() => onPayExternal(player, 'cb')} loading={submitting}>
            <CreditCard className="w-3.5 h-3.5 mr-1" />CB
          </Button>
          <Button size="sm" variant="ghost" className="flex-1" onClick={() => onPayExternal(player, 'cash')} loading={submitting}>
            <Banknote className="w-3.5 h-3.5 mr-1" />Espèces
          </Button>
        </div>
      )}

      {/* Clear slot — owner can remove invited players, or self-remove */}
      {!isPlayer1 && isPending && !isPaid && (isOwner || isMe) && (
        <button
          onClick={() => onClearSlot(player)}
          className="mt-2 text-xs text-danger hover:underline cursor-pointer"
        >
          Retirer ce joueur
        </button>
      )}
    </div>
  )
}
