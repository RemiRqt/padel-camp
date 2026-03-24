const DAYS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche']
const DAYS_SHORT = ['lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.']
const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']
const MONTHS_SHORT = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']

export function getDayIndex(date) {
  // JS: 0=dim, on veut 0=lun
  return (date.getDay() + 6) % 7
}

export function formatDateFull(date) {
  const d = new Date(date)
  return `${DAYS[getDayIndex(d)]} ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

export function formatDateShort(date) {
  const d = new Date(date)
  return `${DAYS_SHORT[getDayIndex(d)]} ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`
}

export function formatTime(timeStr) {
  // "09:30:00" -> "9h30"
  const [h, m] = timeStr.split(':')
  const hour = parseInt(h, 10)
  return m === '00' ? `${hour}h` : `${hour}h${m}`
}

export function toDateString(date) {
  // Date -> "YYYY-MM-DD"
  const d = new Date(date)
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
}

export function addDays(date, n) {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

export function isSameDay(a, b) {
  return toDateString(a) === toDateString(b)
}

export function isToday(date) {
  return isSameDay(date, new Date())
}

// Short month names for date badges (jan, fév, mar...)
const MONTHS_TINY = ['jan', 'fév', 'mar', 'avr', 'mai', 'jun', 'jul', 'aoû', 'sep', 'oct', 'nov', 'déc']

export function monthTiny(date) {
  return MONTHS_TINY[new Date(date).getMonth()]
}

export function dayNum(date) {
  return new Date(date).getDate()
}

export { DAYS, DAYS_SHORT, MONTHS, MONTHS_SHORT, MONTHS_TINY }
