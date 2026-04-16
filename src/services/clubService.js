import { supabase } from '@/lib/supabase'

export async function fetchClubConfig() {
  const { data, error } = await supabase
    .from('club_config')
    .select('id, name, address, phone, description, instagram_url, courts_count, court_names, slot_duration, open_time, close_time, open_days, tva_rate_session')
    .single()
  if (error) throw error
  return data
}

export async function updateClubConfig(id, updates) {
  const { error } = await supabase
    .from('club_config')
    .update(updates)
    .eq('id', id)
  if (error) throw error
}

export async function fetchPricingRules(activeOnly = true) {
  let q = supabase.from('pricing_rules').select('id, label, start_time, end_time, days, price_per_slot, is_active').order('start_time')
  if (activeOnly) q = q.eq('is_active', true)
  const { data, error } = await q
  if (error) throw error
  return data || []
}

export async function savePricingRule(id, data) {
  if (id) {
    const { error } = await supabase.from('pricing_rules').update(data).eq('id', id)
    if (error) throw error
  } else {
    const { error } = await supabase.from('pricing_rules').insert(data)
    if (error) throw error
  }
}

export async function deletePricingRule(id) {
  const { error } = await supabase.from('pricing_rules').delete().eq('id', id)
  if (error) throw error
}

export async function fetchFormulas(activeOnly = true) {
  let q = supabase.from('recharge_formulas').select('id, amount_paid, amount_credited, bonus, is_active').order('amount_paid')
  if (activeOnly) q = q.eq('is_active', true)
  const { data, error } = await q
  if (error) throw error
  return data || []
}

export async function saveFormula(id, data) {
  if (id) {
    const { error } = await supabase.from('recharge_formulas').update(data).eq('id', id)
    if (error) throw error
  } else {
    const { error } = await supabase.from('recharge_formulas').insert(data)
    if (error) throw error
  }
}

export async function toggleFormula(id, isActive) {
  const { error } = await supabase.from('recharge_formulas').update({ is_active: !isActive }).eq('id', id)
  if (error) throw error
}

export async function deleteFormula(id) {
  const { error } = await supabase.from('recharge_formulas').delete().eq('id', id)
  if (error) throw error
}
