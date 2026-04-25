import Card from '@/components/ui/Card'
import ExportButtons from '@/components/ui/ExportButtons'
import { exportExcel, exportPDF } from '@/utils/export'
import {
  ChevronLeft, ChevronRight, Trophy, Star
} from 'lucide-react'

export default function POSSessionGrid({
  dateStr, setSelectedDate, isToday, dayLabel,
  slots, bLoading,
  salesToday, showAllSales, setShowAllSales,
  exportRows, exportCols,
  onOpenSession, onOpenNewBooking,
  formatTime, getBlockingEvent, getBookingFor, changeDay,
  COURTS,
}) {
  return (
    <>
      {/* Day selector */}
      <div className="flex items-center justify-between">
        <button onClick={() => changeDay(-1)} className="p-2 rounded-[10px] hover:bg-bg cursor-pointer">
          <ChevronLeft className="w-5 h-5 text-text-secondary" />
        </button>
        <div className="flex items-center gap-2">
          <button onClick={() => setSelectedDate(new Date())}
            className={`px-4 py-2 rounded-[10px] text-sm font-medium cursor-pointer ${isToday ? 'bg-primary text-white' : 'bg-bg hover:bg-primary/5 text-text'}`}>
            Aujourd'hui
          </button>
          <input type="date" value={dateStr}
            onChange={(e) => setSelectedDate(new Date(e.target.value + 'T00:00'))}
            className="px-3 py-2 rounded-[10px] bg-bg text-sm font-medium text-text border-0 focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer" />
        </div>
        <button onClick={() => changeDay(1)} className="p-2 rounded-[10px] hover:bg-bg cursor-pointer">
          <ChevronRight className="w-5 h-5 text-text-secondary" />
        </button>
      </div>
      <p className="text-sm text-text-secondary capitalize">{dayLabel}</p>

      {/* Grid 3 terrains x creneaux */}
      <Card className="!p-0 overflow-hidden">
        <div className="grid grid-cols-[80px_1fr_1fr_1fr] lg:grid-cols-[100px_1fr_1fr_1fr] border-b border-separator bg-bg/50">
          <div className="p-3 text-xs font-semibold text-text-tertiary uppercase text-center">Horaire</div>
          {COURTS.map((c) => (
            <div key={c.id} className="p-3 text-center text-xs font-semibold text-text-secondary uppercase border-l border-separator">
              <span className="hidden sm:inline">{c.label}</span>
              <span className="sm:hidden">{c.short}</span>
            </div>
          ))}
        </div>

        {bLoading ? (
          Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="grid grid-cols-[80px_1fr_1fr_1fr] lg:grid-cols-[100px_1fr_1fr_1fr] border-b border-separator last:border-0">
              {[0,1,2,3].map((j) => <div key={j} className="p-2"><div className="h-14 rounded-[10px] bg-bg animate-pulse" /></div>)}
            </div>
          ))
        ) : (
          slots.map((slot) => (
            <div key={slot.start} className="grid grid-cols-[80px_1fr_1fr_1fr] lg:grid-cols-[100px_1fr_1fr_1fr] border-b border-separator last:border-0">
              <div className="p-2 flex flex-col items-center justify-center bg-bg/30">
                <span className="text-xs font-semibold text-text">{formatTime(slot.start)}</span>
                <span className="text-[10px] text-text-tertiary">{formatTime(slot.end)}</span>
              </div>
              {COURTS.map((court) => {
                const booking = getBookingFor(court.id, slot.start)
                const blocking = getBlockingEvent(slot.start, slot.end)

                // Blocked by tournament/event
                if (blocking && !booking) {
                  return (
                    <div key={court.id} className="p-1.5 border-l border-separator">
                      <div className="h-full min-h-[56px] rounded-[10px] bg-primary/10 flex items-center justify-center gap-1 px-2">
                        {blocking.type === 'tournament' ? <Trophy className="w-3.5 h-3.5 text-primary shrink-0" /> : <Star className="w-3.5 h-3.5 text-lime-dark shrink-0" />}
                        <span className="text-[10px] font-medium text-primary truncate">
                          {blocking.type === 'tournament' && blocking.level
                            ? `${blocking.level} ${blocking.category === 'hommes' ? 'H' : blocking.category === 'femmes' ? 'F' : 'M'}`
                            : blocking.name}
                        </span>
                      </div>
                    </div>
                  )
                }

                // Empty slot — click to create booking
                if (!booking) {
                  return (
                    <div key={court.id} className="p-1.5 border-l border-separator">
                      <button
                        onClick={() => onOpenNewBooking(court.id, slot)}
                        className="w-full h-full min-h-[56px] rounded-[10px] bg-green-50/50 hover:bg-green-100/50 flex items-center justify-center transition-colors cursor-pointer"
                      >
                        <span className="text-xs text-green-500 font-medium">+ Réserver</span>
                      </button>
                    </div>
                  )
                }

                // Booked slot
                const bp = booking.booking_players || []
                const filled = bp.filter((p) => p.player_name !== 'Place disponible').length
                const paidAmount = bp.reduce((s, p) => s + (p.payment_status === 'paid' || p.payment_status === 'external' ? parseFloat(p.amount) : 0), 0)
                const totalPrice = parseFloat(booking.price)
                const isPaid = paidAmount >= totalPrice
                const isPartial = paidAmount > 0 && !isPaid

                return (
                  <div key={court.id} className="p-1.5 border-l border-separator">
                    <button
                      onClick={() => onOpenSession(booking)}
                      className={`w-full h-full min-h-[56px] rounded-[10px] p-2 text-left transition-all cursor-pointer active:scale-[0.98] ${
                        isPaid ? 'bg-success/10 hover:bg-success/15' : isPartial ? 'bg-warning/10 hover:bg-warning/15' : 'bg-red-50 hover:bg-red-100/50'
                      }`}
                    >
                      <p className="text-xs font-semibold text-text truncate">{booking.user_name}</p>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-[10px] text-text-secondary">{filled}/4</span>
                        <span className={`text-[10px] font-medium ${isPaid ? 'text-success' : isPartial ? 'text-warning' : 'text-red-500'}`}>
                          {paidAmount.toFixed(0)}/{totalPrice.toFixed(0)}€
                        </span>
                      </div>
                    </button>
                  </div>
                )
              })}
            </div>
          ))
        )}
      </Card>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-1">
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-green-50 border border-green-200" /><span className="text-xs text-text-secondary">Libre</span></div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-red-50 border border-red-200" /><span className="text-xs text-text-secondary">Non payée</span></div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-warning/10 border border-warning/20" /><span className="text-xs text-text-secondary">Partiel</span></div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-success/10 border border-success/20" /><span className="text-xs text-text-secondary">Payée</span></div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-primary/10 border border-primary/20" /><span className="text-xs text-text-secondary">Tournoi / Événement</span></div>
      </div>

      {/* Sales history — linked to selected day */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-text">
            Paiements du jour {salesToday.length > 0 && <span className="text-text-tertiary font-normal">({salesToday.length})</span>}
          </h3>
          <ExportButtons
            onExcel={() => exportExcel(exportRows, exportCols, `pos_${dateStr}`)}
            onPDF={() => exportPDF(exportRows, exportCols, `pos_${dateStr}`, 'POS')} />
        </div>
        {salesToday.length === 0 ? (
          <p className="text-sm text-text-tertiary text-center py-4">Aucun paiement ce jour</p>
        ) : (
          <>
            <div className="space-y-1.5">
              {(showAllSales ? salesToday : salesToday.slice(0, 5)).map((tx) => (
                <div key={tx.id} className="flex items-center justify-between py-2 px-3 rounded-[10px] bg-bg">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-text truncate">{tx.description}</p>
                    <p className="text-[10px] text-text-tertiary">
                      {new Date(tx.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      {tx.payment_method && ` · ${tx.payment_method}`}
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-danger">-{parseFloat(tx.amount).toFixed(2)}€</span>
                </div>
              ))}
            </div>
            {salesToday.length > 5 && (
              <button
                onClick={() => setShowAllSales(!showAllSales)}
                className="w-full mt-3 py-2 text-xs font-medium text-primary hover:underline cursor-pointer text-center"
              >
                {showAllSales ? 'Voir moins' : `Voir tout (${salesToday.length})`}
              </button>
            )}
          </>
        )}
      </Card>
    </>
  )
}
