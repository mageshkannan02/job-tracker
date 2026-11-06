import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Briefcase,
  Radar,
  Bot,
  Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavTab {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const tabs: NavTab[] = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Applications', href: '/applications', icon: Briefcase },
  { name: 'AI Watcher', href: '/watcher', icon: Radar },
  { name: 'AI Chat', href: '/assistant', icon: Bot },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export const MobileBottomNav: React.FC = () => {
  const location = useLocation();

  return (
    <nav
      className="mobile-bottom-dock fixed bottom-0 left-0 right-0 z-40 lg:hidden border-t border-border/80 bg-card/90 pb-safe shadow-[0_-4px_20px_-2px_rgba(0,0,0,0.06)]"
      aria-label="Mobile Navigation Bar"
    >
      <div className="flex items-center justify-around h-15 px-2 max-w-lg mx-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = location.pathname === tab.href;

          return (
            <NavLink
              key={tab.href}
              to={tab.href}
              className={({ isActive: active }) =>
                cn(
                  'flex flex-col items-center justify-center flex-1 py-1.5 px-1 rounded-xl transition-all duration-150 ease-out touch-manipulation group active:scale-95',
                  active
                    ? 'text-primary font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                )
              }
            >
              <div
                className={cn(
                  'relative flex items-center justify-center p-1 rounded-xl transition-all duration-200',
                  isActive
                    ? 'bg-primary/15 text-primary scale-105'
                    : 'text-muted-foreground group-hover:text-foreground'
                )}
              >
                <Icon className="h-5 w-5 shrink-0" />
                {isActive && (
                  <span className="absolute -bottom-1 w-1.5 h-1.5 rounded-full bg-primary" />
                )}
              </div>
              <span className="text-[10px] tracking-tight mt-0.5 leading-tight truncate">
                {tab.name}
              </span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
};

export default MobileBottomNav;

