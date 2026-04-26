import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { getMyInvitations, acceptInvitation, declineInvitation } from '@/services/bookingService'
import { qk } from '@/lib/queryKeys'

export function useInvitations(userId) {
  const queryClient = useQueryClient()
  const queryKey = qk.invitations(userId)

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => getMyInvitations(userId),
    enabled: !!userId,
  })

  // Optimistic remove: pull the invitation out of the list before the mutation
  // resolves, snapshot the previous list so we can restore on error.
  const optimisticRemove = async (playerId) => {
    await queryClient.cancelQueries({ queryKey })
    const previous = queryClient.getQueryData(queryKey)
    queryClient.setQueryData(queryKey, (old) => (old || []).filter((i) => i.id !== playerId))
    return { previous }
  }

  const restoreOnError = (context) => {
    if (context?.previous) queryClient.setQueryData(queryKey, context.previous)
  }

  const accept = useMutation({
    mutationFn: ({ invitation, paymentMethod }) =>
      acceptInvitation({ playerId: invitation.id, paymentMethod, userId }),
    onMutate: ({ invitation }) => optimisticRemove(invitation.id),
    onError: (err, _vars, context) => {
      restoreOnError(context)
      toast.error(err.message)
    },
    onSuccess: (_data, { paymentMethod }) => {
      toast.success(paymentMethod === 'balance' ? 'Invitation acceptée et payée !' : 'Invitation acceptée !')
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey })
      queryClient.invalidateQueries({ queryKey: qk.bookings.user(userId) })
    },
  })

  const decline = useMutation({
    mutationFn: (invitation) => declineInvitation(invitation.id, userId),
    onMutate: (invitation) => optimisticRemove(invitation.id),
    onError: (err, _vars, context) => {
      restoreOnError(context)
      toast.error(err.message)
    },
    onSuccess: () => toast.success('Invitation refusée'),
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  })

  return {
    invitations: data || [],
    loading: isLoading,
    accept,
    decline,
  }
}
