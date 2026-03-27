import { useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  MapPin, Phone, Clock, Instagram, Euro, Trophy, Calendar,
  ChevronRight, Star, Users, CalendarDays
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import { formatTime, monthTiny, dayNum } from '@/utils/formatDate'
import { generateSlots } from '@/utils/slots'
import { getSlotPrice } from '@/utils/calculatePrice'

const COURTS = ['terrain_1', 'terrain_2', 'terrain_3']

export default function Landing() {
  const { user } = useAuth()
  const [pricingRules, setPricingRules] = useState([])
  const [tournaments, setTournaments] = useState([])
  const [events, setEvents] = useState([])
  const [config, setConfig] = useState(null)
  const [todayBookings, setTodayBookings] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      try {
        const today = new Date().toISOString().split('T')[0]
        const [prRes, tRes, eRes, cfgRes, bRes] = await Promise.all([
          supabase.from('pricing_rules').select('*').eq('is_active', true).order('start_time'),
          supabase.from('tournaments').select('*').in('status', ['open', 'full']).gte('date', today).order('date').limit(3),
          supabase.from('events').select('*').eq('is_public', true).gte('date', today).order('date').limit(3),
          supabase.from('club_config').select('*').single(),
          supabase.from('bookings').select('court_id, start_time').eq('date', today).eq('status', 'confirmed'),
        ])
        if (prRes.data) setPricingRules(prRes.data)
        if (tRes.data) setTournaments(tRes.data)
        if (eRes.data) setEvents(eRes.data)
        if (cfgRes.data) setConfig(cfgRes.data)
        if (bRes.data) setTodayBookings(bRes.data)
      } catch (err) {
        console.error('[Landing] fetch error:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const slots = useMemo(() => generateSlots(config), [config])
  const bookedSet = useMemo(() => {
    const s = new Set()
    todayBookings.forEach((b) => s.add(`${b.court_id}_${b.start_time.slice(0, 5)}`))
    return s
  }, [todayBookings])

  const dayLabel = (days) => {
    if (days.length === 5 && days.every((d, i) => d === i)) return 'Lun – Ven'
    if (days.length === 2 && days.includes(5) && days.includes(6)) return 'Sam – Dim'
    return days.map((d) => ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'][d]).join(', ')
  }

  // Use config or fallback
  const clubName = config?.name || 'Padel Camp Achères'
  const clubAddress = config?.address || '10 Rue des Communes, 78260 Achères'
  const clubPhone = config?.phone || '01 34 01 58 48'
  const clubDesc = config?.description || 'Complexe de padel avec bar & shop'
  const clubInsta = config?.instagram_url || 'https://www.instagram.com/padel_campacheres/'
  const instaHandle = clubInsta.split('/').filter(Boolean).pop() || 'padel_campacheres'
  const openTime = config?.open_time ? formatTime(config.open_time) : '9h30'
  const closeTime = config?.close_time ? formatTime(config.close_time) : '23h'
  const courtsCount = config?.courts_count || 3

  return (
    <div className="min-h-screen bg-bg">
      {/* Hero */}
      <div className="bg-gradient-to-br from-primary to-primary-dark text-white px-4 pt-14 pb-20 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-lime/10 rounded-full -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/4" />
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <div className="w-20 h-20 rounded-[20px] bg-white/10 backdrop-blur-sm mx-auto mb-6 flex items-center justify-center border border-white/10 p-3">
            <img src="/favicon.svg" alt="Padel Camp" className="w-full h-full" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold mb-2">{clubName}</h1>
          <p className="text-white/60 mb-2 text-sm">{clubDesc}</p>
          <div className="flex items-center justify-center gap-2 text-white/50 text-xs mb-8">
            <Star className="w-3 h-3" />
            <span>{courtsCount} terrains intérieurs</span>
            <span>·</span>
            <span>Ouvert 7j/7</span>
          </div>
          <div className="flex gap-3 justify-center flex-wrap">
            <Link to={user ? '/booking' : '/login'}>
              <Button variant="lime" size="lg">Réserver</Button>
            </Link>
            {!user && (
              <Link to="/register">
                <Button variant="outline" size="lg" className="!border-white/20 !text-white hover:!bg-white/10">
                  Créer un compte
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 -mt-10 pb-12 space-y-5 relative z-10">

        {/* Infos club */}
        <Card elevated>
          <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-4">Informations</h2>
          <div className="space-y-3.5">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-[10px] bg-primary/5 flex items-center justify-center shrink-0">
                <MapPin className="w-4 h-4 text-primary" />
              </div>
              <p className="text-sm font-medium">{clubAddress}</p>
            </div>
            <div className="border-t border-separator" />
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-[10px] bg-primary/5 flex items-center justify-center shrink-0">
                <Phone className="w-4 h-4 text-primary" />
              </div>
              <a href={`tel:${clubPhone.replace(/\s/g, '')}`} className="text-sm font-medium hover:text-primary">{clubPhone}</a>
            </div>
            <div className="border-t border-separator" />
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-[10px] bg-primary/5 flex items-center justify-center shrink-0">
                <Clock className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">{openTime} – {closeTime}</p>
                <p className="text-xs text-text-secondary">Tous les jours</p>
              </div>
            </div>
            <div className="border-t border-separator" />
            <a href={clubInsta} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 group">
              <div className="w-9 h-9 rounded-[10px] bg-gradient-to-br from-purple-500/10 to-pink-500/10 flex items-center justify-center shrink-0">
                <Instagram className="w-4 h-4 text-purple-600" />
              </div>
              <p className="text-sm font-medium text-primary group-hover:underline">@{instaHandle}</p>
              <ChevronRight className="w-4 h-4 text-text-tertiary ml-auto" />
            </a>
          </div>
        </Card>

        {/* Terrains */}
        <Card>
          <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-4">Nos {courtsCount} terrains</h2>
          <div className="grid grid-cols-3 gap-3">
            {(config?.court_names || ['Terrain 1', 'Terrain 2', 'Terrain 3']).map((name, i) => (
              <div key={i} className="rounded-[14px] bg-gradient-to-br from-primary/5 to-primary/10 p-4 text-center">
                <div className="w-10 h-10 rounded-full bg-primary/10 mx-auto mb-2 flex items-center justify-center">
                  <span className="text-lg font-bold text-primary">{i + 1}</span>
                </div>
                <p className="text-xs font-medium text-text">{name}</p>
                <p className="text-[10px] text-text-tertiary">Intérieur</p>
              </div>
            ))}
          </div>
        </Card>

        {/* Tarifs */}
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <Euro className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">Tarifs</h2>
          </div>
          {pricingRules.length > 0 ? (
            <div className="space-y-2.5">
              {pricingRules.map((rule) => (
                <div key={rule.id} className="flex items-center justify-between py-2 px-3 rounded-[12px] bg-bg">
                  <div>
                    <p className="text-sm font-medium text-text">{rule.label}</p>
                    <p className="text-xs text-text-secondary">
                      {dayLabel(rule.days)} · {formatTime(rule.start_time)} – {formatTime(rule.end_time)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-primary">{parseFloat(rule.price_per_slot).toFixed(0)}€</p>
                    <p className="text-[10px] text-text-tertiary">/ {config?.slot_duration || 90}min</p>
                  </div>
                </div>
              ))}
            </div>
          ) : loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <div key={i} className="h-14 rounded-[12px] bg-bg animate-pulse" />)}
            </div>
          ) : (
            <p className="text-sm text-text-tertiary">Tarifs bientôt disponibles</p>
          )}
        </Card>

        {/* Disponibilités aujourd'hui */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">Disponibilités aujourd'hui</h2>
            </div>
            <Link to={user ? '/booking' : '/login'} className="text-xs text-primary font-medium hover:underline">Réserver</Link>
          </div>
          {slots.length > 0 ? (
            <div className="overflow-x-auto -mx-5 px-5">
              <table className="w-full min-w-[300px]">
                <thead>
                  <tr>
                    <th className="text-left text-[10px] font-semibold text-text-tertiary uppercase pb-2 w-16">Heure</th>
                    {['T1', 'T2', 'T3'].map((t) => (
                      <th key={t} className="text-center text-[10px] font-semibold text-text-tertiary uppercase pb-2">{t}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {slots.filter(() => {
                    return true // show all slots, past ones will be marked
                  }).filter((slot) => {
                    const now = new Date()
                    const [h, m] = slot.start.split(':').map(Number)
                    const t = new Date(); t.setHours(h, m, 0, 0)
                    return t > now
                  }).slice(0, 6).map((slot) => (
                    <tr key={slot.start} className="border-t border-separator">
                      <td className="py-1.5 text-xs font-medium text-text">{formatTime(slot.start)}</td>
                      {COURTS.map((court) => {
                        const occupied = bookedSet.has(`${court}_${slot.start}`)
                        return (
                          <td key={court} className="py-1.5 text-center">
                            <span className={`inline-block w-full max-w-[56px] py-1 rounded-md text-[10px] font-semibold ${
                              occupied ? 'bg-danger/10 text-danger/70' : 'bg-success/10 text-success'
                            }`}>
                              {occupied ? 'Occupé' : `${(getSlotPrice(pricingRules, new Date(), slot.start) ?? 0).toFixed(0)}€`}
                            </span>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex items-center justify-center gap-4 mt-3 text-[10px] text-text-tertiary">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-success/20" /> Disponible</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-danger/20" /> Occupé</span>
              </div>
            </div>
          ) : loading ? (
            <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-8 rounded bg-bg animate-pulse" />)}</div>
          ) : (
            <p className="text-sm text-text-tertiary text-center py-4">Horaires bientôt disponibles</p>
          )}
        </Card>

        {/* Prochains tournois */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">Prochains tournois</h2>
            </div>
            <Link to="/tournaments" className="text-xs text-primary font-medium hover:underline">Voir tout</Link>
          </div>
          {tournaments.length > 0 ? (
            <div className="space-y-3">
              {tournaments.map((t) => (
                <div key={t.id} className="flex items-center gap-3 p-3 rounded-[12px] bg-bg">
                  <div className="w-12 h-12 rounded-[10px] bg-primary/10 flex flex-col items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-primary leading-none">{dayNum(t.date)}</span>
                    <span className="text-[9px] text-primary/70 uppercase">{monthTiny(t.date)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text truncate">{t.name}</p>
                    <p className="text-xs text-text-secondary">{t.level} · {t.category} · {formatTime(t.start_time)}</p>
                  </div>
                  <Badge color={t.status === 'full' ? 'warning' : 'success'}>
                    {t.status === 'full' ? 'Complet' : 'Ouvert'}
                  </Badge>
                </div>
              ))}
            </div>
          ) : loading ? (
            <div className="space-y-2">{[1, 2].map((i) => <div key={i} className="h-16 rounded-[12px] bg-bg animate-pulse" />)}</div>
          ) : (
            <p className="text-sm text-text-tertiary">Aucun tournoi programmé</p>
          )}
        </Card>

        {/* Événements */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">Événements</h2>
            </div>
            <Link to="/events" className="text-xs text-primary font-medium hover:underline">Voir tout</Link>
          </div>
          {events.length > 0 ? (
            <div className="space-y-3">
              {events.map((evt) => (
                <div key={evt.id} className="flex items-center gap-3 p-3 rounded-[12px] bg-bg">
                  <div className="w-12 h-12 rounded-[10px] bg-lime/20 flex flex-col items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-primary leading-none">{dayNum(evt.date)}</span>
                    <span className="text-[9px] text-primary/70 uppercase">{monthTiny(evt.date)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text truncate">{evt.name}</p>
                    {evt.description && <p className="text-xs text-text-secondary truncate">{evt.description}</p>}
                  </div>
                </div>
              ))}
            </div>
          ) : loading ? (
            <div className="space-y-2">{[1, 2].map((i) => <div key={i} className="h-16 rounded-[12px] bg-bg animate-pulse" />)}</div>
          ) : (
            <p className="text-sm text-text-tertiary">Aucun événement à venir</p>
          )}
        </Card>

        {/* CTA */}
        {!user && (
          <Card className="!bg-primary text-white text-center !p-8">
            <Users className="w-8 h-8 text-lime mx-auto mb-3" />
            <h2 className="text-lg font-bold mb-2">Rejoignez le club</h2>
            <p className="text-sm text-white/60 mb-5">
              Créez votre compte pour réserver vos créneaux et participer aux tournois
            </p>
            <Link to="/register">
              <Button variant="lime" size="lg">Créer un compte gratuit</Button>
            </Link>
          </Card>
        )}
      </div>
    </div>
  )
}
