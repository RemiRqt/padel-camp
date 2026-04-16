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
          supabase.from('club_config').select('id, name, address, phone, opening_time, closing_time, court_count, slot_duration, cancellation_hours, instagram_url').single(),
          supabase.from('pricing_rules').select('id, name, start_time, end_time, price, is_active').eq('is_active', true).order('start_time'),
          supabase.from('recharge_formulas').select('id, amount_paid, amount_credited, bonus_amount, label, is_active').eq('is_active', true).order('amount_paid'),
        ])
        if (configRes.error || pricingRes.error || formulasRes.error) {
          setError(true)
        } else {
          if (configRes.data) setConfig(configRes.data)
          if (pricingRes.data) setPricingRules(pricingRes.data)
          if (formulasRes.data) setFormulas(formulasRes.data)
        }
      } catch {
        setError(true)
      } finally {
        setLoading(false)
      }
    }
    fetch()
  }, [])

  return { config, pricingRules, formulas, loading, error }
}
