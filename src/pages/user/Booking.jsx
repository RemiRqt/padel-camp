import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useClub } from '@/hooks/useClub'
import { useBookings } from '@/hooks/useBookings'
import { supabase } from '@/lib/supabase'
import { generateSlots, isSlotBooked, isSlotPast } from '@/utils/slots'
import { getSlotPrice, findPricingRule } from '@/utils/calculatePrice'
import { formatTime, toDateString, addDays, getDayIndex, DAYS_SHORT, isSameDay, isToday } from '@/utils/formatDate'
import { createBooking, partPrice } from '@/services/bookingService'
import PageWrapper from '@/components/layout/PageWrapper'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import toast from 'react-hot-toast'
import { Check, Trophy, Star } from 'lucide-react'

const COURTS = [
  { id: 'terrain_1', name: 'Terrain 1', short: 'T1' },
  { id: 'terrain_2', name: 'Terrain 2', short: 'T2' },
  { id: 'terrain_3', name: 'Terrain 3', short: 'T3' },
]

export default function Booking() {
  const { user, profile } = useAuth()
  const { config, pricingRules, loading: clubLoading } = useClub()
  const [selectedDate, setSelectedDate] = useState(new Date())
  const { bookings, loading: bookingsLoading } = useBookings(selectedDate)
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [payChoice, setPayChoice] = useState('my_part')

  const navigate = useNavigate()

  // Fetch tournaments & events for the selected date to block courts
  const [dayEvents, setDayEvents] = useState([])
  useEffect(() => {
    const dateStr = toDateString(selectedDate)
    async function fetchDayEvents() {
      const [tRes, eRes] = await Promise.all([
        supabase.from('tournaments').select('name, start_time, end_time, level, category').eq('date', dateStr).not('status', 'eq', 'cancelled'),
        supabase.from('events').select('name, start_time, end_time').eq('date', dateStr),
      ])
      setDayEvents([
        ...(tRes.data || []).map((t) => ({ ...t, type: 'tournament' })),
        ...(eRes.data || []).map((e) => ({ ...e, type: 'event' })),
      ])
    }
    fetchDayEvents()
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

  const courtName = (courtId) => COURTS.find((c) => c.id === courtId)?.name || courtId

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
              {bookingsLoading ? (
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
                              ) : booked ? 'Complet' : past ? '—' : `${price.toFixed(0)}€`}
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

      {/* Confirmation modal */}
      <Modal
        isOpen={confirmOpen}
        onClose={() => { setConfirmOpen(false); setSelectedSlot(null) }}
        title="Confirmer la réservation"
      >
        {selectedSlot && (
          <div className="space-y-4">
            {/* Recap */}
            <div className="rounded-[14px] bg-bg p-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-text-secondary">Terrain</span>
                <span className="text-sm font-semibold">{courtName(selectedSlot.courtId)}</span>
              </div>
              <div className="border-t border-separator" />
              <div className="flex justify-between">
                <span className="text-sm text-text-secondary">Date</span>
                <span className="text-sm font-semibold">
                  {selectedDate.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                </span>
              </div>
              <div className="border-t border-separator" />
              <div className="flex justify-between">
                <span className="text-sm text-text-secondary">Horaire</span>
                <span className="text-sm font-semibold">
                  {formatTime(selectedSlot.start)} – {formatTime(selectedSlot.end)}
                </span>
              </div>
              <div className="border-t border-separator" />
              <div className="flex justify-between">
                <span className="text-sm text-text-secondary">Tarif</span>
                <span className="text-sm font-semibold">
                  {findPricingRule(pricingRules, selectedDate, selectedSlot.start)?.label || '—'}
                </span>
              </div>
            </div>

            {/* Price */}
            <div className="bg-primary/5 rounded-[14px] p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-text">Total session</span>
                <span className="text-2xl font-bold text-primary">{selectedSlot.price.toFixed(2)}€</span>
              </div>
              <p className="text-xs text-text-secondary text-right">
                {myShare.toFixed(2)}€ / joueur (4 joueurs)
              </p>
            </div>

            {/* Payment choice */}
            <div className="rounded-[14px] border border-separator p-4 space-y-3">
              <p className="text-sm font-medium text-text">Paiement</p>
              <div className="space-y-2">
                {[
                  { value: 'my_part', label: `Payer ma part (${myShare.toFixed(2)}€)`, ok: canPayPart },
                  { value: 'full', label: `Payer la totalité (${selectedSlot.price.toFixed(2)}€)`, ok: canPayFull },
                  { value: 'none', label: 'Payer plus tard', ok: true },
                ].map(({ value, label, ok }) => (
                  <button
                    key={value}
                    onClick={() => setPayChoice(value)}
                    className={`w-full flex items-center gap-3 p-3 rounded-[10px] text-left transition-all cursor-pointer ${
                      payChoice === value
                        ? 'bg-primary text-white'
                        : 'bg-bg text-text hover:bg-primary/5'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                      payChoice === value ? 'border-white' : 'border-text-tertiary'
                    }`}>
                      {payChoice === value && <div className="w-2 h-2 rounded-full bg-white" />}
                    </div>
                    <span className="text-sm font-medium">{label}</span>
                    {!ok && value !== 'none' && (
                      <span className={`text-[10px] ml-auto ${payChoice === value ? 'text-white/60' : 'text-danger'}`}>Solde insuffisant</span>
                    )}
                  </button>
                ))}
              </div>
              <p className="text-xs text-text-tertiary">
                Votre solde : <strong>{totalBalance.toFixed(2)}€</strong> · Bonus utilisé en priorité
              </p>
            </div>

            <p className="text-xs text-text-tertiary text-center">
              3 places seront disponibles pour inviter d'autres joueurs.
            </p>

            <div className="flex gap-3">
              <Button
                variant="ghost"
                className="flex-1"
                onClick={() => { setConfirmOpen(false); setSelectedSlot(null) }}
              >
                Annuler
              </Button>
              <Button
                className="flex-1"
                loading={creating}
                onClick={handleConfirm}
              >
                <Check className="w-4 h-4 mr-1" />
                {payChoice === 'full' && canPayFull ? 'Réserver et tout payer'
                  : payChoice === 'my_part' && canPayPart ? `Réserver et payer ${myShare.toFixed(2)}€`
                  : 'Réserver'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </PageWrapper>
  )
}
