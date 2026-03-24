import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export function useClub() {
  const [config, setConfig] = useState(null)
  const [pricingRules, setPricingRules] = useState([])
  const [formulas, setFormulas] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetch() {
      const [configRes, pricingRes, formulasRes] = await Promise.all([
        supabase.from('club_config').select('*').single(),
        supabase.from('pricing_rules').select('*').eq('is_active', true).order('start_time'),
        supabase.from('recharge_formulas').select('*').eq('is_active', true).order('amount_paid'),
      ])
      if (configRes.data) setConfig(configRes.data)
      if (pricingRes.data) setPricingRules(pricingRes.data)
      if (formulasRes.data) setFormulas(formulasRes.data)
      setLoading(false)
    }
    fetch()
  }, [])

  return { config, pricingRules, formulas, loading }
}
