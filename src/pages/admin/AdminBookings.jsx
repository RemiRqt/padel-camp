import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useClub } from '@/hooks/useClub'
import { generateSlots } from '@/utils/slots'
import PageWrapper from '@/components/layout/PageWrapper'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import { formatTime, toDateString } from '@/utils/formatDate'
import { cancelBooking } from '@/services/bookingService'
import toast from 'react-hot-toast'
import {
  CalendarDays, Trash2, MapPin, Clock, ChevronLeft, ChevronRight, Trophy, Star
} from 'lucide-react'

const COURTS = [
  { id: 'terrain_1', label: 'Terrain 1', short: 'T1' },
  { id: 'terrain_2', label: 'Terrain 2', short: 'T2' },
  { id: 'terrain_3', label: 'Terrain 3', short: 'T3' },
]

const PAY_BADGE = {
  paid: { color: 'success', label: 'Payé' },
  external: { color: 'primary', label: 'CB/Espèces' },
  pending: { color: 'warning', label: 'En attente' },
}

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
    async function fetchDayEvents() {
      const [tRes, eRes] = await Promise.all([
        supabase.from('tournaments').select('name, start_time, end_time').eq('date', dateStr).not('status', 'eq', 'cancelled'),
        supabase.from('events').select('name, start_time, end_time').eq('date', dateStr),
      ])
      setDayEvents([
        ...(tRes.data || []).map((t) => ({ ...t, type: 'tournament' })),
        ...(eRes.data || []).map((e) => ({ ...e, type: 'event' })),
      ])
    }
    fetchDayEvents()
  }, [dateStr])

  const getBlockingEvent = (slotStart, slotEnd) => {
    return dayEvents.find((ev) => {
      if (!ev.start_time || !ev.end_time) return true
      const evStart = ev.start_time.slice(0, 5)
      const evEnd = ev.end_time.slice(0, 5)
      return slotStart < evEnd && slotEnd > evStart
    })
  }

  const fetchBookings = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('bookings')
      .select('*, booking_players(*)')
      .eq('date', dateStr)
      .eq('status', 'confirmed')
      .order('start_time', { ascending: true })
    setBookings(data || [])
    setLoading(false)
  }

  useEffect(() => { fetchBookings() }, [dateStr])

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
      fetchBookings()
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
            <button
              onClick={() => changeDay(-1)}
              className="p-2 rounded-[10px] hover:bg-bg transition-colors cursor-pointer"
            >
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
              type="date"
              value={dateStr}
              onChange={(e) => setSelectedDate(new Date(e.target.value + 'T00:00'))}
              className="px-3 py-2 rounded-[10px] bg-bg text-sm font-medium text-text border-0 focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
            />

            <button
              onClick={() => changeDay(1)}
              className="p-2 rounded-[10px] hover:bg-bg transition-colors cursor-pointer"
            >
              <ChevronRight className="w-5 h-5 text-text-secondary" />
            </button>
          </div>
        </div>

        {/* Day label */}
        <p className="text-sm text-text-secondary capitalize">{dayLabel}</p>

        {/* Grid: Horaires x 3 Terrains */}
        <Card className="!p-0 overflow-hidden">
          {/* Header row */}
          <div className="grid grid-cols-[80px_1fr_1fr_1fr] lg:grid-cols-[100px_1fr_1fr_1fr] border-b border-separator bg-bg/50">
            <div className="p-3 text-xs font-semibold text-text-tertiary uppercase text-center">Horaire</div>
            {COURTS.map((court) => (
              <div key={court.id} className="p-3 text-center text-xs font-semibold text-text-secondary uppercase border-l border-separator">
                <span className="hidden sm:inline">{court.label}</span>
                <span className="sm:hidden">{court.short}</span>
              </div>
            ))}
          </div>

          {/* Slot rows */}
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
                {/* Time */}
                <div className="p-2 flex flex-col items-center justify-center bg-bg/30">
                  <span className="text-xs font-semibold text-text">{formatTime(slot.start)}</span>
                  <span className="text-[10px] text-text-tertiary">{formatTime(slot.end)}</span>
                </div>

                {/* 3 courts */}
                {COURTS.map((court) => {
                  const booking = getBookingFor(court.id, slot.start)
                  const blocking = getBlockingEvent(slot.start, slot.end)

                  if (blocking && !booking) {
                    return (
                      <div key={court.id} className="p-1.5 border-l border-separator">
                        <div className="h-full min-h-[56px] rounded-[10px] bg-primary/10 flex items-center justify-center gap-1 px-2">
                          {blocking.type === 'tournament' ? <Trophy className="w-3.5 h-3.5 text-primary shrink-0" /> : <Star className="w-3.5 h-3.5 text-lime-dark shrink-0" />}
                          <span className="text-[10px] font-medium text-primary truncate">{blocking.name}</span>
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

      {/* Detail modal */}
      <Modal
        isOpen={detailOpen}
        onClose={() => setDetailOpen(false)}
        title="Détail réservation"
      >
        {selected && (
          <div className="space-y-4">
            <div className="rounded-[14px] bg-bg p-4 space-y-2.5">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">
                  {COURTS.find((c) => c.id === selected.court_id)?.label || selected.court_id}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" />
                <span className="text-sm">
                  {new Date(selected.date + 'T00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                  {' · '}{formatTime(selected.start_time)} – {formatTime(selected.end_time)}
                </span>
              </div>
              <div className="flex justify-between pt-1 border-t border-separator">
                <span className="text-sm text-text-secondary">Réservé par</span>
                <span className="text-sm font-semibold">{selected.user_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-text-secondary">Prix total</span>
                <span className="text-sm font-bold text-primary">{parseFloat(selected.price).toFixed(2)}€</span>
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
            {players.length > 0 && (() => {
              const paidAmount = players.reduce((s, p) => s + (p.payment_status === 'paid' || p.payment_status === 'external' ? parseFloat(p.amount) : 0), 0)
              const totalAmount = parseFloat(selected.price)
              const remaining = totalAmount - paidAmount
              return (
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
              )
            })()}

            {selected.status === 'confirmed' && (
              <Button variant="danger" className="w-full" loading={cancelling} onClick={handleAdminCancel}>
                <Trash2 className="w-4 h-4 mr-1" />
                Annuler (admin)
              </Button>
            )}
          </div>
        )}
      </Modal>
    </PageWrapper>
  )
}
