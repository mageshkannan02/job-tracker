import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Application,
  ApplicationCreateInput,
  ApplicationStatus,
  ApplicationUpdateInput,
} from '@/types';
import { applicationsApi } from '@/lib/api';
import { toast } from 'sonner';

export function useApplications() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<keyof Application>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const fetchApplications = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await applicationsApi.getAll();
      setApplications(res.data || []);
    } catch (err: any) {
      const msg = err.message || 'Failed to load applications';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchApplications();
  }, [fetchApplications]);

  const createApplication = async (data: ApplicationCreateInput): Promise<Application | null> => {
    try {
      const res = await applicationsApi.create(data);
      const created = res.data;
      setApplications((prev) => [created, ...prev]);
      toast.success('Application added successfully');
      return created;
    } catch (err: any) {
      toast.error(err.message || 'Failed to create application');
      throw err;
    }
  };

  const updateApplication = async (
    id: string,
    data: ApplicationUpdateInput
  ): Promise<Application | null> => {
    try {
      const res = await applicationsApi.update(id, data);
      const updated = res.data;
      setApplications((prev) =>
        prev.map((app) => (app.application_id === id ? updated : app))
      );
      toast.success('Application updated successfully');
      return updated;
    } catch (err: any) {
      toast.error(err.message || 'Failed to update application');
      throw err;
    }
  };

  const deleteApplication = async (id: string): Promise<boolean> => {
    try {
      await applicationsApi.delete(id);
      setApplications((prev) => prev.filter((app) => app.application_id !== id));
      toast.success('Application deleted');
      return true;
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete application');
      return false;
    }
  };

  const updateStatus = async (
    id: string,
    status: ApplicationStatus,
    notes?: string
  ): Promise<Application | undefined> => {
    const previous = applications;
    // Optimistic UI update
    setApplications((prev) =>
      prev.map((app) =>
        app.application_id === id
          ? {
              ...app,
              application_status: status,
              updated_at: new Date().toISOString(),
              notes: notes !== undefined ? notes : app.notes,
            }
          : app
      )
    );

    try {
      const res = await applicationsApi.updateStatus(id, status, notes);
      const updated = res.data;
      setApplications((prev) =>
        prev.map((app) => (app.application_id === id ? updated : app))
      );
      toast.success(`Moved to ${status}`);
      return updated;
    } catch (err: any) {
      // Revert optimistic update
      setApplications(previous);
      toast.error(err.message || 'Failed to update application status');
      throw err;
    }
  };

  const toggleFavorite = async (
    id: string,
    is_favorite?: boolean
  ): Promise<Application | undefined> => {
    const target = applications.find((a) => a.application_id === id);
    const newFav = is_favorite !== undefined ? is_favorite : !target?.is_favorite;

    // Optimistic update
    setApplications((prev) =>
      prev.map((app) =>
        app.application_id === id
          ? { ...app, is_favorite: newFav, updated_at: new Date().toISOString() }
          : app
      )
    );

    try {
      const res = await applicationsApi.toggleFavorite(id, newFav);
      const updated = res.data;
      setApplications((prev) =>
        prev.map((app) => (app.application_id === id ? updated : app))
      );
      toast.success(newFav ? 'Marked as Favorite (High Priority)' : 'Removed from Favorites');
      return updated;
    } catch (err: any) {
      fetchApplications();
      toast.error(err.message || 'Failed to update favorite status');
      throw err;
    }
  };

  const toggleCompanyFavorite = async (companyName: string, is_favorite: boolean) => {
    setApplications((prev) =>
      prev.map((app) =>
        app.company_name?.toLowerCase() === companyName.toLowerCase()
          ? { ...app, is_favorite, updated_at: new Date().toISOString() }
          : app
      )
    );

    try {
      const res = await applicationsApi.toggleCompanyFavorite(companyName, is_favorite);
      toast.success(
        is_favorite
          ? `Marked ${companyName} as High Priority`
          : `Removed ${companyName} from High Priority`
      );
      fetchApplications();
    } catch (err: any) {
      fetchApplications();
      toast.error(err.message || 'Failed to update company favorite');
    }
  };

  const filteredApplications = useMemo(() => {
    let result = [...applications];

    if (statusFilter && statusFilter !== 'all') {
      result = result.filter((app) => app.application_status === statusFilter);
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

    result.sort((a, b) => {
      const aVal = a[sortBy] ?? '';
      const bVal = b[sortBy] ?? '';
      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [applications, statusFilter, searchQuery, sortBy, sortOrder]);

  return {
    applications,
    filteredApplications,
    loading,
    error,
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    sortBy,
    setSortBy,
    sortOrder,
    setSortOrder,
    fetchApplications,
    createApplication,
    updateApplication,
    deleteApplication,
    updateStatus,
    toggleFavorite,
    toggleCompanyFavorite,
  };
}
