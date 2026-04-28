import { supabase } from '@/lib/supabase'

export async function fetchFriends(userId) {
  const { data, error } = await supabase
    .from('friends')
    .select('id, user_id, friend_id, friend:profiles!friends_friend_id_fkey(id, display_name, email), requester:profiles!friends_user_id_fkey(id, display_name, email)')
    .or(`user_id.eq.${userId},friend_id.eq.${userId}`)
    .eq('status', 'accepted')
  if (error) throw error
  return (data || []).map((f) => ({
    id: f.id,
    profile: f.user_id === userId ? f.friend : f.requester,
  }))
}

export async function fetchPendingInvitations(userId) {
  const { data, error } = await supabase
    .from('friends')
    .select('id, requester:profiles!friends_user_id_fkey(id, display_name, email)')
    .eq('friend_id', userId)
    .eq('status', 'pending')
  if (error) throw error
  return data || []
}

export async function fetchMatches(userId) {
  const { data, error } = await supabase
    .from('matches')
    .select('id, player1_id, player2_id, opponent1_id, opponent2_id, partner_name, opponent1_name, opponent2_name, score_team1, score_team2, winner, date_played, p1:profiles!matches_player1_id_fkey(display_name), p2:profiles!matches_player2_id_fkey(display_name), o1:profiles!matches_opponent1_id_fkey(display_name), o2:profiles!matches_opponent2_id_fkey(display_name)')
    .or(`player1_id.eq.${userId},player2_id.eq.${userId},opponent1_id.eq.${userId},opponent2_id.eq.${userId}`)
    .order('date_played', { ascending: false })
    .limit(20)
  if (error) throw error
  return data || []
}

export async function addFriend(userId, friendId) {
  const { error } = await supabase.from('friends').insert({ user_id: userId, friend_id: friendId })
  if (error) throw error
}

export async function acceptFriend(friendRowId, userId) {
  // Only the recipient (friend_id) can accept an invitation
  const { data: row, error: fetchErr } = await supabase
    .from('friends')
    .select('friend_id')
    .eq('id', friendRowId)
    .single()
  if (fetchErr) throw fetchErr
  if (row.friend_id !== userId) {
    throw new Error('Vous ne pouvez pas accepter cette invitation.')
  }
  const { error } = await supabase.from('friends').update({ status: 'accepted' }).eq('id', friendRowId)
  if (error) throw error
}

export async function declineFriend(friendRowId, userId) {
  // Only the recipient (friend_id) can decline/delete an invitation
  const { data: row, error: fetchErr } = await supabase
    .from('friends')
    .select('friend_id')
    .eq('id', friendRowId)
    .single()
  if (fetchErr) throw fetchErr
  if (row.friend_id !== userId) {
    throw new Error('Vous ne pouvez pas refuser cette invitation.')
  }
  const { error } = await supabase.from('friends').delete().eq('id', friendRowId)
  if (error) throw error
}

export async function createMatch(matchData) {
  const { error } = await supabase.from('matches').insert(matchData)
  if (error) throw error
}
