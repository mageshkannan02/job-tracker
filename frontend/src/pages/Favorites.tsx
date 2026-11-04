import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Star,
  Building2,
  Briefcase,
  Search,
  Filter,
  Plus,
  ArrowRight,
  ExternalLink,
  MapPin,
  Calendar,
  Layers,
  Sparkles,
  TrendingUp,
  X,
  Pencil,
  Trash2,
} from 'lucide-react';
import { useApplications } from '@/hooks/useApplications';
import { Application, ApplicationStatus } from '@/types';
import { ApplicationDetail } from '@/components/applications/ApplicationDetail';
import { ApplicationForm } from '@/components/applications/ApplicationForm';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn, formatDate, getInitials, STATUS_COLORS } from '@/lib/utils';

export const Favorites: React.FC = () => {
  const navigate = useNavigate();
  const {
    applications,
    loading,
    fetchApplications,
    createApplication,
    updateApplication,
    deleteApplication,
    updateStatus,
    toggleFavorite,
    toggleCompanyFavorite,
  } = useApplications();

  // Local state for searching & filtering inside favorites
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedCompany, setSelectedCompany] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grouped' | 'list'>('grouped');

  // Dialog states
  const [detailApp, setDetailApp] = useState<Application | null>(null);
  const [detailOpen, setDetailOpen] = useState<boolean>(false);
  const [formOpen, setFormOpen] = useState<boolean>(false);
  const [editingApp, setEditingApp] = useState<Application | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Filter all applications that are marked as favorite
  const favoriteApplications = useMemo(() => {
    return applications.filter((app) => Boolean(app.is_favorite));
  }, [applications]);

  // Unique companies that have favorite applications
  const uniqueCompanies = useMemo(() => {
    const set = new Set<string>();
    favoriteApplications.forEach((app) => {
      if (app.company_name?.trim()) set.add(app.company_name.trim());
    });
    return Array.from(set).sort();
  }, [favoriteApplications]);

  // Filtered favorite applications based on user search and filters
  const filteredFavorites = useMemo(() => {
    let result = [...favoriteApplications];

    if (selectedStatus && selectedStatus !== 'all') {
      result = result.filter((app) => app.application_status === selectedStatus);
    }

    if (selectedCompany && selectedCompany !== 'all') {
      result = result.filter(
        (app) => app.company_name?.toLowerCase() === selectedCompany.toLowerCase()
      );
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (app) =>
          app.company_name?.toLowerCase().includes(q) ||
          app.job_title?.toLowerCase().includes(q) ||
          app.location?.toLowerCase().includes(q) ||
          app.required_skills?.some((s) => s.toLowerCase().includes(q))
      );
    }

    return result;
  }, [favoriteApplications, selectedStatus, selectedCompany, searchQuery]);

  // Grouped by company
  const companyGroups = useMemo(() => {
    const groups: Record<string, Application[]> = {};
    filteredFavorites.forEach((app) => {
      const name = app.company_name?.trim() || 'Unknown Company';
      if (!groups[name]) groups[name] = [];
      groups[name].push(app);
    });
    return groups;
  }, [filteredFavorites]);

  // Key KPI Metrics
  const metrics = useMemo(() => {
    const totalFavorites = favoriteApplications.length;
    const companyCount = uniqueCompanies.length;
    const activeInPipeline = favoriteApplications.filter((app) =>
      ['Applied', 'Assessment', 'Interview', 'Offer'].includes(app.application_status)
    ).length;
    const highMatch = favoriteApplications.filter(
      (app) => app.match_score !== undefined && app.match_score >= 70
    ).length;

    return { totalFavorites, companyCount, activeInPipeline, highMatch };
  }, [favoriteApplications, uniqueCompanies]);

  const handleOpenDetail = (app: Application) => {
    setDetailApp(app);
    setDetailOpen(true);
  };

  const handleOpenEdit = (app: Application) => {
    setEditingApp(app);
    setFormOpen(true);
  };

  const handleFormSubmit = async (data: any) => {
    if (editingApp) {
      await updateApplication(editingApp.application_id, data);
    } else {
      await createApplication({ ...data, is_favorite: true });
    }
    setFormOpen(false);
    setEditingApp(null);
  };

  const handleConfirmDelete = async () => {
    if (!deleteId) return;
    try {
      setIsDeleting(true);
      await deleteApplication(deleteId);
      setDeleteOpen(false);
      setDeleteId(null);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400">
              <Star className="h-5 w-5 fill-amber-400" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Favorites & Priority Targets
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Focus on your top-priority companies, target positions, and dream opportunities.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => {
              setEditingApp(null);
              setFormOpen(true);
            }}
            className="gap-1.5 text-xs font-semibold shadow-xs"
          >
            <Plus className="h-4 w-4" />
            Add Priority Job
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/applications')}
            className="gap-1.5 text-xs"
          >
            <Briefcase className="h-4 w-4" />
            All Applications
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <Card className="border shadow-xs">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500">
              <Star className="h-5 w-5 fill-amber-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Priority Roles</p>
              <h3 className="text-xl font-bold tracking-tight mt-0.5">
                {metrics.totalFavorites}
              </h3>
            </div>
          </CardContent>
        </Card>

        <Card className="border shadow-xs">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Target Companies</p>
              <h3 className="text-xl font-bold tracking-tight mt-0.5">
                {metrics.companyCount}
              </h3>
            </div>
          </CardContent>
        </Card>

        <Card className="border shadow-xs">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Active In Pipeline</p>
              <h3 className="text-xl font-bold tracking-tight mt-0.5">
                {metrics.activeInPipeline}
              </h3>
            </div>
          </CardContent>
        </Card>

        <Card className="border shadow-xs">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-purple-500/10 text-purple-500">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">High Match (≥70%)</p>
              <h3 className="text-xl font-bold tracking-tight mt-0.5">
                {metrics.highMatch}
              </h3>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Control Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-card p-3 rounded-xl border shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 flex-1">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search priority roles or companies..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 text-xs"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Status Filter */}
          <Select value={selectedStatus} onValueChange={setSelectedStatus}>
            <SelectTrigger className="h-9 w-full sm:w-[150px] text-xs">
              <Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="Wishlist">Wishlist</SelectItem>
              <SelectItem value="Applied">Applied</SelectItem>
              <SelectItem value="Assessment">Assessment</SelectItem>
              <SelectItem value="Interview">Interview</SelectItem>
              <SelectItem value="Offer">Offer</SelectItem>
              <SelectItem value="Rejected">Rejected</SelectItem>
              <SelectItem value="NoResponse">No Response</SelectItem>
            </SelectContent>
          </Select>

          {/* Company Filter */}
          {uniqueCompanies.length > 0 && (
            <Select value={selectedCompany} onValueChange={setSelectedCompany}>
              <SelectTrigger className="h-9 w-full sm:w-[170px] text-xs">
                <Building2 className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                <SelectValue placeholder="All Companies" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Companies</SelectItem>
                {uniqueCompanies.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center gap-1.5 self-end lg:self-auto">
          <div className="flex items-center rounded-lg border bg-muted/40 p-1 text-xs">
            <button
              onClick={() => setViewMode('grouped')}
              className={cn(
                'px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer',
                viewMode === 'grouped'
                  ? 'bg-background text-foreground shadow-xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Grouped by Company
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                'px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer',
                viewMode === 'list'
                  ? 'bg-background text-foreground shadow-xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              All Roles ({filteredFavorites.length})
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <LoadingSpinner label="Loading favorite companies..." />
      ) : favoriteApplications.length === 0 ? (
        <Card className="border-dashed p-8 sm:p-12 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/10 text-amber-500 mb-4">
            <Star className="h-7 w-7 fill-amber-400" />
          </div>
          <h3 className="text-lg font-semibold tracking-tight">
            No favorite companies marked yet
          </h3>
          <p className="text-xs sm:text-sm text-muted-foreground max-w-md mx-auto mt-1.5 mb-6">
            Click the star icon <span className="text-amber-500">★</span> on any job application in the Kanban board or Table to highlight top-priority target companies here.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Button
              onClick={() => navigate('/applications')}
              className="gap-2 text-xs font-semibold"
            >
              <Briefcase className="h-4 w-4" />
              Browse Applications
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setEditingApp(null);
                setFormOpen(true);
              }}
              className="gap-2 text-xs"
            >
              <Plus className="h-4 w-4" />
              Add Target Role
            </Button>
          </div>
        </Card>
      ) : filteredFavorites.length === 0 ? (
        <div className="text-center py-12 rounded-xl border border-dashed bg-card/50">
          <p className="text-sm text-muted-foreground">
            No favorite applications match your current filters.
          </p>
          <Button
            variant="link"
            size="sm"
            onClick={() => {
              setSearchQuery('');
              setSelectedStatus('all');
              setSelectedCompany('all');
            }}
            className="mt-2 text-xs text-primary"
          >
            Clear filters
          </Button>
        </div>
      ) : viewMode === 'grouped' ? (
        /* Company Grouped Cards View */
        <div className="space-y-6">
          {Object.entries(companyGroups).map(([companyName, apps]) => {
            const firstApp = apps[0];
            return (
              <Card key={companyName} className="border shadow-xs overflow-hidden">
                <CardHeader className="bg-muted/30 border-b pb-3 pt-3.5 px-4 sm:px-6">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
                    <div className="flex items-center gap-3 min-w-0">
                      {firstApp?.company_logo ? (
                        <img
                          src={firstApp.company_logo}
                          alt={companyName}
                          className="h-9 w-9 rounded-lg object-contain bg-background p-1 border shrink-0"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 font-bold text-sm border">
                          {getInitials(companyName)}
                        </div>
                      )}

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-base font-bold truncate">
                            {companyName}
                          </CardTitle>
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 border border-amber-200/60 dark:border-amber-800/60 px-2 py-0.5 rounded-full shrink-0">
                            <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-500" />
                            High Priority Target
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                          {firstApp?.location && (
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {firstApp.location}
                            </span>
                          )}
                          {firstApp?.company_website && (
                            <a
                              href={firstApp.company_website}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline flex items-center gap-1"
                            >
                              Website
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      <Badge variant="secondary" className="text-xs font-semibold">
                        {apps.length} {apps.length === 1 ? 'Role' : 'Roles'}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleCompanyFavorite(companyName, false)}
                        className="text-xs text-muted-foreground hover:text-destructive h-7 px-2"
                        title="Remove all roles at this company from favorites"
                      >
                        Unmark Company
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="p-0 divide-y">
                  {apps.map((app) => (
                    <div
                      key={app.application_id}
                      className="p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-muted/20 transition-colors cursor-pointer"
                      onClick={() => handleOpenDetail(app)}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-semibold text-sm hover:text-primary transition-colors">
                            {app.job_title}
                          </h4>
                          <span
                            className={cn(
                              'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border',
                              STATUS_COLORS[app.application_status]
                            )}
                          >
                            {app.application_status}
                          </span>
                          {app.match_score !== undefined && app.match_score !== null && (
                            <Badge
                              variant="outline"
                              className={cn(
                                'text-[10px] px-1.5 py-0 font-semibold',
                                app.match_score >= 70
                                  ? 'text-emerald-600 border-emerald-300'
                                  : 'text-amber-600 border-amber-300'
                              )}
                            >
                              {app.match_score}% Match
                            </Badge>
                          )}
                        </div>

                        <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground flex-wrap">
                          {app.work_mode && <span>{app.work_mode}</span>}
                          {app.salary_range && <span>• {app.salary_range}</span>}
                          {app.date_applied && (
                            <span className="flex items-center gap-1">
                              • <Calendar className="h-3 w-3" />
                              Applied: {formatDate(app.date_applied)}
                            </span>
                          )}
                          {app.required_skills && app.required_skills.length > 0 && (
                            <span className="hidden md:inline truncate">
                              • Skills: {app.required_skills.slice(0, 3).join(', ')}
                            </span>
                          )}
                        </div>
                      </div>

                      <div
                        className="flex items-center gap-2 shrink-0 self-end sm:self-auto"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {/* Star Toggle */}
                        <button
                          type="button"
                          onClick={() => toggleFavorite(app.application_id)}
                          className="p-1.5 rounded-lg border hover:bg-muted text-amber-500 cursor-pointer"
                          title="Click to remove from favorites"
                        >
                          <Star className="h-4 w-4 fill-amber-400" />
                        </button>

                        {/* Open Posting */}
                        {app.job_url && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs gap-1"
                            asChild
                          >
                            <a
                              href={app.job_url}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                              <span className="hidden sm:inline">Posting</span>
                            </a>
                          </Button>
                        )}

                        {/* Edit Button */}
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs gap-1"
                          onClick={() => handleOpenEdit(app)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">Edit</span>
                        </Button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        /* Flat List View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredFavorites.map((app) => (
            <Card
              key={app.application_id}
              className="border shadow-xs hover:shadow-md transition-all cursor-pointer flex flex-col justify-between"
              onClick={() => handleOpenDetail(app)}
            >
              <CardHeader className="p-4 pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {app.company_logo ? (
                      <img
                        src={app.company_logo}
                        alt={app.company_name}
                        className="h-8 w-8 rounded-lg object-contain bg-muted p-1 shrink-0"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 font-bold text-xs">
                        {getInitials(app.company_name)}
                      </div>
                    )}
                    <div className="min-w-0">
                      <h4 className="font-semibold text-sm truncate">
                        {app.company_name}
                      </h4>
                      <p className="text-xs text-muted-foreground truncate font-medium">
                        {app.job_title}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFavorite(app.application_id);
                    }}
                    title="Remove from favorites"
                    className="p-1 rounded text-amber-500 hover:opacity-80"
                  >
                    <Star className="h-4 w-4 fill-amber-400" />
                  </button>
                </div>
              </CardHeader>

              <CardContent className="p-4 pt-2">
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  <span
                    className={cn(
                      'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border',
                      STATUS_COLORS[app.application_status]
                    )}
                  >
                    {app.application_status}
                  </span>
                  {app.match_score !== undefined && app.match_score !== null && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                      {app.match_score}% Match
                    </Badge>
                  )}
                </div>

                <div className="space-y-1 text-xs text-muted-foreground">
                  {app.location && (
                    <p className="flex items-center gap-1.5 truncate">
                      <MapPin className="h-3 w-3 shrink-0" />
                      {app.location} {app.work_mode && `(${app.work_mode})`}
                    </p>
                  )}
                  {app.salary_range && (
                    <p className="truncate">Salary: {app.salary_range}</p>
                  )}
                </div>

                <div className="mt-3 pt-2 border-t flex items-center justify-between text-xs">
                  <span className="text-[11px] text-muted-foreground">
                    {formatDate(app.date_applied || app.created_at)}
                  </span>
                  <div
                    className="flex items-center gap-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs px-2"
                      onClick={() => handleOpenEdit(app)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs px-2 text-destructive"
                      onClick={() => {
                        setDeleteId(app.application_id);
                        setDeleteOpen(true);
                      }}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add / Edit Form Modal */}
      <ApplicationForm
        open={formOpen}
        onOpenChange={setFormOpen}
        initialData={editingApp}
        onSubmit={handleFormSubmit}
      />

      {/* Detail Dialog */}
      <ApplicationDetail
        application={detailApp}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onEdit={handleOpenEdit}
        onDelete={(id) => {
          setDeleteId(id);
          setDeleteOpen(true);
        }}
        onStatusChange={async (id, newStatus) => {
          const updated = await updateStatus(id, newStatus);
          if (updated && detailApp?.application_id === id) {
            setDetailApp(updated);
          }
        }}
        onToggleFavorite={async (app) => {
          const updated = await toggleFavorite(app.application_id);
          if (updated && detailApp?.application_id === app.application_id) {
            setDetailApp(updated);
          }
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

export default Favorites;
