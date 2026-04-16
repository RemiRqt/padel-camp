export const DEFAULT_TVA_RATE = 20

export function calculateTva(amountTTC, rate) {
  const ttc = Number(amountTTC) || 0
  const r = Number(rate) || 0
  if (r === 0) return { ht: ttc, tva: 0, ttc, rate: 0 }
  const ht = Math.round((ttc / (1 + r / 100)) * 100) / 100
  const tva = Math.round((ttc - ht) * 100) / 100
  return { ht, tva, ttc, rate: r }
}

export function getProductTvaRate(product) {
  if (!product) return DEFAULT_TVA_RATE
  if (product.tva_rate != null) return Number(product.tva_rate)
  if (product.category?.tva_rate != null) return Number(product.category.tva_rate)
  return DEFAULT_TVA_RATE
}

export function getSessionTvaRate(clubConfig) {
  if (clubConfig?.tva_rate_session != null) return Number(clubConfig.tva_rate_session)
  return DEFAULT_TVA_RATE
}

export function formatTvaRate(rate) {
  const n = Number(rate)
  if (!Number.isFinite(n)) return '—'
  return Number.isInteger(n) ? `${n}%` : `${n.toString().replace('.', ',')}%`
}

export function groupTvaByRate(items) {
  const map = new Map()
  for (const it of items) {
    const rate = Number(it.tva_rate) || 0
    const ht = Number(it.amount_ht) || 0
    const tva = Number(it.amount_tva) || 0
    const ttc = Number(it.amount) || 0
    const prev = map.get(rate) || { rate, ht: 0, tva: 0, ttc: 0, count: 0 }
    prev.ht += ht
    prev.tva += tva
    prev.ttc += ttc
    prev.count += 1
    map.set(rate, prev)
  }
  return Array.from(map.values())
    .map((b) => ({
      ...b,
      ht: Math.round(b.ht * 100) / 100,
      tva: Math.round(b.tva * 100) / 100,
      ttc: Math.round(b.ttc * 100) / 100,
    }))
    .sort((a, b) => a.rate - b.rate)
}
