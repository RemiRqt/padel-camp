import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { getRedirectAfterLogin } from '@/lib/permissions'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import toast from 'react-hot-toast'
import { Eye, EyeOff } from 'lucide-react'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const { signIn } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const { profile } = await signIn(email, password)
      toast.success('Connexion réussie')
      navigate(getRedirectAfterLogin(profile?.role), { replace: true })
    } catch (err) {
      const msg = err.message === 'Invalid login credentials'
        ? 'Email ou mot de passe incorrect'
        : err.message
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-24 h-24 mx-auto mb-4 flex items-center justify-center">
            <img src="/icon-192.png" alt="Padel Camp" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-2xl font-bold text-text">Padel Camp</h1>
          <p className="text-sm text-text-secondary mt-1">Achères</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            id="login-email"
            name="email"
            label="Email"
            type="email"
            placeholder="votre@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
          <Input
            id="login-password"
            name="password"
            label="Mot de passe"
            type={showPassword ? 'text' : 'password'}
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            suffix={
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                className="text-text-tertiary hover:text-primary transition-colors cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            }
          />
          <div className="text-right -mt-1">
            <Link to="/forgot-password" className="text-sm text-primary font-medium hover:underline">
              Mot de passe oublié ?
            </Link>
          </div>
          <Button type="submit" loading={loading} className="w-full">
            Se connecter
          </Button>
        </form>

        <p className="text-center text-sm text-text-secondary mt-6">
          Pas encore de compte ?{' '}
          <Link to="/register" className="text-primary font-semibold hover:underline">
            Créer un compte
          </Link>
        </p>
      </div>
    </div>
  )
}
