import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Switch } from '../components/ui/switch';
import { Separator } from '../components/ui/separator';
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

  const canEdit = hasRole('president') || hasPermission('settings:update');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const data = await api.getSettings();
      setSettings(data);
    } catch (err) {
      toast.error('Erreur lors du chargement des paramètres');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await api.updateSettings(settings);
      toast.success('Paramètres enregistrés');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const addToList = (list, value, setter) => {
    if (value && !settings[list].includes(value)) {
      setSettings({ ...settings, [list]: [...settings[list], value] });
      setter('');
    }
  };

  const removeFromList = (list, value) => {
    setSettings({ ...settings, [list]: settings[list].filter(v => v !== value) });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="loading-spinner" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl" data-testid="settings-page">
      <div className="page-header">
        <h1 className="page-title">Paramètres</h1>
        {canEdit && (
          <Button onClick={handleSave} disabled={saving} data-testid="save-settings-btn">
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
                <button
                  onClick={() => removeFromList('payment_methods', method)}
                  className="text-muted-foreground hover:text-destructive"
                  data-testid={`remove-payment-${method}`}
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
        </div>

        {canEdit && (
          <div className="flex gap-2">
            <Input
              value={newPaymentMethod}
              onChange={(e) => setNewPaymentMethod(e.target.value)}
              placeholder="Nouveau mode de paiement"
              className="flex-1"
              data-testid="new-payment-method"
            />
            <Button
              variant="outline"
              onClick={() => addToList('payment_methods', newPaymentMethod.toLowerCase(), setNewPaymentMethod)}
              data-testid="add-payment-method-btn"
            >
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
                <button
                  onClick={() => removeFromList('expense_categories', category)}
                  className="text-muted-foreground hover:text-destructive"
                  data-testid={`remove-expense-${category}`}
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
        </div>

        {canEdit && (
          <div className="flex gap-2">
            <Input
              value={newExpenseCategory}
              onChange={(e) => setNewExpenseCategory(e.target.value)}
              placeholder="Nouvelle catégorie"
              className="flex-1"
              data-testid="new-expense-category"
            />
            <Button
              variant="outline"
              onClick={() => addToList('expense_categories', newExpenseCategory.toLowerCase(), setNewExpenseCategory)}
              data-testid="add-expense-category-btn"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Product Categories */}
      <div className="swiss-card space-y-4">
        <h2 className="text-lg font-bold">Catégories de produits</h2>
        
        <div className="flex flex-wrap gap-2">
          {settings?.product_categories?.map((category) => (
            <div key={category} className="flex items-center gap-1 bg-muted px-3 py-1">
              <span className="text-sm capitalize">{category}</span>
              {canEdit && (
                <button
                  onClick={() => removeFromList('product_categories', category)}
                  className="text-muted-foreground hover:text-destructive"
                  data-testid={`remove-product-${category}`}
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
        </div>

        {canEdit && (
          <div className="flex gap-2">
            <Input
              value={newProductCategory}
              onChange={(e) => setNewProductCategory(e.target.value)}
              placeholder="Nouvelle catégorie"
              className="flex-1"
              data-testid="new-product-category"
            />
            <Button
              variant="outline"
              onClick={() => addToList('product_categories', newProductCategory.toLowerCase(), setNewProductCategory)}
              data-testid="add-product-category-btn"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
