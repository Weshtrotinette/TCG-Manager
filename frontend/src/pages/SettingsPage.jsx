import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Switch } from '../components/ui/switch';
import { Save, Plus, X } from 'lucide-react';
import { toast } from 'sonner';

export function SettingsPage() {
  const { hasPermission, hasRole } = useAuth();
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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
      // Migrate: if product_categories is a flat array, convert to object
      if (Array.isArray(data.product_categories)) {
        const obj = {};
        data.product_categories.forEach(cat => { obj[cat] = []; });
        data.product_categories = obj;
      }
      setSettings(data);
    } catch (err) {
      toast.error('Erreur lors du chargement des paramètres');
    } finally {
      setLoading(false);
    }
  };

  // Save just the specific field immediately
  const saveField = useCallback(async (field, value) => {
    try {
      await api.updateSettings({ [field]: value });
    } catch (err) {
      toast.error('Erreur lors de la sauvegarde');
      loadSettings(); // Reload to revert
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
      });
      toast.success('Paramètres enregistrés');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  // List operations with auto-save
  const addToList = async (list, value, setter) => {
    if (!value || !settings) return;
    const current = settings[list] || [];
    if (current.includes(value)) return;
    const updated = [...current, value];
    setSettings({ ...settings, [list]: updated });
    setter('');
    await saveField(list, updated);
    toast.success('Ajouté');
  };

  const removeFromList = async (list, value) => {
    if (!settings) return;
    const updated = (settings[list] || []).filter(v => v !== value);
    setSettings({ ...settings, [list]: updated });
    await saveField(list, updated);
    toast.success('Supprimé');
  };

  // Product categories with sub-categories
  const addProductCategory = async (catName) => {
    if (!catName || !settings) return;
    const cats = { ...(settings.product_categories || {}) };
    const key = catName.toLowerCase();
    if (cats[key]) return;
    cats[key] = [];
    setSettings({ ...settings, product_categories: cats });
    setNewProductCategory('');
    await saveField('product_categories', cats);
    toast.success('Catégorie ajoutée');
  };

  const removeProductCategory = async (catKey) => {
    if (!settings) return;
    const cats = { ...(settings.product_categories || {}) };
    delete cats[catKey];
    setSettings({ ...settings, product_categories: cats });
    await saveField('product_categories', cats);
    toast.success('Catégorie supprimée');
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
    toast.success('Sous-catégorie ajoutée');
  };

  const removeProductSubCategory = async (catKey, subValue) => {
    if (!settings) return;
    const cats = { ...(settings.product_categories || {}) };
    cats[catKey] = (cats[catKey] || []).filter(s => s !== subValue);
    setSettings({ ...settings, product_categories: cats });
    await saveField('product_categories', cats);
    toast.success('Sous-catégorie supprimée');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="loading-spinner" />
      </div>
    );
  }

  const productCategories = settings?.product_categories || {};

  return (
    <div className="space-y-6 max-w-3xl" data-testid="settings-page">
      <div className="page-header">
        <h1 className="page-title">Paramètres</h1>
        {canEdit && (
          <Button onClick={handleSaveGeneral} disabled={saving} data-testid="save-settings-btn">
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Enregistrement...' : 'Enregistrer'}
          </Button>
        )}
      </div>

      {/* General Settings */}
      <div className="swiss-card space-y-6">
        <h2 className="text-lg font-bold">Paramètres généraux</h2>
        
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
            <Label htmlFor="annual_subscription_amount">Montant cotisation annuelle (€)</Label>
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

      {/* Trial Rule Settings */}
      <div className="swiss-card space-y-6">
        <h2 className="text-lg font-bold">Règle des participations avant adhésion</h2>
        
        <div className="flex items-center justify-between">
          <div>
            <Label>Activer la règle d'essai</Label>
            <p className="text-sm text-muted-foreground">
              Permet aux nouveaux participants de participer à un nombre limité d'événements avant d'adhérer
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
              Affiche des alertes visuelles pour les membres approchant ou dépassant le seuil
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
          <Label htmlFor="max_free_participations">Nombre d'événements autorisés avant adhésion</Label>
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

      {/* Payment Methods */}
      <div className="swiss-card space-y-4">
        <h2 className="text-lg font-bold">Modes de paiement</h2>
        <div className="flex flex-wrap gap-2">
          {settings?.payment_methods?.map((method) => (
            <div key={method} className="flex items-center gap-1 bg-muted px-3 py-1">
              <span className="text-sm capitalize">{method}</span>
              {canEdit && (
                <button onClick={() => removeFromList('payment_methods', method)} className="text-muted-foreground hover:text-destructive" data-testid={`remove-payment-${method}`}>
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <Input value={newPaymentMethod} onChange={(e) => setNewPaymentMethod(e.target.value)} placeholder="Nouveau mode de paiement" className="flex-1" data-testid="new-payment-method"
              onKeyDown={(e) => e.key === 'Enter' && addToList('payment_methods', newPaymentMethod.toLowerCase(), setNewPaymentMethod)} />
            <Button variant="outline" onClick={() => addToList('payment_methods', newPaymentMethod.toLowerCase(), setNewPaymentMethod)} data-testid="add-payment-method-btn">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Expense Categories */}
      <div className="swiss-card space-y-4">
        <h2 className="text-lg font-bold">Catégories de dépenses</h2>
        <div className="flex flex-wrap gap-2">
          {settings?.expense_categories?.map((category) => (
            <div key={category} className="flex items-center gap-1 bg-muted px-3 py-1">
              <span className="text-sm capitalize">{category}</span>
              {canEdit && (
                <button onClick={() => removeFromList('expense_categories', category)} className="text-muted-foreground hover:text-destructive" data-testid={`remove-expense-${category}`}>
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <Input value={newExpenseCategory} onChange={(e) => setNewExpenseCategory(e.target.value)} placeholder="Nouvelle catégorie" className="flex-1" data-testid="new-expense-category"
              onKeyDown={(e) => e.key === 'Enter' && addToList('expense_categories', newExpenseCategory.toLowerCase(), setNewExpenseCategory)} />
            <Button variant="outline" onClick={() => addToList('expense_categories', newExpenseCategory.toLowerCase(), setNewExpenseCategory)} data-testid="add-expense-category-btn">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Product Categories with Sub-Categories */}
      <div className="swiss-card space-y-4">
        <h2 className="text-lg font-bold">Catégories de produits</h2>
        <p className="text-sm text-muted-foreground">Chaque catégorie peut avoir des sous-catégories pour organiser vos produits.</p>
        
        <div className="space-y-4">
          {Object.entries(productCategories).map(([catKey, subCats]) => (
            <div key={catKey} className="border border-border rounded-md p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-medium capitalize text-base">{catKey}</span>
                {canEdit && (
                  <button onClick={() => removeProductCategory(catKey)} className="text-muted-foreground hover:text-destructive" data-testid={`remove-product-cat-${catKey}`}>
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-2 pl-2">
                {(subCats || []).map((sub) => (
                  <div key={sub} className="flex items-center gap-1 bg-muted px-2.5 py-0.5 text-xs">
                    <span className="capitalize">{sub}</span>
                    {canEdit && (
                      <button onClick={() => removeProductSubCategory(catKey, sub)} className="text-muted-foreground hover:text-destructive" data-testid={`remove-sub-${catKey}-${sub}`}>
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {canEdit && (
                <div className="flex gap-2 pl-2">
                  <Input
                    value={newProductSubCategory[catKey] || ''}
                    onChange={(e) => setNewProductSubCategory({ ...newProductSubCategory, [catKey]: e.target.value })}
                    placeholder="Nouvelle sous-catégorie..."
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
          <div className="flex gap-2">
            <Input value={newProductCategory} onChange={(e) => setNewProductCategory(e.target.value)} placeholder="Nouvelle catégorie de produits" className="flex-1" data-testid="new-product-category"
              onKeyDown={(e) => e.key === 'Enter' && addProductCategory(newProductCategory)} />
            <Button variant="outline" onClick={() => addProductCategory(newProductCategory)} data-testid="add-product-category-btn">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Event Types */}
      <div className="swiss-card space-y-4">
        <h2 className="text-lg font-bold">Types d'événements</h2>
        <div className="flex flex-wrap gap-2">
          {settings?.event_types?.map((type) => (
            <div key={type} className="flex items-center gap-1 bg-muted px-3 py-1">
              <span className="text-sm capitalize">{type.replace(/_/g, ' ')}</span>
              {canEdit && (
                <button onClick={() => removeFromList('event_types', type)} className="text-muted-foreground hover:text-destructive" data-testid={`remove-event-type-${type}`}>
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <Input value={newEventType} onChange={(e) => setNewEventType(e.target.value)} placeholder="Nouveau type d'événement" className="flex-1" data-testid="new-event-type"
              onKeyDown={(e) => e.key === 'Enter' && addToList('event_types', newEventType.toLowerCase().replace(/\s+/g, '_'), setNewEventType)} />
            <Button variant="outline" onClick={() => addToList('event_types', newEventType.toLowerCase().replace(/\s+/g, '_'), setNewEventType)} data-testid="add-event-type-btn">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Event Formats */}
      <div className="swiss-card space-y-4">
        <h2 className="text-lg font-bold">Formats de tournoi</h2>
        <div className="flex flex-wrap gap-2">
          {settings?.event_formats?.map((format) => (
            <div key={format} className="flex items-center gap-1 bg-muted px-3 py-1">
              <span className="text-sm capitalize">{format.replace(/_/g, ' ')}</span>
              {canEdit && (
                <button onClick={() => removeFromList('event_formats', format)} className="text-muted-foreground hover:text-destructive" data-testid={`remove-event-format-${format}`}>
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <Input value={newEventFormat} onChange={(e) => setNewEventFormat(e.target.value)} placeholder="Nouveau format" className="flex-1" data-testid="new-event-format"
              onKeyDown={(e) => e.key === 'Enter' && addToList('event_formats', newEventFormat.toLowerCase().replace(/\s+/g, '_'), setNewEventFormat)} />
            <Button variant="outline" onClick={() => addToList('event_formats', newEventFormat.toLowerCase().replace(/\s+/g, '_'), setNewEventFormat)} data-testid="add-event-format-btn">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
