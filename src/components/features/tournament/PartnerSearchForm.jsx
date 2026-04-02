import Input from '@/components/ui/Input'
import Badge from '@/components/ui/Badge'
import { Search, Users, UserPlus, Check, AlertTriangle, Award } from 'lucide-react'

export default function PartnerSearchForm({
  partnerMode, setPartnerMode,
  searchQuery, setSearchQuery, searchResults, searching,
  selectedPartner, setSelectedPartner,
  externalName, setExternalName, externalLicense, setExternalLicense,
}) {
  return (
    <>
      {/* Toggle mode */}
      <div className="flex rounded-[12px] bg-bg p-1 mb-4">
        <button
          onClick={() => { setPartnerMode('member'); setSelectedPartner(null) }}
          className={`flex-1 py-2 rounded-[10px] text-sm font-medium transition-all cursor-pointer ${
            partnerMode === 'member' ? 'bg-primary text-white' : 'text-text-secondary'
          }`}
        >
          <Users className="w-4 h-4 inline mr-1" />
          Membre du club
        </button>
        <button
          onClick={() => { setPartnerMode('external'); setSelectedPartner(null); setSearchQuery('') }}
          className={`flex-1 py-2 rounded-[10px] text-sm font-medium transition-all cursor-pointer ${
            partnerMode === 'external' ? 'bg-primary text-white' : 'text-text-secondary'
          }`}
        >
          <UserPlus className="w-4 h-4 inline mr-1" />
          Joueur externe
        </button>
      </div>

      {partnerMode === 'member' ? (
        <>
          {selectedPartner ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-[12px] bg-primary/5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="font-bold text-primary">
                      {selectedPartner.display_name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{selectedPartner.display_name}</p>
                    <p className="text-xs text-text-secondary">{selectedPartner.email}</p>
                  </div>
                </div>
                <button
                  onClick={() => { setSelectedPartner(null); setSearchQuery('') }}
                  className="text-xs text-danger font-medium cursor-pointer"
                >
                  Changer
                </button>
              </div>

              {/* License check */}
              <div className="rounded-[12px] bg-bg p-3">
                <div className="flex justify-between">
                  <span className="text-xs text-text-secondary">Licence FFT</span>
                  {selectedPartner.license_number ? (
                    <span className="text-sm font-medium flex items-center gap-1 text-success">
                      <Check className="w-3.5 h-3.5" />
                      {selectedPartner.license_number}
                    </span>
                  ) : (
                    <span className="text-sm text-danger flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Non renseignée
                    </span>
                  )}
                </div>
              </div>

              {!selectedPartner.license_number && (
                <div className="rounded-[12px] bg-danger/5 border border-danger/20 p-3">
                  <p className="text-xs text-danger">
                    Ce membre n'a pas renseigné sa licence FFT. Il/elle doit la compléter dans son profil avant l'inscription.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
                <input
                  type="text"
                  placeholder="Rechercher un membre du club..."
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
                <div className="mt-2 space-y-1 max-h-52 overflow-y-auto">
                  {searchResults.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setSelectedPartner(m)}
                      className="w-full flex items-center gap-3 p-3 rounded-[12px] hover:bg-bg transition-colors text-left cursor-pointer"
                    >
                      <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="text-sm font-bold text-primary">
                          {m.display_name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-text truncate">{m.display_name}</p>
                        <p className="text-xs text-text-tertiary truncate">{m.email}</p>
                      </div>
                      {m.license_number ? (
                        <Badge color="success"><Award className="w-3 h-3 mr-0.5 inline" />FFT</Badge>
                      ) : (
                        <Badge color="gray">Pas de licence</Badge>
                      )}
                    </button>
                  ))}
                </div>
              ) : searchQuery.length >= 2 ? (
                <p className="text-sm text-text-tertiary text-center py-4">Aucun membre trouvé</p>
              ) : (
                <p className="text-xs text-text-tertiary text-center py-3">
                  Tapez au moins 2 caractères pour rechercher
                </p>
              )}
            </>
          )}
        </>
      ) : (
        /* External partner form */
        <div className="space-y-3">
          <Input
            label="Nom complet"
            placeholder="Jean Dupont"
            value={externalName}
            onChange={(e) => setExternalName(e.target.value)}
            required
          />
          <div>
            <Input
              label="N° Licence FFT"
              placeholder="1234567"
              value={externalLicense}
              onChange={(e) => setExternalLicense(e.target.value)}
              required
            />
            <p className="text-[10px] text-text-tertiary mt-1">
              La licence est obligatoire pour les tournois homologués
            </p>
          </div>
        </div>
      )}
    </>
  )
}
