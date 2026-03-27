import { WifiOff, RefreshCw } from 'lucide-react'
import Button from './Button'

export default function ErrorState({ message = 'Une erreur est survenue', onRetry }) {
  return (
    <div className="text-center py-10">
      <div className="w-14 h-14 rounded-full bg-danger/10 flex items-center justify-center mx-auto mb-4">
        <WifiOff className="w-6 h-6 text-danger" />
      </div>
      <p className="text-sm font-medium text-text mb-1">{message}</p>
      <p className="text-xs text-text-tertiary mb-4">Vérifiez votre connexion et réessayez</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" />Réessayer
        </Button>
      )}
    </div>
  )
}
