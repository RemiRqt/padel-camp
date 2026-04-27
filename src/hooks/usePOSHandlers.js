import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/context/AuthContext'
import {
  payPlayerShare, markPlayerExternal, searchMembers, createBooking,
  fetchAdminDayBookings, fetchDayBlockingEvents, fetchBookingPlayers,
  fetchBookingById, adminUpdatePlayerSlot, adminInsertPlayer,
  adminCancelBooking, adminAcceptInvitation, adminSellProduct, fetchDaySales,
  updatePlayerAmount
} from '@/services/bookingService'
import { fetchActiveCategoriesAndProducts } from '@/services/productService'
import { getSlotPrice } from '@/utils/calculatePrice'
import toast from 'react-hot-toast'

export default function usePOSHandlers({ dateStr, selectedDate, pricingRules, askConfirm }) {
  const { user: admin } = useAuth()

  // Bookings
  const [bookings, setBookings] = useState([])
  const [bLoading, setBLoading] = useState(true)
  const [dayEvents, setDayEvents] = useState([])

  // Session modal
  const [sessionModal, setSessionModal] = useState(false)
  const [selectedBooking, setSelectedBooking] = useState(null)
  const [sessionPlayers, setSessionPlayers] = useState([])
  const [memberSearch, setMemberSearch] = useState('')
  const [memberResults, setMemberResults] = useState([])
  const [submitting, setSubmitting] = useState(false)

  // New booking modal
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

  // Sales history
  const [salesToday, setSalesToday] = useState([])
  const [showAllSales, setShowAllSales] = useState(false)

  // ===== DATA FETCHING =====
  const fetchBookings = useCallback(async () => {
    setBLoading(true)
    const data = await fetchAdminDayBookings(dateStr)
    setBookings(data)
    setBLoading(false)
  }, [dateStr])

  useEffect(() => {
    fetchDayBlockingEvents(dateStr).then(setDayEvents).catch(() => setDayEvents([]))
  }, [dateStr])

  useEffect(() => { fetchBookings() }, [fetchBookings])

  useEffect(() => {
    async function loadProducts() {
      try {
        const { categories: cats, products: prods } = await fetchActiveCategoriesAndProducts()
        setCategories(cats)
        setProducts(prods)
        if (cats[0]) setActiveCat(cats[0].id)
      } catch (err) { console.error('[POS] product fetch error:', err) }
    }
    loadProducts()
  }, [])

  useEffect(() => {
    fetchDaySales(dateStr).then((data) => { setSalesToday(data); setShowAllSales(false) }).catch(() => setSalesToday([]))
  }, [dateStr, submitting])

  useEffect(() => {
    if (memberSearch.length < 2) { setMemberResults([]); return }
    const t = setTimeout(async () => { setMemberResults(await searchMembers(memberSearch)) }, 300)
    return () => clearTimeout(t)
  }, [memberSearch])

  useEffect(() => {
    if (newSearch.length < 2) { setNewResults([]); return }
    const t = setTimeout(async () => { setNewResults(await searchMembers(newSearch)) }, 300)
    return () => clearTimeout(t)
  }, [newSearch])

  useEffect(() => {
    if (saleSearch.length < 2) { setSaleResults([]); return }
    const t = setTimeout(async () => { setSaleResults(await searchMembers(saleSearch)) }, 300)
    return () => clearTimeout(t)
  }, [saleSearch])

  // ===== HELPERS =====
  const getBlockingEvent = (slotStart, slotEnd) => {
    return dayEvents.find((ev) => {
      if (!ev.start_time || !ev.end_time) return true
      return slotStart < ev.end_time.slice(0, 5) && slotEnd > ev.start_time.slice(0, 5)
    })
  }

  const getBookingFor = (courtId, startTime) => {
    return bookings.find((b) => b.court_id === courtId && b.start_time.slice(0, 5) === startTime.slice(0, 5))
  }

  const filteredProducts = activeCat ? products.filter((p) => p.category_id === activeCat) : products

  // ===== SESSION HANDLERS =====
  const openSession = async (booking) => {
    setSelectedBooking(booking)
    setSessionPlayers(booking.booking_players || [])
    setMemberSearch(''); setMemberResults([])
    setSessionModal(true)
  }

  const refreshSession = async () => {
    if (!selectedBooking) return
    const data = await fetchBookingPlayers(selectedBooking.id)
    setSessionPlayers(data)
    try {
      const bk = await fetchBookingById(selectedBooking.id)
      if (bk) setSelectedBooking(bk)
    } catch { /* ignore */ }
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
        await adminUpdatePlayerSlot(emptySlot.id, {
          user_id: isString ? null : member.id,
          player_name: isString ? member : member.display_name,
          payment_method: isString ? 'cb' : 'balance',
          amount: defaultAmount, payment_status: 'pending',
        })
      } else {
        await adminInsertPlayer({
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
    await updatePlayerAmount(playerId, val)
    await refreshSession()
  }

  const handleRemovePlayer = async (player) => {
    askConfirm({
      title: 'Retirer le joueur',
      message: `Retirer ${player.player_name} ?`,
      confirmLabel: 'Retirer',
      variant: 'danger',
      onConfirm: async () => {
        setSubmitting(true)
        try {
          const share = Math.round((parseFloat(selectedBooking.price) / 4) * 100) / 100
          await adminUpdatePlayerSlot(player.id, {
            user_id: null, player_name: 'Place disponible', parts: 1,
            payment_method: 'balance', payment_status: 'pending', amount: share,
          })
          toast.success('Joueur retiré')
          await refreshSession()
        } catch (err) { toast.error(err.message) }
        finally { setSubmitting(false) }
      },
    })
  }

  const handleAcceptInvitation = async (player) => {
    setSubmitting(true)
    try {
      await adminAcceptInvitation(player.id)
      toast.success('Invitation validée')
      await refreshSession()
    } catch (err) { toast.error(err.message) }
    finally { setSubmitting(false) }
  }

  const handleCancelBooking = async () => {
    if (!selectedBooking) return
    askConfirm({
      title: 'Annuler la session',
      message: 'Annuler cette session ?',
      confirmLabel: 'Annuler la session',
      variant: 'danger',
      onConfirm: async () => {
        setSubmitting(true)
        try {
          await adminCancelBooking(selectedBooking.id)
          toast.success('Session annulée')
          setSessionModal(false)
          fetchBookings()
        } catch (err) { toast.error(err.message) }
        finally { setSubmitting(false) }
      },
    })
  }

  // ===== NEW BOOKING HANDLERS =====
  const openNewBooking = (courtId, slot) => {
    const price = getSlotPrice(pricingRules, selectedDate, slot.start)
    setNewSlot({ courtId, start: slot.start, end: slot.end, price })
    setNewSearch(''); setNewResults([])
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
        courtId: newSlot.courtId, date: dateStr,
        startTime: newSlot.start, endTime: newSlot.end,
        price: newSlot.price, payNow: 'none',
      })
      toast.success('Session créée')
      setNewBookingModal(false)
      await fetchBookings()
      try {
        const data = await fetchBookingById(booking.id, { withPlayers: true })
        if (data) openSession(data)
      } catch { /* ignore */ }
    } catch (err) { toast.error(err.message) }
    finally { setCreatingBooking(false) }
  }

  const handleCreateExternal = () => { handleCreateBooking('Joueur externe 1') }

  // ===== CART HANDLERS =====
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

  const openSaleCheckout = () => {
    setSelectedBuyer(null); setSaleSearch(''); setSalePayment('balance'); setSaleModal(true)
  }

  const submitSale = async () => {
    setSubmitting(true)
    try {
      for (const item of cart) {
        const amount = item.qty * parseFloat(item.product.price)
        await adminSellProduct({
          buyerId: selectedBuyer?.id || null, amount,
          description: `${item.product.name} x${item.qty}`,
          performedBy: admin.id, productId: item.product.id,
          paymentMethod: salePayment,
        })
      }
      toast.success('Vente enregistrée'); setCart([]); setSaleModal(false)
    } catch (err) { toast.error(err.message) }
    finally { setSubmitting(false) }
  }

  return {
    // Bookings data
    bookings, bLoading, dayEvents,
    // Session modal
    sessionModal, setSessionModal, selectedBooking, sessionPlayers,
    memberSearch, setMemberSearch, memberResults, submitting,
    // New booking modal
    newBookingModal, setNewBookingModal, newSlot,
    newSearch, setNewSearch, newResults, creatingBooking,
    // Products
    categories, products, filteredProducts, activeCat, setActiveCat,
    cart, cartTotal, addToCart, updateCartQty,
    // Sale modal
    saleModal, setSaleModal, saleSearch, setSaleSearch, saleResults,
    selectedBuyer, setSelectedBuyer, salePayment, setSalePayment,
    // Sales history
    salesToday, showAllSales, setShowAllSales,
    // Helpers
    getBlockingEvent, getBookingFor,
    // Session handlers
    openSession, handlePayBalance, handlePayExternal,
    handleAddPlayer, handleAddExternal, handleUpdateAmount,
    handleRemovePlayer, handleAcceptInvitation, handleCancelBooking,
    // New booking handlers
    openNewBooking, handleCreateBooking, handleCreateExternal,
    // Sale handlers
    openSaleCheckout, submitSale,
  }
}
