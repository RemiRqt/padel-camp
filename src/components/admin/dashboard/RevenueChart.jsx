import Card from '@/components/ui/Card'
import { TrendingUp } from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Legend
} from 'recharts'

export default function RevenueChart({ data }) {
  return (
    <Card>
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="w-4 h-4 text-primary" />
        <h3 className="font-semibold text-text">Évolution du CA</h3>
      </div>
      {data.length > 0 ? (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
            {/* Axe gauche : valeurs journalières (Sessions / Articles) */}
            <YAxis yAxisId="daily" tick={{ fontSize: 10 }} />
            {/* Axe droite : cumul mensuel (échelle plus grande) */}
            <YAxis yAxisId="cumul" orientation="right" tick={{ fontSize: 10 }} />
            <Tooltip
              formatter={(v) => `${Number(v).toFixed(2)}€`}
              contentStyle={{ borderRadius: 12, fontSize: 12 }}
            />
            <Line
              yAxisId="daily"
              type="monotone"
              dataKey="sessions"
              name="Sessions / jour"
              stroke="#0B2778"
              strokeWidth={2}
              dot={false}
            />
            <Line
              yAxisId="daily"
              type="monotone"
              dataKey="articles"
              name="Articles / jour"
              stroke="#FF9500"
              strokeWidth={2}
              dot={false}
            />
            <Line
              yAxisId="cumul"
              type="monotone"
              dataKey="total_cumule"
              name="Cumul total"
              stroke="#34C759"
              strokeWidth={2.5}
              strokeDasharray="4 4"
              dot={false}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <p className="text-sm text-text-tertiary text-center py-8">Aucune donnée sur cette période</p>
      )}
    </Card>
  )
}
