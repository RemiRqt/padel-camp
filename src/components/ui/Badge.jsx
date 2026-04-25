import { memo } from 'react'

const colors = {
  primary: 'bg-primary/10 text-primary',
  lime: 'bg-lime/30 text-primary',
  success: 'bg-success/10 text-success',
  danger: 'bg-danger/10 text-danger',
  warning: 'bg-warning/10 text-warning',
  gray: 'bg-text-tertiary/10 text-text-secondary',
}

function Badge({ children, color = 'primary', className = '' }) {
  return (
    <span
      className={`
        inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold
        ${colors[color]}
        ${className}
      `}
    >
      {children}
    </span>
  )
}

export default memo(Badge)
