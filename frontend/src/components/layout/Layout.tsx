import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { AutumnLeaves } from '@/components/common/AutumnLeaves';
import { AutumnTrainBackground } from '@/components/common/AutumnTrainBackground';
import { ApplicationForm } from '@/components/applications/ApplicationForm';
import { ApplicationCreateInput } from '@/types';
import { applicationsApi } from '@/lib/api';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export const Layout: React.FC = () => {
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('sidebar_collapsed') === 'true';
  });
  const [searchQuery, setSearchQuery] = useState<string>('');
  const navigate = useNavigate();
  const location = useLocation();

  const toggleSidebarCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('sidebar_collapsed', String(next));
      return next;
    });
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Toggle sidebar collapse with Ctrl+B or Cmd+B
      if ((e.ctrlKey || e.metaKey) && (e.key === 'b' || e.key === 'B')) {
        const target = e.target as HTMLElement | null;
        if (
          target &&
          (target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.isContentEditable)
        ) {
          return;
        }
        e.preventDefault();
        toggleSidebarCollapse();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleCreateApplication = async (data: ApplicationCreateInput) => {
    try {
      await applicationsApi.create(data);
      toast.success('Application added successfully');
      setIsAddModalOpen(false);
      // Dispatch custom event so any active page (Dashboard, Applications) can refetch
      window.dispatchEvent(new CustomEvent('application-updated'));
    } catch (err: any) {
      toast.error(err.message || 'Failed to add application');
    }
  };

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    // If not on applications page, redirect to applications with search
    if (window.location.pathname !== '/applications' && query.trim().length > 0) {
      navigate('/applications');
    }
  };

  return (
    <div className="flex min-h-screen bg-background relative selection:bg-amber-500/30">
      {/* Animated Scenic Autumn Train & Landscape Background */}
      <AutumnTrainBackground />

      {/* Autumn Floating Foliage Layer */}
      <AutumnLeaves />

      {/* Sidebar - responsive drawer on mobile, fixed / collapsible on desktop */}
      <Sidebar
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        isCollapsed={isCollapsed}
        onToggleCollapse={toggleSidebarCollapse}
      />

      {/* Main Content Area */}
      <div
        className={cn(
          'flex flex-1 flex-col min-w-0 transition-all duration-300 ease-in-out',
          isCollapsed ? 'lg:pl-16' : 'lg:pl-60'
        )}
      >
        <TopBar
          onAddApplication={() => setIsAddModalOpen(true)}
          searchQuery={searchQuery}
          onSearchChange={handleSearchChange}
          onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
          isCollapsed={isCollapsed}
          onToggleCollapse={toggleSidebarCollapse}
        />

        <main className="flex-1 p-3.5 sm:p-6 lg:p-8 overflow-y-auto">
          <div key={location.pathname} className="animate-in fade-in-50 slide-in-from-bottom-2 duration-250 ease-out fill-mode-both">
            <Outlet context={{ searchQuery, onOpenAddModal: () => setIsAddModalOpen(true) }} />
          </div>
        </main>
      </div>

      {/* Global Add Application Dialog */}
      <ApplicationForm
        open={isAddModalOpen}
        onOpenChange={setIsAddModalOpen}
        onSubmit={handleCreateApplication}
      />
    </div>
  );
};

export default Layout;
