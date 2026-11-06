import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  Kanban,
  List as ListIcon,
  Table as TableIcon,
  Calendar as CalendarIcon,
  Plus,
  Search,
  Filter,
  Star,
  X,
} from 'lucide-react';
import { useApplications } from '@/hooks/useApplications';
import { Application, ApplicationCreateInput, ApplicationStatus } from '@/types';
import { KanbanBoard } from '@/components/applications/KanbanBoard';
import { ApplicationTable } from '@/components/applications/ApplicationTable';
import { ApplicationListView } from '@/components/applications/ApplicationListView';
import { CalendarView } from '@/components/applications/CalendarView';
import { ApplicationForm } from '@/components/applications/ApplicationForm';
import { ApplicationDetail } from '@/components/applications/ApplicationDetail';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { EmptyState } from '@/components/common/EmptyState';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type ViewMode = 'kanban' | 'list' | 'table' | 'calendar';

export const Applications: React.FC = () => {
  const {
    applications,
    filteredApplications,
    loading,
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    fetchApplications,
    createApplication,
    updateApplication,
    deleteApplication,
    updateStatus,
    toggleFavorite,
  } = useApplications();

  const outletContext = useOutletContext<{ searchQuery?: string }>();

  // Sync outlet search if changed
  useEffect(() => {
    if (outletContext?.searchQuery !== undefined && outletContext.searchQuery !== searchQuery) {
      setSearchQuery(outletContext.searchQuery);
    }
  }, [outletContext?.searchQuery, setSearchQuery, searchQuery]);

  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    // Default to 'list' on mobile viewports (< 768px) for maximum smoothness and native feed scrolling
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      return (localStorage.getItem('applications_view_mode_mobile') as ViewMode) || 'list';
    }
    return (localStorage.getItem('applications_view_mode') as ViewMode) || 'kanban';
  });

  const handleSetViewMode = (mode: ViewMode) => {
    setViewMode(mode);
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      localStorage.setItem('applications_view_mode_mobile', mode);
    } else {
      localStorage.setItem('applications_view_mode', mode);
    }
  };

  // Modal dialog states
  const [formOpen, setFormOpen] = useState<boolean>(false);
  const [editingApp, setEditingApp] = useState<Application | null>(null);
  const [detailApp, setDetailApp] = useState<Application | null>(null);
  const [detailOpen, setDetailOpen] = useState<boolean>(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Default status for adding new application from specific column
  const [defaultStatusForNew, setDefaultStatusForNew] = useState<ApplicationStatus>('Wishlist');
  const [onlyFavorites, setOnlyFavorites] = useState<boolean>(false);

  const displayedApplications = React.useMemo(() => {
    if (onlyFavorites) {
      return filteredApplications.filter((app) => Boolean(app.is_favorite));
    }
    return filteredApplications;
  }, [filteredApplications, onlyFavorites]);

  const handleOpenAdd = (status?: ApplicationStatus) => {
    setEditingApp(null);
    setDefaultStatusForNew(status || 'Wishlist');
    setFormOpen(true);
  };

  const handleOpenEdit = (app: Application) => {
    setEditingApp(app);
    setFormOpen(true);
  };

  const handleOpenDetail = (app: Application) => {
    setDetailApp(app);
    setDetailOpen(true);
  };

  const handlePromptDelete = (id: string) => {
    setDeleteId(id);
    setDeleteOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteId) return;
    try {
      setIsDeleting(true);
      await deleteApplication(deleteId);
      setDeleteOpen(false);
      if (detailApp?.application_id === deleteId) {
        setDetailOpen(false);
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const handleFormSubmit = async (data: ApplicationCreateInput) => {
    if (editingApp) {
      const updated = await updateApplication(editingApp.application_id, data);
      if (detailApp?.application_id === editingApp.application_id && updated) {
        setDetailApp(updated);
      }
    } else {
      await createApplication({
        ...data,
        application_status: data.application_status || defaultStatusForNew,
      });
    }
    setFormOpen(false);
  };

  const handleStatusChange = async (id: string, newStatus: ApplicationStatus) => {
    await updateStatus(id, newStatus);
    if (detailApp?.application_id === id) {
      setDetailApp((prev) =>
        prev ? { ...prev, application_status: newStatus } : null
      );
    }
  };

  const handleToggleFavorite = async (app: Application) => {
    await toggleFavorite(app.application_id, !app.is_favorite);
    if (detailApp?.application_id === app.application_id) {
      setDetailApp((prev) =>
        prev ? { ...prev, is_favorite: !prev.is_favorite } : null
      );
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Controls Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 sm:gap-4">
        {/* Left: Search & Status Filter */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 flex-1">
          <div className="relative w-full sm:max-w-xs md:max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search by company, title, skills..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-8 h-9 text-xs w-full"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-2 p-0.5 text-muted-foreground hover:text-foreground rounded"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="w-full sm:w-44">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-9 text-xs w-full">
                <div className="flex items-center gap-1.5 truncate">
                  <Filter className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <SelectValue placeholder="All Statuses" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Stages</SelectItem>
                <SelectItem value="Wishlist">Wishlist</SelectItem>
                <SelectItem value="Applied">Applied</SelectItem>
                <SelectItem value="Assessment">Assessment</SelectItem>
                <SelectItem value="Interview">Interview</SelectItem>
                <SelectItem value="Offer">Offer</SelectItem>
                <SelectItem value="Rejected">Rejected</SelectItem>
                <SelectItem value="NoResponse">No Response</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Quick Favorites Filter Toggle */}
          <Button
            variant={onlyFavorites ? 'default' : 'outline'}
            size="sm"
            onClick={() => setOnlyFavorites(!onlyFavorites)}
            className={cn(
              'h-9 px-3 text-xs gap-1.5 shrink-0 transition-colors cursor-pointer',
              onlyFavorites
                ? 'bg-amber-500 hover:bg-amber-600 text-white border-amber-500 font-semibold shadow-xs'
                : 'text-muted-foreground hover:text-foreground hover:border-amber-400/60'
            )}
            title="Filter: Show only favorite high-priority jobs"
          >
            <Star
              className={cn(
                'h-3.5 w-3.5',
                onlyFavorites ? 'fill-white text-white' : 'text-amber-500 fill-amber-400'
              )}
            />
            <span>Favorites</span>
          </Button>
        </div>

        {/* Right: View Mode Toggle & Add Button */}
        <div className="flex items-center justify-between sm:justify-end gap-2.5 shrink-0">
          <div className="flex items-center rounded-lg border bg-muted p-0.5">
            <Button
              variant={viewMode === 'kanban' ? 'default' : 'ghost'}
              size="sm"
              className="h-8 px-2 sm:px-2.5 text-xs gap-1.5 cursor-pointer touch-manipulation"
              onClick={() => handleSetViewMode('kanban')}
              title="Kanban Board"
            >
              <Kanban className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Kanban</span>
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="sm"
              className="h-8 px-2 sm:px-2.5 text-xs gap-1.5 cursor-pointer touch-manipulation"
              onClick={() => handleSetViewMode('list')}
              title="List View"
            >
              <ListIcon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">List</span>
            </Button>
            <Button
              variant={viewMode === 'table' ? 'default' : 'ghost'}
              size="sm"
              className="h-8 px-2 sm:px-2.5 text-xs gap-1.5 cursor-pointer touch-manipulation"
              onClick={() => handleSetViewMode('table')}
              title="Table View"
            >
              <TableIcon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Table</span>
            </Button>
            <Button
              variant={viewMode === 'calendar' ? 'default' : 'ghost'}
              size="sm"
              className="h-8 px-2 sm:px-2.5 text-xs gap-1.5 cursor-pointer touch-manipulation"
              onClick={() => handleSetViewMode('calendar')}
              title="Calendar View"
            >
              <CalendarIcon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Calendar</span>
            </Button>
          </div>

          <Button
            size="sm"
            onClick={() => handleOpenAdd()}
            className="h-9 px-3 sm:px-3.5 text-xs font-semibold gap-1.5 shadow-xs shrink-0"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Add Application</span>
            <span className="sm:hidden">Add</span>
          </Button>
        </div>
      </div>

      {/* Main Content View */}
      {loading ? (
        <LoadingSpinner label="Loading applications..." />
      ) : applications.length === 0 ? (
        <EmptyState
          title="No job applications yet"
          description="Start your job search journey by adding roles to your wishlist or applied stage."
          actionLabel="Add Your First Application"
          onAction={() => handleOpenAdd()}
        />
      ) : (
        <div key={viewMode} className="animate-in fade-in-50 slide-in-from-bottom-2 duration-250 ease-out fill-mode-both">
          {viewMode === 'kanban' && (
            <KanbanBoard
              applications={displayedApplications}
              onStatusChange={handleStatusChange}
              onView={handleOpenDetail}
              onEdit={handleOpenEdit}
              onDelete={handlePromptDelete}
              onToggleFavorite={handleToggleFavorite}
              onAddApplication={(status) => handleOpenAdd(status)}
            />
          )}

          {viewMode === 'list' && (
            <ApplicationListView
              applications={displayedApplications}
              onView={handleOpenDetail}
              onEdit={handleOpenEdit}
              onDelete={handlePromptDelete}
              onStatusChange={handleStatusChange}
              onToggleFavorite={handleToggleFavorite}
            />
          )}

          {viewMode === 'table' && (
            <ApplicationTable
              applications={displayedApplications}
              onView={handleOpenDetail}
              onEdit={handleOpenEdit}
              onDelete={handlePromptDelete}
              onStatusChange={handleStatusChange}
              onToggleFavorite={handleToggleFavorite}
            />
          )}

          {viewMode === 'calendar' && (
            <CalendarView
              applications={displayedApplications}
              onView={handleOpenDetail}
            />
          )}
        </div>
      )}

      {/* Add / Edit Form Dialog */}
      <ApplicationForm
        open={formOpen}
        onOpenChange={setFormOpen}
        initialData={
          editingApp ||
          (defaultStatusForNew
            ? ({ application_status: defaultStatusForNew } as Application)
            : null)
        }
        onSubmit={handleFormSubmit}
      />

      {/* Detail Dialog */}
      <ApplicationDetail
        application={detailApp}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onEdit={handleOpenEdit}
        onDelete={handlePromptDelete}
        onStatusChange={handleStatusChange}
        onToggleFavorite={async (app) => {
          const updated = await toggleFavorite(app.application_id);
          if (updated) setDetailApp(updated);
        }}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete Application"
        description="Are you sure you want to delete this job application? This action cannot be undone."
        confirmLabel="Delete"
        variant="destructive"
        isLoading={isDeleting}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
};

export default Applications;
