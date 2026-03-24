export default function Card({ children, className = '', elevated = false, ...props }) {
  return (
    <div
      className={`
        bg-white rounded-[16px] p-5
        ${elevated
          ? 'shadow-[0_4px_12px_rgba(11,39,120,0.15)]'
          : 'shadow-[0_1px_3px_rgba(0,0,0,0.04)]'
        }
        ${className}
      `}
      {...props}
    >
      {children}
    </div>
  )
}
