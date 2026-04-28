import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell, Trophy, UserPlus, Clock, ShieldCheck, CheckCheck } from 'lucide-react'
import { useNotifications } from '@/context/NotificationContext'
import { formatRelativeTime } from '@/utils/formatDate'
import PageWrapper from '@/components/layout/PageWrapper'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import AdminRegistrationReviewModal from '@/components/notifications/AdminRegistrationReviewModal'

const ICONS = {
  booking_invitation: UserPlus,
  tournament_partner_response: Trophy,
  tournament_admin_decision: Trophy,
  tournament_confirmation_required: Clock,
  tournament_admin_review_required: ShieldCheck,
}

const TYPE_LABELS = {
  booking_invitation: 'Invitation',
  tournament_partner_response: 'Partenaire',
  tournament_admin_decision: 'Décision',
  tournament_confirmation_required: 'Confirmation',
  tournament_admin_review_required: 'À valider',
}

export default function AdminNotifications() {
  const { notifications, unreadCount, loading, markAsRead, markAllAsRead, refresh } = useNotifications()
  const [reviewRegId, setReviewRegId] = useState(null)

  return (
    <PageWrapper title="Notifications">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-text-secondary">
          {unreadCount > 0
            ? `${unreadCount} non lue${unreadCount > 1 ? 's' : ''}`
            : 'Toutes les notifications sont lues'}
        </p>
        {unreadCount > 0 && (
          <Button size="sm" variant="ghost" onClick={markAllAsRead}>
            <CheckCheck className="w-4 h-4 mr-1.5" />
            Tout marquer lu
          </Button>
        )}
      </div>

      {loading && notifications.length === 0 ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 rounded-[16px] bg-white animate-pulse" />
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <Card>
          <div className="text-center py-10">
            <div className="w-12 h-12 rounded-full bg-bg mx-auto mb-3 flex items-center justify-center">
              <Bell className="w-5 h-5 text-text-tertiary" />
            </div>
            <p className="text-sm font-medium text-text">Aucune notification</p>
            <p className="text-xs text-text-secondary mt-1">
              Tu seras alerté ici dès qu'une inscription tournoi devra être validée.
            </p>
          </div>
        </Card>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => {
            const Icon = ICONS[n.type] || Bell
            const isUnread = !n.read_at
            const isReview = n.type === 'tournament_admin_review_required'
            const inner = (
              <Card
                className={`!p-4 transition-colors hover:bg-bg cursor-pointer ${
                  isUnread ? '!border-l-4 !border-l-primary' : ''
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-[10px] bg-primary/10 flex items-center justify-center shrink-0">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className="text-sm font-semibold text-text">{n.title}</p>
                      <span className="text-[10px] text-text-tertiary shrink-0 mt-0.5">
                        {formatRelativeTime(n.created_at)}
                      </span>
                    </div>
                    {n.body && (
                      <p className="text-sm text-text-secondary">{n.body}</p>
                    )}
                    <span className="inline-block mt-2 text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
                      {TYPE_LABELS[n.type] || n.type}
                    </span>
                  </div>
                  {isUnread && (
                    <span className="w-2 h-2 rounded-full bg-primary mt-2 shrink-0" />
                  )}
                </div>
              </Card>
            )
            const handleClick = () => { if (isUnread) markAsRead(n.id) }
            if (isReview) {
              const regId = n.metadata?.registration_id
              return (
                <div
                  key={n.id}
                  onClick={() => {
                    handleClick()
                    if (regId) setReviewRegId(regId)
                  }}
                >
                  {inner}
                </div>
              )
            }
            return n.link ? (
              <Link key={n.id} to={n.link} onClick={handleClick}>{inner}</Link>
            ) : (
              <div key={n.id} onClick={handleClick}>{inner}</div>
            )
          })}
        </div>
      )}

      <AdminRegistrationReviewModal
        registrationId={reviewRegId}
        isOpen={!!reviewRegId}
        onClose={() => setReviewRegId(null)}
        onResolved={refresh}
      />
    </PageWrapper>
  )
}
