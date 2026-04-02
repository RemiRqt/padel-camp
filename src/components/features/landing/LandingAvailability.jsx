import { Link } from 'react-router-dom'
import Card from '@/components/ui/Card'
import { formatTime } from '@/utils/formatDate'
import { getSlotPrice } from '@/utils/calculatePrice'
import { CalendarDays } from 'lucide-react'

const COURTS = ['terrain_1', 'terrain_2', 'terrain_3']

export default function LandingAvailability({ slots, bookedSet, pricingRules, loading, user }) {
  return (
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
  )
}
