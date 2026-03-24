import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import {
  getBookingWithPlayers, assignPlayerToSlot, searchMembers,
  cancelBooking, payPlayerShare, markPlayerExternal, clearSlot, partPrice
} from '@/services/bookingService'
import { supabase } from '@/lib/supabase'
import { formatDateFull, formatTime } from '@/utils/formatDate'
import PageWrapper from '@/components/layout/PageWrapper'
import Card from '@/components/ui/Card'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import toast from 'react-hot-toast'
import {
  MapPin, Clock, Euro, Users, UserPlus, Search,
  Check, Trash2, CreditCard, Banknote, Wallet, X, Lock
} from 'lucide-react'

const PAY_BADGE = {
  paid: { color: 'success', label: 'Payé' },
  external: { color: 'primary', label: 'CB/Espèces' },
  pending: { color: 'warning', label: 'En attente' },
}

const courtLabel = (courtId) => `Terrain ${courtId?.replace('terrain_', '') || '?'}`

export default function BookingConfirm() {
  const { id } = useParams()
  const { user, profile } = useAuth()
  const navigate = useNavigate()

  const [booking, setBooking] = useState(null)
  const [players, setPlayers] = useState([])
  const [loading, setLoading] = useState(true)

  // Add player modal
  const [addOpen, setAddOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [addingExternal, setAddingExternal] = useState(false)
  const [externalName, setExternalName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [cancelling, setCancelling] = useState(false)

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

  // Search members
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

  // Empty slots = "Place disponible"
  const emptySlots = players.filter((p) => p.player_name === 'Place disponible')
  const filledPlayers = players.filter((p) => p.player_name !== 'Place disponible')
  const [selectedSlotId, setSelectedSlotId] = useState(null) // slot being assigned

  const canCancel = booking && (() => {
    const dt = new Date(`${booking.date}T${booking.start_time}`)
    return (dt - new Date()) > 24 * 60 * 60 * 1000
  })()

  // Assign member to empty slot
  const handleAssignMember = async (member) => {
    const slot = emptySlots[0]
    if (!slot) { toast.error('Aucune place disponible'); return }
    setSubmitting(true)
    try {
      await assignPlayerToSlot({
        slotId: selectedSlotId || slot.id,
        bookingId: id,
        userId: member.id,
        playerName: member.display_name,
        paymentMethod: 'balance',
      })
      toast.success(`${member.display_name} ajouté`)
      setAddOpen(false)
      setSearchQuery('')
      setSelectedSlotId(null)
      await fetchData()
    } catch (err) { toast.error(err.message) }
    finally { setSubmitting(false) }
  }

  // Assign external player to empty slot
  const handleAssignExternal = async () => {
    if (!externalName.trim()) { toast.error('Nom obligatoire'); return }
    const slot = emptySlots[0]
    if (!slot) { toast.error('Aucune place disponible'); return }
    setSubmitting(true)
    try {
      await assignPlayerToSlot({
        slotId: selectedSlotId || slot.id,
        bookingId: id,
        userId: null,
        playerName: externalName.trim(),
        paymentMethod: 'cb',
      })
      toast.success(`${externalName.trim()} ajouté`)
      setAddOpen(false)
      setExternalName('')
      setAddingExternal(false)
      setSelectedSlotId(null)
      await fetchData()
    } catch (err) { toast.error(err.message) }
    finally { setSubmitting(false) }
  }

  // Pay a player's share from balance
  const handlePayBalance = async (player) => {
    if (!confirm(`Débiter ${parseFloat(player.amount).toFixed(2)}€ du solde de ${player.player_name} ?`)) return
    setSubmitting(true)
    try {
      await payPlayerShare({
        playerId: player.id,
        bookingId: id,
        userId: player.user_id,
        amount: parseFloat(player.amount),
        performedBy: user.id,
      })
      toast.success(`${player.player_name} payé`)
      await fetchData()
    } catch (err) { toast.error(err.message) }
    finally { setSubmitting(false) }
  }

  // Mark as external payment
  const handlePayExternal = async (player, method) => {
    setSubmitting(true)
    try {
      await markPlayerExternal({
        playerId: player.id,
        bookingId: id,
        paymentMethod: method,
        amount: parseFloat(player.amount),
        playerName: player.player_name,
        performedBy: user.id,
      })
      toast.success(`${player.player_name} — paiement ${method} enregistré`)
      await fetchData()
    } catch (err) { toast.error(err.message) }
    finally { setSubmitting(false) }
  }

  // Reset slot back to "Place disponible"
  const handleClearSlot = async (player) => {
    if (!confirm(`Retirer ${player.player_name} ?`)) return
    setSubmitting(true)
    try {
      await clearSlot(player.id)
      // Reset amount
      const { error } = await supabase
        .from('booking_players')
        .update({ amount: share })
        .eq('id', player.id)
      if (error) throw error
      toast.success(`${player.player_name} retiré`)
      await fetchData()
    } catch (err) { toast.error(err.message) }
    finally { setSubmitting(false) }
  }

  const handleCancel = async () => {
    if (!confirm('Annuler cette réservation ?')) return
    setCancelling(true)
    try {
      await cancelBooking(id, 'user')
      toast.success('Réservation annulée')
      navigate('/dashboard')
    } catch (err) { toast.error(err.message) }
    finally { setCancelling(false) }
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
        {/* Status badges */}
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            <Badge color={booking.status === 'confirmed' ? 'success' : 'danger'}>
              {booking.status === 'confirmed' ? 'Confirmée' : 'Annulée'}
            </Badge>
            <Badge color={isPaid ? 'success' : booking.payment_status === 'partial' ? 'warning' : 'gray'}>
              {isPaid ? 'Payée' : booking.payment_status === 'partial' ? 'Paiement partiel' : 'Non payée'}
            </Badge>
          </div>
          <p className="text-xs text-text-tertiary">
            Réservé par {isOwner ? 'vous' : booking.user_name?.charAt(0) + '.'}
          </p>
        </div>

        {/* Booking details */}
        <Card elevated>
          <div className="space-y-3.5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-[10px] bg-primary/10 flex items-center justify-center shrink-0">
                <MapPin className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-text">{courtLabel(booking.court_id)}</p>
                <p className="text-xs text-text-secondary">Padel Camp Achères</p>
              </div>
            </div>
            <div className="border-t border-separator" />
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-[10px] bg-primary/10 flex items-center justify-center shrink-0">
                <Clock className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-text">
                  {formatTime(booking.start_time)} – {formatTime(booking.end_time)}
                </p>
                <p className="text-xs text-text-secondary">{formatDateFull(booking.date + 'T00:00')}</p>
              </div>
            </div>
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
            <div className="rounded-[10px] bg-bg p-2.5">
              <p className="text-[10px] text-text-tertiary uppercase">Total</p>
              <p className="text-lg font-bold text-primary">{totalPrice.toFixed(2)}€</p>
            </div>
            <div className="rounded-[10px] bg-success/10 p-2.5">
              <p className="text-[10px] text-text-tertiary uppercase">Payé</p>
              <p className="text-lg font-bold text-success">{amountPaid.toFixed(2)}€</p>
            </div>
            <div className={`rounded-[10px] p-2.5 ${amountRemaining > 0 ? 'bg-warning/10' : 'bg-success/10'}`}>
              <p className="text-[10px] text-text-tertiary uppercase">Reste</p>
              <p className={`text-lg font-bold ${amountRemaining > 0 ? 'text-warning' : 'text-success'}`}>
                {amountRemaining.toFixed(2)}€
              </p>
            </div>
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
            {players.map((player, idx) => {
              const isPlayer1 = idx === 0
              const isEmpty = player.player_name === 'Place disponible'
              const badge = PAY_BADGE[player.payment_status] || PAY_BADGE.pending
              const isPending = player.payment_status === 'pending'
              const isMember = !!player.user_id

              // Empty slot
              if (isEmpty) {
                return (
                  <div key={player.id} className="rounded-[12px] border-2 border-dashed border-separator p-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-bg flex items-center justify-center shrink-0">
                        <span className="text-sm text-text-tertiary">{idx + 1}</span>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-text-tertiary">Place disponible</p>
                        <p className="text-xs text-text-tertiary">{share.toFixed(2)}€</p>
                      </div>
                      {!isPaid && isOwner && (
                        <Button
                          variant="ghost" size="sm"
                          onClick={() => { setSelectedSlotId(player.id); setAddOpen(true); setAddingExternal(false); setSearchQuery('') }}
                        >
                          <UserPlus className="w-4 h-4 mr-1" />Inviter
                        </Button>
                      )}
                    </div>
                  </div>
                )
              }

              // Filled slot
              return (
                <div key={player.id} className="rounded-[12px] bg-bg p-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-sm font-bold text-primary">
                        {player.player_name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-medium text-text truncate">{player.player_name}</p>
                        {isPlayer1 && <span className="text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium">Réservant</span>}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Badge color={isMember ? 'primary' : 'gray'}>
                          {isMember ? 'Membre' : 'Externe'}
                        </Badge>
                        <Badge color={badge.color}>{badge.label}</Badge>
                      </div>
                    </div>
                    <p className="text-sm font-bold text-primary">{parseFloat(player.amount).toFixed(2)}€</p>
                  </div>

                  {/* Payment actions for pending players */}
                  {isPending && !isPaid && isOwner && (
                    <div className="flex gap-2 mt-2.5 pt-2.5 border-t border-separator/50">
                      {isMember && (
                        <Button size="sm" className="flex-1" onClick={() => handlePayBalance(player)} loading={submitting}>
                          <Wallet className="w-3.5 h-3.5 mr-1" />Solde
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" className="flex-1" onClick={() => handlePayExternal(player, 'cb')} loading={submitting}>
                        <CreditCard className="w-3.5 h-3.5 mr-1" />CB
                      </Button>
                      <Button size="sm" variant="ghost" className="flex-1" onClick={() => handlePayExternal(player, 'cash')} loading={submitting}>
                        <Banknote className="w-3.5 h-3.5 mr-1" />Espèces
                      </Button>
                    </div>
                  )}

                  {/* Clear slot (not player 1, not paid) */}
                  {!isPlayer1 && isPending && !isPaid && isOwner && (
                    <button
                      onClick={() => handleClearSlot(player)}
                      className="mt-2 text-xs text-danger hover:underline cursor-pointer"
                    >
                      Retirer ce joueur
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </Card>

        {/* Cancel */}
        {isOwner && booking.status === 'confirmed' && (
          <div>
            {canCancel ? (
              <Button variant="danger" className="w-full" loading={cancelling} onClick={handleCancel}>
                <Trash2 className="w-4 h-4 mr-2" />Annuler la réservation
              </Button>
            ) : (
              <p className="text-xs text-text-tertiary text-center">
                Annulation impossible moins de 24h avant le créneau. Contactez le club.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Add player modal */}
      <Modal
        isOpen={addOpen}
        onClose={() => { setAddOpen(false); setAddingExternal(false) }}
        title="Ajouter un joueur"
      >
        <div className="space-y-4">
          {!addingExternal ? (
            <>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
                <input
                  type="text"
                  placeholder="Rechercher un membre..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-[12px] bg-bg border border-separator text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  autoFocus
                />
              </div>

              {searching ? (
                <div className="py-4 text-center">
                  <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                </div>
              ) : searchResults.length > 0 ? (
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {searchResults.map((member) => (
                    <button
                      key={member.id}
                      onClick={() => handleAssignMember(member)}
                      disabled={submitting}
                      className="w-full flex items-center gap-3 p-3 rounded-[12px] hover:bg-bg transition-colors text-left cursor-pointer"
                    >
                      <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="text-sm font-bold text-primary">
                          {member.display_name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-text truncate">{member.display_name}</p>
                        <p className="text-xs text-text-tertiary">
                          Solde: {(parseFloat(member.balance || 0) + parseFloat(member.balance_bonus || 0)).toFixed(2)}€
                        </p>
                      </div>
                      <UserPlus className="w-4 h-4 text-primary shrink-0" />
                    </button>
                  ))}
                </div>
              ) : searchQuery.length >= 2 ? (
                <p className="text-sm text-text-tertiary text-center py-3">Aucun membre trouvé</p>
              ) : null}

              <div className="border-t border-separator pt-3">
                <button
                  onClick={() => setAddingExternal(true)}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-[12px] bg-bg hover:bg-primary/5 transition-colors text-sm font-medium text-primary cursor-pointer"
                >
                  <UserPlus className="w-4 h-4" />Joueur externe (non-membre)
                </button>
              </div>
            </>
          ) : (
            <>
              <button onClick={() => setAddingExternal(false)} className="text-xs text-primary font-medium hover:underline cursor-pointer">
                &larr; Retour
              </button>
              <Input
                label="Nom du joueur"
                placeholder="Jean Dupont"
                value={externalName}
                onChange={(e) => setExternalName(e.target.value)}
                autoFocus
              />
              <div className="bg-bg rounded-[12px] p-3 text-center">
                <p className="text-xs text-text-secondary">Part par joueur</p>
                <p className="text-lg font-bold text-primary">{share.toFixed(2)}€</p>
              </div>
              <Button className="w-full" loading={submitting} onClick={handleAssignExternal}>
                <Check className="w-4 h-4 mr-1" />Ajouter
              </Button>
            </>
          )}
        </div>
      </Modal>
    </PageWrapper>
  )
}
