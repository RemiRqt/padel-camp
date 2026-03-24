import { getDayIndex } from './formatDate'

/**
 * Trouve la règle tarifaire applicable pour un créneau donné
 * @param {Array} pricingRules - les règles de pricing_rules
 * @param {Date} date - la date du créneau
 * @param {string} startTime - heure de début "HH:MM"
 * @returns {object|null} la règle applicable { label, price_per_slot }
 */
export function findPricingRule(pricingRules, date, startTime) {
  const dayIndex = getDayIndex(new Date(date))
  const time = startTime.slice(0, 5) // "HH:MM"

  return pricingRules.find((rule) => {
    if (!rule.is_active) return false
    if (!rule.days.includes(dayIndex)) return false
    const start = rule.start_time.slice(0, 5)
    const end = rule.end_time.slice(0, 5)
    return time >= start && time < end
  }) || null
}

/**
 * Calcule le prix d'un créneau
 */
export function getSlotPrice(pricingRules, date, startTime) {
  const rule = findPricingRule(pricingRules, date, startTime)
  return rule ? parseFloat(rule.price_per_slot) : 0
}

/**
 * Répartit le prix entre joueurs par parts égales
 * @param {number} totalPrice
 * @param {number} playersCount
 * @returns {number} prix par joueur arrondi à 2 décimales
 */
export function pricePerPlayer(totalPrice, playersCount) {
  if (playersCount <= 0) return totalPrice
  return Math.round((totalPrice / playersCount) * 100) / 100
}
