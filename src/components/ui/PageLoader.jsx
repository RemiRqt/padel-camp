// Branded full-screen loader used as Suspense fallback during lazy-route loads.
export default function PageLoader() {
  return (
    <div
      className="min-h-screen bg-bg flex flex-col items-center justify-center gap-4"
      role="status"
      aria-live="polite"
      aria-label="Chargement"
    >
      <div className="w-14 h-14 rounded-2xl bg-primary p-2 flex items-center justify-center shadow-[0_8px_24px_rgba(11,39,120,0.2)]">
        <img src="/icon-192.png" alt="" className="w-full h-full rounded-lg" />
      </div>
      <div className="w-7 h-7 border-3 border-primary/30 border-t-primary rounded-full animate-spin" />
      <span className="sr-only">Chargement de la page</span>
    </div>
  )
}
