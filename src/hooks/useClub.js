import { useQuery } from '@tanstack/react-query'
import { fetchClubConfig, fetchPricingRules, fetchFormulas } from '@/services/clubService'
import { qk } from '@/lib/queryKeys'

export function useClub() {
  const { data, isLoading, isError } = useQuery({
    queryKey: qk.club,
    queryFn: async () => {
      const [config, pricingRules, formulas] = await Promise.all([
        fetchClubConfig(),
        fetchPricingRules(true),
        fetchFormulas(true),
      ])
      return { config, pricingRules, formulas }
    },
    staleTime: 5 * 60_000,
  })

  return {
    config: data?.config ?? null,
    pricingRules: data?.pricingRules ?? [],
    formulas: data?.formulas ?? [],
    loading: isLoading,
    error: isError,
  }
}
