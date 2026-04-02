import Modal from '@/components/ui/Modal'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import { Wallet, ChevronRight, CreditCard, Banknote } from 'lucide-react'

export default function CreditModal({
  isOpen, onClose, member, formulas,
  creditMode, setCreditMode, selectedFormula, setSelectedFormula,
  freeAmount, setFreeAmount, paymentMethod, setPaymentMethod,
  crediting, onCredit,
}) {
  if (!member) return null
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Créditer ${member.display_name}`}>
      <div className="space-y-4">
        <div className="bg-bg rounded-[12px] p-3">
          <p className="text-xs text-text-secondary">Solde actuel</p>
          <p className="text-lg font-bold text-primary">
            {(parseFloat(member.balance) + parseFloat(member.balance_bonus)).toFixed(2)}€
          </p>
          <p className="text-[10px] text-text-tertiary">
            {parseFloat(member.balance).toFixed(2)}€ réel + {parseFloat(member.balance_bonus).toFixed(2)}€ bonus
          </p>
        </div>

        {/* Toggle mode */}
        <div className="flex rounded-[12px] bg-bg p-1">
          <button onClick={() => setCreditMode('formula')}
            className={`flex-1 py-2 rounded-[10px] text-sm font-medium transition-all cursor-pointer ${creditMode === 'formula' ? 'bg-primary text-white' : 'text-text-secondary'}`}>
            Via formule
          </button>
          <button onClick={() => setCreditMode('free')}
            className={`flex-1 py-2 rounded-[10px] text-sm font-medium transition-all cursor-pointer ${creditMode === 'free' ? 'bg-primary text-white' : 'text-text-secondary'}`}>
            Crédit libre
          </button>
        </div>

        {creditMode === 'formula' ? (
          <div className="space-y-2">
            {formulas.map((f) => {
              const active = selectedFormula?.id === f.id
              return (
                <button key={f.id} onClick={() => setSelectedFormula(f)}
                  className={`w-full flex items-center justify-between p-3.5 rounded-[12px] transition-all cursor-pointer ${active ? 'bg-primary text-white' : 'bg-bg hover:bg-primary/5'}`}>
                  <div className="text-left">
                    <p className={`text-sm font-semibold ${active ? 'text-white' : 'text-text'}`}>{parseFloat(f.amount_paid).toFixed(0)}€</p>
                    <p className={`text-xs ${active ? 'text-white/60' : 'text-text-secondary'}`}>payé</p>
                  </div>
                  <ChevronRight className={`w-4 h-4 ${active ? 'text-white/60' : 'text-text-tertiary'}`} />
                  <div className="text-right">
                    <p className={`text-sm font-semibold ${active ? 'text-lime' : 'text-primary'}`}>{parseFloat(f.amount_credited).toFixed(0)}€</p>
                    <p className={`text-xs ${active ? 'text-white/60' : 'text-lime-dark'}`}>+{parseFloat(f.bonus).toFixed(0)}€ bonus</p>
                  </div>
                </button>
              )
            })}
            {formulas.length === 0 && <p className="text-sm text-text-tertiary text-center py-3">Aucune formule configurée</p>}
          </div>
        ) : (
          <Input label="Montant à créditer (€)" type="number" min="0" step="0.01" value={freeAmount} onChange={(e) => setFreeAmount(e.target.value)} placeholder="50.00" />
        )}

        {/* Choix mode de paiement */}
        <div>
          <p className="text-xs font-medium text-text-secondary mb-2">Mode de paiement</p>
          <div className="flex gap-2">
            <button onClick={() => setPaymentMethod('cb')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-[12px] text-sm font-medium transition-all cursor-pointer ${paymentMethod === 'cb' ? 'bg-primary text-white' : 'bg-bg hover:bg-primary/5 text-text-secondary'}`}>
              <CreditCard className="w-4 h-4" />CB
            </button>
            <button onClick={() => setPaymentMethod('cash')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-[12px] text-sm font-medium transition-all cursor-pointer ${paymentMethod === 'cash' ? 'bg-primary text-white' : 'bg-bg hover:bg-primary/5 text-text-secondary'}`}>
              <Banknote className="w-4 h-4" />Espèces
            </button>
          </div>
        </div>

        <Button className="w-full" loading={crediting} onClick={onCredit}>
          <Wallet className="w-4 h-4 mr-1" />Créditer
        </Button>
      </div>
    </Modal>
  )
}
