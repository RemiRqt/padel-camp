import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react'

export default function AuthCallback() {
  const navigate = useNavigate()
  const [status, setStatus] = useState('loading')

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const { data } = await supabase.auth.getSession()
        if (data?.session) {
          setStatus('success')
          setTimeout(() => navigate('/dashboard'), 1500)
        } else {
          setStatus('error')
          setTimeout(() => navigate('/login?error=failed'), 2000)
        }
      } catch {
        setStatus('error')
        setTimeout(() => navigate('/login?error=failed'), 2000)
      }
    }
    handleCallback()
  }, [navigate])

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg px-4">
      <div className="w-full max-w-md p-8 bg-white rounded-[20px] shadow-[0_4px_12px_rgba(11,39,120,0.15)] text-center">
        {status === 'loading' && (
          <>
            <Loader2 className="h-14 w-14 animate-spin text-primary mx-auto mb-5" />
            <h1 className="text-xl font-bold text-text mb-2">Confirmation email</h1>
            <p className="text-sm text-text-secondary">Redirection vers le dashboard...</p>
          </>
        )}
        {status === 'success' && (
          <>
            <CheckCircle className="h-14 w-14 text-success mx-auto mb-5" />
            <h1 className="text-xl font-bold text-success mb-2">Compte confirmé !</h1>
            <p className="text-sm text-text-secondary">Redirection...</p>
          </>
        )}
        {status === 'error' && (
          <>
            <AlertCircle className="h-14 w-14 text-danger mx-auto mb-5" />
            <h1 className="text-xl font-bold text-danger mb-2">Erreur de confirmation</h1>
            <p className="text-sm text-text-secondary">Redirection vers la connexion...</p>
          </>
        )}
      </div>
    </div>
  )
}
