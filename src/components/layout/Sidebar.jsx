import { NavLink } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import {
  Home, CalendarDays, Trophy, User, Menu, Heart,
  LayoutDashboard, Users, Settings, ShoppingCart, Package, CreditCard, Ticket, Calendar, FileBarChart
} from 'lucide-react'

const userLinks = [
  { to: '/dashboard', icon: Home, label: 'Accueil' },
  { to: '/booking', icon: CalendarDays, label: 'Réserver' },
  { to: '/tournaments', icon: Trophy, label: 'Tournois' },
  { to: '/social', icon: Heart, label: 'Social' },
  { to: '/my-tournaments', icon: Ticket, label: 'Mes Tournois' },
  { to: '/events', icon: Calendar, label: 'Événements' },
  { to: '/profile', icon: User, label: 'Mon Compte' },
]

const adminLinks = [
  { to: '/admin', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/admin/pos', icon: ShoppingCart, label: 'Point de vente' },
  { to: '/admin/members', icon: Users, label: 'Membres' },
  { to: '/admin/calendar', icon: Calendar, label: 'Calendrier' },
  { to: '/admin/products', icon: Package, label: 'Articles' },
  { to: '/admin/tournaments', icon: Trophy, label: 'Tournois' },
  { to: '/admin/formulas', icon: CreditCard, label: 'Formules' },
  { to: '/admin/financial-export', icon: FileBarChart, label: 'Rapport financier' },
  { to: '/admin/settings', icon: Settings, label: 'Paramètres' },
]


function SidebarLink({ to, icon: Icon, label }) {
  return (
    <NavLink
      to={to}
      end
      className={({ isActive }) =>
        `flex items-center gap-3 px-4 py-2.5 rounded-[12px] text-sm font-medium transition-colors ${
          isActive
            ? 'bg-primary text-white'
            : 'text-text-secondary hover:bg-bg'
        }`
      }
    >
      <Icon className="w-5 h-5" strokeWidth={2} />
      {label}
    </NavLink>
  )
}

export default function Sidebar() {
  const { isAdmin } = useAuth()

  return (
    <aside className="hidden lg:flex flex-col w-64 h-screen fixed left-0 top-0 bg-white border-r border-separator p-4">
      <div className="flex items-center gap-3 px-4 py-3 mb-6">
        <div className="w-10 h-10 rounded-[12px] bg-primary flex items-center justify-center p-1.5">
          <img src="/favicon.svg" alt="Padel Camp" className="w-full h-full" />
        </div>
        <div>
          <h1 className="text-sm font-bold text-text leading-tight">Padel Camp</h1>
          <p className="text-xs text-text-secondary">Achères</p>
        </div>
      </div>

      <nav className="flex flex-col gap-1 flex-1 overflow-y-auto">
        <p className="px-4 text-[10px] font-semibold text-text-tertiary uppercase tracking-wider mb-1">
          Menu
        </p>
        {userLinks.map((link) => (
          <SidebarLink key={link.to} {...link} />
        ))}

        {isAdmin && (
          <>
            <div className="my-3 border-t border-separator" />
            <p className="px-4 text-[10px] font-semibold text-text-tertiary uppercase tracking-wider mb-1">
              Administration
            </p>
            {adminLinks.map((link) => (
              <SidebarLink key={link.to} {...link} />
            ))}
          </>
        )}
      </nav>
    </aside>
  )
}
