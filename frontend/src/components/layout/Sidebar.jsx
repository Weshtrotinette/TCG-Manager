import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { cn } from '../../lib/utils';
import {
  LayoutDashboard,
  Users,
  CreditCard,
  Calendar,
  ShoppingCart,
  Package,
  Receipt,
  BarChart3,
  Settings,
  LogOut,
  Sun,
  Moon,
  Swords,
  X,
  UserCog,
  Shield,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '../ui/button';

const navigation = [
  { name: 'Tableau de bord', href: '/dashboard', icon: LayoutDashboard, permission: 'dashboard:read' },
  { name: 'Membres', href: '/members', icon: Users, permission: 'members:read' },
  { name: 'Cotisations', href: '/subscriptions', icon: CreditCard, permission: 'subscriptions:read' },
  { name: 'Événements', href: '/events', icon: Calendar, permission: 'events:read' },
  { name: 'Caisse rapide', href: '/pos', icon: ShoppingCart, permission: 'sales:create' },
  { name: 'Produits & Stocks', href: '/products', icon: Package, permission: 'products:read' },
  { name: 'Dépenses', href: '/expenses', icon: Receipt, permission: 'expenses:read' },
  { name: 'Rapports', href: '/reports', icon: BarChart3, permission: 'reports:read' },
];

const adminNavigation = [
  { name: 'Utilisateurs', href: '/users', icon: UserCog, role: 'president' },
  { name: 'Emails autorisés', href: '/whitelist', icon: ShieldCheck, role: 'president' },
  { name: 'Rôles', href: '/roles', icon: Shield, role: 'president' },
  { name: 'Paramètres', href: '/settings', icon: Settings, permission: 'settings:read' },
];

export function Sidebar({ isOpen, onClose }) {
  const { user, logout, hasPermission, hasRole } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();

  const canAccess = (item) => {
    if (item.role) return hasRole(item.role);
    if (item.permission) return hasPermission(item.permission);
    return true;
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
          data-testid="sidebar-overlay"
        />
      )}
      
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 bg-card border-r border-border flex flex-col transform transition-transform duration-200 lg:relative lg:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
        data-testid="sidebar"
      >
        {/* Header */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Swords className="h-6 w-6 text-primary" />
            <span className="font-bold text-lg tracking-tight">TCG Manager</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={onClose}
            data-testid="close-sidebar-btn"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4">
          <div className="px-3 mb-2">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
              Menu principal
            </span>
          </div>
          
          {navigation.filter(canAccess).map((item) => (
            <NavLink
              key={item.href}
              to={item.href}
              onClick={onClose}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors duration-200",
                  isActive
                    ? "text-primary bg-primary/10 border-l-2 border-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )
              }
              data-testid={`nav-${item.href.slice(1)}`}
            >
              <item.icon className="h-5 w-5" />
              {item.name}
            </NavLink>
          ))}

          {/* Admin section */}
          {adminNavigation.some(canAccess) && (
            <>
              <div className="px-3 mt-6 mb-2">
                <span className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
                  Administration
                </span>
              </div>
              
              {adminNavigation.filter(canAccess).map((item) => (
                <NavLink
                  key={item.href}
                  to={item.href}
                  onClick={onClose}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors duration-200",
                      isActive
                        ? "text-primary bg-primary/10 border-l-2 border-primary"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    )
                  }
                  data-testid={`nav-${item.href.slice(1)}`}
                >
                  <item.icon className="h-5 w-5" />
                  {item.name}
                </NavLink>
              ))}
            </>
          )}
        </nav>

        {/* Footer */}
        <div className="border-t border-border p-4 space-y-3">
          {/* Theme toggle */}
          <Button
            variant="ghost"
            className="w-full justify-start gap-3"
            onClick={toggleTheme}
            data-testid="theme-toggle-btn"
          >
            {theme === 'dark' ? (
              <>
                <Sun className="h-5 w-5" />
                Mode clair
              </>
            ) : (
              <>
                <Moon className="h-5 w-5" />
                Mode sombre
              </>
            )}
          </Button>

          {/* User info */}
          <div className="flex items-center gap-3 px-2">
            {user?.picture ? (
              <img
                src={user.picture}
                alt={user.name}
                className="h-8 w-8 rounded-full"
              />
            ) : (
              <div className="h-8 w-8 bg-primary/20 flex items-center justify-center">
                <span className="text-sm font-bold text-primary">
                  {user?.name?.charAt(0) || 'U'}
                </span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.name}</p>
              <p className="text-xs text-muted-foreground truncate capitalize">
                {user?.roles?.[0] || 'Utilisateur'}
              </p>
            </div>
          </div>

          {/* Logout */}
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={logout}
            data-testid="logout-btn"
          >
            <LogOut className="h-5 w-5" />
            Déconnexion
          </Button>
        </div>
      </aside>
    </>
  );
}
