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
import { ShoppingCart, Plus, Minus, Trash2, CreditCard, Banknote, X, Check, Package } from 'lucide-react';
import { toast } from 'sonner';

export function POSPage() {
  const { user } = useAuth();
  const [products, setProducts] = useState([]);
  const [settings, setSettings] = useState(null);
  const [events, setEvents] = useState([]);
  const [snackCards, setSnackCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState('none');
  const [selectedSnackCard, setSelectedSnackCard] = useState('none');
  const [paymentMethod, setPaymentMethod] = useState('especes');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [productsData, eventsData, settingsData, snackCardsData] = await Promise.all([
        api.getProducts({ active_only: true }),
        api.getEvents({ upcoming: true }),
        api.getSettings(),
        api.getSnackCards(true),
      ]);
      setProducts(productsData);
      setEvents(eventsData);
      setSnackCards(snackCardsData);
      
      // Normalize settings
      if (Array.isArray(settingsData.product_categories)) {
        const obj = {};
        settingsData.product_categories.forEach(c => { obj[c] = []; });
        settingsData.product_categories = obj;
      }
      if (!settingsData.pos_visible_subcategories) {
        settingsData.pos_visible_subcategories = [];
      }
      setSettings(settingsData);
      
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

  // Compute snack card deduction
  const selectedCard = snackCards.find(c => c.card_id === selectedSnackCard);
  const snackDeduction = selectedCard ? Math.min(selectedCard.balance, cartTotal) : 0;
  const remainingToPay = cartTotal - snackDeduction;

  const handleCheckout = async () => {
    if (cart.length === 0) {
      toast.error('Le panier est vide');
      return;
    }

    try {
      setProcessing(true);
      
      // Deduct from snack card first if selected
      if (selectedCard && snackDeduction > 0) {
        await api.deductSnackCard(selectedCard.card_id, snackDeduction);
      }
      
      await api.createSale({
        items: cart.map(item => ({
          product_id: item.product_id,
          quantity: item.quantity,
        })),
        payment_method: snackDeduction >= cartTotal ? 'carte_snack' : paymentMethod,
        payment_status: 'paye',
        event_id: selectedEvent === 'none' ? null : selectedEvent,
        comment: selectedCard ? `Carte snack: -${formatCurrency(snackDeduction)}${remainingToPay > 0 ? ` + ${paymentMethod}: ${formatCurrency(remainingToPay)}` : ''}` : null,
      });
      
      toast.success(`Vente enregistree: ${formatCurrency(cartTotal)}`);
      setCart([]);
      setSelectedSnackCard('none');
      loadData();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setProcessing(false);
    }
  };

  // Group products by subcategory, filtered by POS whitelist
  const posVisibleSubs = settings?.pos_visible_subcategories || [];
  
  const groupedProducts = {};
  products.forEach(product => {
    const sub = product.subcategory;
    // If there's a whitelist with entries, only show products whose subcategory is in it
    // Products without subcategory go into "Autres"
    if (posVisibleSubs.length > 0) {
      if (sub && posVisibleSubs.includes(sub)) {
        if (!groupedProducts[sub]) groupedProducts[sub] = [];
        groupedProducts[sub].push(product);
      } else if (!sub) {
        // Products without subcategory: show under "autres"
        const key = 'autres';
        if (!groupedProducts[key]) groupedProducts[key] = [];
        groupedProducts[key].push(product);
      }
    } else {
      // No whitelist configured: show everything grouped by subcategory or category
      const key = sub || product.category || 'autres';
      if (!groupedProducts[key]) groupedProducts[key] = [];
      groupedProducts[key].push(product);
    }
  });

  // Dynamic payment methods from settings
  const paymentMethods = settings?.payment_methods || ['especes', 'carte'];

  const paymentIcons = {
    especes: Banknote,
    carte: CreditCard,
  };

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
        <div className="flex items-center justify-between mb-3 sticky top-0 bg-background z-10 pb-2">
          <h1 className="text-lg md:text-xl font-bold flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            <span className="hidden sm:inline">Caisse rapide</span>
            <span className="sm:hidden">Caisse</span>
          </h1>
          <Select value={selectedEvent} onValueChange={setSelectedEvent}>
            <SelectTrigger className="w-36 md:w-48 h-10" data-testid="event-select">
              <SelectValue placeholder="Evenement" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Aucun evenement</SelectItem>
              {events.map(event => (
                <SelectItem key={event.event_id} value={event.event_id}>
                  {event.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Products grouped by subcategory */}
        {Object.keys(groupedProducts).length > 0 ? (
          Object.entries(groupedProducts).map(([subcategory, subProducts]) => (
            <div key={subcategory} className="mb-5">
              <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground mb-2 border-b border-border pb-1">
                {subcategory}
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-2">
                {subProducts.map(product => {
                  const inCart = cart.find(item => item.product_id === product.product_id);
                  const isLowStock = product.track_stock && product.stock_quantity <= 0;
                  
                  return (
                    <button
                      key={product.product_id}
                      onClick={() => !isLowStock && addToCart(product)}
                      disabled={isLowStock}
                      className={cn(
                        "pos-product-btn relative flex flex-col items-center justify-center gap-1 min-h-[88px] md:min-h-[96px] p-2 overflow-hidden",
                        inCart && "ring-2 ring-primary bg-primary/5",
                        isLowStock && "opacity-50 cursor-not-allowed"
                      )}
                      data-testid={`pos-product-${product.product_id}`}
                    >
                      {product.image_url ? (
                        <img
                          src={product.image_url}
                          alt={product.name}
                          className="w-10 h-10 md:w-12 md:h-12 object-cover rounded"
                          loading="lazy"
                        />
                      ) : (
                        <Package className="w-6 h-6 text-muted-foreground/40" />
                      )}
                      <span className="font-medium text-xs md:text-sm text-center line-clamp-2 leading-tight">
                        {product.name}
                      </span>
                      <span className="text-sm md:text-base font-bold">{formatCurrency(product.price)}</span>
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
                        <span className="absolute top-1 right-1 bg-primary text-primary-foreground text-xs w-6 h-6 flex items-center justify-center font-bold rounded-sm">
                          {inCart.quantity}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <ShoppingCart className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-bold mb-2">Aucun produit</p>
            <p className="text-sm text-muted-foreground">
              {posVisibleSubs.length > 0
                ? 'Aucun produit dans les sous-categories visibles en caisse'
                : 'Ajoutez des produits pour commencer'}
            </p>
          </div>
        )}
      </div>

      {/* Cart */}
      <div className="md:w-72 lg:w-80 flex flex-col bg-card border border-border p-3 max-h-[40vh] md:max-h-full">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold flex items-center gap-2">
            <ShoppingCart className="h-4 w-4" />
            Panier
            {cart.length > 0 && (
              <span className="bg-primary text-primary-foreground text-xs px-1.5 py-0.5 font-bold rounded-sm">
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
                    {formatCurrency(item.price)} x {item.quantity}
                  </p>
                </div>
                <div className="flex items-center gap-0.5">
                  <Button variant="ghost" size="icon" className="h-8 w-8"
                    onClick={() => updateQuantity(item.product_id, -1)}
                    data-testid={`decrease-${item.product_id}`}>
                    <Minus className="h-3 w-3" />
                  </Button>
                  <span className="w-5 text-center font-bold text-sm">{item.quantity}</span>
                  <Button variant="ghost" size="icon" className="h-8 w-8"
                    onClick={() => updateQuantity(item.product_id, 1)}
                    data-testid={`increase-${item.product_id}`}>
                    <Plus className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive"
                    onClick={() => removeFromCart(item.product_id)}
                    data-testid={`remove-${item.product_id}`}>
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

        {/* Total and Payment */}
        <div className="border-t border-border pt-3 mt-3 space-y-3">
          <div className="flex justify-between items-center">
            <span className="font-bold">Total</span>
            <span className="text-xl md:text-2xl font-black" data-testid="cart-total">
              {formatCurrency(cartTotal)}
            </span>
          </div>

          {/* Snack Card dropdown */}
          {snackCards.length > 0 && (
            <div className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Carte Snack</span>
              <Select value={selectedSnackCard} onValueChange={setSelectedSnackCard}>
                <SelectTrigger className="h-9 text-xs" data-testid="snack-card-select">
                  <SelectValue placeholder="Aucune carte" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucune carte</SelectItem>
                  {snackCards.map(card => (
                    <SelectItem key={card.card_id} value={card.card_id}>
                      {card.member_name} - {formatCurrency(card.balance)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedCard && snackDeduction > 0 && (
                <div className="text-xs space-y-0.5 bg-muted/50 p-2 rounded">
                  <div className="flex justify-between">
                    <span>Carte snack</span>
                    <span className="text-success font-bold">-{formatCurrency(snackDeduction)}</span>
                  </div>
                  {remainingToPay > 0 && (
                    <div className="flex justify-between font-bold">
                      <span>Reste a payer</span>
                      <span>{formatCurrency(remainingToPay)}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Dynamic payment methods */}
          {remainingToPay > 0 && (
            <div className="grid grid-cols-2 gap-2">
              {paymentMethods.slice(0, 4).map(method => {
                const Icon = paymentIcons[method] || CreditCard;
                return (
                  <Button
                    key={method}
                    variant={paymentMethod === method ? 'default' : 'outline'}
                    onClick={() => setPaymentMethod(method)}
                    className="h-10 text-xs font-bold capitalize"
                    data-testid={`payment-${method}`}
                  >
                    <Icon className="h-3.5 w-3.5 mr-1" />
                    {method}
                  </Button>
                );
              })}
            </div>
          )}

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
            Valider {formatCurrency(remainingToPay > 0 ? remainingToPay : cartTotal)}
          </Button>
        </div>
      </div>
    </div>
  );
}
