import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Switch } from '../components/ui/switch';
import { Checkbox } from '../components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../components/ui/dialog';
import { Save, Plus, X, Settings2, CreditCard, Package, ShoppingCart, Calendar, Receipt, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

export function SettingsPage() {
  const { hasPermission, hasRole } = useAuth();
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [newPaymentMethod, setNewPaymentMethod] = useState('');
  const [newExpenseCategory, setNewExpenseCategory] = useState('');
  const [newProductCategory, setNewProductCategory] = useState('');
  const [newProductSubCategory, setNewProductSubCategory] = useState({});
  const [newEventType, setNewEventType] = useState('');
  const [newEventFormat, setNewEventFormat] = useState('');

  const canEdit = hasRole('president') || hasPermission('settings:update');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const data = await api.getSettings();
      if (Array.isArray(data.product_categories)) {
        const obj = {};
        data.product_categories.forEach(cat => { obj[cat] = []; });
        data.product_categories = obj;
      }
      if (!data.pos_visible_subcategories) {
        data.pos_visible_subcategories = [];
      }
      setSettings(data);
    } catch (err) {
      toast.error('Erreur lors du chargement des parametres');
    } finally {
      setLoading(false);
    }
  };

  const saveField = useCallback(async (field, value) => {
    try {
      await api.updateSettings({ [field]: value });
    } catch (err) {
      toast.error('Erreur lors de la sauvegarde');
      loadSettings();
    }
  }, []);

  const handleSaveGeneral = async () => {
    try {
      setSaving(true);
      await api.updateSettings({
        current_season: settings.current_season,
        annual_subscription_amount: settings.annual_subscription_amount,
        enable_trial_rule: settings.enable_trial_rule,
        enable_trial_alerts: settings.enable_trial_alerts,
        max_free_participations: settings.max_free_participations,
        season_renewal_day: settings.season_renewal_day,
        season_renewal_month: settings.season_renewal_month,
        pack_tournois_price: settings.pack_tournois_price,
        carte_snack_price: settings.carte_snack_price,
        carte_snack_value: settings.carte_snack_value,
        cards_are_permanent: settings.cards_are_permanent,
      });
      toast.success('Parametres enregistres');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleResetFinancial = async () => {
    try {
      setResetting(true);
      const result = await api.resetFinancialData();
      toast.success(result.message);
      setResetDialogOpen(false);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setResetting(false);
    }
  };

  const addToList = async (list, value, setter) => {
    if (!value || !settings) return;
    const current = settings[list] || [];
    if (current.includes(value)) return;
    const updated = [...current, value];
    setSettings({ ...settings, [list]: updated });
    setter('');
    await saveField(list, updated);
    toast.success('Ajoute');
  };

  const removeFromList = async (list, value) => {
    if (!settings) return;
    const updated = (settings[list] || []).filter(v => v !== value);
    setSettings({ ...settings, [list]: updated });
    await saveField(list, updated);
    toast.success('Supprime');
  };

  // Product categories with sub-categories
  const addProductCategory = async (catName) => {
    if (!catName || !settings) return;
    const cats = { ...(settings.product_categories || {}) };
    const key = catName.toLowerCase().trim();
    if (cats[key] !== undefined) return;
    cats[key] = [];
    setSettings({ ...settings, product_categories: cats });
    setNewProductCategory('');
    await saveField('product_categories', cats);
    toast.success('Categorie ajoutee');
  };

  const removeProductCategory = async (catKey) => {
    if (!settings) return;
    const cats = { ...(settings.product_categories || {}) };
    const removedSubs = cats[catKey] || [];
    delete cats[catKey];
    // Also remove those subs from POS whitelist
    const posVisible = (settings.pos_visible_subcategories || []).filter(s => !removedSubs.includes(s));
    setSettings({ ...settings, product_categories: cats, pos_visible_subcategories: posVisible });
    await saveField('product_categories', cats);
    await saveField('pos_visible_subcategories', posVisible);
    toast.success('Categorie supprimee');
  };

  const addProductSubCategory = async (catKey) => {
    const value = (newProductSubCategory[catKey] || '').trim().toLowerCase();
    if (!value || !settings) return;
    const cats = { ...(settings.product_categories || {}) };
    const subs = [...(cats[catKey] || [])];
    if (subs.includes(value)) return;
    subs.push(value);
    cats[catKey] = subs;
    setSettings({ ...settings, product_categories: cats });
    setNewProductSubCategory({ ...newProductSubCategory, [catKey]: '' });
    await saveField('product_categories', cats);
    toast.success('Sous-categorie ajoutee');
  };

  const removeProductSubCategory = async (catKey, subValue) => {
    if (!settings) return;
    const cats = { ...(settings.product_categories || {}) };
    cats[catKey] = (cats[catKey] || []).filter(s => s !== subValue);
    // Also remove from POS whitelist
    const posVisible = (settings.pos_visible_subcategories || []).filter(s => s !== subValue);
    setSettings({ ...settings, product_categories: cats, pos_visible_subcategories: posVisible });
    await saveField('product_categories', cats);
    await saveField('pos_visible_subcategories', posVisible);
    toast.success('Sous-categorie supprimee');
  };

  // POS visibility toggle
  const togglePosSubcategory = async (subValue) => {
    if (!settings) return;
    const current = settings.pos_visible_subcategories || [];
    const updated = current.includes(subValue)
      ? current.filter(s => s !== subValue)
      : [...current, subValue];
    setSettings({ ...settings, pos_visible_subcategories: updated });
    await saveField('pos_visible_subcategories', updated);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="loading-spinner" />
      </div>
    );
  }

  const productCategories = settings?.product_categories || {};
  const allSubcategories = Object.entries(productCategories).flatMap(([cat, subs]) =>
    (subs || []).map(sub => ({ cat, sub }))
  );
  const posVisible = settings?.pos_visible_subcategories || [];

  return (
    <div className="max-w-4xl" data-testid="settings-page">
      <div className="page-header mb-6">
        <h1 className="page-title">Parametres</h1>
      </div>

      <Tabs defaultValue="general" className="w-full">
        <TabsList className="w-full grid grid-cols-3 md:grid-cols-6 h-auto gap-1 bg-muted/50 p-1" data-testid="settings-tabs">
          <TabsTrigger value="general" className="text-xs gap-1.5 py-2" data-testid="tab-general">
            <Settings2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">General</span>
          </TabsTrigger>
          <TabsTrigger value="payments" className="text-xs gap-1.5 py-2" data-testid="tab-payments">
            <CreditCard className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Paiements</span>
          </TabsTrigger>
          <TabsTrigger value="products" className="text-xs gap-1.5 py-2" data-testid="tab-products">
            <Package className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Produits</span>
          </TabsTrigger>
          <TabsTrigger value="pos" className="text-xs gap-1.5 py-2" data-testid="tab-pos">
            <ShoppingCart className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Caisse</span>
          </TabsTrigger>
          <TabsTrigger value="events" className="text-xs gap-1.5 py-2" data-testid="tab-events">
            <Calendar className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Evenements</span>
          </TabsTrigger>
          <TabsTrigger value="expenses" className="text-xs gap-1.5 py-2" data-testid="tab-expenses">
            <Receipt className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Depenses</span>
          </TabsTrigger>
        </TabsList>

        {/* === GENERAL === */}
        <TabsContent value="general" className="space-y-6 mt-6">
          <div className="swiss-card space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">Parametres generaux</h2>
              {canEdit && (
                <Button onClick={handleSaveGeneral} disabled={saving} size="sm" data-testid="save-settings-btn">
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? 'Enregistrement...' : 'Enregistrer'}
                </Button>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="current_season">Saison en cours</Label>
                <Input
                  id="current_season"
                  value={settings?.current_season || ''}
                  onChange={(e) => setSettings({ ...settings, current_season: e.target.value })}
                  disabled={!canEdit}
                  data-testid="setting-season"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="annual_subscription_amount">Montant cotisation annuelle (EUR)</Label>
                <Input
                  id="annual_subscription_amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={settings?.annual_subscription_amount || 0}
                  onChange={(e) => setSettings({ ...settings, annual_subscription_amount: parseFloat(e.target.value) })}
                  disabled={!canEdit}
                  data-testid="setting-subscription-amount"
                />
              </div>
            </div>
          </div>

          <div className="swiss-card space-y-6">
            <h2 className="text-lg font-bold">Renouvellement de saison</h2>
            <p className="text-sm text-muted-foreground">Date a laquelle la nouvelle saison commence automatiquement (jour/mois).</p>
            <div className="grid grid-cols-2 gap-4 max-w-xs">
              <div className="space-y-2">
                <Label>Jour</Label>
                <Input
                  type="number"
                  min="1"
                  max="31"
                  value={settings?.season_renewal_day || 1}
                  onChange={(e) => setSettings({ ...settings, season_renewal_day: parseInt(e.target.value) })}
                  disabled={!canEdit}
                  data-testid="setting-renewal-day"
                />
              </div>
              <div className="space-y-2">
                <Label>Mois</Label>
                <Input
                  type="number"
                  min="1"
                  max="12"
                  value={settings?.season_renewal_month || 9}
                  onChange={(e) => setSettings({ ...settings, season_renewal_month: parseInt(e.target.value) })}
                  disabled={!canEdit}
                  data-testid="setting-renewal-month"
                />
              </div>
            </div>
          </div>

          <div className="swiss-card space-y-6">
            <h2 className="text-lg font-bold">Pack Tournois & Carte Snack</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <Label>Prix Pack Tournois (EUR)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.5"
                  value={settings?.pack_tournois_price ?? 5}
                  onChange={(e) => setSettings({ ...settings, pack_tournois_price: parseFloat(e.target.value) })}
                  disabled={!canEdit}
                  data-testid="setting-pack-tournois-price"
                />
              </div>
              <div className="space-y-2">
                <Label>Prix Carte Snack (EUR)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.5"
                  value={settings?.carte_snack_price ?? 10}
                  onChange={(e) => setSettings({ ...settings, carte_snack_price: parseFloat(e.target.value) })}
                  disabled={!canEdit}
                  data-testid="setting-carte-snack-price"
                />
              </div>
              <div className="space-y-2">
                <Label>Valeur reelle Carte Snack (EUR)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.5"
                  value={settings?.carte_snack_value ?? 12}
                  onChange={(e) => setSettings({ ...settings, carte_snack_value: parseFloat(e.target.value) })}
                  disabled={!canEdit}
                  data-testid="setting-carte-snack-value"
                />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Cartes definitives</Label>
                <p className="text-sm text-muted-foreground">
                  Si active, les cartes restent valables jusqu'a epuisement. Sinon, elles expirent a la fin de saison.
                </p>
              </div>
              <Switch
                checked={settings?.cards_are_permanent || false}
                onCheckedChange={(checked) => setSettings({ ...settings, cards_are_permanent: checked })}
                disabled={!canEdit}
                data-testid="setting-cards-permanent"
              />
            </div>
          </div>

          <div className="swiss-card space-y-6">
            <h2 className="text-lg font-bold">Regle des participations avant adhesion</h2>
            <div className="flex items-center justify-between">
              <div>
                <Label>Activer la regle d'essai</Label>
                <p className="text-sm text-muted-foreground">
                  Permet aux nouveaux participants de participer a un nombre limite d'evenements avant d'adherer
                </p>
              </div>
              <Switch
                checked={settings?.enable_trial_rule || false}
                onCheckedChange={(checked) => setSettings({ ...settings, enable_trial_rule: checked })}
                disabled={!canEdit}
                data-testid="setting-trial-rule"
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Afficher les alertes</Label>
                <p className="text-sm text-muted-foreground">
                  Affiche des alertes visuelles pour les membres approchant le seuil
                </p>
              </div>
              <Switch
                checked={settings?.enable_trial_alerts || false}
                onCheckedChange={(checked) => setSettings({ ...settings, enable_trial_alerts: checked })}
                disabled={!canEdit}
                data-testid="setting-trial-alerts"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="max_free_participations">Nombre d'evenements autorises avant adhesion</Label>
              <Input
                id="max_free_participations"
                type="number"
                min="1"
                max="10"
                value={settings?.max_free_participations || 3}
                onChange={(e) => setSettings({ ...settings, max_free_participations: parseInt(e.target.value) })}
                disabled={!canEdit}
                className="w-32"
                data-testid="setting-max-participations"
              />
            </div>
          </div>

          {/* Danger Zone */}
          {hasRole('president') && (
            <div className="swiss-card border-destructive/30 space-y-4">
              <h2 className="text-lg font-bold text-destructive flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Zone de reinitialisation
              </h2>
              <p className="text-sm text-muted-foreground">
                Supprime toutes les donnees financieres : ventes, depenses, cotisations, archives, cartes snack, packs tournois et mouvements de stock. Les produits, membres et evenements sont conserves.
              </p>
              <Button
                variant="destructive"
                onClick={() => setResetDialogOpen(true)}
                data-testid="reset-financial-btn"
              >
                Reinitialiser les donnees financieres
              </Button>
            </div>
          )}
        </TabsContent>

        {/* === PAYMENTS === */}
        <TabsContent value="payments" className="mt-6">
          <div className="swiss-card space-y-4">
            <h2 className="text-lg font-bold">Modes de paiement</h2>
            <p className="text-sm text-muted-foreground">Les modes de paiement disponibles dans l'application.</p>
            <div className="flex flex-wrap gap-2">
              {settings?.payment_methods?.map((method) => (
                <div key={method} className="flex items-center gap-1.5 bg-muted px-3 py-1.5 rounded-md">
                  <span className="text-sm capitalize">{method}</span>
                  {canEdit && (
                    <button onClick={() => removeFromList('payment_methods', method)} className="text-muted-foreground hover:text-destructive ml-1" data-testid={`remove-payment-${method}`}>
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {canEdit && (
              <div className="flex gap-2 max-w-md">
                <Input value={newPaymentMethod} onChange={(e) => setNewPaymentMethod(e.target.value)} placeholder="Nouveau mode de paiement" className="flex-1" data-testid="new-payment-method"
                  onKeyDown={(e) => e.key === 'Enter' && addToList('payment_methods', newPaymentMethod.toLowerCase(), setNewPaymentMethod)} />
                <Button variant="outline" onClick={() => addToList('payment_methods', newPaymentMethod.toLowerCase(), setNewPaymentMethod)} data-testid="add-payment-method-btn">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </TabsContent>

        {/* === PRODUCTS & CATEGORIES === */}
        <TabsContent value="products" className="mt-6">
          <div className="swiss-card space-y-4">
            <h2 className="text-lg font-bold">Categories de produits</h2>
            <p className="text-sm text-muted-foreground">Chaque categorie peut avoir des sous-categories pour organiser vos produits.</p>
            
            <div className="space-y-4">
              {Object.entries(productCategories).map(([catKey, subCats]) => (
                <div key={catKey} className="border border-border rounded-lg p-4 space-y-3 bg-muted/20">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold capitalize text-base">{catKey}</span>
                    {canEdit && (
                      <button onClick={() => removeProductCategory(catKey)} className="text-muted-foreground hover:text-destructive" data-testid={`remove-product-cat-${catKey}`}>
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2 pl-3">
                    {(subCats || []).map((sub) => (
                      <div key={sub} className="flex items-center gap-1 bg-background border border-border px-2.5 py-1 rounded text-xs">
                        <span className="capitalize">{sub}</span>
                        {canEdit && (
                          <button onClick={() => removeProductSubCategory(catKey, sub)} className="text-muted-foreground hover:text-destructive" data-testid={`remove-sub-${catKey}-${sub}`}>
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    ))}
                    {(subCats || []).length === 0 && (
                      <span className="text-xs text-muted-foreground italic">Aucune sous-categorie</span>
                    )}
                  </div>
                  {canEdit && (
                    <div className="flex gap-2 pl-3 max-w-sm">
                      <Input
                        value={newProductSubCategory[catKey] || ''}
                        onChange={(e) => setNewProductSubCategory({ ...newProductSubCategory, [catKey]: e.target.value })}
                        placeholder="Nouvelle sous-categorie..."
                        className="flex-1 h-8 text-sm"
                        data-testid={`new-sub-${catKey}`}
                        onKeyDown={(e) => e.key === 'Enter' && addProductSubCategory(catKey)}
                      />
                      <Button variant="outline" size="sm" onClick={() => addProductSubCategory(catKey)} data-testid={`add-sub-${catKey}-btn`}>
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {canEdit && (
              <div className="flex gap-2 max-w-md">
                <Input value={newProductCategory} onChange={(e) => setNewProductCategory(e.target.value)} placeholder="Nouvelle categorie de produits" className="flex-1" data-testid="new-product-category"
                  onKeyDown={(e) => e.key === 'Enter' && addProductCategory(newProductCategory)} />
                <Button variant="outline" onClick={() => addProductCategory(newProductCategory)} data-testid="add-product-category-btn">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </TabsContent>

        {/* === POS WHITELIST === */}
        <TabsContent value="pos" className="mt-6">
          <div className="swiss-card space-y-4">
            <h2 className="text-lg font-bold">Sous-categories visibles en caisse</h2>
            <p className="text-sm text-muted-foreground">
              Selectionnez les sous-categories qui doivent apparaitre dans la caisse rapide. Les categories non cochees ne seront utilisees que pour la comptabilite.
            </p>

            {allSubcategories.length === 0 ? (
              <p className="text-sm text-muted-foreground italic py-4">
                Aucune sous-categorie disponible. Ajoutez des sous-categories dans l'onglet "Produits" d'abord.
              </p>
            ) : (
              <div className="space-y-4">
                {Object.entries(productCategories).map(([catKey, subs]) => {
                  if (!subs || subs.length === 0) return null;
                  return (
                    <div key={catKey} className="space-y-2">
                      <h3 className="text-sm font-semibold capitalize text-muted-foreground uppercase tracking-wider">{catKey}</h3>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 pl-2">
                        {subs.map(sub => (
                          <label
                            key={sub}
                            className="flex items-center gap-2.5 p-2.5 rounded-md border border-border bg-muted/20 cursor-pointer hover:bg-muted/40 transition-colors"
                            data-testid={`pos-toggle-${sub}`}
                          >
                            <Checkbox
                              checked={posVisible.includes(sub)}
                              onCheckedChange={() => canEdit && togglePosSubcategory(sub)}
                              disabled={!canEdit}
                            />
                            <span className="text-sm capitalize">{sub}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="border-t border-border pt-4 mt-4">
              <p className="text-xs text-muted-foreground">
                {posVisible.length} sous-categorie(s) visible(s) en caisse sur {allSubcategories.length} au total.
              </p>
            </div>
          </div>
        </TabsContent>

        {/* === EVENTS === */}
        <TabsContent value="events" className="space-y-6 mt-6">
          <div className="swiss-card space-y-4">
            <h2 className="text-lg font-bold">Types d'evenements</h2>
            <div className="flex flex-wrap gap-2">
              {settings?.event_types?.map((type) => (
                <div key={type} className="flex items-center gap-1.5 bg-muted px-3 py-1.5 rounded-md">
                  <span className="text-sm capitalize">{type.replace(/_/g, ' ')}</span>
                  {canEdit && (
                    <button onClick={() => removeFromList('event_types', type)} className="text-muted-foreground hover:text-destructive ml-1" data-testid={`remove-event-type-${type}`}>
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {canEdit && (
              <div className="flex gap-2 max-w-md">
                <Input value={newEventType} onChange={(e) => setNewEventType(e.target.value)} placeholder="Nouveau type d'evenement" className="flex-1" data-testid="new-event-type"
                  onKeyDown={(e) => e.key === 'Enter' && addToList('event_types', newEventType.toLowerCase().replace(/\s+/g, '_'), setNewEventType)} />
                <Button variant="outline" onClick={() => addToList('event_types', newEventType.toLowerCase().replace(/\s+/g, '_'), setNewEventType)} data-testid="add-event-type-btn">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          <div className="swiss-card space-y-4">
            <h2 className="text-lg font-bold">Formats de tournoi</h2>
            <div className="flex flex-wrap gap-2">
              {settings?.event_formats?.map((format) => (
                <div key={format} className="flex items-center gap-1.5 bg-muted px-3 py-1.5 rounded-md">
                  <span className="text-sm capitalize">{format.replace(/_/g, ' ')}</span>
                  {canEdit && (
                    <button onClick={() => removeFromList('event_formats', format)} className="text-muted-foreground hover:text-destructive ml-1" data-testid={`remove-event-format-${format}`}>
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {canEdit && (
              <div className="flex gap-2 max-w-md">
                <Input value={newEventFormat} onChange={(e) => setNewEventFormat(e.target.value)} placeholder="Nouveau format" className="flex-1" data-testid="new-event-format"
                  onKeyDown={(e) => e.key === 'Enter' && addToList('event_formats', newEventFormat.toLowerCase().replace(/\s+/g, '_'), setNewEventFormat)} />
                <Button variant="outline" onClick={() => addToList('event_formats', newEventFormat.toLowerCase().replace(/\s+/g, '_'), setNewEventFormat)} data-testid="add-event-format-btn">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </TabsContent>

        {/* === EXPENSES === */}
        <TabsContent value="expenses" className="mt-6">
          <div className="swiss-card space-y-4">
            <h2 className="text-lg font-bold">Categories de depenses</h2>
            <div className="flex flex-wrap gap-2">
              {settings?.expense_categories?.map((category) => (
                <div key={category} className="flex items-center gap-1.5 bg-muted px-3 py-1.5 rounded-md">
                  <span className="text-sm capitalize">{category}</span>
                  {canEdit && (
                    <button onClick={() => removeFromList('expense_categories', category)} className="text-muted-foreground hover:text-destructive ml-1" data-testid={`remove-expense-${category}`}>
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {canEdit && (
              <div className="flex gap-2 max-w-md">
                <Input value={newExpenseCategory} onChange={(e) => setNewExpenseCategory(e.target.value)} placeholder="Nouvelle categorie" className="flex-1" data-testid="new-expense-category"
                  onKeyDown={(e) => e.key === 'Enter' && addToList('expense_categories', newExpenseCategory.toLowerCase(), setNewExpenseCategory)} />
                <Button variant="outline" onClick={() => addToList('expense_categories', newExpenseCategory.toLowerCase(), setNewExpenseCategory)} data-testid="add-expense-category-btn">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Reset Financial Data Dialog */}
      <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Reinitialiser les donnees financieres
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p className="font-medium">Cette action est irreversible et va supprimer :</p>
            <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
              <li>Toutes les <strong>ventes</strong></li>
              <li>Toutes les <strong>depenses</strong></li>
              <li>Toutes les <strong>cotisations</strong> et leurs <strong>archives</strong></li>
              <li>Toutes les <strong>cartes snack</strong></li>
              <li>Tous les <strong>packs tournois</strong></li>
              <li>Tous les <strong>mouvements de stock</strong></li>
            </ul>
            <p className="text-success font-medium">Conserve : produits, stocks, membres, evenements, parametres.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetDialogOpen(false)}>Annuler</Button>
            <Button variant="destructive" onClick={handleResetFinancial} disabled={resetting} data-testid="confirm-reset-financial-btn">
              {resetting ? 'Reinitialisation...' : 'Confirmer la reinitialisation'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
