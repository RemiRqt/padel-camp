import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import toast from 'react-hot-toast'
import { CheckCircle } from 'lucide-react'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + '/auth/callback',
      })
      if (error) throw error
      setSent(true)
    } catch (err) {
      toast.error(err.message || 'Erreur lors de l\'envoi du mail')
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
          <h1 className="text-2xl font-bold text-text">Mot de passe oublié</h1>
          <p className="text-sm text-text-secondary mt-1">
            Saisissez votre email pour recevoir un lien de réinitialisation.
          </p>
        </div>

        {sent ? (
          <div className="bg-white rounded-[16px] p-6 text-center shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <CheckCircle className="h-12 w-12 text-success mx-auto mb-3" />
            <h2 className="font-semibold text-text mb-2">Email envoyé</h2>
            <p className="text-sm text-text-secondary mb-4">
              Si un compte existe pour <strong>{email}</strong>, vous recevrez un lien dans quelques instants. Pensez à vérifier vos spams.
            </p>
            <Link to="/login" className="text-primary font-semibold hover:underline text-sm">
              Retour à la connexion
            </Link>
          </div>
        ) : (
          <>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                id="forgot-email"
                name="email"
                label="Email"
                type="email"
                placeholder="votre@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
              <Button type="submit" loading={loading} className="w-full">
                Envoyer le lien
              </Button>
            </form>

            <p className="text-center text-sm text-text-secondary mt-6">
              <Link to="/login" className="text-primary font-semibold hover:underline">
                Retour à la connexion
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  )
}
