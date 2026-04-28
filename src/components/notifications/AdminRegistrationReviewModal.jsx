import { useEffect, useState } from 'react'
import { Trophy, Calendar, Clock, User, Award, Check, X } from 'lucide-react'
import toast from 'react-hot-toast'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import {
  fetchRegistrationById,
  adminValidateRegistration,
  adminRejectRegistration,
} from '@/services/tournamentService'
import { formatDateFull, formatTime } from '@/utils/formatDate'

export default function AdminRegistrationReviewModal({ registrationId, isOpen, onClose, onResolved }) {
  const [reg, setReg] = useState(null)
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(null) // 'validate' | 'reject'
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!isOpen || !registrationId) {
      setReg(null)
      setError(null)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    fetchRegistrationById(registrationId)
      .then((data) => { if (!cancelled) setReg(data) })
      .catch((e) => { if (!cancelled) setError(e.message || 'Erreur de chargement') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [isOpen, registrationId])

  const handleValidate = async () => {
    if (!reg) return
    setActionLoading('validate')
    try {
      const result = await adminValidateRegistration(reg.id, reg.tournament_id, reg.tournaments.max_teams)
      toast.success(result?.status === 'waitlist' ? 'Mise en liste d\'attente' : 'Inscription validée')
      onResolved?.()
      onClose()
    } catch (e) {
      toast.error(e.message || 'Erreur')
    } finally {
      setActionLoading(null)
    }
  }

  const handleReject = async () => {
    if (!reg) return
    setActionLoading('reject')
    try {
      await adminRejectRegistration(reg.id)
      toast.success('Inscription refusée')
      onResolved?.()
      onClose()
    } catch (e) {
      toast.error(e.message || 'Erreur')
    } finally {
      setActionLoading(null)
    }
  }

  const alreadyHandled = reg && reg.status !== 'pending_admin'

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Inscription tournoi à valider">
      {loading && (
        <div className="space-y-3">
          <div className="h-20 bg-bg rounded-[12px] animate-pulse" />
          <div className="h-32 bg-bg rounded-[12px] animate-pulse" />
        </div>
      )}

      {error && !loading && (
        <p className="text-sm text-danger">{error}</p>
      )}

      {reg && !loading && (
        <div className="space-y-4">
          {/* Tournament info */}
          <div className="p-3 rounded-[12px] bg-primary/5 space-y-2">
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-primary shrink-0" />
              <p className="text-sm font-bold text-text">{reg.tournaments.name}</p>
            </div>
            <div className="flex items-center gap-2 text-xs text-text-secondary">
              <Calendar className="w-3.5 h-3.5 shrink-0" />
              <span>{formatDateFull(new Date(reg.tournaments.date + 'T00:00'))}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-text-secondary">
              <Clock className="w-3.5 h-3.5 shrink-0" />
              <span>{formatTime(reg.tournaments.start_time)} – {formatTime(reg.tournaments.end_time)}</span>
            </div>
          </div>

          {/* Players */}
          <div className="space-y-2">
            <p className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wider">Joueurs</p>
            <PlayerRow name={reg.player1_name} license={reg.player1_license} />
            <PlayerRow
              name={reg.player2_name}
              license={reg.player2_license}
              external={reg.player2_is_external}
            />
          </div>

          {/* Status warning if already handled */}
          {alreadyHandled && (
            <div className="p-3 rounded-[12px] bg-warning/10 text-xs text-text">
              Cette inscription a déjà été traitée (statut : <Badge color="primary">{reg.status}</Badge>).
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button
              variant="ghost"
              className="flex-1 !text-danger"
              onClick={handleReject}
              loading={actionLoading === 'reject'}
              disabled={alreadyHandled || !!actionLoading}
            >
              <X className="w-4 h-4 mr-1.5" />
              Refuser
            </Button>
            <Button
              className="flex-1"
              onClick={handleValidate}
              loading={actionLoading === 'validate'}
              disabled={alreadyHandled || !!actionLoading}
            >
              <Check className="w-4 h-4 mr-1.5" />
              Valider
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}

function PlayerRow({ name, license, external }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-[12px] bg-bg">
      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
        <User className="w-4 h-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-text truncate">{name}</p>
        <div className="flex items-center gap-2 text-xs text-text-secondary mt-0.5">
          <span className="flex items-center gap-1">
            <Award className="w-3 h-3" />
            Licence {license}
          </span>
          {external && <Badge color="gray">Externe</Badge>}
        </div>
      </div>
    </div>
  )
}
