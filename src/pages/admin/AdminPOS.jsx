import { useState, useMemo } from 'react'
import { useClub } from '@/hooks/useClub'
import { toDateString, formatTime } from '@/utils/formatDate'
import { generateSlots } from '@/utils/slots'
import usePOSHandlers from '@/hooks/usePOSHandlers'
import PageWrapper from '@/components/layout/PageWrapper'
import Modal from '@/components/ui/Modal'
import { ShoppingCart, CalendarDays, Package } from 'lucide-react'
import ConfirmModal from '@/components/ui/ConfirmModal'
import useConfirm from '@/hooks/useConfirm'

import POSSessionGrid from '@/components/admin/pos/POSSessionGrid'
import POSArticlesTab from '@/components/admin/pos/POSArticlesTab'
import POSSessionModal from '@/components/admin/pos/POSSessionModal'
import POSNewBookingModal from '@/components/admin/pos/POSNewBookingModal'
import POSSaleModal from '@/components/admin/pos/POSSaleModal'

const PAY_BADGE = {
  paid: { color: 'success', label: 'Payé' },
  external: { color: 'primary', label: 'CB/Esp.' },
  pending: { color: 'warning', label: 'En attente' },
}
const COURTS = [
  { id: 'terrain_1', label: 'Terrain 1', short: 'T1' },
  { id: 'terrain_2', label: 'Terrain 2', short: 'T2' },
  { id: 'terrain_3', label: 'Terrain 3', short: 'T3' },
]

export default function AdminPOS() {
  const { config, pricingRules } = useClub()
  const { confirmProps, askConfirm } = useConfirm()

  const [tab, setTab] = useState('sessions')
  const [selectedDate, setSelectedDate] = useState(new Date())
  const dateStr = toDateString(selectedDate)
  const slots = useMemo(() => generateSlots(config), [config])

  const isToday = dateStr === toDateString(new Date())
  const dayLabel = selectedDate.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
  const changeDay = (offset) => {
    const d = new Date(selectedDate)
    d.setDate(d.getDate() + offset)
    setSelectedDate(d)
  }

  const h = usePOSHandlers({ dateStr, selectedDate, pricingRules, askConfirm })

  const exportCols = [
    { key: 'date', label: 'Date' }, { key: 'type', label: 'Type' },
    { key: 'amount', label: 'Montant' }, { key: 'description', label: 'Description' },
  ]
  const exportRows = h.salesToday.map((tx) => ({
    date: new Date(tx.created_at).toLocaleString('fr-FR'), type: tx.type,
    amount: parseFloat(tx.amount).toFixed(2) + '€', description: tx.description,
  }))

  return (
    <PageWrapper wide>
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-primary" />
            <h1 className="text-2xl font-bold text-text">Point de vente</h1>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex rounded-[12px] bg-white p-1 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <button onClick={() => setTab('sessions')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-[10px] text-sm font-semibold transition-all cursor-pointer ${
              tab === 'sessions' ? 'bg-primary text-white' : 'text-text-secondary'}`}>
            <CalendarDays className="w-4 h-4" />Sessions
          </button>
          <button onClick={() => setTab('articles')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-[10px] text-sm font-semibold transition-all cursor-pointer ${
              tab === 'articles' ? 'bg-primary text-white' : 'text-text-secondary'}`}>
            <Package className="w-4 h-4" />Articles
          </button>
        </div>

        {tab === 'sessions' && (
          <POSSessionGrid
            dateStr={dateStr} selectedDate={selectedDate} setSelectedDate={setSelectedDate}
            isToday={isToday} dayLabel={dayLabel}
            slots={slots} bookings={h.bookings} bLoading={h.bLoading} dayEvents={h.dayEvents}
            salesToday={h.salesToday} showAllSales={h.showAllSales} setShowAllSales={h.setShowAllSales}
            exportRows={exportRows} exportCols={exportCols}
            onOpenSession={h.openSession} onOpenNewBooking={h.openNewBooking}
            formatTime={formatTime} getBlockingEvent={h.getBlockingEvent} getBookingFor={h.getBookingFor}
            changeDay={changeDay} COURTS={COURTS}
          />
        )}

        {tab === 'articles' && (
          <POSArticlesTab
            categories={h.categories} filteredProducts={h.filteredProducts}
            activeCat={h.activeCat} setActiveCat={h.setActiveCat}
            cart={h.cart} addToCart={h.addToCart} updateCartQty={h.updateCartQty}
            cartTotal={h.cartTotal} onCheckout={h.openSaleCheckout}
          />
        )}
      </div>

      <Modal isOpen={h.sessionModal} onClose={() => h.setSessionModal(false)} title="Gestion session" className="!max-w-lg">
        <POSSessionModal
          booking={h.selectedBooking} players={h.sessionPlayers} submitting={h.submitting}
          memberSearch={h.memberSearch} setMemberSearch={h.setMemberSearch} memberResults={h.memberResults}
          onPayBalance={h.handlePayBalance} onPayExternal={h.handlePayExternal}
          onAddPlayer={h.handleAddPlayer} onAddExternal={h.handleAddExternal}
          onRemovePlayer={h.handleRemovePlayer} onUpdateAmount={h.handleUpdateAmount}
          onAcceptInvitation={h.handleAcceptInvitation} onCancelBooking={h.handleCancelBooking}
          formatTime={formatTime} PAY_BADGE={PAY_BADGE} COURTS={COURTS}
        />
      </Modal>

      <Modal isOpen={h.newBookingModal} onClose={() => h.setNewBookingModal(false)} title="Nouvelle réservation">
        <POSNewBookingModal
          slot={h.newSlot} dayLabel={dayLabel}
          newSearch={h.newSearch} setNewSearch={h.setNewSearch} newResults={h.newResults}
          creatingBooking={h.creatingBooking}
          onCreateBooking={h.handleCreateBooking} onCreateExternal={h.handleCreateExternal}
          formatTime={formatTime} COURTS={COURTS}
        />
      </Modal>

      <Modal isOpen={h.saleModal} onClose={() => h.setSaleModal(false)} title="Encaisser articles">
        <POSSaleModal
          cart={h.cart} cartTotal={h.cartTotal}
          selectedBuyer={h.selectedBuyer} setSelectedBuyer={h.setSelectedBuyer}
          saleSearch={h.saleSearch} setSaleSearch={h.setSaleSearch} saleResults={h.saleResults}
          salePayment={h.salePayment} setSalePayment={h.setSalePayment}
          submitting={h.submitting} onSubmit={h.submitSale}
        />
      </Modal>

      <ConfirmModal {...confirmProps} />
    </PageWrapper>
  )
}
