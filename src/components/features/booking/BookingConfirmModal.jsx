import { formatTime } from '@/utils/formatDate'
import { findPricingRule } from '@/utils/calculatePrice'
import { partPrice } from '@/services/bookingService'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import { Check } from 'lucide-react'

const COURTS = [
  { id: 'terrain_1', name: 'Terrain 1' },
  { id: 'terrain_2', name: 'Terrain 2' },
  { id: 'terrain_3', name: 'Terrain 3' },
]

export default function BookingConfirmModal({
  isOpen,
  onClose,
  selectedSlot,
  selectedDate,
  pricingRules,
  totalBalance,
  payChoice,
  setPayChoice,
  creating,
  onConfirm,
}) {
  if (!selectedSlot) return <Modal isOpen={isOpen} onClose={onClose} title="Confirmer la réservation" />

  const courtName = COURTS.find((c) => c.id === selectedSlot.courtId)?.name || selectedSlot.courtId
  const myShare = partPrice(selectedSlot.price)
  const canPayPart = totalBalance >= myShare
  const canPayFull = totalBalance >= selectedSlot.price

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Confirmer la réservation">
      <div className="space-y-4">
        {/* Recap */}
        <div className="rounded-[14px] bg-bg p-4 space-y-2">
          <div className="flex justify-between">
            <span className="text-sm text-text-secondary">Terrain</span>
            <span className="text-sm font-semibold">{courtName}</span>
          </div>
          <div className="border-t border-separator" />
          <div className="flex justify-between">
            <span className="text-sm text-text-secondary">Date</span>
            <span className="text-sm font-semibold">
              {selectedDate.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </span>
          </div>
          <div className="border-t border-separator" />
          <div className="flex justify-between">
            <span className="text-sm text-text-secondary">Horaire</span>
            <span className="text-sm font-semibold">
              {formatTime(selectedSlot.start)} – {formatTime(selectedSlot.end)}
            </span>
          </div>
          <div className="border-t border-separator" />
          <div className="flex justify-between">
            <span className="text-sm text-text-secondary">Tarif</span>
            <span className="text-sm font-semibold">
              {findPricingRule(pricingRules, selectedDate, selectedSlot.start)?.label || '—'}
            </span>
          </div>
        </div>

        {/* Price */}
        <div className="bg-primary/5 rounded-[14px] p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium text-text">Total session</span>
            <span className="text-2xl font-bold text-primary">{selectedSlot.price.toFixed(2)}€</span>
          </div>
          <p className="text-xs text-text-secondary text-right">
            {myShare.toFixed(2)}€ / joueur (4 joueurs)
          </p>
        </div>

        {/* Payment choice */}
        <div className="rounded-[14px] border border-separator p-4 space-y-3">
          <p className="text-sm font-medium text-text">Paiement</p>
          <div className="space-y-2">
            {[
              { value: 'my_part', label: `Payer ma part (${myShare.toFixed(2)}€)`, ok: canPayPart },
              { value: 'full', label: `Payer la totalité (${selectedSlot.price.toFixed(2)}€)`, ok: canPayFull },
              { value: 'none', label: 'Payer plus tard', ok: true },
            ].map(({ value, label, ok }) => (
              <button
                key={value}
                onClick={() => setPayChoice(value)}
                className={`w-full flex items-center gap-3 p-3 rounded-[10px] text-left transition-all cursor-pointer ${
                  payChoice === value
                    ? 'bg-primary text-white'
                    : 'bg-bg text-text hover:bg-primary/5'
                }`}
              >
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                  payChoice === value ? 'border-white' : 'border-text-tertiary'
                }`}>
                  {payChoice === value && <div className="w-2 h-2 rounded-full bg-white" />}
                </div>
                <span className="text-sm font-medium">{label}</span>
                {!ok && value !== 'none' && (
                  <span className={`text-[10px] ml-auto ${payChoice === value ? 'text-white/60' : 'text-danger'}`}>Solde insuffisant</span>
                )}
              </button>
            ))}
          </div>
          <p className="text-xs text-text-tertiary">
            Votre solde : <strong>{totalBalance.toFixed(2)}€</strong> · Bonus utilisé en priorité
          </p>
        </div>

        <p className="text-xs text-text-tertiary text-center">
          3 places seront disponibles pour inviter d'autres joueurs.
        </p>

        <div className="flex gap-3">
          <Button variant="ghost" className="flex-1" onClick={onClose}>
            Annuler
          </Button>
          <Button className="flex-1" loading={creating} onClick={onConfirm}>
            <Check className="w-4 h-4 mr-1" />
            {payChoice === 'full' && canPayFull ? 'Réserver et tout payer'
              : payChoice === 'my_part' && canPayPart ? `Réserver et payer ${myShare.toFixed(2)}€`
              : 'Réserver'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
