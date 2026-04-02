import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import {
  Search, UserPlus, Wallet, CreditCard, Banknote, Lock, Trash2
} from 'lucide-react'

export default function POSSessionModal({
  booking, players, submitting,
  memberSearch, setMemberSearch, memberResults,
  onPayBalance, onPayExternal, onAddPlayer, onAddExternal,
  onRemovePlayer, onUpdateAmount, onAcceptInvitation, onCancelBooking,
  formatTime, PAY_BADGE, COURTS,
}) {
  if (!booking) return null

  const total = parseFloat(booking.price)
  const defaultShare = Math.round((total / 4) * 100) / 100
  const allPlayers = players
  const realPlayers = allPlayers.filter((p) => p.player_name !== 'Place disponible')
  const paid = realPlayers.reduce((s, p) => s + (p.payment_status !== 'pending' ? parseFloat(p.amount) : 0), 0)
  const remaining = total - paid
  const isSessionPaid = paid >= total
  const canAdd = realPlayers.length < 4 && !isSessionPaid

  return (
    <div className="space-y-4">
      {/* Session info */}
      <div className="bg-bg rounded-[12px] p-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold">{booking.user_name}</p>
            <p className="text-xs text-text-secondary">
              {COURTS.find((c) => c.id === booking.court_id)?.label} · {formatTime(booking.start_time)} – {formatTime(booking.end_time)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-primary">{total.toFixed(2)}€</p>
            <p className="text-[10px] text-text-tertiary">{defaultShare.toFixed(2)}€ / joueur</p>
          </div>
        </div>
      </div>

      {/* Payment summary */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-[8px] bg-bg p-2">
          <p className="text-[9px] text-text-tertiary uppercase">Total</p>
          <p className="text-sm font-bold text-primary">{total.toFixed(2)}€</p>
        </div>
        <div className="rounded-[8px] bg-success/10 p-2">
          <p className="text-[9px] text-text-tertiary uppercase">Payé</p>
          <p className="text-sm font-bold text-success">{paid.toFixed(2)}€</p>
        </div>
        <div className={`rounded-[8px] p-2 ${remaining > 0 ? 'bg-warning/10' : 'bg-success/10'}`}>
          <p className="text-[9px] text-text-tertiary uppercase">Reste</p>
          <p className={`text-sm font-bold ${remaining > 0 ? 'text-warning' : 'text-success'}`}>{remaining.toFixed(2)}€</p>
        </div>
      </div>

      {/* Players */}
      <div>
        <p className="text-xs font-semibold text-text-secondary uppercase mb-2">Joueurs ({realPlayers.length}/4)</p>
        <div className="space-y-2">
          {realPlayers.map((p, idx) => {
            const badge = PAY_BADGE[p.payment_status] || PAY_BADGE.pending
            const isPending = p.payment_status === 'pending'
            const isMember = !!p.user_id
            const isReservant = idx === 0
            const isInvitePending = p.invitation_status === 'pending'

            return (
              <div key={p.id} className={`rounded-[10px] p-3 space-y-2 ${isInvitePending ? 'bg-warning/5 border border-warning/20' : 'bg-bg'}`}>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-primary">{p.player_name.charAt(0).toUpperCase()}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1 flex-wrap">
                      <p className="text-sm font-medium truncate">{p.player_name}</p>
                      {isReservant && <span className="text-[8px] bg-primary/10 text-primary px-1 py-0.5 rounded">Rés.</span>}
                      {isInvitePending && <span className="text-[8px] bg-warning/20 text-warning px-1 py-0.5 rounded">Invitation en attente</span>}
                    </div>
                    <p className="text-[10px] text-text-tertiary">{isMember ? 'Membre' : 'Externe'}</p>
                  </div>
                  {!isInvitePending && <Badge color={badge.color}>{badge.label}</Badge>}
                </div>

                {/* Admin can force-accept or remove pending invitations */}
                {isInvitePending && (
                  <div className="flex gap-1.5">
                    <Button size="sm" className="flex-1" loading={submitting} onClick={() => onAcceptInvitation(p)}>
                      Valider l'invitation
                    </Button>
                    <Button size="sm" variant="danger" className="flex-1" loading={submitting} onClick={() => onRemovePlayer(p)}>
                      Supprimer
                    </Button>
                  </div>
                )}

                {/* Payment actions — only for accepted, pending payment */}
                {!isInvitePending && isPending && !isSessionPaid && (
                  <>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-text-secondary">Montant :</span>
                      <input type="number" step="0.01" min="0"
                        defaultValue={parseFloat(p.amount).toFixed(2)}
                        onBlur={(e) => onUpdateAmount(p.id, e.target.value)}
                        className="w-20 px-2 py-1 rounded-lg bg-white border border-separator text-sm text-center font-semibold text-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
                      <span className="text-xs text-text-tertiary">€</span>
                    </div>
                    <div className="flex gap-1.5">
                      {isMember && (
                        <Button size="sm" className="flex-1" onClick={() => onPayBalance(p)} loading={submitting}>
                          <Wallet className="w-3 h-3 mr-1" />Solde
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" className="flex-1" onClick={() => onPayExternal(p, 'cb')} loading={submitting}>
                        <CreditCard className="w-3 h-3 mr-1" />CB
                      </Button>
                      <Button size="sm" variant="ghost" className="flex-1" onClick={() => onPayExternal(p, 'cash')} loading={submitting}>
                        <Banknote className="w-3 h-3 mr-1" />Cash
                      </Button>
                    </div>
                    {!isReservant && (
                      <button onClick={() => onRemovePlayer(p)} className="text-[10px] text-danger hover:underline cursor-pointer">Retirer</button>
                    )}
                  </>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Add players */}
      {canAdd && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-text-secondary uppercase">Ajouter un joueur</p>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
            <input type="text" placeholder="Rechercher un membre..." value={memberSearch} onChange={(e) => setMemberSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-[10px] bg-white border border-separator text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
          </div>
          {memberResults.length > 0 && (
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {memberResults.map((m) => (
                <button key={m.id} onClick={() => onAddPlayer(m)}
                  className="w-full flex items-center gap-2 p-2.5 rounded-[10px] hover:bg-bg text-left text-sm cursor-pointer">
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-primary">{m.display_name.charAt(0).toUpperCase()}</span>
                  </div>
                  <span className="font-medium flex-1">{m.display_name}</span>
                  <span className="text-xs text-text-tertiary">{(parseFloat(m.balance||0)+parseFloat(m.balance_bonus||0)).toFixed(2)}€</span>
                  <UserPlus className="w-4 h-4 text-primary shrink-0" />
                </button>
              ))}
            </div>
          )}
          <button onClick={onAddExternal}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-[10px] border-2 border-dashed border-separator hover:border-primary/30 hover:bg-primary/5 text-sm font-medium text-primary cursor-pointer">
            <UserPlus className="w-4 h-4" />Joueur externe
          </button>
        </div>
      )}

      {isSessionPaid && (
        <div className="flex items-center gap-2 py-3 px-4 rounded-[10px] bg-success/5 border border-success/20">
          <Lock className="w-4 h-4 text-success" />
          <p className="text-sm text-success font-medium">Session entièrement payée</p>
        </div>
      )}

      {/* Cancel */}
      <Button variant="danger" className="w-full" loading={submitting} onClick={onCancelBooking}>
        <Trash2 className="w-4 h-4 mr-1" />Annuler la session
      </Button>
    </div>
  )
}
