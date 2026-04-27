import Modal from '@/components/ui/Modal'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'

export default function CalendarEventModal({ isOpen, onClose, form, setForm, editing, saving, onSave }) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={editing ? 'Modifier \u00e9v\u00e9nement' : 'Nouvel \u00e9v\u00e9nement'}>
      <div className="space-y-4">
        <Input label="Nom" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <Input label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <Input label="Date" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
        <div className="grid grid-cols-2 gap-2">
          <Input label="D\u00e9but" type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} />
          <Input label="Fin" type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} />
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={form.is_public} onChange={(e) => setForm({ ...form, is_public: e.target.checked })} className="w-4 h-4 rounded text-primary" />
          <span className="text-sm font-medium text-text">Visible publiquement</span>
        </label>
        <Button className="w-full" loading={saving} onClick={onSave}>{editing ? 'Enregistrer' : 'Cr\u00e9er'}</Button>
      </div>
    </Modal>
  )
}
