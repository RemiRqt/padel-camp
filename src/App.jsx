import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '@/lib/queryClient'
import { AuthProvider } from '@/context/AuthContext'
import { NotificationProvider } from '@/context/NotificationContext'
import AppLayout from '@/components/layout/AppLayout'
import ProtectedRoute from '@/components/layout/ProtectedRoute'
import AdminRoute from '@/components/layout/AdminRoute'
import OfflineBanner from '@/components/ui/OfflineBanner'
import ErrorBoundary from '@/components/ui/ErrorBoundary'
import InstallPWA from '@/components/ui/InstallPWA'
import PageLoader from '@/components/ui/PageLoader'
import ScrollToTop from '@/components/layout/ScrollToTop'

// Pages publiques (Landing eager, reste lazy)
import Landing from '@/pages/public/Landing'
const Login = lazy(() => import('@/pages/public/Login'))
const Register = lazy(() => import('@/pages/public/Register'))
const Tournaments = lazy(() => import('@/pages/public/Tournaments'))
const Events = lazy(() => import('@/pages/public/Events'))
const AuthCallback = lazy(() => import('@/pages/AuthCallback'))

// Pages utilisateur
const Dashboard = lazy(() => import('@/pages/user/Dashboard'))
const Booking = lazy(() => import('@/pages/user/Booking'))
const BookingConfirm = lazy(() => import('@/pages/user/BookingConfirm'))
const Profile = lazy(() => import('@/pages/user/Profile'))
const MyTournaments = lazy(() => import('@/pages/user/MyTournaments'))
const TournamentDetail = lazy(() => import('@/pages/user/TournamentDetail'))
const TournamentRegister = lazy(() => import('@/pages/user/TournamentRegister'))
const Social = lazy(() => import('@/pages/user/Social'))

// Pages admin
const AdminDash = lazy(() => import('@/pages/admin/AdminDash'))
const AdminMembers = lazy(() => import('@/pages/admin/AdminMembers'))
const AdminCalendar = lazy(() => import('@/pages/admin/AdminCalendar'))
const AdminProducts = lazy(() => import('@/pages/admin/AdminProducts'))
const AdminPOS = lazy(() => import('@/pages/admin/AdminPOS'))
const AdminFormulas = lazy(() => import('@/pages/admin/AdminFormulas'))
const AdminSettings = lazy(() => import('@/pages/admin/AdminSettings'))
const AdminTournaments = lazy(() => import('@/pages/admin/AdminTournaments'))
const AdminFinancialExport = lazy(() => import('@/pages/admin/AdminFinancialExport'))
const AdminNotifications = lazy(() => import('@/pages/admin/AdminNotifications'))
const NotFound = lazy(() => import('@/pages/NotFound'))

const ReactQueryDevtools = import.meta.env.DEV
  ? lazy(() =>
      import('@tanstack/react-query-devtools').then((m) => ({
        default: m.ReactQueryDevtools,
      }))
    )
  : null

export default function App() {
  return (
    <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <AuthProvider>
      <NotificationProvider>
        <ScrollToTop />
        <OfflineBanner />
        <InstallPWA />
        <Toaster
          position="top-center"
          toastOptions={{
            duration: 3000,
            style: {
              fontFamily: 'Poppins, sans-serif',
              fontSize: '14px',
              borderRadius: '14px',
            },
          }}
        />
        <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Routes publiques */}
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/auth/callback" element={<AuthCallback />} />

          {/* Routes avec layout (nav) */}
          <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/booking" element={<Booking />} />
            <Route path="/booking/:id" element={<BookingConfirm />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/tournaments" element={<Tournaments />} />
            <Route path="/tournaments/:id" element={<TournamentDetail />} />
            <Route path="/tournaments/:id/register" element={<TournamentRegister />} />
            <Route path="/events" element={<Events />} />
            <Route path="/my-tournaments" element={<MyTournaments />} />
            <Route path="/social" element={<Social />} />
          </Route>

          {/* Routes admin */}
          <Route element={<AdminRoute><AppLayout /></AdminRoute>}>
            <Route path="/admin" element={<AdminDash />} />
            <Route path="/admin/notifications" element={<AdminNotifications />} />
            <Route path="/admin/members" element={<AdminMembers />} />
            <Route path="/admin/calendar" element={<AdminCalendar />} />
            <Route path="/admin/products" element={<AdminProducts />} />
            <Route path="/admin/pos" element={<AdminPOS />} />
            <Route path="/admin/formulas" element={<AdminFormulas />} />
            <Route path="/admin/tournaments" element={<AdminTournaments />} />
            <Route path="/admin/settings" element={<AdminSettings />} />
            <Route path="/admin/financial-export" element={<AdminFinancialExport />} />
          </Route>

          {/* 404 */}
          <Route path="*" element={<NotFound />} />
        </Routes>
        </Suspense>
      </NotificationProvider>
      </AuthProvider>
    </BrowserRouter>
    {ReactQueryDevtools && (
      <Suspense fallback={null}>
        <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
      </Suspense>
    )}
    </QueryClientProvider>
    </ErrorBoundary>
  )
}
