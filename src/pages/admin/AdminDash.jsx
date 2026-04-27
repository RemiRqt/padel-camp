import { useEffect, useState, useMemo, lazy, Suspense } from 'react'
import { fetchAdminDashboard } from '@/services/dashboardService'
import PageWrapper from '@/components/layout/PageWrapper'
import Card from '@/components/ui/Card'
import { toDateString } from '@/utils/formatDate'
import {
  Users, CalendarDays, Euro, ShoppingCart, CreditCard,
  Trophy, Percent, ChevronLeft, ChevronRight
} from 'lucide-react'

// Lazy-load recharts-using components to keep AdminDash chunk light
const RevenueChart = lazy(() => import('@/components/admin/dashboard/RevenueChart'))
const DashboardCharts = lazy(() => import('@/components/admin/dashboard/DashboardCharts'))

const COLORS = ['#0B2778', '#D4E620', '#34C759', '#FF9500', '#FF3B30', '#6E6E73']

function ChartSkeleton({ height = 280 }) {
  return (
    <div
      className="bg-surface-2 rounded-2xl animate-pulse"
      style={{ height }}
      aria-label="Chargement du graphique"
    />
  )
}

function kpi(val, suffix = '') {
  if (val === null || val === undefined) return '—'
  const n = parseFloat(val)
  if (isNaN(n)) return '—'
  return n.toLocaleString('fr-FR', { maximumFractionDigits: 2 }) + suffix
}

function monthBounds(year, month) {
  // month: 0-indexed (0=Jan, 11=Dec)
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const today = new Date()
  // If selected month is current month, cap "to" at today
  const to = lastDay > today ? today : lastDay
  return { from: toDateString(firstDay), to: toDateString(to) }
}

const MONTH_NAMES = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']

