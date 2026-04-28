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

  const tarifLabel = findPricingRule(pricingRules, selectedDate, selectedSlot.start)?.label || '—'
  const dateLabel = selectedDate.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })

  const payOptions = [
    { value: 'my_part', label: `Ma part · ${myShare.toFixed(2)}€`, ok: canPayPart },
    { value: 'full', label: `Tout · ${selectedSlot.price.toFixed(2)}€`, ok: canPayFull },
    { value: 'none', label: 'Plus tard', ok: true },
  ]

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Confirmer la réservation">
      <div className="space-y-3">
        {/* Recap compact */}
        <div className="rounded-[12px] bg-bg p-3 grid grid-cols-2 gap-y-1.5 gap-x-3 text-sm">
          <span className="text-text-secondary">Terrain</span>
          <span className="font-semibold text-right">{courtName}</span>
          <span className="text-text-secondary">Date</span>
          <span className="font-semibold text-right capitalize">{dateLabel}</span>
          <span className="text-text-secondary">Horaire</span>
          <span className="font-semibold text-right">{formatTime(selectedSlot.start)}–{formatTime(selectedSlot.end)}</span>
          <span className="text-text-secondary">Tarif</span>
          <span className="font-semibold text-right">{tarifLabel}</span>
        </div>

        {/* Price compact */}
        <div className="bg-primary/5 rounded-[12px] px-3 py-2 flex items-center justify-between">
          <div>
            <p className="text-xs text-text-secondary">Total · {myShare.toFixed(2)}€/joueur</p>
            <p className="text-[11px] text-text-tertiary">Solde : {totalBalance.toFixed(2)}€</p>
          </div>
          <span className="text-xl font-bold text-primary">{selectedSlot.price.toFixed(2)}€</span>
        </div>

        {/* Payment choice — segmented */}
        <div>
          <p className="text-xs font-medium text-text mb-1.5">Paiement</p>
          <div className="grid grid-cols-3 gap-1.5">
            {payOptions.map(({ value, label, ok }) => {
              const disabled = !ok && value !== 'none'
              const active = payChoice === value
              return (
                <button
                  key={value}
                  onClick={() => !disabled && setPayChoice(value)}
                  disabled={disabled}
                  className={`px-2 py-2.5 rounded-[10px] text-xs font-medium transition-all ${
                    disabled
                      ? 'bg-bg text-text-tertiary cursor-not-allowed opacity-60'
                      : active
                        ? 'bg-primary text-white cursor-pointer'
                        : 'bg-bg text-text hover:bg-primary/5 cursor-pointer'
                  }`}
                >
                  {label}
                </button>
              )
            })}
          </div>
          {(!canPayPart) && (
            <p className="text-[11px] text-warning mt-1.5">
              Solde insuffisant pour payer maintenant — choisis « Plus tard ».
            </p>
          )}
        </div>

        <div className="flex gap-2">
          <Button variant="ghost" className="flex-1" onClick={onClose}>Annuler</Button>
          <Button className="flex-1" loading={creating} onClick={onConfirm}>
            <Check className="w-4 h-4 mr-1" />
            {payChoice === 'full' && canPayFull ? 'Tout payer'
              : payChoice === 'my_part' && canPayPart ? `Payer ${myShare.toFixed(2)}€`
              : 'Réserver'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
