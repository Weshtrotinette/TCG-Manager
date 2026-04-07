import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { formatDate, memberStatusLabels, memberTypeLabels, cn } from '../lib/utils';
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
import { 
  Plus, Search, AlertTriangle, Filter, Edit, Archive
} from 'lucide-react';
import { toast } from 'sonner';

export function MembersPage() {
  const { hasPermission } = useAuth();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    pseudo: '',
    email: '',
    phone: '',
    member_type: 'adherent',
    status: 'nouveau',
    notes: '',
  });

  useEffect(() => {
    loadMembers();
  }, []);

  const loadMembers = async () => {
    try {
      setLoading(true);
      const data = await api.getMembers();
      setMembers(data);
    } catch (err) {
      toast.error('Erreur lors du chargement des membres');
    } finally {
      setLoading(false);
    }
  };

  const filteredMembers = members.filter(member => {
    const matchesSearch = searchQuery === '' || 
      `${member.first_name} ${member.last_name} ${member.pseudo || ''} ${member.email || ''}`
        .toLowerCase()
        .includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || member.status === statusFilter;
    const matchesType = typeFilter === 'all' || member.member_type === typeFilter;
    
    return matchesSearch && matchesStatus && matchesType;
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingMember) {
        await api.updateMember(editingMember.member_id, formData);
        toast.success('Membre mis à jour');
      } else {
        await api.createMember(formData);
        toast.success('Membre créé');
      }
      setIsDialogOpen(false);
      resetForm();
      loadMembers();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleEdit = (member) => {
    setEditingMember(member);
    setFormData({
      first_name: member.first_name,
      last_name: member.last_name,
      pseudo: member.pseudo || '',
      email: member.email || '',
      phone: member.phone || '',
      member_type: member.member_type || 'adherent',
      status: member.status,
      notes: member.notes || '',
    });
    setIsDialogOpen(true);
  };

  const handleArchive = async (member) => {
    if (window.confirm(`Archiver ${member.first_name} ${member.last_name} ?`)) {
      try {
        await api.archiveMember(member.member_id);
        toast.success('Membre archivé');
        loadMembers();
      } catch (err) {
        toast.error(err.message);
      }
    }
  };

  const resetForm = () => {
    setEditingMember(null);
    setFormData({
      first_name: '',
      last_name: '',
      pseudo: '',
      email: '',
      phone: '',
      member_type: 'adherent',
      status: 'nouveau',
      notes: '',
    });
  };

  const openNewMemberDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const getStatusBadge = (status, trialAlert) => {
    return (
      <div className="flex items-center gap-2">
        <span className={cn("status-badge", `status-${status}`)}>
          {memberStatusLabels[status] || status}
        </span>
        {trialAlert === 'warning' && (
          <span className="alert-badge alert-badge-warning" title="Proche du seuil d'adhésion">
            <AlertTriangle className="h-3 w-3" />
          </span>
        )}
        {trialAlert === 'exceeded' && (
          <span className="alert-badge alert-badge-danger" title="Seuil dépassé - Adhésion requise">
            <AlertTriangle className="h-3 w-3" />
          </span>
        )}
      </div>
    );
  };

  const getTypeBadge = (type) => {
    const t = type || 'adherent';
    return (
      <span className={cn(
        "px-2 py-0.5 text-xs font-medium",
        t === 'adherent' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
      )}>
        {memberTypeLabels[t] || t}
      </span>
    );
  };

  return (
    <div className="space-y-6" data-testid="members-page">
      <div className="page-header">
        <h1 className="page-title">Membres</h1>
        {hasPermission('members:create') && (
          <Button onClick={openNewMemberDialog} data-testid="add-member-btn">
            <Plus className="h-4 w-4 mr-2" />
            Nouveau membre
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
            data-testid="member-search"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full sm:w-48" data-testid="type-filter">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les types</SelectItem>
            {Object.entries(memberTypeLabels).map(([key, label]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-48" data-testid="status-filter">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            {Object.entries(memberStatusLabels).map(([key, label]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Stats */}
      <div className="flex gap-4 text-sm flex-wrap">
        <span>{filteredMembers.length} membre(s)</span>
        <span className="text-primary">{filteredMembers.filter(m => (m.member_type || 'adherent') === 'adherent').length} adhérents</span>
        <span className="text-muted-foreground">{filteredMembers.filter(m => m.member_type === 'non_adherent').length} non adhérents</span>
        <span className="text-success">{filteredMembers.filter(m => m.status === 'actif').length} actifs</span>
        <span className="text-warning">{filteredMembers.filter(m => m.trial_alert).length} alertes</span>
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
                <TableHead>Nom</TableHead>
                <TableHead>Pseudo</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Participations</TableHead>
                <TableHead>Inscription</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMembers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Aucun membre trouvé
                  </TableCell>
                </TableRow>
              ) : (
                filteredMembers.map((member) => (
                  <TableRow key={member.member_id} data-testid={`member-row-${member.member_id}`}>
                    <TableCell className="font-medium">
                      {member.first_name} {member.last_name}
                    </TableCell>
                    <TableCell>{member.pseudo || '-'}</TableCell>
                    <TableCell>{getTypeBadge(member.member_type)}</TableCell>
                    <TableCell>{getStatusBadge(member.status, member.trial_alert)}</TableCell>
                    <TableCell>{member.participation_count || 0}</TableCell>
                    <TableCell>{formatDate(member.membership_date) || formatDate(member.first_participation_date) || '-'}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {hasPermission('members:update') && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(member)}
                            data-testid={`edit-member-${member.member_id}`}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        )}
                        {hasPermission('members:delete') && member.status !== 'archive' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleArchive(member)}
                            data-testid={`archive-member-${member.member_id}`}
                          >
                            <Archive className="h-4 w-4" />
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
              {editingMember ? 'Modifier le membre' : 'Nouveau membre'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="first_name">Prénom *</Label>
                <Input
                  id="first_name"
                  value={formData.first_name}
                  onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                  required
                  data-testid="member-first-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last_name">Nom *</Label>
                <Input
                  id="last_name"
                  value={formData.last_name}
                  onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                  required
                  data-testid="member-last-name"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pseudo">Pseudo</Label>
              <Input
                id="pseudo"
                value={formData.pseudo}
                onChange={(e) => setFormData({ ...formData, pseudo: e.target.value })}
                data-testid="member-pseudo"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  data-testid="member-email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Téléphone</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  data-testid="member-phone"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="member_type">Type *</Label>
                <Select 
                  value={formData.member_type} 
                  onValueChange={(value) => setFormData({ ...formData, member_type: value })}
                >
                  <SelectTrigger data-testid="member-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(memberTypeLabels).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Statut</Label>
                <Select 
                  value={formData.status} 
                  onValueChange={(value) => setFormData({ ...formData, status: value })}
                >
                  <SelectTrigger data-testid="member-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(memberStatusLabels).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Input
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                data-testid="member-notes"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Annuler
              </Button>
              <Button type="submit" data-testid="save-member-btn">
                {editingMember ? 'Enregistrer' : 'Créer'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
