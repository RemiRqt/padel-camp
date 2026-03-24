import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from '@/context/AuthContext'
import AppLayout from '@/components/layout/AppLayout'
import ProtectedRoute from '@/components/layout/ProtectedRoute'
import AdminRoute from '@/components/layout/AdminRoute'

// Pages publiques
import Landing from '@/pages/public/Landing'
import Login from '@/pages/public/Login'
import Register from '@/pages/public/Register'
import Tournaments from '@/pages/public/Tournaments'
import Events from '@/pages/public/Events'

// Pages utilisateur
import Dashboard from '@/pages/user/Dashboard'
import Booking from '@/pages/user/Booking'
import BookingConfirm from '@/pages/user/BookingConfirm'
import Profile from '@/pages/user/Profile'
import MyTournaments from '@/pages/user/MyTournaments'
import TournamentDetail from '@/pages/user/TournamentDetail'
import TournamentRegister from '@/pages/user/TournamentRegister'
import Social from '@/pages/user/Social'

// Pages admin
import AdminDash from '@/pages/admin/AdminDash'
import AdminBookings from '@/pages/admin/AdminBookings'
import AdminMembers from '@/pages/admin/AdminMembers'
import AdminRecharge from '@/pages/admin/AdminRecharge'
import AdminTournaments from '@/pages/admin/AdminTournaments'
import AdminEvents from '@/pages/admin/AdminEvents'
import AdminProducts from '@/pages/admin/AdminProducts'
import AdminPOS from '@/pages/admin/AdminPOS'
import AdminFormulas from '@/pages/admin/AdminFormulas'
import AdminSettings from '@/pages/admin/AdminSettings'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
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
        <Routes>
          {/* Routes publiques */}
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

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
            <Route path="/admin/bookings" element={<AdminBookings />} />
            <Route path="/admin/members" element={<AdminMembers />} />
            <Route path="/admin/recharge" element={<AdminRecharge />} />
            <Route path="/admin/tournaments" element={<AdminTournaments />} />
            <Route path="/admin/events" element={<AdminEvents />} />
            <Route path="/admin/products" element={<AdminProducts />} />
            <Route path="/admin/pos" element={<AdminPOS />} />
            <Route path="/admin/formulas" element={<AdminFormulas />} />
            <Route path="/admin/settings" element={<AdminSettings />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
