import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import {
  fetchTournamentById, fetchRegistrations
} from '@/services/tournamentService'
import { formatDateFull, formatTime } from '@/utils/formatDate'
import PageWrapper from '@/components/layout/PageWrapper'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import toast from 'react-hot-toast'
import {
  Trophy, Calendar, Clock, Users, Award, MapPin, ChevronRight, UserPlus, Info
} from 'lucide-react'

const CAT_LABELS = { hommes: 'Hommes', femmes: 'Femmes', mixte: 'Mixte' }
const STATUS_COLORS = { open: 'success', full: 'warning', closed: 'gray', completed: 'primary', draft: 'gray', cancelled: 'danger' }
const STATUS_LABELS = { open: 'Inscriptions ouvertes', full: 'Complet', closed: 'Fermé', completed: 'Terminé', draft: 'Brouillon', cancelled: 'Annulé' }
const REG_STATUS_LABELS = {
  pending_partner: 'En attente partenaire',
  pending_admin: 'En attente validation',
  approved: 'Validée',
  waitlist: 'File d\'attente',
  confirmed: 'Confirmée',
  cancelled: 'Annulée',
}
const REG_STATUS_COLORS = {
  pending_partner: 'warning', pending_admin: 'warning', approved: 'success',
  waitlist: 'gray', confirmed: 'primary', cancelled: 'danger',
}

