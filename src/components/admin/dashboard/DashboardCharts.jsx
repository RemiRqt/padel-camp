import Card from '@/components/ui/Card'
import { BarChart3, CalendarDays } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts'

export default function DashboardCharts({ txBreakdown, courtOccupancy, COLORS }) {
  return (
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
  )
}
