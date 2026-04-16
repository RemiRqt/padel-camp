import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useUserBookings } from '@/hooks/useBookings'
import { getMyInvitations, acceptInvitation, declineInvitation } from '@/services/bookingService'
import { fetchUserDashboard } from '@/services/dashboardService'
import ConfirmModal from '@/components/ui/ConfirmModal'
import ErrorState from '@/components/ui/ErrorState'
import useConfirm from '@/hooks/useConfirm'
import PageWrapper from '@/components/layout/PageWrapper'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import DashboardConfirmations from '@/components/features/dashboard/DashboardConfirmations'
import DashboardInvitations from '@/components/features/dashboard/DashboardInvitations'
import DashboardTransactions from '@/components/features/dashboard/DashboardTransactions'
import toast from 'react-hot-toast'
import {
  Wallet, CalendarDays, Trophy, Clock,
  CheckCircle, Calendar, ChevronRight
} from 'lucide-react'
import { formatDateShort, formatTime, toDateString, monthTiny, dayNum, formatDateFull } from '@/utils/formatDate'

export default function Dashboard() {
  const { profile, user } = useAuth()
  const { bookings: upcomingBookings, loading: bookingsLoading } = useUserBookings(user?.id)
  const [transactions, setTransactions] = useState([])
  const [txTotal, setTxTotal] = useState(0)
  const [nextTournament, setNextTournament] = useState(null)
  const [pendingConfirmations, setPendingConfirmations] = useState([])
  const [loadingTx, setLoadingTx] = useState(true)
  const [fetchError, setFetchError] = useState(false)

  // Booking stats
  const [bookingStats, setBookingStats] = useState({ completed: 0, upcoming: 0 })
  const [statsLoading, setStatsLoading] = useState(true)

  // Invitations
  const [invitations, setInvitations] = useState([])
  const [invitationsLoading, setInvitationsLoading] = useState(true)
  const [respondingTo, setRespondingTo] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const { confirmProps, askConfirm } = useConfirm()

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
      await acceptInvitation({ playerId: invitation.id, paymentMethod, userId: user.id })
      toast.success(paymentMethod === 'balance' ? 'Invitation acceptée et payée !' : 'Invitation acceptée !')
      setRespondingTo(null)
      await fetchInvitations()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeclineInvitation = (invitation) => {
    askConfirm({
      message: 'Refuser cette invitation ?',
      onConfirm: async () => {
        setSubmitting(true)
        try {
          await declineInvitation(invitation.id, user.id)
          toast.success('Invitation refusée')
          setRespondingTo(null)
          await fetchInvitations()
        } catch (err) {
          toast.error(err.message)
        } finally {
          setSubmitting(false)
        }
      },
    })
  }

  useEffect(() => {
    fetchInvitations()
  }, [fetchInvitations])

  const fetchDashboard = useCallback(async () => {
    if (!user?.id) return
    setFetchError(false)
    setLoadingTx(true)
    setStatsLoading(true)
    try {
        const result = await fetchUserDashboard(user.id)
        setTransactions(result.transactions)
        setTxTotal(result.txTotal)
        setBookingStats(result.bookingStats)

        if (result.registrations[0]) setNextTournament(result.registrations[0])

        const now = new Date()
        const pending = result.registrations.filter((r) => {
          if (r.status !== 'approved') return false
          const deadline = r.tournament?.confirmation_deadline
          if (!deadline) return false
          const deadlineDate = new Date(deadline)
          const tournamentStart = new Date(`${r.tournament.date}T${r.tournament.start_time}`)
          if (now < deadlineDate || now > tournamentStart) return false
          const isP1 = r.player1_uid === user.id
          return isP1 ? !r.player1_confirmed : !r.player2_confirmed
        })
        setPendingConfirmations(pending)
      } catch (err) {
        console.error('[Dashboard] fetch error:', err)
        setFetchError(true)
      } finally {
        setLoadingTx(false)
        setStatsLoading(false)
      }
  }, [user?.id])

  useEffect(() => {
    fetchDashboard()
  }, [fetchDashboard])

  const courtLabel = (courtId) => `Terrain ${courtId?.replace('terrain_', '') || '?'}`

  if (fetchError && !transactions.length) {
    return (
      <PageWrapper>
        <ErrorState message="Impossible de charger le tableau de bord" onRetry={fetchDashboard} />
      </PageWrapper>
    )
  }

  return (
    <PageWrapper>
      <div className="space-y-5">
        {/* Greeting */}
        <div>
          <p className="text-sm text-text-secondary">Bonjour</p>
          <h1 className="text-2xl font-bold text-text">{profile?.display_name}</h1>
        </div>

        {/* Confirmations tournoi 48h */}
        <DashboardConfirmations confirmations={pendingConfirmations} />

        {/* Invitations en attente */}
        <DashboardInvitations
          invitations={invitations}
          loading={invitationsLoading}
          respondingTo={respondingTo}
          setRespondingTo={setRespondingTo}
          submitting={submitting}
          total={total}
          onAccept={handleAcceptInvitation}
          onDecline={handleDeclineInvitation}
          formatTime={formatTime}
          formatDateFull={formatDateFull}
          dayNum={dayNum}
          monthTiny={monthTiny}
        />

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

        {/* Transactions */}
        <DashboardTransactions transactions={transactions} txTotal={txTotal} loading={loadingTx} />
      </div>
      <ConfirmModal {...confirmProps} />
    </PageWrapper>
  )
}
