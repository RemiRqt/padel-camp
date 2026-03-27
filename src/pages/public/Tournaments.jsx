import { useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { fetchTournaments, fetchUserRegistrations } from '@/services/tournamentService'
import { useAuth } from '@/context/AuthContext'
import PageWrapper from '@/components/layout/PageWrapper'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import { formatTime, monthTiny, dayNum } from '@/utils/formatDate'
import {
  Trophy, Filter, ChevronRight, Users, Calendar, MapPin, Award
} from 'lucide-react'

const LEVELS = ['Tous', 'P25', 'P50', 'P100', 'P250', 'P500', 'P1000', 'P2000']
const CATEGORIES = ['Toutes', 'hommes', 'femmes', 'mixte']
const CAT_LABELS = { hommes: 'Hommes', femmes: 'Femmes', mixte: 'Mixte' }
const STATUS_COLORS = { open: 'success', full: 'warning', closed: 'gray', completed: 'primary' }
const STATUS_LABELS = { open: 'Inscriptions ouvertes', full: 'Complet', closed: 'Fermé', completed: 'Terminé' }

export default function Tournaments() {
  const { user } = useAuth()
  const [tournaments, setTournaments] = useState([])
  const [myRegs, setMyRegs] = useState({}) // tournamentId → registration status
  const [loading, setLoading] = useState(true)
  const [levelFilter, setLevelFilter] = useState('Tous')
  const [catFilter, setCatFilter] = useState('Toutes')

  useEffect(() => {
    async function load() {
      setLoading(true)
      const data = await fetchTournaments(['open', 'full', 'closed', 'completed'])
      setTournaments(data)

      // Fetch user registrations
      if (user) {
        const regs = await fetchUserRegistrations(user.id)
        const regsMap = {}
        regs.forEach((r) => { regsMap[r.tournament_id] = r.status })
        setMyRegs(regsMap)
      }

      setLoading(false)
    }
    load()
  }, [user])

  const filtered = useMemo(() => {
    return tournaments.filter((t) => {
      if (levelFilter !== 'Tous' && t.level !== levelFilter) return false
      if (catFilter !== 'Toutes' && t.category !== catFilter) return false
      return true
    })
  }, [tournaments, levelFilter, catFilter])

  const upcoming = filtered.filter((t) => t.date >= new Date().toISOString().split('T')[0])
  const past = filtered.filter((t) => t.date < new Date().toISOString().split('T')[0])

  return (
    <PageWrapper>
      <div className="space-y-5">
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-primary" />
          <h1 className="text-2xl font-bold text-text">Tournois</h1>
        </div>

        {/* Filters */}
        <Card className="!p-3">
          <div className="space-y-2">
            <div>
              <p className="text-[10px] font-semibold text-text-tertiary uppercase mb-1.5">Niveau FFT</p>
              <div className="flex gap-1.5 overflow-x-auto pb-1">
                {LEVELS.map((l) => (
                  <button
                    key={l}
                    onClick={() => setLevelFilter(l)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                      levelFilter === l ? 'bg-primary text-white' : 'bg-bg text-text-secondary hover:bg-primary/5'
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-text-tertiary uppercase mb-1.5">Catégorie</p>
              <div className="flex gap-1.5">
                {CATEGORIES.map((c) => (
                  <button
                    key={c}
                    onClick={() => setCatFilter(c)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                      catFilter === c ? 'bg-primary text-white' : 'bg-bg text-text-secondary hover:bg-primary/5'
                    }`}
                  >
                    {c === 'Toutes' ? c : CAT_LABELS[c]}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Card>

        {/* Loading */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-28 rounded-[16px] bg-white animate-pulse" />
            ))}
          </div>
        ) : (
          <>
            {/* Upcoming */}
            {upcoming.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
                  À venir ({upcoming.length})
                </p>
                {upcoming.map((t) => (
                  <TournamentCard
                    key={t.id}
                    tournament={t}
                    regCount={t.reg_count || 0}
                    isLoggedIn={!!user}
                    myRegStatus={myRegs[t.id]}
                  />
                ))}
              </div>
            )}

            {/* Past */}
            {past.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
                  Passés ({past.length})
                </p>
                {past.map((t) => (
                  <TournamentCard
                    key={t.id}
                    tournament={t}
                    regCount={t.reg_count || 0}
                    isLoggedIn={!!user}
                    isPast
                    myRegStatus={myRegs[t.id]}
                  />
                ))}
              </div>
            )}

            {upcoming.length === 0 && past.length === 0 && (
              <Card className="text-center !py-10">
                <Trophy className="w-10 h-10 text-text-tertiary mx-auto mb-3" />
                <p className="text-sm text-text-tertiary">Aucun tournoi trouvé avec ces filtres</p>
              </Card>
            )}
          </>
        )}
      </div>
    </PageWrapper>
  )
}

const REG_STATUS_LABELS = {
  pending_partner: 'En attente partenaire',
  pending_admin: 'En attente validation',
  approved: 'Approuvée',
  waitlist: 'Liste d\'attente',
  confirmed: 'Confirmée',
  cancelled: 'Annulée',
}
const REG_STATUS_COLORS = {
  pending_partner: 'warning',
  pending_admin: 'warning',
  approved: 'primary',
  waitlist: 'gray',
  confirmed: 'success',
  cancelled: 'danger',
}

function TournamentCard({ tournament: t, regCount, isLoggedIn, isPast = false, myRegStatus }) {
  const spotsLeft = t.max_teams - regCount

  return (
    <Link to={isLoggedIn ? `/tournaments/${t.id}` : '/login'}>
      <Card className={`!p-0 overflow-hidden hover:shadow-[0_4px_12px_rgba(11,39,120,0.12)] transition-shadow ${isPast ? 'opacity-70' : ''}`}>
        <div className="flex">
          {/* Date block */}
          <div className="w-[72px] bg-primary/5 flex flex-col items-center justify-center shrink-0 py-4">
            <span className="text-2xl font-bold text-primary leading-none">{dayNum(t.date + 'T00:00')}</span>
            <span className="text-xs text-primary/70 uppercase mt-0.5">{monthTiny(t.date + 'T00:00')}</span>
            <span className="text-[10px] text-primary/50 mt-0.5">{new Date(t.date + 'T00:00').getFullYear()}</span>
          </div>

          {/* Content */}
          <div className="flex-1 p-4 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-text truncate">{t.name}</h3>
                <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                  <Badge color="primary">{t.level}</Badge>
                  <Badge color="lime">{CAT_LABELS[t.category] || t.category}</Badge>
                  <Badge color={STATUS_COLORS[t.status] || 'gray'}>
                    {STATUS_LABELS[t.status] || t.status}
                  </Badge>
                  {myRegStatus && (
                    <Badge color={REG_STATUS_COLORS[myRegStatus] || 'gray'}>
                      {REG_STATUS_LABELS[myRegStatus] || myRegStatus}
                    </Badge>
                  )}
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-text-tertiary shrink-0 mt-1" />
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 text-xs text-text-secondary">
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                {formatTime(t.start_time)} – {formatTime(t.end_time)}
              </span>
              <span className="flex items-center gap-1">
                <Users className="w-3.5 h-3.5" />
                {regCount}/{t.max_teams} paires
              </span>
              {spotsLeft > 0 && t.status === 'open' && (
                <span className="flex items-center gap-1 text-success font-medium">
                  {spotsLeft} place{spotsLeft > 1 ? 's' : ''} restante{spotsLeft > 1 ? 's' : ''}
                </span>
              )}
              {t.judge_arbiter && (
                <span className="flex items-center gap-1">
                  <Award className="w-3.5 h-3.5" />
                  JA: {t.judge_arbiter}
                </span>
              )}
            </div>

            {t.description && (
              <p className="text-xs text-text-tertiary mt-2 line-clamp-2">{t.description}</p>
            )}
          </div>
        </div>
      </Card>
    </Link>
  )
}
