import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import toast from 'react-hot-toast'
import { Eye, EyeOff } from 'lucide-react'

export default function ResetPassword() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [authorized, setAuthorized] = useState(false)
  const [account, setAccount] = useState({ displayName: '', email: '' })
  const navigate = useNavigate()

  useEffect(() => {
    let cancelled = false
    let timer = null

    const loadProfile = async (session) => {
      const email = session.user?.email || ''
      let displayName = session.user?.user_metadata?.display_name || ''
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('display_name, email')
          .eq('id', session.user.id)
          .maybeSingle()
        if (profile?.display_name) displayName = profile.display_name
      } catch {
        /* fallback sur user_metadata */
      }
      if (!cancelled) {
        setAccount({ displayName, email })
        setAuthorized(true)
      }
    }

    const tryInit = async () => {
      const { data } = await supabase.auth.getSession()
      if (data?.session) {
        await loadProfile(data.session)
        return true
      }
      return false
    }

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) return
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
        loadProfile(session)
      }
    })

    tryInit().then((ok) => {
      if (ok || cancelled) return
      timer = setTimeout(async () => {
        if (cancelled) return
        const ok2 = await tryInit()
        if (!ok2 && !cancelled) {
          toast.error('Lien expiré ou invalide')
          navigate('/forgot-password', { replace: true })
        }
      }, 1500)
    })

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
      sub?.subscription?.unsubscribe?.()
    }
  }, [navigate])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (password.length < 8) {
      toast.error('Le mot de passe doit contenir au moins 8 caractères')
      return
    }
    if (password !== confirm) {
      toast.error('Les mots de passe ne correspondent pas')
      return
    }
    setLoading(true)
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      toast.success('Mot de passe mis à jour')
      navigate('/dashboard', { replace: true })
    } catch (err) {
      toast.error(err.message || 'Erreur lors de la mise à jour')
    } finally {
      setLoading(false)
    }
  }

  if (!authorized) return null

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-24 h-24 mx-auto mb-4 flex items-center justify-center">
            <img src="/icon-192.png" alt="Padel Camp" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-2xl font-bold text-text">Nouveau mot de passe</h1>
          {account.email && (
            <p className="text-sm text-text mt-2 font-medium">
              {account.displayName ? `${account.displayName} ` : ''}
              <span className="text-text-secondary font-normal">({account.email})</span>
            </p>
          )}
          <p className="text-sm text-text-secondary mt-1">
            Choisissez un mot de passe d'au moins 8 caractères.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            id="reset-password"
            name="password"
            label="Nouveau mot de passe"
            type={showPassword ? 'text' : 'password'}
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="new-password"
            minLength={8}
            suffix={
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Masquer' : 'Afficher'}
                className="text-text-tertiary hover:text-primary transition-colors cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            }
          />
          <Input
            id="reset-password-confirm"
            name="passwordConfirm"
            label="Confirmer le mot de passe"
            type={showPassword ? 'text' : 'password'}
            placeholder="••••••••"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            autoComplete="new-password"
            minLength={8}
          />
          <Button type="submit" loading={loading} className="w-full">
            Mettre à jour
          </Button>
        </form>
      </div>
    </div>
  )
}
