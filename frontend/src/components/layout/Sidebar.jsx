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
  ChevronLeft,
  ChevronRight,
  ClipboardList,
} from 'lucide-react';
import { Button } from '../ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip';

const navigation = [
  { name: 'Tableau de bord', href: '/dashboard', icon: LayoutDashboard, permission: 'dashboard:read' },
  { name: 'Membres', href: '/members', icon: Users, permission: 'members:read' },
  { name: 'Cotisations', href: '/subscriptions', icon: CreditCard, permission: 'subscriptions:read' },
  { name: 'Événements', href: '/events', icon: Calendar, permission: 'events:read' },
  { name: 'Caisse rapide', href: '/pos', icon: ShoppingCart, permission: 'sales:create' },
  { name: 'Ventes', href: '/sales', icon: ClipboardList, permission: 'sales:read' },
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

export function Sidebar({ isOpen, onClose, isCollapsed, onToggleCollapse }) {
  const { user, logout, hasPermission, hasRole } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();

  const canAccess = (item) => {
    if (item.role) return hasRole(item.role);
    if (item.permission) return hasPermission(item.permission);
    return true;
  };

  const NavItem = ({ item, isActive }) => {
    const content = (
      <NavLink
        to={item.href}
        onClick={onClose}
        className={cn(
          "flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors duration-200",
          isCollapsed && "justify-center px-2",
          isActive
            ? "text-primary bg-primary/10 border-l-2 border-primary"
            : "text-muted-foreground hover:text-foreground hover:bg-muted",
          isCollapsed && isActive && "border-l-0 border-b-2"
        )}
        data-testid={`nav-${item.href.slice(1)}`}
      >
        <item.icon className={cn("h-5 w-5 flex-shrink-0", isCollapsed && "h-6 w-6")} />
        {!isCollapsed && <span className="truncate">{item.name}</span>}
      </NavLink>
    );

    if (isCollapsed) {
      return (
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            {content}
          </TooltipTrigger>
          <TooltipContent side="right" className="font-medium">
            {item.name}
          </TooltipContent>
        </Tooltip>
      );
    }

    return content;
  };

  return (
    <TooltipProvider>
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
          "fixed inset-y-0 left-0 z-50 bg-card border-r border-border flex flex-col transform transition-all duration-300 ease-in-out",
          // Mobile: full width drawer
          "lg:relative lg:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full",
          // Width based on collapsed state
          isCollapsed ? "w-16" : "w-64"
        )}
        data-testid="sidebar"
      >
        {/* Header */}
        <div className={cn(
          "flex items-center h-16 border-b border-border",
          isCollapsed ? "justify-center px-2" : "justify-between px-4"
        )}>
          {isCollapsed ? (
            <Swords className="h-7 w-7 text-primary" />
          ) : (
            <div className="flex items-center gap-2">
              <Swords className="h-6 w-6 text-primary" />
              <span className="font-bold text-lg tracking-tight">TCG Manager</span>
            </div>
          )}
          
          {/* Mobile close button */}
          {!isCollapsed && (
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={onClose}
              data-testid="close-sidebar-btn"
            >
              <X className="h-5 w-5" />
            </Button>
          )}
        </div>

        {/* Collapse toggle button - visible on tablet/desktop */}
        <div className="hidden lg:flex justify-end p-2 border-b border-border">
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={onToggleCollapse}
                className="h-8 w-8"
                data-testid="collapse-sidebar-btn"
              >
                {isCollapsed ? (
                  <ChevronRight className="h-4 w-4" />
                ) : (
                  <ChevronLeft className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              {isCollapsed ? "Agrandir le menu" : "Réduire le menu"}
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-2">
          {!isCollapsed && (
            <div className="px-3 mb-2">
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
                Menu
              </span>
            </div>
          )}
          
          <div className="space-y-1">
            {navigation.filter(canAccess).map((item) => (
              <NavItem 
                key={item.href} 
                item={item} 
                isActive={location.pathname === item.href || location.pathname.startsWith(item.href + '/')}
              />
            ))}
          </div>

          {/* Admin section */}
          {adminNavigation.some(canAccess) && (
            <>
              {!isCollapsed && (
                <div className="px-3 mt-6 mb-2">
                  <span className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
                    Admin
                  </span>
                </div>
              )}
              {isCollapsed && <div className="my-4 mx-2 border-t border-border" />}
              
              <div className="space-y-1">
                {adminNavigation.filter(canAccess).map((item) => (
                  <NavItem 
                    key={item.href} 
                    item={item}
                    isActive={location.pathname === item.href}
                  />
                ))}
              </div>
            </>
          )}
        </nav>

        {/* Footer */}
        <div className={cn(
          "border-t border-border",
          isCollapsed ? "p-2 space-y-2" : "p-4 space-y-3"
        )}>
          {/* Theme toggle */}
          {isCollapsed ? (
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleTheme}
                  className="w-full h-10"
                  data-testid="theme-toggle-btn"
                >
                  {theme === 'dark' ? (
                    <Sun className="h-5 w-5" />
                  ) : (
                    <Moon className="h-5 w-5" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                {theme === 'dark' ? 'Mode clair' : 'Mode sombre'}
              </TooltipContent>
            </Tooltip>
          ) : (
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
          )}

          {/* User info */}
          {isCollapsed ? (
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <div className="flex justify-center">
                  {user?.picture ? (
                    <img
                      src={user.picture}
                      alt={user.name}
                      className="h-9 w-9 rounded-full"
                    />
                  ) : (
                    <div className="h-9 w-9 bg-primary/20 flex items-center justify-center rounded-full">
                      <span className="text-sm font-bold text-primary">
                        {user?.name?.charAt(0) || 'U'}
                      </span>
                    </div>
                  )}
                </div>
              </TooltipTrigger>
              <TooltipContent side="right">
                <div>
                  <p className="font-medium">{user?.name}</p>
                  <p className="text-xs text-muted-foreground capitalize">{user?.roles?.[0]}</p>
                </div>
              </TooltipContent>
            </Tooltip>
          ) : (
            <div className="flex items-center gap-3 px-2">
              {user?.picture ? (
                <img
                  src={user.picture}
                  alt={user.name}
                  className="h-8 w-8 rounded-full"
                />
              ) : (
                <div className="h-8 w-8 bg-primary/20 flex items-center justify-center rounded-full">
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
          )}

          {/* Logout */}
          {isCollapsed ? (
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={logout}
                  className="w-full h-10 text-destructive hover:text-destructive hover:bg-destructive/10"
                  data-testid="logout-btn"
                >
                  <LogOut className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Déconnexion</TooltipContent>
            </Tooltip>
          ) : (
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={logout}
              data-testid="logout-btn"
            >
              <LogOut className="h-5 w-5" />
              Déconnexion
            </Button>
          )}
        </div>
      </aside>
    </TooltipProvider>
  );
}
