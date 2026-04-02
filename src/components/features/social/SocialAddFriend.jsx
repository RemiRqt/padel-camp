import Modal from '@/components/ui/Modal'
import { Search, UserPlus } from 'lucide-react'

export default function SocialAddFriend({ isOpen, onClose, searchQ, setSearchQ, searching, searchResults, onAddFriend }) {
  return (
    <Modal isOpen={isOpen} onClose={() => { onClose(); setSearchQ('') }} title="Ajouter un ami">
      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
          <input
            type="text" placeholder="Rechercher un membre..."
            value={searchQ} onChange={(e) => setSearchQ(e.target.value)}
            className="w-full pl-10 pr-4 py-3 rounded-[12px] bg-bg border border-separator text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            autoFocus
          />
        </div>
        {searching ? (
          <div className="py-4 text-center"><div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" /></div>
        ) : searchResults.length > 0 ? (
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {searchResults.map((m) => (
              <button key={m.id} onClick={() => onAddFriend(m)}
                className="w-full flex items-center gap-3 p-3 rounded-[12px] hover:bg-bg transition-colors text-left cursor-pointer">
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-sm font-bold text-primary">{m.display_name.charAt(0).toUpperCase()}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text truncate">{m.display_name}</p>
                  <p className="text-xs text-text-tertiary truncate">{m.email}</p>
                </div>
                <UserPlus className="w-4 h-4 text-primary shrink-0" />
              </button>
            ))}
          </div>
        ) : searchQ.length >= 2 ? (
          <p className="text-sm text-text-tertiary text-center py-3">Aucun membre trouvé</p>
        ) : null}
      </div>
    </Modal>
  )
}
