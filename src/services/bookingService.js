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

  // 2. Create 4 player slots + 3. Debit (with rollback on failure)
  try {
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
  } catch (err) {
    // Rollback: cancel the booking if player slots or debit failed
    await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', booking.id)
    throw err
  }

  return booking
}

export async function cancelBooking(bookingId, cancelledBy = 'user', userId = null) {
  // User cancellation: verify ownership and 24h window
  if (cancelledBy === 'user') {
    const { data: booking, error: fetchErr } = await supabase
      .from('bookings')
      .select('date, start_time, user_id')
      .eq('id', bookingId)
      .single()
    if (fetchErr) throw fetchErr

    // Ownership check — the requesting user must own the booking
    if (userId && booking.user_id !== userId) {
      throw new Error('Vous ne pouvez pas annuler la réservation d\'un autre membre.')
    }

    const bookingStart = new Date(`${booking.date}T${booking.start_time}`)
    const hoursUntil = (bookingStart - new Date()) / (1000 * 60 * 60)
    if (hoursUntil < 24) {
      throw new Error('Annulation impossible moins de 24h avant le créneau. Contactez le club.')
    }
  }

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
    .select('id, user_id, user_name, court_id, date, start_time, end_time, price, status, payment_status, cancelled_by, created_at')
    .eq('id', bookingId)
    .single()
  if (bErr) throw bErr

  const { data: players, error: pErr } = await supabase
    .from('booking_players')
    .select('id, booking_id, user_id, player_name, parts, payment_method, amount, payment_status, invitation_status, created_at')
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
  const { error: txErr } = await supabase.from('transactions').insert({
    user_id: null,
    type: 'external_payment',
    amount,
    description: `Session — ${playerName} (${paymentMethod})`,
    performed_by: performedBy,
    booking_id: bookingId,
    payment_method: paymentMethod,
  })
  if (txErr) throw txErr

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
    .select('id, display_name, email, avatar_url')
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
 * Accept an invitation and choose payment method.
 * If payment method is 'balance', automatically debit the user's account.
 */
export async function acceptInvitation({ playerId, paymentMethod, userId }) {
  // Get player info to know the amount and booking
  const { data: player, error: pErr } = await supabase
    .from('booking_players')
    .select('*, booking:bookings(*)')
    .eq('id', playerId)
    .single()
  if (pErr) throw pErr

  // Ownership check — the authenticated user must be the invited player
  if (player.user_id !== userId) {
    throw new Error('Vous ne pouvez pas accepter une invitation qui ne vous est pas destinée.')
  }

  const amount = parseFloat(player.amount)

  // 1. Update invitation status first (safe, no money involved)
  const updateData = {
    invitation_status: 'accepted',
    payment_method: paymentMethod,
  }
  if (paymentMethod === 'balance' && userId) {
    updateData.payment_status = 'paid'
  }

  const { data, error } = await supabase
    .from('booking_players')
    .update(updateData)
    .eq('id', playerId)
    .select()
    .single()
  if (error) throw error

  // 2. Debit after update succeeded (if balance payment)
  if (paymentMethod === 'balance' && userId) {
    const { error: debitErr } = await supabase.rpc('debit_user', {
      p_user_id: userId,
      p_amount: amount,
      p_description: `Session ${player.booking?.court_id?.replace('_', ' ')} — ${player.booking?.start_time?.slice(0, 5)}`,
      p_performed_by: userId,
      p_type: 'debit_session',
      p_booking_id: player.booking_id,
    })
    if (debitErr) {
      // Rollback: revert payment status
      await supabase.from('booking_players').update({ payment_status: 'pending' }).eq('id', playerId)
      throw debitErr
    }
  }

  return data
}

/**
 * Decline an invitation — resets the slot to "Place disponible"
 */
export async function declineInvitation(playerId, userId) {
  // Verify the slot belongs to this user before resetting it
  const { data: slot, error: fetchErr } = await supabase
    .from('booking_players')
    .select('user_id')
    .eq('id', playerId)
    .single()
  if (fetchErr) throw fetchErr

  if (slot.user_id !== userId) {
    throw new Error('Vous ne pouvez pas refuser une invitation qui ne vous est pas destinée.')
  }

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

/**
 * Update just the amount on a booking_player row
 */
export async function updatePlayerAmount(playerId, amount) {
  const { error } = await supabase
    .from('booking_players')
    .update({ amount })
    .eq('id', playerId)
  if (error) throw error
}

/**
 * Fetch tournaments and events that block courts on a given date
 */
export async function fetchDayBlockingEvents(date) {
  const [tRes, eRes] = await Promise.all([
    supabase.from('tournaments').select('name, start_time, end_time, level, category').eq('date', date).not('status', 'eq', 'cancelled'),
    supabase.from('events').select('name, start_time, end_time').eq('date', date),
  ])
  return [
    ...(tRes.data || []).map((t) => ({ ...t, type: 'tournament' })),
    ...(eRes.data || []).map((e) => ({ ...e, type: 'event' })),
  ]
}

/**
 * Admin: fetch bookings with players for a specific date
 */
export async function fetchAdminDayBookings(date) {
  const { data } = await supabase
    .from('bookings')
    .select('*, booking_players(*)')
    .eq('date', date)
    .eq('status', 'confirmed')
    .order('start_time', { ascending: true })
  return data || []
}

/**
 * Admin: fetch booking players for a specific booking
 */
export async function fetchBookingPlayers(bookingId) {
  const { data, error } = await supabase
    .from('booking_players')
    .select('id, booking_id, user_id, player_name, parts, payment_method, amount, payment_status, invitation_status, created_at')
    .eq('booking_id', bookingId)
    .order('created_at')
  if (error) throw error
  return data || []
}

/**
 * Admin: fetch a single booking by id (with or without players)
 */
export async function fetchBookingById(bookingId, { withPlayers = false } = {}) {
  const select = withPlayers ? '*, booking_players(*)' : '*'
  const { data, error } = await supabase
    .from('bookings')
    .select(select)
    .eq('id', bookingId)
    .single()
  if (error) throw error
  return data
}

/**
 * Admin: add or replace a player on a booking slot
 */
export async function adminUpdatePlayerSlot(slotId, updates) {
  const { error } = await supabase
    .from('booking_players')
    .update(updates)
    .eq('id', slotId)
  if (error) throw error
}

/**
 * Admin: insert a new booking player row
 */
export async function adminInsertPlayer(playerData) {
  const { error } = await supabase
    .from('booking_players')
    .insert(playerData)
  if (error) throw error
}

/**
 * Admin: cancel a booking directly
 */
export async function adminCancelBooking(bookingId) {
  const { error } = await supabase
    .from('bookings')
    .update({ status: 'cancelled', cancelled_by: 'admin' })
    .eq('id', bookingId)
  if (error) throw error
}

/**
 * Admin: force-accept an invitation
 */
export async function adminAcceptInvitation(playerId) {
  const { error } = await supabase
    .from('booking_players')
    .update({ invitation_status: 'accepted' })
    .eq('id', playerId)
  if (error) throw error
}

/**
 * Admin: sell products (debit or external transaction)
 */
export async function adminSellProduct({ buyerId, amount, description, performedBy, productId, paymentMethod }) {
  if (buyerId && paymentMethod === 'balance') {
    const { error } = await supabase.rpc('debit_user', {
      p_user_id: buyerId, p_amount: amount,
      p_description: description,
      p_performed_by: performedBy, p_type: 'debit_product', p_product_id: productId,
    })
    if (error) throw error
  } else {
    const { error } = await supabase.from('transactions').insert({
      user_id: buyerId || null,
      type: buyerId ? 'debit_product' : 'external_payment',
      amount, description,
      performed_by: performedBy, product_id: productId, payment_method: paymentMethod,
    })
    if (error) throw error
  }
}

/**
 * Fetch sales transactions for a given date
 */
export async function fetchDaySales(date) {
  const { data } = await supabase
    .from('transactions').select('id, user_id, type, amount, description, payment_method, created_at, booking_id, product_id')
    .in('type', ['debit_product', 'debit_session', 'external_payment'])
    .gte('created_at', date + 'T00:00:00').lte('created_at', date + 'T23:59:59')
    .order('created_at', { ascending: false }).limit(100)
  return data || []
}