export default function AdminDash() {
  const todayDate = new Date()
  const [year, setYear] = useState(todayDate.getFullYear())
  const [month, setMonth] = useState(todayDate.getMonth())
  const { from, to } = monthBounds(year, month)
  const [loading, setLoading] = useState(true)

  const [membersCount, setMembersCount] = useState(0)
  const [todayBookings, setTodayBookings] = useState(0)
  const [transactions, setTransactions] = useState([])
  const [bookings, setBookings] = useState([])
  const [courtOccupancy, setCourtOccupancy] = useState([])
  const [tournamentsCount, setTournamentsCount] = useState(0)
  const [occupancyRate, setOccupancyRate] = useState(0)

  useEffect(() => {
    async function fetch() {
      setLoading(true)
      try {
        const result = await fetchAdminDashboard(from, to)
        setMembersCount(result.membersCount)
        setTodayBookings(result.todayBookings)
        setTransactions(result.transactions)
        setBookings(result.bookings)
        setTournamentsCount(result.tournamentsCount)

        // Taux d'occupation : résas / (jours × 3 terrains × 9 créneaux/jour)
        const dayCount = Math.max(1, Math.ceil((new Date(to) - new Date(from)) / 86400000) + 1)
        const maxSlots = dayCount * 3 * 9
        const periodBookings = result.bookings || []
        setOccupancyRate(Math.min(100, Math.round((periodBookings.length / maxSlots) * 100)))

        // Court occupancy : nb résas + % occupation par terrain
        const slotsPerCourt = dayCount * 9
        const courts = { terrain_1: 0, terrain_2: 0, terrain_3: 0 }
        periodBookings.forEach((b) => {
          if (courts[b.court_id] != null) courts[b.court_id] += 1
        })
        setCourtOccupancy(Object.entries(courts).map(([id, count]) => ({
          name: `Terrain ${id.replace('terrain_', '')}`,
          reservations: count,
          percent: Math.min(100, Math.round((count / slotsPerCourt) * 100)),
        })))
      } catch (err) {
        console.error('[AdminDash] fetch error:', err)
      } finally {
        setLoading(false)
      }
    }
    fetch()
  }, [from, to])

  // Sessions paid vs pending
  const sessionStats = useMemo(() => {
    const paid = bookings.filter((b) => b.payment_status === 'paid').length
    const pending = bookings.filter((b) => b.payment_status !== 'paid').length
    return { paid, pending }
  }, [bookings])

  // Compute KPIs : CA = sessions (toutes méthodes) + articles (toutes méthodes)
  const kpis = useMemo(() => {
    let caSessions = 0, caArticles = 0, recharges = 0, encaissementCaisse = 0
    transactions.forEach((tx) => {
      const amount = parseFloat(tx.amount) || 0
      const isSession = tx.type === 'debit_session'
                     || (tx.type === 'external_payment' && tx.booking_id)
      const isArticle = tx.type === 'debit_product'
                     || (tx.type === 'external_payment' && tx.product_id)
      if (isSession) caSessions += amount
      if (isArticle) caArticles += amount
      if (tx.type === 'credit') recharges += amount
      // Encaissement caisse : argent réel entré (CB + cash, tous types confondus)
      if (tx.payment_method === 'cb' || tx.payment_method === 'cash') {
        encaissementCaisse += amount
      }
    })
    return { caSessions, caArticles, recharges, encaissementCaisse, caTotal: caSessions + caArticles }
  }, [transactions])

  // CA par jour : sessions + articles (le "vrai" chiffre d'affaires)
  const revenueByDay = useMemo(() => {
    const map = {}
    // Borner sur la période [from, to] et initialiser tous les jours à 0
    const startDate = new Date(from)
    const endDate = new Date(to)
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const key = toDateString(d)
      map[key] = { date: key, sessions: 0, articles: 0 }
    }
    transactions.forEach((tx) => {
      const day = tx.created_at.split('T')[0]
      if (!map[day]) return
      const amount = parseFloat(tx.amount) || 0
      const isSession = tx.type === 'debit_session'
                     || (tx.type === 'external_payment' && tx.booking_id)
      const isArticle = tx.type === 'debit_product'
                     || (tx.type === 'external_payment' && tx.product_id)
      if (isSession) map[day].sessions += amount
      if (isArticle) map[day].articles += amount
    })
    return Object.values(map).sort((a, b) => a.date.localeCompare(b.date))
      .map((d) => ({
        ...d,
        label: new Date(d.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }),
      }))
  }, [transactions, from, to])

  // Transaction type breakdown for pie
  const txBreakdown = useMemo(() => {
    const map = {}
    const labels = {
      credit: 'Crédits',
      credit_bonus: 'Bonus',
      debit_session: 'Sessions',
      debit_product: 'Articles',
      refund: 'Remboursements',
      external_payment: 'Paiements ext.',
    }
    transactions.forEach((tx) => {
      const key = tx.type
      if (!map[key]) map[key] = { name: labels[key] || key, value: 0 }
      map[key].value += parseFloat(tx.amount) || 0
    })
    return Object.values(map).filter((d) => d.value > 0)
  }, [transactions])

  return (
    <PageWrapper wide>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h1 className="text-2xl font-bold text-text">Dashboard</h1>
          {/* Month selector */}
          <div className="flex items-center gap-2 bg-white rounded-[12px] border border-separator p-1">
            <button
              onClick={() => {
                if (month === 0) { setYear(year - 1); setMonth(11) }
                else setMonth(month - 1)
              }}
              className="p-2 rounded-[8px] hover:bg-bg cursor-pointer"
              aria-label="Mois précédent"
            >
              <ChevronLeft className="w-4 h-4 text-text-secondary" />
            </button>
            <span className="px-3 text-sm font-semibold text-text min-w-[140px] text-center">
              {MONTH_NAMES[month]} {year}
            </span>
            <button
              onClick={() => {
                const next = new Date(year, month + 1, 1)
                if (next > new Date()) return  // pas de mois futur
                if (month === 11) { setYear(year + 1); setMonth(0) }
                else setMonth(month + 1)
              }}
              disabled={year === todayDate.getFullYear() && month === todayDate.getMonth()}
              className="p-2 rounded-[8px] hover:bg-bg cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
              aria-label="Mois suivant"
            >
              <ChevronRight className="w-4 h-4 text-text-secondary" />
            </button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Card className="!p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-[8px] bg-primary/10 flex items-center justify-center">
                <Euro className="w-4 h-4 text-primary" />
              </div>
              <span className="text-xs text-text-secondary font-medium">CA Sessions</span>
            </div>
            <p className="text-2xl font-bold text-primary">{kpi(kpis.caSessions, '€')}</p>
          </Card>
          <Card className="!p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-[8px] bg-warning/10 flex items-center justify-center">
                <ShoppingCart className="w-4 h-4 text-warning" />
              </div>
              <span className="text-xs text-text-secondary font-medium">CA Articles</span>
            </div>
            <p className="text-2xl font-bold text-warning">{kpi(kpis.caArticles, '€')}</p>
          </Card>
          <Card className="!p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-[8px] bg-lime/20 flex items-center justify-center">
                <CreditCard className="w-4 h-4 text-lime-dark" />
              </div>
              <span className="text-xs text-text-secondary font-medium">Recharges</span>
            </div>
            <p className="text-2xl font-bold text-lime-dark">{kpi(kpis.recharges, '€')}</p>
          </Card>
          <Card className="!p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-[8px] bg-success/10 flex items-center justify-center">
                <Euro className="w-4 h-4 text-success" />
              </div>
              <span className="text-xs text-text-secondary font-medium">Encaissement caisse</span>
            </div>
            <p className="text-2xl font-bold text-success">{kpi(kpis.encaissementCaisse, '€')}</p>
            <p className="text-[10px] text-text-tertiary mt-0.5">CB + espèces</p>
          </Card>
          <Card className="!p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-[8px] bg-primary/10 flex items-center justify-center">
                <Users className="w-4 h-4 text-primary" />
              </div>
              <span className="text-xs text-text-secondary font-medium">Membres</span>
            </div>
            <p className="text-2xl font-bold text-primary">{membersCount}</p>
          </Card>
          <Card className="!p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-[8px] bg-primary/10 flex items-center justify-center">
                <CalendarDays className="w-4 h-4 text-primary" />
              </div>
              <span className="text-xs text-text-secondary font-medium">Résas aujourd'hui</span>
            </div>
            <p className="text-2xl font-bold text-primary">{todayBookings}</p>
            <p className="text-[10px] text-text-tertiary mt-0.5">
              Période: {sessionStats.paid} payées · {sessionStats.pending} en attente
            </p>
          </Card>
          <Card className="!p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-[8px] bg-primary/10 flex items-center justify-center">
                <Percent className="w-4 h-4 text-primary" />
              </div>
              <span className="text-xs text-text-secondary font-medium">Taux occupation</span>
            </div>
            <p className="text-2xl font-bold text-primary">{occupancyRate}%</p>
          </Card>
          <Card className="!p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-[8px] bg-primary/10 flex items-center justify-center">
                <Trophy className="w-4 h-4 text-primary" />
              </div>
              <span className="text-xs text-text-secondary font-medium">Tournois actifs</span>
            </div>
            <p className="text-2xl font-bold text-primary">{tournamentsCount}</p>
          </Card>
        </div>

        {/* Revenue chart (lazy) */}
        <Suspense fallback={<ChartSkeleton height={336} />}>
          <RevenueChart data={revenueByDay} />
        </Suspense>

        {/* Transactions + court occupancy charts (lazy) */}
        <Suspense fallback={<ChartSkeleton height={300} />}>
          <DashboardCharts txBreakdown={txBreakdown} courtOccupancy={courtOccupancy} COLORS={COLORS} />
        </Suspense>

      </div>
    </PageWrapper>
  )
}
