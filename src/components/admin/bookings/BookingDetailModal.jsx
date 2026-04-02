import Modal from '@/components/ui/Modal'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import { formatTime } from '@/utils/formatDate'
import { MapPin, Clock, Trash2 } from 'lucide-react'

const COURTS = [
  { id: 'terrain_1', label: 'Terrain 1' },
  { id: 'terrain_2', label: 'Terrain 2' },
  { id: 'terrain_3', label: 'Terrain 3' },
]

const PAY_BADGE = {
  paid: { color: 'success', label: 'Payé' },
  external: { color: 'primary', label: 'CB/Espèces' },
  pending: { color: 'warning', label: 'En attente' },
}

export default function BookingDetailModal({ isOpen, onClose, booking, players, cancelling, onCancel }) {
  if (!booking) return <Modal isOpen={isOpen} onClose={onClose} title="Détail réservation" />

  const paidAmount = players.reduce(
    (s, p) => s + (p.payment_status === 'paid' || p.payment_status === 'external' ? parseFloat(p.amount) : 0), 0
  )
  const totalAmount = parseFloat(booking.price)
  const remaining = totalAmount - paidAmount

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Détail réservation">
      <div className="space-y-4">
        <div className="rounded-[14px] bg-bg p-4 space-y-2.5">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium">
              {COURTS.find((c) => c.id === booking.court_id)?.label || booking.court_id}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" />
            <span className="text-sm">
              {new Date(booking.date + 'T00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
              {' · '}{formatTime(booking.start_time)} – {formatTime(booking.end_time)}
            </span>
          </div>
          <div className="flex justify-between pt-1 border-t border-separator">
            <span className="text-sm text-text-secondary">Réservé par</span>
            <span className="text-sm font-semibold">{booking.user_name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-text-secondary">Prix total</span>
            <span className="text-sm font-bold text-primary">{totalAmount.toFixed(2)}€</span>
          </div>
        </div>

        {/* Players */}
        {players.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-text-secondary uppercase mb-2">
              Joueurs ({players.filter((p) => p.player_name !== 'Place disponible').length}/4)
            </p>
            <div className="space-y-1.5">
              {players.map((p) => {
                const isEmpty = p.player_name === 'Place disponible'
                const badge = PAY_BADGE[p.payment_status] || PAY_BADGE.pending
                return (
                  <div key={p.id} className={`flex items-center justify-between py-2.5 px-3 rounded-[10px] ${isEmpty ? 'bg-bg/50 border border-dashed border-separator' : 'bg-bg'}`}>
                    {isEmpty ? (
                      <p className="text-sm text-text-tertiary">Place disponible</p>
                    ) : (
                      <>
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <span className="text-xs font-bold text-primary">
                              {p.player_name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <p className="text-sm font-medium">{p.player_name}</p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <Badge color={p.user_id ? 'primary' : 'gray'}>
                                {p.user_id ? 'Membre' : 'Externe'}
                              </Badge>
                              <Badge color={badge.color}>{badge.label}</Badge>
                            </div>
                          </div>
                        </div>
                        <span className="text-sm font-semibold text-primary">{parseFloat(p.amount).toFixed(2)}€</span>
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Payment summary */}
        {players.length > 0 && (
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-[10px] bg-bg p-2.5">
              <p className="text-[10px] text-text-tertiary uppercase">Total</p>
              <p className="text-base font-bold text-primary">{totalAmount.toFixed(2)}€</p>
            </div>
            <div className="rounded-[10px] bg-success/10 p-2.5">
              <p className="text-[10px] text-text-tertiary uppercase">Payé</p>
              <p className="text-base font-bold text-success">{paidAmount.toFixed(2)}€</p>
            </div>
            <div className={`rounded-[10px] p-2.5 ${remaining > 0 ? 'bg-warning/10' : 'bg-success/10'}`}>
              <p className="text-[10px] text-text-tertiary uppercase">Reste</p>
              <p className={`text-base font-bold ${remaining > 0 ? 'text-warning' : 'text-success'}`}>{remaining.toFixed(2)}€</p>
            </div>
          </div>
        )}

        {booking.status === 'confirmed' && (
          <Button variant="danger" className="w-full" loading={cancelling} onClick={onCancel}>
            <Trash2 className="w-4 h-4 mr-1" />
            Annuler (admin)
          </Button>
        )}
      </div>
    </Modal>
  )
}