export default function TournamentDetail() {
  const { id } = useParams()
  const { user, profile } = useAuth()
  const navigate = useNavigate()

  const [tournament, setTournament] = useState(null)
  const [registrations, setRegistrations] = useState([])
  const [regCount, setRegCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [userReg, setUserReg] = useState(null) // user's own registration

  useEffect(() => {
    async function load() {
      try {
        const [t, regs] = await Promise.all([
          fetchTournamentById(id),
          fetchRegistrations(id),
        ])
        setTournament(t)
        const activeRegs = regs.filter((r) => r.status !== 'cancelled')
        setRegistrations(activeRegs)
        setRegCount(activeRegs.length)

        // Find user's registration
        if (user) {
          const mine = regs.find(
            (r) => (r.player1_uid === user.id || r.player2_uid === user.id) && r.status !== 'cancelled'
          )
          setUserReg(mine || null)
        }
      } catch {
        toast.error('Tournoi introuvable')
        navigate('/tournaments')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id, user])

  if (loading) {
    return (
      <PageWrapper title="Tournoi">
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-24 rounded-[16px] bg-white animate-pulse" />)}
        </div>
      </PageWrapper>
    )
  }

  if (!tournament) return null

  const spotsLeft = tournament.max_teams - regCount
  const canRegister = tournament.status === 'open' && !userReg
  const hasLicense = !!profile?.license_number
  const d = new Date(tournament.date + 'T00:00')

  return (
    <PageWrapper>
      <div className="space-y-5">
        {/* Header */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Badge color={STATUS_COLORS[tournament.status]}>{STATUS_LABELS[tournament.status]}</Badge>
            <Badge color="primary">{tournament.level}</Badge>
            <Badge color="lime">{CAT_LABELS[tournament.category]}</Badge>
          </div>
          <h1 className="text-2xl font-bold text-text">{tournament.name}</h1>
        </div>

        {/* Info card */}
        <Card elevated>
          <div className="space-y-3.5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-[10px] bg-primary/10 flex items-center justify-center shrink-0">
                <Calendar className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-text">{formatDateFull(d)}</p>
                <p className="text-xs text-text-secondary">
                  {formatTime(tournament.start_time)} – {formatTime(tournament.end_time)}
                </p>
              </div>
            </div>
            <div className="border-t border-separator" />
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-[10px] bg-primary/10 flex items-center justify-center shrink-0">
                <MapPin className="w-5 h-5 text-primary" />
              </div>
              <p className="text-sm font-medium">Padel Camp Achères</p>
            </div>
            <div className="border-t border-separator" />
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-[10px] bg-primary/10 flex items-center justify-center shrink-0">
                <Users className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-text">{regCount} / {tournament.max_teams} paires</p>
                {spotsLeft > 0 && tournament.status === 'open' && (
                  <p className="text-xs text-success">{spotsLeft} place{spotsLeft > 1 ? 's' : ''} restante{spotsLeft > 1 ? 's' : ''}</p>
                )}
              </div>
              {/* Progress bar */}
              <div className="w-20 h-2 rounded-full bg-bg overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${Math.min((regCount / tournament.max_teams) * 100, 100)}%` }}
                />
              </div>
            </div>
            {tournament.judge_arbiter && (
              <>
                <div className="border-t border-separator" />
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-[10px] bg-primary/10 flex items-center justify-center shrink-0">
                    <Award className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-text-secondary">Juge-Arbitre</p>
                    <p className="text-sm font-medium">{tournament.judge_arbiter}</p>
                  </div>
                </div>
              </>
            )}
            {tournament.confirmation_deadline && (
              <>
                <div className="border-t border-separator" />
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-[10px] bg-warning/10 flex items-center justify-center shrink-0">
                    <Clock className="w-5 h-5 text-warning" />
                  </div>
                  <div>
                    <p className="text-xs text-text-secondary">Confirmation avant</p>
                    <p className="text-sm font-medium">
                      {new Date(tournament.confirmation_deadline).toLocaleDateString('fr-FR', {
                        weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit'
                      })}
                    </p>
                  </div>
                </div>
              </>
            )}
          </div>
        </Card>

        {/* Description */}
        {tournament.description && (
          <Card>
            <div className="flex items-center gap-2 mb-2">
              <Info className="w-4 h-4 text-primary" />
              <h3 className="font-semibold text-text text-sm">Description</h3>
            </div>
            <p className="text-sm text-text-secondary whitespace-pre-line">{tournament.description}</p>
          </Card>
        )}

        {/* User registration status */}
        {userReg && (
          <Card className="!border-l-4 !border-l-primary">
            <div className="flex items-center gap-2 mb-2">
              <Trophy className="w-4 h-4 text-primary" />
              <h3 className="font-semibold text-text text-sm">Mon inscription</h3>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{userReg.player1_name} & {userReg.player2_name}</p>
                <p className="text-xs text-text-secondary mt-0.5">
                  Licences: {userReg.player1_license} / {userReg.player2_license}
                  {userReg.player2_is_external && ' (externe)'}
                </p>
              </div>
              <Badge color={REG_STATUS_COLORS[userReg.status]}>
                {REG_STATUS_LABELS[userReg.status]}
              </Badge>
            </div>
            {userReg.status === 'waitlist' && userReg.position && (
              <p className="text-xs text-text-tertiary mt-2">Position en file d'attente: #{userReg.position}</p>
            )}
          </Card>
        )}

        {/* Action */}
        {canRegister && (
          <>
            {!hasLicense ? (
              <Card className="!bg-warning/5 !border !border-warning/20">
                <div className="flex items-start gap-3">
                  <Award className="w-5 h-5 text-warning shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-text">Licence FFT requise</p>
                    <p className="text-xs text-text-secondary mt-0.5">
                      Vous devez renseigner votre numéro de licence FFT dans votre profil pour vous inscrire.
                    </p>
                    <Link to="/profile">
                      <Button size="sm" variant="ghost" className="mt-2">
                        Compléter mon profil <ChevronRight className="w-3 h-3 ml-1" />
                      </Button>
                    </Link>
                  </div>
                </div>
              </Card>
            ) : (
              <Link to={`/tournaments/${id}/register`}>
                <Button className="w-full" size="lg">
                  <UserPlus className="w-5 h-5 mr-2" />
                  S'inscrire avec un partenaire
                </Button>
              </Link>
            )}
          </>
        )}

        {/* Registered pairs (public list) */}
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-text">Paires inscrites ({registrations.length})</h3>
          </div>
          {registrations.length > 0 ? (
            <div className="space-y-2">
              {registrations.map((reg, i) => (
                <div key={reg.id} className="flex items-center gap-3 py-2.5 px-3 rounded-[10px] bg-bg">
                  <span className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">
                    {reg.status === 'waitlist' ? `W${reg.position}` : i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text truncate">
                      {reg.player1_name} & {reg.player2_name}
                    </p>
                  </div>
                  <Badge color={REG_STATUS_COLORS[reg.status]}>
                    {reg.status === 'confirmed' ? 'Confirmé'
                      : reg.status === 'approved' ? 'Validé'
                      : reg.status === 'waitlist' ? `Attente #${reg.position}`
                      : REG_STATUS_LABELS[reg.status]}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-text-tertiary text-center py-4">Aucune inscription pour le moment</p>
          )}
        </Card>
      </div>
    </PageWrapper>
  )
}
