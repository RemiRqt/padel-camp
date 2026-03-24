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
  CalendarDays, Search, Filter, Trash2, Eye, MapPin, Clock
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

export default function AdminBookings() {
  const sevenAgo = toDateString(new Date(Date.now() - 7 * 86400000))
  const today = toDateString(new Date())

  const [from, setFrom] = useState(sevenAgo)
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
      .select('*')
      .gte('date', from)
      .lte('date', to)
      .order('date', { ascending: false })
      .order('start_time', { ascending: false })

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

  const openDetail = async (b) => {
    setSelected(b)
    try {
      const { data, error } = await supabase
        .from('booking_players')
        .select('*')
        .eq('booking_id', b.id)
      if (error) throw error
      setPlayers(data || [])
    } catch (err) {
      toast.error('Erreur chargement joueurs')
      setPlayers([])
    }
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
            {bookings.map((b) => (
              <Card key={b.id} className="!p-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-[10px] bg-primary/10 flex flex-col items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-primary leading-none">{dayNum(b.date + 'T00:00')}</span>
                    <span className="text-[9px] text-primary/70 uppercase">{monthTiny(b.date + 'T00:00')}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-text truncate">{b.user_name}</p>
                    <p className="text-xs text-text-secondary">
                      {courtLabel(b.court_id)} · {formatTime(b.start_time)} – {formatTime(b.end_time)}
                    </p>
                  </div>
                  <div className="text-right shrink-0 mr-1">
                    <p className="text-sm font-bold text-primary">{parseFloat(b.price).toFixed(0)}€</p>
                    <Badge color={b.status === 'confirmed' ? 'success' : 'danger'}>
                      {b.status === 'confirmed' ? 'OK' : 'Annulée'}
                    </Badge>
                  </div>
                  <button
                    onClick={() => openDetail(b)}
                    className="p-2 rounded-[10px] hover:bg-bg transition-colors cursor-pointer"
                  >
                    <Eye className="w-4 h-4 text-text-secondary" />
                  </button>
                </div>
              </Card>
            ))}
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
                <span className="text-sm text-text-secondary">Prix</span>
                <span className="text-sm font-bold text-primary">{parseFloat(selected.price).toFixed(2)}€</span>
              </div>
            </div>

            {/* Players */}
            {players.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-text-secondary uppercase mb-2">Joueurs ({players.length})</p>
                <div className="space-y-1.5">
                  {players.map((p) => (
                    <div key={p.id} className="flex items-center justify-between py-2 px-3 rounded-[10px] bg-bg">
                      <div>
                        <p className="text-sm font-medium">{p.player_name}</p>
                        <p className="text-xs text-text-tertiary capitalize">{p.payment_method} · {p.user_id ? 'Membre' : 'Externe'}</p>
                      </div>
                      <span className="text-sm font-semibold text-primary">{parseFloat(p.amount).toFixed(2)}€</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

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
