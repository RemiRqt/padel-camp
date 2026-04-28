import { useEffect } from 'react'
import { X } from 'lucide-react'

const SIZES = {
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-md',
  lg: 'sm:max-w-lg md:max-w-xl',
  xl: 'sm:max-w-xl md:max-w-2xl lg:max-w-3xl',
  '2xl': 'sm:max-w-2xl md:max-w-3xl lg:max-w-4xl',
}

export default function Modal({ isOpen, onClose, title, children, className = '', size = 'md' }) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const onKey = (e) => { if (e.key === 'Escape') onClose?.() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const sizeClass = SIZES[size] || SIZES.md

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        className={`
          relative bg-white rounded-t-[20px] sm:rounded-[20px] w-full ${sizeClass}
          max-h-[88dvh] sm:max-h-[90dvh] flex flex-col
          shadow-[0_4px_24px_rgba(11,39,120,0.18)]
          animate-[slideUp_0.3s_ease-out]
          ${className}
        `}
      >
        <div className="flex items-center justify-between px-5 sm:px-6 pt-5 sm:pt-6 pb-3 shrink-0">
          <h2 className="text-base sm:text-lg font-semibold text-text">{title}</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-bg transition-colors cursor-pointer shrink-0 -mr-1"
            aria-label="Fermer"
          >
            <X className="w-5 h-5 text-text-secondary" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 sm:px-6 pb-5 sm:pb-6 flex-1">
          {children}
        </div>
      </div>
    </div>
  )
}
