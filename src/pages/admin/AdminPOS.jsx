import { useEffect, useState, useMemo, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useClub } from '@/hooks/useClub'
import { toDateString, formatTime } from '@/utils/formatDate'
import { generateSlots } from '@/utils/slots'
import { getSlotPrice } from '@/utils/calculatePrice'
import {
  payPlayerShare, markPlayerExternal, searchMembers, createBooking
} from '@/services/bookingService'
import PageWrapper from '@/components/layout/PageWrapper'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import ExportButtons from '@/components/ui/ExportButtons'
import { exportExcel, exportPDF } from '@/utils/export'
import toast from 'react-hot-toast'
import {
  ShoppingCart, Search, UserPlus, Wallet, CreditCard, Banknote,
  Package, Users, Minus, Plus, Lock, CalendarDays, ChevronLeft,
  ChevronRight, Trophy, Star, Trash2, MapPin, Clock
} from 'lucide-react'

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
  const { user: admin, profile: adminProfile } = useAuth()
  const { config, pricingRules } = useClub()

  const [tab, setTab] = useState('sessions')
  const [selectedDate, setSelectedDate] = useState(new Date())
  const dateStr = toDateString(selectedDate)
  const slots = useMemo(() => generateSlots(config), [config])

  // Bookings for selected day
  const [bookings, setBookings] = useState([])
  const [bLoading, setBLoading] = useState(true)
  const [dayEvents, setDayEvents] = useState([])

  // Session modal
  const [sessionModal, setSessionModal] = useState(false)
  const [selectedBooking, setSelectedBooking] = useState(null)
  const [sessionPlayers, setSessionPlayers] = useState([])
  const [sessionLoading, setSessionLoading] = useState(false)
  const [memberSearch, setMemberSearch] = useState('')
  const [memberResults, setMemberResults] = useState([])
  const [submitting, setSubmitting] = useState(false)

  // New booking modal (for empty slots)
  const [newBookingModal, setNewBookingModal] = useState(false)
  const [newSlot, setNewSlot] = useState(null)
  const [newSearch, setNewSearch] = useState('')
  const [newResults, setNewResults] = useState([])
  const [creatingBooking, setCreatingBooking] = useState(false)

  // Products
  const [categories, setCategories] = useState([])
  const [products, setProducts] = useState([])
  const [activeCat, setActiveCat] = useState(null)
  const [cart, setCart] = useState([])
  const [saleModal, setSaleModal] = useState(false)
  const [saleSearch, setSaleSearch] = useState('')
  const [saleResults, setSaleResults] = useState([])
  const [selectedBuyer, setSelectedBuyer] = useState(null)
  const [salePayment, setSalePayment] = useState('balance')

  // Sales history — linked to selected day
  const [salesToday, setSalesToday] = useState([])
  const [showAllSales, setShowAllSales] = useState(false)

  // Fetch bookings for selected day
  const fetchBookings = useCallback(async () => {
    setBLoading(true)
    const { data } = await supabase
      .from('bookings')
      .select('*, booking_players(*)')
      .eq('date', dateStr)
      .eq('status', 'confirmed')
      .order('start_time')
    setBookings(data || [])
    setBLoading(false)
  }, [dateStr])

  // Fetch day events/tournaments
  useEffect(() => {
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
  }, [dateStr])

  useEffect(() => { fetchBookings() }, [fetchBookings])

  const getBlockingEvent = (slotStart, slotEnd) => {
    return dayEvents.find((ev) => {
      if (!ev.start_time || !ev.end_time) return true
      return slotStart < ev.end_time.slice(0, 5) && slotEnd > ev.start_time.slice(0, 5)
    })
  }

  const getBookingFor = (courtId, startTime) => {
    return bookings.find((b) => b.court_id === courtId && b.start_time.slice(0, 5) === startTime.slice(0, 5))
  }

  // Products fetch
  useEffect(() => {
    async function fetchProducts() {
      const [cRes, pRes] = await Promise.all([
        supabase.from('product_categories').select('*').eq('is_active', true).order('sort_order'),
        supabase.from('products').select('*, category:product_categories(name)').eq('is_active', true).order('name'),
      ])
      setCategories(cRes.data || [])
      setProducts(pRes.data || [])
      if (cRes.data?.[0]) setActiveCat(cRes.data[0].id)
    }
    fetchProducts()
  }, [])

  // Sales history — linked to selected day
  useEffect(() => {
    async function fetchSales() {
      const { data } = await supabase
        .from('transactions').select('*')
        .in('type', ['debit_product', 'debit_session', 'external_payment'])
        .gte('created_at', dateStr + 'T00:00:00').lte('created_at', dateStr + 'T23:59:59')
        .order('created_at', { ascending: false }).limit(100)
      setSalesToday(data || [])
      setShowAllSales(false)
    }
    fetchSales()
  }, [dateStr, submitting])

  // Member search for session
  useEffect(() => {
    if (memberSearch.length < 2) { setMemberResults([]); return }
    const t = setTimeout(async () => { setMemberResults(await searchMembers(memberSearch)) }, 300)
    return () => clearTimeout(t)
  }, [memberSearch])

  // Member search for new booking
  useEffect(() => {
    if (newSearch.length < 2) { setNewResults([]); return }
    const t = setTimeout(async () => { setNewResults(await searchMembers(newSearch)) }, 300)
    return () => clearTimeout(t)
  }, [newSearch])

  // Member search for sale
  useEffect(() => {
    if (saleSearch.length < 2) { setSaleResults([]); return }
    const t = setTimeout(async () => { setSaleResults(await searchMembers(saleSearch)) }, 300)
    return () => clearTimeout(t)
  }, [saleSearch])

  // Day navigation
  const changeDay = (offset) => {
    const d = new Date(selectedDate)
    d.setDate(d.getDate() + offset)
    setSelectedDate(d)
  }
  const isToday = dateStr === toDateString(new Date())
  const dayLabel = selectedDate.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })

  // ===== SESSION MANAGEMENT =====
  const openSession = async (booking) => {
    setSelectedBooking(booking)
    setSessionPlayers(booking.booking_players || [])
    setSessionLoading(false)
    setMemberSearch('')
    setMemberResults([])
    setSessionModal(true)
  }

  const refreshSession = async () => {
    if (!selectedBooking) return
    const { data } = await supabase.from('booking_players').select('*').eq('booking_id', selectedBooking.id).order('created_at')
    setSessionPlayers(data || [])
    const { data: bk } = await supabase.from('bookings').select('*').eq('id', selectedBooking.id).single()
    if (bk) setSelectedBooking(bk)
    fetchBookings()
  }

  const handlePayBalance = async (player) => {
    if (!admin) return
    setSubmitting(true)
    try {
      await payPlayerShare({ playerId: player.id, bookingId: selectedBooking.id, userId: player.user_id, amount: parseFloat(player.amount), performedBy: admin.id })
      toast.success(`${player.player_name} — solde débité`)
      await refreshSession()
    } catch (err) { toast.error(err.message) }
    finally { setSubmitting(false) }
  }

  const handlePayExternal = async (player, method) => {
    if (!admin) return
    setSubmitting(true)
    try {
      await markPlayerExternal({ playerId: player.id, bookingId: selectedBooking.id, paymentMethod: method, amount: parseFloat(player.amount), playerName: player.player_name, performedBy: admin.id })
      toast.success(`${player.player_name} — ${method} enregistré`)
      await refreshSession()
    } catch (err) { toast.error(err.message) }
    finally { setSubmitting(false) }
  }

  const handleAddPlayer = async (member) => {
    if (!selectedBooking) return
    const realPlayers = sessionPlayers.filter((p) => p.player_name !== 'Place disponible')
    if (realPlayers.length >= 4) { toast.error('Maximum 4 joueurs'); return }
    setSubmitting(true)
    try {
      const isString = typeof member === 'string'
      const defaultAmount = Math.round((parseFloat(selectedBooking.price) / 4) * 100) / 100
      const emptySlot = sessionPlayers.find((p) => p.player_name === 'Place disponible')
      if (emptySlot) {
        await supabase.from('booking_players').update({
          user_id: isString ? null : member.id,
          player_name: isString ? member : member.display_name,
          payment_method: isString ? 'cb' : 'balance',
          amount: defaultAmount, payment_status: 'pending',
        }).eq('id', emptySlot.id)
      } else {
        await supabase.from('booking_players').insert({
          booking_id: selectedBooking.id, user_id: isString ? null : member.id,
          player_name: isString ? member : member.display_name,
          parts: 1, payment_method: isString ? 'cb' : 'balance',
          amount: defaultAmount, payment_status: 'pending',
        })
      }
      toast.success('Joueur ajouté')
      setMemberSearch(''); setMemberResults([])
      await refreshSession()
    } catch (err) { toast.error(err.message) }
    finally { setSubmitting(false) }
  }

  const handleAddExternal = () => {
    const externalCount = sessionPlayers.filter((p) => p.player_name !== 'Place disponible' && !p.user_id).length
    handleAddPlayer(`Joueur externe ${externalCount + 1}`)
  }

  const handleUpdateAmount = async (playerId, newAmount) => {
    const val = parseFloat(newAmount)
    if (isNaN(val) || val < 0) return
    await supabase.from('booking_players').update({ amount: val }).eq('id', playerId)
    await refreshSession()
  }

  const handleRemovePlayer = async (player) => {
    if (!confirm(`Retirer ${player.player_name} ?`)) return
    setSubmitting(true)
    try {
      const share = Math.round((parseFloat(selectedBooking.price) / 4) * 100) / 100
      await supabase.from('booking_players').update({
        user_id: null, player_name: 'Place disponible', parts: 1,
        payment_method: 'balance', payment_status: 'pending', amount: share,
      }).eq('id', player.id)
      toast.success('Joueur retiré')
      await refreshSession()
    } catch (err) { toast.error(err.message) }
    finally { setSubmitting(false) }
  }

  const handleCancelBooking = async () => {
    if (!selectedBooking || !confirm('Annuler cette session ?')) return
    setSubmitting(true)
    try {
      await supabase.from('bookings').update({ status: 'cancelled', cancelled_by: 'admin' }).eq('id', selectedBooking.id)
      toast.success('Session annulée')
      setSessionModal(false)
      fetchBookings()
    } catch (err) { toast.error(err.message) }
    finally { setSubmitting(false) }
  }

  // ===== NEW BOOKING (empty slot) =====
  const openNewBooking = (courtId, slot) => {
    const price = getSlotPrice(pricingRules, selectedDate, slot.start)
    setNewSlot({ courtId, start: slot.start, end: slot.end, price })
    setNewSearch('')
    setNewResults([])
    setNewBookingModal(true)
  }

  const handleCreateBooking = async (member) => {
    if (!newSlot || !admin) return
    setCreatingBooking(true)
    try {
      const isString = typeof member === 'string'
      const booking = await createBooking({
        userId: isString ? admin.id : member.id,
        userName: isString ? member : member.display_name,
        courtId: newSlot.courtId,
        date: dateStr,
        startTime: newSlot.start,
        endTime: newSlot.end,
        price: newSlot.price,
        payNow: 'none',
      })
      toast.success('Session créée')
      setNewBookingModal(false)
      await fetchBookings()
      // Open session modal immediately
      const { data } = await supabase.from('bookings').select('*, booking_players(*)').eq('id', booking.id).single()
      if (data) openSession(data)
    } catch (err) { toast.error(err.message) }
    finally { setCreatingBooking(false) }
  }

  const handleCreateExternal = () => {
    handleCreateBooking(`Joueur externe 1`)
  }

  // ===== PRODUCT CART =====
  const filteredProducts = activeCat ? products.filter((p) => p.category_id === activeCat) : products
  const addToCart = (product) => {
    setCart((prev) => {
      const ex = prev.find((c) => c.product.id === product.id)
      if (ex) return prev.map((c) => c.product.id === product.id ? { ...c, qty: c.qty + 1 } : c)
      return [...prev, { product, qty: 1 }]
    })
  }
  const updateCartQty = (pid, delta) => {
    setCart((prev) => prev.map((c) => c.product.id === pid ? { ...c, qty: c.qty + delta } : c).filter((c) => c.qty > 0))
  }
  const cartTotal = cart.reduce((s, c) => s + c.qty * parseFloat(c.product.price), 0)

  const submitSale = async () => {
    setSubmitting(true)
    try {
      for (const item of cart) {
        const amount = item.qty * parseFloat(item.product.price)
        if (selectedBuyer && salePayment === 'balance') {
          const { error } = await supabase.rpc('debit_user', {
            p_user_id: selectedBuyer.id, p_amount: amount,
            p_description: `${item.product.name} x${item.qty}`,
            p_performed_by: admin.id, p_type: 'debit_product', p_product_id: item.product.id,
          })
          if (error) throw error
        } else {
          await supabase.from('transactions').insert({
            user_id: selectedBuyer?.id || null,
            type: selectedBuyer ? 'debit_product' : 'external_payment',
            amount, description: `${item.product.name} x${item.qty}`,
            performed_by: admin.id, product_id: item.product.id, payment_method: salePayment,
          })
        }
      }
      toast.success('Vente enregistrée'); setCart([]); setSaleModal(false)
    } catch (err) { toast.error(err.message) }
    finally { setSubmitting(false) }
  }

  const exportCols = [
    { key: 'date', label: 'Date' }, { key: 'type', label: 'Type' },
    { key: 'amount', label: 'Montant' }, { key: 'description', label: 'Description' },
  ]
  const exportRows = salesToday.map((tx) => ({
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

        {/* ===== SESSIONS TAB ===== */}
        {tab === 'sessions' && (
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

            {/* Grid 3 terrains × créneaux */}
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
                              onClick={() => openNewBooking(court.id, slot)}
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
                            onClick={() => openSession(booking)}
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
        )}

        {/* ===== ARTICLES TAB ===== */}
        {tab === 'articles' && (
          <div className="space-y-4">
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {categories.map((cat) => (
                <button key={cat.id} onClick={() => setActiveCat(cat.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap cursor-pointer ${
                    activeCat === cat.id ? 'bg-primary text-white' : 'bg-white text-text-secondary hover:bg-bg'}`}>
                  {cat.name}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              {filteredProducts.map((p) => (
                <button key={p.id} onClick={() => addToCart(p)}
                  className="p-3 rounded-[14px] bg-white hover:shadow-[0_4px_12px_rgba(11,39,120,0.1)] transition-all text-left cursor-pointer active:scale-95">
                  <p className="text-sm font-medium text-text truncate">{p.name}</p>
                  <p className="text-lg font-bold text-primary">{parseFloat(p.price).toFixed(2)}€</p>
                </button>
              ))}
            </div>
            {cart.length > 0 && (
              <Card elevated>
                <h3 className="text-sm font-semibold mb-3">Panier</h3>
                <div className="space-y-2">
                  {cart.map((item) => (
                    <div key={item.product.id} className="flex items-center justify-between">
                      <p className="text-sm text-text truncate flex-1">{item.product.name}</p>
                      <div className="flex items-center gap-2">
                        <button onClick={() => updateCartQty(item.product.id, -1)} className="w-6 h-6 rounded-full bg-bg flex items-center justify-center cursor-pointer"><Minus className="w-3 h-3" /></button>
                        <span className="text-sm font-semibold w-6 text-center">{item.qty}</span>
                        <button onClick={() => updateCartQty(item.product.id, 1)} className="w-6 h-6 rounded-full bg-bg flex items-center justify-center cursor-pointer"><Plus className="w-3 h-3" /></button>
                        <span className="text-sm font-semibold text-primary w-14 text-right">{(item.qty * parseFloat(item.product.price)).toFixed(2)}€</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 pt-3 border-t border-separator flex items-center justify-between">
                  <span className="font-semibold">Total</span>
                  <span className="text-xl font-bold text-primary">{cartTotal.toFixed(2)}€</span>
                </div>
                <Button className="w-full mt-3" onClick={() => { setSelectedBuyer(null); setSaleSearch(''); setSalePayment('balance'); setSaleModal(true) }}>
                  Encaisser {cartTotal.toFixed(2)}€
                </Button>
              </Card>
            )}
          </div>
        )}
      </div>

      {/* ===== SESSION DETAIL MODAL ===== */}
      <Modal isOpen={sessionModal} onClose={() => setSessionModal(false)} title="Gestion session" className="!max-w-lg">
        {selectedBooking && (() => {
          const total = parseFloat(selectedBooking.price)
          const defaultShare = Math.round((total / 4) * 100) / 100
          const allPlayers = sessionPlayers
          const realPlayers = allPlayers.filter((p) => p.player_name !== 'Place disponible')
          const pendingInvites = realPlayers.filter((p) => p.invitation_status === 'pending')
          const paid = realPlayers.reduce((s, p) => s + (p.payment_status !== 'pending' ? parseFloat(p.amount) : 0), 0)
          const remaining = total - paid
          const isSessionPaid = paid >= total
          const canAdd = realPlayers.length < 4 && !isSessionPaid

          return (
            <div className="space-y-4">
              {/* Session info */}
              <div className="bg-bg rounded-[12px] p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold">{selectedBooking.user_name}</p>
                    <p className="text-xs text-text-secondary">
                      {COURTS.find((c) => c.id === selectedBooking.court_id)?.label} · {formatTime(selectedBooking.start_time)} – {formatTime(selectedBooking.end_time)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-primary">{total.toFixed(2)}€</p>
                    <p className="text-[10px] text-text-tertiary">{defaultShare.toFixed(2)}€ / joueur</p>
                  </div>
                </div>
              </div>

              {/* Payment summary */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-[8px] bg-bg p-2">
                  <p className="text-[9px] text-text-tertiary uppercase">Total</p>
                  <p className="text-sm font-bold text-primary">{total.toFixed(2)}€</p>
                </div>
                <div className="rounded-[8px] bg-success/10 p-2">
                  <p className="text-[9px] text-text-tertiary uppercase">Payé</p>
                  <p className="text-sm font-bold text-success">{paid.toFixed(2)}€</p>
                </div>
                <div className={`rounded-[8px] p-2 ${remaining > 0 ? 'bg-warning/10' : 'bg-success/10'}`}>
                  <p className="text-[9px] text-text-tertiary uppercase">Reste</p>
                  <p className={`text-sm font-bold ${remaining > 0 ? 'text-warning' : 'text-success'}`}>{remaining.toFixed(2)}€</p>
                </div>
              </div>

              {/* Players */}
              <div>
                <p className="text-xs font-semibold text-text-secondary uppercase mb-2">Joueurs ({realPlayers.length}/4)</p>
                <div className="space-y-2">
                  {realPlayers.map((p, idx) => {
                    const badge = PAY_BADGE[p.payment_status] || PAY_BADGE.pending
                    const isPending = p.payment_status === 'pending'
                    const isMember = !!p.user_id
                    const isReservant = idx === 0
                    const isInvitePending = p.invitation_status === 'pending'

                    return (
                      <div key={p.id} className={`rounded-[10px] p-3 space-y-2 ${isInvitePending ? 'bg-warning/5 border border-warning/20' : 'bg-bg'}`}>
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <span className="text-xs font-bold text-primary">{p.player_name.charAt(0).toUpperCase()}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1 flex-wrap">
                              <p className="text-sm font-medium truncate">{p.player_name}</p>
                              {isReservant && <span className="text-[8px] bg-primary/10 text-primary px-1 py-0.5 rounded">Rés.</span>}
                              {isInvitePending && <span className="text-[8px] bg-warning/20 text-warning px-1 py-0.5 rounded">Invitation en attente</span>}
                            </div>
                            <p className="text-[10px] text-text-tertiary">{isMember ? 'Membre' : 'Externe'}</p>
                          </div>
                          {!isInvitePending && <Badge color={badge.color}>{badge.label}</Badge>}
                        </div>

                        {/* Admin can force-accept or remove pending invitations */}
                        {isInvitePending && (
                          <div className="flex gap-1.5">
                            <Button size="sm" className="flex-1" loading={submitting} onClick={async () => {
                              setSubmitting(true)
                              try {
                                await supabase.from('booking_players').update({ invitation_status: 'accepted' }).eq('id', p.id)
                                toast.success('Invitation validée')
                                await refreshSession()
                              } catch (err) { toast.error(err.message) }
                              finally { setSubmitting(false) }
                            }}>
                              Valider l'invitation
                            </Button>
                            <Button size="sm" variant="danger" className="flex-1" loading={submitting} onClick={() => handleRemovePlayer(p)}>
                              Supprimer
                            </Button>
                          </div>
                        )}

                        {/* Payment actions — only for accepted, pending payment */}
                        {!isInvitePending && isPending && !isSessionPaid && (
                          <>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-text-secondary">Montant :</span>
                              <input type="number" step="0.01" min="0"
                                defaultValue={parseFloat(p.amount).toFixed(2)}
                                onBlur={(e) => handleUpdateAmount(p.id, e.target.value)}
                                className="w-20 px-2 py-1 rounded-lg bg-white border border-separator text-sm text-center font-semibold text-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
                              <span className="text-xs text-text-tertiary">€</span>
                            </div>
                            <div className="flex gap-1.5">
                              {isMember && (
                                <Button size="sm" className="flex-1" onClick={() => handlePayBalance(p)} loading={submitting}>
                                  <Wallet className="w-3 h-3 mr-1" />Solde
                                </Button>
                              )}
                              <Button size="sm" variant="ghost" className="flex-1" onClick={() => handlePayExternal(p, 'cb')} loading={submitting}>
                                <CreditCard className="w-3 h-3 mr-1" />CB
                              </Button>
                              <Button size="sm" variant="ghost" className="flex-1" onClick={() => handlePayExternal(p, 'cash')} loading={submitting}>
                                <Banknote className="w-3 h-3 mr-1" />Cash
                              </Button>
                            </div>
                            {!isReservant && (
                              <button onClick={() => handleRemovePlayer(p)} className="text-[10px] text-danger hover:underline cursor-pointer">Retirer</button>
                            )}
                          </>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Add players */}
              {canAdd && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-text-secondary uppercase">Ajouter un joueur</p>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
                    <input type="text" placeholder="Rechercher un membre..." value={memberSearch} onChange={(e) => setMemberSearch(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 rounded-[10px] bg-white border border-separator text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
                  </div>
                  {memberResults.length > 0 && (
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {memberResults.map((m) => (
                        <button key={m.id} onClick={() => handleAddPlayer(m)}
                          className="w-full flex items-center gap-2 p-2.5 rounded-[10px] hover:bg-bg text-left text-sm cursor-pointer">
                          <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <span className="text-xs font-bold text-primary">{m.display_name.charAt(0).toUpperCase()}</span>
                          </div>
                          <span className="font-medium flex-1">{m.display_name}</span>
                          <span className="text-xs text-text-tertiary">{(parseFloat(m.balance||0)+parseFloat(m.balance_bonus||0)).toFixed(2)}€</span>
                          <UserPlus className="w-4 h-4 text-primary shrink-0" />
                        </button>
                      ))}
                    </div>
                  )}
                  <button onClick={handleAddExternal}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-[10px] border-2 border-dashed border-separator hover:border-primary/30 hover:bg-primary/5 text-sm font-medium text-primary cursor-pointer">
                    <UserPlus className="w-4 h-4" />Joueur externe
                  </button>
                </div>
              )}

              {isSessionPaid && (
                <div className="flex items-center gap-2 py-3 px-4 rounded-[10px] bg-success/5 border border-success/20">
                  <Lock className="w-4 h-4 text-success" />
                  <p className="text-sm text-success font-medium">Session entièrement payée</p>
                </div>
              )}

              {/* Cancel */}
              <Button variant="danger" className="w-full" loading={submitting} onClick={handleCancelBooking}>
                <Trash2 className="w-4 h-4 mr-1" />Annuler la session
              </Button>
            </div>
          )
        })()}
      </Modal>

      {/* ===== NEW BOOKING MODAL ===== */}
      <Modal isOpen={newBookingModal} onClose={() => setNewBookingModal(false)} title="Nouvelle réservation">
        {newSlot && (
          <div className="space-y-4">
            <div className="bg-bg rounded-[12px] p-4">
              <div className="flex items-center gap-2 mb-2">
                <MapPin className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">{COURTS.find((c) => c.id === newSlot.courtId)?.label}</span>
              </div>
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-primary" />
                <span className="text-sm">{dayLabel} · {formatTime(newSlot.start)} – {formatTime(newSlot.end)}</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-separator">
                <span className="text-sm text-text-secondary">Prix</span>
                <span className="text-sm font-bold text-primary">{newSlot.price.toFixed(2)}€</span>
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
                    <button key={m.id} onClick={() => handleCreateBooking(m)} disabled={creatingBooking}
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

            <button onClick={handleCreateExternal} disabled={creatingBooking}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-[10px] border-2 border-dashed border-separator hover:border-primary/30 hover:bg-primary/5 text-sm font-medium text-primary cursor-pointer">
              <UserPlus className="w-4 h-4" />Réserver pour un externe
            </button>
          </div>
        )}
      </Modal>

      {/* Sale modal */}
      <Modal isOpen={saleModal} onClose={() => setSaleModal(false)} title="Encaisser articles">
        <div className="space-y-4">
          <div className="bg-bg rounded-[12px] p-3">
            <p className="text-sm text-text-secondary">Total</p>
            <p className="text-2xl font-bold text-primary">{cartTotal.toFixed(2)}€</p>
            <p className="text-xs text-text-tertiary">{cart.map((c) => `${c.product.name} x${c.qty}`).join(', ')}</p>
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
          <Button className="w-full" loading={submitting} onClick={submitSale}>Encaisser {cartTotal.toFixed(2)}€</Button>
        </div>
      </Modal>
    </PageWrapper>
  )
}
