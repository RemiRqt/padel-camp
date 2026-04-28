import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import { Minus, Plus } from 'lucide-react'

function ProductCard({ p, categoryName, qtyInCart, onClick }) {
  const inCart = qtyInCart > 0
  return (
    <button
      onClick={onClick}
      className={`relative p-2.5 rounded-[12px] border-2 transition-all text-left cursor-pointer active:scale-[0.97] flex flex-col gap-1 ${
        inCart
          ? 'border-primary bg-primary/5 shadow-[0_4px_12px_rgba(11,39,120,0.12)]'
          : 'border-transparent bg-white hover:border-primary/20 hover:shadow-[0_4px_12px_rgba(11,39,120,0.08)]'
      }`}
    >
      {inCart && (
        <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-primary text-white text-[10px] font-bold flex items-center justify-center shadow-md">
          {qtyInCart}
        </div>
      )}

      <Badge color="primary" className="!text-[9px] !px-1.5 !py-0.5 self-start">{categoryName}</Badge>

      <p className="text-[13px] font-semibold text-text leading-tight line-clamp-2 mt-0.5">{p.name}</p>

      <p className="text-base font-bold text-primary leading-none mt-1">
        {parseFloat(p.price).toFixed(2)}<span className="text-xs">€</span>
      </p>
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
          className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap cursor-pointer transition-colors ${
            showAll ? 'bg-primary text-white' : 'bg-white text-text-secondary hover:bg-bg'
          }`}
        >
          Tout voir ({products.length})
        </button>
        {categories.map((cat) => {
          const count = products.filter((p) => p.category_id === cat.id).length
          if (count === 0) return null
          return (
            <button
              key={cat.id}
              onClick={() => setActiveCat(cat.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap cursor-pointer transition-colors ${
                activeCat === cat.id ? 'bg-primary text-white' : 'bg-white text-text-secondary hover:bg-bg'
              }`}
            >
              {cat.name} ({count})
            </button>
          )
        })}
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
