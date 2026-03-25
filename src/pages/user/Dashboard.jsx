import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useUserBookings } from '@/hooks/useBookings'
import { supabase } from '@/lib/supabase'
import { getMyInvitations, acceptInvitation, declineInvitation } from '@/services/bookingService'
import PageWrapper from '@/components/layout/PageWrapper'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import toast from 'react-hot-toast'
import {
  Wallet, CalendarDays, Trophy, Clock, ArrowUpRight,
  ArrowDownRight, Gift, CreditCard, ChevronRight, ChevronDown, ChevronUp,
  CheckCircle, Calendar, UserPlus, Banknote, X, Check, MapPin
} from 'lucide-react'
import { formatDateShort, formatTime, toDateString, monthTiny, dayNum, formatDateFull } from '@/utils/formatDate'

const TX_ICONS = {
  credit: { icon: ArrowDownRight, color: 'text-success', bg: 'bg-success/10' },
  credit_bonus: { icon: Gift, color: 'text-lime-dark', bg: 'bg-lime/20' },
  debit_session: { icon: ArrowUpRight, color: 'text-danger', bg: 'bg-danger/10' },
  debit_product: { icon: ArrowUpRight, color: 'text-warning', bg: 'bg-warning/10' },
  refund: { icon: ArrowDownRight, color: 'text-success', bg: 'bg-success/10' },
  external_payment: { icon: CreditCard, color: 'text-text-secondary', bg: 'bg-bg' },
}

