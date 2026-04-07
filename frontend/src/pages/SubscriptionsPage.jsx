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
import { Plus, Filter, Euro, ArchiveRestore, CalendarPlus, ChevronLeft, Edit, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export function SubscriptionsPage() {
  const { hasPermission } = useAuth();
  const [subscriptions, setSubscriptions] = useState([]);
  const [members, setMembers] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');

  // Dialogs
  const [isNewSubDialogOpen, setIsNewSubDialogOpen] = useState(false);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [isNewSeasonDialogOpen, setIsNewSeasonDialogOpen] = useState(false);
  const [isArchiveDialogOpen, setIsArchiveDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  // Archives
  const [archives, setArchives] = useState([]);
  const [selectedArchive, setSelectedArchive] = useState(null);
  const [archiveDetail, setArchiveDetail] = useState(null);
  const [archiveLoading, setArchiveLoading] = useState(false);

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
  // Search in member select
  const [memberSearch, setMemberSearch] = useState('');
  // Edit subscription
  const [editingSub, setEditingSub] = useState(null);
  const [editAmount, setEditAmount] = useState(0);

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
      setMemberSearch('');
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

  // Edit subscription
  const openEditDialog = (sub) => {
    setEditingSub(sub);
    setEditAmount(sub.amount_due);
    setIsEditDialogOpen(true);
  };

  const handleEditSubscription = async (e) => {
    e.preventDefault();
    try {
      await api.updateSubscription(editingSub.subscription_id, { amount_due: parseFloat(editAmount) });
      toast.success('Cotisation modifiée');
      setIsEditDialogOpen(false);
      setEditingSub(null);
      loadData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleDeleteSubscription = async (sub) => {
    if (!window.confirm(`Supprimer la cotisation de ${sub.member_name} ?`)) return;
    try {
      await api.deleteSubscription(sub.subscription_id);
      toast.success('Cotisation supprimée');
      loadData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  // New season
  const handleNewSeason = async () => {
    try {
      const result = await api.startNewSeason();
      toast.success(result.message);
      setIsNewSeasonDialogOpen(false);
      loadData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  // Archives
  const openArchiveDialog = async () => {
    setIsArchiveDialogOpen(true);
    setSelectedArchive(null);
    setArchiveDetail(null);
    try {
      setArchiveLoading(true);
      const archivesData = await api.getSubscriptionArchives();
      setArchives(archivesData);
    } catch (err) {
      toast.error('Erreur lors du chargement des archives');
    } finally {
      setArchiveLoading(false);
    }
  };

  const loadArchiveDetail = async (season) => {
    try {
      setArchiveLoading(true);
      const detail = await api.getSubscriptionArchive(season);
      setSelectedArchive(season);
      setArchiveDetail(detail);
    } catch (err) {
      toast.error('Erreur lors du chargement');
    } finally {
      setArchiveLoading(false);
    }
  };

  const currentYear = new Date().getFullYear().toString();
  const seasonIsOutdated = settings && settings.current_season !== currentYear;

  return (
    <div className="space-y-6" data-testid="subscriptions-page">
      <div className="page-header">
        <h1 className="page-title">Cotisations</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={openArchiveDialog} data-testid="archives-btn">
            <ArchiveRestore className="h-4 w-4 mr-2" />
            Archives
          </Button>
          {hasPermission('subscriptions:create') && (
            <Button onClick={() => setIsNewSubDialogOpen(true)} data-testid="add-subscription-btn">
              <Plus className="h-4 w-4 mr-2" />
              Nouvelle cotisation
            </Button>
          )}
        </div>
      </div>

      {/* Season Info + New Season */}
      {settings && (
        <div className="swiss-card space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div>
                <span className="text-sm text-muted-foreground">Saison en cours :</span>
                <span className="ml-2 font-bold text-lg">{settings.current_season}</span>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">Montant :</span>
                <span className="ml-2 font-bold">{formatCurrency(settings.annual_subscription_amount)}</span>
              </div>
            </div>
            {hasPermission('subscriptions:create') && (
              <Button
                variant={seasonIsOutdated ? "default" : "outline"}
                onClick={() => setIsNewSeasonDialogOpen(true)}
                data-testid="new-season-btn"
              >
                <CalendarPlus className="h-4 w-4 mr-2" />
                Nouvelle saison {currentYear}
              </Button>
            )}
          </div>
          {seasonIsOutdated && (
            <div className="text-sm text-warning font-medium bg-warning/10 px-3 py-2 rounded">
              La saison actuelle ({settings.current_season}) ne correspond pas à l'année en cours ({currentYear}).
              Cliquez sur "Nouvelle saison" pour archiver et démarrer {currentYear}.
            </div>
          )}
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
      <div className="flex gap-4 text-sm flex-wrap">
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
        <span className="text-muted-foreground">
          Total perçu : {formatCurrency(filteredSubscriptions.reduce((sum, s) => sum + (s.amount_paid || 0), 0))}
          {' / '}
          {formatCurrency(filteredSubscriptions.reduce((sum, s) => sum + (s.amount_due || 0), 0))}
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
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Aucune cotisation pour cette saison
                  </TableCell>
                </TableRow>
              ) : (
                filteredSubscriptions.map((sub) => (
                  <TableRow key={sub.subscription_id} data-testid={`subscription-row-${sub.subscription_id}`}>
                    <TableCell className="font-medium">{sub.member_name || sub.member_id}</TableCell>
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
                      <div className="flex justify-end gap-1">
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
                        {hasPermission('subscriptions:update') && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(sub)}
                            data-testid={`edit-sub-${sub.subscription_id}`}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        )}
                        {hasPermission('subscriptions:delete') && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive"
                            onClick={() => handleDeleteSubscription(sub)}
                            data-testid={`delete-sub-${sub.subscription_id}`}
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

      {/* New Subscription Dialog */}
      <Dialog open={isNewSubDialogOpen} onOpenChange={(open) => { setIsNewSubDialogOpen(open); if (!open) setMemberSearch(''); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nouvelle cotisation</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateSubscription} className="space-y-4">
            <div className="space-y-2">
              <Label>Membre adhérent *</Label>
              <Input
                placeholder="Rechercher un membre..."
                value={memberSearch}
                onChange={(e) => { setMemberSearch(e.target.value); setNewSubData(d => ({ ...d, member_id: '' })); }}
                autoFocus
                data-testid="sub-member-search"
              />
              <div className="max-h-40 overflow-y-auto border border-border rounded-md">
                {getMembersWithoutSubscription()
                  .filter(m => {
                    if (!memberSearch) return true;
                    const q = memberSearch.toLowerCase();
                    return `${m.first_name} ${m.last_name} ${m.pseudo || ''}`.toLowerCase().includes(q);
                  })
                  .map(member => (
                    <button
                      key={member.member_id}
                      type="button"
                      className={cn(
                        "w-full text-left px-4 py-2.5 text-sm transition-colors border-b border-border last:border-b-0",
                        newSubData.member_id === member.member_id ? "bg-primary/10 font-semibold" : "hover:bg-muted"
                      )}
                      onClick={() => { setNewSubData(d => ({ ...d, member_id: member.member_id })); setMemberSearch(`${member.first_name} ${member.last_name}`); }}
                      data-testid={`pick-sub-member-${member.member_id}`}
                    >
                      {member.first_name} {member.last_name}
                      {member.pseudo && <span className="ml-1 text-muted-foreground">({member.pseudo})</span>}
                    </button>
                  ))}
                {getMembersWithoutSubscription().filter(m => {
                  if (!memberSearch) return true;
                  const q = memberSearch.toLowerCase();
                  return `${m.first_name} ${m.last_name} ${m.pseudo || ''}`.toLowerCase().includes(q);
                }).length === 0 && (
                  <div className="px-4 py-2.5 text-sm text-muted-foreground text-center">Aucun membre disponible</div>
                )}
              </div>
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
                <p><strong>Membre :</strong> {selectedSubscription.member_name}</p>
                <p><strong>Reste à payer :</strong> {formatCurrency(selectedSubscription.amount_due - selectedSubscription.amount_paid)}</p>
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

      {/* New Season Confirmation Dialog */}
      <Dialog open={isNewSeasonDialogOpen} onOpenChange={setIsNewSeasonDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Démarrer la saison {currentYear} ?</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p>Cette action va :</p>
            <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
              <li>Archiver toutes les cotisations de la saison <strong>{settings?.current_season}</strong></li>
              <li>Vider le tableau des cotisations</li>
              <li>Passer tous les adhérents en statut <strong>"Non à jour"</strong></li>
              <li>Définir la nouvelle saison : <strong>{currentYear}</strong></li>
            </ul>
            <p className="text-warning font-medium">Les cotisations archivées restent consultables via le bouton "Archives".</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsNewSeasonDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleNewSeason} data-testid="confirm-new-season-btn">
              <CalendarPlus className="h-4 w-4 mr-1" />
              Confirmer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Subscription Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Modifier la cotisation</DialogTitle>
          </DialogHeader>
          {editingSub && (
            <form onSubmit={handleEditSubscription} className="space-y-4">
              <div className="text-sm">
                <p><strong>Membre :</strong> {editingSub.member_name}</p>
                <p><strong>Déjà payé :</strong> {formatCurrency(editingSub.amount_paid)}</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_amount">Montant dû (€)</Label>
                <Input
                  id="edit_amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={editAmount}
                  onChange={(e) => setEditAmount(e.target.value)}
                  required
                  data-testid="edit-sub-amount"
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                  Annuler
                </Button>
                <Button type="submit" data-testid="confirm-edit-sub-btn">
                  Enregistrer
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Archives Dialog */}
      <Dialog open={isArchiveDialogOpen} onOpenChange={setIsArchiveDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {archiveDetail ? (
                <div className="flex items-center gap-2">
                  <button onClick={() => { setArchiveDetail(null); setSelectedArchive(null); }} className="hover:text-primary">
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  Cotisations — Saison {selectedArchive}
                </div>
              ) : 'Archives des cotisations'}
            </DialogTitle>
          </DialogHeader>

          {archiveLoading ? (
            <div className="flex justify-center py-8">
              <div className="loading-spinner" />
            </div>
          ) : archiveDetail ? (
            /* Archive detail view */
            <div className="space-y-4">
              <div className="flex gap-4 text-sm">
                <span>{archiveDetail.count} cotisation(s)</span>
                <span className="text-success">
                  Perçu : {formatCurrency(archiveDetail.total_paid)}
                </span>
                <span className="text-muted-foreground">
                  / {formatCurrency(archiveDetail.total_due)}
                </span>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Membre</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">Dû</TableHead>
                    <TableHead className="text-right">Payé</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {archiveDetail.subscriptions?.map((sub, i) => (
                    <TableRow key={sub.subscription_id || i}>
                      <TableCell className="font-medium">{sub.member_name || sub.member_id}</TableCell>
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
                      <TableCell className="text-right font-mono">{formatCurrency(sub.amount_paid)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            /* Archives list */
            <div className="space-y-2">
              {archives.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">Aucune archive disponible</p>
              ) : (
                archives.map((archive) => (
                  <button
                    key={archive.archive_id}
                    className="w-full text-left swiss-card hover:bg-muted/50 transition-colors flex items-center justify-between"
                    onClick={() => loadArchiveDetail(archive.season)}
                    data-testid={`archive-season-${archive.season}`}
                  >
                    <div>
                      <span className="font-bold text-lg">Saison {archive.season}</span>
                      <span className="ml-4 text-sm text-muted-foreground">{archive.count} cotisation(s)</span>
                    </div>
                    <div className="text-right text-sm">
                      <div className="text-success font-medium">{formatCurrency(archive.total_paid)}</div>
                      <div className="text-muted-foreground">/ {formatCurrency(archive.total_due)}</div>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
