import { supabase } from '@/lib/supabase'

const PAGE_SIZE = 20

export async function fetchUserTransactions(userId, { limit = PAGE_SIZE } = {}) {
  const { data, error } = await supabase
    .from('transactions')
    .select('id, type, amount, amount_ht, amount_tva, tva_rate, bonus_used, real_used, description, created_at, payment_method, formula_amount_paid, formula_amount_credited, formula_bonus')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data || []
}

export async function fetchUserTransactionCount(userId) {
  const { count, error } = await supabase
    .from('transactions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
  if (error) throw error
  return count || 0
}

export async function fetchTransactionsByPeriod(from, to) {
  const { data, error } = await supabase
    .from('transactions')
    .select('id, user_id, type, amount, amount_ht, amount_tva, tva_rate, bonus_used, real_used, description, created_at, payment_method, formula_amount_paid, formula_amount_credited, formula_bonus, product_id, booking_id, profile:profiles(display_name)')
    .gte('created_at', from + 'T00:00:00')
    .lte('created_at', to + 'T23:59:59')
    .order('created_at', { ascending: false })
    .limit(2000)
  if (error) throw error
  return data || []
}
