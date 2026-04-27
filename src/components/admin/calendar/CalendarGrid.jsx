import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import { Trophy, Star, Users, Trash2 } from 'lucide-react'

const STATUS_COLORS = { draft: 'gray', open: 'success', full: 'warning', closed: 'primary', cancelled: 'danger', completed: 'lime' }
const STATUS_LABELS = { draft: 'Brouillon', open: 'Ouvert', full: 'Complet', closed: 'Fermé', cancelled: 'Annulé', completed: 'Terminé' }
const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

export default function CalendarGrid({
  monthCells, viewYear, viewMonth, todayStr,
  tournaments, events, regCounts,
  onEditTournament, onDeleteTournament, onViewRegistrations,
  onEditEvent, onDeleteEvent,
}) {
  const getItemsForDay = (day) => {
    if (!day) return { t: [], e: [] }
    const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return {
      t: tournaments.filter((x) => x.date === dateStr),
      e: events.filter((x) => x.date === dateStr),
    }
  }

  return (
    <Card className="!p-0 overflow-hidden">
      <div className="grid grid-cols-7 border-b border-separator bg-bg/50">
        {DAYS.map((d) => (
          <div key={d} className="p-2 text-center text-xs font-semibold text-text-secondary uppercase">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {monthCells.map((day, idx) => {
          const items = getItemsForDay(day)
          const dateStr = day ? `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}` : ''
          const isTodayCell = dateStr === todayStr
          return (
            <div
              key={idx}
              className={`min-h-[80px] lg:min-h-[100px] border-b border-r border-separator p-1.5 ${
                !day ? 'bg-bg/30' : isTodayCell ? 'bg-primary/5' : ''
              }`}
            >
              {day && (
                <>
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-xs font-medium ${isTodayCell ? 'text-primary font-bold' : 'text-text-secondary'}`}>{day}</span>
                  </div>
                  <div className="space-y-0.5">
                    {items.t.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => onEditTournament(t)}
                        className="w-full text-left px-1.5 py-1 rounded-md bg-primary/10 hover:bg-primary/20 transition-colors cursor-pointer truncate"
                      >
                        <div className="flex items-center gap-1">
                          <Trophy className="w-3 h-3 text-primary shrink-0" />
                          <span className="text-[10px] font-medium text-primary truncate">{t.name}</span>
                        </div>
                        <div className="flex items-center gap-1 mt-0.5">
                          <Badge color={STATUS_COLORS[t.status]} className="!text-[8px] !px-1 !py-0">{STATUS_LABELS[t.status]}</Badge>
                          <span className="text-[9px] text-text-tertiary">{regCounts[t.id] || 0}/{t.max_teams}</span>
                          <button
                            onClick={(ev) => { ev.stopPropagation(); onViewRegistrations(t) }}
                            className="ml-auto p-0.5 hover:bg-primary/10 rounded cursor-pointer"
                          >
                            <Users className="w-3 h-3 text-text-secondary" />
                          </button>
                          <button
                            onClick={(ev) => { ev.stopPropagation(); onDeleteTournament(t) }}
                            className="p-0.5 hover:bg-danger/10 rounded cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3 text-danger" />
                          </button>
                        </div>
                      </button>
                    ))}
                    {items.e.map((e) => (
                      <button
                        key={e.id}
                        onClick={() => onEditEvent(e)}
                        className="w-full text-left px-1.5 py-1 rounded-md bg-lime/20 hover:bg-lime/30 transition-colors cursor-pointer truncate"
                      >
                        <div className="flex items-center gap-1">
                          <Star className="w-3 h-3 text-lime-dark shrink-0" />
                          <span className="text-[10px] font-medium text-text truncate">{e.name}</span>
                          <button
                            onClick={(ev) => { ev.stopPropagation(); onDeleteEvent(e) }}
                            className="ml-auto p-0.5 hover:bg-danger/10 rounded cursor-pointer shrink-0"
                          >
                            <Trash2 className="w-3 h-3 text-danger" />
                          </button>
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )
        })}
      </div>
    </Card>
  )
}
