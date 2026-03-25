import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useClub } from '@/hooks/useClub'
import PageWrapper from '@/components/layout/PageWrapper'
import Card from '@/components/ui/Card'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import ExportButtons from '@/components/ui/ExportButtons'
import { exportExcel, exportPDF } from '@/utils/export'
import { formatTime } from '@/utils/formatDate'
import toast from 'react-hot-toast'
import {
  Settings, Save, Plus, Pencil, Trash2, Clock, Euro, MapPin
} from 'lucide-react'

const DAY_NAMES = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

export default function AdminSettings() {
  const { config: initialConfig, pricingRules: initialRules, loading: clubLoading } = useClub()
  const [config, setConfig] = useState(null)
  const [pricingRules, setPricingRules] = useState([])
  const [saving, setSaving] = useState(false)

  // Pricing modal
  const [priceModal, setPriceModal] = useState(false)
  const [editingRule, setEditingRule] = useState(null)
  const [ruleForm, setRuleForm] = useState({ label: '', start_time: '', end_time: '', days: [], price_per_slot: '' })
  const [ruleSaving, setRuleSaving] = useState(false)

  useEffect(() => {
    if (initialConfig) setConfig({ ...initialConfig })
    if (initialRules) setPricingRules([...initialRules])
  }, [initialConfig, initialRules])

  const handleSaveConfig = async () => {
    if (!config) return
    setSaving(true)
    try {
      const { error } = await supabase
        .from('club_config')
        .update({
          name: config.name,
          address: config.address,
          phone: config.phone,
          description: config.description,
          instagram_url: config.instagram_url,
          courts_count: config.courts_count,
          court_names: config.court_names,
          slot_duration: config.slot_duration,
          open_time: config.open_time,
          close_time: config.close_time,
          open_days: config.open_days,
        })
        .eq('id', config.id)
      if (error) throw error
      toast.success('Configuration sauvegardée')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  const updateConfig = (key, value) => {
    setConfig((prev) => ({ ...prev, [key]: value }))
  }

  const toggleDay = (dayIndex) => {
    setConfig((prev) => {
      const days = prev.open_days.includes(dayIndex)
        ? prev.open_days.filter((d) => d !== dayIndex)
        : [...prev.open_days, dayIndex].sort()
      return { ...prev, open_days: days }
    })
  }

  const updateCourtName = (index, name) => {
    setConfig((prev) => {
      const names = [...prev.court_names]
      names[index] = name
      return { ...prev, court_names: names }
    })
  }

  // Pricing CRUD
  const openCreateRule = () => {
    setEditingRule(null)
    setRuleForm({ label: '', start_time: '09:30', end_time: '12:00', days: [0, 1, 2, 3, 4], price_per_slot: '' })
    setPriceModal(true)
  }

  const openEditRule = (rule) => {
    setEditingRule(rule)
    setRuleForm({
      label: rule.label,
      start_time: rule.start_time.slice(0, 5),
      end_time: rule.end_time.slice(0, 5),
      days: [...rule.days],
      price_per_slot: rule.price_per_slot.toString(),
    })
    setPriceModal(true)
  }

  const toggleRuleDay = (dayIndex) => {
    setRuleForm((prev) => ({
      ...prev,
      days: prev.days.includes(dayIndex)
        ? prev.days.filter((d) => d !== dayIndex)
        : [...prev.days, dayIndex].sort(),
    }))
  }

  const saveRule = async () => {
    if (!ruleForm.label || !ruleForm.price_per_slot || ruleForm.days.length === 0) {
      toast.error('Champs requis : label, prix, jours')
      return
    }
    setRuleSaving(true)
    try {
      const data = {
        label: ruleForm.label,
        start_time: ruleForm.start_time,
        end_time: ruleForm.end_time,
        days: ruleForm.days,
        price_per_slot: parseFloat(ruleForm.price_per_slot),
      }
      if (editingRule) {
        const { error } = await supabase.from('pricing_rules').update(data).eq('id', editingRule.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('pricing_rules').insert(data)
        if (error) throw error
      }
      toast.success(editingRule ? 'Tarif mis à jour' : 'Tarif créé')
      setPriceModal(false)
      const { data: refreshed } = await supabase.from('pricing_rules').select('*').eq('is_active', true).order('start_time')
      setPricingRules(refreshed || [])
    } catch (err) { toast.error(err.message) }
    finally { setRuleSaving(false) }
  }

  const deleteRule = async (rule) => {
    if (!confirm(`Supprimer le tarif "${rule.label}" ?`)) return
    const { error } = await supabase.from('pricing_rules').delete().eq('id', rule.id)
    if (error) toast.error(error.message)
    else {
      toast.success('Supprimé')
      setPricingRules((prev) => prev.filter((r) => r.id !== rule.id))
    }
  }

  const exportCols = [
    { key: 'label', label: 'Tarif' },
    { key: 'days', label: 'Jours' },
    { key: 'hours', label: 'Horaires' },
    { key: 'price', label: 'Prix/créneau' },
  ]
  const exportRows = pricingRules.map((r) => ({
    label: r.label,
    days: r.days.map((d) => DAY_NAMES[d]).join(', '),
    hours: `${formatTime(r.start_time)} – ${formatTime(r.end_time)}`,
    price: parseFloat(r.price_per_slot).toFixed(2) + '€',
  }))

  if (clubLoading || !config) {
    return (
      <PageWrapper wide title="Paramètres">
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-24 rounded-[16px] bg-white animate-pulse" />)}
        </div>
      </PageWrapper>
    )
  }

  return (
    <PageWrapper wide>
      <div className="space-y-5">
        <div className="flex items-center gap-2">
          <Settings className="w-5 h-5 text-primary" />
          <h1 className="text-2xl font-bold text-text">Paramètres</h1>
        </div>

        {/* Club info */}
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <MapPin className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-text">Informations du club</h3>
          </div>
          <div className="space-y-3">
            <Input label="Nom" value={config.name} onChange={(e) => updateConfig('name', e.target.value)} />
            <Input label="Adresse" value={config.address} onChange={(e) => updateConfig('address', e.target.value)} />
            <Input label="Téléphone" value={config.phone} onChange={(e) => updateConfig('phone', e.target.value)} />
            <Input label="Description" value={config.description || ''} onChange={(e) => updateConfig('description', e.target.value)} />
            <Input label="Instagram URL" value={config.instagram_url || ''} onChange={(e) => updateConfig('instagram_url', e.target.value)} />
          </div>
        </Card>

        {/* Courts */}
        <Card>
          <h3 className="font-semibold text-text mb-4">Terrains ({config.courts_count})</h3>
          <div className="space-y-2">
            {(config.court_names || []).map((name, i) => (
              <Input
                key={i}
                label={`Terrain ${i + 1}`}
                value={name}
                onChange={(e) => updateCourtName(i, e.target.value)}
              />
            ))}
          </div>
        </Card>

        {/* Horaires */}
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-text">Horaires</h3>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <Input label="Ouverture" type="time" value={config.open_time?.slice(0, 5)} onChange={(e) => updateConfig('open_time', e.target.value)} />
            <Input label="Fermeture" type="time" value={config.close_time?.slice(0, 5)} onChange={(e) => updateConfig('close_time', e.target.value)} />
          </div>
          <Input label="Durée créneau (min)" type="number" value={config.slot_duration} onChange={(e) => updateConfig('slot_duration', parseInt(e.target.value) || 90)} />
          <div className="mt-4">
            <p className="text-sm font-medium text-text mb-2">Jours d'ouverture</p>
            <div className="flex gap-1.5">
              {DAY_NAMES.map((name, i) => (
                <button
                  key={i}
                  onClick={() => toggleDay(i)}
                  className={`w-10 h-10 rounded-[10px] text-xs font-semibold transition-colors cursor-pointer ${
                    config.open_days?.includes(i)
                      ? 'bg-primary text-white'
                      : 'bg-bg text-text-secondary'
                  }`}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>
        </Card>

        {/* Save config */}
        <Button className="w-full" loading={saving} onClick={handleSaveConfig}>
          <Save className="w-4 h-4 mr-1" />
          Sauvegarder la configuration
        </Button>

        {/* Pricing rules */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Euro className="w-4 h-4 text-primary" />
              <h3 className="font-semibold text-text">Tarifs</h3>
            </div>
            <div className="flex items-center gap-2">
              <ExportButtons
                onExcel={() => exportExcel(exportRows, exportCols, 'tarifs')}
                onPDF={() => exportPDF(exportRows, exportCols, 'tarifs', 'Padel Camp — Tarifs')}
              />
              <Button size="sm" onClick={openCreateRule}>
                <Plus className="w-4 h-4 mr-1" />Ajouter
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            {pricingRules.map((rule) => (
              <div key={rule.id} className="flex items-center justify-between p-3 rounded-[12px] bg-bg">
                <div>
                  <p className="text-sm font-semibold text-text">{rule.label}</p>
                  <p className="text-xs text-text-secondary">
                    {rule.days.map((d) => DAY_NAMES[d]).join(', ')} · {formatTime(rule.start_time)} – {formatTime(rule.end_time)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold text-primary">{parseFloat(rule.price_per_slot).toFixed(0)}€</span>
                  <button onClick={() => openEditRule(rule)} className="p-1.5 rounded-lg hover:bg-white cursor-pointer">
                    <Pencil className="w-3.5 h-3.5 text-text-secondary" />
                  </button>
                  <button onClick={() => deleteRule(rule)} className="p-1.5 rounded-lg hover:bg-danger/10 cursor-pointer">
                    <Trash2 className="w-3.5 h-3.5 text-danger" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Pricing modal */}
      <Modal isOpen={priceModal} onClose={() => setPriceModal(false)} title={editingRule ? 'Modifier tarif' : 'Nouveau tarif'}>
        <div className="space-y-4">
          <Input label="Label" value={ruleForm.label} onChange={(e) => setRuleForm({ ...ruleForm, label: e.target.value })} placeholder="Heure creuse, Premium..." />
          <div className="grid grid-cols-2 gap-3">
            <Input label="De" type="time" value={ruleForm.start_time} onChange={(e) => setRuleForm({ ...ruleForm, start_time: e.target.value })} />
            <Input label="À" type="time" value={ruleForm.end_time} onChange={(e) => setRuleForm({ ...ruleForm, end_time: e.target.value })} />
          </div>
          <div>
            <p className="text-sm font-medium text-text mb-2">Jours</p>
            <div className="flex gap-1.5">
              {DAY_NAMES.map((name, i) => (
                <button
                  key={i}
                  onClick={() => toggleRuleDay(i)}
                  className={`w-10 h-10 rounded-[10px] text-xs font-semibold transition-colors cursor-pointer ${
                    ruleForm.days.includes(i) ? 'bg-primary text-white' : 'bg-bg text-text-secondary'
                  }`}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>
          <Input label="Prix / créneau (€)" type="number" min="0" step="1" value={ruleForm.price_per_slot} onChange={(e) => setRuleForm({ ...ruleForm, price_per_slot: e.target.value })} />
          <Button className="w-full" loading={ruleSaving} onClick={saveRule}>
            {editingRule ? 'Enregistrer' : 'Créer'}
          </Button>
        </div>
      </Modal>
    </PageWrapper>
  )
}
