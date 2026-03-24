import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import {
  fetchUserRegistrations, acceptPartnerInvite, declinePartnerInvite,
  confirmParticipation, cancelRegistrationAndPromote
} from '@/services/tournamentService'
import { formatDateShort, formatTime } from '@/utils/formatDate'
import PageWrapper from '@/components/layout/PageWrapper'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import toast from 'react-hot-toast'
import {
  Trophy, Calendar, Clock, Users, ChevronRight, Check, X,
  AlertCircle, Bell
} from 'lucide-react'

const REG_STATUS_LABELS = {
  pending_partner: 'En attente partenaire',
  pending_admin: 'En attente validation',
  approved: 'Validée — confirmation requise',
  waitlist: 'File d\'attente',
  confirmed: 'Confirmée',
  cancelled: 'Annulée',
}
const REG_STATUS_COLORS = {
  pending_partner: 'warning', pending_admin: 'warning', approved: 'success',
  waitlist: 'gray', confirmed: 'primary', cancelled: 'danger',
}

export default function MyTournaments() {
  const { user } = useAuth()
  const [registrations, setRegistrations] = useState([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(null) // reg id

  const loadData = async () => {
    if (!user?.id) return
    setLoading(true)
    const data = await fetchUserRegistrations(user.id)
    setRegistrations(data)
    setLoading(false)
  }

  useEffect(() => { loadData() }, [user?.id])

  const isPlayer1 = (reg) => reg.player1_uid === user?.id
  const isPlayer2 = (reg) => reg.player2_uid === user?.id
  const myPlayerNumber = (reg) => isPlayer1(reg) ? 1 : 2
  const myConfirmed = (reg) => isPlayer1(reg) ? reg.player1_confirmed : reg.player2_confirmed

  // Check if 48h confirmation window is open
  const isConfirmationWindow = (reg) => {
    if (!reg.tournament?.confirmation_deadline) return false
    const deadline = new Date(reg.tournament.confirmation_deadline)
    const now = new Date()
    return now >= deadline && reg.status === 'approved'
  }

  // Pending partner invitations (I'm player2 and status is pending_partner)
  const pendingInvites = registrations.filter(
    (r) => isPlayer2(r) && r.status === 'pending_partner'
  )
  const activeRegs = registrations.filter(
    (r) => !['cancelled'].includes(r.status) && !(isPlayer2(r) && r.status === 'pending_partner')
  )
  const pastRegs = registrations.filter((r) => r.status === 'cancelled')

  const handleAccept = async (regId) => {
    setActionLoading(regId)
    try {
      await acceptPartnerInvite(regId)
      toast.success('Invitation acceptée ! En attente de validation admin.')
      loadData()
    } catch (err) { toast.error(err.message) }
    finally { setActionLoading(null) }
  }

  const handleDecline = async (regId) => {
    if (!confirm('Refuser cette invitation ?')) return
    setActionLoading(regId)
    try {
      await declinePartnerInvite(regId)
      toast.success('Invitation refusée')
      loadData()
    } catch (err) { toast.error(err.message) }
    finally { setActionLoading(null) }
  }

  const handleConfirm = async (reg) => {
    setActionLoading(reg.id)
    try {
      const result = await confirmParticipation(reg.id, myPlayerNumber(reg))
      if (result.status === 'confirmed') {
        toast.success('Participation confirmée pour la paire !')
      } else {
        toast.success('Votre confirmation est enregistrée. En attente de votre partenaire.')
      }
      loadData()
    } catch (err) { toast.error(err.message) }
    finally { setActionLoading(null) }
  }

  const handleCancel = async (reg) => {
    if (!confirm('Annuler votre inscription ? Si une paire est en file d\'attente, elle sera promue.')) return
    setActionLoading(reg.id)
    try {
      const promoted = await cancelRegistrationAndPromote(reg.id, reg.tournament_id)
      toast.success(promoted
        ? `Inscription annulée. ${promoted.player1_name} & ${promoted.player2_name} ont été promus.`
        : 'Inscription annulée'
      )
      loadData()
    } catch (err) { toast.error(err.message) }
    finally { setActionLoading(null) }
  }

  return (
    <PageWrapper>
      <div className="space-y-5">
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-primary" />
          <h1 className="text-2xl font-bold text-text">Mes Tournois</h1>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <div key={i} className="h-28 rounded-[16px] bg-white animate-pulse" />)}
          </div>
        ) : (
          <>
            {/* Pending invitations */}
            {pendingInvites.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-warning" />
                  <p className="text-xs font-semibold text-warning uppercase tracking-wider">
                    Invitations en attente ({pendingInvites.length})
                  </p>
                </div>
                {pendingInvites.map((reg) => (
                  <Card key={reg.id} className="!border-l-4 !border-l-warning">
                    <div className="space-y-3">
                      <div>
                        <p className="text-sm font-bold text-text">{reg.tournament?.name}</p>
                        <p className="text-xs text-text-secondary mt-0.5">
                          {reg.tournament?.date && formatDateShort(reg.tournament.date + 'T00:00')}
                          {reg.tournament?.start_time && ` · ${formatTime(reg.tournament.start_time)}`}
                          {' · '}{reg.tournament?.level} · {reg.tournament?.category}
                        </p>
                      </div>
                      <div className="rounded-[10px] bg-bg p-2.5">
                        <p className="text-xs text-text-secondary">
                          <strong>{reg.player1_name}</strong> vous invite à former une paire
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="flex-1"
                          loading={actionLoading === reg.id}
                          onClick={() => handleAccept(reg.id)}
                        >
                          <Check className="w-4 h-4 mr-1" />Accepter
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          className="flex-1"
                          loading={actionLoading === reg.id}
                          onClick={() => handleDecline(reg.id)}
                        >
                          <X className="w-4 h-4 mr-1" />Refuser
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}

            {/* Active registrations */}
            {activeRegs.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
                  Mes inscriptions ({activeRegs.length})
                </p>
                {activeRegs.map((reg) => {
                  const t = reg.tournament
                  const needsConfirmation = reg.status === 'approved' && !myConfirmed(reg)
                  const inWindow = isConfirmationWindow(reg)
                  const partnerName = isPlayer1(reg) ? reg.player2_name : reg.player1_name

                  return (
                    <Card key={reg.id}>
                      <div className="space-y-3">
                        <div className="flex items-start justify-between">
                          <Link to={`/tournaments/${reg.tournament_id}`} className="flex-1 min-w-0">
                            <h3 className="text-sm font-bold text-text truncate hover:text-primary transition-colors">
                              {t?.name}
                            </h3>
                            <p className="text-xs text-text-secondary mt-0.5">
                              {t?.date && formatDateShort(t.date + 'T00:00')}
                              {t?.start_time && ` · ${formatTime(t.start_time)}`}
                              {' · '}{t?.level}
                            </p>
                          </Link>
                          <Badge color={REG_STATUS_COLORS[reg.status]}>
                            {REG_STATUS_LABELS[reg.status]}
                          </Badge>
                        </div>

                        {/* Pair info */}
                        <div className="flex items-center gap-2 py-2 px-3 rounded-[10px] bg-bg">
                          <Users className="w-4 h-4 text-primary shrink-0" />
                          <p className="text-sm">
                            <span className="font-medium">{reg.player1_name}</span>
                            <span className="text-text-tertiary"> & </span>
                            <span className="font-medium">{reg.player2_name}</span>
                            {reg.player2_is_external && <span className="text-xs text-text-tertiary"> (ext.)</span>}
                          </p>
                        </div>

                        {/* Waitlist position */}
                        {reg.status === 'waitlist' && reg.position && (
                          <div className="flex items-center gap-2 text-xs text-text-secondary">
                            <Clock className="w-3.5 h-3.5" />
                            Position en file d'attente: <strong>#{reg.position}</strong>
                          </div>
                        )}

                        {/* Confirmation status for approved */}
                        {reg.status === 'approved' && (
                          <div className="space-y-2">
                            <div className="flex items-center gap-4 text-xs">
                              <span className={`flex items-center gap-1 ${reg.player1_confirmed ? 'text-success' : 'text-text-tertiary'}`}>
                                {reg.player1_confirmed ? <Check className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                                {reg.player1_name}: {reg.player1_confirmed ? 'Confirmé' : 'En attente'}
                              </span>
                              <span className={`flex items-center gap-1 ${reg.player2_confirmed ? 'text-success' : 'text-text-tertiary'}`}>
                                {reg.player2_confirmed ? <Check className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                                {reg.player2_name}: {reg.player2_confirmed ? 'Confirmé' : 'En attente'}
                              </span>
                            </div>

                            {needsConfirmation && inWindow && (
                              <Button
                                size="sm"
                                className="w-full"
                                loading={actionLoading === reg.id}
                                onClick={() => handleConfirm(reg)}
                              >
                                <Check className="w-4 h-4 mr-1" />
                                Confirmer ma participation
                              </Button>
                            )}

                            {needsConfirmation && !inWindow && (
                              <div className="flex items-center gap-2 py-2 px-3 rounded-[10px] bg-warning/5 border border-warning/20">
                                <AlertCircle className="w-4 h-4 text-warning shrink-0" />
                                <p className="text-xs text-text-secondary">
                                  La confirmation sera possible 48h avant le tournoi
                                  {t?.confirmation_deadline && (
                                    <> (à partir du {new Date(t.confirmation_deadline).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })})</>
                                  )}
                                </p>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Confirmed status */}
                        {reg.status === 'confirmed' && (
                          <div className="flex items-center gap-2 py-2 px-3 rounded-[10px] bg-success/5 border border-success/20">
                            <Check className="w-4 h-4 text-success shrink-0" />
                            <p className="text-xs text-success font-medium">Inscription confirmée par les deux joueurs</p>
                          </div>
                        )}

                        {/* Cancel button (only for non-confirmed, non-cancelled) */}
                        {!['confirmed', 'cancelled'].includes(reg.status) && isPlayer1(reg) && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="w-full !text-danger"
                            loading={actionLoading === reg.id}
                            onClick={() => handleCancel(reg)}
                          >
                            Annuler mon inscription
                          </Button>
                        )}
                      </div>
                    </Card>
                  )
                })}
              </div>
            )}

            {/* Past/cancelled */}
            {pastRegs.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
                  Annulées ({pastRegs.length})
                </p>
                {pastRegs.map((reg) => (
                  <Card key={reg.id} className="opacity-60">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-text truncate">{reg.tournament?.name}</p>
                        <p className="text-xs text-text-secondary">
                          {reg.player1_name} & {reg.player2_name}
                        </p>
                      </div>
                      <Badge color="danger">Annulée</Badge>
                    </div>
                  </Card>
                ))}
              </div>
            )}

            {/* Empty state */}
            {registrations.length === 0 && (
              <Card className="text-center !py-10">
                <Trophy className="w-10 h-10 text-text-tertiary mx-auto mb-3" />
                <p className="text-sm text-text-tertiary mb-4">Vous n'êtes inscrit à aucun tournoi</p>
                <Link to="/tournaments">
                  <Button variant="ghost">Voir les tournois</Button>
                </Link>
              </Card>
            )}
          </>
        )}
      </div>
    </PageWrapper>
  )
}
