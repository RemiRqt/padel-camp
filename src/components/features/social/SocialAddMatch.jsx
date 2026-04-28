import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import { Search, Swords, X } from 'lucide-react'

function FreeTextPicker({ placeholder, value, onChange, results, onSelectMember, accent = 'primary' }) {
  const showSuggestions = value.length >= 2 && results.length > 0
  const ringClass = accent === 'danger' ? 'focus:ring-danger/30' : 'focus:ring-primary/30'
  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-tertiary" />
        <input
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full pl-8 pr-3 py-2 rounded-lg bg-white text-sm focus:outline-none focus:ring-2 ${ringClass}`}
        />
      </div>
      {showSuggestions && (
        <div className="absolute z-10 mt-1 left-0 right-0 bg-white border border-separator rounded-lg shadow-lg max-h-32 overflow-y-auto">
          {results.map((m) => (
            <button
              key={m.id}
              onClick={() => onSelectMember(m)}
              className="w-full text-left text-sm px-3 py-1.5 hover:bg-bg cursor-pointer truncate"
            >
              {m.display_name} <span className="text-[10px] text-text-tertiary">· membre</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function SocialAddMatch({
  isOpen, onClose, matchForm, setMatchForm,
  partnerSearch, setPartnerSearch, partnerResults,
  opp1Search, setOpp1Search, opp1Results,
  opp2Search, setOpp2Search, opp2Results,
  submitting, onSubmit,
}) {
  const updateSet = (idx, field, val) => {
    setMatchForm((prev) => {
      const sets = [...prev.sets]
      sets[idx] = { ...sets[idx], [field]: val }
      return { ...prev, sets }
    })
  }
  const removeSet = (idx) => {
    setMatchForm((prev) => {
      if (prev.sets.length <= 1) return prev
      return { ...prev, sets: prev.sets.filter((_, i) => i !== idx) }
    })
  }

  const partnerLabel = matchForm.partner?.display_name || partnerSearch
  const opp1Label = matchForm.opponent1?.display_name || opp1Search
  const opp2Label = matchForm.opponent2?.display_name || opp2Search

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Enregistrer un match">
      <div className="space-y-4">
        {/* My team */}
        <div>
          <p className="text-xs font-semibold text-text-secondary uppercase mb-2">Mon équipe</p>
          <div className="rounded-[12px] bg-bg p-3 space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-xs font-bold text-primary">Moi</span>
              </div>
              <span className="text-sm font-medium text-text">Moi</span>
            </div>
            {matchForm.partner ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-xs font-bold text-primary">{matchForm.partner.display_name.charAt(0)}</span>
                  </div>
                  <span className="text-sm font-medium">{matchForm.partner.display_name}</span>
                </div>
                <button onClick={() => setMatchForm((p) => ({ ...p, partner: null }))} className="text-xs text-danger cursor-pointer">Retirer</button>
              </div>
            ) : (
              <FreeTextPicker
                placeholder="Partenaire (optionnel) — nom libre ou membre"
                value={partnerSearch}
                onChange={setPartnerSearch}
                results={partnerResults}
                onSelectMember={(m) => { setMatchForm((p) => ({ ...p, partner: m })); setPartnerSearch('') }}
              />
            )}
          </div>
        </div>

        <div className="text-center text-xs font-bold text-text-tertiary">VS</div>

        {/* Opponents */}
        <div>
          <p className="text-xs font-semibold text-text-secondary uppercase mb-2">Adversaires</p>
          <div className="rounded-[12px] bg-bg p-3 space-y-2">
            {matchForm.opponent1 ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-danger/10 flex items-center justify-center">
                    <span className="text-xs font-bold text-danger">{matchForm.opponent1.display_name.charAt(0)}</span>
                  </div>
                  <span className="text-sm font-medium">{matchForm.opponent1.display_name}</span>
                </div>
                <button onClick={() => setMatchForm((p) => ({ ...p, opponent1: null }))} className="text-xs text-danger cursor-pointer">Retirer</button>
              </div>
            ) : (
              <FreeTextPicker
                placeholder="Adversaire 1 — nom libre ou membre"
                value={opp1Search}
                onChange={setOpp1Search}
                results={opp1Results}
                onSelectMember={(m) => { setMatchForm((p) => ({ ...p, opponent1: m })); setOpp1Search('') }}
                accent="danger"
              />
            )}
            {matchForm.opponent2 ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-danger/10 flex items-center justify-center">
                    <span className="text-xs font-bold text-danger">{matchForm.opponent2.display_name.charAt(0)}</span>
                  </div>
                  <span className="text-sm font-medium">{matchForm.opponent2.display_name}</span>
                </div>
                <button onClick={() => setMatchForm((p) => ({ ...p, opponent2: null }))} className="text-xs text-danger cursor-pointer">Retirer</button>
              </div>
            ) : (
              <FreeTextPicker
                placeholder="Adversaire 2 — nom libre ou membre"
                value={opp2Search}
                onChange={setOpp2Search}
                results={opp2Results}
                onSelectMember={(m) => { setMatchForm((p) => ({ ...p, opponent2: m })); setOpp2Search('') }}
                accent="danger"
              />
            )}
          </div>
        </div>

        {/* Score */}
        <div>
          <p className="text-xs font-semibold text-text-secondary uppercase mb-2">Score (sets)</p>
          <div className="space-y-2">
            {matchForm.sets.map((s, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-xs text-text-tertiary w-10">Set {i + 1}</span>
                <input
                  type="number" min="0" value={s.s1}
                  onChange={(e) => updateSet(i, 's1', e.target.value)}
                  className="w-14 px-2 py-2 rounded-lg bg-green-50 text-center text-sm font-bold text-green-700 focus:outline-none focus:ring-2 focus:ring-green-300"
                  placeholder="0"
                />
                <span className="text-xs text-text-tertiary">—</span>
                <input
                  type="number" min="0" value={s.s2}
                  onChange={(e) => updateSet(i, 's2', e.target.value)}
                  className="w-14 px-2 py-2 rounded-lg bg-red-50 text-center text-sm font-bold text-red-500 focus:outline-none focus:ring-2 focus:ring-red-300"
                  placeholder="0"
                />
                {matchForm.sets.length > 1 && (
                  <button
                    onClick={() => removeSet(i)}
                    className="ml-1 w-7 h-7 rounded-md hover:bg-danger/10 flex items-center justify-center text-text-tertiary hover:text-danger transition-colors cursor-pointer"
                    aria-label={`Supprimer set ${i + 1}`}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
            <button
              onClick={() => setMatchForm((p) => ({ ...p, sets: [...p.sets, { s1: '', s2: '' }] }))}
              className="text-xs text-primary font-medium cursor-pointer hover:underline"
            >
              + Ajouter un set
            </button>
          </div>
        </div>

        <Button className="w-full" loading={submitting} onClick={onSubmit}>
          <Swords className="w-4 h-4 mr-1" />Enregistrer le match
        </Button>
      </div>
    </Modal>
  )
}
