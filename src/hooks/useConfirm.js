import { useState, useCallback, useRef } from 'react'

/**
 * Hook for confirm modals.
 * Usage:
 *   const { confirmProps, askConfirm } = useConfirm()
 *   askConfirm({ title: '...', message: '...', onConfirm: async () => { ... } })
 *   <ConfirmModal {...confirmProps} />
 */
export default function useConfirm() {
  const [state, setState] = useState({ isOpen: false, title: '', message: '', confirmLabel: 'Confirmer', variant: 'danger', loading: false })
  const onConfirmRef = useRef(null)

  const askConfirm = useCallback(({ title, message = '', confirmLabel = 'Confirmer', variant = 'danger', onConfirm }) => {
    onConfirmRef.current = onConfirm
    setState({ isOpen: true, title, message, confirmLabel, variant, loading: false })
  }, [])

  const handleConfirm = useCallback(async () => {
    if (!onConfirmRef.current) return
    setState((s) => ({ ...s, loading: true }))
    try {
      await onConfirmRef.current()
    } finally {
      setState((s) => ({ ...s, isOpen: false, loading: false }))
    }
  }, [])

  const handleClose = useCallback(() => {
    setState((s) => {
      if (s.loading) return s
      return { ...s, isOpen: false }
    })
  }, [])

  return {
    askConfirm,
    confirmProps: {
      isOpen: state.isOpen,
      onClose: handleClose,
      onConfirm: handleConfirm,
      title: state.title,
      message: state.message,
      confirmLabel: state.confirmLabel,
      variant: state.variant,
      loading: state.loading,
    },
  }
}
