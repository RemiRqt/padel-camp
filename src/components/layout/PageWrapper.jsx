export default function PageWrapper({ title, children, className = '' }) {
  return (
    <div className={`px-4 pt-6 pb-8 max-w-4xl mx-auto ${className}`}>
      {title && (
        <h1 className="text-2xl font-bold text-text mb-6">{title}</h1>
      )}
      {children}
    </div>
  )
}
