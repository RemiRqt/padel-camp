import { Link } from 'react-router-dom'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { AlertTriangle, Check } from 'lucide-react'

export default function DashboardConfirmations({ confirmations }) {
  if (!confirmations.length) return null

  return (
    <Card className="!border-l-4 !border-l-danger">
      <div className="flex items-center gap-2 mb-2">
        <AlertTriangle className="w-4 h-4 text-danger" />
        <h3 className="font-semibold text-text text-sm">Confirmation requise</h3>
      </div>
      <div className="space-y-2">
        {confirmations.map((reg) => (
          <div key={reg.id} className="flex items-center justify-between gap-3 p-3 rounded-[12px] bg-danger/5">
            <div className="min-w-0">
              <p className="text-sm font-medium text-text truncate">{reg.tournament.name}</p>
              <p className="text-xs text-text-secondary">
                {new Date(reg.tournament.date + 'T00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                {' · '}{reg.tournament.level}
              </p>
            </div>
            <Link to="/my-tournaments">
              <Button size="sm"><Check className="w-3.5 h-3.5 mr-1" />Confirmer</Button>
            </Link>
          </div>
        ))}
      </div>
    </Card>
  )
}
