import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { formatDateFull, formatTime, monthTiny, dayNum } from '@/utils/formatDate'
import PageWrapper from '@/components/layout/PageWrapper'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import { Calendar, Clock, MapPin } from 'lucide-react'

export default function Events() {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const { data, error } = await supabase
          .from('events')
          .select('*')
          .eq('is_public', true)
          .order('date')
        if (error) throw error
        setEvents(data || [])
      } catch (err) {
        console.error('[Events] fetch error:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const today = new Date().toISOString().split('T')[0]
  const upcoming = events.filter((e) => e.date >= today)
  const past = events.filter((e) => e.date < today)

  return (
    <PageWrapper>
      <div className="space-y-5">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-primary" />
          <h1 className="text-2xl font-bold text-text">Événements</h1>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <div key={i} className="h-28 rounded-[16px] bg-white animate-pulse" />)}
          </div>
        ) : events.length === 0 ? (
          <Card className="text-center !py-10">
            <Calendar className="w-10 h-10 text-text-tertiary mx-auto mb-3" />
            <p className="text-sm text-text-tertiary">Aucun événement à venir</p>
          </Card>
        ) : (
          <>
            {upcoming.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
                  À venir ({upcoming.length})
                </p>
                {upcoming.map((evt) => {
                  return (
                    <Card key={evt.id} className="!p-0 overflow-hidden">
                      <div className="flex">
                        <div className="w-[72px] bg-lime/15 flex flex-col items-center justify-center shrink-0 py-4">
                          <span className="text-2xl font-bold text-primary leading-none">{dayNum(evt.date + 'T00:00')}</span>
                          <span className="text-xs text-primary/70 uppercase mt-0.5">{monthTiny(evt.date + 'T00:00')}</span>
                        </div>
                        <div className="flex-1 p-4 min-w-0">
                          <h3 className="text-sm font-bold text-text">{evt.name}</h3>
                          {evt.description && (
                            <p className="text-xs text-text-secondary mt-1 line-clamp-2">{evt.description}</p>
                          )}
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2.5 text-xs text-text-secondary">
                            {(evt.start_time || evt.end_time) && (
                              <span className="flex items-center gap-1">
                                <Clock className="w-3.5 h-3.5" />
                                {evt.start_time && formatTime(evt.start_time)}
                                {evt.end_time && ` – ${formatTime(evt.end_time)}`}
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3.5 h-3.5" />
                              Padel Camp Achères
                            </span>
                          </div>
                        </div>
                      </div>
                    </Card>
                  )
                })}
              </div>
            )}

            {past.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
                  Passés ({past.length})
                </p>
                {past.map((evt) => {
                  return (
                    <Card key={evt.id} className="opacity-60">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-[10px] bg-bg flex flex-col items-center justify-center shrink-0">
                          <span className="text-xs font-bold text-text-secondary leading-none">{dayNum(evt.date + 'T00:00')}</span>
                          <span className="text-[9px] text-text-tertiary uppercase">{monthTiny(evt.date + 'T00:00')}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-text truncate">{evt.name}</p>
                          {evt.description && <p className="text-xs text-text-tertiary truncate">{evt.description}</p>}
                        </div>
                      </div>
                    </Card>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>
    </PageWrapper>
  )
}
