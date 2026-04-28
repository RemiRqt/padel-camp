import Card from '@/components/ui/Card'
import { TrendingUp } from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Legend
} from 'recharts'

export default function RevenueChart({ data }) {
  const totalSessions = data.reduce((s, d) => s + (d.sessions || 0), 0)
  const totalArticles = data.reduce((s, d) => s + (d.articles || 0), 0)
  const total = totalSessions + totalArticles

  return (
    <Card>
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-text">Évolution du CA</h3>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-primary" />
            <span className="text-text-secondary">Sessions</span>
            <span className="font-semibold text-text">{totalSessions.toFixed(0)}€</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-warning" />
            <span className="text-text-secondary">Articles</span>
            <span className="font-semibold text-text">{totalArticles.toFixed(0)}€</span>
          </div>
          <div className="flex items-center gap-1.5 pl-3 border-l border-separator">
            <span className="text-text-secondary">Total</span>
            <span className="font-bold text-primary">{total.toFixed(0)}€</span>
          </div>
        </div>
      </div>
      {data.length > 0 ? (
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="gradSessions" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0B2778" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#0B2778" stopOpacity={0.05} />
              </linearGradient>
              <linearGradient id="gradArticles" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#FF9500" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#FF9500" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10 }}
              interval="preserveStartEnd"
              minTickGap={20}
            />
            <YAxis tick={{ fontSize: 10 }} unit="€" />
            <Tooltip
              formatter={(v) => `${Number(v).toFixed(2)}€`}
              labelStyle={{ fontWeight: 600 }}
              contentStyle={{ borderRadius: 12, fontSize: 12, border: '1px solid #E5E5EA' }}
            />
            <Area
              type="monotone"
              dataKey="sessions"
              name="Sessions"
              stroke="#0B2778"
              strokeWidth={2}
              fill="url(#gradSessions)"
              stackId="1"
            />
            <Area
              type="monotone"
              dataKey="articles"
              name="Articles"
              stroke="#FF9500"
              strokeWidth={2}
              fill="url(#gradArticles)"
              stackId="1"
            />
            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
          </AreaChart>
        </ResponsiveContainer>
      ) : (
        <p className="text-sm text-text-tertiary text-center py-8">Aucune donnée sur cette période</p>
      )}
    </Card>
  )
}
