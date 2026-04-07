import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { formatCurrency, formatDate, expenseCategoryLabels, paymentMethodLabels, cn } from '../lib/utils';
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
import { Plus, Filter, Edit, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export function ExpensesPage() {
  const { hasPermission } = useAuth();
  const [expenses, setExpenses] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [formData, setFormData] = useState({
    amount: 0,
    category: 'divers',
    subcategory: '',
    description: '',
    payment_method: 'carte',
    expense_date: new Date().toISOString().slice(0, 10),
    event_id: '',
    supplier: '',
    reference: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [expensesData, eventsData] = await Promise.all([
        api.getExpenses(),
        api.getEvents(),
      ]);
      setExpenses(expensesData);
      setEvents(eventsData);
    } catch (err) {
      toast.error('Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  };

  const filteredExpenses = expenses.filter(expense => {
    return categoryFilter === 'all' || expense.category === categoryFilter;
  });

  const totalExpenses = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        amount: parseFloat(formData.amount),
        expense_date: new Date(formData.expense_date).toISOString(),
        event_id: formData.event_id || null,
      };

      if (editingExpense) {
        await api.updateExpense(editingExpense.expense_id, payload);
        toast.success('Dépense mise à jour');
      } else {
        await api.createExpense(payload);
        toast.success('Dépense enregistrée');
      }
      setIsDialogOpen(false);
      resetForm();
      loadData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleEdit = (expense) => {
    setEditingExpense(expense);
    const date = new Date(expense.expense_date);
    setFormData({
      amount: expense.amount,
      category: expense.category,
      subcategory: expense.subcategory || '',
      description: expense.description,
      payment_method: expense.payment_method,
      expense_date: date.toISOString().slice(0, 10),
      event_id: expense.event_id || '',
      supplier: expense.supplier || '',
      reference: expense.reference || '',
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (expense) => {
    if (window.confirm('Supprimer cette dépense ?')) {
      try {
        await api.deleteExpense(expense.expense_id);
        toast.success('Dépense supprimée');
        loadData();
      } catch (err) {
        toast.error(err.message);
      }
    }
  };

  const resetForm = () => {
    setEditingExpense(null);
    setFormData({
      amount: 0,
      category: 'divers',
      subcategory: '',
      description: '',
      payment_method: 'carte',
      expense_date: new Date().toISOString().slice(0, 10),
      event_id: '',
      supplier: '',
      reference: '',
    });
  };

  const openNewExpenseDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const getEventName = (eventId) => {
    const event = events.find(e => e.event_id === eventId);
    return event?.name || '-';
  };

  return (
    <div className="space-y-6" data-testid="expenses-page">
      <div className="page-header">
        <h1 className="page-title">Dépenses</h1>
        {hasPermission('expenses:create') && (
          <Button onClick={openNewExpenseDialog} data-testid="add-expense-btn">
            <Plus className="h-4 w-4 mr-2" />
            Nouvelle dépense
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-full sm:w-48" data-testid="expense-category-filter">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Catégorie" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes catégories</SelectItem>
            {Object.entries(expenseCategoryLabels).map(([key, label]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Stats */}
      <div className="flex gap-4 text-sm">
        <span>{filteredExpenses.length} dépense(s)</span>
        <span className="text-destructive font-bold">
          Total: {formatCurrency(totalExpenses)}
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
                <TableHead>Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Catégorie</TableHead>
                <TableHead>Événement</TableHead>
                <TableHead>Paiement</TableHead>
                <TableHead className="text-right">Montant</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredExpenses.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Aucune dépense trouvée
                  </TableCell>
                </TableRow>
              ) : (
                filteredExpenses.map((expense) => (
                  <TableRow key={expense.expense_id} data-testid={`expense-row-${expense.expense_id}`}>
                    <TableCell>{formatDate(expense.expense_date)}</TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{expense.description}</div>
                        {expense.supplier && (
                          <div className="text-xs text-muted-foreground">{expense.supplier}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs px-2 py-0.5 bg-muted">
                        {expenseCategoryLabels[expense.category] || expense.category}
                      </span>
                    </TableCell>
                    <TableCell>{expense.event_id ? getEventName(expense.event_id) : '-'}</TableCell>
                    <TableCell>{paymentMethodLabels[expense.payment_method] || expense.payment_method}</TableCell>
                    <TableCell className="text-right font-mono font-bold text-destructive">
                      {formatCurrency(expense.amount)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {hasPermission('expenses:update') && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(expense)}
                            data-testid={`edit-expense-${expense.expense_id}`}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        )}
                        {hasPermission('expenses:delete') && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(expense)}
                            data-testid={`delete-expense-${expense.expense_id}`}
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

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingExpense ? 'Modifier la dépense' : 'Nouvelle dépense'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="amount">Montant (€) *</Label>
                <Input
                  id="amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  required
                  data-testid="expense-amount"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="expense_date">Date *</Label>
                <Input
                  id="expense_date"
                  type="date"
                  value={formData.expense_date}
                  onChange={(e) => setFormData({ ...formData, expense_date: e.target.value })}
                  required
                  data-testid="expense-date"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                required
                data-testid="expense-description"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category">Catégorie *</Label>
                <Select 
                  value={formData.category} 
                  onValueChange={(value) => setFormData({ ...formData, category: value })}
                >
                  <SelectTrigger data-testid="expense-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(expenseCategoryLabels).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="payment_method">Mode de paiement</Label>
                <Select 
                  value={formData.payment_method} 
                  onValueChange={(value) => setFormData({ ...formData, payment_method: value })}
                >
                  <SelectTrigger data-testid="expense-payment">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(paymentMethodLabels).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="event_id">Événement associé</Label>
              <Select 
                value={formData.event_id} 
                onValueChange={(value) => setFormData({ ...formData, event_id: value })}
              >
                <SelectTrigger data-testid="expense-event">
                  <SelectValue placeholder="Aucun" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Aucun</SelectItem>
                  {events.map(event => (
                    <SelectItem key={event.event_id} value={event.event_id}>
                      {event.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="supplier">Fournisseur</Label>
                <Input
                  id="supplier"
                  value={formData.supplier}
                  onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                  data-testid="expense-supplier"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reference">Référence</Label>
                <Input
                  id="reference"
                  value={formData.reference}
                  onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                  data-testid="expense-reference"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Annuler
              </Button>
              <Button type="submit" data-testid="save-expense-btn">
                {editingExpense ? 'Enregistrer' : 'Créer'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
