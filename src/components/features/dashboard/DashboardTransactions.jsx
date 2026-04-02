import { useState } from 'react'
import Badge from '@/components/ui/Badge'
import Card from '@/components/ui/Card'
import {
  ArrowUpRight, ArrowDownRight, Gift, CreditCard,
  Clock, ChevronDown, ChevronUp
} from 'lucide-react'

const TX_ICONS = {
  credit: { icon: ArrowDownRight, color: 'text-success', bg: 'bg-success/10' },
  credit_bonus: { icon: Gift, color: 'text-lime-dark', bg: 'bg-lime/20' },
  debit_session: { icon: ArrowUpRight, color: 'text-danger', bg: 'bg-danger/10' },
  debit_product: { icon: ArrowUpRight, color: 'text-warning', bg: 'bg-warning/10' },
  refund: { icon: ArrowDownRight, color: 'text-success', bg: 'bg-success/10' },
  external_payment: { icon: CreditCard, color: 'text-text-secondary', bg: 'bg-bg' },
}

export default function DashboardTransactions({ transactions, txTotal, loading }) {
  const [expanded, setExpanded] = useState([])
  const [showAllTx, setShowAllTx] = useState(false)

  const toggleExpand = (txId) => {
    setExpanded((prev) =>
      prev.includes(txId) ? prev.filter((id) => id !== txId) : [...prev, txId]
    )
  }

  const visibleTx = showAllTx ? transactions : transactions.slice(0, 5)

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-text">
          Transactions récentes {txTotal > 0 && <span className="text-text-tertiary font-normal">({txTotal})</span>}
        </h3>
      </div>
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <div key={i} className="h-12 rounded-[12px] bg-bg animate-pulse" />)}
        </div>
      ) : transactions.length > 0 ? (
        <>
          <div className="space-y-1">
            {visibleTx.map((tx) => {
              const meta = TX_ICONS[tx.type] || TX_ICONS.external_payment
              const Icon = meta.icon
              const isDebit = tx.type.startsWith('debit') || tx.type === 'external_payment'
              const isExpanded = expanded.includes(tx.id)
              const txDate = new Date(tx.created_at)

              return (
                <div key={tx.id}>
                  <button
                    onClick={() => toggleExpand(tx.id)}
                    className="w-full flex items-center gap-3 py-2.5 px-1 rounded-[10px] hover:bg-bg/50 transition-colors text-left cursor-pointer"
                  >
                    <div className={`w-9 h-9 rounded-[10px] ${meta.bg} flex items-center justify-center shrink-0`}>
                      <Icon className={`w-4 h-4 ${meta.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-text truncate">{tx.description}</p>
                      <p className="text-[11px] text-text-tertiary">
                        {txDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                        {' · '}
                        {txDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <p className={`text-sm font-semibold shrink-0 ${isDebit ? 'text-danger' : 'text-success'}`}>
                      {isDebit ? '-' : '+'}{parseFloat(tx.amount).toFixed(2)}€
                    </p>
                    {isExpanded
                      ? <ChevronUp className="w-4 h-4 text-text-tertiary shrink-0" />
                      : <ChevronDown className="w-4 h-4 text-text-tertiary shrink-0" />
                    }
                  </button>

                  {/* Expanded details */}
                  {isExpanded && (
                    <div className="ml-12 mr-1 mb-2 p-3 rounded-[10px] bg-bg space-y-1.5 text-xs">
                      <div className="flex justify-between">
                        <span className="text-text-secondary">Type</span>
                        <Badge color={isDebit ? 'danger' : 'success'}>
                          {tx.type === 'credit' ? 'Crédit'
                            : tx.type === 'credit_bonus' ? 'Bonus'
                            : tx.type === 'debit_session' ? 'Session'
                            : tx.type === 'debit_product' ? 'Article'
                            : tx.type === 'refund' ? 'Remboursement'
                            : 'Paiement ext.'}
                        </Badge>
                      </div>
                      {parseFloat(tx.bonus_used || 0) > 0 && (
                        <div className="flex justify-between">
                          <span className="text-text-secondary">Bonus utilisé</span>
                          <span className="font-medium text-lime-dark">{parseFloat(tx.bonus_used).toFixed(2)}€</span>
                        </div>
                      )}
                      {parseFloat(tx.real_used || 0) > 0 && (
                        <div className="flex justify-between">
                          <span className="text-text-secondary">Solde réel utilisé</span>
                          <span className="font-medium">{parseFloat(tx.real_used).toFixed(2)}€</span>
                        </div>
                      )}
                      {tx.formula_amount_paid && (
                        <div className="flex justify-between">
                          <span className="text-text-secondary">Formule</span>
                          <span className="font-medium">
                            {parseFloat(tx.formula_amount_paid).toFixed(0)}€ → {parseFloat(tx.formula_amount_credited).toFixed(0)}€
                            {tx.formula_bonus && <span className="text-lime-dark"> (+{parseFloat(tx.formula_bonus).toFixed(0)}€)</span>}
                          </span>
                        </div>
                      )}
                      {tx.payment_method && (
                        <div className="flex justify-between">
                          <span className="text-text-secondary">Paiement</span>
                          <span className="font-medium capitalize">{tx.payment_method}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-text-secondary">Date complète</span>
                        <span className="font-medium">
                          {txDate.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                          {' '}{txDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Show more / less */}
          {transactions.length > 5 && (
            <button
              onClick={() => setShowAllTx(!showAllTx)}
              className="w-full mt-3 py-2 text-xs font-medium text-primary hover:underline cursor-pointer text-center"
            >
              {showAllTx ? 'Voir moins' : `Voir tout (${transactions.length})`}
            </button>
          )}
        </>
      ) : (
        <div className="text-center py-4">
          <Clock className="w-6 h-6 text-text-tertiary mx-auto mb-1" />
          <p className="text-sm text-text-tertiary">Aucune activité récente</p>
        </div>
      )}
    </Card>
  )
}
