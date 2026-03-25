import { supabase } from '@/lib/supabase'

const PLAYERS_PER_SESSION = 4

/**
 * Price per player = total price / 4 (always, padel = 4 players)
 */
export function partPrice(totalPrice) {
  return Math.round((parseFloat(totalPrice) / PLAYERS_PER_SESSION) * 100) / 100
}

/**
 * Create a booking with 4 player slots.
 * Slot 1 = reservant, slots 2-4 = empty ("Place disponible").
 * payNow: 'none' | 'my_part' | 'full'
 */
export async function createBooking({ userId, userName, courtId, date, startTime, endTime, price, payNow = 'none' }) {
  const totalPrice = parseFloat(price)
  const share = partPrice(totalPrice)

  // 1. Create booking
  const { data: booking, error } = await supabase
    .from('bookings')
    .insert({
      user_id: userId,
      user_name: userName,
      court_id: courtId,
      date,
      start_time: startTime,
      end_time: endTime,
      price: totalPrice,
      status: 'confirmed',
      payment_status: 'pending',
    })
    .select()
    .single()
  if (error) throw error

  // 2. Create 4 player slots
  const slots = [
    {
      booking_id: booking.id,
      user_id: userId,
      player_name: userName,
      parts: 1,
      payment_method: 'balance',
      amount: share,
      payment_status: payNow === 'full' || payNow === 'my_part' ? 'paid' : 'pending',
    },
    ...Array.from({ length: 3 }, () => ({
      booking_id: booking.id,
      user_id: null,
      player_name: 'Place disponible',
      parts: 1,
      payment_method: 'balance',
      amount: share,
      payment_status: payNow === 'full' ? 'paid' : 'pending',
    })),
  ]

  const { error: pErr } = await supabase.from('booking_players').insert(slots)
  if (pErr) throw pErr

  // 3. Debit
  if (payNow === 'my_part') {
    const { error: dErr } = await supabase.rpc('debit_user', {
      p_user_id: userId,
      p_amount: share,
      p_description: `Session ${courtId.replace('_', ' ')} — ${startTime.slice(0, 5)} (1/4)`,
      p_performed_by: userId,
      p_type: 'debit_session',
      p_booking_id: booking.id,
    })
    if (dErr) throw dErr
  } else if (payNow === 'full') {
    const { error: dErr } = await supabase.rpc('debit_user', {
      p_user_id: userId,
      p_amount: totalPrice,
      p_description: `Session ${courtId.replace('_', ' ')} — ${startTime.slice(0, 5)} (4/4)`,
      p_performed_by: userId,
      p_type: 'debit_session',
      p_booking_id: booking.id,
      p_parts_count: 4,
    })
    if (dErr) throw dErr
  }

  return booking
}

