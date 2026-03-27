import { AlertTriangle } from 'lucide-react'
import Button from './Button'

export default function ConfirmModal({ isOpen, onClose, onConfirm, title, message, confirmLabel = 'Confirmer', variant = 'danger', loading = false }) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full sm:max-w-sm bg-white rounded-t-[20px] sm:rounded-[20px] p-6 space-y-4 animate-slide-up">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${variant === 'danger' ? 'bg-danger/10' : 'bg-warning/10'}`}>
            <AlertTriangle className={`w-5 h-5 ${variant === 'danger' ? 'text-danger' : 'text-warning'}`} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-text">{title}</h3>
            {message && <p className="text-xs text-text-secondary mt-0.5">{message}</p>}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" className="flex-1" onClick={onClose} disabled={loading}>
            Annuler
          </Button>
          <Button variant={variant} className="flex-1" onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
