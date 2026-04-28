import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Bell, Trophy, UserPlus, Clock, ShieldCheck } from 'lucide-react'
import { useNotifications } from '@/context/NotificationContext'
import { formatRelativeTime } from '@/utils/formatDate'
import AdminRegistrationReviewModal from '@/components/notifications/AdminRegistrationReviewModal'

const ICONS = {
  booking_invitation: UserPlus,
  tournament_partner_response: Trophy,
  tournament_admin_decision: Trophy,
  tournament_confirmation_required: Clock,
  tournament_admin_review_required: ShieldCheck,
}

export default function NotificationBell({ align = 'right' }) {
  const { notifications, unreadCount, markAsRead, markAllAsRead, refresh } = useNotifications()
  const [open, setOpen] = useState(false)
  const [reviewRegId, setReviewRegId] = useState(null)
  const ref = useRef(null)

  useEffect(() => {
    function onClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open])

  const handleToggle = () => {
    setOpen((prev) => {
      const next = !prev
      if (next && unreadCount > 0) markAllAsRead()
      return next
    })
  }

  const handleItemClick = (id) => {
    markAsRead(id)
    setOpen(false)
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={handleToggle}
        className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-bg transition-colors cursor-pointer relative"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5 text-text" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-danger text-white text-[10px] font-bold flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className={`absolute top-12 w-[320px] max-w-[calc(100vw-1rem)] max-h-[70vh] bg-white rounded-[16px] shadow-[0_8px_32px_rgba(0,0,0,0.12)] border border-separator overflow-hidden z-[60] flex flex-col ${align === 'left' ? 'left-0' : 'right-0'}`}>
          <div className="px-4 py-3 border-b border-separator flex items-center justify-between">
            <p className="text-sm font-semibold text-text">Notifications</p>
            {notifications.some((n) => !n.read_at) && (
              <button onClick={markAllAsRead} className="text-xs text-primary hover:underline cursor-pointer">
                Tout marquer lu
              </button>
            )}
          </div>
          <div className="overflow-y-auto flex-1">
            {notifications.length === 0 ? (
              <p className="text-sm text-text-tertiary text-center py-8">Aucune notification</p>
            ) : (
              notifications.map((n) => {
                const Icon = ICONS[n.type] || Bell
                const isUnread = !n.read_at
                const isReview = n.type === 'tournament_admin_review_required'
                const inner = (
                  <div className={`flex items-start gap-3 px-4 py-3 hover:bg-bg cursor-pointer border-b border-separator last:border-0 ${isUnread ? 'bg-primary/[0.03]' : ''}`}>
                    <div className="w-8 h-8 rounded-[8px] bg-primary/10 flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-text">{n.title}</p>
                      {n.body && <p className="text-xs text-text-secondary mt-0.5 line-clamp-2">{n.body}</p>}
                      <p className="text-[10px] text-text-tertiary mt-1">{formatRelativeTime(n.created_at)}</p>
                    </div>
                    {isUnread && <span className="w-2 h-2 rounded-full bg-primary mt-2 shrink-0" />}
                  </div>
                )
                if (isReview) {
                  const regId = n.metadata?.registration_id
                  return (
                    <div
                      key={n.id}
                      onClick={() => {
                        markAsRead(n.id)
                        setOpen(false)
                        if (regId) setReviewRegId(regId)
                      }}
                    >
                      {inner}
                    </div>
                  )
                }
                return n.link ? (
                  <Link key={n.id} to={n.link} onClick={() => handleItemClick(n.id)}>
                    {inner}
                  </Link>
                ) : (
                  <div key={n.id} onClick={() => handleItemClick(n.id)}>{inner}</div>
                )
              })
            )}
          </div>
        </div>
      )}

      <AdminRegistrationReviewModal
        registrationId={reviewRegId}
        isOpen={!!reviewRegId}
        onClose={() => setReviewRegId(null)}
        onResolved={refresh}
      />
    </div>
  )
}
