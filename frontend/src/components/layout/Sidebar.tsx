import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Briefcase,
  Star,
  FileSearch,
  FileText,
  Bot,
  Settings,
  Radar,
  Moon,
  Sun,
  Layers,
  X,
  ChevronLeft,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
  LogOut,
  User as UserIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import appLogo from '@/assets/app-logo.png';

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const navItems: NavItem[] = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Applications', href: '/applications', icon: Briefcase },
  { name: 'AI Job Watcher', href: '/watcher', icon: Radar },
  { name: 'Favorites', href: '/favorites', icon: Star },
  { name: 'Job Extractor', href: '/extractor', icon: FileSearch },
  { name: 'Resume Analyzer', href: '/analyzer', icon: FileText },
  { name: 'AI Assistant', href: '/assistant', icon: Bot },
  { name: 'Settings', href: '/settings', icon: Settings },
];

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen = false,
  onClose,
  isCollapsed = false,
  onToggleCollapse,
}) => {
  const { user, logout } = useAuth();
  const [isDark, setIsDark] = useState<boolean>(() => {
    return (
      localStorage.getItem('theme') === 'dark' ||
      (!('theme' in localStorage) &&
        window.matchMedia('(prefers-color-scheme: dark)').matches)
    );
  });

  const [leavesEnabled, setLeavesEnabled] = useState<boolean>(() => {
    return localStorage.getItem('autumn-leaves') !== 'false';
  });

  const [trainIntensity, setTrainIntensity] = useState<string>(() => {
    return localStorage.getItem('autumn-bg-intensity') || 'cozy';
  });

  useEffect(() => {
    const handleIntensityUpdate = (e: CustomEvent<{ intensity: string }>) => {
      setTrainIntensity(e.detail.intensity);
    };
    window.addEventListener('autumn-bg-intensity-toggle' as any, handleIntensityUpdate);
    return () => {
      window.removeEventListener('autumn-bg-intensity-toggle' as any, handleIntensityUpdate);
    };
  }, []);

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);

  const toggleDarkMode = () => {
    setIsDark((prev) => !prev);
  };

  const toggleLeaves = () => {
    const next = !leavesEnabled;
    setLeavesEnabled(next);
    localStorage.setItem('autumn-leaves', String(next));
    window.dispatchEvent(new CustomEvent('autumn-leaves-toggle', { detail: { enabled: next } }));
  };

  const cycleTrainIntensity = () => {
    const cycle = ['cozy', 'vivid', 'cinematic', 'off', 'subtle'];
    const nextIdx = (cycle.indexOf(trainIntensity) + 1) % cycle.length;
    const next = cycle[nextIdx];
    setTrainIntensity(next);
    localStorage.setItem('autumn-bg-intensity', next);
    window.dispatchEvent(new CustomEvent('autumn-bg-intensity-toggle', { detail: { intensity: next } }));
  };

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-background/80 backdrop-blur-xs lg:hidden transition-opacity"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          'fixed left-0 top-0 z-50 flex h-screen flex-col border-r bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/75 transition-all duration-300 ease-in-out',
          isOpen ? 'translate-x-0 w-64' : '-translate-x-full lg:translate-x-0',
          isCollapsed ? 'lg:w-16' : 'lg:w-60'
        )}
      >
        {/* Brand Header with Autumn Leaves Accent */}
        <div
          className={cn(
            'flex h-16 items-center border-b autumn-tree-shading transition-all duration-300',
            isCollapsed ? 'justify-center px-2' : 'justify-between px-4 lg:px-5'
          )}
        >
          {!isCollapsed ? (
            <>
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl overflow-hidden shrink-0 bg-transparent">
                  <img
                    src={appLogo}
                    alt="Autumn Suite"
                    className="h-full w-full object-contain border-0 outline-none ring-0 shadow-none bg-transparent"
                  />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="font-bold tracking-tight text-base text-foreground leading-tight truncate">
                    Autumn Suite
                  </span>
                  <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider truncate">
                    🍂 Smart Career Hub
                  </span>
                </div>
              </div>

              {/* Desktop Collapse Button */}
              <Button
                variant="ghost"
                size="icon"
                onClick={onToggleCollapse}
                className="hidden lg:flex h-8 w-8 text-muted-foreground hover:text-foreground shrink-0 cursor-pointer"
                title="Collapse sidebar (Ctrl+B)"
                aria-label="Collapse sidebar"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </>
          ) : (
            /* Collapsed Brand Icon */
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleCollapse}
              className="hidden lg:flex h-10 w-10 rounded-xl overflow-hidden p-1 hover:ring-2 hover:ring-primary/40 transition-all cursor-pointer"
              title="Expand sidebar (Ctrl+B)"
              aria-label="Expand sidebar"
            >
              <img
                src={appLogo}
                alt="Autumn Suite"
                className="h-full w-full object-contain rounded-lg border-0 outline-none ring-0 shadow-none bg-transparent"
              />
            </Button>
          )}

          {/* Mobile Close Button */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 lg:hidden text-muted-foreground hover:text-foreground"
            onClick={onClose}
            aria-label="Close navigation"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Navigation Links */}
        <div
          className={cn(
            'flex-1 overflow-y-auto py-4 transition-all',
            isCollapsed ? 'px-2' : 'px-3'
          )}
        >
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.href}
                  to={item.href}
                  onClick={() => onClose?.()}
                  title={isCollapsed ? item.name : undefined}
                  className={({ isActive }) =>
                    cn(
                      'group flex items-center rounded-lg text-sm font-medium transition-all duration-200 ease-out active:scale-[0.98]',
                      isCollapsed
                        ? 'justify-center h-10 w-10 mx-auto p-0'
                        : 'gap-3 px-3 py-2.5 hover:translate-x-1',
                      isActive
                        ? 'bg-primary text-primary-foreground shadow-xs'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <Icon
                        className={cn(
                          'shrink-0 transition-transform duration-150 group-hover:scale-110',
                          isCollapsed ? 'h-5 w-5' : 'h-4 w-4',
                          isActive
                            ? 'text-primary-foreground'
                            : 'text-muted-foreground group-hover:text-foreground'
                        )}
                      />
                      {!isCollapsed && <span className="truncate">{item.name}</span>}
                    </>
                  )}
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer with Autumn Controls */}
        <div
          className={cn(
            'border-t bg-muted/20 transition-all duration-300',
            isCollapsed ? 'p-2 space-y-1' : 'p-3 space-y-1.5'
          )}
        >
          {/* Falling Leaves Toggle */}
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleLeaves}
            className={cn(
              'w-full text-muted-foreground hover:text-foreground h-8 cursor-pointer transition-colors',
              isCollapsed ? 'justify-center px-0' : 'justify-between px-2.5'
            )}
            title={leavesEnabled ? 'Pause floating autumn leaves' : 'Enable floating autumn leaves'}
          >
            <span
              className={cn(
                'flex items-center gap-2 text-xs font-medium',
                isCollapsed && 'justify-center'
              )}
            >
              <span className="text-sm">🍁</span>
              {!isCollapsed && <span>Blowing Leaves</span>}
            </span>
            {!isCollapsed && (
              <span
                className={`text-[10px] rounded px-1.5 py-0.5 font-medium ${
                  leavesEnabled
                    ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {leavesEnabled ? 'Blowing' : 'Off'}
              </span>
            )}
          </Button>

          {/* Autumn Train Landscape Background Toggle */}
          <Button
            variant="ghost"
            size="sm"
            onClick={cycleTrainIntensity}
            className={cn(
              'w-full text-muted-foreground hover:text-foreground h-8 cursor-pointer transition-colors',
              isCollapsed ? 'justify-center px-0' : 'justify-between px-2.5'
            )}
            title="Cycle scenic autumn train landscape background opacity"
          >
            <span
              className={cn(
                'flex items-center gap-2 text-xs font-medium',
                isCollapsed && 'justify-center'
              )}
            >
              <span className="text-sm">🚂</span>
              {!isCollapsed && <span>Autumn Train</span>}
            </span>
            {!isCollapsed && (
              <span className="text-[10px] rounded px-1.5 py-0.5 font-medium bg-amber-500/20 text-amber-700 dark:text-amber-300 capitalize">
                {trainIntensity}
              </span>
            )}
          </Button>

          {/* Theme Mode Toggle */}
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleDarkMode}
            className={cn(
              'w-full text-muted-foreground hover:text-foreground h-8 cursor-pointer transition-colors',
              isCollapsed ? 'justify-center px-0' : 'justify-between px-2.5'
            )}
            title={isDark ? 'Switch to Warm Glow (Light)' : 'Switch to Twilight (Dark)'}
          >
            <span
              className={cn(
                'flex items-center gap-2 text-xs font-medium',
                isCollapsed && 'justify-center'
              )}
            >
              {isDark ? (
                <>
                  <Moon className="h-3.5 w-3.5 text-primary shrink-0" />
                  {!isCollapsed && <span>Autumn Twilight</span>}
                </>
              ) : (
                <>
                  <Sun className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                  {!isCollapsed && <span>Autumn Glow</span>}
                </>
              )}
            </span>
            {!isCollapsed && (
              <span className="text-[10px] rounded bg-muted px-1.5 py-0.5 text-muted-foreground">
                {isDark ? 'Dark' : 'Warm'}
              </span>
            )}
          </Button>

          {/* Expand toggle button when collapsed */}
          {isCollapsed && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggleCollapse}
              className="w-full h-8 justify-center px-0 text-muted-foreground hover:text-foreground cursor-pointer mt-1"
              title="Expand sidebar (Ctrl+B)"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}

          {/* User Profile & Sign Out */}
          {user && (
            <div
              className={cn(
                'pt-2 mt-2 border-t border-border/60 flex items-center',
                isCollapsed ? 'flex-col gap-2' : 'justify-between gap-2'
              )}
            >
              <div
                className={cn(
                  'flex items-center gap-2.5 min-w-0',
                  isCollapsed && 'justify-center'
                )}
                title={`${user.name} (${user.email})`}
              >
                {user.avatar ? (
                  <img
                    src={user.avatar}
                    alt={user.name}
                    className="w-7 h-7 rounded-full object-cover border border-autumn-card-border shrink-0"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-autumn-primary to-autumn-secondary text-white font-semibold text-xs flex items-center justify-center shrink-0 shadow-xs">
                    {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                  </div>
                )}
                {!isCollapsed && (
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-foreground truncate leading-tight">
                      {user.name}
                    </p>
                    <p className="text-[10px] text-muted-foreground truncate leading-tight">
                      {user.email}
                    </p>
                  </div>
                )}
              </div>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => logout()}
                className={cn(
                  'text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer shrink-0',
                  isCollapsed ? 'h-7 w-7' : 'h-7 w-7'
                )}
                title="Sign Out"
                aria-label="Sign Out"
              >
                <LogOut className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
};