export async function cancelBooking(bookingId, cancelledBy = 'user') {
  const { data, error } = await supabase
    .from('bookings')
    .update({ status: 'cancelled', cancelled_by: cancelledBy })
    .eq('id', bookingId)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function getBookingWithPlayers(bookingId) {
  const { data: booking, error: bErr } = await supabase
    .from('bookings')
    .select('*')
    .eq('id', bookingId)
    .single()
  if (bErr) throw bErr

  const { data: players, error: pErr } = await supabase
    .from('booking_players')
    .select('*')
    .eq('booking_id', bookingId)
    .order('created_at')
  if (pErr) throw pErr

  return { booking, players }
}

/**
 * Assign a real player to an empty slot ("Place disponible").
 * Optionally adjust parts (default 1).
 */
export async function assignPlayerToSlot({ slotId, bookingId, userId, playerName, paymentMethod, parts = 1 }) {
  const { booking, players } = await getBookingWithPlayers(bookingId)
  if (booking.payment_status === 'paid') throw new Error('Session déjà entièrement payée')

  const share = partPrice(booking.price)
  const amount = Math.round(share * parts * 100) / 100

  // Members get a pending invitation, externals are accepted directly
  const invitationStatus = userId ? 'pending' : 'accepted'

  const { data, error } = await supabase
    .from('booking_players')
    .update({
      user_id: userId || null,
      player_name: playerName,
      parts,
      payment_method: paymentMethod || (userId ? 'balance' : 'cb'),
      amount,
      payment_status: 'pending',
      invitation_status: invitationStatus,
    })
    .eq('id', slotId)
    .select()
    .single()
  if (error) throw error

  // If parts > 1, recalculate other empty slots
  if (parts > 1) {
    const totalParts = players.reduce((s, p) => s + (p.id === slotId ? parts : p.parts), 0)
    // If total parts exceeds 4, we need to remove excess empty slots
    // For now, just update the amount on this slot
  }

  return data
}

/**
 * Reset a slot back to empty
 */
export async function clearSlot(slotId) {
  const share = 0 // will be recalculated by the caller
  const { error } = await supabase
    .from('booking_players')
    .update({
      user_id: null,
      player_name: 'Place disponible',
      parts: 1,
      payment_method: 'balance',
      payment_status: 'pending',
    })
    .eq('id', slotId)
  if (error) throw error
}

/**
 * Pay a player's share from their balance (debit_user, bonus first)
 */
export async function payPlayerShare({ playerId, bookingId, userId, amount, performedBy }) {
  const { error: debitErr } = await supabase.rpc('debit_user', {
    p_user_id: userId,
    p_amount: amount,
    p_description: `Paiement session`,
    p_performed_by: performedBy,
    p_type: 'debit_session',
    p_booking_id: bookingId,
  })
  if (debitErr) throw debitErr

  const { error } = await supabase
    .from('booking_players')
    .update({ payment_status: 'paid' })
    .eq('id', playerId)
  if (error) throw error
}

/**
 * Mark a player's share as paid externally (CB/cash)
 */
export async function markPlayerExternal({ playerId, bookingId, paymentMethod, amount, playerName, performedBy }) {
  await supabase.from('transactions').insert({
    user_id: null,
    type: 'external_payment',
    amount,
    description: `Session — ${playerName} (${paymentMethod})`,
    performed_by: performedBy,
    booking_id: bookingId,
    payment_method: paymentMethod,
  })

  const { error } = await supabase
    .from('booking_players')
    .update({ payment_status: 'external', payment_method: paymentMethod })
    .eq('id', playerId)
  if (error) throw error
}

/**
 * Admin: update parts on a player slot (e.g. 2 parts = 2x share)
 */
export async function updatePlayerParts({ playerId, bookingPrice, parts }) {
  const share = partPrice(bookingPrice)
  const amount = Math.round(share * parts * 100) / 100
  const { error } = await supabase
    .from('booking_players')
    .update({ parts, amount })
    .eq('id', playerId)
  if (error) throw error
}

export async function searchMembers(query) {
  if (!query || query.length < 2) return []
  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name, email, avatar_url, balance, balance_bonus')
    .ilike('display_name', `%${query}%`)
    .limit(5)
  if (error) throw error
  return data || []
}

/**
 * Get pending invitations for a user (sessions where they are invited but haven't accepted yet)
 */
export async function getMyInvitations(userId) {
  const { data, error } = await supabase
    .from('booking_players')
    .select('*, booking:bookings(*)')
    .eq('user_id', userId)
    .eq('invitation_status', 'pending')
    .order('created_at', { ascending: false })
  if (error) throw error
  // Only return invitations for confirmed upcoming bookings
  const today = new Date().toISOString().split('T')[0]
  return (data || []).filter(
    (p) => p.booking && p.booking.status === 'confirmed' && p.booking.date >= today
  )
}

/**
 * Accept an invitation and choose payment method
 */
export async function acceptInvitation({ playerId, paymentMethod }) {
  const { data, error } = await supabase
    .from('booking_players')
    .update({
      invitation_status: 'accepted',
      payment_method: paymentMethod,
    })
    .eq('id', playerId)
    .select()
    .single()
  if (error) throw error
  return data
}

/**
 * Decline an invitation — resets the slot to "Place disponible"
 */
export async function declineInvitation(playerId) {
  const { error } = await supabase
    .from('booking_players')
    .update({
      user_id: null,
      player_name: 'Place disponible',
      parts: 1,
      payment_method: 'balance',
      payment_status: 'pending',
      invitation_status: 'accepted', // reset slot is "accepted" (empty)
    })
    .eq('id', playerId)
  if (error) throw error
}
