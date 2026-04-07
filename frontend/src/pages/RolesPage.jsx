import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Checkbox } from '../components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../components/ui/dialog';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '../components/ui/accordion';
import { Shield, Plus, Edit, Trash2, ShieldOff, Lock } from 'lucide-react';
import { toast } from 'sonner';

export function RolesPage() {
  const { hasRole } = useAuth();
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    name_fr: '',
    description: '',
    permissions: [],
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [rolesData, permsData] = await Promise.all([
        api.getRoles(),
        api.getPermissions(),
      ]);
      setRoles(rolesData);
      setPermissions(permsData);
    } catch (err) {
      toast.error('Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingRole) {
        await api.updateRole(editingRole.role_id, formData);
        toast.success('Rôle mis à jour');
      } else {
        await api.createRole(formData);
        toast.success('Rôle créé');
      }
      setIsDialogOpen(false);
      resetForm();
      loadData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleDelete = async (role) => {
    if (role.is_system) {
      toast.error('Impossible de supprimer un rôle système');
      return;
    }
    if (window.confirm(`Supprimer le rôle "${role.name_fr}" ?`)) {
      try {
        await api.deleteRole(role.role_id);
        toast.success('Rôle supprimé');
        loadData();
      } catch (err) {
        toast.error(err.message);
      }
    }
  };

  const handleEdit = (role) => {
    setEditingRole(role);
    setFormData({
      name: role.name,
      name_fr: role.name_fr,
      description: role.description || '',
      permissions: role.permissions || [],
    });
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setEditingRole(null);
    setFormData({
      name: '',
      name_fr: '',
      description: '',
      permissions: [],
    });
  };

  const openNewRoleDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const togglePermission = (permId) => {
    if (formData.permissions.includes(permId)) {
      setFormData({
        ...formData,
        permissions: formData.permissions.filter(p => p !== permId),
      });
    } else {
      setFormData({
        ...formData,
        permissions: [...formData.permissions, permId],
      });
    }
  };

  // Group permissions by module
  const groupedPermissions = permissions.reduce((acc, perm) => {
    const module = perm.module;
    if (!acc[module]) acc[module] = [];
    acc[module].push(perm);
    return acc;
  }, {});

  if (!hasRole('president')) {
    return (
      <div className="swiss-card text-center py-8">
        <ShieldOff className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <p className="text-muted-foreground">Accès réservé au président</p>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="roles-page">
      <div className="page-header">
        <h1 className="page-title flex items-center gap-2">
          <Shield className="h-6 w-6" />
          Rôles & Permissions
        </h1>
        <Button onClick={openNewRoleDialog} data-testid="add-role-btn">
          <Plus className="h-4 w-4 mr-2" />
          Nouveau rôle
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="loading-spinner" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {roles.map((role) => (
            <div 
              key={role.role_id} 
              className="swiss-card space-y-3"
              data-testid={`role-card-${role.role_id}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-primary" />
                  <h3 className="font-bold">{role.name_fr}</h3>
                  {role.is_system && (
                    <Lock className="h-4 w-4 text-muted-foreground" title="Rôle système" />
                  )}
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleEdit(role)}
                    data-testid={`edit-role-${role.role_id}`}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  {!role.is_system && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(role)}
                      data-testid={`delete-role-${role.role_id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
              
              {role.description && (
                <p className="text-sm text-muted-foreground">{role.description}</p>
              )}
              
              <div className="text-xs text-muted-foreground">
                {role.permissions?.includes('*') 
                  ? 'Toutes les permissions' 
                  : `${role.permissions?.length || 0} permission(s)`}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingRole ? 'Modifier le rôle' : 'Nouveau rôle'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Identifiant *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
                  required
                  disabled={editingRole?.is_system}
                  data-testid="role-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="name_fr">Nom affiché *</Label>
                <Input
                  id="name_fr"
                  value={formData.name_fr}
                  onChange={(e) => setFormData({ ...formData, name_fr: e.target.value })}
                  required
                  data-testid="role-name-fr"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                data-testid="role-description"
              />
            </div>

            <div className="space-y-2">
              <Label>Permissions</Label>
              <Accordion type="multiple" className="w-full">
                {Object.entries(groupedPermissions).map(([module, perms]) => (
                  <AccordionItem key={module} value={module}>
                    <AccordionTrigger className="text-sm font-medium capitalize">
                      {module}
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="grid grid-cols-2 gap-2 pt-2">
                        {perms.map((perm) => (
                          <div key={perm.permission_id} className="flex items-center space-x-2">
                            <Checkbox
                              id={perm.permission_id}
                              checked={formData.permissions.includes(`${perm.module}:${perm.action}`)}
                              onCheckedChange={() => togglePermission(`${perm.module}:${perm.action}`)}
                              data-testid={`perm-${perm.permission_id}`}
                            />
                            <Label htmlFor={perm.permission_id} className="text-sm cursor-pointer">
                              {perm.name_fr}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Annuler
              </Button>
              <Button type="submit" data-testid="save-role-btn">
                {editingRole ? 'Enregistrer' : 'Créer'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
