import { useEffect, useState } from 'react'
import useConfirm from '@/hooks/useConfirm'
import ConfirmModal from '@/components/ui/ConfirmModal'
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
import TournamentRegistrationCard from '@/components/features/tournament/TournamentRegistrationCard'
import toast from 'react-hot-toast'
import {
  Trophy, Check, X, Bell
} from 'lucide-react'

export default function MyTournaments() {
  const { user } = useAuth()
  const { askConfirm, confirmProps } = useConfirm()
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
      await acceptPartnerInvite(regId, user.id)
      toast.success('Invitation acceptée ! En attente de validation admin.')
      loadData()
    } catch (err) { toast.error(err.message) }
    finally { setActionLoading(null) }
  }

  const handleDecline = (regId) => {
    askConfirm({
      title: 'Refuser cette invitation ?',
      confirmLabel: 'Refuser',
      onConfirm: async () => {
        setActionLoading(regId)
        try {
          await declinePartnerInvite(regId, user.id)
          toast.success('Invitation refusée')
          loadData()
        } catch (err) { toast.error(err.message) }
        finally { setActionLoading(null) }
      },
    })
  }

  const handleConfirm = async (reg) => {
    setActionLoading(reg.id)
    try {
      const result = await confirmParticipation(reg.id, myPlayerNumber(reg), user.id)
      if (result.status === 'confirmed') {
        toast.success('Participation confirmée pour la paire !')
      } else {
        toast.success('Votre confirmation est enregistrée. En attente de votre partenaire.')
      }
      loadData()
    } catch (err) { toast.error(err.message) }
    finally { setActionLoading(null) }
  }

  const handleCancel = (reg) => {
    askConfirm({
      title: 'Annuler votre inscription ?',
      message: 'Si une paire est en file d\'attente, elle sera promue.',
      confirmLabel: 'Annuler l\'inscription',
      onConfirm: async () => {
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
      },
    })
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
                {activeRegs.map((reg) => (
                  <TournamentRegistrationCard
                    key={reg.id}
                    reg={reg}
                    userId={user?.id}
                    actionLoading={actionLoading}
                    onConfirm={handleConfirm}
                    onCancel={handleCancel}
                  />
                ))}
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
      <ConfirmModal {...confirmProps} />
    </PageWrapper>
  )
}
