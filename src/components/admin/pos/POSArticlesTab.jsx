import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { Minus, Plus } from 'lucide-react'

export default function POSArticlesTab({
  categories, filteredProducts, activeCat, setActiveCat,
  cart, addToCart, updateCartQty, cartTotal, onCheckout,
}) {
  return (
    <div className="space-y-4">
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {categories.map((cat) => (
          <button key={cat.id} onClick={() => setActiveCat(cat.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap cursor-pointer ${
              activeCat === cat.id ? 'bg-primary text-white' : 'bg-white text-text-secondary hover:bg-bg'}`}>
            {cat.name}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
        {filteredProducts.map((p) => (
          <button key={p.id} onClick={() => addToCart(p)}
            className="p-3 rounded-[14px] bg-white hover:shadow-[0_4px_12px_rgba(11,39,120,0.1)] transition-all text-left cursor-pointer active:scale-95">
            <p className="text-sm font-medium text-text truncate">{p.name}</p>
            <p className="text-lg font-bold text-primary">{parseFloat(p.price).toFixed(2)}€</p>
          </button>
        ))}
      </div>
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
