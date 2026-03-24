import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import toast from 'react-hot-toast'

export default function Register() {
  const [form, setForm] = useState({
    displayName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  })
  const [loading, setLoading] = useState(false)
  const { signUp } = useAuth()
  const navigate = useNavigate()

  const update = (field) => (e) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (form.password.length < 6) {
      toast.error('Le mot de passe doit contenir au moins 6 caractères')
      return
    }
    if (form.password !== form.confirmPassword) {
      toast.error('Les mots de passe ne correspondent pas')
      return
    }

    setLoading(true)
    try {
      await signUp(form.email, form.password, form.displayName, form.phone)
      toast.success('Compte créé ! Vérifiez votre email.')
      navigate('/login')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-[16px] bg-primary mx-auto mb-4 flex items-center justify-center">
            <span className="text-white font-bold text-2xl">P</span>
          </div>
          <h1 className="text-2xl font-bold text-text">Créer un compte</h1>
          <p className="text-sm text-text-secondary mt-1">Rejoignez Padel Camp Achères</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            id="register-name"
            name="displayName"
            label="Nom complet"
            type="text"
            placeholder="Jean Dupont"
            value={form.displayName}
            onChange={update('displayName')}
            required
            autoComplete="name"
          />
          <Input
            id="register-email"
            name="email"
            label="Email"
            type="email"
            placeholder="votre@email.com"
            value={form.email}
            onChange={update('email')}
            required
            autoComplete="email"
          />
          <Input
            id="register-phone"
            name="phone"
            label="Téléphone"
            type="tel"
            placeholder="06 12 34 56 78"
            value={form.phone}
            onChange={update('phone')}
            autoComplete="tel"
          />
          <Input
            id="register-password"
            name="password"
            label="Mot de passe"
            type="password"
            placeholder="6 caractères minimum"
            value={form.password}
            onChange={update('password')}
            required
            autoComplete="new-password"
          />
          <Input
            id="register-confirm"
            name="confirmPassword"
            label="Confirmer le mot de passe"
            type="password"
            placeholder="••••••••"
            value={form.confirmPassword}
            onChange={update('confirmPassword')}
            required
            autoComplete="new-password"
          />
          <Button type="submit" loading={loading} className="w-full">
            Créer mon compte
          </Button>
        </form>

        <p className="text-center text-sm text-text-secondary mt-6">
          Déjà un compte ?{' '}
          <Link to="/login" className="text-primary font-semibold hover:underline">
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  )
}
