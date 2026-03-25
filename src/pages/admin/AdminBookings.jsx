import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import PageWrapper from '@/components/layout/PageWrapper'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import DateRangePicker from '@/components/ui/DateRangePicker'
import ExportButtons from '@/components/ui/ExportButtons'
import { exportExcel, exportPDF } from '@/utils/export'
import { formatTime, toDateString, monthTiny, dayNum } from '@/utils/formatDate'
import { cancelBooking } from '@/services/bookingService'
import toast from 'react-hot-toast'
import {
  CalendarDays, Search, Filter, Trash2, MapPin, Clock, Users, Euro
} from 'lucide-react'

const COURTS = [
  { value: 'all', label: 'Tous les terrains' },
  { value: 'terrain_1', label: 'Terrain 1' },
  { value: 'terrain_2', label: 'Terrain 2' },
  { value: 'terrain_3', label: 'Terrain 3' },
]
const STATUSES = [
  { value: 'all', label: 'Tous' },
  { value: 'confirmed', label: 'Confirmées' },
  { value: 'cancelled', label: 'Annulées' },
]

const PAY_BADGE = {
  paid: { color: 'success', label: 'Payé' },
  external: { color: 'primary', label: 'CB/Espèces' },
  pending: { color: 'warning', label: 'En attente' },
}

