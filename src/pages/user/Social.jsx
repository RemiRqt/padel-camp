import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import PageWrapper from '@/components/layout/PageWrapper'
import Card from '@/components/ui/Card'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import toast from 'react-hot-toast'
import {
  Users, UserPlus, Search, Swords, Trophy, X,
  Check, Clock, ChevronRight, TrendingUp
} from 'lucide-react'

export default function Social() {
  const { user } = useAuth()
  const [friends, setFriends] = useState([])
  const [pendingIn, setPendingIn] = useState([]) // invitations received
  const [matches, setMatches] = useState([])
  const [stats, setStats] = useState({ wins: 0, losses: 0 })
  const [loading, setLoading] = useState(true)

  // Add friend
  const [addOpen, setAddOpen] = useState(false)
  const [searchQ, setSearchQ] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)

  // Add match
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
      // Friends (accepted)
      const { data: fData } = await supabase
        .from('friends')
        .select('*, friend:profiles!friends_friend_id_fkey(id, display_name, email), requester:profiles!friends_user_id_fkey(id, display_name, email)')
        .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`)
        .eq('status', 'accepted')

      const friendsList = (fData || []).map((f) => {
        const isSender = f.user_id === user.id
        return { id: f.id, profile: isSender ? f.friend : f.requester }
      })
      setFriends(friendsList)

      // Pending invitations (where I'm friend_id)
      const { data: pData } = await supabase
        .from('friends')
        .select('*, requester:profiles!friends_user_id_fkey(id, display_name, email)')
        .eq('friend_id', user.id)
        .eq('status', 'pending')
      setPendingIn(pData || [])

      // Matches
      const { data: mData } = await supabase
        .from('matches')
        .select('*, p1:profiles!matches_player1_id_fkey(display_name), p2:profiles!matches_player2_id_fkey(display_name), o1:profiles!matches_opponent1_id_fkey(display_name), o2:profiles!matches_opponent2_id_fkey(display_name)')
        .or(`player1_id.eq.${user.id},player2_id.eq.${user.id},opponent1_id.eq.${user.id},opponent2_id.eq.${user.id}`)
        .order('date_played', { ascending: false })
        .limit(20)
      setMatches(mData || [])

      // Stats
      let wins = 0, losses = 0
      ;(mData || []).forEach((m) => {
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

  // Search members
  const doSearch = async (query, setter) => {
    if (query.length < 2) { setter([]); return }
    setSearching(true)
    const { data } = await supabase
      .from('profiles')
      .select('id, display_name, email')
      .ilike('display_name', `%${query}%`)
      .neq('id', user.id)
      .limit(5)
    setter(data || [])
    setSearching(false)
  }

  useEffect(() => { const t = setTimeout(() => doSearch(searchQ, setSearchResults), 300); return () => clearTimeout(t) }, [searchQ])
  useEffect(() => { const t = setTimeout(() => doSearch(partnerSearch, setPartnerResults), 300); return () => clearTimeout(t) }, [partnerSearch])
  useEffect(() => { const t = setTimeout(() => doSearch(opp1Search, setOpp1Results), 300); return () => clearTimeout(t) }, [opp1Search])
  useEffect(() => { const t = setTimeout(() => doSearch(opp2Search, setOpp2Results), 300); return () => clearTimeout(t) }, [opp2Search])

  // Add friend
  const handleAddFriend = async (member) => {
    try {
      const { error } = await supabase.from('friends').insert({ user_id: user.id, friend_id: member.id })
      if (error) throw error
      toast.success(`Invitation envoyée à ${member.display_name}`)
      setAddOpen(false)
      setSearchQ('')
      fetchAll()
    } catch (err) { toast.error(err.message) }
  }

  const handleAccept = async (friendRow) => {
    try {
      const { error } = await supabase.from('friends').update({ status: 'accepted' }).eq('id', friendRow.id)
      if (error) throw error
      toast.success('Ami ajouté !')
      fetchAll()
    } catch (err) { toast.error(err.message) }
  }

  const handleDecline = async (friendRow) => {
    try {
      const { error } = await supabase.from('friends').delete().eq('id', friendRow.id)
      if (error) throw error
      toast.success('Invitation refusée')
      fetchAll()
    } catch (err) { toast.error(err.message) }
  }

  // Add match
  const updateSet = (idx, field, val) => {
    setMatchForm((prev) => {
      const sets = [...prev.sets]
      sets[idx] = { ...sets[idx], [field]: val }
      return { ...prev, sets }
    })
  }

  const handleSubmitMatch = async () => {
    const { partner, opponent1, opponent2, sets } = matchForm
    if (!opponent1 || !opponent2) { toast.error('Sélectionnez les 2 adversaires'); return }
    if (sets[0].s1 === '' || sets[0].s2 === '') { toast.error('Entrez au moins le 1er set'); return }

    setSubmitting(true)
    try {
      const scoreTeam1 = sets.filter((s) => s.s1 !== '' && s.s2 !== '').map((s) => `${s.s1}/${s.s2}`).join(' ')
      const scoreTeam2 = sets.filter((s) => s.s1 !== '' && s.s2 !== '').map((s) => `${s.s2}/${s.s1}`).join(' ')

      // Determine winner: count sets won
      let setsWonTeam1 = 0, setsWonTeam2 = 0
      sets.forEach((s) => {
        if (s.s1 === '' || s.s2 === '') return
        const a = parseInt(s.s1), b = parseInt(s.s2)
        if (a > b) setsWonTeam1++
        else if (b > a) setsWonTeam2++
      })
      const winner = setsWonTeam1 > setsWonTeam2 ? 'team1' : setsWonTeam2 > setsWonTeam1 ? 'team2' : 'team1'

      const { error } = await supabase.from('matches').insert({
        player1_id: user.id,
        player2_id: partner?.id || null,
        opponent1_id: opponent1.id,
        opponent2_id: opponent2.id,
        score_team1: scoreTeam1,
        score_team2: scoreTeam2,
        winner,
      })
      if (error) throw error
      toast.success('Match enregistré !')
      setMatchOpen(false)
      setMatchForm({ partner: null, opponent1: null, opponent2: null, sets: [{ s1: '', s2: '' }, { s1: '', s2: '' }] })
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
          <Button variant="ghost" className="!justify-start" onClick={() => setAddOpen(true)}>
            <UserPlus className="w-4 h-4 mr-2" />Ajouter un ami
          </Button>
          <Button variant="ghost" className="!justify-start" onClick={() => setMatchOpen(true)}>
            <Swords className="w-4 h-4 mr-2" />Ajouter un match
          </Button>
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
                    <p className="text-xs text-text-tertiary truncate">{f.profile.email}</p>
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
        <Card>
          <div className="flex items-center gap-2 mb-3">
            <Trophy className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-text">Derniers matchs</h3>
          </div>
          {matches.length > 0 ? (
            <div className="space-y-2">
              {matches.map((m) => {
                const inTeam1 = m.player1_id === user.id || m.player2_id === user.id
                const won = (inTeam1 && m.winner === 'team1') || (!inTeam1 && m.winner === 'team2')
                return (
                  <div key={m.id} className={`p-3 rounded-[12px] ${won ? 'bg-green-50' : 'bg-red-50'}`}>
                    <div className="flex items-center justify-between gap-2">
                      {/* Équipe 1 — gauche */}
                      <div className="flex-1 min-w-0 text-xs">
                        <p className="font-medium text-text truncate">{m.p1?.display_name}</p>
                        {m.p2?.display_name && <p className="text-text-secondary truncate">{m.p2.display_name}</p>}
                      </div>
                      {/* Scores — centre */}
                      <div className="flex items-center gap-1.5">
                        {m.score_team1?.split(' ').map((s, i) => (
                          <span key={i} className="text-xs font-bold text-text bg-white/60 px-1.5 py-0.5 rounded-md">
                            {s.replace('/', '-')}
                          </span>
                        ))}
                      </div>
                      {/* Équipe 2 — droite */}
                      <div className="flex-1 min-w-0 text-xs text-right">
                        <p className="font-medium text-text truncate">{m.o1?.display_name}</p>
                        {m.o2?.display_name && <p className="text-text-secondary truncate">{m.o2.display_name}</p>}
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-1.5">
                      <Badge color={won ? 'success' : 'danger'}>{won ? 'Victoire' : 'Défaite'}</Badge>
                      <span className="text-[10px] text-text-tertiary">
                        {new Date(m.date_played).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-sm text-text-tertiary text-center py-4">Aucun match enregistré</p>
          )}
        </Card>
      </div>

      {/* Add friend modal */}
      <Modal isOpen={addOpen} onClose={() => { setAddOpen(false); setSearchQ('') }} title="Ajouter un ami">
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
            <input
              type="text" placeholder="Rechercher un membre..."
              value={searchQ} onChange={(e) => setSearchQ(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-[12px] bg-bg border border-separator text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              autoFocus
            />
          </div>
          {searching ? (
            <div className="py-4 text-center"><div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" /></div>
          ) : searchResults.length > 0 ? (
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {searchResults.map((m) => (
                <button key={m.id} onClick={() => handleAddFriend(m)}
                  className="w-full flex items-center gap-3 p-3 rounded-[12px] hover:bg-bg transition-colors text-left cursor-pointer">
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-sm font-bold text-primary">{m.display_name.charAt(0).toUpperCase()}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text truncate">{m.display_name}</p>
                    <p className="text-xs text-text-tertiary truncate">{m.email}</p>
                  </div>
                  <UserPlus className="w-4 h-4 text-primary shrink-0" />
                </button>
              ))}
            </div>
          ) : searchQ.length >= 2 ? (
            <p className="text-sm text-text-tertiary text-center py-3">Aucun membre trouvé</p>
          ) : null}
        </div>
      </Modal>

      {/* Add match modal */}
      <Modal isOpen={matchOpen} onClose={() => setMatchOpen(false)} title="Enregistrer un match">
        <div className="space-y-4">
          {/* My team */}
          <div>
            <p className="text-xs font-semibold text-text-secondary uppercase mb-2">Mon équipe</p>
            <div className="rounded-[12px] bg-bg p-3 space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-xs font-bold text-primary">Moi</span>
                </div>
                <span className="text-sm font-medium text-text">Moi</span>
              </div>
              {matchForm.partner ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-xs font-bold text-primary">{matchForm.partner.display_name.charAt(0)}</span>
                    </div>
                    <span className="text-sm font-medium">{matchForm.partner.display_name}</span>
                  </div>
                  <button onClick={() => setMatchForm((p) => ({ ...p, partner: null }))} className="text-xs text-danger cursor-pointer">Retirer</button>
                </div>
              ) : (
                <MemberPicker
                  placeholder="Partenaire (optionnel)"
                  search={partnerSearch}
                  setSearch={setPartnerSearch}
                  results={partnerResults}
                  onSelect={(m) => { setMatchForm((p) => ({ ...p, partner: m })); setPartnerSearch('') }}
                />
              )}
            </div>
          </div>

          <div className="text-center text-xs font-bold text-text-tertiary">VS</div>

          {/* Opponents */}
          <div>
            <p className="text-xs font-semibold text-text-secondary uppercase mb-2">Adversaires</p>
            <div className="rounded-[12px] bg-bg p-3 space-y-2">
              {matchForm.opponent1 ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-danger/10 flex items-center justify-center">
                      <span className="text-xs font-bold text-danger">{matchForm.opponent1.display_name.charAt(0)}</span>
                    </div>
                    <span className="text-sm font-medium">{matchForm.opponent1.display_name}</span>
                  </div>
                  <button onClick={() => setMatchForm((p) => ({ ...p, opponent1: null }))} className="text-xs text-danger cursor-pointer">Retirer</button>
                </div>
              ) : (
                <MemberPicker
                  placeholder="Adversaire 1"
                  search={opp1Search}
                  setSearch={setOpp1Search}
                  results={opp1Results}
                  onSelect={(m) => { setMatchForm((p) => ({ ...p, opponent1: m })); setOpp1Search('') }}
                />
              )}
              {matchForm.opponent2 ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-danger/10 flex items-center justify-center">
                      <span className="text-xs font-bold text-danger">{matchForm.opponent2.display_name.charAt(0)}</span>
                    </div>
                    <span className="text-sm font-medium">{matchForm.opponent2.display_name}</span>
                  </div>
                  <button onClick={() => setMatchForm((p) => ({ ...p, opponent2: null }))} className="text-xs text-danger cursor-pointer">Retirer</button>
                </div>
              ) : (
                <MemberPicker
                  placeholder="Adversaire 2"
                  search={opp2Search}
                  setSearch={setOpp2Search}
                  results={opp2Results}
                  onSelect={(m) => { setMatchForm((p) => ({ ...p, opponent2: m })); setOpp2Search('') }}
                />
              )}
            </div>
          </div>

          {/* Score */}
          <div>
            <p className="text-xs font-semibold text-text-secondary uppercase mb-2">Score (sets)</p>
            <div className="space-y-2">
              {matchForm.sets.map((s, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-xs text-text-tertiary w-10">Set {i + 1}</span>
                  <input
                    type="number" min="0" max="7" value={s.s1}
                    onChange={(e) => updateSet(i, 's1', e.target.value)}
                    className="w-14 px-2 py-2 rounded-lg bg-green-50 text-center text-sm font-bold text-green-700 focus:outline-none focus:ring-2 focus:ring-green-300"
                    placeholder="0"
                  />
                  <span className="text-xs text-text-tertiary">—</span>
                  <input
                    type="number" min="0" max="7" value={s.s2}
                    onChange={(e) => updateSet(i, 's2', e.target.value)}
                    className="w-14 px-2 py-2 rounded-lg bg-red-50 text-center text-sm font-bold text-red-500 focus:outline-none focus:ring-2 focus:ring-red-300"
                    placeholder="0"
                  />
                </div>
              ))}
              <button
                onClick={() => setMatchForm((p) => ({ ...p, sets: [...p.sets, { s1: '', s2: '' }] }))}
                className="text-xs text-primary font-medium cursor-pointer hover:underline"
              >
                + Ajouter un set
              </button>
            </div>
          </div>

          <Button className="w-full" loading={submitting} onClick={handleSubmitMatch}>
            <Swords className="w-4 h-4 mr-1" />Enregistrer le match
          </Button>
        </div>
      </Modal>
    </PageWrapper>
  )
}

function MemberPicker({ placeholder, search, setSearch, results, onSelect }) {
  return (
    <div>
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-tertiary" />
        <input
          type="text" placeholder={placeholder}
          value={search} onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-8 pr-3 py-2 rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      </div>
      {results.length > 0 && (
        <div className="mt-1 space-y-0.5 max-h-28 overflow-y-auto">
          {results.map((m) => (
            <button key={m.id} onClick={() => onSelect(m)}
              className="w-full text-left text-sm p-1.5 rounded-lg hover:bg-white cursor-pointer truncate">
              {m.display_name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
