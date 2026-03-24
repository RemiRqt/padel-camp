import { NavLink } from 'react-router-dom'
import { Home, CalendarDays, Heart, Trophy, User } from 'lucide-react'

const items = [
  { to: '/dashboard', icon: Home, label: 'Accueil' },
  { to: '/booking', icon: CalendarDays, label: 'Réserver' },
  { to: '/social', icon: Heart, label: 'Social' },
  { to: '/tournaments', icon: Trophy, label: 'Tournois' },
  { to: '/profile', icon: User, label: 'Compte' },
]

export default function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 lg:hidden">
      <div
        className="flex items-center justify-around h-[68px] px-2 border-t border-separator bg-white/80"
        style={{ backdropFilter: 'blur(40px)', WebkitBackdropFilter: 'blur(40px)' }}
      >
        {items.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 py-1 px-3 rounded-xl transition-colors ${
                isActive ? 'text-primary' : 'text-text-tertiary hover:text-text-secondary'
              }`
            }
          >
            <Icon className="w-5 h-5" strokeWidth={2} />
            <span className="text-[10px] font-medium">{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
