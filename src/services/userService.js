import { supabase } from '@/lib/supabase'

const PAGE_SIZE = 20

export async function fetchMembers({ page = 0 } = {}) {
  const from = page * PAGE_SIZE
  const to = from + PAGE_SIZE - 1
  const { data, error, count } = await supabase
    .from('profiles')
    .select('id, display_name, email, phone, role, balance, balance_bonus, license_number, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to)
  if (error) throw error
  return { data: data || [], count: count || 0 }
}

export async function fetchAllMembers() {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name, email, phone, role, balance, balance_bonus, license_number, created_at')
    .order('created_at', { ascending: false })
    .limit(500)
  if (error) throw error
  return data || []
}

export async function fetchMembersCount() {
  const { count, error } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
  if (error) throw error
  return count || 0
}

export async function searchMembers(query, excludeId = null) {
  if (!query || query.length < 2) return []
  // RPC : recherche insensible aux accents et à la casse + retourne le solde
  const { data, error } = await supabase.rpc('search_members_unaccented', {
    p_query: query,
    p_limit: 5,
    p_exclude_id: excludeId || null,
  })
  if (error) throw error
  return data || []
}

// Whitelist of fields a user can update on their own profile
const ALLOWED_PROFILE_FIELDS = ['display_name', 'phone', 'license_number', 'avatar_url']

export async function updateProfile(userId, updates) {
  const safeUpdates = Object.fromEntries(
    Object.entries(updates).filter(([key]) => ALLOWED_PROFILE_FIELDS.includes(key))
  )
  if (Object.keys(safeUpdates).length === 0) {
    throw new Error('Aucun champ valide à mettre à jour.')
  }
  const { error } = await supabase
    .from('profiles')
    .update(safeUpdates)
    .eq('id', userId)
  if (error) throw error
}

export async function creditMember(memberId, adminId, amountPaid, amountCredited, description, paymentMethod = 'cb') {
  const { error } = await supabase.rpc('credit_user', {
    p_user_id: memberId,
    p_performed_by: adminId,
    p_amount_paid: amountPaid,
    p_amount_credited: amountCredited,
    p_description: description,
    p_payment_method: paymentMethod,
  })
  if (error) throw error
}

export async function createMember(email, password, displayName, phone) {
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { display_name: displayName, phone } },
  })
  if (error) throw error
}
