import Button from '@/components/ui/Button'
import { Search, Wallet, CreditCard, Banknote } from 'lucide-react'
import { calculateTva, getProductTvaRate, formatTvaRate, groupTvaByRate } from '@/utils/tva'

export default function POSSaleModal({
  cart, cartTotal,
  selectedBuyer, setSelectedBuyer,
  saleSearch, setSaleSearch, saleResults,
  salePayment, setSalePayment,
  submitting, onSubmit,
}) {
  const tvaBreakdown = groupTvaByRate(
    cart.map((c) => {
      const ttc = Number(c.product.price) * c.qty
      const rate = getProductTvaRate(c.product)
      const { ht, tva } = calculateTva(ttc, rate)
      return { amount: ttc, amount_ht: ht, amount_tva: tva, tva_rate: rate }
    })
  )
  const totalTva = tvaBreakdown.reduce((s, b) => s + b.tva, 0)

  return (
    <div className="space-y-4">
      <div className="bg-bg rounded-[12px] p-3">
        <p className="text-sm text-text-secondary">Total TTC</p>
        <p className="text-2xl font-bold text-primary">{cartTotal.toFixed(2)}€</p>
        {totalTva > 0 && (
          <p className="text-xs text-text-tertiary mt-1">
            {tvaBreakdown.length === 1
              ? `dont TVA ${formatTvaRate(tvaBreakdown[0].rate)} : ${tvaBreakdown[0].tva.toFixed(2)}€`
              : `dont TVA : ${tvaBreakdown.map((b) => `${formatTvaRate(b.rate)} ${b.tva.toFixed(2)}€`).join(' · ')}`}
          </p>
        )}
        <p className="text-xs text-text-tertiary mt-1">{cart.map((c) => `${c.product.name} x${c.qty}`).join(', ')}</p>
      </div>
      <div>
        <label className="block text-sm font-medium text-text mb-1.5">Membre (optionnel)</label>
        {selectedBuyer ? (
          <div className="flex items-center justify-between p-2.5 rounded-[10px] bg-bg">
            <span className="text-sm font-medium">{selectedBuyer.display_name}</span>
            <button onClick={() => setSelectedBuyer(null)} className="text-xs text-danger cursor-pointer">Retirer</button>
          </div>
        ) : (
          <>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
              <input type="text" placeholder="Rechercher..." value={saleSearch} onChange={(e) => setSaleSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-[10px] bg-bg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
            {saleResults.length > 0 && (
              <div className="space-y-1 mt-1 max-h-28 overflow-y-auto">
                {saleResults.map((m) => (
                  <button key={m.id} onClick={() => { setSelectedBuyer(m); setSaleSearch('') }}
                    className="w-full text-left p-2 rounded-lg hover:bg-bg text-sm cursor-pointer">
                    {m.display_name} <span className="text-text-tertiary">— {(parseFloat(m.balance||0)+parseFloat(m.balance_bonus||0)).toFixed(2)}€</span>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
      <div>
        <label className="block text-sm font-medium text-text mb-1.5">Paiement</label>
        <div className="flex gap-2">
          {[
            { value: 'balance', label: 'Solde', icon: Wallet },
            { value: 'cb', label: 'CB', icon: CreditCard },
            { value: 'cash', label: 'Espèces', icon: Banknote },
          ].filter((o) => selectedBuyer ? true : o.value !== 'balance').map((o) => {
            const Icon = o.icon
            return (
              <button key={o.value} onClick={() => setSalePayment(o.value)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-[10px] text-sm font-medium cursor-pointer ${
                  salePayment === o.value ? 'bg-primary text-white' : 'bg-bg text-text-secondary'}`}>
                <Icon className="w-4 h-4" />{o.label}
              </button>
            )
          })}
        </div>
      </div>
      <Button className="w-full" loading={submitting} onClick={onSubmit}>Encaisser {cartTotal.toFixed(2)}€</Button>
    </div>
  )
}
