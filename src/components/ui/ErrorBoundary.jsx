import { Component } from 'react'
import { RefreshCw, AlertTriangle } from 'lucide-react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-bg flex items-center justify-center px-6">
          <div className="text-center max-w-sm">
            <div className="w-14 h-14 rounded-full bg-danger/10 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-6 h-6 text-danger" />
            </div>
            <h1 className="text-lg font-bold text-text mb-2">Quelque chose s'est mal passé</h1>
            <p className="text-sm text-text-secondary mb-6">
              Une erreur inattendue est survenue. Rechargez la page pour continuer.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-[14px] bg-primary text-white text-sm font-medium hover:opacity-90 transition-opacity cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              Recharger la page
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
