import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/context/AuthContext'
import {
  fetchNotifications,
  markAsRead as svcMarkAsRead,
  markAllAsRead as svcMarkAllAsRead,
  subscribeToNotifications,
} from '@/services/notificationService'

export function useNotifications() {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const data = await fetchNotifications(user.id)
      setNotifications(data)
    } catch (err) {
      console.error('Failed to load notifications', err)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (!user) {
      setNotifications([])
      return
    }
    refresh()
    const unsub = subscribeToNotifications(user.id, (n) => {
      setNotifications((prev) => {
        if (prev.some((p) => p.id === n.id)) return prev
        return [n, ...prev].slice(0, 30)
      })
    })
    return unsub
  }, [user, refresh])

  const markAsRead = useCallback(async (id) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n))
    )
    try { await svcMarkAsRead(id) } catch (err) { console.error(err) }
  }, [])

  const markAllAsRead = useCallback(async () => {
    if (!user) return
    const now = new Date().toISOString()
    setNotifications((prev) => prev.map((n) => (n.read_at ? n : { ...n, read_at: now })))
    try { await svcMarkAllAsRead(user.id) } catch (err) { console.error(err) }
  }, [user])

  const unreadCount = notifications.filter((n) => !n.read_at).length

  return { notifications, unreadCount, loading, refresh, markAsRead, markAllAsRead }
}
