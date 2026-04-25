import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

// Resets scroll to top on every navigation. React Router does not do this
// by default for SPAs, so users land mid-page after a route change.
export default function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  }, [pathname])
  return null
}
