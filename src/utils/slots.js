/**
 * Génère tous les créneaux pour une journée donnée
 * @param {object} config - club_config row
 * @returns {Array<{start: string, end: string}>} ex: [{start:"09:30", end:"11:00"}, ...]
 */
export function generateSlots(config) {
  if (!config) return []
  const duration = config.slot_duration || 90
  const [openH, openM] = config.open_time.split(':').map(Number)
  const [closeH, closeM] = config.close_time.split(':').map(Number)
  const openMin = openH * 60 + openM
  const closeMin = closeH * 60 + closeM

  const slots = []
  let current = openMin
  while (current + duration <= closeMin) {
    const startH = Math.floor(current / 60)
    const startM = current % 60
    const endTotal = current + duration
    const endH = Math.floor(endTotal / 60)
    const endM = endTotal % 60
    slots.push({
      start: `${String(startH).padStart(2, '0')}:${String(startM).padStart(2, '0')}`,
      end: `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`,
    })
    current = endTotal
  }
  return slots
}

/**
 * Vérifie si un créneau est déjà réservé
 */
export function isSlotBooked(bookings, courtId, startTime) {
  return bookings.some(
    (b) => b.court_id === courtId && b.start_time.slice(0, 5) === startTime.slice(0, 5) && b.status === 'confirmed'
  )
}

/**
 * Vérifie si un créneau est dans le passé
 */
export function isSlotPast(date, startTime) {
  const now = new Date()
  const [h, m] = startTime.split(':').map(Number)
  const slotDate = new Date(date)
  slotDate.setHours(h, m, 0, 0)
  return slotDate < now
}
