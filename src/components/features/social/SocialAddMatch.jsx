import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import { Search, Swords } from 'lucide-react'

function MemberPicker({ placeholder, search, setSearch, results, onSelect }) {
  return (
    <div>
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-tertiary" />
        <input
          type="text" placeholder={placeholder}
          value={search} onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-8 pr-3 py-2 rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      </div>
      {results.length > 0 && (
        <div className="mt-1 space-y-0.5 max-h-28 overflow-y-auto">
          {results.map((m) => (
            <button key={m.id} onClick={() => onSelect(m)}
              className="w-full text-left text-sm p-1.5 rounded-lg hover:bg-white cursor-pointer truncate">
              {m.display_name}
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
              <MemberPicker
                placeholder="Partenaire (optionnel)"
                search={partnerSearch}
                setSearch={setPartnerSearch}
                results={partnerResults}
                onSelect={(m) => { setMatchForm((p) => ({ ...p, partner: m })); setPartnerSearch('') }}
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
              <MemberPicker
                placeholder="Adversaire 1"
                search={opp1Search}
                setSearch={setOpp1Search}
                results={opp1Results}
                onSelect={(m) => { setMatchForm((p) => ({ ...p, opponent1: m })); setOpp1Search('') }}
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
              <MemberPicker
                placeholder="Adversaire 2"
                search={opp2Search}
                setSearch={setOpp2Search}
                results={opp2Results}
                onSelect={(m) => { setMatchForm((p) => ({ ...p, opponent2: m })); setOpp2Search('') }}
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
                  type="number" min="0" max="7" value={s.s1}
                  onChange={(e) => updateSet(i, 's1', e.target.value)}
                  className="w-14 px-2 py-2 rounded-lg bg-green-50 text-center text-sm font-bold text-green-700 focus:outline-none focus:ring-2 focus:ring-green-300"
                  placeholder="0"
                />
                <span className="text-xs text-text-tertiary">—</span>
                <input
                  type="number" min="0" max="7" value={s.s2}
                  onChange={(e) => updateSet(i, 's2', e.target.value)}
                  className="w-14 px-2 py-2 rounded-lg bg-red-50 text-center text-sm font-bold text-red-500 focus:outline-none focus:ring-2 focus:ring-red-300"
                  placeholder="0"
                />
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
