import { useEffect, useState, useMemo, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useBookings } from '@/hooks/useBookings'
import { useClub } from '@/hooks/useClub'
import { toDateString, formatTime } from '@/utils/formatDate'
import { generateSlots, isSlotBooked } from '@/utils/slots'
import { getSlotPrice } from '@/utils/calculatePrice'
import {
  getBookingWithPlayers, payPlayerShare, markPlayerExternal, searchMembers
} from '@/services/bookingService'
import PageWrapper from '@/components/layout/PageWrapper'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import ExportButtons from '@/components/ui/ExportButtons'
import DateRangePicker from '@/components/ui/DateRangePicker'
import { exportExcel, exportPDF } from '@/utils/export'
import toast from 'react-hot-toast'
import {
  ShoppingCart, Search, UserPlus, Wallet, CreditCard, Banknote,
  Package, Users, Minus, Plus, Lock, Eye, CalendarDays
} from 'lucide-react'

const PAY_BADGE = {
  paid: { color: 'success', label: 'Payé' },
  external: { color: 'primary', label: 'CB/Esp.' },
  pending: { color: 'warning', label: 'En attente' },
}
const COURTS = [
  { id: 'terrain_1', short: 'T1' },
  { id: 'terrain_2', short: 'T2' },
  { id: 'terrain_3', short: 'T3' },
]

