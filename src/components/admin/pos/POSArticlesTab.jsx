import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import { Minus, Plus } from 'lucide-react'

function ProductCard({ p, categoryName, qtyInCart, onClick }) {
  const inCart = qtyInCart > 0
  return (
    <button
      onClick={onClick}
      className={`relative p-3.5 rounded-[16px] border-2 transition-all text-left cursor-pointer active:scale-[0.97] flex flex-col gap-2 min-h-[120px] ${
        inCart
          ? 'border-primary bg-primary/5 shadow-[0_4px_12px_rgba(11,39,120,0.12)]'
          : 'border-transparent bg-white hover:border-primary/20 hover:shadow-[0_4px_12px_rgba(11,39,120,0.08)]'
      }`}
    >
      {/* Badge qty au panier */}
      {inCart && (
        <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center shadow-md">
          {qtyInCart}
        </div>
      )}

      <Badge color="primary" className="!text-[10px] !px-2 !py-0.5 self-start">{categoryName}</Badge>

      {/* Nom */}
      <p className="text-sm font-semibold text-text leading-tight line-clamp-2 flex-1">{p.name}</p>

      {/* Prix */}
      <div className="flex items-baseline justify-between border-t border-separator pt-2">
        <p className="text-xl font-bold text-primary leading-none">{parseFloat(p.price).toFixed(2)}<span className="text-sm">€</span></p>
        <span className="text-[10px] text-text-tertiary uppercase tracking-wide font-medium">
          Ajouter
        </span>
      </div>
    </button>
  )
}

export default function POSArticlesTab({
  categories, products, filteredProducts, activeCat, setActiveCat,
  cart, addToCart, updateCartQty, cartTotal, onCheckout,
}) {
  const showAll = !activeCat
  const categoryById = Object.fromEntries(categories.map((c) => [c.id, c.name]))
  const qtyByProduct = Object.fromEntries(cart.map((item) => [item.product.id, item.qty]))

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

      {/* Panier (au-dessus pour visibilité immédiate du total) */}
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

      {/* Grille des produits */}
      {showAll ? (
        <div className="space-y-5">
          {groups.map(({ cat, items }) => (
            <div key={cat.id}>
              <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-2">
                {cat.name}
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {items.map((p) => (
                  <ProductCard
                    key={p.id}
                    p={p}
                    categoryName={cat.name}
                    qtyInCart={qtyByProduct[p.id] || 0}
                    onClick={() => addToCart(p)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {filteredProducts.map((p) => (
            <ProductCard
              key={p.id}
              p={p}
              categoryName={categoryById[p.category_id] || ''}
              qtyInCart={qtyByProduct[p.id] || 0}
              onClick={() => addToCart(p)}
            />
          ))}
        </div>
      )}

    </div>
  )
}
