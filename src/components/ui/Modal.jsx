import { useEffect } from 'react'
import { X } from 'lucide-react'

export default function Modal({ isOpen, onClose, title, children, className = '' }) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        className={`
          relative bg-white rounded-t-[20px] sm:rounded-[20px] w-full sm:max-w-md
          max-h-[85vh] overflow-y-auto p-6
          shadow-[0_4px_12px_rgba(11,39,120,0.15)]
          animate-[slideUp_0.3s_ease-out]
          ${className}
        `}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-text">{title}</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-bg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5 text-text-secondary" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
