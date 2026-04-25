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
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="label" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip
              formatter={(v) => `${v.toFixed(2)}€`}
              contentStyle={{ borderRadius: 12, fontSize: 12 }}
            />
            <Line type="monotone" dataKey="reel" name="CA réel" stroke="#0B2778" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="bonus" name="Bonus" stroke="#D4E620" strokeWidth={2} dot={false} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <p className="text-sm text-text-tertiary text-center py-8">Aucune donnée sur cette période</p>
      )}
    </Card>
  )
}
