import React, { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Menu,
  Plus,
  Search,
  Sparkles,
  ArrowLeft,
  X,
  PanelLeftClose,
  PanelLeftOpen,
  LogOut,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NotificationCenter } from './NotificationCenter';
import { useAuth } from '@/context/AuthContext';
import appLogo from '@/assets/app-logo.png';

interface TopBarProps {
  onAddApplication?: () => void;
  searchQuery?: string;
  onSearchChange?: (val: string) => void;
  onOpenMobileMenu?: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

const routeTitles: Record<string, { title: string; subtitle: string }> = {
  '/dashboard': {
    title: 'Dashboard',
    subtitle: 'Track your career opportunities and analytics',
  },
  '/applications': {
    title: 'Job Applications',
    subtitle: 'Manage and update your pipeline of opportunities',
  },
  '/extractor': {
    title: 'Job Extractor',
    subtitle: 'Extract job details from postings with AI',
  },
  '/analyzer': {
    title: 'Resume Analyzer',
    subtitle: 'Match resume qualifications against job requirements',
  },
  '/assistant': {
    title: 'AI Assistant',
    subtitle: 'Ask questions, prep for interviews, and draft emails',
  },
  '/settings': {
    title: 'Settings',
    subtitle: 'Configure your API keys, preferences, and data exports',
  },
  '/watcher': {
    title: 'AI Job Watcher',
    subtitle: 'Automated daily discovery of newly published job openings',
  },
  '/favorites': {
    title: 'Priority Companies',
    subtitle: 'Curated list of target companies and career pages',
  },
};

export const TopBar: React.FC<TopBarProps> = ({
  onAddApplication,
  searchQuery = '',
  onSearchChange,
  onOpenMobileMenu,
  isCollapsed,
  onToggleCollapse,
}) => {
  const { user, logout } = useAuth();
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState<boolean>(false);
  const mobileInputRef = useRef<HTMLInputElement>(null);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (isMobileSearchOpen) {
      mobileInputRef.current?.focus();
    }
  }, [isMobileSearchOpen]);

  const currentRouteInfo =
    routeTitles[location.pathname] || {
      title: 'Autumn Suite',
      subtitle: 'Manage your career opportunities and pipeline',
    };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (location.pathname !== '/applications') {
      navigate('/applications');
    }
  };

  // Expanded full-width search mode for mobile screens
  if (isMobileSearchOpen) {
    return (
      <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b bg-background px-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 shadow-xs animate-in fade-in duration-150">
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 w-full">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground"
            onClick={() => setIsMobileSearchOpen(false)}
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>

          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              ref={mobileInputRef}
              type="search"
              placeholder="Search companies, roles, skills..."
              value={searchQuery}
              onChange={(e) => onSearchChange?.(e.target.value)}
              className="w-full pl-8.5 pr-8 h-9 text-xs rounded-lg bg-muted/50 focus-visible:bg-background"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchChange?.('')}
                className="absolute right-2 top-2 p-0.5 text-muted-foreground hover:text-foreground rounded"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <Button type="submit" size="sm" className="h-9 px-3 text-xs shrink-0 font-medium">
            Search
          </Button>
        </form>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b bg-background/95 px-3 sm:px-6 lg:px-8 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        {/* Mobile Hamburger Button */}
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 lg:hidden text-foreground -ml-1 shrink-0"
          onClick={onOpenMobileMenu}
          aria-label="Open mobile menu"
        >
          <Menu className="h-5 w-5" />
        </Button>

        {/* Desktop Sidebar Collapse Toggle */}
        {onToggleCollapse && (
          <Button
            variant="ghost"
            size="icon"
            className="hidden lg:flex h-9 w-9 text-muted-foreground hover:text-foreground shrink-0 cursor-pointer -ml-2"
            onClick={onToggleCollapse}
            title={isCollapsed ? 'Expand sidebar (Ctrl+B)' : 'Collapse sidebar (Ctrl+B)'}
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </Button>
        )}

        <div className="flex items-center gap-2.5 min-w-0">
          <img
            src={appLogo}
            alt="Logo"
            className="h-7 w-7 rounded-lg lg:hidden object-contain shrink-0 border-0 outline-none ring-0 shadow-none bg-transparent"
          />
          <div className="min-w-0">
            <h1 className="text-base sm:text-xl font-bold tracking-tight text-foreground truncate max-w-[130px] xs:max-w-[180px] sm:max-w-none">
              {currentRouteInfo.title}
            </h1>
            <p className="text-xs text-muted-foreground hidden sm:block">
              {currentRouteInfo.subtitle}
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
        {/* Mobile Search Icon Button */}
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 sm:hidden text-muted-foreground hover:text-foreground"
          onClick={() => setIsMobileSearchOpen(true)}
          aria-label="Open search"
          title="Search roles and applications"
        >
          <Search className="h-4 w-4" />
        </Button>

        {/* Desktop / Tablet Search Input */}
        <form onSubmit={handleSearchSubmit} className="relative hidden sm:block sm:w-48 md:w-64 lg:w-72">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            type="search"
            placeholder="Search roles..."
            value={searchQuery}
            onChange={(e) => onSearchChange?.(e.target.value)}
            className="w-full pl-8 sm:pl-9 h-9 text-xs rounded-lg bg-muted/40 focus-visible:bg-background transition-colors"
          />
        </form>

        {/* AI Quick Nav (hidden on small screens) */}
        <Button
          variant="outline"
          size="sm"
          className="hidden md:flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary h-9"
          onClick={() => navigate('/assistant')}
        >
          <Sparkles className="h-3.5 w-3.5" />
          Ask AI
        </Button>

        {/* In-App Notification Center */}
        <NotificationCenter />

        {/* User Profile / Logout Button (Quick Mobile & Desktop Access) */}
        {user && (
          <div className="flex items-center gap-1 sm:gap-2">
            <div
              className="flex items-center gap-1.5 p-1 sm:px-2 sm:py-1 rounded-lg bg-muted/50 border border-border/50 text-xs text-foreground max-w-[120px] sm:max-w-[160px] truncate"
              title={`${user.name} (${user.email})`}
            >
              {user.avatar ? (
                <img
                  src={user.avatar}
                  alt={user.name}
                  className="w-5 h-5 rounded-full object-cover shrink-0"
                />
              ) : (
                <div className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center shrink-0">
                  {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                </div>
              )}
              <span className="hidden sm:inline font-medium truncate">{user.name}</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => logout()}
              className="h-9 w-9 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              title="Sign Out"
              aria-label="Sign Out"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Add Application Button */}
        <Button
          size="sm"
          onClick={onAddApplication}
          className="gap-1.5 text-xs font-semibold shadow-xs shrink-0 h-9 px-2.5 sm:px-3"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Add Application</span>
          <span className="sm:hidden">Add</span>
        </Button>
      </div>
    </header>
  );
};
