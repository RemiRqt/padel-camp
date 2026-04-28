import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import {
  Home, CalendarDays, Trophy, User, Menu, Heart,
  LayoutDashboard, Users, Settings, ShoppingCart, Package, CreditCard, Ticket, Calendar, FileBarChart, LogOut
} from 'lucide-react'
import NotificationBell from '@/components/notifications/NotificationBell'

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
  const { isAdmin, profile, signOut } = useAuth()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <aside className="hidden lg:flex flex-col w-64 h-screen fixed left-0 top-0 bg-white border-r border-separator p-4">
      <div className="flex items-center gap-3 px-4 py-3 mb-6">
        <div className="w-12 h-12 flex items-center justify-center shrink-0">
          <img src="/icon-192.png" alt="Padel Camp" className="w-full h-full object-contain" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-bold text-text leading-tight">Padel Camp</h1>
          <p className="text-xs text-text-secondary">Achères</p>
        </div>
        <NotificationBell align="left" />
      </div>

      <nav className="flex flex-col gap-1 flex-1 overflow-y-auto">
        {/* Admin sees only admin links, members see only user links — security separation */}
        <p className="px-4 text-[10px] font-semibold text-text-tertiary uppercase tracking-wider mb-1">
          {isAdmin ? 'Administration' : 'Menu'}
        </p>
        {(isAdmin ? adminLinks : userLinks).map((link) => (
          <SidebarLink key={link.to} {...link} />
        ))}
      </nav>

      <div className="pt-3 mt-3 border-t border-separator">
        {profile && (
          <div className="flex items-center gap-3 px-4 py-2 mb-2">
            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <span className="text-sm font-bold text-primary">{profile.display_name?.charAt(0)?.toUpperCase()}</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-text truncate">{profile.display_name}</p>
              <p className="text-xs text-text-secondary truncate">{profile.email}</p>
            </div>
          </div>
        )}
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-[12px] bg-danger/5 hover:bg-danger/10 transition-colors cursor-pointer"
        >
          <LogOut className="w-5 h-5 text-danger" strokeWidth={2} />
          <span className="text-sm font-semibold text-danger">Se déconnecter</span>
        </button>
      </div>
    </aside>
  )
}
