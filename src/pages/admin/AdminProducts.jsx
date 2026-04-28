import { useEffect, useState } from 'react'
import { fetchCategoriesAndProducts, saveCategory, deleteCategory as deleteCategoryService, saveProduct, deleteProduct as deleteProductService, toggleProduct } from '@/services/productService'
import PageWrapper from '@/components/layout/PageWrapper'
import Card from '@/components/ui/Card'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import toast from 'react-hot-toast'
import { Package, Plus, Pencil, Trash2, FolderOpen } from 'lucide-react'
import ConfirmModal from '@/components/ui/ConfirmModal'
import useConfirm from '@/hooks/useConfirm'
import { getProductTvaRate, formatTvaRate, DEFAULT_TVA_RATE } from '@/utils/tva'

export default function AdminProducts() {
  const { confirmProps, askConfirm } = useConfirm()
  const [categories, setCategories] = useState([])
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState(null) // category id or null=all

  // Category modal
  const [catModalOpen, setCatModalOpen] = useState(false)
  const [editingCat, setEditingCat] = useState(null)
  const [catName, setCatName] = useState('')
  const [catTva, setCatTva] = useState('')

  // Product modal
  const [prodModalOpen, setProdModalOpen] = useState(false)
  const [editingProd, setEditingProd] = useState(null)
  const [prodForm, setProdForm] = useState({ name: '', price: '', category_id: '', description: '', tva_rate: '' })
  const [saving, setSaving] = useState(false)

  const fetchAll = async () => {
    setLoading(true)
    try {
      const { categories, products } = await fetchCategoriesAndProducts()
      setCategories(categories)
      setProducts(products)
    } catch (err) {
      toast.error('Erreur chargement catalogue')
      console.error('[AdminProducts] fetchAll error:', err)
    } finally {
      setLoading(false)
    }
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
      const tva = catTva === '' ? DEFAULT_TVA_RATE : parseFloat(catTva)
      if (Number.isNaN(tva) || tva < 0 || tva > 100) { toast.error('Taux TVA invalide'); setSaving(false); return }
      await saveCategory(editingCat?.id, catName.trim(), categories.length, tva)
      toast.success(editingCat ? 'Catégorie mise à jour' : 'Catégorie créée')
      setCatModalOpen(false)
      fetchAll()
    } catch (err) { toast.error(err.message) }
    finally { setSaving(false) }
  }

  const deleteCat = async (cat) => {
    askConfirm({
      title: 'Supprimer la catégorie',
      message: `Supprimer "${cat.name}" et tous ses produits ?`,
      confirmLabel: 'Supprimer',
      variant: 'danger',
      onConfirm: async () => {
        try {
          await deleteCategoryService(cat.id)
          toast.success('Supprimée')
          if (activeTab === cat.id) setActiveTab(null)
          fetchAll()
        } catch (err) { toast.error(err.message) }
      },
    })
  }

  // Product CRUD
  const openCreateProd = () => {
    setEditingProd(null)
    setProdForm({ name: '', price: '', category_id: activeTab || categories[0]?.id || '', description: '', tva_rate: '' })
    setProdModalOpen(true)
  }

  const openEditProd = (p) => {
    setEditingProd(p)
    setProdForm({
      name: p.name,
      price: p.price.toString(),
      category_id: p.category_id,
      description: p.description || '',
      tva_rate: p.tva_rate != null ? String(p.tva_rate) : '',
    })
    setProdModalOpen(true)
  }

  const saveProd = async () => {
    if (!prodForm.name.trim() || !prodForm.price || !prodForm.category_id) {
      toast.error('Nom, prix et catégorie requis')
      return
    }
    setSaving(true)
    try {
      let tvaOverride = null
      if (prodForm.tva_rate !== '') {
        const n = parseFloat(prodForm.tva_rate)
        if (Number.isNaN(n) || n < 0 || n > 100) { toast.error('Taux TVA invalide'); setSaving(false); return }
        tvaOverride = n
      }
      const data = {
        name: prodForm.name.trim(),
        price: parseFloat(prodForm.price),
        category_id: prodForm.category_id,
        description: prodForm.description.trim() || null,
        tva_rate: tvaOverride,
      }
      await saveProduct(editingProd?.id, data)
      toast.success(editingProd ? 'Article mis à jour' : 'Article créé')
      setProdModalOpen(false)
      fetchAll()
    } catch (err) { toast.error(err.message) }
    finally { setSaving(false) }
  }

  const deleteProd = async (p) => {
    askConfirm({
      title: 'Supprimer l\'article',
      message: `Supprimer "${p.name}" ?`,
      confirmLabel: 'Supprimer',
      variant: 'danger',
      onConfirm: async () => {
        try {
          await deleteProductService(p.id)
          toast.success('Supprimé')
          fetchAll()
        } catch (err) { toast.error(err.message) }
      },
    })
  }

  const toggleProd = async (p) => {
    try {
      await toggleProduct(p.id, p.is_active)
      fetchAll()
    } catch (err) {
      toast.error(err.message)
    }
  }

  return (
    <PageWrapper wide>
      <div className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-primary" />
            <h1 className="text-2xl font-bold text-text">Catalogue</h1>
            <Badge color="primary">{products.length} articles</Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={() => { setEditingCat(null); setCatName(''); setCatTva(''); setCatModalOpen(true) }}>
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
                  onClick={() => { setEditingCat(cat); setCatName(cat.name); setCatTva(cat.tva_rate != null ? String(cat.tva_rate) : ''); setCatModalOpen(true) }}
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {filteredProducts.map((p) => (
              <Card
                key={p.id}
                className={`!p-0 flex flex-col overflow-hidden transition-all hover:shadow-[0_4px_12px_rgba(11,39,120,0.08)] ${
                  !p.is_active ? 'opacity-60' : ''
                }`}
              >
                {/* Header bar : catégorie + toggle actif */}
                <div className="px-4 pt-3 pb-2 flex items-center justify-between gap-2">
                  <span className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wider truncate">
                    {p.category?.name || 'Sans catégorie'}
                  </span>
                  <button
                    onClick={() => toggleProd(p)}
                    className="flex items-center gap-1.5 cursor-pointer hover:opacity-80 transition-opacity"
                    title={p.is_active ? 'Cliquer pour désactiver' : 'Cliquer pour activer'}
                  >
                    <span className={`w-2 h-2 rounded-full ${p.is_active ? 'bg-success' : 'bg-text-tertiary'}`} />
                    <span className={`text-[10px] font-semibold ${p.is_active ? 'text-success' : 'text-text-tertiary'}`}>
                      {p.is_active ? 'Actif' : 'Inactif'}
                    </span>
                  </button>
                </div>

                {/* Body : nom + prix */}
                <div className="px-4 pb-3 flex-1 flex flex-col gap-1">
                  <p className="text-base font-semibold text-text leading-tight line-clamp-2">{p.name}</p>
                  {p.description && (
                    <p className="text-xs text-text-tertiary line-clamp-1">{p.description}</p>
                  )}
                  <div className="mt-auto pt-2 flex items-baseline gap-2">
                    <p className="text-2xl font-bold text-primary leading-none">
                      {parseFloat(p.price).toFixed(2)}<span className="text-base ml-0.5">€</span>
                    </p>
                    <span className="text-[10px] text-text-tertiary">
                      TVA {formatTvaRate(getProductTvaRate(p))}{p.tva_rate == null ? ' (cat.)' : ''}
                    </span>
                  </div>
                </div>

                {/* Actions footer */}
                <div className="border-t border-separator flex">
                  <button
                    onClick={() => openEditProd(p)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 hover:bg-primary/5 text-xs font-semibold text-primary cursor-pointer transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5" /> Modifier
                  </button>
                  <div className="w-px bg-separator" />
                  <button
                    onClick={() => deleteProd(p)}
                    className="flex items-center justify-center px-4 py-2.5 hover:bg-danger/5 text-text-tertiary hover:text-danger cursor-pointer transition-colors"
                    title="Supprimer"
                    aria-label="Supprimer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
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
          <Input
            label="Taux TVA (%)"
            type="number"
            min="0"
            max="100"
            step="0.1"
            value={catTva}
            onChange={(e) => setCatTva(e.target.value)}
            placeholder={`${DEFAULT_TVA_RATE} par défaut`}
          />
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
          <Input label="Prix TTC (€)" type="number" min="0" step="0.01" value={prodForm.price} onChange={(e) => setProdForm({ ...prodForm, price: e.target.value })} />
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
          <Input
            label="TVA (%) — optionnel"
            type="number"
            min="0"
            max="100"
            step="0.1"
            value={prodForm.tva_rate}
            onChange={(e) => setProdForm({ ...prodForm, tva_rate: e.target.value })}
            placeholder={(() => {
              const cat = categories.find((c) => c.id === prodForm.category_id)
              const catRate = cat?.tva_rate ?? DEFAULT_TVA_RATE
              return `Hérite catégorie (${formatTvaRate(catRate)})`
            })()}
          />
          <Button className="w-full" loading={saving} onClick={saveProd}>
            {editingProd ? 'Enregistrer' : 'Créer'}
          </Button>
        </div>
      </Modal>
      <ConfirmModal {...confirmProps} />
    </PageWrapper>
  )
}
