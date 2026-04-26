// Centralised query keys. Importing from one place avoids typos when
// invalidating from mutations (e.g. queryClient.invalidateQueries({ queryKey: qk.bookings.all }))
export const qk = {
  club: ['club'],
  bookings: {
    all: ['bookings'],
    byDate: (date) => ['bookings', 'byDate', date],
    user: (userId) => ['bookings', 'user', userId],
  },
}
