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
import toast from 'react-hot-toast'
import { Package, Plus, Pencil, Trash2, FolderOpen } from 'lucide-react'

export default function AdminProducts() {
  const [categories, setCategories] = useState([])
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState(null) // category id or null=all

  // Category modal
  const [catModalOpen, setCatModalOpen] = useState(false)
  const [editingCat, setEditingCat] = useState(null)
  const [catName, setCatName] = useState('')

  // Product modal
  const [prodModalOpen, setProdModalOpen] = useState(false)
  const [editingProd, setEditingProd] = useState(null)
  const [prodForm, setProdForm] = useState({ name: '', price: '', category_id: '', description: '' })
  const [saving, setSaving] = useState(false)

  const fetchAll = async () => {
    setLoading(true)
    const [cRes, pRes] = await Promise.all([
      supabase.from('product_categories').select('*').order('sort_order'),
      supabase.from('products').select('*, category:product_categories(name)').order('name'),
    ])
    setCategories(cRes.data || [])
    setProducts(pRes.data || [])
    setLoading(false)
  }

  useEffect(() => { fetchAll() }, [])

  const filteredProducts = activeTab
    ? products.filter((p) => p.category_id === activeTab)
    : products

  // Category CRUD
  const saveCat = async () => {
    if (!catName.trim()) { toast.error('Nom requis'); return }
    setSaving(true)
    try {
      if (editingCat) {
        const { error } = await supabase.from('product_categories').update({ name: catName.trim() }).eq('id', editingCat.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('product_categories').insert({ name: catName.trim(), sort_order: categories.length })
        if (error) throw error
      }
      toast.success(editingCat ? 'Catégorie mise à jour' : 'Catégorie créée')
      setCatModalOpen(false)
      fetchAll()
    } catch (err) { toast.error(err.message) }
    finally { setSaving(false) }
  }

  const deleteCat = async (cat) => {
    if (!confirm(`Supprimer "${cat.name}" et tous ses produits ?`)) return
    const { error } = await supabase.from('product_categories').delete().eq('id', cat.id)
    if (error) toast.error(error.message)
    else { toast.success('Supprimée'); if (activeTab === cat.id) setActiveTab(null); fetchAll() }
  }

  // Product CRUD
  const openCreateProd = () => {
    setEditingProd(null)
    setProdForm({ name: '', price: '', category_id: activeTab || categories[0]?.id || '', description: '' })
    setProdModalOpen(true)
  }

  const openEditProd = (p) => {
    setEditingProd(p)
    setProdForm({ name: p.name, price: p.price.toString(), category_id: p.category_id, description: p.description || '' })
    setProdModalOpen(true)
  }

  const saveProd = async () => {
    if (!prodForm.name.trim() || !prodForm.price || !prodForm.category_id) {
      toast.error('Nom, prix et catégorie requis')
      return
    }
    setSaving(true)
    try {
      const data = {
        name: prodForm.name.trim(),
        price: parseFloat(prodForm.price),
        category_id: prodForm.category_id,
        description: prodForm.description.trim() || null,
      }
      if (editingProd) {
        const { error } = await supabase.from('products').update(data).eq('id', editingProd.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('products').insert(data)
        if (error) throw error
      }
      toast.success(editingProd ? 'Article mis à jour' : 'Article créé')
      setProdModalOpen(false)
      fetchAll()
    } catch (err) { toast.error(err.message) }
    finally { setSaving(false) }
  }

  const deleteProd = async (p) => {
    if (!confirm(`Supprimer "${p.name}" ?`)) return
    const { error } = await supabase.from('products').delete().eq('id', p.id)
    if (error) toast.error(error.message)
    else { toast.success('Supprimé'); fetchAll() }
  }

  const toggleProd = async (p) => {
    const { error } = await supabase.from('products').update({ is_active: !p.is_active }).eq('id', p.id)
    if (error) toast.error(error.message)
    else fetchAll()
  }

  const exportCols = [
    { key: 'name', label: 'Produit' },
    { key: 'category', label: 'Catégorie' },
    { key: 'price', label: 'Prix' },
    { key: 'active', label: 'Actif' },
  ]
  const exportRows = filteredProducts.map((p) => ({
    name: p.name,
    category: p.category?.name || '',
    price: parseFloat(p.price).toFixed(2) + '€',
    active: p.is_active ? 'Oui' : 'Non',
  }))

  return (
    <PageWrapper>
      <div className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-primary" />
            <h1 className="text-2xl font-bold text-text">Catalogue</h1>
            <Badge color="primary">{products.length} articles</Badge>
          </div>
          <div className="flex items-center gap-2">
            <ExportButtons
              onExcel={() => exportExcel(exportRows, exportCols, 'produits')}
              onPDF={() => exportPDF(exportRows, exportCols, 'produits', 'Padel Camp — Produits')}
            />
            <Button size="sm" variant="ghost" onClick={() => { setEditingCat(null); setCatName(''); setCatModalOpen(true) }}>
              <FolderOpen className="w-4 h-4 mr-1" />Catégorie
            </Button>
            <Button size="sm" onClick={openCreateProd}>
              <Plus className="w-4 h-4 mr-1" />Article
            </Button>
          </div>
        </div>

        {/* Category tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setActiveTab(null)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
              !activeTab ? 'bg-primary text-white' : 'bg-white text-text-secondary hover:bg-bg'
            }`}
          >
            Tous ({products.length})
          </button>
          {categories.map((cat) => {
            const count = products.filter((p) => p.category_id === cat.id).length
            return (
              <div key={cat.id} className="flex items-center gap-0.5">
                <button
                  onClick={() => setActiveTab(cat.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                    activeTab === cat.id ? 'bg-primary text-white' : 'bg-white text-text-secondary hover:bg-bg'
                  }`}
                >
                  {cat.name} ({count})
                </button>
                <button
                  onClick={() => { setEditingCat(cat); setCatName(cat.name); setCatModalOpen(true) }}
                  className="p-1 rounded hover:bg-bg cursor-pointer"
                >
                  <Pencil className="w-3 h-3 text-text-tertiary" />
                </button>
              </div>
            )
          })}
        </div>

        {/* Products */}
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => <div key={i} className="h-16 rounded-[16px] bg-white animate-pulse" />)}
          </div>
        ) : filteredProducts.length === 0 ? (
          <Card className="text-center !py-8">
            <Package className="w-8 h-8 text-text-tertiary mx-auto mb-2" />
            <p className="text-sm text-text-tertiary">Aucun article dans cette catégorie</p>
          </Card>
        ) : (
          <div className="space-y-2">
            {filteredProducts.map((p) => (
              <Card key={p.id} className="!p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-[10px] bg-primary/5 flex items-center justify-center shrink-0">
                    <Package className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-text truncate">{p.name}</p>
                    <p className="text-xs text-text-secondary">{p.category?.name}</p>
                  </div>
                  <p className="text-sm font-bold text-primary mr-1">{parseFloat(p.price).toFixed(2)}€</p>
                  <button onClick={() => toggleProd(p)} className="cursor-pointer">
                    <Badge color={p.is_active ? 'success' : 'gray'}>
                      {p.is_active ? 'Actif' : 'Inactif'}
                    </Badge>
                  </button>
                  <button onClick={() => openEditProd(p)} className="p-1.5 rounded-lg hover:bg-bg cursor-pointer">
                    <Pencil className="w-3.5 h-3.5 text-text-secondary" />
                  </button>
                  <button onClick={() => deleteProd(p)} className="p-1.5 rounded-lg hover:bg-danger/10 cursor-pointer">
                    <Trash2 className="w-3.5 h-3.5 text-danger" />
                  </button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Category modal */}
      <Modal isOpen={catModalOpen} onClose={() => setCatModalOpen(false)} title={editingCat ? 'Modifier catégorie' : 'Nouvelle catégorie'}>
        <div className="space-y-4">
          <Input label="Nom" value={catName} onChange={(e) => setCatName(e.target.value)} placeholder="Boissons, Location..." />
          <div className="flex gap-2">
            {editingCat && (
              <Button variant="danger" className="flex-1" onClick={() => { setCatModalOpen(false); deleteCat(editingCat) }}>
                Supprimer
              </Button>
            )}
            <Button className="flex-1" loading={saving} onClick={saveCat}>
              {editingCat ? 'Enregistrer' : 'Créer'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Product modal */}
      <Modal isOpen={prodModalOpen} onClose={() => setProdModalOpen(false)} title={editingProd ? 'Modifier article' : 'Nouvel article'}>
        <div className="space-y-4">
          <Input label="Nom" value={prodForm.name} onChange={(e) => setProdForm({ ...prodForm, name: e.target.value })} />
          <Input label="Prix (€)" type="number" min="0" step="0.01" value={prodForm.price} onChange={(e) => setProdForm({ ...prodForm, price: e.target.value })} />
          <div>
            <label className="block text-sm font-medium text-text mb-1.5">Catégorie</label>
            <select
              value={prodForm.category_id}
              onChange={(e) => setProdForm({ ...prodForm, category_id: e.target.value })}
              className="w-full px-4 py-3 rounded-[12px] bg-white border border-separator text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="">— Choisir —</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <Input label="Description (optionnel)" value={prodForm.description} onChange={(e) => setProdForm({ ...prodForm, description: e.target.value })} />
          <Button className="w-full" loading={saving} onClick={saveProd}>
            {editingProd ? 'Enregistrer' : 'Créer'}
          </Button>
        </div>
      </Modal>
    </PageWrapper>
  )
}
