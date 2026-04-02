import { useEffect, useState, useMemo } from 'react'
import { useClub } from '@/hooks/useClub'
import { generateSlots } from '@/utils/slots'
import PageWrapper from '@/components/layout/PageWrapper'
import Card from '@/components/ui/Card'
import { formatTime, toDateString } from '@/utils/formatDate'
import { cancelBooking, fetchAdminDayBookings, fetchDayBlockingEvents } from '@/services/bookingService'
import BookingDetailModal from '@/components/admin/bookings/BookingDetailModal'
import toast from 'react-hot-toast'
import {
  CalendarDays, ChevronLeft, ChevronRight, Trophy, Star
} from 'lucide-react'

const COURTS = [
  { id: 'terrain_1', label: 'Terrain 1', short: 'T1' },
  { id: 'terrain_2', label: 'Terrain 2', short: 'T2' },
  { id: 'terrain_3', label: 'Terrain 3', short: 'T3' },
]

export default function AdminBookings() {
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [detailOpen, setDetailOpen] = useState(false)
  const [selected, setSelected] = useState(null)
  const [players, setPlayers] = useState([])
  const [cancelling, setCancelling] = useState(false)
  const { config } = useClub()

  const dateStr = toDateString(selectedDate)
  const slots = useMemo(() => generateSlots(config), [config])
  const [dayEvents, setDayEvents] = useState([])

  useEffect(() => {
    fetchDayBlockingEvents(dateStr).then(setDayEvents).catch(() => setDayEvents([]))
  }, [dateStr])

  const getBlockingEvent = (slotStart, slotEnd) => {
    return dayEvents.find((ev) => {
      if (!ev.start_time || !ev.end_time) return true
      const evStart = ev.start_time.slice(0, 5)
      const evEnd = ev.end_time.slice(0, 5)
      return slotStart < evEnd && slotEnd > evStart
    })
  }

  const fetchBookingsData = async () => {
    setLoading(true)
    const data = await fetchAdminDayBookings(dateStr)
    setBookings(data)
    setLoading(false)
  }

  useEffect(() => { fetchBookingsData() }, [dateStr])

  const getBookingFor = (courtId, startTime) => {
    return bookings.find(
      (b) => b.court_id === courtId && b.start_time.slice(0, 5) === startTime.slice(0, 5)
    )
  }

  const openDetail = (b) => {
    setSelected(b)
    setPlayers(b.booking_players || [])
    setDetailOpen(true)
  }

  const handleAdminCancel = async () => {
    if (!selected) return
    setCancelling(true)
    try {
      await cancelBooking(selected.id, 'admin')
      toast.success('Réservation annulée')
      setDetailOpen(false)
      fetchBookingsData()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setCancelling(false)
    }
  }

  const changeDay = (offset) => {
    const d = new Date(selectedDate)
    d.setDate(d.getDate() + offset)
    setSelectedDate(d)
  }

  const dayLabel = selectedDate.toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  const isToday = toDateString(selectedDate) === toDateString(new Date())

  return (
    <PageWrapper wide>
      <div className="space-y-4">
        {/* Header with day selector */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-primary" />
            <h1 className="text-2xl font-bold text-text">Réservations</h1>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => changeDay(-1)} className="p-2 rounded-[10px] hover:bg-bg transition-colors cursor-pointer">
              <ChevronLeft className="w-5 h-5 text-text-secondary" />
            </button>
            <button
              onClick={() => setSelectedDate(new Date())}
              className={`px-4 py-2 rounded-[10px] text-sm font-medium transition-all cursor-pointer ${
                isToday ? 'bg-primary text-white' : 'bg-bg hover:bg-primary/5 text-text'
              }`}
            >
              Aujourd'hui
            </button>
            <input
              type="date" value={dateStr}
              onChange={(e) => setSelectedDate(new Date(e.target.value + 'T00:00'))}
              className="px-3 py-2 rounded-[10px] bg-bg text-sm font-medium text-text border-0 focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
            />
            <button onClick={() => changeDay(1)} className="p-2 rounded-[10px] hover:bg-bg transition-colors cursor-pointer">
              <ChevronRight className="w-5 h-5 text-text-secondary" />
            </button>
          </div>
        </div>

        <p className="text-sm text-text-secondary capitalize">{dayLabel}</p>

        {/* Grid: Horaires x 3 Terrains */}
        <Card className="!p-0 overflow-hidden">
          <div className="grid grid-cols-[80px_1fr_1fr_1fr] lg:grid-cols-[100px_1fr_1fr_1fr] border-b border-separator bg-bg/50">
            <div className="p-3 text-xs font-semibold text-text-tertiary uppercase text-center">Horaire</div>
            {COURTS.map((court) => (
              <div key={court.id} className="p-3 text-center text-xs font-semibold text-text-secondary uppercase border-l border-separator">
                <span className="hidden sm:inline">{court.label}</span>
                <span className="sm:hidden">{court.short}</span>
              </div>
            ))}
          </div>

          {loading ? (
            Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="grid grid-cols-[80px_1fr_1fr_1fr] lg:grid-cols-[100px_1fr_1fr_1fr] border-b border-separator last:border-0">
                {[0, 1, 2, 3].map((j) => (
                  <div key={j} className="p-2"><div className="h-14 rounded-[10px] bg-bg animate-pulse" /></div>
                ))}
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

                  if (!booking) {
                    return (
                      <div key={court.id} className="p-1.5 border-l border-separator">
                        <div className="h-full min-h-[56px] rounded-[10px] bg-green-50/50 flex items-center justify-center">
                          <span className="text-xs text-green-400">Libre</span>
                        </div>
                      </div>
                    )
                  }

                  const bp = booking.booking_players || []
                  const filled = bp.filter((p) => p.player_name !== 'Place disponible').length
                  const paid = bp.filter((p) => p.payment_status === 'paid' || p.payment_status === 'external').length

                  return (
                    <div key={court.id} className="p-1.5 border-l border-separator">
                      <button
                        onClick={() => openDetail(booking)}
                        className="w-full h-full min-h-[56px] rounded-[10px] bg-primary/5 hover:bg-primary/10 transition-colors p-2 text-left cursor-pointer"
                      >
                        <p className="text-xs font-semibold text-text truncate">{booking.user_name}</p>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-[10px] text-text-secondary">{filled}/4 joueurs</span>
                          <span className={`text-[10px] font-medium ${
                            paid === bp.length ? 'text-success' : paid > 0 ? 'text-warning' : 'text-text-tertiary'
                          }`}>
                            {paid}/{bp.length} payés
                          </span>
                        </div>
                        <p className="text-[10px] font-semibold text-primary mt-0.5">{parseFloat(booking.price).toFixed(0)}€</p>
                      </button>
                    </div>
                  )
                })}
              </div>
            ))
          )}
        </Card>

        {/* Legend */}
        <div className="flex items-center gap-4 px-1">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-green-50 border border-green-200" />
            <span className="text-xs text-text-secondary">Libre</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-primary/5 border border-primary/10" />
            <span className="text-xs text-text-secondary">Réservé</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-primary/10 border border-primary/20" />
            <span className="text-xs text-text-secondary">Tournoi / Événement</span>
          </div>
          <span className="text-xs text-text-tertiary">
            {bookings.length} réservation{bookings.length !== 1 ? 's' : ''} ce jour
          </span>
        </div>
      </div>

      <BookingDetailModal
        isOpen={detailOpen}
        onClose={() => setDetailOpen(false)}
        booking={selected}
        players={players}
        cancelling={cancelling}
        onCancel={handleAdminCancel}
      />
    </PageWrapper>
  )
}
