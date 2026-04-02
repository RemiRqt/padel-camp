import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import {
  fetchTournamentById, registerPair, searchMembersForTournament
} from '@/services/tournamentService'
import PageWrapper from '@/components/layout/PageWrapper'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import PartnerSearchForm from '@/components/features/tournament/PartnerSearchForm'
import toast from 'react-hot-toast'
import {
  Trophy, Check, AlertTriangle, Info
} from 'lucide-react'

export default function TournamentRegister() {
  const { id } = useParams()
  const { user, profile } = useAuth()
  const navigate = useNavigate()

  const [tournament, setTournament] = useState(null)
  const [loading, setLoading] = useState(true)

  // Partner mode: 'member' or 'external'
  const [partnerMode, setPartnerMode] = useState('member')

  // Member search
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [selectedPartner, setSelectedPartner] = useState(null)

  // External partner
  const [externalName, setExternalName] = useState('')
  const [externalLicense, setExternalLicense] = useState('')

  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const t = await fetchTournamentById(id)
        setTournament(t)
      } catch {
        toast.error('Tournoi introuvable')
        navigate('/tournaments')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  // Search members
  useEffect(() => {
    if (partnerMode !== 'member' || searchQuery.length < 2) {
      setSearchResults([])
      return
    }
    const timer = setTimeout(async () => {
      setSearching(true)
      const results = await searchMembersForTournament(searchQuery)
      // Exclude self
      setSearchResults(results.filter((r) => r.id !== user?.id))
      setSearching(false)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery, partnerMode, user])

  const handleSubmit = async () => {
    if (!user || !profile || !tournament) return

    // Validate player1 license
    if (!profile.license_number) {
      toast.error('Vous devez renseigner votre licence FFT dans votre profil')
      return
    }

    if (partnerMode === 'member') {
      if (!selectedPartner) {
        toast.error('Sélectionnez un partenaire')
        return
      }
      if (!selectedPartner.license_number) {
        toast.error(`${selectedPartner.display_name} n'a pas de licence FFT renseignée`)
        return
      }
    } else {
      if (!externalName.trim()) {
        toast.error('Nom du partenaire requis')
        return
      }
      if (!externalLicense.trim()) {
        toast.error('Licence FFT du partenaire requise')
        return
      }
    }

    setSubmitting(true)
    try {
      await registerPair({
        tournamentId: id,
        player1Uid: user.id,
        player1Name: profile.display_name,
        player1License: profile.license_number,
        player2Uid: partnerMode === 'member' ? selectedPartner.id : null,
        player2Name: partnerMode === 'member' ? selectedPartner.display_name : externalName.trim(),
        player2License: partnerMode === 'member' ? selectedPartner.license_number : externalLicense.trim(),
        player2IsExternal: partnerMode === 'external',
      })

      const msg = partnerMode === 'member'
        ? `Inscription envoyée ! ${selectedPartner.display_name} doit accepter.`
        : 'Inscription envoyée ! En attente de validation admin.'
      toast.success(msg)
      navigate(`/tournaments/${id}`)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <PageWrapper title="Inscription">
        <div className="space-y-3">
          {[1, 2].map((i) => <div key={i} className="h-24 rounded-[16px] bg-white animate-pulse" />)}
        </div>
      </PageWrapper>
    )
  }

  if (!tournament) return null

  return (
    <PageWrapper>
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-text">Inscription</h1>
          <p className="text-sm text-text-secondary mt-1">{tournament.name}</p>
          <div className="flex gap-1.5 mt-2">
            <Badge color="primary">{tournament.level}</Badge>
            <Badge color="lime">{tournament.category}</Badge>
          </div>
        </div>

        {/* Player 1 (me) */}
        <Card>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold">1</div>
            <h3 className="font-semibold text-text text-sm">Joueur 1 (vous)</h3>
          </div>
          <div className="rounded-[12px] bg-bg p-3 space-y-2">
            <div className="flex justify-between">
              <span className="text-xs text-text-secondary">Nom</span>
              <span className="text-sm font-medium">{profile?.display_name}</span>
            </div>
            <div className="border-t border-separator" />
            <div className="flex justify-between">
              <span className="text-xs text-text-secondary">Licence FFT</span>
              {profile?.license_number ? (
                <span className="text-sm font-medium flex items-center gap-1">
                  <Check className="w-3.5 h-3.5 text-success" />
                  {profile.license_number}
                </span>
              ) : (
                <span className="text-sm text-danger flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Non renseignée
                </span>
              )}
            </div>
          </div>
        </Card>

        {/* Player 2 */}
        <Card>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-full bg-lime text-primary flex items-center justify-center text-xs font-bold">2</div>
            <h3 className="font-semibold text-text text-sm">Joueur 2 (partenaire)</h3>
          </div>

          <PartnerSearchForm
            partnerMode={partnerMode}
            setPartnerMode={setPartnerMode}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            searchResults={searchResults}
            searching={searching}
            selectedPartner={selectedPartner}
            setSelectedPartner={setSelectedPartner}
            externalName={externalName}
            setExternalName={setExternalName}
            externalLicense={externalLicense}
            setExternalLicense={setExternalLicense}
          />
        </Card>

        {/* Workflow explanation */}
        <Card className="!bg-primary/3">
          <div className="flex items-start gap-2">
            <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <div className="text-xs text-text-secondary space-y-1">
              <p className="font-semibold text-text">Comment ça marche ?</p>
              {partnerMode === 'member' ? (
                <ol className="list-decimal ml-4 space-y-0.5">
                  <li>Votre partenaire reçoit une invitation à accepter</li>
                  <li>Une fois acceptée, l'admin valide l'inscription</li>
                  <li>48h avant le tournoi, vous devez tous les deux confirmer</li>
                  <li>Sans confirmation, votre place est libérée</li>
                </ol>
              ) : (
                <ol className="list-decimal ml-4 space-y-0.5">
                  <li>L'admin valide votre inscription et la licence du partenaire</li>
                  <li>48h avant le tournoi, vous devez confirmer votre présence</li>
                  <li>Sans confirmation, votre place est libérée</li>
                </ol>
              )}
            </div>
          </div>
        </Card>

        {/* Submit */}
        <Button
          className="w-full"
          size="lg"
          loading={submitting}
          onClick={handleSubmit}
          disabled={
            (partnerMode === 'member' && (!selectedPartner || !selectedPartner.license_number)) ||
            (partnerMode === 'external' && (!externalName.trim() || !externalLicense.trim())) ||
            !profile?.license_number
          }
        >
          <Trophy className="w-5 h-5 mr-2" />
          Envoyer l'inscription
        </Button>
      </div>
    </PageWrapper>
  )
}

