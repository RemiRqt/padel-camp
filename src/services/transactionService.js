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

const TX_SELECT = 'id, user_id, type, amount, amount_ht, amount_tva, tva_rate, bonus_used, real_used, description, created_at, payment_method, formula_amount_paid, formula_amount_credited, formula_bonus, product_id, booking_id, profile:profiles!transactions_user_id_fkey(display_name)'

// Page paginée pour la table à l'écran (filtre méthode optionnel)
export async function fetchTransactionsPage(from, to, { page = 0, pageSize = 100, method = null } = {}) {
  const fromIdx = page * pageSize
  const toIdx = fromIdx + pageSize - 1
  let q = supabase
    .from('transactions')
    .select(TX_SELECT, { count: 'exact' })
    .gte('created_at', from + 'T00:00:00')
    .lte('created_at', to + 'T23:59:59')
    .order('created_at', { ascending: false })
    .range(fromIdx, toIdx)
  if (method) q = q.eq('payment_method', method)
  const { data, error, count } = await q
  if (error) throw error
  return { data: data || [], count: count || 0 }
}

// Récupère TOUTES les transactions d'une période en boucle de range(),
// utilisé par les exports comptables — contournement du cap PostgREST.
export async function fetchAllTransactionsByPeriod(from, to, { batchSize = 1000 } = {}) {
  const all = []
  let page = 0
  while (true) {
    const fromIdx = page * batchSize
    const toIdx = fromIdx + batchSize - 1
    const { data, error } = await supabase
      .from('transactions')
      .select(TX_SELECT)
      .gte('created_at', from + 'T00:00:00')
      .lte('created_at', to + 'T23:59:59')
      .order('created_at', { ascending: false })
      .range(fromIdx, toIdx)
    if (error) throw error
    const rows = data || []
    all.push(...rows)
    if (rows.length < batchSize) break
    page += 1
    if (page > 50) break // garde-fou : 50 × 1000 = 50 000 max
  }
  return all
}

// Résumé financier server-side (RPCs) — pas de cap PostgREST.
export async function fetchFinancialSummary(from, to) {
  const [sumRes, tvaRes] = await Promise.all([
    supabase.rpc('admin_financial_summary', { p_from: from, p_to: to }),
    supabase.rpc('admin_financial_tva',     { p_from: from, p_to: to }),
  ])
  if (sumRes.error) throw sumRes.error
  if (tvaRes.error) throw tvaRes.error
  const s = (sumRes.data && sumRes.data[0]) || {}
  return {
    summary: {
      sessions: {
        count: Number(s.sessions_count) || 0,
        total: Number(s.sessions_total) || 0,
        wallet: Number(s.sessions_wallet) || 0,
        cb: Number(s.sessions_cb) || 0,
        cash: Number(s.sessions_cash) || 0,
      },
      articles: {
        count: Number(s.articles_count) || 0,
        total: Number(s.articles_total) || 0,
        wallet: Number(s.articles_wallet) || 0,
        cb: Number(s.articles_cb) || 0,
        cash: Number(s.articles_cash) || 0,
      },
      recharges: {
        count: Number(s.recharges_count) || 0,
        total: Number(s.recharges_total) || 0,
        cb: Number(s.recharges_cb) || 0,
        cash: Number(s.recharges_cash) || 0,
      },
      encaissement: {
        cb: Number(s.encaissement_cb) || 0,
        cash: Number(s.encaissement_cash) || 0,
        total: Number(s.encaissement_total) || 0,
        walletDebited: Number(s.wallet_debited) || 0,
        bonusConsumed: Number(s.bonus_consumed) || 0,
      },
      totals: {
        ht: Number(s.total_ht) || 0,
        tva: Number(s.total_tva) || 0,
        ttc: Number(s.total_ttc) || 0,
      },
      counts: {
        balance: Number(s.count_balance) || 0,
        cb: Number(s.count_cb) || 0,
        cash: Number(s.count_cash) || 0,
        total: Number(s.count_total) || 0,
      },
    },
    tvaBreakdown: (tvaRes.data || []).map((b) => ({
      rate: Number(b.rate),
      ht: Number(b.ht) || 0,
      tva: Number(b.tva) || 0,
      ttc: Number(b.ttc) || 0,
      count: Number(b.count) || 0,
    })),
  }
}
