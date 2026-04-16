import { useState, useEffect, useRef } from 'react';
import { api } from '../lib/api';
import { formatCurrency, cn } from '../lib/utils';
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
  Edit, PackagePlus, ImagePlus, X, Trash2
} from 'lucide-react';
import { toast } from 'sonner';

export function ProductsPage() {
  const { hasPermission } = useAuth();
  const [products, setProducts] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [isProductDialogOpen, setIsProductDialogOpen] = useState(false);
  const [isRestockDialogOpen, setIsRestockDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [deletingProduct, setDeletingProduct] = useState(null);
  const [restockProduct, setRestockProduct] = useState(null);
  const [restockQuantity, setRestockQuantity] = useState(0);
  const [restockComment, setRestockComment] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [imageRemoved, setImageRemoved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    subcategory: '',
    description: '',
    price: 0,
    cost: 0,
    track_stock: true,
    stock_quantity: 0,
    low_stock_threshold: 5,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [productsData, settingsData] = await Promise.all([
        api.getProducts({ active_only: false }),
        api.getSettings(),
      ]);
      setProducts(productsData);
      if (Array.isArray(settingsData.product_categories)) {
        const obj = {};
        settingsData.product_categories.forEach(c => { obj[c] = []; });
        settingsData.product_categories = obj;
      }
      setSettings(settingsData);
    } catch (err) {
      toast.error('Erreur lors du chargement');
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
      setUploading(true);
      const payload = {
        ...formData,
        subcategory: formData.subcategory === 'none' ? null : (formData.subcategory || null),
        price: parseFloat(formData.price),
        cost: formData.cost ? parseFloat(formData.cost) : null,
        stock_quantity: parseInt(formData.stock_quantity),
        low_stock_threshold: parseInt(formData.low_stock_threshold),
      };

      let productId;
      if (editingProduct) {
        await api.updateProduct(editingProduct.product_id, payload);
        productId = editingProduct.product_id;
        toast.success('Produit mis a jour');
      } else {
        const result = await api.createProduct(payload);
        productId = result.product_id;
        toast.success('Produit cree');
      }

      // Upload image if selected
      if (imageFile && productId) {
        try {
          await api.uploadProductImage(productId, imageFile);
          toast.success('Image uploadee');
        } catch (imgErr) {
          toast.error('Erreur upload image: ' + imgErr.message);
        }
      } else if (imageRemoved && editingProduct) {
        // User explicitly removed the image
        try {
          await api.deleteProductImage(editingProduct.product_id);
        } catch (imgErr) {
          toast.error('Erreur suppression image: ' + imgErr.message);
        }
      }

      setIsProductDialogOpen(false);
      resetForm();
      loadData();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleRestock = async (e) => {
    e.preventDefault();
    try {
      await api.restockProduct(restockProduct.product_id, {
        quantity: parseInt(restockQuantity),
        comment: restockComment,
      });
      toast.success('Stock mis a jour');
      setIsRestockDialogOpen(false);
      setRestockProduct(null);
      setRestockQuantity(0);
      setRestockComment('');
      loadData();
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
    setImageFile(null);
    setImagePreview(product.image_url || null);
    setImageRemoved(false);
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
    const cats = settings?.product_categories || {};
    const firstCat = Object.keys(cats)[0] || '';
    setFormData({
      name: '',
      category: firstCat,
      subcategory: '',
      description: '',
      price: 0,
      cost: 0,
      track_stock: true,
      stock_quantity: 0,
      low_stock_threshold: 5,
    });
    setImageFile(null);
    setImagePreview(null);
    setImageRemoved(false);
  };

  const openNewProductDialog = () => {
    resetForm();
    setIsProductDialogOpen(true);
  };

  const handleImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Fichier trop volumineux (max 5 Mo)');
      return;
    }
    setImageFile(file);
    setImageRemoved(false);
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result);
    reader.readAsDataURL(file);
  };

  const clearImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setImageRemoved(true);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const isLowStock = (product) => {
    return product.track_stock && 
           product.stock_quantity <= (product.low_stock_threshold || 5);
  };

  const openDeleteDialog = (product) => {
    setDeletingProduct(product);
    setIsDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deletingProduct) return;
    try {
      await api.deleteProduct(deletingProduct.product_id);
      toast.success('Produit supprime');
      setIsDeleteDialogOpen(false);
      setDeletingProduct(null);
      loadData();
    } catch (err) {
      toast.error(err.message);
    }
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
            <SelectValue placeholder="Categorie" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes categories</SelectItem>
            {Object.keys(settings?.product_categories || {}).map(cat => (
              <SelectItem key={cat} value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</SelectItem>
            ))}
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
                <TableHead className="w-12"></TableHead>
                <TableHead>Produit</TableHead>
                <TableHead>Categorie</TableHead>
                <TableHead className="text-right">Prix</TableHead>
                <TableHead className="text-right">Cout</TableHead>
                <TableHead className="text-right">Stock</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Aucun produit trouve
                  </TableCell>
                </TableRow>
              ) : (
                filteredProducts.map((product) => (
                  <TableRow 
                    key={product.product_id} 
                    className={cn(!product.is_active && "opacity-50")}
                    data-testid={`product-row-${product.product_id}`}
                  >
                    <TableCell className="w-12 pr-0">
                      {product.image_url ? (
                        <img src={product.image_url} alt="" className="w-9 h-9 object-cover rounded" />
                      ) : (
                        <div className="w-9 h-9 rounded bg-muted flex items-center justify-center">
                          <Package className="h-4 w-4 text-muted-foreground/40" />
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{product.name}</div>
                        {product.subcategory && (
                          <div className="text-xs text-muted-foreground capitalize">
                            {product.subcategory}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs px-2 py-0.5 bg-muted uppercase rounded">
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
                        {hasPermission('products:update') && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            onClick={() => openDeleteDialog(product)}
                            data-testid={`delete-product-${product.product_id}`}
                          >
                            <Trash2 className="h-4 w-4" />
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
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingProduct ? 'Modifier le produit' : 'Nouveau produit'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Image Upload */}
            <div className="space-y-2">
              <Label>Photo du produit</Label>
              <div className="flex items-center gap-3">
                {imagePreview ? (
                  <div className="relative">
                    <img src={imagePreview} alt="Preview" className="w-20 h-20 object-cover rounded-lg border border-border" />
                    <button
                      type="button"
                      onClick={clearImage}
                      className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-0.5"
                      data-testid="clear-product-image"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="w-20 h-20 rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 transition-colors"
                    data-testid="image-upload-zone"
                  >
                    <ImagePlus className="h-5 w-5 text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground mt-1">Ajouter</span>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={handleImageSelect}
                  className="hidden"
                  data-testid="product-image-input"
                />
                {imagePreview && (
                  <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                    Changer
                  </Button>
                )}
              </div>
            </div>

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
                <Label htmlFor="category">Categorie *</Label>
                <Select 
                  value={formData.category} 
                  onValueChange={(value) => setFormData({ ...formData, category: value, subcategory: '' })}
                >
                  <SelectTrigger data-testid="product-category">
                    <SelectValue placeholder="Selectionner" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.keys(settings?.product_categories || {}).map(cat => (
                      <SelectItem key={cat} value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="subcategory">Sous-categorie</Label>
                <Select 
                  value={formData.subcategory} 
                  onValueChange={(value) => setFormData({ ...formData, subcategory: value })}
                >
                  <SelectTrigger data-testid="product-subcategory">
                    <SelectValue placeholder="Selectionner" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucune</SelectItem>
                    {((settings?.product_categories || {})[formData.category] || []).map(sub => (
                      <SelectItem key={sub} value={sub}>{sub.charAt(0).toUpperCase() + sub.slice(1)}</SelectItem>
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
                <Label htmlFor="price">Prix de vente (EUR) *</Label>
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
                <Label htmlFor="cost">Cout d'achat (EUR)</Label>
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
              <Label htmlFor="track_stock">Gerer le stock</Label>
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
              <Button type="submit" disabled={uploading} data-testid="save-product-btn">
                {uploading ? 'Enregistrement...' : (editingProduct ? 'Enregistrer' : 'Creer')}
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
              Reapprovisionner: {restockProduct?.name}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleRestock} className="space-y-4">
            <div className="text-sm text-muted-foreground">
              Stock actuel: <strong>{restockProduct?.stock_quantity}</strong>
            </div>
            <div className="space-y-2">
              <Label htmlFor="restock_quantity">Quantite a ajouter *</Label>
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

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Supprimer le produit</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Etes-vous sur de vouloir supprimer <strong>{deletingProduct?.name}</strong> ? Cette action est irreversible.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Annuler
            </Button>
            <Button variant="destructive" onClick={handleDelete} data-testid="confirm-delete-product-btn">
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
