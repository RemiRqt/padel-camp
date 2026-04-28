import { useState, useEffect } from 'react'
import { Link, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import {
  Menu, X, Home, CalendarDays, Trophy, User, Ticket, Calendar,
  LayoutDashboard, Users, Settings, ShoppingCart, Package,
  CreditCard, LogOut, Shield, ChevronRight, Heart, FileBarChart
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

export default function Header() {
  const [open, setOpen] = useState(false)
  const { user, profile, isAdmin, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  // Close on route change
  useEffect(() => { setOpen(false) }, [location.pathname])

  // Lock scroll when open
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  const handleNav = (to) => { setOpen(false); navigate(to) }
  const handleSignOut = async () => { setOpen(false); await signOut(); navigate('/login') }

  return (
    <>
      {/* Header bar */}
      <header
        className="fixed top-0 left-0 right-0 z-50 h-16 bg-white/95 border-b border-separator lg:hidden"
        style={{ backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}
      >
        <div className="h-full px-4 flex items-center justify-between">
          <Link to={user ? (isAdmin ? '/admin' : '/dashboard') : '/'} className="flex items-center gap-2.5">
            <div className="w-11 h-11 flex items-center justify-center">
              <img src="/icon-192.png" alt="Padel Camp" className="w-full h-full object-contain" />
            </div>
            <div className="leading-tight">
              <p className="text-sm font-bold text-text">Padel Camp</p>
              <p className="text-[10px] text-text-secondary -mt-0.5">Achères</p>
            </div>
          </Link>

          <div className="flex items-center gap-1">
            {user && profile && (
              <Link to="/profile" className="hidden sm:flex items-center gap-2 mr-2">
                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-xs font-bold text-primary">{profile.display_name?.charAt(0)?.toUpperCase()}</span>
                </div>
                <span className="text-sm font-medium text-text">{profile.display_name?.split(' ')[0]}</span>
              </Link>
            )}
            {user && <NotificationBell />}
            <button
              onClick={() => setOpen(!open)}
              className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-bg transition-colors cursor-pointer"
              aria-label="Menu"
            >
              {open ? <X className="w-5 h-5 text-text" /> : <Menu className="w-5 h-5 text-text" />}
            </button>
          </div>
        </div>
      </header>

      {/* Fullscreen mobile menu */}
      <div
        className={`fixed inset-0 z-40 bg-white transition-all duration-300 ease-out lg:hidden ${
          open ? 'opacity-100 visible' : 'opacity-0 invisible pointer-events-none'
        }`}
        style={{ top: '64px' }}
      >
        <div className="h-full overflow-y-auto px-4 py-4 pb-20">
          {user ? (
            <>
              {/* User profile mini */}
              <div className="flex items-center gap-3 mb-5 pb-4 border-b border-separator">
                <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-lg font-bold text-primary">{profile?.display_name?.charAt(0)?.toUpperCase()}</span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-text">{profile?.display_name}</p>
                  <p className="text-xs text-text-secondary">{profile?.email}</p>
                </div>
              </div>

              {/* Admin sees only admin links, members see only user links — security separation */}
              {isAdmin ? (
                <>
                  <div className="mb-2 flex items-center gap-1.5">
                    <Shield className="w-3 h-3 text-primary" />
                    <p className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wider">Administration</p>
                  </div>
                  <div className="space-y-0.5">
                    {adminLinks.map(({ to, icon: Icon, label }) => {
                      const active = location.pathname === to
                      return (
                        <button
                          key={to}
                          onClick={() => handleNav(to)}
                          className={`w-full flex items-center gap-3 px-4 py-3 rounded-[12px] transition-all text-left cursor-pointer ${
                            active ? 'bg-primary text-white' : 'hover:bg-bg text-text'
                          }`}
                        >
                          <Icon className="w-5 h-5 shrink-0" strokeWidth={2} />
                          <span className="text-sm font-medium flex-1">{label}</span>
                          <ChevronRight className={`w-4 h-4 ${active ? 'text-white/40' : 'text-text-tertiary'}`} />
                        </button>
                      )
                    })}
                  </div>
                </>
              ) : (
                <div className="space-y-0.5">
                  {userLinks.map(({ to, icon: Icon, label }) => {
                    const active = location.pathname === to
                    return (
                      <button
                        key={to}
                        onClick={() => handleNav(to)}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-[12px] transition-all text-left cursor-pointer ${
                          active ? 'bg-primary text-white' : 'hover:bg-bg text-text'
                        }`}
                      >
                        <Icon className="w-5 h-5 shrink-0" strokeWidth={2} />
                        <span className="text-sm font-medium flex-1">{label}</span>
                        <ChevronRight className={`w-4 h-4 ${active ? 'text-white/40' : 'text-text-tertiary'}`} />
                      </button>
                    )
                  })}
                </div>
              )}

              {/* Sign out */}
              <div className="mt-5 pt-4 border-t border-separator">
                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-[12px] bg-danger/5 hover:bg-danger/10 transition-colors cursor-pointer"
                >
                  <LogOut className="w-5 h-5 text-danger" />
                  <span className="text-sm font-semibold text-danger">Se déconnecter</span>
                </button>
              </div>
            </>
          ) : (
            /* Not logged in */
            <div className="space-y-2 mt-4">
              <button onClick={() => handleNav('/login')} className="w-full flex items-center gap-3 px-4 py-3 rounded-[12px] hover:bg-bg text-text text-left cursor-pointer">
                <User className="w-5 h-5" />
                <span className="text-sm font-medium">Connexion</span>
              </button>
              <button onClick={() => handleNav('/register')} className="w-full flex items-center gap-3 px-4 py-3 rounded-[12px] bg-lime/20 text-primary text-left cursor-pointer">
                <User className="w-5 h-5" />
                <span className="text-sm font-semibold">Créer un compte</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
