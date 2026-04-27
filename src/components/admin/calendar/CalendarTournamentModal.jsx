import Modal from '@/components/ui/Modal'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'

const LEVELS = ['P25', 'P50', 'P100', 'P250', 'P500', 'P1000', 'P2000']
const CATEGORIES = ['hommes', 'femmes', 'mixte']
const T_STATUSES = ['draft', 'open', 'full', 'closed', 'cancelled', 'completed']
const STATUS_LABELS = { draft: 'Brouillon', open: 'Ouvert', full: 'Complet', closed: 'Ferm\u00e9', cancelled: 'Annul\u00e9', completed: 'Termin\u00e9' }

export default function CalendarTournamentModal({ isOpen, onClose, form, setForm, editing, saving, onSave }) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={editing ? 'Modifier tournoi' : 'Nouveau tournoi'}>
      <div className="space-y-3 max-h-[65vh] overflow-y-auto">
        <Input label="Nom" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <Input label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <Input label="Date" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
        <div className="grid grid-cols-2 gap-2">
          <Input label="D\u00e9but" type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} />
          <Input label="Fin" type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-sm font-medium text-text mb-1.5">Niveau</label>
            <select value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })}
              className="w-full px-3 py-3 rounded-[12px] bg-white border border-separator text-sm">
              {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-text mb-1.5">Cat\u00e9gorie</label>
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="w-full px-3 py-3 rounded-[12px] bg-white border border-separator text-sm capitalize">
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <Input label="Max \u00e9quipes" type="number" min="2" value={form.max_teams} onChange={(e) => setForm({ ...form, max_teams: e.target.value })} />
        <Input label="Juge-Arbitre" value={form.judge_arbiter} onChange={(e) => setForm({ ...form, judge_arbiter: e.target.value })} placeholder="Nom du JA" />
        <Input label="Deadline inscriptions" type="datetime-local" value={form.registration_deadline} onChange={(e) => setForm({ ...form, registration_deadline: e.target.value })} />
        {editing && (
          <div>
            <label className="block text-sm font-medium text-text mb-1.5">Statut</label>
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}
              className="w-full px-3 py-3 rounded-[12px] bg-white border border-separator text-sm">
              {T_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
            </select>
          </div>
        )}
        <Button className="w-full" loading={saving} onClick={onSave}>{editing ? 'Enregistrer' : 'Cr\u00e9er'}</Button>
      </div>
    </Modal>
  )
}
