import { forwardRef, useId } from 'react'

const Input = forwardRef(({ label, error, className = '', id, ...props }, ref) => {
  const autoId = useId()
  const inputId = id || autoId

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-text mb-1.5">
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        className={`
          w-full px-4 py-3 rounded-[12px] bg-white border border-separator
          text-text placeholder:text-text-tertiary
          focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary
          transition-all duration-200 text-sm
          ${error ? 'border-danger focus:ring-danger/20 focus:border-danger' : ''}
          ${className}
        `}
        {...props}
      />
      {error && (
        <p className="mt-1 text-xs text-danger">{error}</p>
      )}
    </div>
  )
})

Input.displayName = 'Input'
export default Input
