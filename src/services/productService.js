import { supabase } from '@/lib/supabase'

export async function fetchCategoriesAndProducts() {
  const [cRes, pRes] = await Promise.all([
    supabase.from('product_categories').select('id, name, sort_order, is_active, tva_rate').order('sort_order'),
    supabase.from('products').select('id, name, price, category_id, description, is_active, tva_rate, category:product_categories(name, tva_rate)').order('name'),
  ])
  if (cRes.error) throw cRes.error
  if (pRes.error) throw pRes.error
  return { categories: cRes.data || [], products: pRes.data || [] }
}

export async function saveCategory(id, name, sortOrder, tvaRate) {
  const payload = { name }
  if (tvaRate != null && tvaRate !== '') payload.tva_rate = Number(tvaRate)
  if (id) {
    const { error } = await supabase.from('product_categories').update(payload).eq('id', id)
    if (error) throw error
  } else {
    const { error } = await supabase.from('product_categories').insert({ ...payload, sort_order: sortOrder })
    if (error) throw error
  }
}

export async function deleteCategory(id) {
  const { error } = await supabase.from('product_categories').delete().eq('id', id)
  if (error) throw error
}

export async function saveProduct(id, data) {
  if (id) {
    const { error } = await supabase.from('products').update(data).eq('id', id)
    if (error) throw error
  } else {
    const { error } = await supabase.from('products').insert(data)
    if (error) throw error
  }
}

export async function deleteProduct(id) {
  const { error } = await supabase.from('products').delete().eq('id', id)
  if (error) throw error
}

export async function toggleProduct(id, isActive) {
  const { error } = await supabase.from('products').update({ is_active: !isActive }).eq('id', id)
  if (error) throw error
}

/**
 * Fetch only active categories and products (for POS)
 */
export async function fetchActiveCategoriesAndProducts() {
  const [cRes, pRes] = await Promise.all([
    supabase.from('product_categories').select('id, name, sort_order, is_active, tva_rate').eq('is_active', true).order('sort_order'),
    supabase.from('products').select('*, category:product_categories(name, tva_rate)').eq('is_active', true).order('name'),
  ])
  if (cRes.error) throw cRes.error
  if (pRes.error) throw pRes.error
  return { categories: cRes.data || [], products: pRes.data || [] }
}
