import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { formatCurrency, formatDate, paymentMethodLabels, cn } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../components/ui/dialog';
import { Search, XCircle, Filter, Receipt } from 'lucide-react';
import { toast } from 'sonner';

const statusLabels = {
  paye: 'Payé',
  en_attente: 'En attente',
  annule: 'Annulé',
};

export function SalesPage() {
  const { hasPermission } = useAuth();
  const [sales, setSales] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [eventFilter, setEventFilter] = useState('all');
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [saleToCancelId, setSaleToCancelId] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [salesData, eventsData] = await Promise.all([
        api.getSales(),
        api.getEvents(),
      ]);
      setSales(salesData);
      setEvents(eventsData);
    } catch (err) {
      toast.error('Erreur lors du chargement des ventes');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelSale = async () => {
    if (!saleToCancelId) return;
    try {
      await api.cancelSale(saleToCancelId);
      toast.success('Vente annulée (stock restauré)');
      setCancelDialogOpen(false);
      setSaleToCancelId(null);
      loadData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const openCancelDialog = (saleId) => {
    setSaleToCancelId(saleId);
    setCancelDialogOpen(true);
  };

  const eventsMap = events.reduce((acc, e) => { acc[e.event_id] = e.name; return acc; }, {});

  const filteredSales = sales.filter(sale => {
    const matchesSearch = searchQuery === '' ||
      sale.items?.some(i => i.product_name?.toLowerCase().includes(searchQuery.toLowerCase())) ||
      sale.sale_id?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'all' || sale.payment_status === statusFilter;
    const matchesEvent = eventFilter === 'all' ||
      (eventFilter === 'none' ? !sale.event_id : sale.event_id === eventFilter);

    return matchesSearch && matchesStatus && matchesEvent;
  });

  const totalFiltered = filteredSales
    .filter(s => s.payment_status === 'paye')
    .reduce((sum, s) => sum + (s.total_amount || 0), 0);

  const totalCancelled = filteredSales
    .filter(s => s.payment_status === 'annule')
    .reduce((sum, s) => sum + (s.total_amount || 0), 0);

  return (
    <div className="space-y-6" data-testid="sales-page">
      <div className="page-header">
        <h1 className="page-title flex items-center gap-2">
          <Receipt className="h-6 w-6" />
          Historique des ventes
        </h1>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher un produit..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="sales-search"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-40" data-testid="status-filter">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous</SelectItem>
            {Object.entries(statusLabels).map(([key, label]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={eventFilter} onValueChange={setEventFilter}>
          <SelectTrigger className="w-full sm:w-48" data-testid="event-filter">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Événement" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les événements</SelectItem>
            <SelectItem value="none">Hors événement</SelectItem>
            {events.map(e => (
              <SelectItem key={e.event_id} value={e.event_id}>{e.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Stats */}
      <div className="flex gap-6 text-sm flex-wrap">
        <span>{filteredSales.length} vente(s)</span>
        <span className="text-success font-medium">
          Total payé : {formatCurrency(totalFiltered)}
        </span>
        {totalCancelled > 0 && (
          <span className="text-destructive font-medium">
            Annulé : {formatCurrency(totalCancelled)}
          </span>
        )}
      </div>

      {/* Sales Table */}
      {loading ? (
        <div className="flex justify-center py-8">
          <div className="loading-spinner" />
        </div>
      ) : (
        <div className="swiss-card p-0 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Articles</TableHead>
                <TableHead>Événement</TableHead>
                <TableHead>Paiement</TableHead>
                <TableHead className="text-right">Montant</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSales.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Aucune vente trouvée
                  </TableCell>
                </TableRow>
              ) : (
                filteredSales.map(sale => (
                  <TableRow
                    key={sale.sale_id}
                    className={cn(sale.payment_status === 'annule' && "opacity-50")}
                    data-testid={`sale-row-${sale.sale_id}`}
                  >
                    <TableCell className="whitespace-nowrap text-sm">
                      {formatDate(sale.created_at, { hour: '2-digit', minute: '2-digit' })}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-0.5">
                        {sale.items?.map((item, i) => (
                          <div key={i} className="text-sm">
                            <span className="font-medium">{item.product_name}</span>
                            <span className="text-muted-foreground"> x{item.quantity}</span>
                            <span className="text-muted-foreground ml-1">({formatCurrency(item.total_price)})</span>
                          </div>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {sale.event_id ? eventsMap[sale.event_id] || sale.event_id : '-'}
                    </TableCell>
                    <TableCell className="text-sm">
                      {paymentMethodLabels[sale.payment_method] || sale.payment_method}
                    </TableCell>
                    <TableCell className="text-right font-mono font-bold">
                      {sale.payment_status === 'annule' ? (
                        <span className="line-through text-muted-foreground">{formatCurrency(sale.total_amount)}</span>
                      ) : (
                        formatCurrency(sale.total_amount)
                      )}
                    </TableCell>
                    <TableCell>
                      <span className={cn(
                        "px-2 py-0.5 text-xs font-medium",
                        sale.payment_status === 'paye' && "bg-success/10 text-success",
                        sale.payment_status === 'annule' && "bg-destructive/10 text-destructive",
                        sale.payment_status === 'en_attente' && "bg-warning/10 text-warning"
                      )}>
                        {statusLabels[sale.payment_status] || sale.payment_status}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      {sale.payment_status === 'paye' && hasPermission('sales:cancel') && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          onClick={() => openCancelDialog(sale.sale_id)}
                          data-testid={`cancel-sale-${sale.sale_id}`}
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          Annuler
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

      {/* Cancel Confirmation Dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Annuler cette vente ?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Le stock des produits sera automatiquement restauré. Cette action est irréversible.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelDialogOpen(false)}>
              Non, garder
            </Button>
            <Button variant="destructive" onClick={handleCancelSale} data-testid="confirm-cancel-sale">
              Oui, annuler la vente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
