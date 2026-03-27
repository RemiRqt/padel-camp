import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import PageWrapper from '@/components/layout/PageWrapper'
import Card from '@/components/ui/Card'
import DateRangePicker from '@/components/ui/DateRangePicker'
import ExportButtons from '@/components/ui/ExportButtons'
import { exportExcel, exportPDF } from '@/utils/export'
import { toDateString } from '@/utils/formatDate'
import {
  Users, CalendarDays, Euro, Gift, ShoppingCart, CreditCard,
  TrendingUp, BarChart3, Trophy, Percent
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line
} from 'recharts'

const COLORS = ['#0B2778', '#D4E620', '#34C759', '#FF9500', '#FF3B30', '#6E6E73']

function kpi(val, suffix = '') {
  if (val === null || val === undefined) return '—'
  const n = parseFloat(val)
  if (isNaN(n)) return '—'
  return n.toLocaleString('fr-FR', { maximumFractionDigits: 2 }) + suffix
}

export default function AdminDash() {
  const thirtyDaysAgo = toDateString(new Date(Date.now() - 30 * 86400000))
  const today = toDateString(new Date())

  const [from, setFrom] = useState(thirtyDaysAgo)
  const [to, setTo] = useState(today)
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
      const [mRes, tbRes, txRes, bRes, ttRes] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('bookings').select('id', { count: 'exact', head: true })
          .eq('date', today).eq('status', 'confirmed'),
        supabase.from('transactions').select('*')
          .gte('created_at', from + 'T00:00:00')
          .lte('created_at', to + 'T23:59:59')
          .order('created_at'),
        supabase.from('bookings').select('*')
          .gte('date', from).lte('date', to)
          .eq('status', 'confirmed'),
        supabase.from('tournaments').select('id', { count: 'exact', head: true })
          .in('status', ['open', 'full', 'closed']),
      ])

      setMembersCount(mRes.count || 0)
      setTodayBookings(tbRes.count || 0)
      setTransactions(txRes.data || [])
      setBookings(bRes.data || [])
      setTournamentsCount(ttRes.count || 0)

      // Taux d'occupation : résas / (jours × 3 terrains × 9 créneaux/jour)
      const dayCount = Math.max(1, Math.ceil((new Date(to) - new Date(from)) / 86400000) + 1)
      const maxSlots = dayCount * 3 * 9
      setOccupancyRate(Math.min(100, Math.round(((bRes.data?.length || 0) / maxSlots) * 100)))

      // Court occupancy
      const courts = {}
      ;(bRes.data || []).forEach((b) => {
        courts[b.court_id] = (courts[b.court_id] || 0) + 1
      })
      setCourtOccupancy(Object.entries(courts).map(([id, count]) => ({
        name: `Terrain ${id.replace('terrain_', '')}`,
        reservations: count,
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

  // Compute KPIs
  const kpis = useMemo(() => {
    let caReal = 0, caBonus = 0, caArticles = 0, paiementsExternes = 0
    transactions.forEach((tx) => {
      const amount = parseFloat(tx.amount) || 0
      if (tx.type === 'credit') caReal += amount
      if (tx.type === 'credit_bonus') caBonus += amount
      if (tx.type === 'debit_product') caArticles += amount
      if (tx.type === 'external_payment') paiementsExternes += amount
    })
    return { caReal, caBonus, caArticles, paiementsExternes }
  }, [transactions])

  // Revenue by day for line chart
  const revenueByDay = useMemo(() => {
    const map = {}
    transactions.forEach((tx) => {
      const day = tx.created_at.split('T')[0]
      if (!map[day]) map[day] = { date: day, reel: 0, bonus: 0 }
      if (tx.type === 'credit') map[day].reel += parseFloat(tx.amount) || 0
      if (tx.type === 'credit_bonus') map[day].bonus += parseFloat(tx.amount) || 0
    })
    return Object.values(map).sort((a, b) => a.date.localeCompare(b.date))
      .map((d) => ({
        ...d,
        label: new Date(d.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }),
      }))
  }, [transactions])

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

  const handleExport = (format) => {
    const cols = [
      { key: 'date', label: 'Date' },
      { key: 'type', label: 'Type' },
      { key: 'amount', label: 'Montant' },
      { key: 'description', label: 'Description' },
    ]
    const rows = transactions.map((tx) => ({
      date: new Date(tx.created_at).toLocaleDateString('fr-FR'),
      type: tx.type,
      amount: parseFloat(tx.amount).toFixed(2) + '€',
      description: tx.description,
    }))
    if (format === 'excel') exportExcel(rows, cols, `dashboard_${from}_${to}`)
    else exportPDF(rows, cols, `dashboard_${from}_${to}`, 'Padel Camp — Dashboard')
  }

  return (
    <PageWrapper wide>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h1 className="text-2xl font-bold text-text">Dashboard</h1>
          <div className="flex items-center gap-2">
            <DateRangePicker from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t) }} />
            <ExportButtons
              onExcel={() => handleExport('excel')}
              onPDF={() => handleExport('pdf')}
            />
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Card className="!p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-[8px] bg-primary/10 flex items-center justify-center">
                <Euro className="w-4 h-4 text-primary" />
              </div>
              <span className="text-xs text-text-secondary font-medium">CA réel</span>
            </div>
            <p className="text-2xl font-bold text-primary">{kpi(kpis.caReal, '€')}</p>
          </Card>
          <Card className="!p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-[8px] bg-lime/20 flex items-center justify-center">
                <Gift className="w-4 h-4 text-lime-dark" />
              </div>
              <span className="text-xs text-text-secondary font-medium">Bonus offerts</span>
            </div>
            <p className="text-2xl font-bold text-lime-dark">{kpi(kpis.caBonus, '€')}</p>
          </Card>
          <Card className="!p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-[8px] bg-warning/10 flex items-center justify-center">
                <ShoppingCart className="w-4 h-4 text-warning" />
              </div>
              <span className="text-xs text-text-secondary font-medium">CA articles</span>
            </div>
            <p className="text-2xl font-bold text-warning">{kpi(kpis.caArticles, '€')}</p>
          </Card>
          <Card className="!p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-[8px] bg-success/10 flex items-center justify-center">
                <CreditCard className="w-4 h-4 text-success" />
              </div>
              <span className="text-xs text-text-secondary font-medium">Paiements ext.</span>
            </div>
            <p className="text-2xl font-bold text-success">{kpi(kpis.paiementsExternes, '€')}</p>
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

        {/* Revenue chart */}
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-text">Évolution du CA</h3>
          </div>
          {revenueByDay.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={revenueByDay}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip
                  formatter={(v) => `${v.toFixed(2)}€`}
                  contentStyle={{ borderRadius: 12, fontSize: 12 }}
                />
                <Line type="monotone" dataKey="reel" name="CA réel" stroke="#0B2778" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="bonus" name="Bonus" stroke="#D4E620" strokeWidth={2} dot={false} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-text-tertiary text-center py-8">Aucune donnée sur cette période</p>
          )}
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Répartition transactions */}
          <Card>
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="w-4 h-4 text-primary" />
              <h3 className="font-semibold text-text">Répartition</h3>
            </div>
            {txBreakdown.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={txBreakdown}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={90}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {txBreakdown.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => `${v.toFixed(2)}€`} contentStyle={{ borderRadius: 12, fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-text-tertiary text-center py-8">Aucune donnée</p>
            )}
          </Card>

          {/* Occupation terrains */}
          <Card>
            <div className="flex items-center gap-2 mb-4">
              <CalendarDays className="w-4 h-4 text-primary" />
              <h3 className="font-semibold text-text">Occupation terrains</h3>
            </div>
            {courtOccupancy.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={courtOccupancy}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} />
                  <Bar dataKey="reservations" name="Réservations" fill="#0B2778" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-text-tertiary text-center py-8">Aucune donnée</p>
            )}
          </Card>
        </div>

      </div>
    </PageWrapper>
  )
}
