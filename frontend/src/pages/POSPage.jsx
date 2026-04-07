import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { formatCurrency, paymentMethodLabels, cn } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '../components/ui/select';
import { ShoppingCart, Plus, Minus, Trash2, CreditCard, Banknote, X, Check } from 'lucide-react';
import { toast } from 'sonner';

export function POSPage() {
  const { user } = useAuth();
  const [products, setProducts] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState('none');
  const [paymentMethod, setPaymentMethod] = useState('especes');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [productsData, eventsData] = await Promise.all([
        api.getProducts({ active_only: true }),
        api.getEvents({ upcoming: true }),
      ]);
      setProducts(productsData);
      setEvents(eventsData);
      
      // Auto-select first upcoming event
      if (eventsData.length > 0) {
        setSelectedEvent(eventsData[0].event_id);
      }
    } catch (err) {
      toast.error('Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  };

  const addToCart = (product) => {
    const existing = cart.find(item => item.product_id === product.product_id);
    if (existing) {
      setCart(cart.map(item =>
        item.product_id === product.product_id
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      setCart([...cart, {
        product_id: product.product_id,
        name: product.name,
        price: product.price,
        quantity: 1,
      }]);
    }
  };

  const updateQuantity = (productId, delta) => {
    setCart(cart.map(item => {
      if (item.product_id === productId) {
        const newQuantity = item.quantity + delta;
        return newQuantity > 0 ? { ...item, quantity: newQuantity } : item;
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  const removeFromCart = (productId) => {
    setCart(cart.filter(item => item.product_id !== productId));
  };

  const clearCart = () => {
    setCart([]);
  };

  const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  const handleCheckout = async () => {
    if (cart.length === 0) {
      toast.error('Le panier est vide');
      return;
    }

    try {
      setProcessing(true);
      await api.createSale({
        items: cart.map(item => ({
          product_id: item.product_id,
          quantity: item.quantity,
        })),
        payment_method: paymentMethod,
        payment_status: 'paye',
        event_id: selectedEvent === 'none' ? null : selectedEvent,
      });
      
      toast.success(`Vente enregistrée: ${formatCurrency(cartTotal)}`);
      setCart([]);
      loadData(); // Refresh products for stock updates
    } catch (err) {
      toast.error(err.message);
    } finally {
      setProcessing(false);
    }
  };

  const groupedProducts = products.reduce((acc, product) => {
    const category = product.category === 'merchandising' ? 'Merchandising' : 'Consommables';
    if (!acc[category]) acc[category] = [];
    acc[category].push(product);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="loading-spinner" />
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-6rem)] flex flex-col lg:flex-row gap-4" data-testid="pos-page">
      {/* Products Grid */}
      <div className="flex-1 overflow-auto">
        <div className="page-header mb-4">
          <h1 className="page-title flex items-center gap-2">
            <ShoppingCart className="h-6 w-6" />
            Caisse rapide
          </h1>
          <Select value={selectedEvent} onValueChange={setSelectedEvent}>
            <SelectTrigger className="w-48" data-testid="event-select">
              <SelectValue placeholder="Événement" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Aucun événement</SelectItem>
              {events.map(event => (
                <SelectItem key={event.event_id} value={event.event_id}>
                  {event.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {Object.entries(groupedProducts).map(([category, categoryProducts]) => (
          <div key={category} className="mb-6">
            <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground mb-3">
              {category}
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
              {categoryProducts.map(product => {
                const inCart = cart.find(item => item.product_id === product.product_id);
                const isLowStock = product.track_stock && product.stock_quantity <= 0;
                
                return (
                  <button
                    key={product.product_id}
                    onClick={() => !isLowStock && addToCart(product)}
                    disabled={isLowStock}
                    className={cn(
                      "pos-product-btn relative",
                      inCart && "ring-2 ring-primary",
                      isLowStock && "opacity-50 cursor-not-allowed"
                    )}
                    data-testid={`pos-product-${product.product_id}`}
                  >
                    <span className="font-medium text-sm text-center line-clamp-2">
                      {product.name}
                    </span>
                    <span className="text-lg font-bold">{formatCurrency(product.price)}</span>
                    {product.track_stock && (
                      <span className={cn(
                        "text-xs",
                        product.stock_quantity <= (product.low_stock_threshold || 5) 
                          ? "text-destructive" 
                          : "text-muted-foreground"
                      )}>
                        Stock: {product.stock_quantity}
                      </span>
                    )}
                    {inCart && (
                      <span className="absolute top-1 right-1 bg-primary text-primary-foreground text-xs px-1.5 py-0.5 font-bold">
                        {inCart.quantity}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {products.length === 0 && (
          <div className="empty-state">
            <ShoppingCart className="h-12 w-12 empty-state-icon" />
            <p className="empty-state-title">Aucun produit</p>
            <p className="empty-state-description">
              Ajoutez des produits pour commencer à vendre
            </p>
          </div>
        )}
      </div>

      {/* Cart */}
      <div className="lg:w-80 flex flex-col swiss-card p-4">
        <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
          <ShoppingCart className="h-5 w-5" />
          Panier
          {cart.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearCart}
              className="ml-auto text-destructive"
              data-testid="clear-cart-btn"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </h2>

        {/* Cart Items */}
        <div className="flex-1 overflow-auto space-y-2 min-h-[200px]">
          {cart.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Panier vide
            </p>
          ) : (
            cart.map(item => (
              <div 
                key={item.product_id} 
                className="flex items-center gap-2 p-2 border border-border"
                data-testid={`cart-item-${item.product_id}`}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatCurrency(item.price)} × {item.quantity}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => updateQuantity(item.product_id, -1)}
                    data-testid={`decrease-${item.product_id}`}
                  >
                    <Minus className="h-3 w-3" />
                  </Button>
                  <span className="w-6 text-center font-bold">{item.quantity}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => updateQuantity(item.product_id, 1)}
                    data-testid={`increase-${item.product_id}`}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    onClick={() => removeFromCart(item.product_id)}
                    data-testid={`remove-${item.product_id}`}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
                <span className="font-bold w-16 text-right">
                  {formatCurrency(item.price * item.quantity)}
                </span>
              </div>
            ))
          )}
        </div>

        {/* Total and Payment */}
        <div className="border-t border-border pt-4 mt-4 space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-lg font-bold">Total</span>
            <span className="text-2xl font-black" data-testid="cart-total">
              {formatCurrency(cartTotal)}
            </span>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
              Mode de paiement
            </label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant={paymentMethod === 'especes' ? 'default' : 'outline'}
                onClick={() => setPaymentMethod('especes')}
                className="h-12"
                data-testid="payment-cash"
              >
                <Banknote className="h-5 w-5 mr-2" />
                Espèces
              </Button>
              <Button
                variant={paymentMethod === 'carte' ? 'default' : 'outline'}
                onClick={() => setPaymentMethod('carte')}
                className="h-12"
                data-testid="payment-card"
              >
                <CreditCard className="h-5 w-5 mr-2" />
                Carte
              </Button>
            </div>
          </div>

          <Button
            className="w-full h-14 text-lg font-bold"
            disabled={cart.length === 0 || processing}
            onClick={handleCheckout}
            data-testid="checkout-btn"
          >
            {processing ? (
              <div className="loading-spinner mr-2" />
            ) : (
              <Check className="h-5 w-5 mr-2" />
            )}
            Valider {formatCurrency(cartTotal)}
          </Button>
        </div>
      </div>
    </div>
  );
}
