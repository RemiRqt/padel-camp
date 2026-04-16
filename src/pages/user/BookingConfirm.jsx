import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import {
  getBookingWithPlayers, assignPlayerToSlot, searchMembers,
  cancelBooking, payPlayerShare, markPlayerExternal, clearSlot, partPrice,
  updatePlayerAmount
} from '@/services/bookingService'
import { formatDateFull, formatTime } from '@/utils/formatDate'
import PageWrapper from '@/components/layout/PageWrapper'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import ConfirmModal from '@/components/ui/ConfirmModal'
import useConfirm from '@/hooks/useConfirm'
import BookingPlayerCard from '@/components/features/booking/BookingPlayerCard'
import BookingAddPlayer from '@/components/features/booking/BookingAddPlayer'
import toast from 'react-hot-toast'
import { MapPin, Clock, Euro, Users, Trash2, Lock } from 'lucide-react'

const courtLabel = (courtId) => `Terrain ${courtId?.replace('terrain_', '') || '?'}`

export default function BookingConfirm() {
  const { id } = useParams()
  const { user, profile } = useAuth()
  const navigate = useNavigate()

  const [booking, setBooking] = useState(null)
  const [players, setPlayers] = useState([])
  const [loading, setLoading] = useState(true)

  const [addOpen, setAddOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const { confirmProps, askConfirm } = useConfirm()

  const fetchData = useCallback(async () => {
    try {
      const data = await getBookingWithPlayers(id)
      setBooking(data.booking)
      setPlayers(data.players)
    } catch {
      toast.error('Réservation introuvable')
      navigate('/booking')
    } finally {
      setLoading(false)
    }
  }, [id, navigate])

  useEffect(() => { fetchData() }, [fetchData])

  useEffect(() => {
    if (searchQuery.length < 2) { setSearchResults([]); return }
    const timer = setTimeout(async () => {
      setSearching(true)
      try {
        const results = await searchMembers(searchQuery)
        const existingIds = players.map((p) => p.user_id).filter(Boolean)
        setSearchResults(results.filter((r) => !existingIds.includes(r.id)))
      } catch { setSearchResults([]) }
      setSearching(false)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery, players])

  const totalPrice = parseFloat(booking?.price || 0)
  const share = partPrice(totalPrice)
  const amountPaid = players.reduce((s, p) => s + (p.payment_status !== 'pending' ? parseFloat(p.amount) : 0), 0)
  const amountRemaining = totalPrice - amountPaid
  const isOwner = booking?.user_id === user?.id
  const isPaid = booking?.payment_status === 'paid'

  const emptySlots = players.filter((p) => p.player_name === 'Place disponible')
  const filledPlayers = players.filter((p) => p.player_name !== 'Place disponible')
  const [selectedSlotId, setSelectedSlotId] = useState(null)

  const canCancel = booking && (() => {
    const dt = new Date(`${booking.date}T${booking.start_time}`)
    return (dt - new Date()) > 24 * 60 * 60 * 1000
  })()

  const handleAssignMember = async (member) => {
    const slot = emptySlots[0]
    if (!slot) { toast.error('Aucune place disponible'); return }
    setSubmitting(true)
    try {
      await assignPlayerToSlot({
        slotId: selectedSlotId || slot.id, bookingId: id,
        userId: member.id, playerName: member.display_name, paymentMethod: 'balance',
      })
      toast.success(`${member.display_name} ajouté`)
      setAddOpen(false); setSearchQuery(''); setSelectedSlotId(null)
      await fetchData()
    } catch (err) { toast.error(err.message) }
    finally { setSubmitting(false) }
  }

  const handleAssignExternal = async () => {
    const slot = emptySlots[0]
    if (!slot) { toast.error('Aucune place disponible'); return }
    const externalCount = filledPlayers.filter((p) => !p.user_id).length
    const name = `Joueur externe ${externalCount + 1}`
    setSubmitting(true)
    try {
      await assignPlayerToSlot({
        slotId: selectedSlotId || slot.id, bookingId: id,
        userId: null, playerName: name, paymentMethod: 'cb',
      })
      toast.success(`${name} ajouté`)
      setAddOpen(false); setSelectedSlotId(null)
      await fetchData()
    } catch (err) { toast.error(err.message) }
    finally { setSubmitting(false) }
  }

  const handlePayBalance = (player) => {
    askConfirm({
      title: 'Débiter le solde',
      message: `Débiter ${parseFloat(player.amount).toFixed(2)}€ du solde de ${player.player_name} ?`,
      confirmLabel: 'Débiter', variant: 'danger',
      onConfirm: async () => {
        setSubmitting(true)
        try {
          await payPlayerShare({ playerId: player.id, bookingId: id, userId: player.user_id, amount: parseFloat(player.amount), performedBy: user.id })
          toast.success(`${player.player_name} payé`); await fetchData()
        } catch (err) { toast.error(err.message) }
        finally { setSubmitting(false) }
      },
    })
  }

  const handlePayExternal = async (player, method) => {
    setSubmitting(true)
    try {
      await markPlayerExternal({ playerId: player.id, bookingId: id, paymentMethod: method, amount: parseFloat(player.amount), playerName: player.player_name, performedBy: user.id })
      toast.success(`${player.player_name} — paiement ${method} enregistré`); await fetchData()
    } catch (err) { toast.error(err.message) }
    finally { setSubmitting(false) }
  }

  const handleClearSlot = (player) => {
    askConfirm({
      title: 'Retirer le joueur', message: `Retirer ${player.player_name} ?`,
      confirmLabel: 'Retirer', variant: 'danger',
      onConfirm: async () => {
        setSubmitting(true)
        try {
          await clearSlot(player.id); await updatePlayerAmount(player.id, share)
          toast.success(`${player.player_name} retiré`); await fetchData()
        } catch (err) { toast.error(err.message) }
        finally { setSubmitting(false) }
      },
    })
  }

  const handleCancel = () => {
    askConfirm({
      title: 'Annuler la réservation', message: 'Annuler cette réservation ?',
      confirmLabel: 'Annuler la réservation', variant: 'danger',
      onConfirm: async () => {
        setCancelling(true)
        try { await cancelBooking(id, 'user', user.id); toast.success('Réservation annulée'); navigate('/dashboard') }
        catch (err) { toast.error(err.message) }
        finally { setCancelling(false) }
      },
    })
  }

  if (loading) {
    return (
      <PageWrapper title="Réservation">
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-24 rounded-[16px] bg-white animate-pulse" />)}
        </div>
      </PageWrapper>
    )
  }

  if (!booking) return null

  return (
    <PageWrapper title="Réservation">
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            <Badge color={booking.status === 'confirmed' ? 'success' : 'danger'}>{booking.status === 'confirmed' ? 'Confirmée' : 'Annulée'}</Badge>
            <Badge color={isPaid ? 'success' : booking.payment_status === 'partial' ? 'warning' : 'gray'}>{isPaid ? 'Payée' : booking.payment_status === 'partial' ? 'Paiement partiel' : 'Non payée'}</Badge>
          </div>
          <p className="text-xs text-text-tertiary">Réservé par {isOwner ? 'vous' : booking.user_name?.charAt(0) + '.'}</p>
        </div>

        {/* Booking details */}
        <Card elevated>
          <div className="space-y-3.5">
            {[
              { icon: <MapPin className="w-5 h-5 text-primary" />, title: courtLabel(booking.court_id), sub: 'Padel Camp Achères' },
              { icon: <Clock className="w-5 h-5 text-primary" />, title: `${formatTime(booking.start_time)} – ${formatTime(booking.end_time)}`, sub: formatDateFull(booking.date + 'T00:00') },
            ].map((row, i) => (
              <div key={i}>
                {i > 0 && <div className="border-t border-separator mb-3.5" />}
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-[10px] bg-primary/10 flex items-center justify-center shrink-0">{row.icon}</div>
                  <div>
                    <p className="text-sm font-semibold text-text">{row.title}</p>
                    <p className="text-xs text-text-secondary">{row.sub}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Payment summary */}
        <Card className={isPaid ? '!bg-success/5 !border !border-success/20' : ''}>
          <div className="flex items-center gap-2 mb-3">
            <Euro className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-text">Paiement</h3>
            {isPaid && <Lock className="w-3.5 h-3.5 text-success ml-auto" />}
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            {[
              { label: 'Total', value: totalPrice, color: 'text-primary', bg: 'bg-bg' },
              { label: 'Payé', value: amountPaid, color: 'text-success', bg: 'bg-success/10' },
              { label: 'Reste', value: amountRemaining, color: amountRemaining > 0 ? 'text-warning' : 'text-success', bg: amountRemaining > 0 ? 'bg-warning/10' : 'bg-success/10' },
            ].map((item) => (
              <div key={item.label} className={`rounded-[10px] ${item.bg} p-2.5`}>
                <p className="text-[10px] text-text-tertiary uppercase">{item.label}</p>
                <p className={`text-lg font-bold ${item.color}`}>{item.value.toFixed(2)}€</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-text-tertiary text-center mt-2">
            {totalPrice.toFixed(2)}€ le créneau · {share.toFixed(2)}€ / joueur (4 joueurs)
          </p>
        </Card>

        {/* Players — always 4 slots */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              <h3 className="font-semibold text-text">Joueurs ({filledPlayers.length}/4)</h3>
            </div>
          </div>
          <div className="space-y-2.5">
            {players.map((player, idx) => (
              <BookingPlayerCard
                key={player.id}
                player={player}
                idx={idx}
                userId={user?.id}
                isOwner={isOwner}
                isPaid={isPaid}
                share={share}
                submitting={submitting}
                onPayBalance={handlePayBalance}
                onPayExternal={handlePayExternal}
                onClearSlot={handleClearSlot}
                onOpenAdd={(slotId) => { setSelectedSlotId(slotId); setAddOpen(true); setSearchQuery('') }}
              />
            ))}
          </div>
        </Card>

        {isOwner && booking.status === 'confirmed' && (canCancel ? (
          <Button variant="danger" className="w-full" loading={cancelling} onClick={handleCancel}>
            <Trash2 className="w-4 h-4 mr-2" />Annuler la réservation
          </Button>
        ) : (
          <p className="text-xs text-text-tertiary text-center">Annulation impossible moins de 24h avant le créneau. Contactez le club.</p>
        ))}
      </div>

      <ConfirmModal {...confirmProps} />

      <Modal isOpen={addOpen} onClose={() => setAddOpen(false)} title="Ajouter un joueur">
        <BookingAddPlayer
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          searchResults={searchResults}
          searching={searching}
          submitting={submitting}
          onAssignMember={handleAssignMember}
          onAssignExternal={handleAssignExternal}
        />
      </Modal>
    </PageWrapper>
  )
}
