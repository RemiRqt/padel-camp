import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import { Minus, Plus } from 'lucide-react'

function ProductCard({ p, categoryName, onClick }) {
  return (
    <button
      onClick={onClick}
      className="p-3 rounded-[14px] bg-white hover:shadow-[0_4px_12px_rgba(11,39,120,0.1)] transition-all text-left cursor-pointer active:scale-95 flex flex-col gap-1.5"
    >
      <Badge color="primary" className="self-start">{categoryName}</Badge>
      <p className="text-sm font-medium text-text leading-tight line-clamp-2">{p.name}</p>
      <p className="text-lg font-bold text-primary mt-auto">{parseFloat(p.price).toFixed(2)}€</p>
    </button>
  )
}

export default function POSArticlesTab({
  categories, products, filteredProducts, activeCat, setActiveCat,
  cart, addToCart, updateCartQty, cartTotal, onCheckout,
}) {
  const showAll = !activeCat
  const categoryById = Object.fromEntries(categories.map((c) => [c.id, c.name]))

  // Quand "Tout voir" : grouper par catégorie. Sinon afficher la liste filtrée à plat.
  const groups = showAll
    ? categories
        .map((cat) => ({ cat, items: products.filter((p) => p.category_id === cat.id) }))
        .filter((g) => g.items.length > 0)
    : []

  return (
    <div className="space-y-4">
      {/* Filtres catégorie : "Tout voir" + une chip par catégorie */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        <button
          onClick={() => setActiveCat(null)}
          className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap cursor-pointer ${
            showAll ? 'bg-primary text-white' : 'bg-white text-text-secondary hover:bg-bg'
          }`}
        >
          Tout voir
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCat(cat.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap cursor-pointer ${
              activeCat === cat.id ? 'bg-primary text-white' : 'bg-white text-text-secondary hover:bg-bg'
            }`}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* Grille des produits */}
      {showAll ? (
        <div className="space-y-5">
          {groups.map(({ cat, items }) => (
            <div key={cat.id}>
              <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-2">
                {cat.name}
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                {items.map((p) => (
                  <ProductCard key={p.id} p={p} categoryName={cat.name} onClick={() => addToCart(p)} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {filteredProducts.map((p) => (
            <ProductCard
              key={p.id}
              p={p}
              categoryName={categoryById[p.category_id] || ''}
              onClick={() => addToCart(p)}
            />
          ))}
        </div>
      )}

      {/* Panier */}
      {cart.length > 0 && (
        <Card elevated>
          <h3 className="text-sm font-semibold mb-3">Panier</h3>
          <div className="space-y-2">
            {cart.map((item) => (
              <div key={item.product.id} className="flex items-center justify-between">
                <p className="text-sm text-text truncate flex-1">{item.product.name}</p>
                <div className="flex items-center gap-2">
                  <button onClick={() => updateCartQty(item.product.id, -1)} className="w-6 h-6 rounded-full bg-bg flex items-center justify-center cursor-pointer"><Minus className="w-3 h-3" /></button>
                  <span className="text-sm font-semibold w-6 text-center">{item.qty}</span>
                  <button onClick={() => updateCartQty(item.product.id, 1)} className="w-6 h-6 rounded-full bg-bg flex items-center justify-center cursor-pointer"><Plus className="w-3 h-3" /></button>
                  <span className="text-sm font-semibold text-primary w-14 text-right">{(item.qty * parseFloat(item.product.price)).toFixed(2)}€</span>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 pt-3 border-t border-separator flex items-center justify-between">
            <span className="font-semibold">Total</span>
            <span className="text-xl font-bold text-primary">{cartTotal.toFixed(2)}€</span>
          </div>
          <Button className="w-full mt-3" onClick={onCheckout}>
            Encaisser {cartTotal.toFixed(2)}€
          </Button>
        </Card>
      )}
    </div>
  )
}
