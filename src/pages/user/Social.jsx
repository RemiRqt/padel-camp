import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { fetchFriends, fetchPendingInvitations, fetchMatches, addFriend, acceptFriend, declineFriend, createMatch } from '@/services/socialService'
import { searchMembers } from '@/services/userService'
import PageWrapper from '@/components/layout/PageWrapper'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import SocialMatchHistory from '@/components/features/social/SocialMatchHistory'
import SocialAddMatch from '@/components/features/social/SocialAddMatch'
import SocialAddFriend from '@/components/features/social/SocialAddFriend'
import toast from 'react-hot-toast'
import { Users, UserPlus, Swords, X, Check, Clock, TrendingUp } from 'lucide-react'

export default function Social() {
  const { user } = useAuth()
  const [friends, setFriends] = useState([])
  const [pendingIn, setPendingIn] = useState([])
  const [matches, setMatches] = useState([])
  const [stats, setStats] = useState({ wins: 0, losses: 0 })
  const [loading, setLoading] = useState(true)
  const [addOpen, setAddOpen] = useState(false)
  const [searchQ, setSearchQ] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [matchOpen, setMatchOpen] = useState(false)
  const [partnerSearch, setPartnerSearch] = useState('')
  const [partnerResults, setPartnerResults] = useState([])
  const [opp1Search, setOpp1Search] = useState('')
  const [opp1Results, setOpp1Results] = useState([])
  const [opp2Search, setOpp2Search] = useState('')
  const [opp2Results, setOpp2Results] = useState([])
  const [matchForm, setMatchForm] = useState({
    partner: null,
    opponent1: null,
    opponent2: null,
    sets: [{ s1: '', s2: '' }, { s1: '', s2: '' }],
  })
  const [submitting, setSubmitting] = useState(false)

  const fetchAll = async () => {
    if (!user?.id) return
    try {
      const [friendsList, pendingData, matchData] = await Promise.all([
        fetchFriends(user.id),
        fetchPendingInvitations(user.id),
        fetchMatches(user.id),
      ])
      setFriends(friendsList)
      setPendingIn(pendingData)
      setMatches(matchData)
      let wins = 0, losses = 0
      matchData.forEach((m) => {
        const inTeam1 = m.player1_id === user.id || m.player2_id === user.id
        if ((inTeam1 && m.winner === 'team1') || (!inTeam1 && m.winner === 'team2')) wins++
        else losses++
      })
      setStats({ wins, losses })
    } catch (err) {
      console.error('[Social] fetch error:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchAll() }, [user?.id])

  const doSearch = async (query, setter) => {
    if (query.length < 2) { setter([]); return }
    setSearching(true)
    try {
      const data = await searchMembers(query, user.id)
      setter(data)
    } catch { setter([]) }
    finally { setSearching(false) }
  }

  useEffect(() => { const t = setTimeout(() => doSearch(searchQ, setSearchResults), 300); return () => clearTimeout(t) }, [searchQ])
  useEffect(() => { const t = setTimeout(() => doSearch(partnerSearch, setPartnerResults), 300); return () => clearTimeout(t) }, [partnerSearch])
  useEffect(() => { const t = setTimeout(() => doSearch(opp1Search, setOpp1Results), 300); return () => clearTimeout(t) }, [opp1Search])
  useEffect(() => { const t = setTimeout(() => doSearch(opp2Search, setOpp2Results), 300); return () => clearTimeout(t) }, [opp2Search])

  const handleAddFriend = async (member) => {
    try {
      await addFriend(user.id, member.id)
      toast.success(`Invitation envoyée à ${member.display_name}`)
      setAddOpen(false)
      setSearchQ('')
      fetchAll()
    } catch (err) { toast.error(err.message) }
  }
  const handleAccept = async (friendRow) => {
    try {
      await acceptFriend(friendRow.id, user.id)
      toast.success('Ami ajouté !')
      fetchAll()
    } catch (err) { toast.error(err.message) }
  }
  const handleDecline = async (friendRow) => {
    try {
      await declineFriend(friendRow.id, user.id)
      toast.success('Invitation refusée')
      fetchAll()
    } catch (err) { toast.error(err.message) }
  }

  const handleSubmitMatch = async () => {
    const { partner, opponent1, opponent2, sets } = matchForm
    const opp1Final = opponent1 || (opp1Search.trim() ? { name: opp1Search.trim() } : null)
    const opp2Final = opponent2 || (opp2Search.trim() ? { name: opp2Search.trim() } : null)
    const partnerFinal = partner || (partnerSearch.trim() ? { name: partnerSearch.trim() } : null)

    if (!opp1Final || !opp2Final) { toast.error('Indique les 2 adversaires'); return }
    if (sets[0].s1 === '' || sets[0].s2 === '') { toast.error('Entre au moins le 1er set'); return }

    setSubmitting(true)
    try {
      const scoreTeam1 = sets.filter((s) => s.s1 !== '' && s.s2 !== '').map((s) => `${s.s1}/${s.s2}`).join(' ')
      const scoreTeam2 = sets.filter((s) => s.s1 !== '' && s.s2 !== '').map((s) => `${s.s2}/${s.s1}`).join(' ')

      let setsWonTeam1 = 0, setsWonTeam2 = 0
      sets.forEach((s) => {
        if (s.s1 === '' || s.s2 === '') return
        const a = parseInt(s.s1), b = parseInt(s.s2)
        if (a > b) setsWonTeam1++
        else if (b > a) setsWonTeam2++
      })
      const winner = setsWonTeam1 > setsWonTeam2 ? 'team1' : setsWonTeam2 > setsWonTeam1 ? 'team2' : 'team1'

      await createMatch({
        player1_id: user.id,
        player2_id: partnerFinal?.id || null,
        partner_name: partnerFinal && !partnerFinal.id ? partnerFinal.name : null,
        opponent1_id: opp1Final.id || null,
        opponent1_name: opp1Final.id ? null : opp1Final.name,
        opponent2_id: opp2Final.id || null,
        opponent2_name: opp2Final.id ? null : opp2Final.name,
        score_team1: scoreTeam1,
        score_team2: scoreTeam2,
        winner,
      })
      toast.success('Match enregistré !')
      setMatchOpen(false)
      setMatchForm({ partner: null, opponent1: null, opponent2: null, sets: [{ s1: '', s2: '' }, { s1: '', s2: '' }] })
      setPartnerSearch(''); setOpp1Search(''); setOpp2Search('')
      fetchAll()
    } catch (err) { toast.error(err.message) }
    finally { setSubmitting(false) }
  }

  const total = stats.wins + stats.losses
  const winPct = total > 0 ? (stats.wins / total) * 100 : 0

  if (loading) {
    return (
      <PageWrapper title="Social">
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-20 rounded-[16px] bg-white animate-pulse" />)}
        </div>
      </PageWrapper>
    )
  }

  return (
    <PageWrapper>
      <div className="space-y-5">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          <h1 className="text-2xl font-bold text-text">Social</h1>
        </div>

        {/* Stats barre progression */}
        <Card elevated>
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-text text-sm">Mon bilan</h3>
          </div>
          {total > 0 ? (
            <>
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="flex items-center gap-1 font-semibold text-green-600">
                  <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
                  Victoires {stats.wins}
                </span>
                <span className="flex items-center gap-1 font-semibold text-red-500">
                  Défaites {stats.losses}
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                </span>
              </div>
              <div className="w-full bg-red-100 rounded-full h-7 relative overflow-hidden">
                <div
                  className="bg-gradient-to-r from-green-500 to-emerald-400 h-7 rounded-full transition-all duration-700"
                  style={{ width: `${winPct}%` }}
                />
                <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white drop-shadow-sm">
                  {Math.round(winPct)}%
                </span>
              </div>
              <p className="text-xs text-text-tertiary mt-1.5 text-center">{total} match{total > 1 ? 's' : ''} joué{total > 1 ? 's' : ''}</p>
            </>
          ) : (
            <p className="text-sm text-text-tertiary text-center py-2">Aucun match enregistré</p>
          )}
        </Card>

        {/* Quick actions */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setAddOpen(true)}
            className="flex items-center justify-center gap-2 px-3 py-3 rounded-[14px] bg-primary/10 hover:bg-primary/15 transition-colors cursor-pointer text-sm font-semibold text-primary"
          >
            <UserPlus className="w-4 h-4" />Ajouter un ami
          </button>
          <button
            onClick={() => setMatchOpen(true)}
            className="flex items-center justify-center gap-2 px-3 py-3 rounded-[14px] bg-lime/30 hover:bg-lime/40 transition-colors cursor-pointer text-sm font-semibold text-primary"
          >
            <Swords className="w-4 h-4" />Ajouter un match
          </button>
        </div>

        {/* Pending invitations */}
        {pendingIn.length > 0 && (
          <Card>
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-4 h-4 text-warning" />
              <h3 className="font-semibold text-text text-sm">Invitations ({pendingIn.length})</h3>
            </div>
            <div className="space-y-2">
              {pendingIn.map((p) => (
                <div key={p.id} className="flex items-center gap-3 p-3 rounded-[12px] bg-bg">
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-sm font-bold text-primary">{p.requester.display_name.charAt(0).toUpperCase()}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text truncate">{p.requester.display_name}</p>
                  </div>
                  <Button size="sm" onClick={() => handleAccept(p)}>
                    <Check className="w-3.5 h-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => handleDecline(p)}>
                    <X className="w-3.5 h-3.5 text-danger" />
                  </Button>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Friends list */}
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-text">Mes amis ({friends.length})</h3>
          </div>
          {friends.length > 0 ? (
            <div className="space-y-2">
              {friends.map((f) => (
                <div key={f.id} className="flex items-center gap-3 p-3 rounded-[12px] bg-bg">
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-sm font-bold text-primary">{f.profile.display_name.charAt(0).toUpperCase()}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text truncate">{f.profile.display_name}</p>
                  </div>
                  <Button
                    size="sm" variant="ghost"
                    onClick={() => {
                      setMatchForm((prev) => ({ ...prev, partner: f.profile }))
                      setMatchOpen(true)
                    }}
                  >
                    <Swords className="w-3.5 h-3.5 mr-1" />Score
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6">
              <Users className="w-8 h-8 text-text-tertiary mx-auto mb-2" />
              <p className="text-sm text-text-tertiary">Aucun ami pour le moment</p>
            </div>
          )}
        </Card>

        {/* Match history */}
        <SocialMatchHistory matches={matches} userId={user?.id} />
      </div>

      {/* Add friend modal */}
      <SocialAddFriend
        isOpen={addOpen}
        onClose={() => setAddOpen(false)}
        searchQ={searchQ}
        setSearchQ={setSearchQ}
        searching={searching}
        searchResults={searchResults}
        onAddFriend={handleAddFriend}
      />

      {/* Add match modal */}
      <SocialAddMatch
        isOpen={matchOpen}
        onClose={() => setMatchOpen(false)}
        matchForm={matchForm}
        setMatchForm={setMatchForm}
        partnerSearch={partnerSearch}
        setPartnerSearch={setPartnerSearch}
        partnerResults={partnerResults}
        opp1Search={opp1Search}
        setOpp1Search={setOpp1Search}
        opp1Results={opp1Results}
        opp2Search={opp2Search}
        setOpp2Search={setOpp2Search}
        opp2Results={opp2Results}
        submitting={submitting}
        onSubmit={handleSubmitMatch}
      />
    </PageWrapper>
  )
}
