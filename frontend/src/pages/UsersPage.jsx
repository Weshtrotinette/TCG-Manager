import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { formatDate } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '../components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import { Switch } from '../components/ui/switch';
import { UserCog, Shield, ShieldOff } from 'lucide-react';
import { toast } from 'sonner';

export function UsersPage() {
  const { user: currentUser, hasRole } = useAuth();
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [usersData, rolesData] = await Promise.all([
        api.getUsers(),
        api.getRoles(),
      ]);
      setUsers(usersData);
      setRoles(rolesData);
    } catch (err) {
      toast.error('Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (userId, newRoles) => {
    try {
      await api.updateUserRoles(userId, newRoles);
      toast.success('Rôles mis à jour');
      loadData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleStatusChange = async (userId, isActive) => {
    try {
      await api.updateUserStatus(userId, isActive);
      toast.success(`Utilisateur ${isActive ? 'activé' : 'désactivé'}`);
      loadData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const isCurrentUser = (userId) => userId === currentUser?.user_id;

  if (!hasRole('president')) {
    return (
      <div className="swiss-card text-center py-8">
        <ShieldOff className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <p className="text-muted-foreground">Accès réservé au président</p>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="users-page">
      <div className="page-header">
        <h1 className="page-title flex items-center gap-2">
          <UserCog className="h-6 w-6" />
          Utilisateurs
        </h1>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="loading-spinner" />
        </div>
      ) : (
        <div className="swiss-card p-0 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Utilisateur</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Rôles</TableHead>
                <TableHead>Inscription</TableHead>
                <TableHead className="text-center">Actif</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Aucun utilisateur
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user) => (
                  <TableRow key={user.user_id} data-testid={`user-row-${user.user_id}`}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {user.picture ? (
                          <img src={user.picture} alt={user.name} className="h-8 w-8 rounded-full" />
                        ) : (
                          <div className="h-8 w-8 bg-primary/20 flex items-center justify-center">
                            <span className="text-sm font-bold text-primary">
                              {user.name?.charAt(0) || 'U'}
                            </span>
                          </div>
                        )}
                        <div>
                          <div className="font-medium">{user.name}</div>
                          {isCurrentUser(user.user_id) && (
                            <span className="text-xs text-muted-foreground">(vous)</span>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <Select
                        value={user.roles?.[0] || 'organisateur'}
                        onValueChange={(value) => handleRoleChange(user.user_id, [value])}
                        disabled={isCurrentUser(user.user_id)}
                      >
                        <SelectTrigger className="w-40" data-testid={`role-select-${user.user_id}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {roles.map(role => (
                            <SelectItem key={role.role_id} value={role.name}>
                              {role.name_fr}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>{formatDate(user.created_at)}</TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={user.is_active !== false}
                        onCheckedChange={(checked) => handleStatusChange(user.user_id, checked)}
                        disabled={isCurrentUser(user.user_id)}
                        data-testid={`status-switch-${user.user_id}`}
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
