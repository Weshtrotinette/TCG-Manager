import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { formatDate } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
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
import { Shield, Plus, Trash2, Upload, Mail, ShieldOff } from 'lucide-react';
import { toast } from 'sonner';

export function WhitelistPage() {
  const { hasRole } = useAuth();
  const [whitelist, setWhitelist] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isBulkDialogOpen, setIsBulkDialogOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newNote, setNewNote] = useState('');
  const [bulkEmails, setBulkEmails] = useState('');

  useEffect(() => {
    loadWhitelist();
  }, []);

  const loadWhitelist = async () => {
    try {
      setLoading(true);
      const data = await api.getWhitelist();
      setWhitelist(data);
    } catch (err) {
      toast.error('Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  };

  const handleAddEmail = async (e) => {
    e.preventDefault();
    try {
      await api.addToWhitelist({ email: newEmail, note: newNote });
      toast.success('Email ajouté à la liste');
      setIsAddDialogOpen(false);
      setNewEmail('');
      setNewNote('');
      loadWhitelist();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleBulkAdd = async (e) => {
    e.preventDefault();
    try {
      const emails = bulkEmails
        .split(/[\n,;]+/)
        .map(e => e.trim())
        .filter(e => e && e.includes('@'));
      
      if (emails.length === 0) {
        toast.error('Aucun email valide trouvé');
        return;
      }

      const result = await api.addBulkToWhitelist(emails);
      toast.success(`${result.added.length} email(s) ajouté(s)`);
      if (result.skipped.length > 0) {
        toast.info(`${result.skipped.length} email(s) déjà présent(s)`);
      }
      setIsBulkDialogOpen(false);
      setBulkEmails('');
      loadWhitelist();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleRemove = async (email) => {
    if (window.confirm(`Retirer ${email} de la liste autorisée ?`)) {
      try {
        await api.removeFromWhitelist(email);
        toast.success('Email retiré');
        loadWhitelist();
      } catch (err) {
        toast.error(err.message);
      }
    }
  };

  if (!hasRole('president')) {
    return (
      <div className="swiss-card text-center py-8">
        <ShieldOff className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <p className="text-muted-foreground">Accès réservé au président</p>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="whitelist-page">
      <div className="page-header">
        <h1 className="page-title flex items-center gap-2">
          <Shield className="h-6 w-6" />
          Emails autorisés
        </h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsBulkDialogOpen(true)} data-testid="bulk-add-btn">
            <Upload className="h-4 w-4 mr-2" />
            Import en masse
          </Button>
          <Button onClick={() => setIsAddDialogOpen(true)} data-testid="add-email-btn">
            <Plus className="h-4 w-4 mr-2" />
            Ajouter un email
          </Button>
        </div>
      </div>

      {/* Info card */}
      <div className="swiss-card bg-primary/5 border-primary/20">
        <div className="flex items-start gap-3">
          <Mail className="h-5 w-5 text-primary mt-0.5" />
          <div>
            <h3 className="font-bold text-sm">Contrôle d'accès par whitelist</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Seuls les emails listés ci-dessous peuvent se connecter à l'application. 
              Les utilisateurs existants conservent leur accès même s'ils ne sont pas dans la liste.
            </p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="flex gap-4 text-sm">
        <span>{whitelist.length} email(s) autorisé(s)</span>
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
                <TableHead>Email</TableHead>
                <TableHead>Note</TableHead>
                <TableHead>Ajouté le</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {whitelist.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    Aucun email dans la liste. Ajoutez des emails pour autoriser l'accès.
                  </TableCell>
                </TableRow>
              ) : (
                whitelist.map((entry) => (
                  <TableRow key={entry.email} data-testid={`whitelist-row-${entry.email}`}>
                    <TableCell className="font-medium">{entry.email}</TableCell>
                    <TableCell className="text-muted-foreground">{entry.note || '-'}</TableCell>
                    <TableCell>{formatDate(entry.added_at)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemove(entry.email)}
                        data-testid={`remove-${entry.email}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Add Single Email Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Ajouter un email autorisé</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddEmail} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="exemple@email.com"
                required
                data-testid="whitelist-email-input"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="note">Note (optionnel)</Label>
              <Input
                id="note"
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Ex: Trésorier, Membre du bureau..."
                data-testid="whitelist-note-input"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                Annuler
              </Button>
              <Button type="submit" data-testid="confirm-add-email">
                Ajouter
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Bulk Add Dialog */}
      <Dialog open={isBulkDialogOpen} onOpenChange={setIsBulkDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Import en masse</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleBulkAdd} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="bulkEmails">Emails (un par ligne ou séparés par virgules)</Label>
              <Textarea
                id="bulkEmails"
                value={bulkEmails}
                onChange={(e) => setBulkEmails(e.target.value)}
                placeholder="email1@exemple.com&#10;email2@exemple.com&#10;email3@exemple.com"
                rows={8}
                data-testid="bulk-emails-input"
              />
              <p className="text-xs text-muted-foreground">
                Collez une liste d'emails. Les doublons seront ignorés.
              </p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsBulkDialogOpen(false)}>
                Annuler
              </Button>
              <Button type="submit" data-testid="confirm-bulk-add">
                Importer
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
