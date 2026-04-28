import { supabase } from '@/lib/supabase'

export async function fetchTournaments(statusFilter = null) {
  let q = supabase
    .from('tournaments')
    .select('*, tournament_registrations(id, status)')
    .order('date')
  if (statusFilter) {
    q = Array.isArray(statusFilter)
      ? q.in('status', statusFilter)
      : q.eq('status', statusFilter)
  }
  const { data, error } = await q
  if (error) throw error
  // Compute reg_count from embedded registrations (exclude cancelled)
  return (data || []).map((t) => {
    const regs = t.tournament_registrations || []
    t.reg_count = regs.filter((r) => r.status !== 'cancelled').length
    delete t.tournament_registrations
    return t
  })
}

export async function fetchTournamentById(id) {
  const { data, error } = await supabase
    .from('tournaments')
    .select('id, name, date, start_time, end_time, level, category, max_teams, status, description, judge_arbiter, confirmation_deadline, created_at')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export async function fetchRegistrations(tournamentId) {
  const { data, error } = await supabase
    .from('tournament_registrations')
    .select('id, tournament_id, player1_uid, player1_name, player1_license, player2_uid, player2_name, player2_license, player2_is_external, status, admin_validated, player1_confirmed, player2_confirmed, position, created_at')
    .eq('tournament_id', tournamentId)
    .order('created_at')
  if (error) throw error
  return data || []
}

export async function fetchRegistrationCount(tournamentId) {
  const { count, error } = await supabase
    .from('tournament_registrations')
    .select('id', { count: 'exact', head: true })
    .eq('tournament_id', tournamentId)
    .not('status', 'eq', 'cancelled')
  if (error) throw error
  return count || 0
}

export async function fetchUserRegistrations(userId) {
  const { data, error } = await supabase
    .from('tournament_registrations')
    .select('*, tournament:tournaments(*)')
    .or(`player1_uid.eq.${userId},player2_uid.eq.${userId}`)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

/**
 * Register a pair for a tournament
 * Step 1 of workflow: player1 registers, picks partner
 */
export async function registerPair({
  tournamentId,
  player1Uid,
  player1Name,
  player1License,
  player2Uid,
  player2Name,
  player2License,
  player2IsExternal,
}) {
  // Determine initial status:
  // - external partner → pending_admin (no partner confirmation needed)
  // - member partner → pending_partner (needs partner acceptance)
  const initialStatus = player2IsExternal ? 'pending_admin' : 'pending_partner'

  const { data, error } = await supabase
    .from('tournament_registrations')
    .insert({
      tournament_id: tournamentId,
      player1_uid: player1Uid,
      player1_name: player1Name,
      player1_license: player1License,
      player2_uid: player2Uid || null,
      player2_name: player2Name,
      player2_license: player2License,
      player2_is_external: player2IsExternal,
      status: initialStatus,
      player1_confirmed: false,
      player2_confirmed: player2IsExternal, // external = auto-confirmed
    })
    .select()
    .single()
  if (error) throw error
  return data
}

/**
 * Partner (player2) accepts the registration
 * Transitions: pending_partner → pending_admin
 */
export async function acceptPartnerInvite(registrationId, userId) {
  // Verify the caller is player2 (the invited partner)
  const { data: reg, error: fetchErr } = await supabase
    .from('tournament_registrations')
    .select('id, player2_uid')
    .eq('id', registrationId)
    .single()
  if (fetchErr) throw fetchErr
  if (userId && reg.player2_uid !== userId) {
    throw new Error('Vous ne pouvez pas accepter l\'invitation d\'un autre joueur.')
  }

  const { data, error } = await supabase
    .from('tournament_registrations')
    .update({ status: 'pending_admin' })
    .eq('id', registrationId)
    .select('id, status')
    .single()
  if (error) throw error
  return data
}

/**
 * Partner (player2) declines
 */
export async function declinePartnerInvite(registrationId, userId) {
  // Verify the caller is player2 (the invited partner)
  const { data: reg, error: fetchErr } = await supabase
    .from('tournament_registrations')
    .select('id, player2_uid')
    .eq('id', registrationId)
    .single()
  if (fetchErr) throw fetchErr
  if (userId && reg.player2_uid !== userId) {
    throw new Error('Vous ne pouvez pas refuser l\'invitation d\'un autre joueur.')
  }

  const { data, error } = await supabase
    .from('tournament_registrations')
    .update({ status: 'cancelled' })
    .eq('id', registrationId)
    .select('id, status')
    .single()
  if (error) throw error
  return data
}

/**
 * Admin validates a registration
 * Transitions: pending_admin → approved (or waitlist if full)
 */
export async function adminValidateRegistration(registrationId, tournamentId, maxTeams) {
  // Count current approved+confirmed
  const { count } = await supabase
    .from('tournament_registrations')
    .select('id', { count: 'exact', head: true })
    .eq('tournament_id', tournamentId)
    .in('status', ['approved', 'confirmed'])

  const isFull = (count || 0) >= maxTeams
  const newStatus = isFull ? 'waitlist' : 'approved'

  const updates = {
    status: newStatus,
    admin_validated: true,
  }

  if (isFull) {
    // Assign waitlist position
    const { count: waitCount } = await supabase
      .from('tournament_registrations')
      .select('id', { count: 'exact', head: true })
      .eq('tournament_id', tournamentId)
      .eq('status', 'waitlist')
    updates.position = (waitCount || 0) + 1
  }

  const { data, error } = await supabase
    .from('tournament_registrations')
    .update(updates)
    .eq('id', registrationId)
    .select()
    .single()
  if (error) throw error
  return data
}

/**
 * Admin rejects a registration
 */
export async function adminRejectRegistration(registrationId) {
  const { data, error } = await supabase
    .from('tournament_registrations')
    .update({ status: 'cancelled', admin_validated: false })
    .eq('id', registrationId)
    .select()
    .single()
  if (error) throw error
  return data
}

/**
 * Player confirms participation (48h before)
 * When both confirm → status = confirmed
 */
export async function confirmParticipation(registrationId, playerNumber, userId) {
  if (playerNumber !== 1 && playerNumber !== 2) throw new Error('playerNumber doit être 1 ou 2')
  const field = playerNumber === 1 ? 'player1_confirmed' : 'player2_confirmed'

  const { data: reg, error: fetchErr } = await supabase
    .from('tournament_registrations')
    .select('id, player1_uid, player2_uid, player1_confirmed, player2_confirmed, status')
    .eq('id', registrationId)
    .single()
  if (fetchErr) throw fetchErr

  // Ownership check
  const expectedUid = playerNumber === 1 ? reg.player1_uid : reg.player2_uid
  if (userId && expectedUid !== userId) {
    throw new Error('Vous ne pouvez pas confirmer la participation d\'un autre joueur.')
  }

  const updates = { [field]: true }

  // Check if both confirmed
  const otherConfirmed = playerNumber === 1 ? reg.player2_confirmed : reg.player1_confirmed
  if (otherConfirmed) {
    updates.status = 'confirmed'
  }

  const { data, error } = await supabase
    .from('tournament_registrations')
    .update(updates)
    .eq('id', registrationId)
    .select()
    .single()
  if (error) throw error
  return data
}

/**
 * Cancel a registration and promote first waitlist if applicable
 */
export async function cancelRegistrationAndPromote(registrationId, tournamentId) {
  const { error: cancelErr } = await supabase
    .from('tournament_registrations')
    .update({ status: 'cancelled' })
    .eq('id', registrationId)
  if (cancelErr) throw cancelErr

  // Promote first waitlisted
  const { data: waitlisted } = await supabase
    .from('tournament_registrations')
    .select('id, tournament_id, player1_uid, player2_uid, status, position')
    .eq('tournament_id', tournamentId)
    .eq('status', 'waitlist')
    .order('position')
    .limit(1)

  if (waitlisted?.[0]) {
    const { error: promoteErr } = await supabase
      .from('tournament_registrations')
      .update({ status: 'approved', position: null })
      .eq('id', waitlisted[0].id)
    if (promoteErr) console.error('[cancelRegistrationAndPromote] promote error:', promoteErr)
    return waitlisted[0]
  }
  return null
}

export async function searchMembersForTournament(query) {
  if (!query || query.length < 2) return []
  // Admin accounts never appear as a tournament partner option
  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name, email, license_number')
    .ilike('display_name', `%${query}%`)
    .neq('role', 'admin')
    .limit(8)
  if (error) throw error
  return data || []
}

/**
 * Admin: create or update a tournament
 */
export async function saveTournament(id, tournamentData) {
  if (id) {
    const { error } = await supabase.from('tournaments').update(tournamentData).eq('id', id)
    if (error) throw error
  } else {
    const { error } = await supabase.from('tournaments').insert(tournamentData)
    if (error) throw error
  }
}

/**
 * Admin: delete a tournament
 */
export async function deleteTournament(id) {
  const { error } = await supabase.from('tournaments').delete().eq('id', id)
  if (error) throw error
}

/**
 * Fetch all tournaments with registration counts (admin listing)
 */
export async function fetchTournamentsWithRegCounts() {
  const { data, error } = await supabase
    .from('tournaments')
    .select('*, tournament_registrations(id, status)')
    .order('date', { ascending: false })
  if (error) throw error
  const tourneys = data || []
  const counts = {}
  tourneys.forEach((t) => {
    const regs = t.tournament_registrations || []
    counts[t.id] = regs.filter((r) => r.status !== 'cancelled').length
    delete t.tournament_registrations
  })
  return { tournaments: tourneys, regCounts: counts }
}
