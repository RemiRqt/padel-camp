import { Link } from 'react-router-dom'
import { Home, ArrowLeft } from 'lucide-react'
import Button from '@/components/ui/Button'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-6">
      <div className="text-center max-w-sm">
        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
          <span className="text-3xl font-bold text-primary">404</span>
        </div>
        <h1 className="text-xl font-bold text-text mb-2">Page introuvable</h1>
        <p className="text-sm text-text-secondary mb-8">
          Cette page n'existe pas ou a été déplacée.
        </p>
        <div className="flex flex-col gap-2">
          <Link to="/">
            <Button className="w-full"><Home className="w-4 h-4 mr-2" />Retour à l'accueil</Button>
          </Link>
          <button onClick={() => window.history.back()} className="text-sm text-text-secondary hover:text-primary transition-colors cursor-pointer">
            <ArrowLeft className="w-3.5 h-3.5 inline mr-1" />Page précédente
          </button>
        </div>
      </div>
    </div>
  )
}
