import { supabase } from '@/lib/supabase'
import { toDateString } from '@/utils/formatDate'

export async function fetchUserDashboard(userId) {
  const today = toDateString(new Date())
  const [txRes, tRes, bStatsRes, txCountRes] = await Promise.all([
    supabase
      .from('transactions')
      .select('id, type, amount, bonus_used, real_used, description, created_at, payment_method, formula_amount_paid, formula_amount_credited, formula_bonus')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('tournament_registrations')
      .select('id, player1_uid, player2_uid, status, player1_confirmed, player2_confirmed, tournament:tournaments(id, name, date, start_time, level, category, confirmation_deadline)')
      .or(`player1_uid.eq.${userId},player2_uid.eq.${userId}`)
      .not('status', 'eq', 'cancelled')
      .order('created_at', { ascending: false }),
    supabase
      .from('bookings')
      .select('id, date, status')
      .eq('user_id', userId)
      .eq('status', 'confirmed')
      .limit(500),
    supabase
      .from('transactions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId),
  ])

  if (txRes.error) throw txRes.error
  if (tRes.error) throw tRes.error
  if (bStatsRes.error) throw bStatsRes.error

  const registrations = (tRes.data || []).filter((r) => r.tournament)
  const completed = (bStatsRes.data || []).filter((b) => b.date < today).length
  const upcoming = (bStatsRes.data || []).filter((b) => b.date >= today).length

  return {
    transactions: txRes.data || [],
    txTotal: txCountRes.count || 0,
    registrations,
    bookingStats: { completed, upcoming },
  }
}

export async function fetchAdminDashboard(from, to) {
  const today = toDateString(new Date())
  const [mRes, tbRes, txRes, bRes, ttRes, drRes] = await Promise.all([
    supabase.from('profiles').select('id', { count: 'exact', head: true }),
    supabase.from('bookings').select('id', { count: 'exact', head: true })
      .eq('date', today).eq('status', 'confirmed'),
    supabase.from('transactions')
      .select('id, type, amount, description, created_at, payment_method, booking_id, product_id')
      .gte('created_at', from + 'T00:00:00')
      .lte('created_at', to + 'T23:59:59')
      .order('created_at')
      .limit(50000),
    supabase.from('bookings')
      .select('id, court_id, payment_status')
      .gte('date', from).lte('date', to)
      .eq('status', 'confirmed')
      .limit(20000),
    supabase.from('tournaments').select('id', { count: 'exact', head: true })
      .in('status', ['open', 'full', 'closed']),
    // Roll-up serveur du CA quotidien : ≤ 31 lignes, pas de cap PostgREST
    supabase.rpc('admin_daily_revenue', { p_from: from, p_to: to }),
  ])

  if (txRes.error) throw txRes.error
  if (bRes.error) throw bRes.error
  if (drRes.error) throw drRes.error

  return {
    membersCount: mRes.count || 0,
    todayBookings: tbRes.count || 0,
    transactions: txRes.data || [],
    bookings: bRes.data || [],
    tournamentsCount: ttRes.count || 0,
    dailyRevenue: drRes.data || [],
  }
}

export async function fetchLandingData() {
  const today = new Date().toISOString().split('T')[0]
  const [prRes, tRes, eRes, cfgRes, bRes] = await Promise.all([
    supabase.from('pricing_rules').select('id, label, start_time, end_time, days, price_per_slot').eq('is_active', true).order('start_time'),
    supabase.from('tournaments').select('id, name, date, start_time, level, category, status').in('status', ['open', 'full']).gte('date', today).order('date').limit(3),
    supabase.from('events').select('id, name, description, date').eq('is_public', true).gte('date', today).order('date').limit(3),
    supabase.from('club_config').select('id, name, address, phone, description, instagram_url, courts_count, court_names, slot_duration, open_time, close_time').single(),
    supabase.from('bookings').select('court_id, start_time').eq('date', today).eq('status', 'confirmed'),
  ])

  return {
    pricingRules: prRes.data || [],
    tournaments: tRes.data || [],
    events: eRes.data || [],
    config: cfgRes.data,
    todayBookings: bRes.data || [],
  }
}
