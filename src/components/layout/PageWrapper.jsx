export default function PageWrapper({ title, children, className = '', wide = false }) {
  return (
    <div className={`px-4 lg:px-6 pt-6 pb-8 mx-auto ${wide ? 'max-w-7xl' : 'max-w-4xl'} ${className}`}>
      {title && (
        <h1 className="text-2xl font-bold text-text mb-6">{title}</h1>
      )}
      {children}
    </div>
  )
}
