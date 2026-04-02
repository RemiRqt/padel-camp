import { Search, UserPlus } from 'lucide-react'

export default function BookingAddPlayer({
  searchQuery, setSearchQuery, searchResults, searching,
  submitting, onAssignMember, onAssignExternal,
}) {
  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
        <input
          type="text"
          placeholder="Rechercher un membre..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-3 rounded-[12px] bg-bg border border-separator text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          autoFocus
        />
      </div>

      {searching ? (
        <div className="py-4 text-center">
          <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      ) : searchResults.length > 0 ? (
        <div className="space-y-1 max-h-48 overflow-y-auto">
          {searchResults.map((member) => (
            <button
              key={member.id}
              onClick={() => onAssignMember(member)}
              disabled={submitting}
              className="w-full flex items-center gap-3 p-3 rounded-[12px] hover:bg-bg transition-colors text-left cursor-pointer"
            >
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <span className="text-sm font-bold text-primary">
                  {member.display_name.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text truncate">{member.display_name}</p>
                <p className="text-xs text-text-tertiary">
                  Solde: {(parseFloat(member.balance || 0) + parseFloat(member.balance_bonus || 0)).toFixed(2)}€
                </p>
              </div>
              <UserPlus className="w-4 h-4 text-primary shrink-0" />
            </button>
          ))}
        </div>
      ) : searchQuery.length >= 2 ? (
        <p className="text-sm text-text-tertiary text-center py-3">Aucun membre trouvé</p>
      ) : null}

      <div className="border-t border-separator pt-3">
        <button
          onClick={onAssignExternal}
          disabled={submitting}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-[12px] bg-bg hover:bg-primary/5 transition-colors text-sm font-medium text-primary cursor-pointer"
        >
          <UserPlus className="w-4 h-4" />Ajouter un joueur externe
        </button>
      </div>
    </div>
  )
}
