import { supabase } from '@/lib/supabase'

export async function fetchUpcomingEvents({ limit = 10 } = {}) {
  const today = new Date().toISOString().split('T')[0]
  const { data, error } = await supabase
    .from('events')
    .select('id, name, description, date, start_time, end_time, image_url, is_public')
    .eq('is_public', true)
    .gte('date', today)
    .order('date')
    .limit(limit)
  if (error) throw error
  return data || []
}

export async function fetchAllEvents() {
  const { data, error } = await supabase
    .from('events')
    .select('id, name, description, date, start_time, end_time, image_url, is_public')
    .eq('is_public', true)
    .order('date', { ascending: false })
  if (error) throw error
  return data || []
}

/**
 * Fetch all events (admin, no is_public filter)
 */
export async function fetchAllEventsAdmin() {
  const { data, error } = await supabase
    .from('events')
    .select('id, name, description, date, start_time, end_time, image_url, is_public, created_at')
    .order('date')
  if (error) throw error
  return data || []
}

/**
 * Admin: create or update an event
 */
export async function saveEvent(id, eventData) {
  if (id) {
    const { error } = await supabase.from('events').update(eventData).eq('id', id)
    if (error) throw error
  } else {
    const { error } = await supabase.from('events').insert(eventData)
    if (error) throw error
  }
}

/**
 * Admin: delete an event
 */
export async function deleteEvent(id) {
  const { error } = await supabase.from('events').delete().eq('id', id)
  if (error) throw error
}