export default function AdminPOS() {
  const { user: admin } = useAuth()
  const todayRef = useRef(new Date())
  const { bookings: todayBookings, loading: bLoading, refetch: refetchBookings } = useBookings(todayRef.current)
  const { config, pricingRules } = useClub()

  const [tab, setTab] = useState('sessions') // 'sessions' | 'articles'

  // Products
  const [categories, setCategories] = useState([])
  const [products, setProducts] = useState([])
  const [activeCat, setActiveCat] = useState(null)

  // Session detail
  const [sessionModal, setSessionModal] = useState(false)
  const [selectedBooking, setSelectedBooking] = useState(null)
  const [sessionPlayers, setSessionPlayers] = useState([])
  const [sessionLoading, setSessionLoading] = useState(false)
  const [memberSearch, setMemberSearch] = useState('')
  const [memberResults, setMemberResults] = useState([])
  const [submitting, setSubmitting] = useState(false)

  // Product sale
  const [cart, setCart] = useState([])
  const [saleModal, setSaleModal] = useState(false)
  const [saleSearch, setSaleSearch] = useState('')
  const [saleResults, setSaleResults] = useState([])
  const [selectedBuyer, setSelectedBuyer] = useState(null)
  const [salePayment, setSalePayment] = useState('balance')

  // Sales history
  const [from, setFrom] = useState(toDateString(todayRef.current))
  const [to, setTo] = useState(toDateString(todayRef.current))
  const [salesToday, setSalesToday] = useState([])

  const slots = useMemo(() => generateSlots(config), [config])

  // Build a map: bookingId → booking for quick lookup
  const bookingMap = useMemo(() => {
    const map = {}
    todayBookings.forEach((b) => { map[`${b.court_id}_${b.start_time.slice(0, 5)}`] = b })
    return map
  }, [todayBookings])

  // Fetch booking_players counts for all today's bookings
  const [playerCounts, setPlayerCounts] = useState({}) // bookingId → { total, paid }
  useEffect(() => {
    if (todayBookings.length === 0) { setPlayerCounts({}); return }
    async function fetchCounts() {
      const ids = todayBookings.map((b) => b.id)
      const { data } = await supabase
        .from('booking_players')
        .select('booking_id, payment_status, player_name')
        .in('booking_id', ids)
      if (!data) return
      const counts = {}
      data.forEach((p) => {
        if (p.player_name === 'Place disponible') return
        if (!counts[p.booking_id]) counts[p.booking_id] = { total: 0, paid: 0 }
        counts[p.booking_id].total++
        if (p.payment_status === 'paid' || p.payment_status === 'external') counts[p.booking_id].paid++
      })
      setPlayerCounts(counts)
    }
    fetchCounts()
  }, [todayBookings])

  useEffect(() => {
    async function fetchProducts() {
      try {
        const [cRes, pRes] = await Promise.all([
          supabase.from('product_categories').select('*').eq('is_active', true).order('sort_order'),
          supabase.from('products').select('*, category:product_categories(name)').eq('is_active', true).order('name'),
        ])
        setCategories(cRes.data || [])
        setProducts(pRes.data || [])
        if (cRes.data?.[0]) setActiveCat(cRes.data[0].id)
      } catch (err) { console.error('[POS] products error:', err) }
    }
    fetchProducts()
  }, [])

  useEffect(() => {
    async function fetchSales() {
      const { data } = await supabase
        .from('transactions')
        .select('*')
        .in('type', ['debit_product', 'debit_session', 'external_payment'])
        .gte('created_at', from + 'T00:00:00').lte('created_at', to + 'T23:59:59')
        .order('created_at', { ascending: false }).limit(50)
      setSalesToday(data || [])
    }
    fetchSales()
  }, [from, to, submitting])

  const filteredProducts = activeCat ? products.filter((p) => p.category_id === activeCat) : products

  // Member search
  useEffect(() => {
    if (memberSearch.length < 2) { setMemberResults([]); return }
    const t = setTimeout(async () => { setMemberResults(await searchMembers(memberSearch)) }, 300)
    return () => clearTimeout(t)
  }, [memberSearch])
  useEffect(() => {
    if (saleSearch.length < 2) { setSaleResults([]); return }
    const t = setTimeout(async () => { setSaleResults(await searchMembers(saleSearch)) }, 300)
    return () => clearTimeout(t)
  }, [saleSearch])

  // Open session
  const openSession = async (booking) => {
    setSelectedBooking(booking)
    setSessionLoading(true)
    setSessionModal(true)
    setMemberSearch('')
    try {
      const { players } = await getBookingWithPlayers(booking.id)
      setSessionPlayers(players)
    } catch { setSessionPlayers([]) }
    finally { setSessionLoading(false) }
  }

  const refreshSession = async () => {
    if (!selectedBooking) return
    const { booking, players } = await getBookingWithPlayers(selectedBooking.id)
    setSelectedBooking(booking)
    setSessionPlayers(players)
    refetchBookings()
  }

  // Pay from balance
  const handlePayBalance = async (player) => {
    if (!admin || !selectedBooking) return
    setSubmitting(true)
    try {
      await payPlayerShare({
        playerId: player.id, bookingId: selectedBooking.id,
        userId: player.user_id, amount: parseFloat(player.amount), performedBy: admin.id,
      })
      toast.success(`${player.player_name} — solde débité`)
      await refreshSession()
    } catch (err) { toast.error(err.message) }
    finally { setSubmitting(false) }
  }

  // External payment
  const handlePayExternal = async (player, method) => {
    if (!admin || !selectedBooking) return
    setSubmitting(true)
    try {
      await markPlayerExternal({
        playerId: player.id, bookingId: selectedBooking.id,
        paymentMethod: method, amount: parseFloat(player.amount),
        playerName: player.player_name, performedBy: admin.id,
      })
      toast.success(`${player.player_name} — ${method} enregistré`)
      await refreshSession()
    } catch (err) { toast.error(err.message) }
    finally { setSubmitting(false) }
  }

  // Add player
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
          booking_id: selectedBooking.id,
          user_id: isString ? null : member.id,
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
    const name = prompt('Nom du joueur externe ?')
    if (name) handleAddPlayer(name)
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
      await supabase.from('booking_players').delete().eq('id', player.id)
      toast.success('Joueur retiré')
      await refreshSession()
    } catch (err) { toast.error(err.message) }
    finally { setSubmitting(false) }
  }

  // Product cart
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

  const courtLabel = (id) => `Terrain ${id?.replace('terrain_', '') || '?'}`

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
        <div className="flex items-center gap-2">
          <ShoppingCart className="w-5 h-5 text-primary" />
          <h1 className="text-2xl font-bold text-text">Point de vente</h1>
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
            {/* Grid 3 terrains × créneaux */}
            <Card className="!p-0 overflow-hidden">
              <div className="grid grid-cols-[56px_1fr_1fr_1fr] border-b border-separator">
                <div className="p-2 text-[10px] font-semibold text-text-tertiary uppercase text-center">Heure</div>
                {COURTS.map((c) => (
                  <div key={c.id} className="p-2 text-center text-[10px] font-semibold text-text-secondary uppercase">{c.short}</div>
                ))}
              </div>

              {bLoading ? (
                Array.from({ length: 6 }, (_, i) => (
                  <div key={i} className="grid grid-cols-[56px_1fr_1fr_1fr] border-b border-separator last:border-0">
                    {[0,1,2,3].map((j) => <div key={j} className="p-1"><div className="h-14 rounded-lg bg-bg animate-pulse" /></div>)}
                  </div>
                ))
              ) : (
                slots.map((slot) => (
                  <div key={slot.start} className="grid grid-cols-[56px_1fr_1fr_1fr] border-b border-separator last:border-0">
                    <div className="p-1 flex flex-col items-center justify-center">
                      <span className="text-[11px] font-semibold text-text leading-none">{formatTime(slot.start)}</span>
                      <span className="text-[9px] text-text-tertiary leading-none mt-0.5">{formatTime(slot.end)}</span>
                    </div>
                    {COURTS.map((court) => {
                      const key = `${court.id}_${slot.start}`
                      const booking = bookingMap[key]
                      const booked = !!booking
                      const pc = booking ? playerCounts[booking.id] : null
                      const isPaid = booking?.payment_status === 'paid'
                      const isPartial = booking?.payment_status === 'partial'

                      if (!booked) {
                        return (
                          <div key={court.id} className="p-1">
                            <div className="w-full h-14 rounded-lg bg-green-50 flex items-center justify-center">
                              <span className="text-xs font-semibold text-green-600">Libre</span>
                            </div>
                          </div>
                        )
                      }

                      return (
                        <div key={court.id} className="p-1">
                          <button
                            onClick={() => openSession(booking)}
                            className={`w-full h-14 rounded-lg flex flex-col items-center justify-center transition-all cursor-pointer active:scale-95 ${
                              isPaid ? 'bg-success/10' : isPartial ? 'bg-warning/10' : 'bg-red-50'
                            }`}
                          >
                            <span className={`text-[10px] font-bold ${isPaid ? 'text-success' : isPartial ? 'text-warning' : 'text-red-500'}`}>
                              {isPaid ? '✓ Payée' : isPartial ? 'Partiel' : 'Non payée'}
                            </span>
                            <span className="text-[9px] text-text-tertiary">
                              {pc ? `${pc.total}/4 joueurs` : '0/4'}
                              {pc && pc.paid > 0 && !isPaid ? ` · ${pc.paid} payé${pc.paid > 1 ? 's' : ''}` : ''}
                            </span>
                          </button>
                        </div>
                      )
                    })}
                  </div>
                ))
              )}
            </Card>

            {/* Légende */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-1">
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-green-50 border border-green-200" /><span className="text-xs text-text-secondary">Libre</span></div>
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-red-50 border border-red-200" /><span className="text-xs text-text-secondary">Non payée</span></div>
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-warning/10 border border-warning/20" /><span className="text-xs text-text-secondary">Partiel</span></div>
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-success/10 border border-success/20" /><span className="text-xs text-text-secondary">Payée</span></div>
            </div>

            {/* Sales history */}
            <Card>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <h3 className="font-semibold text-text">Historique</h3>
                <div className="flex items-center gap-2">
                  <DateRangePicker from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t) }} />
                  <ExportButtons
                    onExcel={() => exportExcel(exportRows, exportCols, `pos_${from}_${to}`)}
                    onPDF={() => exportPDF(exportRows, exportCols, `pos_${from}_${to}`, 'POS')}
                  />
                </div>
              </div>
              {salesToday.length === 0 ? (
                <p className="text-sm text-text-tertiary text-center py-4">Aucune vente</p>
              ) : (
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {salesToday.map((tx) => (
                    <div key={tx.id} className="flex items-center justify-between py-2 px-3 rounded-[10px] bg-bg">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-text truncate">{tx.description}</p>
                        <p className="text-[10px] text-text-tertiary">{new Date(tx.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</p>
                      </div>
                      <span className="text-sm font-semibold text-danger">-{parseFloat(tx.amount).toFixed(2)}€</span>
                    </div>
                  ))}
                </div>
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
                  className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                    activeCat === cat.id ? 'bg-primary text-white' : 'bg-white text-text-secondary hover:bg-bg'}`}>
                  {cat.name}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
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

      {/* ===== SESSION MODAL ===== */}
      <Modal isOpen={sessionModal} onClose={() => setSessionModal(false)} title="Détail session" className="!max-w-lg">
        {selectedBooking && (() => {
          const total = parseFloat(selectedBooking.price)
          const defaultShare = Math.round((total / 4) * 100) / 100
          const realPlayers = sessionPlayers.filter((p) => p.player_name !== 'Place disponible')
          const paid = realPlayers.reduce((s, p) => s + (p.payment_status !== 'pending' ? parseFloat(p.amount) : 0), 0)
          const remaining = total - paid
          const isSessionPaid = selectedBooking.payment_status === 'paid'
          const canAdd = realPlayers.length < 4 && !isSessionPaid

          return (
            <div className="space-y-4">
              <div className="bg-bg rounded-[12px] p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold">{selectedBooking.user_name}</p>
                    <p className="text-xs text-text-secondary">{courtLabel(selectedBooking.court_id)} · {formatTime(selectedBooking.start_time)} – {formatTime(selectedBooking.end_time)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-primary">{total.toFixed(2)}€</p>
                    <p className="text-[10px] text-text-tertiary">{defaultShare.toFixed(2)}€ / joueur</p>
                  </div>
                </div>
              </div>

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
                {sessionLoading ? (
                  <div className="space-y-2">{[1,2].map((i) => <div key={i} className="h-16 rounded-[10px] bg-bg animate-pulse" />)}</div>
                ) : (
                  <div className="space-y-2">
                    {realPlayers.map((p, idx) => {
                      const badge = PAY_BADGE[p.payment_status] || PAY_BADGE.pending
                      const isPending = p.payment_status === 'pending'
                      const isMember = !!p.user_id
                      const isReservant = idx === 0

                      return (
                        <div key={p.id} className="rounded-[10px] bg-bg p-3 space-y-2">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                              <span className="text-xs font-bold text-primary">{p.player_name.charAt(0).toUpperCase()}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1">
                                <p className="text-sm font-medium truncate">{p.player_name}</p>
                                {isReservant && <span className="text-[8px] bg-primary/10 text-primary px-1 py-0.5 rounded">Rés.</span>}
                              </div>
                              <p className="text-[10px] text-text-tertiary">{isMember ? 'Membre' : 'Externe'}</p>
                            </div>
                            <Badge color={badge.color}>{badge.label}</Badge>
                          </div>

                          {isPending && !isSessionPaid && (
                            <>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-text-secondary">Montant :</span>
                                <input type="number" step="0.01" min="0"
                                  defaultValue={parseFloat(p.amount).toFixed(2)}
                                  onBlur={(e) => handleUpdateAmount(p.id, e.target.value)}
                                  className="w-20 px-2 py-1 rounded-lg bg-white border border-separator text-sm text-center font-semibold text-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                                />
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
                )}
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
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-[10px] border-2 border-dashed border-separator hover:border-primary/30 hover:bg-primary/5 text-sm font-medium text-primary transition-colors cursor-pointer">
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
            </div>
          )
        })()}
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
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-[10px] text-sm font-medium transition-colors cursor-pointer ${
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
