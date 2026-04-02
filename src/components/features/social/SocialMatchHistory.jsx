import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import { Trophy } from 'lucide-react'

export default function SocialMatchHistory({ matches, userId }) {
  return (
    <Card>
      <div className="flex items-center gap-2 mb-3">
        <Trophy className="w-4 h-4 text-primary" />
        <h3 className="font-semibold text-text">Derniers matchs</h3>
      </div>
      {matches.length > 0 ? (
        <div className="space-y-2">
          {matches.map((m) => {
            const inTeam1 = m.player1_id === userId || m.player2_id === userId
            const won = (inTeam1 && m.winner === 'team1') || (!inTeam1 && m.winner === 'team2')
            return (
              <div key={m.id} className={`p-3 rounded-[12px] ${won ? 'bg-green-50' : 'bg-red-50'}`}>
                <div className="flex items-center justify-between gap-2">
                  {/* Team 1 */}
                  <div className="flex-1 min-w-0 text-xs">
                    <p className="font-medium text-text truncate">{m.p1?.display_name}</p>
                    {m.p2?.display_name && <p className="text-text-secondary truncate">{m.p2.display_name}</p>}
                  </div>
                  {/* Scores */}
                  <div className="flex items-center gap-1.5">
                    {m.score_team1?.split(' ').map((s, i) => (
                      <span key={i} className="text-xs font-bold text-text bg-white/60 px-1.5 py-0.5 rounded-md">
                        {s.replace('/', '-')}
                      </span>
                    ))}
                  </div>
                  {/* Team 2 */}
                  <div className="flex-1 min-w-0 text-xs text-right">
                    <p className="font-medium text-text truncate">{m.o1?.display_name}</p>
                    {m.o2?.display_name && <p className="text-text-secondary truncate">{m.o2.display_name}</p>}
                  </div>
                </div>
                <div className="flex items-center justify-between mt-1.5">
                  <Badge color={won ? 'success' : 'danger'}>{won ? 'Victoire' : 'Défaite'}</Badge>
                  <span className="text-[10px] text-text-tertiary">
                    {new Date(m.date_played).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <p className="text-sm text-text-tertiary text-center py-4">Aucun match enregistré</p>
      )}
    </Card>
  )
}
