import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export function useClub() {
  const [config, setConfig] = useState(null)
  const [pricingRules, setPricingRules] = useState([])
  const [formulas, setFormulas] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    async function fetch() {
      try {
        const [configRes, pricingRes, formulasRes] = await Promise.all([
          supabase.from('club_config').select('id, name, address, phone, description, instagram_url, courts_count, court_names, slot_duration, open_days, open_time, close_time, tva_rate_session').single(),
          supabase.from('pricing_rules').select('id, label, start_time, end_time, days, price_per_slot, is_active').eq('is_active', true).order('start_time'),
          supabase.from('recharge_formulas').select('id, amount_paid, amount_credited, bonus, is_active').eq('is_active', true).order('amount_paid'),
        ])
        if (configRes.error || pricingRes.error || formulasRes.error) {
          console.error('[useClub] fetch error:', configRes.error?.message, pricingRes.error?.message, formulasRes.error?.message)
          setError(true)
        } else {
          if (configRes.data) setConfig(configRes.data)
          if (pricingRes.data) setPricingRules(pricingRes.data)
          if (formulasRes.data) setFormulas(formulasRes.data)
        }
      } catch (err) {
        console.error('[useClub] fetch exception:', err)
        setError(true)
      } finally {
        setLoading(false)
      }
    }
    fetch()
  }, [])

  return { config, pricingRules, formulas, loading, error }
}
