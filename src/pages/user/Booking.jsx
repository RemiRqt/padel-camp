import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useClub } from '@/hooks/useClub'
import { useBookings } from '@/hooks/useBookings'
import { generateSlots, isSlotBooked, isSlotPast } from '@/utils/slots'
import { getSlotPrice } from '@/utils/calculatePrice'
import { formatTime, toDateString, addDays, getDayIndex, DAYS_SHORT, isSameDay, isToday } from '@/utils/formatDate'
import { createBooking, partPrice, fetchDayBlockingEvents } from '@/services/bookingService'
import PageWrapper from '@/components/layout/PageWrapper'
import Card from '@/components/ui/Card'
import ErrorState from '@/components/ui/ErrorState'
import BookingConfirmModal from '@/components/features/booking/BookingConfirmModal'
import toast from 'react-hot-toast'
import { Trophy, Star } from 'lucide-react'

const COURTS = [
  { id: 'terrain_1', name: 'Terrain 1', short: 'T1' },
  { id: 'terrain_2', name: 'Terrain 2', short: 'T2' },
  { id: 'terrain_3', name: 'Terrain 3', short: 'T3' },
]

export default function Booking() {
  const { user, profile } = useAuth()
  const { config, pricingRules, loading: clubLoading } = useClub()
  const [selectedDate, setSelectedDate] = useState(new Date())
  const { bookings, loading: bookingsLoading, error: bookingsError, refetch } = useBookings(selectedDate)
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [payChoice, setPayChoice] = useState('my_part')

  const navigate = useNavigate()

  // Fetch tournaments & events for the selected date to block courts
  const [dayEvents, setDayEvents] = useState([])
  useEffect(() => {
    const dateStr = toDateString(selectedDate)
    fetchDayBlockingEvents(dateStr).then(setDayEvents).catch(() => setDayEvents([]))
  }, [selectedDate])

  // Check if a slot is blocked by a tournament/event
  const getBlockingEvent = (slotStart, slotEnd) => {
    return dayEvents.find((ev) => {
      if (!ev.start_time || !ev.end_time) return true // full day event
      const evStart = ev.start_time.slice(0, 5)
      const evEnd = ev.end_time.slice(0, 5)
      return slotStart < evEnd && slotEnd > evStart
    })
  }

  const days = useMemo(() => {
    const today = new Date()
    return Array.from({ length: 30 }, (_, i) => addDays(today, i))
  }, [])

  const slots = useMemo(() => generateSlots(config), [config])

  const dayIndex = getDayIndex(selectedDate)
  const isOpenDay = config?.open_days?.includes(dayIndex) ?? true

  const handleSlotClick = (courtId, slot) => {
    if (isSlotBooked(bookings, courtId, slot.start)) return
    if (isSlotPast(selectedDate, slot.start)) return
    if (getBlockingEvent(slot.start, slot.end)) return
    const price = getSlotPrice(pricingRules, selectedDate, slot.start)
    setSelectedSlot({ courtId, start: slot.start, end: slot.end, price })
    setPayChoice('my_part')
    setConfirmOpen(true)
  }

  const totalBalance = parseFloat(profile?.balance || 0) + parseFloat(profile?.balance_bonus || 0)
  const myShare = selectedSlot ? partPrice(selectedSlot.price) : 0
  const canPayPart = totalBalance >= myShare
  const canPayFull = selectedSlot ? totalBalance >= selectedSlot.price : false

  const handleConfirm = async () => {
    if (!selectedSlot || !user || !profile) return
    setCreating(true)
    try {
      let effectivePayNow = payChoice
      if (payChoice === 'my_part' && !canPayPart) effectivePayNow = 'none'
      if (payChoice === 'full' && !canPayFull) effectivePayNow = 'none'

      const booking = await createBooking({
        userId: user.id,
        userName: profile.display_name,
        courtId: selectedSlot.courtId,
        date: toDateString(selectedDate),
        startTime: selectedSlot.start,
        endTime: selectedSlot.end,
        price: selectedSlot.price,
        payNow: effectivePayNow,
      })
      const msgs = { my_part: 'Réservation confirmée, votre part est payée !', full: 'Réservation confirmée et payée intégralement !', none: 'Réservation confirmée ! Paiement en attente.' }
      toast.success(msgs[effectivePayNow])
      setConfirmOpen(false)
      setSelectedSlot(null)
      navigate(`/booking/${booking.id}`)
    } catch (err) {
      toast.error(err.message || 'Erreur lors de la réservation')
    } finally {
      setCreating(false)
    }
  }

  if (clubLoading) {
    return (
      <PageWrapper title="Réserver un terrain">
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-20 rounded-[16px] bg-white animate-pulse" />)}
        </div>
      </PageWrapper>
    )
  }

  return (
    <PageWrapper title="Réserver un terrain">
      <div className="space-y-4">
        {/* Date picker */}
        <Card className="!p-3">
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {days.map((day) => {
              const active = isSameDay(day, selectedDate)
              return (
                <button
                  key={toDateString(day)}
                  onClick={() => setSelectedDate(day)}
                  className={`flex flex-col items-center min-w-[52px] py-2 px-2 rounded-[12px] transition-all cursor-pointer ${
                    active
                      ? 'bg-primary text-white shadow-[0_4px_12px_rgba(11,39,120,0.3)]'
                      : 'hover:bg-bg text-text'
                  }`}
                >
                  <span className={`text-[10px] font-medium uppercase ${active ? 'text-white/60' : 'text-text-tertiary'}`}>
                    {DAYS_SHORT[getDayIndex(day)]}
                  </span>
                  <span className="text-lg font-bold leading-tight">{day.getDate()}</span>
                  {isToday(day) && (
                    <div className={`w-1.5 h-1.5 rounded-full mt-0.5 ${active ? 'bg-lime' : 'bg-primary'}`} />
                  )}
                </button>
              )
            })}
          </div>
        </Card>

        {!isOpenDay ? (
          <Card className="text-center !py-8">
            <p className="text-sm text-text-secondary">Le club est fermé ce jour</p>
          </Card>
        ) : (
          <>
            {/* Grille 3 terrains */}
            <Card className="!p-0 overflow-hidden">
              {/* Header */}
              <div className="grid grid-cols-[56px_1fr_1fr_1fr] border-b border-separator">
                <div className="p-2 text-[10px] font-semibold text-text-tertiary uppercase text-center">Heure</div>
                {COURTS.map((court) => (
                  <div key={court.id} className="p-2 text-center text-[10px] font-semibold text-text-secondary uppercase">
                    {court.short}
                  </div>
                ))}
              </div>

              {/* Rows */}
              {bookingsError ? (
                <div className="py-6"><ErrorState message="Impossible de charger les créneaux" onRetry={refetch} /></div>
              ) : bookingsLoading ? (
                Array.from({ length: 6 }, (_, i) => (
                  <div key={i} className="grid grid-cols-[56px_1fr_1fr_1fr] border-b border-separator last:border-0">
                    {[0, 1, 2, 3].map((j) => (
                      <div key={j} className="p-1"><div className="h-11 rounded-lg bg-bg animate-pulse" /></div>
                    ))}
                  </div>
                ))
              ) : (
                slots.map((slot) => {
                  const price = getSlotPrice(pricingRules, selectedDate, slot.start)
                  const past = isSlotPast(selectedDate, slot.start)

                  return (
                    <div key={slot.start} className="grid grid-cols-[56px_1fr_1fr_1fr] border-b border-separator last:border-0">
                      {/* Time */}
                      <div className="p-1 flex flex-col items-center justify-center">
                        <span className="text-[11px] font-semibold text-text leading-none">{formatTime(slot.start)}</span>
                        <span className="text-[9px] text-text-tertiary leading-none mt-0.5">{formatTime(slot.end)}</span>
                      </div>

                      {/* 3 courts */}
                      {COURTS.map((court) => {
                        const booked = isSlotBooked(bookings, court.id, slot.start)
                        const blocking = getBlockingEvent(slot.start, slot.end)
                        const disabled = booked || past || !!blocking

                        return (
                          <div key={court.id} className="p-1">
                            <button
                              onClick={() => !disabled && handleSlotClick(court.id, slot)}
                              disabled={disabled}
                              className={`w-full h-11 rounded-lg flex items-center justify-center transition-all text-xs font-semibold ${
                                blocking
                                  ? 'bg-primary/10 text-primary cursor-not-allowed'
                                  : booked
                                    ? 'bg-red-50 text-red-400 cursor-not-allowed'
                                    : past
                                      ? 'bg-bg text-text-tertiary cursor-not-allowed'
                                      : 'bg-green-50 text-green-700 hover:bg-green-100 cursor-pointer active:scale-95'
                              }`}
                              title={blocking ? blocking.name : ''}
                            >
                              {blocking ? (
                                <span className="flex items-center gap-0.5 truncate px-1">
                                  {blocking.type === 'tournament' ? <Trophy className="w-3 h-3 shrink-0" /> : <Star className="w-3 h-3 shrink-0" />}
                                  <span className="truncate">
                                    {blocking.type === 'tournament' && blocking.level
                                      ? `${blocking.level} ${blocking.category === 'hommes' ? 'H' : blocking.category === 'femmes' ? 'F' : 'M'}`
                                      : blocking.name}
                                  </span>
                                </span>
                              ) : booked ? 'Complet' : past ? '—' : price != null ? `${price.toFixed(0)}€` : '—'}
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  )
                })
              )}
            </Card>

            {/* Légende */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-1">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-green-50 border border-green-200" />
                <span className="text-xs text-text-secondary">Disponible</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-red-50 border border-red-200" />
                <span className="text-xs text-text-secondary">Complet</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-primary/10 border border-primary/20" />
                <span className="text-xs text-text-secondary">Tournoi / Événement</span>
              </div>
              <span className="text-xs text-text-tertiary">Prix = créneau 1h30</span>
            </div>
          </>
        )}
      </div>

      <BookingConfirmModal
        isOpen={confirmOpen}
        onClose={() => { setConfirmOpen(false); setSelectedSlot(null) }}
        selectedSlot={selectedSlot}
        selectedDate={selectedDate}
        pricingRules={pricingRules}
        totalBalance={totalBalance}
        payChoice={payChoice}
        setPayChoice={setPayChoice}
        creating={creating}
        onConfirm={handleConfirm}
      />
    </PageWrapper>
  )
}
