import { memo } from 'react'
import { Loader2 } from 'lucide-react'

const variants = {
  primary: 'bg-primary text-white hover:bg-primary-light active:bg-primary-dark',
  lime: 'bg-lime text-primary hover:bg-lime-dark',
  outline: 'border-2 border-primary text-primary hover:bg-primary hover:text-white',
  ghost: 'text-primary hover:bg-primary/5',
  danger: 'bg-danger text-white hover:bg-danger/90',
}

const sizes = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-5 py-2.5 text-sm',
  lg: 'px-6 py-3 text-base',
}

function Button({
  children,
  variant = 'primary',
  size = 'md',
  pill = false,
  loading = false,
  disabled = false,
  className = '',
  ...props
}) {
  return (
    <button
      className={`
        inline-flex items-center justify-center font-semibold transition-all duration-200
        ${pill ? 'rounded-full' : 'rounded-[14px]'}
        ${variants[variant]}
        ${sizes[size]}
        ${(disabled || loading) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        ${className}
      `}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
      {children}
    </button>
  )
}

export default memo(Button)
