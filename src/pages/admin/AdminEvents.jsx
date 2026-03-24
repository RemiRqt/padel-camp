import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import PageWrapper from '@/components/layout/PageWrapper'
import Card from '@/components/ui/Card'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import ExportButtons from '@/components/ui/ExportButtons'
import { exportExcel, exportPDF } from '@/utils/export'
import { monthTiny, dayNum } from '@/utils/formatDate'
import toast from 'react-hot-toast'
import { Calendar, Plus, Pencil, Trash2 } from 'lucide-react'

export default function AdminEvents() {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ name: '', description: '', date: '', start_time: '', end_time: '', is_public: true })
  const [saving, setSaving] = useState(false)

  const fetchAll = async () => {
    setLoading(true)
    const { data } = await supabase.from('events').select('*').order('date', { ascending: false })
    setEvents(data || [])
    setLoading(false)
  }

  useEffect(() => { fetchAll() }, [])

  const openCreate = () => {
    setEditing(null)
    setForm({ name: '', description: '', date: '', start_time: '', end_time: '', is_public: true })
    setModalOpen(true)
  }

  const openEdit = (e) => {
    setEditing(e)
    setForm({
      name: e.name, description: e.description || '', date: e.date,
      start_time: e.start_time?.slice(0, 5) || '', end_time: e.end_time?.slice(0, 5) || '',
      is_public: e.is_public,
    })
    setModalOpen(true)
  }

  const handleSave = async () => {
    if (!form.name || !form.date) { toast.error('Nom et date requis'); return }
    setSaving(true)
    try {
      const data = {
        name: form.name, description: form.description || null, date: form.date,
        start_time: form.start_time || null, end_time: form.end_time || null, is_public: form.is_public,
      }
      if (editing) {
        const { error } = await supabase.from('events').update(data).eq('id', editing.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('events').insert(data)
        if (error) throw error
      }
      toast.success(editing ? 'Événement mis à jour' : 'Événement créé')
      setModalOpen(false)
      fetchAll()
    } catch (err) { toast.error(err.message) }
    finally { setSaving(false) }
  }

  const handleDelete = async (e) => {
    if (!confirm(`Supprimer "${e.name}" ?`)) return
    const { error } = await supabase.from('events').delete().eq('id', e.id)
    if (error) toast.error(error.message)
    else { toast.success('Supprimé'); fetchAll() }
  }

  const exportCols = [
    { key: 'name', label: 'Événement' },
    { key: 'date', label: 'Date' },
    { key: 'description', label: 'Description' },
    { key: 'public', label: 'Public' },
  ]
  const exportRows = events.map((e) => ({
    name: e.name,
    date: new Date(e.date + 'T00:00').toLocaleDateString('fr-FR'),
    description: e.description || '',
    public: e.is_public ? 'Oui' : 'Non',
  }))

  return (
    <PageWrapper>
      <div className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            <h1 className="text-2xl font-bold text-text">Événements</h1>
            <Badge color="primary">{events.length}</Badge>
          </div>
          <div className="flex items-center gap-2">
            <ExportButtons
              onExcel={() => exportExcel(exportRows, exportCols, 'evenements')}
              onPDF={() => exportPDF(exportRows, exportCols, 'evenements', 'Padel Camp — Événements')}
            />
            <Button size="sm" onClick={openCreate}>
              <Plus className="w-4 h-4 mr-1" />Créer
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-16 rounded-[16px] bg-white animate-pulse" />)}</div>
        ) : events.length === 0 ? (
          <Card className="text-center !py-8">
            <Calendar className="w-8 h-8 text-text-tertiary mx-auto mb-2" />
            <p className="text-sm text-text-tertiary">Aucun événement</p>
          </Card>
        ) : (
          <div className="space-y-2">
            {events.map((e) => (
              <Card key={e.id} className="!p-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-[10px] bg-lime/20 flex flex-col items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-primary leading-none">{dayNum(e.date + 'T00:00')}</span>
                    <span className="text-[9px] text-primary/70 uppercase">{monthTiny(e.date + 'T00:00')}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-text truncate">{e.name}</p>
                    {e.description && <p className="text-xs text-text-secondary truncate">{e.description}</p>}
                  </div>
                  <Badge color={e.is_public ? 'success' : 'gray'}>{e.is_public ? 'Public' : 'Privé'}</Badge>
                  <button onClick={() => openEdit(e)} className="p-1.5 rounded-lg hover:bg-bg cursor-pointer">
                    <Pencil className="w-3.5 h-3.5 text-text-secondary" />
                  </button>
                  <button onClick={() => handleDelete(e)} className="p-1.5 rounded-lg hover:bg-danger/10 cursor-pointer">
                    <Trash2 className="w-3.5 h-3.5 text-danger" />
                  </button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Modifier événement' : 'Nouvel événement'}>
        <div className="space-y-4">
          <Input label="Nom" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <Input label="Date" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          <div className="grid grid-cols-2 gap-2">
            <Input label="Début" type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} />
            <Input label="Fin" type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.is_public} onChange={(e) => setForm({ ...form, is_public: e.target.checked })}
              className="w-4 h-4 rounded text-primary" />
            <span className="text-sm font-medium text-text">Visible publiquement</span>
          </label>
          <Button className="w-full" loading={saving} onClick={handleSave}>{editing ? 'Enregistrer' : 'Créer'}</Button>
        </div>
      </Modal>
    </PageWrapper>
  )
}
