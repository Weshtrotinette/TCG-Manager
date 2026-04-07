import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { formatCurrency, formatDate, subscriptionStatusLabels, paymentMethodLabels, cn } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
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
import { Plus, Filter, CreditCard, Euro } from 'lucide-react';
import { toast } from 'sonner';

export function SubscriptionsPage() {
  const { hasPermission } = useAuth();
  const [subscriptions, setSubscriptions] = useState([]);
  const [members, setMembers] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [isNewSubDialogOpen, setIsNewSubDialogOpen] = useState(false);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [selectedSubscription, setSelectedSubscription] = useState(null);
  const [newSubData, setNewSubData] = useState({
    member_id: '',
    season: '',
    amount_due: 0,
  });
  const [paymentData, setPaymentData] = useState({
    amount: 0,
    payment_method: 'especes',
    comment: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [subsData, membersData, settingsData] = await Promise.all([
        api.getSubscriptions(),
        api.getMembers(),
        api.getSettings(),
      ]);
      setSubscriptions(subsData);
      setMembers(membersData.filter(m => m.status !== 'archive'));
      setSettings(settingsData);
      setNewSubData(prev => ({
        ...prev,
        season: settingsData.current_season,
        amount_due: settingsData.annual_subscription_amount,
      }));
    } catch (err) {
      toast.error('Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  };

  const filteredSubscriptions = subscriptions.filter(sub => {
    return statusFilter === 'all' || sub.status === statusFilter;
  });

  const handleCreateSubscription = async (e) => {
    e.preventDefault();
    try {
      await api.createSubscription({
        ...newSubData,
        amount_due: parseFloat(newSubData.amount_due),
      });
      toast.success('Cotisation créée');
      setIsNewSubDialogOpen(false);
      setNewSubData({
        member_id: '',
        season: settings?.current_season || '',
        amount_due: settings?.annual_subscription_amount || 0,
      });
      loadData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleAddPayment = async (e) => {
    e.preventDefault();
    try {
      await api.addPayment(selectedSubscription.subscription_id, {
        amount: parseFloat(paymentData.amount),
        payment_method: paymentData.payment_method,
        comment: paymentData.comment,
      });
      toast.success('Paiement enregistré');
      setIsPaymentDialogOpen(false);
      setSelectedSubscription(null);
      setPaymentData({ amount: 0, payment_method: 'especes', comment: '' });
      loadData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const openPaymentDialog = (subscription) => {
    setSelectedSubscription(subscription);
    setPaymentData({
      amount: subscription.amount_due - subscription.amount_paid,
      payment_method: 'especes',
      comment: '',
    });
    setIsPaymentDialogOpen(true);
  };

  const getMembersWithoutSubscription = () => {
    const subsMembers = subscriptions
      .filter(s => s.season === (settings?.current_season || ''))
      .map(s => s.member_id);
    return members.filter(m => !subsMembers.includes(m.member_id) && (m.member_type || 'adherent') === 'adherent');
  };

  return (
    <div className="space-y-6" data-testid="subscriptions-page">
      <div className="page-header">
        <h1 className="page-title">Cotisations</h1>
        {hasPermission('subscriptions:create') && (
          <Button onClick={() => setIsNewSubDialogOpen(true)} data-testid="add-subscription-btn">
            <Plus className="h-4 w-4 mr-2" />
            Nouvelle cotisation
          </Button>
        )}
      </div>

      {/* Season Info */}
      {settings && (
        <div className="swiss-card flex items-center justify-between">
          <div>
            <span className="text-sm text-muted-foreground">Saison en cours:</span>
            <span className="ml-2 font-bold">{settings.current_season}</span>
          </div>
          <div>
            <span className="text-sm text-muted-foreground">Montant:</span>
            <span className="ml-2 font-bold">{formatCurrency(settings.annual_subscription_amount)}</span>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-48" data-testid="subscription-status-filter">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            {Object.entries(subscriptionStatusLabels).map(([key, label]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Stats */}
      <div className="flex gap-4 text-sm">
        <span>{filteredSubscriptions.length} cotisation(s)</span>
        <span className="text-success">
          {filteredSubscriptions.filter(s => s.status === 'payee').length} payées
        </span>
        <span className="text-warning">
          {filteredSubscriptions.filter(s => s.status === 'partielle').length} partielles
        </span>
        <span className="text-destructive">
          {filteredSubscriptions.filter(s => s.status === 'non_payee').length} non payées
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
                <TableHead>Membre</TableHead>
                <TableHead>Saison</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Dû</TableHead>
                <TableHead className="text-right">Payé</TableHead>
                <TableHead className="text-right">Reste</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSubscriptions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Aucune cotisation trouvée
                  </TableCell>
                </TableRow>
              ) : (
                filteredSubscriptions.map((sub) => (
                  <TableRow key={sub.subscription_id} data-testid={`subscription-row-${sub.subscription_id}`}>
                    <TableCell className="font-medium">{sub.member_name || sub.member_id}</TableCell>
                    <TableCell>{sub.season}</TableCell>
                    <TableCell>
                      <span className={cn(
                        "status-badge",
                        sub.status === 'payee' && "status-actif",
                        sub.status === 'partielle' && "status-essai",
                        sub.status === 'non_payee' && "status-non_a_jour"
                      )}>
                        {subscriptionStatusLabels[sub.status] || sub.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-mono">{formatCurrency(sub.amount_due)}</TableCell>
                    <TableCell className="text-right font-mono text-success">{formatCurrency(sub.amount_paid)}</TableCell>
                    <TableCell className="text-right font-mono text-destructive">
                      {formatCurrency(sub.amount_due - sub.amount_paid)}
                    </TableCell>
                    <TableCell className="text-right">
                      {hasPermission('subscriptions:update') && sub.status !== 'payee' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openPaymentDialog(sub)}
                          data-testid={`add-payment-${sub.subscription_id}`}
                        >
                          <Euro className="h-4 w-4 mr-1" />
                          Paiement
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* New Subscription Dialog */}
      <Dialog open={isNewSubDialogOpen} onOpenChange={setIsNewSubDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nouvelle cotisation</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateSubscription} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="member_id">Membre *</Label>
              <Select 
                value={newSubData.member_id} 
                onValueChange={(value) => setNewSubData({ ...newSubData, member_id: value })}
              >
                <SelectTrigger data-testid="subscription-member">
                  <SelectValue placeholder="Sélectionner un membre" />
                </SelectTrigger>
                <SelectContent>
                  {getMembersWithoutSubscription().map(member => (
                    <SelectItem key={member.member_id} value={member.member_id}>
                      {member.first_name} {member.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="season">Saison *</Label>
                <Input
                  id="season"
                  value={newSubData.season}
                  onChange={(e) => setNewSubData({ ...newSubData, season: e.target.value })}
                  required
                  data-testid="subscription-season"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="amount_due">Montant (€) *</Label>
                <Input
                  id="amount_due"
                  type="number"
                  min="0"
                  step="0.01"
                  value={newSubData.amount_due}
                  onChange={(e) => setNewSubData({ ...newSubData, amount_due: e.target.value })}
                  required
                  data-testid="subscription-amount"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsNewSubDialogOpen(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={!newSubData.member_id} data-testid="save-subscription-btn">
                Créer
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Payment Dialog */}
      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Enregistrer un paiement</DialogTitle>
          </DialogHeader>
          {selectedSubscription && (
            <form onSubmit={handleAddPayment} className="space-y-4">
              <div className="text-sm">
                <p><strong>Membre:</strong> {selectedSubscription.member_name}</p>
                <p><strong>Reste à payer:</strong> {formatCurrency(selectedSubscription.amount_due - selectedSubscription.amount_paid)}</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="payment_amount">Montant (€) *</Label>
                <Input
                  id="payment_amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  max={selectedSubscription.amount_due - selectedSubscription.amount_paid}
                  value={paymentData.amount}
                  onChange={(e) => setPaymentData({ ...paymentData, amount: e.target.value })}
                  required
                  data-testid="payment-amount"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="payment_method">Mode de paiement</Label>
                <Select 
                  value={paymentData.payment_method} 
                  onValueChange={(value) => setPaymentData({ ...paymentData, payment_method: value })}
                >
                  <SelectTrigger data-testid="payment-method">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(paymentMethodLabels).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="payment_comment">Commentaire</Label>
                <Input
                  id="payment_comment"
                  value={paymentData.comment}
                  onChange={(e) => setPaymentData({ ...paymentData, comment: e.target.value })}
                  data-testid="payment-comment"
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsPaymentDialogOpen(false)}>
                  Annuler
                </Button>
                <Button type="submit" data-testid="confirm-payment-btn">
                  Enregistrer
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
