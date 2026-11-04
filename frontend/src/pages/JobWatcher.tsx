import React, { useState, useEffect, useMemo } from 'react';
import {
  Radar,
  Play,
  RotateCw,
  Plus,
  Settings,
  Briefcase,
  Building2,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Search,
  Filter,
  Eye,
  Trash2,
  Sparkles,
  Clock,
  Globe,
  SlidersHorizontal,
  Mail,
  FileText,
  BookmarkCheck,
  Calendar,
  Layers,
} from 'lucide-react';
import { toast } from 'sonner';

import {
  DiscoveredJob,
  MonitoredCompany,
  JobWatcherSettings,
  JobWatcherStatus,
  JobWatcherRunSummary,
  Resume,
} from '@/types';
import { watcherApi, resumesApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { LoadingSpinner, LogoLoadingIcon } from '@/components/common/LoadingSpinner';

export default function JobWatcher() {
  // State
  const [status, setStatus] = useState<JobWatcherStatus | null>(null);
  const [jobs, setJobs] = useState<DiscoveredJob[]>([]);
  const [companies, setCompanies] = useState<MonitoredCompany[]>([]);
  const [runs, setRuns] = useState<JobWatcherRunSummary[]>([]);
  const [settings, setSettings] = useState<JobWatcherSettings | null>(null);
  const [resumes, setResumes] = useState<Resume[]>([]);

  const [loading, setLoading] = useState(true);
  const [isRunningDiscovery, setIsRunningDiscovery] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCompanyFilter, setSelectedCompanyFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'new' | 'applied'>('all');
  const [minScoreFilter, setMinScoreFilter] = useState<number>(0);
  const [sourceFilter, setSourceFilter] = useState('all');

  // Modals
  const [isAddCompanyOpen, setIsAddCompanyOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAlertModalOpen, setIsAlertModalOpen] = useState(false);
  const [selectedJobForDetail, setSelectedJobForDetail] = useState<DiscoveredJob | null>(null);
  const [analyzingJobId, setAnalyzingJobId] = useState<string | null>(null);
  const [applyingJobId, setApplyingJobId] = useState<string | null>(null);

  // Forms
  const [newCompany, setNewCompany] = useState({
    company_name: '',
    website: '',
    careers_url: '',
    search_keywords: 'Software Engineer, Full Stack, Backend',
    monitoring_enabled: true,
  });

  const [alertForm, setAlertForm] = useState({
    alert_text: '',
    source: 'LinkedIn Job Alert',
    resume_id: '',
  });

  const [settingsForm, setSettingsForm] = useState<Partial<JobWatcherSettings>>({});

  // Initial load
  const loadData = async () => {
    try {
      setLoading(true);
      const [statusRes, jobsRes, compRes, runsRes, settingsRes, resumesRes] = await Promise.all([
        watcherApi.getStatus(),
        watcherApi.getJobs(),
        watcherApi.getCompanies(),
        watcherApi.getRuns(),
        watcherApi.getSettings(),
        resumesApi.getAll(),
      ]);

      setStatus(statusRes.data);
      setJobs(jobsRes.data);
      setCompanies(compRes.data);
      setRuns(runsRes.data);
      setSettings(settingsRes.data);
      setSettingsForm(settingsRes.data);
      setResumes(resumesRes.data);
    } catch (err: any) {
      toast.error('Failed to load Job Watcher data', {
        description: err.message,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filtered jobs
  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = job.job_title?.toLowerCase().includes(q);
        const matchesComp = job.company_name?.toLowerCase().includes(q);
        const matchesDesc = job.description?.toLowerCase().includes(q);
        const matchesLoc = job.location?.toLowerCase().includes(q);
        if (!matchesTitle && !matchesComp && !matchesDesc && !matchesLoc) return false;
      }

      if (selectedCompanyFilter !== 'all' && job.company_name !== selectedCompanyFilter) {
        return false;
      }

      if (statusFilter === 'new' && !job.is_new) return false;
      if (statusFilter === 'applied' && !job.is_applied) return false;

      if (minScoreFilter > 0 && (job.match_score || 0) < minScoreFilter) {
        return false;
      }

      if (sourceFilter !== 'all' && job.source !== sourceFilter) {
        return false;
      }

      return true;
    });
  }, [jobs, searchQuery, selectedCompanyFilter, statusFilter, minScoreFilter, sourceFilter]);

  // Unique companies list for dropdown filter
  const companyOptions = useMemo(() => {
    const names = new Set<string>();
    jobs.forEach((j) => {
      if (j.company_name) names.add(j.company_name);
    });
    return Array.from(names).sort();
  }, [jobs]);

  // Unique sources
  const sourceOptions = useMemo(() => {
    const s = new Set<string>();
    jobs.forEach((j) => {
      if (j.source) s.add(j.source);
    });
    return Array.from(s).sort();
  }, [jobs]);

  // Actions
  const handleRunDiscoveryNow = async () => {
    try {
      setIsRunningDiscovery(true);
      toast.info('Discovery in progress', {
        description: 'Checking company career endpoints and analyzing opportunities with Groq AI...',
      });
      const res = await watcherApi.runDiscovery(true);
      toast.success('Discovery Completed!', {
        description: (res.data as JobWatcherRunSummary).summary || 'New jobs updated in your database.',
      });
      await loadData();
    } catch (err: any) {
      toast.error('Discovery failed', {
        description: err.message,
      });
    } finally {
      setIsRunningDiscovery(false);
    }
  };

  const handleSyncCompanies = async () => {
    try {
      setIsSyncing(true);
      const res = await watcherApi.syncCompanies();
      toast.success('Companies Synchronized', {
        description: res.data.message,
      });
      await loadData();
    } catch (err: any) {
      toast.error('Sync failed', { description: err.message });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleAddCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompany.company_name.trim()) {
      toast.error('Company name is required');
      return;
    }
    try {
      const keywords = newCompany.search_keywords
        .split(',')
        .map((k) => k.trim())
        .filter(Boolean);

      await watcherApi.addCompany({
        company_name: newCompany.company_name.trim(),
        website: newCompany.website.trim() || undefined,
        careers_url: newCompany.careers_url.trim() || undefined,
        search_keywords: keywords,
        monitoring_enabled: newCompany.monitoring_enabled,
      });
      toast.success(`Added ${newCompany.company_name} to monitoring`);
      setIsAddCompanyOpen(false);
      setNewCompany({
        company_name: '',
        website: '',
        careers_url: '',
        search_keywords: 'Software Engineer, Full Stack, Backend',
        monitoring_enabled: true,
      });
      await loadData();
    } catch (err: any) {
      toast.error('Could not add company', { description: err.message });
    }
  };

  const handleToggleCompany = async (company: MonitoredCompany) => {
    try {
      await watcherApi.updateCompany(company.company_id, {
        monitoring_enabled: !company.monitoring_enabled,
      });
      setCompanies((prev) =>
        prev.map((c) =>
          c.company_id === company.company_id
            ? { ...c, monitoring_enabled: !c.monitoring_enabled }
            : c
        )
      );
      toast.success(
        `${company.company_name} monitoring ${
          !company.monitoring_enabled ? 'enabled' : 'paused'
        }`
      );
    } catch (err: any) {
      toast.error('Failed to update company', { description: err.message });
    }
  };

  const handleDeleteCompany = async (companyId: string, companyName: string) => {
    if (!confirm(`Are you sure you want to stop monitoring ${companyName}?`)) return;
    try {
      await watcherApi.deleteCompany(companyId);
      toast.success(`Removed ${companyName} from monitoring`);
      setCompanies((prev) => prev.filter((c) => c.company_id !== companyId));
    } catch (err: any) {
      toast.error('Failed to delete company', { description: err.message });
    }
  };

  const handleApplyJob = async (job: DiscoveredJob) => {
    try {
      setApplyingJobId(job.discovered_job_id);
      const res = await watcherApi.applyJob(job.discovered_job_id, {
        status_val: 'Wishlist',
      });
      toast.success('Added to Applications Tracker!', {
        description: `${job.job_title} at ${job.company_name} has been added to your applications pipeline.`,
      });
      setJobs((prev) =>
        prev.map((j) =>
          j.discovered_job_id === job.discovered_job_id
            ? { ...j, is_applied: true, is_new: false }
            : j
        )
      );
      if (selectedJobForDetail?.discovered_job_id === job.discovered_job_id) {
        setSelectedJobForDetail((prev) =>
          prev ? { ...prev, is_applied: true, is_new: false } : null
        );
      }
    } catch (err: any) {
      toast.error('Failed to add application', { description: err.message });
    } finally {
      setApplyingJobId(null);
    }
  };

  const handleAnalyzeJob = async (job: DiscoveredJob) => {
    try {
      setAnalyzingJobId(job.discovered_job_id);
      const res = await watcherApi.analyzeJob(job.discovered_job_id, settings?.selected_resume_id);
      toast.success('Job Analysis Updated!', {
        description: `Overall compatibility score: ${res.data.job.match_score}%`,
      });
      setJobs((prev) =>
        prev.map((j) =>
          j.discovered_job_id === job.discovered_job_id ? res.data.job : j
        )
      );
      if (selectedJobForDetail?.discovered_job_id === job.discovered_job_id) {
        setSelectedJobForDetail(res.data.job);
      }
    } catch (err: any) {
      toast.error('Analysis failed', { description: err.message });
    } finally {
      setAnalyzingJobId(null);
    }
  };

  const handleDeleteJob = async (jobId: string) => {
    try {
      await watcherApi.deleteJob(jobId);
      toast.success('Job dismissed');
      setJobs((prev) => prev.filter((j) => j.discovered_job_id !== jobId));
      if (selectedJobForDetail?.discovered_job_id === jobId) {
        setSelectedJobForDetail(null);
      }
    } catch (err: any) {
      toast.error('Failed to dismiss job', { description: err.message });
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await watcherApi.updateSettings(settingsForm);
      setSettings(res.data);
      setIsSettingsOpen(false);
      toast.success('Job Watcher settings saved and scheduled successfully!');
      await loadData();
    } catch (err: any) {
      toast.error('Failed to save settings', { description: err.message });
    }
  };

  const handleIngestAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!alertForm.alert_text.trim()) {
      toast.error('Please paste alert content');
      return;
    }
    try {
      const res = await watcherApi.ingestAlert({
        alert_text: alertForm.alert_text,
        source: alertForm.source,
        resume_id: alertForm.resume_id || undefined,
      });
      toast.success('Alert parsed successfully!', {
        description: res.data.message,
      });
      setIsAlertModalOpen(false);
      setAlertForm({ alert_text: '', source: 'LinkedIn Job Alert', resume_id: '' });
      await loadData();
    } catch (err: any) {
      toast.error('Could not parse alert', { description: err.message });
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <LoadingSpinner label="AI Job Watcher is connecting to feeds and syncing opportunities..." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
              <Radar className="h-7 w-7 text-primary animate-pulse" />
              AI Job Watcher
            </h1>
            <Badge
              variant={status?.scheduler_running ? 'default' : 'secondary'}
              className="text-xs px-2.5 py-0.5"
            >
              {status?.scheduler_running ? 'Scheduler Running' : 'Scheduler Paused'}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Automated daily discovery of newly published roles matching your profile.
            {status?.next_run_time && (
              <span className="ml-2 inline-flex items-center text-primary font-medium">
                <Clock className="h-3.5 w-3.5 mr-1" />
                Next run: {new Date(status.next_run_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ({settings?.timezone || 'Local'})
              </span>
            )}
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSyncCompanies}
            disabled={isSyncing}
            className="text-xs"
          >
            <RotateCw className={`h-3.5 w-3.5 mr-1.5 ${isSyncing ? 'animate-spin' : ''}`} />
            Sync from Tracker
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsAlertModalOpen(true)}
            className="text-xs"
          >
            <Mail className="h-3.5 w-3.5 mr-1.5 text-blue-500" />
            Ingest Job Alert
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsSettingsOpen(true)}
            className="text-xs"
          >
            <Settings className="h-3.5 w-3.5 mr-1.5" />
            Settings
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsAddCompanyOpen(true)}
            className="text-xs"
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Add Company
          </Button>

          <Button
            size="sm"
            onClick={handleRunDiscoveryNow}
            disabled={isRunningDiscovery}
            className="text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
          >
            {isRunningDiscovery ? (
              <LogoLoadingIcon size="xs" className="mr-1.5" />
            ) : (
              <Play className="h-3.5 w-3.5 mr-1.5" />
            )}
            {isRunningDiscovery ? 'Discovering Roles...' : 'Run Discovery Now'}
          </Button>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="shadow-xs border-muted/80">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Monitored Companies
            </CardTitle>
            <Building2 className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {status?.monitored_companies_count ?? companies.length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Active endpoints checked daily
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-xs border-muted/80">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              New Discovered Jobs
            </CardTitle>
            <Sparkles className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              {status?.new_jobs_count ?? jobs.filter((j) => j.is_new).length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Unreviewed new listings
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-xs border-muted/80">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Resume Matches (≥ {settings?.min_match_score || 60}%)
            </CardTitle>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {status?.matched_jobs_count ?? jobs.filter((j) => (j.match_score || 0) >= (settings?.min_match_score || 60)).length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Strong ATS skill alignment
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-xs border-muted/80">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Last Execution
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-sm font-semibold truncate text-foreground">
              {status?.last_run?.timestamp
                ? new Date(status.last_run.timestamp).toLocaleDateString([], {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : 'No runs recorded'}
            </div>
            <p className="text-xs text-muted-foreground mt-1 truncate">
              {status?.last_run ? `Found +${status.last_run.new_jobs_found} jobs (${status.last_run.duration_seconds}s)` : 'Awaiting first run'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="jobs" className="space-y-4">
        <TabsList className="bg-muted/60 p-1">
          <TabsTrigger value="jobs" className="flex items-center gap-2 text-xs font-medium">
            <Briefcase className="h-3.5 w-3.5" />
            Discovered Jobs ({jobs.length})
          </TabsTrigger>
          <TabsTrigger value="companies" className="flex items-center gap-2 text-xs font-medium">
            <Building2 className="h-3.5 w-3.5" />
            Monitored Companies ({companies.length})
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2 text-xs font-medium">
            <Layers className="h-3.5 w-3.5" />
            Execution Runs ({runs.length})
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Discovered Jobs */}
        <TabsContent value="jobs" className="space-y-4">
          {/* Filters Bar */}
          <div className="flex flex-col gap-3 rounded-lg border bg-card p-3 shadow-xs md:flex-row md:items-center md:justify-between">
            <div className="flex flex-1 flex-wrap items-center gap-2.5">
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search role, company, skills..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 text-xs h-9"
                />
              </div>

              <Select value={selectedCompanyFilter} onValueChange={setSelectedCompanyFilter}>
                <SelectTrigger className="w-[160px] text-xs h-9">
                  <SelectValue placeholder="All Companies" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Companies</SelectItem>
                  {companyOptions.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={(val: any) => setStatusFilter(val)}>
                <SelectTrigger className="w-[130px] text-xs h-9">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="new">🆕 New Only</SelectItem>
                  <SelectItem value="applied">✅ Applied</SelectItem>
                </SelectContent>
              </Select>

              <Select value={sourceFilter} onValueChange={setSourceFilter}>
                <SelectTrigger className="w-[140px] text-xs h-9">
                  <SelectValue placeholder="All Sources" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sources</SelectItem>
                  {sourceOptions.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={String(minScoreFilter)}
                onValueChange={(val) => setMinScoreFilter(Number(val))}
              >
                <SelectTrigger className="w-[140px] text-xs h-9">
                  <SelectValue placeholder="Min Score" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Any Match Score</SelectItem>
                  <SelectItem value="50">Match ≥ 50%</SelectItem>
                  <SelectItem value="70">Match ≥ 70%</SelectItem>
                  <SelectItem value="85">Match ≥ 85%</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="text-xs text-muted-foreground shrink-0 font-medium">
              Showing {filteredJobs.length} of {jobs.length} roles
            </div>
          </div>

          {/* Job Cards Grid */}
          {filteredJobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
              <Radar className="h-12 w-12 text-muted-foreground/60 mb-3" />
              <h3 className="text-base font-semibold text-foreground">No Discovered Jobs Found</h3>
              <p className="text-xs text-muted-foreground max-w-sm mt-1">
                {jobs.length === 0
                  ? "Click 'Run Discovery Now' or 'Sync from Tracker' to discover opportunities from your target companies."
                  : 'Try adjusting your search criteria or score filters.'}
              </p>
              {jobs.length === 0 && (
                <Button size="sm" onClick={handleRunDiscoveryNow} className="mt-4 text-xs">
                  <Play className="h-3.5 w-3.5 mr-1.5" />
                  Run Discovery Now
                </Button>
              )}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
              {filteredJobs.map((job) => {
                const score = job.match_score || 0;
                const scoreColor =
                  score >= 75
                    ? 'text-emerald-600 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800'
                    : score >= 50
                    ? 'text-amber-600 bg-amber-50 border-amber-200 dark:bg-amber-950/40 dark:border-amber-800'
                    : 'text-slate-600 bg-slate-50 border-slate-200 dark:bg-slate-900 dark:border-slate-800';

                return (
                  <Card
                    key={job.discovered_job_id}
                    className="flex flex-col justify-between overflow-hidden shadow-2xs hover:shadow-sm transition-all border-muted/80 hover:border-primary/40"
                  >
                    <CardHeader className="p-4 pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-sm text-foreground">
                              {job.company_name}
                            </span>
                            {job.is_new && (
                              <Badge className="bg-amber-500/15 text-amber-600 border-amber-300 dark:border-amber-800 text-[10px] px-1.5 py-0">
                                NEW
                              </Badge>
                            )}
                            {job.is_applied && (
                              <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-300 dark:border-emerald-800 text-[10px] px-1.5 py-0 flex items-center gap-1">
                                <BookmarkCheck className="h-3 w-3" />
                                TRACKED
                              </Badge>
                            )}
                          </div>
                          <h4 className="font-semibold text-sm line-clamp-1 text-foreground/90">
                            {job.job_title}
                          </h4>
                        </div>

                        {/* Match Score Badge */}
                        <div
                          className={`flex flex-col items-center justify-center rounded-lg border px-2 py-1 shrink-0 ${scoreColor}`}
                        >
                          <span className="text-xs font-bold leading-none">{score.toFixed(0)}%</span>
                          <span className="text-[9px] font-medium uppercase mt-0.5 opacity-80">Match</span>
                        </div>
                      </div>

                      {/* Location & Tags */}
                      <div className="flex flex-wrap items-center gap-1.5 mt-2 text-[11px] text-muted-foreground">
                        {job.location && (
                          <span className="inline-flex items-center">
                            📍 {job.location}
                          </span>
                        )}
                        {job.work_mode && (
                          <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
                            {job.work_mode}
                          </Badge>
                        )}
                        <span className="opacity-60">&bull;</span>
                        <span className="text-[10px] opacity-75">{job.source}</span>
                      </div>
                    </CardHeader>

                    <CardContent className="p-4 pt-1 pb-3 flex-1">
                      {/* Description preview */}
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                        {job.description}
                      </p>

                      {/* Matched & Missing Skills tags */}
                      <div className="mt-3 flex flex-wrap gap-1">
                        {job.matched_skills?.slice(0, 3).map((skill) => (
                          <span
                            key={skill}
                            className="rounded-sm bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-[10px] px-1.5 py-0.5 font-medium"
                          >
                            ✓ {skill}
                          </span>
                        ))}
                        {job.missing_skills?.slice(0, 2).map((skill) => (
                          <span
                            key={skill}
                            className="rounded-sm bg-rose-500/10 text-rose-700 dark:text-rose-400 text-[10px] px-1.5 py-0.5 font-medium"
                          >
                            + {skill}
                          </span>
                        ))}
                        {(job.matched_skills?.length || 0) + (job.missing_skills?.length || 0) > 5 && (
                          <span className="text-[10px] text-muted-foreground self-center">
                            +{((job.matched_skills?.length || 0) + (job.missing_skills?.length || 0)) - 5} more
                          </span>
                        )}
                      </div>
                    </CardContent>

                    {/* Footer Actions */}
                    <div className="flex items-center justify-between border-t bg-muted/20 px-3 py-2 text-xs">
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs px-2"
                          onClick={() => setSelectedJobForDetail(job)}
                        >
                          <Eye className="h-3.5 w-3.5 mr-1" />
                          Details
                        </Button>

                        {job.job_url && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs px-2"
                            asChild
                          >
                            <a href={job.job_url} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-3.5 w-3.5 mr-1" />
                              Link
                            </a>
                          </Button>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        {!job.is_applied ? (
                          <Button
                            size="sm"
                            className="h-7 text-xs px-2.5 bg-primary/90 hover:bg-primary"
                            onClick={() => handleApplyJob(job)}
                            disabled={applyingJobId === job.discovered_job_id}
                          >
                            <Plus className="h-3.5 w-3.5 mr-1" />
                            {applyingJobId === job.discovered_job_id ? 'Adding...' : 'Track Application'}
                          </Button>
                        ) : (
                          <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-300">
                            Tracked
                          </Badge>
                        )}

                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-rose-500"
                          onClick={() => handleDeleteJob(job.discovered_job_id)}
                          title="Dismiss"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Tab 2: Monitored Companies */}
        <TabsContent value="companies" className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              These companies are monitored daily for new job openings via public endpoints and career boards.
            </p>
            <Button size="sm" onClick={() => setIsAddCompanyOpen(true)} className="text-xs">
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Add Company
            </Button>
          </div>

          <div className="rounded-lg border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/50 border-b text-muted-foreground font-semibold">
                  <tr>
                    <th className="p-3">Company</th>
                    <th className="p-3">Career / Public Board URL</th>
                    <th className="p-3">Search Keywords</th>
                    <th className="p-3">Last Checked</th>
                    <th className="p-3 text-center">Status</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {companies.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-muted-foreground">
                        No companies monitored yet. Click "Sync from Tracker" or "Add Company".
                      </td>
                    </tr>
                  ) : (
                    companies.map((c) => (
                      <tr key={c.company_id} className="hover:bg-muted/20 transition-colors">
                        <td className="p-3 font-semibold text-foreground">
                          {c.company_name}
                        </td>
                        <td className="p-3 font-mono text-[11px] text-muted-foreground max-w-[240px] truncate">
                          {c.careers_url ? (
                            <a
                              href={c.careers_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline flex items-center gap-1"
                            >
                              <span className="truncate">{c.careers_url}</span>
                              <ExternalLink className="h-3 w-3 shrink-0" />
                            </a>
                          ) : (
                            c.website || '—'
                          )}
                        </td>
                        <td className="p-3 max-w-[260px]">
                          <div className="flex flex-wrap gap-1">
                            {c.search_keywords?.map((kw) => (
                              <Badge key={kw} variant="secondary" className="text-[10px] px-1.5 py-0 font-normal">
                                {kw}
                              </Badge>
                            ))}
                          </div>
                        </td>
                        <td className="p-3 text-muted-foreground whitespace-nowrap">
                          {c.last_checked
                            ? new Date(c.last_checked).toLocaleDateString([], {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : 'Pending'}
                        </td>
                        <td className="p-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleToggleCompany(c)}
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold transition-colors ${
                              c.monitoring_enabled
                                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                            }`}
                          >
                            {c.monitoring_enabled ? 'Active' : 'Paused'}
                          </button>
                        </td>
                        <td className="p-3 text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-rose-500 hover:text-rose-700"
                            onClick={() => handleDeleteCompany(c.company_id, c.company_name)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* Tab 3: Execution Runs */}
        <TabsContent value="history" className="space-y-4">
          <div className="rounded-lg border bg-card p-4">
            <h3 className="font-semibold text-sm mb-3">Recent Discovery Cycles</h3>
            {runs.length === 0 ? (
              <p className="text-xs text-muted-foreground py-6 text-center">
                No past runs recorded yet. Click "Run Discovery Now" to launch the first cycle.
              </p>
            ) : (
              <div className="space-y-3">
                {runs.map((run) => (
                  <div
                    key={run.run_id}
                    className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 rounded-md border bg-muted/20 text-xs gap-2"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={run.status === 'completed' ? 'default' : 'secondary'}
                          className="text-[10px]"
                        >
                          {run.status}
                        </Badge>
                        <span className="font-medium text-foreground">
                          {new Date(run.timestamp).toLocaleString()}
                        </span>
                        <span className="text-muted-foreground">({run.duration_seconds}s)</span>
                      </div>
                      <p className="text-muted-foreground">{run.summary}</p>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <span className="block font-bold text-primary">
                          +{run.new_jobs_found} New Roles
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          {run.jobs_matching_resume} Profile Matches
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Modal: Job Details & Groq AI Analysis */}
      {selectedJobForDetail && (
        <Dialog
          open={!!selectedJobForDetail}
          onOpenChange={(open) => !open && setSelectedJobForDetail(null)}
        >
          <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-6 overflow-hidden">
            <DialogHeader>
              <div className="flex items-start justify-between pr-6">
                <div>
                  <DialogTitle className="text-lg font-bold">
                    {selectedJobForDetail.job_title}
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                    {selectedJobForDetail.company_name} &bull;{' '}
                    {selectedJobForDetail.location || 'Remote / Hybrid'} &bull;{' '}
                    {selectedJobForDetail.source}
                  </DialogDescription>
                </div>

                <div className="flex flex-col items-end">
                  <Badge className="bg-primary/10 text-primary text-xs font-bold px-2.5 py-1">
                    {selectedJobForDetail.match_score?.toFixed(0) || 0}% ATS Match
                  </Badge>
                </div>
              </div>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1 text-xs">
              {/* Score Breakdown Cards */}
              <div className="grid grid-cols-2 gap-2.5 rounded-lg border bg-muted/20 p-3">
                <div>
                  <span className="text-muted-foreground block text-[11px]">Matched Skills:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {selectedJobForDetail.matched_skills?.length ? (
                      selectedJobForDetail.matched_skills.map((s) => (
                        <span
                          key={s}
                          className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 px-1.5 py-0.5 rounded text-[10px] font-medium"
                        >
                          ✓ {s}
                        </span>
                      ))
                    ) : (
                      <span className="text-muted-foreground italic">None identified</span>
                    )}
                  </div>
                </div>

                <div>
                  <span className="text-muted-foreground block text-[11px]">Missing / Skill Gaps:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {selectedJobForDetail.missing_skills?.length ? (
                      selectedJobForDetail.missing_skills.map((s) => (
                        <span
                          key={s}
                          className="bg-rose-500/15 text-rose-700 dark:text-rose-400 px-1.5 py-0.5 rounded text-[10px] font-medium"
                        >
                          + {s}
                        </span>
                      ))
                    ) : (
                      <span className="text-emerald-600 font-medium">No major gaps identified</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Job Metadata row */}
              <div className="grid grid-cols-3 gap-2 py-1 text-muted-foreground border-y">
                <div>
                  <span className="font-semibold text-foreground">Work Mode: </span>
                  {selectedJobForDetail.work_mode || 'Hybrid'}
                </div>
                <div>
                  <span className="font-semibold text-foreground">Type: </span>
                  {selectedJobForDetail.employment_type || 'Full Time'}
                </div>
                <div>
                  <span className="font-semibold text-foreground">Discovered: </span>
                  {selectedJobForDetail.discovered_date || 'Recently'}
                </div>
              </div>

              {/* Job Description */}
              <div>
                <h4 className="font-bold text-xs uppercase tracking-wider text-foreground mb-1.5">
                  Job Description & Scope
                </h4>
                <div className="rounded-md border p-3 bg-card font-mono text-[11px] leading-relaxed whitespace-pre-wrap max-h-56 overflow-y-auto">
                  {selectedJobForDetail.description || 'No detailed description available.'}
                </div>
              </div>
            </div>

            <DialogFooter className="mt-4 flex items-center justify-between border-t pt-3">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => handleAnalyzeJob(selectedJobForDetail)}
                  disabled={analyzingJobId === selectedJobForDetail.discovered_job_id}
                >
                  <Sparkles className="h-3.5 w-3.5 mr-1 text-primary" />
                  {analyzingJobId === selectedJobForDetail.discovered_job_id ? 'Analyzing...' : 'Re-Analyze with Groq'}
                </Button>

                {selectedJobForDetail.job_url && (
                  <Button variant="outline" size="sm" className="text-xs" asChild>
                    <a
                      href={selectedJobForDetail.job_url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="h-3.5 w-3.5 mr-1" />
                      View External Posting
                    </a>
                  </Button>
                )}
              </div>

              <div className="flex items-center gap-2">
                {!selectedJobForDetail.is_applied ? (
                  <Button
                    size="sm"
                    className="text-xs"
                    onClick={() => handleApplyJob(selectedJobForDetail)}
                    disabled={applyingJobId === selectedJobForDetail.discovered_job_id}
                  >
                    <BookmarkCheck className="h-3.5 w-3.5 mr-1" />
                    {applyingJobId === selectedJobForDetail.discovered_job_id ? 'Adding...' : 'Add to Pipeline'}
                  </Button>
                ) : (
                  <Badge variant="outline" className="text-emerald-600 border-emerald-300">
                    Already Added to Tracker
                  </Badge>
                )}
                <Button
                  variant="secondary"
                  size="sm"
                  className="text-xs"
                  onClick={() => setSelectedJobForDetail(null)}
                >
                  Close
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Modal: Add Monitored Company */}
      <Dialog open={isAddCompanyOpen} onOpenChange={setIsAddCompanyOpen}>
        <DialogContent className="max-w-md">
          <form onSubmit={handleAddCompany}>
            <DialogHeader>
              <DialogTitle className="text-base font-bold">Add Company to Monitor</DialogTitle>
              <DialogDescription className="text-xs">
                AI Job Watcher will automatically monitor this company's career endpoints for newly published positions.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-4 text-xs">
              <div className="space-y-1">
                <Label htmlFor="c_name">Company Name *</Label>
                <Input
                  id="c_name"
                  placeholder="e.g. Stripe, Figma, Atlassian"
                  value={newCompany.company_name}
                  onChange={(e) =>
                    setNewCompany({ ...newCompany, company_name: e.target.value })
                  }
                  required
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="c_careers">Careers Page or Board URL</Label>
                <Input
                  id="c_careers"
                  placeholder="https://boards.greenhouse.io/stripe or careers URL"
                  value={newCompany.careers_url}
                  onChange={(e) =>
                    setNewCompany({ ...newCompany, careers_url: e.target.value })
                  }
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="c_website">Website</Label>
                <Input
                  id="c_website"
                  placeholder="https://company.com"
                  value={newCompany.website}
                  onChange={(e) =>
                    setNewCompany({ ...newCompany, website: e.target.value })
                  }
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="c_keywords">Target Search Keywords (comma-separated)</Label>
                <Input
                  id="c_keywords"
                  placeholder="Software Engineer, Backend, Cloud, SRE"
                  value={newCompany.search_keywords}
                  onChange={(e) =>
                    setNewCompany({ ...newCompany, search_keywords: e.target.value })
                  }
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                type="button"
                size="sm"
                className="text-xs"
                onClick={() => setIsAddCompanyOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" className="text-xs">
                Save & Monitor
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal: Job Watcher Settings */}
      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent className="max-w-lg">
          <form onSubmit={handleSaveSettings}>
            <DialogHeader>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <Settings className="h-4 w-4 text-primary" />
                Job Watcher Monitoring Settings
              </DialogTitle>
              <DialogDescription className="text-xs">
                Configure automated scheduling, target titles, match thresholds, and notifications.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3.5 py-3 text-xs max-h-[60vh] overflow-y-auto pr-1">
              {/* Enable Switch */}
              <div className="flex items-center justify-between p-2.5 rounded-lg border bg-muted/20">
                <div>
                  <span className="font-semibold text-foreground">Automatic Daily Monitoring</span>
                  <p className="text-[11px] text-muted-foreground">
                    Execute discovery on scheduled time every day
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={settingsForm.enabled ?? true}
                  onChange={(e) =>
                    setSettingsForm({ ...settingsForm, enabled: e.target.checked })
                  }
                  className="h-4 w-4 rounded text-primary focus:ring-primary"
                />
              </div>

              {/* Schedule time & timezone */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Daily Execution Time</Label>
                  <Input
                    type="time"
                    value={settingsForm.daily_time || '09:00'}
                    onChange={(e) =>
                      setSettingsForm({ ...settingsForm, daily_time: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label>Scheduler Timezone</Label>
                  <Input
                    value={settingsForm.timezone || 'Asia/Kolkata'}
                    onChange={(e) =>
                      setSettingsForm({ ...settingsForm, timezone: e.target.value })
                    }
                  />
                </div>
              </div>

              {/* Min Match Score */}
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <Label>Minimum Match Score for Alerts</Label>
                  <span className="font-bold text-primary">{settingsForm.min_match_score || 60}%</span>
                </div>
                <input
                  type="range"
                  min="30"
                  max="95"
                  step="5"
                  value={settingsForm.min_match_score || 60}
                  onChange={(e) =>
                    setSettingsForm({ ...settingsForm, min_match_score: Number(e.target.value) })
                  }
                  className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer"
                />
              </div>

              {/* Target Job Titles */}
              <div className="space-y-1">
                <Label>Target Job Titles (comma-separated)</Label>
                <Input
                  value={
                    Array.isArray(settingsForm.target_titles)
                      ? settingsForm.target_titles.join(', ')
                      : settingsForm.target_titles || ''
                  }
                  onChange={(e) =>
                    setSettingsForm({
                      ...settingsForm,
                      target_titles: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                    })
                  }
                />
              </div>

              {/* Preferred Locations */}
              <div className="space-y-1">
                <Label>Preferred Locations (comma-separated)</Label>
                <Input
                  value={
                    Array.isArray(settingsForm.preferred_locations)
                      ? settingsForm.preferred_locations.join(', ')
                      : settingsForm.preferred_locations || ''
                  }
                  onChange={(e) =>
                    setSettingsForm({
                      ...settingsForm,
                      preferred_locations: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                    })
                  }
                />
              </div>

              {/* Active Resume Selector */}
              <div className="space-y-1">
                <Label>Evaluation Resume</Label>
                <Select
                  value={settingsForm.selected_resume_id || 'default'}
                  onValueChange={(val) =>
                    setSettingsForm({
                      ...settingsForm,
                      selected_resume_id: val === 'default' ? undefined : val,
                    })
                  }
                >
                  <SelectTrigger className="text-xs h-9">
                    <SelectValue placeholder="Use Default Uploaded Resume" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">Use Primary / Latest Resume</SelectItem>
                    {resumes.map((r) => (
                      <SelectItem key={r.resume_id} value={r.resume_id}>
                        {r.filename}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Email Notifications */}
              <div className="flex items-center justify-between p-2.5 rounded-lg border bg-muted/20">
                <div>
                  <span className="font-semibold text-foreground">Email Daily Digest</span>
                  <p className="text-[11px] text-muted-foreground">
                    Send email summary when newly discovered roles match criteria
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={settingsForm.email_digest_enabled ?? true}
                  onChange={(e) =>
                    setSettingsForm({
                      ...settingsForm,
                      email_digest_enabled: e.target.checked,
                    })
                  }
                  className="h-4 w-4 rounded text-primary focus:ring-primary"
                />
              </div>

              <div className="p-2.5 rounded-md bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 text-blue-900 dark:text-blue-300 text-[11px] leading-relaxed">
                ℹ️ <strong>System Note:</strong> Scheduled discovery runs while the application is active in the background. You can also run discovery on demand at any time via the "Run Discovery Now" button.
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                type="button"
                size="sm"
                className="text-xs"
                onClick={() => setIsSettingsOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" className="text-xs">
                Save & Apply Settings
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal: Ingest LinkedIn / Email Job Alert */}
      <Dialog open={isAlertModalOpen} onOpenChange={setIsAlertModalOpen}>
        <DialogContent className="max-w-md">
          <form onSubmit={handleIngestAlert}>
            <DialogHeader>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <Mail className="h-4 w-4 text-blue-500" />
                Ingest LinkedIn or Email Job Alert
              </DialogTitle>
              <DialogDescription className="text-xs">
                Paste the text from your LinkedIn job alert email or web alert notification.
                No passwords, session cookies, or scraping required.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-3 text-xs">
              <div className="space-y-1">
                <Label htmlFor="alert_source">Source</Label>
                <Select
                  value={alertForm.source}
                  onValueChange={(val) => setAlertForm({ ...alertForm, source: val })}
                >
                  <SelectTrigger className="text-xs h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LinkedIn Job Alert">LinkedIn Job Alert</SelectItem>
                    <SelectItem value="Email Alert Digest">Email Alert Digest</SelectItem>
                    <SelectItem value="Company Newsletter">Company Newsletter</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="alert_text">Alert Content / Email Text *</Label>
                <Textarea
                  id="alert_text"
                  placeholder="Paste alert text containing job titles, companies, and LinkedIn job URLs..."
                  value={alertForm.alert_text}
                  onChange={(e) =>
                    setAlertForm({ ...alertForm, alert_text: e.target.value })
                  }
                  rows={7}
                  className="text-xs font-mono"
                  required
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                type="button"
                size="sm"
                className="text-xs"
                onClick={() => setIsAlertModalOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" className="text-xs">
                Parse & Save Jobs
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
