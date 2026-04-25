import { useEffect, useState } from 'react'
import { Share, Plus, X, Download } from 'lucide-react'

const DISMISS_KEY = 'pwa-install-dismissed-until'
const DISMISS_DAYS = 7

function isStandalone() {
  // Already installed (Android/Desktop) or running as PWA on iOS
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  )
}

function isIOS() {
  if (typeof window === 'undefined') return false
  const ua = window.navigator.userAgent
  // iOS detection (also covers iPadOS which reports as Mac on iPad)
  return /iPad|iPhone|iPod/.test(ua) || (ua.includes('Mac') && 'ontouchend' in document)
}

function isDismissed() {
  try {
    const until = localStorage.getItem(DISMISS_KEY)
    if (!until) return false
    return Date.now() < parseInt(until, 10)
  } catch {
    return false
  }
}

function dismissFor(days) {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now() + days * 86400000))
  } catch { /* localStorage unavailable */ }
}

export default function InstallPWA() {
  const [show, setShow] = useState(false)
  const [variant, setVariant] = useState(null) // 'ios' | 'native'
  const [deferredPrompt, setDeferredPrompt] = useState(null)

  useEffect(() => {
    if (isStandalone() || isDismissed()) return

    // Android / Chrome / Edge — native install flow
    const handler = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setVariant('native')
      setShow(true)
    }
    window.addEventListener('beforeinstallprompt', handler)

    // iOS — show after a short delay so it doesn't interrupt initial paint
    if (isIOS()) {
      const t = setTimeout(() => {
        setVariant('ios')
        setShow(true)
      }, 2500)
      return () => {
        clearTimeout(t)
        window.removeEventListener('beforeinstallprompt', handler)
      }
    }

    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      setShow(false)
    } else {
      dismissFor(DISMISS_DAYS)
      setShow(false)
    }
    setDeferredPrompt(null)
  }

  const handleDismiss = () => {
    dismissFor(DISMISS_DAYS)
    setShow(false)
  }

  if (!show) return null

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[60] p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pointer-events-none"
      role="dialog"
      aria-label="Installer l'application Padel Camp"
    >
      <div className="pointer-events-auto mx-auto max-w-md bg-white rounded-2xl shadow-[0_8px_32px_rgba(11,39,120,0.18)] border border-separator overflow-hidden">
        <div className="p-4">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-[12px] bg-primary flex items-center justify-center shrink-0 p-1.5">
              <img src="/icon-192.png" alt="" className="w-full h-full rounded-[8px]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-text">Installer Padel Camp</p>
              <p className="text-xs text-text-secondary mt-0.5">
                {variant === 'ios'
                  ? "Pour l'utiliser hors-ligne et la lancer plus vite depuis votre écran d'accueil."
                  : "Une expérience plus rapide et hors-ligne, comme une vraie app."}
              </p>
            </div>
            <button
              onClick={handleDismiss}
              aria-label="Fermer"
              className="w-7 h-7 rounded-full hover:bg-bg flex items-center justify-center shrink-0 cursor-pointer"
            >
              <X className="w-4 h-4 text-text-tertiary" />
            </button>
          </div>

          {variant === 'ios' ? (
            <div className="mt-3 pt-3 border-t border-separator/50 space-y-2">
              <div className="flex items-center gap-2 text-xs text-text-secondary">
                <span className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">1</span>
                <span className="flex-1">Touchez l'icône Partager</span>
                <Share className="w-4 h-4 text-primary shrink-0" />
              </div>
              <div className="flex items-center gap-2 text-xs text-text-secondary">
                <span className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">2</span>
                <span className="flex-1">Choisissez « Sur l'écran d'accueil »</span>
                <Plus className="w-4 h-4 text-primary shrink-0" />
              </div>
            </div>
          ) : (
            <div className="mt-3 flex gap-2">
              <button
                onClick={handleDismiss}
                className="flex-1 py-2.5 rounded-[12px] text-sm font-medium text-text-secondary hover:bg-bg transition-colors cursor-pointer"
              >
                Plus tard
              </button>
              <button
                onClick={handleInstall}
                className="flex-1 py-2.5 rounded-[12px] bg-primary text-white text-sm font-semibold flex items-center justify-center gap-2 hover:bg-primary-light transition-colors cursor-pointer"
              >
                <Download className="w-4 h-4" />
                Installer
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
