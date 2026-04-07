import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { formatCurrency, productCategoryLabels, cn } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Checkbox } from '../components/ui/checkbox';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '../components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import { 
  Plus, Search, Filter, Package, AlertTriangle, 
  Edit, PackagePlus 
} from 'lucide-react';
import { toast } from 'sonner';

export function ProductsPage() {
  const { hasPermission } = useAuth();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [isProductDialogOpen, setIsProductDialogOpen] = useState(false);
  const [isRestockDialogOpen, setIsRestockDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [restockProduct, setRestockProduct] = useState(null);
  const [restockQuantity, setRestockQuantity] = useState(0);
  const [restockComment, setRestockComment] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    category: 'consommable',
    subcategory: '',
    description: '',
    price: 0,
    cost: 0,
    track_stock: true,
    stock_quantity: 0,
    low_stock_threshold: 5,
  });

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    try {
      setLoading(true);
      const data = await api.getProducts({ active_only: false });
      setProducts(data);
    } catch (err) {
      toast.error('Erreur lors du chargement des produits');
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = products.filter(product => {
    const matchesSearch = searchQuery === '' || 
      product.name.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = categoryFilter === 'all' || product.category === categoryFilter;
    
    return matchesSearch && matchesCategory;
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        price: parseFloat(formData.price),
        cost: formData.cost ? parseFloat(formData.cost) : null,
        stock_quantity: parseInt(formData.stock_quantity),
        low_stock_threshold: parseInt(formData.low_stock_threshold),
      };

      if (editingProduct) {
        await api.updateProduct(editingProduct.product_id, payload);
        toast.success('Produit mis à jour');
      } else {
        await api.createProduct(payload);
        toast.success('Produit créé');
      }
      setIsProductDialogOpen(false);
      resetForm();
      loadProducts();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleRestock = async (e) => {
    e.preventDefault();
    try {
      await api.restockProduct(restockProduct.product_id, {
        quantity: parseInt(restockQuantity),
        comment: restockComment,
      });
      toast.success('Stock mis à jour');
      setIsRestockDialogOpen(false);
      setRestockProduct(null);
      setRestockQuantity(0);
      setRestockComment('');
      loadProducts();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleEdit = (product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      category: product.category,
      subcategory: product.subcategory || '',
      description: product.description || '',
      price: product.price,
      cost: product.cost || 0,
      track_stock: product.track_stock,
      stock_quantity: product.stock_quantity,
      low_stock_threshold: product.low_stock_threshold || 5,
    });
    setIsProductDialogOpen(true);
  };

  const openRestockDialog = (product) => {
    setRestockProduct(product);
    setRestockQuantity(0);
    setRestockComment('');
    setIsRestockDialogOpen(true);
  };

  const resetForm = () => {
    setEditingProduct(null);
    setFormData({
      name: '',
      category: 'consommable',
      subcategory: '',
      description: '',
      price: 0,
      cost: 0,
      track_stock: true,
      stock_quantity: 0,
      low_stock_threshold: 5,
    });
  };

  const openNewProductDialog = () => {
    resetForm();
    setIsProductDialogOpen(true);
  };

  const isLowStock = (product) => {
    return product.track_stock && 
           product.stock_quantity <= (product.low_stock_threshold || 5);
  };

  return (
    <div className="space-y-6" data-testid="products-page">
      <div className="page-header">
        <h1 className="page-title">Produits & Stocks</h1>
        {hasPermission('products:create') && (
          <Button onClick={openNewProductDialog} data-testid="add-product-btn">
            <Plus className="h-4 w-4 mr-2" />
            Nouveau produit
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="product-search"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-full sm:w-48" data-testid="category-filter">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Catégorie" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes catégories</SelectItem>
            <SelectItem value="consommable">Consommables</SelectItem>
            <SelectItem value="merchandising">Merchandising</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Stats */}
      <div className="flex gap-4 text-sm">
        <span>{filteredProducts.length} produit(s)</span>
        <span className="text-warning">
          {filteredProducts.filter(isLowStock).length} stock bas
        </span>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-8">
          <div className="loading-spinner" />
        </div>
      ) : (
        <div className="swiss-card p-0 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produit</TableHead>
                <TableHead>Catégorie</TableHead>
                <TableHead className="text-right">Prix</TableHead>
                <TableHead className="text-right">Coût</TableHead>
                <TableHead className="text-right">Stock</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Aucun produit trouvé
                  </TableCell>
                </TableRow>
              ) : (
                filteredProducts.map((product) => (
                  <TableRow 
                    key={product.product_id} 
                    className={cn(!product.is_active && "opacity-50")}
                    data-testid={`product-row-${product.product_id}`}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <div className="font-medium">{product.name}</div>
                          {product.subcategory && (
                            <div className="text-xs text-muted-foreground">
                              {productCategoryLabels[product.subcategory] || product.subcategory}
                            </div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs px-2 py-0.5 bg-muted uppercase">
                        {product.category}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(product.price)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-muted-foreground">
                      {product.cost ? formatCurrency(product.cost) : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      {product.track_stock ? (
                        <div className="flex items-center justify-end gap-2">
                          <span className={cn(
                            "font-mono",
                            isLowStock(product) && "text-destructive font-bold"
                          )}>
                            {product.stock_quantity}
                          </span>
                          {isLowStock(product) && (
                            <AlertTriangle className="h-4 w-4 text-warning" />
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {hasPermission('products:update') && product.track_stock && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openRestockDialog(product)}
                            data-testid={`restock-${product.product_id}`}
                          >
                            <PackagePlus className="h-4 w-4" />
                          </Button>
                        )}
                        {hasPermission('products:update') && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(product)}
                            data-testid={`edit-product-${product.product_id}`}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Add/Edit Product Dialog */}
      <Dialog open={isProductDialogOpen} onOpenChange={setIsProductDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingProduct ? 'Modifier le produit' : 'Nouveau produit'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nom *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                data-testid="product-name"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category">Catégorie *</Label>
                <Select 
                  value={formData.category} 
                  onValueChange={(value) => setFormData({ ...formData, category: value })}
                >
                  <SelectTrigger data-testid="product-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="consommable">Consommable</SelectItem>
                    <SelectItem value="merchandising">Merchandising</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="subcategory">Sous-catégorie</Label>
                <Select 
                  value={formData.subcategory} 
                  onValueChange={(value) => setFormData({ ...formData, subcategory: value })}
                >
                  <SelectTrigger data-testid="product-subcategory">
                    <SelectValue placeholder="Sélectionner" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(productCategoryLabels).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                data-testid="product-description"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="price">Prix de vente (€) *</Label>
                <Input
                  id="price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  required
                  data-testid="product-price"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cost">Coût d'achat (€)</Label>
                <Input
                  id="cost"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.cost}
                  onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
                  data-testid="product-cost"
                />
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="track_stock"
                checked={formData.track_stock}
                onCheckedChange={(checked) => setFormData({ ...formData, track_stock: checked })}
                data-testid="product-track-stock"
              />
              <Label htmlFor="track_stock">Gérer le stock</Label>
            </div>
            {formData.track_stock && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="stock_quantity">Stock initial</Label>
                  <Input
                    id="stock_quantity"
                    type="number"
                    min="0"
                    value={formData.stock_quantity}
                    onChange={(e) => setFormData({ ...formData, stock_quantity: e.target.value })}
                    data-testid="product-stock"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="low_stock_threshold">Seuil d'alerte</Label>
                  <Input
                    id="low_stock_threshold"
                    type="number"
                    min="0"
                    value={formData.low_stock_threshold}
                    onChange={(e) => setFormData({ ...formData, low_stock_threshold: e.target.value })}
                    data-testid="product-threshold"
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsProductDialogOpen(false)}>
                Annuler
              </Button>
              <Button type="submit" data-testid="save-product-btn">
                {editingProduct ? 'Enregistrer' : 'Créer'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Restock Dialog */}
      <Dialog open={isRestockDialogOpen} onOpenChange={setIsRestockDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              Réapprovisionner: {restockProduct?.name}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleRestock} className="space-y-4">
            <div className="text-sm text-muted-foreground">
              Stock actuel: <strong>{restockProduct?.stock_quantity}</strong>
            </div>
            <div className="space-y-2">
              <Label htmlFor="restock_quantity">Quantité à ajouter *</Label>
              <Input
                id="restock_quantity"
                type="number"
                min="1"
                value={restockQuantity}
                onChange={(e) => setRestockQuantity(e.target.value)}
                required
                data-testid="restock-quantity"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="restock_comment">Commentaire</Label>
              <Input
                id="restock_comment"
                value={restockComment}
                onChange={(e) => setRestockComment(e.target.value)}
                placeholder="Ex: Livraison fournisseur"
                data-testid="restock-comment"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsRestockDialogOpen(false)}>
                Annuler
              </Button>
              <Button type="submit" data-testid="confirm-restock-btn">
                Confirmer
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