export default function AdminBookings() {
  const today = toDateString(new Date())

  const [from, setFrom] = useState(today)
  const [to, setTo] = useState(today)
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [courtFilter, setCourtFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [detailOpen, setDetailOpen] = useState(false)
  const [selected, setSelected] = useState(null)
  const [players, setPlayers] = useState([])
  const [cancelling, setCancelling] = useState(false)

  const fetchBookings = async () => {
    setLoading(true)
    let q = supabase
      .from('bookings')
      .select('*, booking_players(*)')
      .gte('date', from)
      .lte('date', to)
      .order('date', { ascending: true })
      .order('start_time', { ascending: true })

    if (courtFilter !== 'all') q = q.eq('court_id', courtFilter)
    if (statusFilter !== 'all') q = q.eq('status', statusFilter)

    const { data } = await q
    let results = data || []
    if (search) {
      const lq = search.toLowerCase()
      results = results.filter((b) => b.user_name?.toLowerCase().includes(lq))
    }
    setBookings(results)
    setLoading(false)
  }

  useEffect(() => { fetchBookings() }, [from, to, courtFilter, statusFilter])
  useEffect(() => {
    if (!search) { fetchBookings(); return }
    const t = setTimeout(fetchBookings, 300)
    return () => clearTimeout(t)
  }, [search])

  const openDetail = (b) => {
    setSelected(b)
    setPlayers(b.booking_players || [])
    setDetailOpen(true)
  }

  const handleAdminCancel = async () => {
    if (!selected) return
    setCancelling(true)
    try {
      await cancelBooking(selected.id, 'admin')
      toast.success('Réservation annulée')
      setDetailOpen(false)
      fetchBookings()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setCancelling(false)
    }
  }

  const courtLabel = (id) => `Terrain ${id?.replace('terrain_', '') || '?'}`

  const getPlayerStats = (bp) => {
    if (!bp || bp.length === 0) return { filled: 0, paid: 0, total: 4 }
    const filled = bp.filter((p) => p.player_name !== 'Place disponible').length
    const paid = bp.filter((p) => p.payment_status === 'paid' || p.payment_status === 'external').length
    return { filled, paid, total: bp.length }
  }

  const exportCols = [
    { key: 'date', label: 'Date' },
    { key: 'court', label: 'Terrain' },
    { key: 'time', label: 'Horaire' },
    { key: 'user_name', label: 'Membre' },
    { key: 'price', label: 'Prix' },
    { key: 'status', label: 'Statut' },
  ]
  const exportRows = bookings.map((b) => ({
    date: new Date(b.date + 'T00:00').toLocaleDateString('fr-FR'),
    court: courtLabel(b.court_id),
    time: `${formatTime(b.start_time)} – ${formatTime(b.end_time)}`,
    user_name: b.user_name,
    price: parseFloat(b.price).toFixed(2) + '€',
    status: b.status === 'confirmed' ? 'Confirmée' : 'Annulée',
  }))

  return (
    <PageWrapper>
      <div className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-primary" />
            <h1 className="text-2xl font-bold text-text">Réservations</h1>
            <Badge color="primary">{bookings.length}</Badge>
          </div>
          <div className="flex items-center gap-2">
            <DateRangePicker from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t) }} />
            <ExportButtons
              onExcel={() => exportExcel(exportRows, exportCols, `reservations_${from}_${to}`)}
              onPDF={() => exportPDF(exportRows, exportCols, `reservations_${from}_${to}`, 'Padel Camp — Réservations')}
            />
          </div>
        </div>

        <Card className="!p-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
              <input
                type="text"
                placeholder="Rechercher par nom..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-[10px] bg-bg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <select
              aria-label="Filtrer par terrain"
              value={courtFilter}
              onChange={(e) => setCourtFilter(e.target.value)}
              className="px-3 py-2.5 rounded-[10px] bg-bg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              {COURTS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
            <select
              aria-label="Filtrer par statut"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2.5 rounded-[10px] bg-bg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
        </Card>

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => <div key={i} className="h-20 rounded-[16px] bg-white animate-pulse" />)}
          </div>
        ) : bookings.length === 0 ? (
          <Card className="text-center !py-8">
            <CalendarDays className="w-8 h-8 text-text-tertiary mx-auto mb-2" />
            <p className="text-sm text-text-tertiary">Aucune réservation trouvée</p>
          </Card>
        ) : (
          <div className="space-y-2">
            {bookings.map((b) => {
              const stats = getPlayerStats(b.booking_players)
              const isCancelled = b.status === 'cancelled'
              return (
                <Card
                  key={b.id}
                  className={`!p-4 cursor-pointer hover:shadow-[0_4px_12px_rgba(11,39,120,0.15)] transition-shadow ${isCancelled ? 'opacity-50' : ''}`}
                  onClick={() => openDetail(b)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-lg font-bold text-primary">
                        {b.user_name?.charAt(0)?.toUpperCase() || '?'}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-text truncate">{b.user_name}</p>
                        {isCancelled && <Badge color="danger">Annulée</Badge>}
                      </div>
                      <p className="text-xs text-text-secondary">
                        {courtLabel(b.court_id)} · {formatTime(b.start_time)} – {formatTime(b.end_time)}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-primary">{parseFloat(b.price).toFixed(0)}€</p>
                      <p className={`text-[11px] font-medium ${stats.paid === stats.total ? 'text-success' : stats.paid > 0 ? 'text-warning' : 'text-text-tertiary'}`}>
                        {stats.paid}/{stats.total} payés
                      </p>
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      {/* Detail modal */}
      <Modal
        isOpen={detailOpen}
        onClose={() => setDetailOpen(false)}
        title="Détail réservation"
      >
        {selected && (
          <div className="space-y-4">
            <div className="rounded-[14px] bg-bg p-4 space-y-2.5">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">{courtLabel(selected.court_id)}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" />
                <span className="text-sm">
                  {new Date(selected.date + 'T00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                  {' · '}{formatTime(selected.start_time)} – {formatTime(selected.end_time)}
                </span>
              </div>
              <div className="flex justify-between pt-1 border-t border-separator">
                <span className="text-sm text-text-secondary">Réservé par</span>
                <span className="text-sm font-semibold">{selected.user_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-text-secondary">Prix total</span>
                <span className="text-sm font-bold text-primary">{parseFloat(selected.price).toFixed(2)}€</span>
              </div>
            </div>

            {/* Players */}
            {players.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-text-secondary uppercase mb-2">
                  Joueurs ({players.filter((p) => p.player_name !== 'Place disponible').length}/4)
                </p>
                <div className="space-y-1.5">
                  {players.map((p) => {
                    const isEmpty = p.player_name === 'Place disponible'
                    const badge = PAY_BADGE[p.payment_status] || PAY_BADGE.pending
                    return (
                      <div key={p.id} className={`flex items-center justify-between py-2.5 px-3 rounded-[10px] ${isEmpty ? 'bg-bg/50 border border-dashed border-separator' : 'bg-bg'}`}>
                        {isEmpty ? (
                          <p className="text-sm text-text-tertiary">Place disponible</p>
                        ) : (
                          <>
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                <span className="text-xs font-bold text-primary">
                                  {p.player_name.charAt(0).toUpperCase()}
                                </span>
                              </div>
                              <div>
                                <p className="text-sm font-medium">{p.player_name}</p>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <Badge color={p.user_id ? 'primary' : 'gray'}>
                                    {p.user_id ? 'Membre' : 'Externe'}
                                  </Badge>
                                  <Badge color={badge.color}>{badge.label}</Badge>
                                </div>
                              </div>
                            </div>
                            <span className="text-sm font-semibold text-primary">{parseFloat(p.amount).toFixed(2)}€</span>
                          </>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Payment summary */}
            {players.length > 0 && (() => {
              const paidAmount = players.reduce((s, p) => s + (p.payment_status === 'paid' || p.payment_status === 'external' ? parseFloat(p.amount) : 0), 0)
              const totalAmount = parseFloat(selected.price)
              const remaining = totalAmount - paidAmount
              return (
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-[10px] bg-bg p-2.5">
                    <p className="text-[10px] text-text-tertiary uppercase">Total</p>
                    <p className="text-base font-bold text-primary">{totalAmount.toFixed(2)}€</p>
                  </div>
                  <div className="rounded-[10px] bg-success/10 p-2.5">
                    <p className="text-[10px] text-text-tertiary uppercase">Payé</p>
                    <p className="text-base font-bold text-success">{paidAmount.toFixed(2)}€</p>
                  </div>
                  <div className={`rounded-[10px] p-2.5 ${remaining > 0 ? 'bg-warning/10' : 'bg-success/10'}`}>
                    <p className="text-[10px] text-text-tertiary uppercase">Reste</p>
                    <p className={`text-base font-bold ${remaining > 0 ? 'text-warning' : 'text-success'}`}>{remaining.toFixed(2)}€</p>
                  </div>
                </div>
              )
            })()}

            {selected.status === 'confirmed' && (
              <Button variant="danger" className="w-full" loading={cancelling} onClick={handleAdminCancel}>
                <Trash2 className="w-4 h-4 mr-1" />
                Annuler (admin)
              </Button>
            )}
          </div>
        )}
      </Modal>
    </PageWrapper>
  )
}
