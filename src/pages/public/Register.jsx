import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import toast from 'react-hot-toast'
import { Eye, EyeOff, Check, X } from 'lucide-react'

const PASSWORD_RULES = [
  { key: 'length', label: '8 caractères minimum', test: (p) => p.length >= 8 },
  { key: 'letter', label: 'Au moins 1 lettre', test: (p) => /[a-zA-Z]/.test(p) },
  { key: 'digit', label: 'Au moins 1 chiffre', test: (p) => /\d/.test(p) },
]

function EyeToggle({ shown, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={shown ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
      className="text-text-tertiary hover:text-primary transition-colors cursor-pointer"
    >
      {shown ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
    </button>
  )
}

export default function Register() {
  const [form, setForm] = useState({
    displayName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  })
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [passwordTouched, setPasswordTouched] = useState(false)
  const [loading, setLoading] = useState(false)
  const { signUp } = useAuth()
  const navigate = useNavigate()

  const update = (field) => (e) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }))

  const rules = PASSWORD_RULES.map((r) => ({ ...r, valid: r.test(form.password) }))
  const allRulesValid = rules.every((r) => r.valid)
  const confirmMismatch =
    form.confirmPassword.length > 0 && form.password !== form.confirmPassword
  const canSubmit =
    form.displayName.trim() &&
    form.email.trim() &&
    allRulesValid &&
    !confirmMismatch &&
    form.confirmPassword.length > 0

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!allRulesValid) {
      toast.error('Le mot de passe ne respecte pas les critères')
      return
    }
    if (form.password !== form.confirmPassword) {
      toast.error('Les mots de passe ne correspondent pas')
      return
    }
    setLoading(true)
    try {
      await signUp(form.email, form.password, form.displayName, form.phone || null)
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
          <div className="w-16 h-16 rounded-[16px] bg-primary mx-auto mb-4 flex items-center justify-center p-2.5">
            <img src="/icon-192.png" alt="Padel Camp" className="w-full h-full" />
          </div>
          <h1 className="text-2xl font-bold text-text">Créer un compte</h1>
          <p className="text-sm text-text-secondary mt-1">Rejoignez Padel Camp Achères</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
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
            label="Téléphone (optionnel)"
            type="tel"
            placeholder="06 12 34 56 78"
            value={form.phone}
            onChange={update('phone')}
            autoComplete="tel"
          />
          <div>
            <Input
              id="register-password"
              name="password"
              label="Mot de passe"
              type={showPassword ? 'text' : 'password'}
              placeholder="8 caractères minimum"
              value={form.password}
              onChange={update('password')}
              onFocus={() => setPasswordTouched(true)}
              required
              autoComplete="new-password"
              suffix={<EyeToggle shown={showPassword} onClick={() => setShowPassword(!showPassword)} />}
            />
            {(passwordTouched || form.password.length > 0) && (
              <ul className="mt-2 space-y-1 pl-0.5">
                {rules.map((r) => (
                  <li
                    key={r.key}
                    className={`flex items-center gap-1.5 text-xs transition-colors ${
                      r.valid ? 'text-success' : 'text-text-tertiary'
                    }`}
                  >
                    {r.valid ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                    {r.label}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <Input
            id="register-confirm"
            name="confirmPassword"
            label="Confirmer le mot de passe"
            type={showConfirm ? 'text' : 'password'}
            placeholder="••••••••"
            value={form.confirmPassword}
            onChange={update('confirmPassword')}
            error={confirmMismatch ? 'Les mots de passe ne correspondent pas' : undefined}
            required
            autoComplete="new-password"
            suffix={<EyeToggle shown={showConfirm} onClick={() => setShowConfirm(!showConfirm)} />}
          />
          <Button type="submit" loading={loading} disabled={!canSubmit} className="w-full">
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
