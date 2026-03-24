import { useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import PageWrapper from '@/components/layout/PageWrapper'
import Card from '@/components/ui/Card'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import toast from 'react-hot-toast'
import {
  User, Mail, Phone, Award, Wallet, Gift, LogOut,
  ChevronRight, Shield
} from 'lucide-react'

export default function Profile() {
  const { profile, signOut, fetchProfile, user, isAdmin } = useAuth()
  const [form, setForm] = useState({
    display_name: '',
    phone: '',
    license_number: '',
  })
  const [saving, setSaving] = useState(false)
  const [txCount, setTxCount] = useState(0)

  useEffect(() => {
    if (profile) {
      setForm({
        display_name: profile.display_name || '',
        phone: profile.phone || '',
        license_number: profile.license_number || '',
      })
    }
  }, [profile])

  useEffect(() => {
    if (!user?.id) return
    supabase
      .from('transactions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .then(({ count, error }) => {
        if (!error) setTxCount(count || 0)
      })
  }, [user?.id])

  const update = (field) => (e) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }))

  const handleSave = async (e) => {
    e.preventDefault()
    if (!form.display_name.trim()) {
      toast.error('Le nom est obligatoire')
      return
    }
    setSaving(true)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          display_name: form.display_name.trim(),
          phone: form.phone.trim() || null,
          license_number: form.license_number.trim() || null,
        })
        .eq('id', user.id)
      if (error) throw error
      await fetchProfile(user.id)
      toast.success('Profil mis à jour')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  const balance = parseFloat(profile?.balance || 0)
  const bonus = parseFloat(profile?.balance_bonus || 0)

  return (
    <PageWrapper title="Mon Compte">
      <div className="space-y-5">
        {/* Avatar + Name header */}
        <Card elevated className="text-center !py-8">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-primary-light mx-auto mb-3 flex items-center justify-center">
            <span className="text-3xl font-bold text-white">
              {profile?.display_name?.charAt(0)?.toUpperCase() || '?'}
            </span>
          </div>
          <h2 className="text-xl font-bold text-text">{profile?.display_name}</h2>
          <p className="text-sm text-text-secondary mt-0.5">{profile?.email}</p>
          <div className="flex items-center justify-center gap-2 mt-2">
            {isAdmin && <Badge color="primary"><Shield className="w-3 h-3 mr-1 inline" />Admin</Badge>}
            <Badge color="gray">Membre</Badge>
            {profile?.license_number && (
              <Badge color="lime"><Award className="w-3 h-3 mr-1 inline" />FFT</Badge>
            )}
          </div>
        </Card>

        {/* Solde résumé */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="!p-4">
            <div className="flex items-center gap-2 mb-1">
              <Wallet className="w-4 h-4 text-primary" />
              <p className="text-xs text-text-secondary">Solde réel</p>
            </div>
            <p className="text-xl font-bold text-primary">{balance.toFixed(2)}€</p>
          </Card>
          <Card className="!p-4">
            <div className="flex items-center gap-2 mb-1">
              <Gift className="w-4 h-4 text-lime-dark" />
              <p className="text-xs text-text-secondary">Bonus</p>
            </div>
            <p className="text-xl font-bold text-lime-dark">{bonus.toFixed(2)}€</p>
          </Card>
        </div>

        {/* Stats */}
        <Card className="!p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-[10px] bg-primary/5 flex items-center justify-center">
                <ChevronRight className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-text">{txCount} transactions</p>
                <p className="text-xs text-text-secondary">
                  Membre depuis {profile?.created_at ? new Date(profile.created_at).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }) : '—'}
                </p>
              </div>
            </div>
          </div>
        </Card>

        {/* Formulaire édition */}
        <Card>
          <h3 className="font-semibold text-text mb-4">Mes informations</h3>
          <form onSubmit={handleSave} className="space-y-4">
            <Input
              label="Nom complet"
              value={form.display_name}
              onChange={update('display_name')}
              required
            />
            <Input
              label="Téléphone"
              type="tel"
              value={form.phone}
              onChange={update('phone')}
              placeholder="06 12 34 56 78"
            />
            <div>
              <Input
                label="N° Licence FFT"
                value={form.license_number}
                onChange={update('license_number')}
                placeholder="Ex: 1234567"
              />
              <p className="text-[11px] text-text-tertiary mt-1.5">
                Obligatoire pour participer aux tournois homologués
              </p>
            </div>
            <Button type="submit" loading={saving} className="w-full">
              Enregistrer
            </Button>
          </form>
        </Card>

        {/* Info non modifiable */}
        <Card>
          <h3 className="font-semibold text-text mb-3">Compte</h3>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-[10px] bg-bg flex items-center justify-center shrink-0">
                <Mail className="w-4 h-4 text-text-secondary" />
              </div>
              <div>
                <p className="text-xs text-text-secondary">Email</p>
                <p className="text-sm font-medium">{profile?.email}</p>
              </div>
            </div>
            <div className="border-t border-separator" />
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-[10px] bg-bg flex items-center justify-center shrink-0">
                <User className="w-4 h-4 text-text-secondary" />
              </div>
              <div>
                <p className="text-xs text-text-secondary">Rôle</p>
                <p className="text-sm font-medium capitalize">{profile?.role || 'user'}</p>
              </div>
            </div>
          </div>
        </Card>

        {/* Déconnexion */}
        <Button variant="danger" className="w-full" onClick={signOut}>
          <LogOut className="w-4 h-4 mr-2" />
          Se déconnecter
        </Button>
      </div>
    </PageWrapper>
  )
}
