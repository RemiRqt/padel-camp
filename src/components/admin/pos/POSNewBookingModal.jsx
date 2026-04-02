import { Search, UserPlus, MapPin, Clock } from 'lucide-react'

export default function POSNewBookingModal({
  slot, dayLabel, newSearch, setNewSearch, newResults,
  creatingBooking, onCreateBooking, onCreateExternal,
  formatTime, COURTS,
}) {
  if (!slot) return null

  return (
    <div className="space-y-4">
      <div className="bg-bg rounded-[12px] p-4">
        <div className="flex items-center gap-2 mb-2">
          <MapPin className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium">{COURTS.find((c) => c.id === slot.courtId)?.label}</span>
        </div>
        <div className="flex items-center gap-2 mb-2">
          <Clock className="w-4 h-4 text-primary" />
          <span className="text-sm">{dayLabel} · {formatTime(slot.start)} – {formatTime(slot.end)}</span>
        </div>
        <div className="flex justify-between pt-2 border-t border-separator">
          <span className="text-sm text-text-secondary">Prix</span>
          <span className="text-sm font-bold text-primary">{slot.price.toFixed(2)}€</span>
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold text-text-secondary uppercase mb-2">Attribuer à un membre</p>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
          <input type="text" placeholder="Rechercher un membre..." value={newSearch} onChange={(e) => setNewSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-[10px] bg-white border border-separator text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" autoFocus />
        </div>
        {newResults.length > 0 && (
          <div className="space-y-1 mt-2 max-h-40 overflow-y-auto">
            {newResults.map((m) => (
              <button key={m.id} onClick={() => onCreateBooking(m)} disabled={creatingBooking}
                className="w-full flex items-center gap-2 p-2.5 rounded-[10px] hover:bg-bg text-left text-sm cursor-pointer">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-xs font-bold text-primary">{m.display_name.charAt(0).toUpperCase()}</span>
                </div>
                <div className="flex-1">
                  <p className="font-medium">{m.display_name}</p>
                  <p className="text-xs text-text-tertiary">{(parseFloat(m.balance||0)+parseFloat(m.balance_bonus||0)).toFixed(2)}€</p>
                </div>
                <UserPlus className="w-4 h-4 text-primary shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>

      <button onClick={onCreateExternal} disabled={creatingBooking}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-[10px] border-2 border-dashed border-separator hover:border-primary/30 hover:bg-primary/5 text-sm font-medium text-primary cursor-pointer">
        <UserPlus className="w-4 h-4" />Réserver pour un externe
      </button>
    </div>
  )
}