export default function Dashboard() {
  const { profile, user } = useAuth()
  const { bookings: upcomingBookings, loading: bookingsLoading } = useUserBookings(user?.id)
  const [transactions, setTransactions] = useState([])
  const [txTotal, setTxTotal] = useState(0)
  const [nextTournament, setNextTournament] = useState(null)
  const [loadingTx, setLoadingTx] = useState(true)
  const [expanded, setExpanded] = useState([])
  const [showAllTx, setShowAllTx] = useState(false)

  // Booking stats
  const [bookingStats, setBookingStats] = useState({ completed: 0, upcoming: 0 })
  const [statsLoading, setStatsLoading] = useState(true)

  // Invitations
  const [invitations, setInvitations] = useState([])
  const [invitationsLoading, setInvitationsLoading] = useState(true)
  const [respondingTo, setRespondingTo] = useState(null) // invitation being responded to
  const [submitting, setSubmitting] = useState(false)

  const balance = parseFloat(profile?.balance || 0)
  const bonus = parseFloat(profile?.balance_bonus || 0)
  const total = balance + bonus

  const fetchInvitations = useCallback(async () => {
    if (!user?.id) return
    try {
      const data = await getMyInvitations(user.id)
      setInvitations(data)
    } catch (err) {
      console.error('[Dashboard] invitations fetch error:', err)
    } finally {
      setInvitationsLoading(false)
    }
  }, [user?.id])

  const handleAcceptInvitation = async (invitation, paymentMethod) => {
    setSubmitting(true)
    try {
      await acceptInvitation({ playerId: invitation.id, paymentMethod })
      toast.success('Invitation acceptée !')
      setRespondingTo(null)
      await fetchInvitations()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeclineInvitation = async (invitation) => {
    if (!confirm('Refuser cette invitation ?')) return
    setSubmitting(true)
    try {
      await declineInvitation(invitation.id)
      toast.success('Invitation refusée')
      setRespondingTo(null)
      await fetchInvitations()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  useEffect(() => {
    fetchInvitations()
  }, [fetchInvitations])

  useEffect(() => {
    if (!user?.id) return

    async function fetchData() {
      try {
        const [txRes, tRes, bStatsRes, txCountRes] = await Promise.all([
          supabase
            .from('transactions')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(20),
          supabase
            .from('tournament_registrations')
            .select('*, tournament:tournaments(*)')
            .or(`player1_uid.eq.${user.id},player2_uid.eq.${user.id}`)
            .not('status', 'eq', 'cancelled')
            .order('created_at', { ascending: false })
            .limit(1),
          supabase
            .from('bookings')
            .select('id, date, status')
            .eq('user_id', user.id)
            .eq('status', 'confirmed'),
          supabase
            .from('transactions')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', user.id),
        ])

        if (txRes.data) setTransactions(txRes.data)
        if (txCountRes.count) setTxTotal(txCountRes.count)
        if (tRes.data?.[0]?.tournament) setNextTournament(tRes.data[0])

        if (bStatsRes.data) {
          const today = toDateString(new Date())
          const completed = bStatsRes.data.filter((b) => b.date < today).length
          const upcoming = bStatsRes.data.filter((b) => b.date >= today).length
          setBookingStats({ completed, upcoming })
        }
      } catch (err) {
        console.error('[Dashboard] fetch error:', err)
      } finally {
        setLoadingTx(false)
        setStatsLoading(false)
      }
    }
    fetchData()
  }, [user?.id])

  const toggleExpand = (txId) => {
    setExpanded((prev) =>
      prev.includes(txId) ? prev.filter((id) => id !== txId) : [...prev, txId]
    )
  }

  const courtLabel = (courtId) => `Terrain ${courtId?.replace('terrain_', '') || '?'}`

  const visibleTx = showAllTx ? transactions : transactions.slice(0, 5)

  return (
    <PageWrapper>
      <div className="space-y-5">
        {/* Greeting */}
        <div>
          <p className="text-sm text-text-secondary">Bonjour</p>
          <h1 className="text-2xl font-bold text-text">{profile?.display_name}</h1>
        </div>

        {/* Invitations en attente */}
        {!invitationsLoading && invitations.length > 0 && (
          <Card className="!border-l-4 !border-l-warning">
            <div className="flex items-center gap-2 mb-3">
              <UserPlus className="w-4 h-4 text-warning" />
              <h3 className="font-semibold text-text text-sm">
                Invitations ({invitations.length})
              </h3>
            </div>
            <div className="space-y-2.5">
              {invitations.map((inv) => {
                const courtLabel = `Terrain ${inv.booking?.court_id?.replace('terrain_', '') || '?'}`
                return (
                  <div key={inv.id} className="rounded-[12px] bg-bg p-3">
                    <div className="flex items-start gap-3">
                      <div className="w-11 h-11 rounded-[10px] bg-primary/10 flex flex-col items-center justify-center shrink-0">
                        <span className="text-xs font-bold text-primary leading-none">
                          {inv.booking?.date ? dayNum(inv.booking.date + 'T00:00') : '?'}
                        </span>
                        <span className="text-[9px] text-primary/70 uppercase">
                          {inv.booking?.date ? monthTiny(inv.booking.date + 'T00:00') : ''}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-text">{courtLabel}</p>
                        <p className="text-xs text-text-secondary">
                          {formatTime(inv.booking?.start_time)} – {formatTime(inv.booking?.end_time)}
                        </p>
                        <p className="text-xs text-text-tertiary mt-0.5">
                          Invité par {inv.booking?.user_name}
                        </p>
                      </div>
                      <p className="text-sm font-bold text-primary shrink-0">
                        {parseFloat(inv.amount).toFixed(2)}€
                      </p>
                    </div>
                    <div className="flex gap-2 mt-3 pt-2.5 border-t border-separator/50">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="flex-1 !text-danger !border-danger/20"
                        onClick={() => handleDeclineInvitation(inv)}
                        loading={submitting}
                      >
                        <X className="w-3.5 h-3.5 mr-1" />Refuser
                      </Button>
                      <Button
                        size="sm"
                        className="flex-1"
                        onClick={() => setRespondingTo(inv)}
                      >
                        <Check className="w-3.5 h-3.5 mr-1" />Accepter
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>
        )}

        {/* Modal choix de paiement */}
        <Modal
          isOpen={!!respondingTo}
          onClose={() => setRespondingTo(null)}
          title="Choisir mon mode de paiement"
        >
          {respondingTo && (
            <div className="space-y-4">
              <div className="rounded-[12px] bg-bg p-4 text-center">
                <p className="text-xs text-text-secondary mb-1">Ma part</p>
                <p className="text-2xl font-bold text-primary">
                  {parseFloat(respondingTo.amount).toFixed(2)}€
                </p>
                <p className="text-xs text-text-tertiary mt-1">
                  {respondingTo.booking?.date && formatDateFull(respondingTo.booking.date + 'T00:00')}
                  {' · '}
                  {formatTime(respondingTo.booking?.start_time)} – {formatTime(respondingTo.booking?.end_time)}
                </p>
              </div>

              <div className="space-y-2">
                <Button
                  className="w-full"
                  onClick={() => handleAcceptInvitation(respondingTo, 'balance')}
                  loading={submitting}
                >
                  <Wallet className="w-4 h-4 mr-2" />
                  Payer avec mon solde ({total.toFixed(2)}€)
                </Button>
                <Button
                  variant="ghost"
                  className="w-full"
                  onClick={() => handleAcceptInvitation(respondingTo, 'cb')}
                  loading={submitting}
                >
                  <CreditCard className="w-4 h-4 mr-2" />
                  Carte bancaire (sur place)
                </Button>
                <Button
                  variant="ghost"
                  className="w-full"
                  onClick={() => handleAcceptInvitation(respondingTo, 'cash')}
                  loading={submitting}
                >
                  <Banknote className="w-4 h-4 mr-2" />
                  Espèces (sur place)
                </Button>
              </div>
            </div>
          )}
        </Modal>

        {/* Solde */}
        <Card elevated className="!bg-gradient-to-br !from-primary !to-primary-dark !text-white">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Wallet className="w-4 h-4 text-white/60" />
                <p className="text-sm text-white/60">Mon solde</p>
              </div>
              <p className="text-3xl font-bold">{total.toFixed(2)} €</p>
            </div>
            <Link to="/profile">
              <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
                <span className="text-lg font-bold text-lime">
                  {profile?.display_name?.charAt(0)?.toUpperCase() || '?'}
                </span>
              </div>
            </Link>
          </div>
          <div className="flex gap-4 mt-4 pt-3 border-t border-white/10">
            <div className="flex-1">
              <p className="text-xs text-white/40">Solde réel</p>
              <p className="text-sm font-semibold">{balance.toFixed(2)} €</p>
            </div>
            <div className="flex-1">
              <p className="text-xs text-white/40">Bonus offert</p>
              <p className="text-sm font-semibold text-lime">{bonus.toFixed(2)} €</p>
            </div>
          </div>
        </Card>

        {/* Stats réservations + Quick actions */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="!p-3 text-center">
            <CheckCircle className="w-5 h-5 text-success mx-auto mb-1" />
            <p className="text-lg font-bold text-text">{statsLoading ? '—' : bookingStats.completed}</p>
            <p className="text-[10px] text-text-tertiary">Terminées</p>
          </Card>
          <Card className="!p-3 text-center">
            <Calendar className="w-5 h-5 text-primary mx-auto mb-1" />
            <p className="text-lg font-bold text-text">{statsLoading ? '—' : bookingStats.upcoming}</p>
            <p className="text-[10px] text-text-tertiary">À venir</p>
          </Card>
          <Link to="/booking">
            <Card className="!p-3 text-center hover:shadow-[0_4px_12px_rgba(11,39,120,0.15)] transition-shadow cursor-pointer h-full flex flex-col items-center justify-center">
              <CalendarDays className="w-5 h-5 text-primary mx-auto mb-1" />
              <p className="text-[10px] font-semibold text-primary">Réserver</p>
            </Card>
          </Link>
        </div>

        {/* Prochaines résas */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-text">Prochaines réservations</h3>
            <Link to="/booking" className="text-xs text-primary font-medium hover:underline">Réserver</Link>
          </div>
          {bookingsLoading ? (
            <div className="space-y-2">
              {[1, 2].map((i) => <div key={i} className="h-14 rounded-[12px] bg-bg animate-pulse" />)}
            </div>
          ) : upcomingBookings.length > 0 ? (
            <div className="space-y-2">
              {upcomingBookings.map((b) => (
                <Link key={b.id} to={`/booking/${b.id}`} className="flex items-center gap-3 p-3 rounded-[12px] bg-bg hover:bg-primary/5 transition-colors">
                  <div className="w-11 h-11 rounded-[10px] bg-primary/10 flex flex-col items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-primary leading-none">{dayNum(b.date + 'T00:00')}</span>
                    <span className="text-[9px] text-primary/70 uppercase">{monthTiny(b.date + 'T00:00')}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text">{courtLabel(b.court_id)}</p>
                    <p className="text-xs text-text-secondary">{formatTime(b.start_time)} – {formatTime(b.end_time)}</p>
                  </div>
                  <p className="text-sm font-semibold text-primary">{parseFloat(b.price).toFixed(0)}€</p>
                  <ChevronRight className="w-4 h-4 text-text-tertiary" />
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-6">
              <CalendarDays className="w-8 h-8 text-text-tertiary mx-auto mb-2" />
              <p className="text-sm text-text-tertiary">Aucune réservation à venir</p>
              <Link to="/booking">
                <Button variant="ghost" size="sm" className="mt-2">Réserver un terrain</Button>
              </Link>
            </div>
          )}
        </Card>

        {/* Prochain tournoi */}
        {nextTournament && (
          <Card className="!border-l-4 !border-l-lime">
            <div className="flex items-center gap-2 mb-2">
              <Trophy className="w-4 h-4 text-primary" />
              <h3 className="font-semibold text-text text-sm">Prochain tournoi</h3>
            </div>
            <p className="text-sm font-medium">{nextTournament.tournament.name}</p>
            <p className="text-xs text-text-secondary mt-0.5">
              {formatDateShort(nextTournament.tournament.date)} · {formatTime(nextTournament.tournament.start_time)} · {nextTournament.tournament.level}
            </p>
            <div className="mt-2">
              <Badge color={nextTournament.status === 'confirmed' ? 'success' : 'warning'}>
                {nextTournament.status === 'confirmed' ? 'Confirmé'
                  : nextTournament.status === 'approved' ? 'Validé'
                  : nextTournament.status === 'pending_partner' ? 'En attente partenaire'
                  : nextTournament.status === 'pending_admin' ? 'En attente validation'
                  : nextTournament.status}
              </Badge>
            </div>
          </Card>
        )}

        {/* Transactions avec expand */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-text">
              Transactions récentes {txTotal > 0 && <span className="text-text-tertiary font-normal">({txTotal})</span>}
            </h3>
          </div>
          {loadingTx ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <div key={i} className="h-12 rounded-[12px] bg-bg animate-pulse" />)}
            </div>
          ) : transactions.length > 0 ? (
            <>
              <div className="space-y-1">
                {visibleTx.map((tx) => {
                  const meta = TX_ICONS[tx.type] || TX_ICONS.external_payment
                  const Icon = meta.icon
                  const isDebit = tx.type.startsWith('debit') || tx.type === 'external_payment'
                  const isExpanded = expanded.includes(tx.id)
                  const txDate = new Date(tx.created_at)

                  return (
                    <div key={tx.id}>
                      <button
                        onClick={() => toggleExpand(tx.id)}
                        className="w-full flex items-center gap-3 py-2.5 px-1 rounded-[10px] hover:bg-bg/50 transition-colors text-left cursor-pointer"
                      >
                        <div className={`w-9 h-9 rounded-[10px] ${meta.bg} flex items-center justify-center shrink-0`}>
                          <Icon className={`w-4 h-4 ${meta.color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-text truncate">{tx.description}</p>
                          <p className="text-[11px] text-text-tertiary">
                            {txDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                            {' · '}
                            {txDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                        <p className={`text-sm font-semibold shrink-0 ${isDebit ? 'text-danger' : 'text-success'}`}>
                          {isDebit ? '-' : '+'}{parseFloat(tx.amount).toFixed(2)}€
                        </p>
                        {isExpanded
                          ? <ChevronUp className="w-4 h-4 text-text-tertiary shrink-0" />
                          : <ChevronDown className="w-4 h-4 text-text-tertiary shrink-0" />
                        }
                      </button>

                      {/* Expanded details */}
                      {isExpanded && (
                        <div className="ml-12 mr-1 mb-2 p-3 rounded-[10px] bg-bg space-y-1.5 text-xs">
                          <div className="flex justify-between">
                            <span className="text-text-secondary">Type</span>
                            <Badge color={isDebit ? 'danger' : 'success'}>
                              {tx.type === 'credit' ? 'Crédit'
                                : tx.type === 'credit_bonus' ? 'Bonus'
                                : tx.type === 'debit_session' ? 'Session'
                                : tx.type === 'debit_product' ? 'Article'
                                : tx.type === 'refund' ? 'Remboursement'
                                : 'Paiement ext.'}
                            </Badge>
                          </div>
                          {parseFloat(tx.bonus_used || 0) > 0 && (
                            <div className="flex justify-between">
                              <span className="text-text-secondary">Bonus utilisé</span>
                              <span className="font-medium text-lime-dark">{parseFloat(tx.bonus_used).toFixed(2)}€</span>
                            </div>
                          )}
                          {parseFloat(tx.real_used || 0) > 0 && (
                            <div className="flex justify-between">
                              <span className="text-text-secondary">Solde réel utilisé</span>
                              <span className="font-medium">{parseFloat(tx.real_used).toFixed(2)}€</span>
                            </div>
                          )}
                          {tx.formula_amount_paid && (
                            <div className="flex justify-between">
                              <span className="text-text-secondary">Formule</span>
                              <span className="font-medium">
                                {parseFloat(tx.formula_amount_paid).toFixed(0)}€ → {parseFloat(tx.formula_amount_credited).toFixed(0)}€
                                {tx.formula_bonus && <span className="text-lime-dark"> (+{parseFloat(tx.formula_bonus).toFixed(0)}€)</span>}
                              </span>
                            </div>
                          )}
                          {tx.payment_method && (
                            <div className="flex justify-between">
                              <span className="text-text-secondary">Paiement</span>
                              <span className="font-medium capitalize">{tx.payment_method}</span>
                            </div>
                          )}
                          <div className="flex justify-between">
                            <span className="text-text-secondary">Date complète</span>
                            <span className="font-medium">
                              {txDate.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                              {' '}{txDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Show more / less */}
              {transactions.length > 5 && (
                <button
                  onClick={() => setShowAllTx(!showAllTx)}
                  className="w-full mt-3 py-2 text-xs font-medium text-primary hover:underline cursor-pointer text-center"
                >
                  {showAllTx ? 'Voir moins' : `Voir tout (${transactions.length})`}
                </button>
              )}
            </>
          ) : (
            <div className="text-center py-4">
              <Clock className="w-6 h-6 text-text-tertiary mx-auto mb-1" />
              <p className="text-sm text-text-tertiary">Aucune activité récente</p>
            </div>
          )}
        </Card>
      </div>
    </PageWrapper>
  )
}
