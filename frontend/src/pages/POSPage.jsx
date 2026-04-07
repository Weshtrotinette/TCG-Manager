import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { formatCurrency, cn } from '../lib/utils';
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
    <div className="h-[calc(100vh-4rem)] md:h-[calc(100vh-5rem)] flex flex-col md:flex-row gap-3" data-testid="pos-page">
      {/* Products Grid */}
      <div className="flex-1 overflow-auto min-h-0">
        {/* Header - more compact on tablet */}
        <div className="flex items-center justify-between mb-3 sticky top-0 bg-background z-10 pb-2">
          <h1 className="text-lg md:text-xl font-bold flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            <span className="hidden sm:inline">Caisse rapide</span>
            <span className="sm:hidden">Caisse</span>
          </h1>
          <Select value={selectedEvent} onValueChange={setSelectedEvent}>
            <SelectTrigger className="w-36 md:w-48 h-10" data-testid="event-select">
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

        {/* Products by category */}
        {Object.entries(groupedProducts).map(([category, categoryProducts]) => (
          <div key={category} className="mb-4">
            <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground mb-2">
              {category}
            </h2>
            {/* Responsive grid: 3 cols on small tablet, 4 on larger */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-2">
              {categoryProducts.map(product => {
                const inCart = cart.find(item => item.product_id === product.product_id);
                const isLowStock = product.track_stock && product.stock_quantity <= 0;
                
                return (
                  <button
                    key={product.product_id}
                    onClick={() => !isLowStock && addToCart(product)}
                    disabled={isLowStock}
                    className={cn(
                      "pos-product-btn relative min-h-[72px] md:min-h-[80px]",
                      inCart && "ring-2 ring-primary bg-primary/5",
                      isLowStock && "opacity-50 cursor-not-allowed"
                    )}
                    data-testid={`pos-product-${product.product_id}`}
                  >
                    <span className="font-medium text-sm text-center line-clamp-2 leading-tight">
                      {product.name}
                    </span>
                    <span className="text-base md:text-lg font-bold">{formatCurrency(product.price)}</span>
                    {product.track_stock && (
                      <span className={cn(
                        "text-[10px]",
                        product.stock_quantity <= (product.low_stock_threshold || 5) 
                          ? "text-destructive font-bold" 
                          : "text-muted-foreground"
                      )}>
                        Stock: {product.stock_quantity}
                      </span>
                    )}
                    {inCart && (
                      <span className="absolute top-1 right-1 bg-primary text-primary-foreground text-xs w-6 h-6 flex items-center justify-center font-bold">
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
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <ShoppingCart className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-bold mb-2">Aucun produit</p>
            <p className="text-sm text-muted-foreground">
              Ajoutez des produits pour commencer
            </p>
          </div>
        )}
      </div>

      {/* Cart - Fixed on right side on tablet landscape */}
      <div className="md:w-72 lg:w-80 flex flex-col bg-card border border-border p-3 max-h-[40vh] md:max-h-full">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold flex items-center gap-2">
            <ShoppingCart className="h-4 w-4" />
            Panier
            {cart.length > 0 && (
              <span className="bg-primary text-primary-foreground text-xs px-1.5 py-0.5 font-bold">
                {cart.reduce((sum, item) => sum + item.quantity, 0)}
              </span>
            )}
          </h2>
          {cart.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearCart}
              className="text-destructive h-8 px-2"
              data-testid="clear-cart-btn"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Cart Items - Scrollable */}
        <div className="flex-1 overflow-auto space-y-1.5 min-h-[80px]">
          {cart.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Panier vide
            </p>
          ) : (
            cart.map(item => (
              <div 
                key={item.product_id} 
                className="flex items-center gap-2 p-2 bg-muted/50 border border-border"
                data-testid={`cart-item-${item.product_id}`}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatCurrency(item.price)} × {item.quantity}
                  </p>
                </div>
                <div className="flex items-center gap-0.5">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => updateQuantity(item.product_id, -1)}
                    data-testid={`decrease-${item.product_id}`}
                  >
                    <Minus className="h-3 w-3" />
                  </Button>
                  <span className="w-5 text-center font-bold text-sm">{item.quantity}</span>
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
                <span className="font-bold text-sm w-14 text-right">
                  {formatCurrency(item.price * item.quantity)}
                </span>
              </div>
            ))
          )}
        </div>

        {/* Total and Payment - Always visible */}
        <div className="border-t border-border pt-3 mt-3 space-y-3">
          <div className="flex justify-between items-center">
            <span className="font-bold">Total</span>
            <span className="text-xl md:text-2xl font-black" data-testid="cart-total">
              {formatCurrency(cartTotal)}
            </span>
          </div>

          {/* Payment method - Larger touch targets */}
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant={paymentMethod === 'especes' ? 'default' : 'outline'}
              onClick={() => setPaymentMethod('especes')}
              className="h-11 text-sm font-bold"
              data-testid="payment-cash"
            >
              <Banknote className="h-4 w-4 mr-1.5" />
              Espèces
            </Button>
            <Button
              variant={paymentMethod === 'carte' ? 'default' : 'outline'}
              onClick={() => setPaymentMethod('carte')}
              className="h-11 text-sm font-bold"
              data-testid="payment-card"
            >
              <CreditCard className="h-4 w-4 mr-1.5" />
              Carte
            </Button>
          </div>

          {/* Checkout button - Large and prominent */}
          <Button
            className="w-full h-12 md:h-14 text-base md:text-lg font-bold"
            disabled={cart.length === 0 || processing}
            onClick={handleCheckout}
            data-testid="checkout-btn"
          >
            {processing ? (
              <div className="loading-spinner mr-2 h-5 w-5" />
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
