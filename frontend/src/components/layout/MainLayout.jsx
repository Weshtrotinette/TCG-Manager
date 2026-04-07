import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Button } from '../ui/button';
import { Menu } from 'lucide-react';

export function MainLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    // Check localStorage for saved preference
    const saved = localStorage.getItem('sidebar_collapsed');
    if (saved !== null) return JSON.parse(saved);
    
    // Default: collapsed on tablet, expanded on desktop
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 768 && window.innerWidth < 1280;
    }
    return false;
  });

  // Save preference to localStorage
  useEffect(() => {
    localStorage.setItem('sidebar_collapsed', JSON.stringify(sidebarCollapsed));
  }, [sidebarCollapsed]);

  // Auto-collapse on tablet-sized screens
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      // Auto-collapse between 768px and 1280px (tablet landscape range)
      if (width >= 768 && width < 1280) {
        setSidebarCollapsed(true);
      }
    };

    // Only run on initial load, not on every resize (to respect user preference)
    // handleResize();
    
    return () => {};
  }, []);

  const toggleCollapse = () => {
    setSidebarCollapsed(prev => !prev);
  };

  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar 
        isOpen={sidebarOpen} 
        onClose={() => setSidebarOpen(false)}
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={toggleCollapse}
      />
      
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <header className="lg:hidden h-14 border-b border-border bg-card flex items-center px-4 sticky top-0 z-30">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(true)}
            className="h-10 w-10"
            data-testid="open-sidebar-btn"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <span className="ml-3 font-bold">TCG Manager</span>
        </header>
        
        {/* Main content */}
        <main className="flex-1 overflow-auto p-3 md:p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
