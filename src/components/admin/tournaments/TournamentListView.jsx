import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import { Pencil, Trash2, ChevronRight } from 'lucide-react'

const STATUS_COLORS = { draft: 'gray', open: 'success', full: 'warning', closed: 'primary', cancelled: 'danger', completed: 'lime' }
const STATUS_LABELS = { draft: 'Brouillon', open: 'Ouvert', full: 'Complet', closed: 'Ferm\u00e9', cancelled: 'Annul\u00e9', completed: 'Termin\u00e9' }

export default function TournamentListView({ tournaments, regCounts, onOpenDetail, onEdit, onDelete }) {
  return (
    <>
      {/* Desktop table */}
      <div className="hidden sm:block">
        <Card className="!p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-separator bg-bg/50">
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-text-tertiary uppercase">Date</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-text-tertiary uppercase">Nom</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-text-tertiary uppercase">Niveau</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-text-tertiary uppercase">Inscrits</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-text-tertiary uppercase">JA</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-text-tertiary uppercase">Statut</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {tournaments.map((t) => {
                const count = regCounts[t.id] || 0
                return (
                  <tr
                    key={t.id}
                    onClick={() => onOpenDetail(t)}
                    className="border-b border-separator last:border-0 hover:bg-primary/[0.02] cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 whitespace-nowrap text-text-secondary">
                      {new Date(t.date + 'T00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: '2-digit' })}
                    </td>
                    <td className="px-4 py-3 font-medium text-text">{t.name}</td>
                    <td className="px-4 py-3"><Badge color="primary">{t.level}</Badge></td>
                    <td className="px-4 py-3">
                      <span className={`font-semibold ${count >= t.max_teams ? 'text-warning' : 'text-text'}`}>{count}/{t.max_teams}</span>
                    </td>
                    <td className="px-4 py-3 text-text-secondary">{t.judge_arbiter || '\u2014'}</td>
                    <td className="px-4 py-3"><Badge color={STATUS_COLORS[t.status]}>{STATUS_LABELS[t.status]}</Badge></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={(e) => onEdit(e, t)} className="p-1.5 rounded-lg hover:bg-bg cursor-pointer">
                          <Pencil className="w-3.5 h-3.5 text-text-tertiary" />
                        </button>
                        <button onClick={(e) => onDelete(e, t)} className="p-1.5 rounded-lg hover:bg-danger/10 cursor-pointer">
                          <Trash2 className="w-3.5 h-3.5 text-danger" />
                        </button>
                        <ChevronRight className="w-4 h-4 text-text-tertiary" />
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Card>
      </div>

      {/* Mobile list */}
      <div className="sm:hidden space-y-2">
        {tournaments.map((t) => {
          const count = regCounts[t.id] || 0
          return (
            <Card key={t.id} className="!p-3 cursor-pointer" onClick={() => onOpenDetail(t)}>
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-[10px] bg-primary/10 flex flex-col items-center justify-center shrink-0">
                  <span className="text-xs font-bold text-primary leading-none">
                    {new Date(t.date + 'T00:00').getDate()}
                  </span>
                  <span className="text-[9px] text-primary/70 uppercase">
                    {new Date(t.date + 'T00:00').toLocaleDateString('fr-FR', { month: 'short' })}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-text truncate">{t.name}</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <Badge color="primary">{t.level}</Badge>
                    <span className="text-xs text-text-secondary font-medium">{count}/{t.max_teams}</span>
                    {t.judge_arbiter && (
                      <span className="text-xs text-text-tertiary">{'\u00b7'} {t.judge_arbiter}</span>
                    )}
                  </div>
                </div>
                <Badge color={STATUS_COLORS[t.status]}>{STATUS_LABELS[t.status]}</Badge>
                <ChevronRight className="w-4 h-4 text-text-tertiary shrink-0" />
              </div>
            </Card>
          )
        })}
      </div>
    </>
  )
}
