import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowUpDown,
  Building2,
  Calendar,
  ExternalLink,
  Eye,
  MapPin,
  MoreHorizontal,
  Pencil,
  Trash2,
  Star,
} from 'lucide-react';
import { Application, ApplicationStatus } from '@/types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn, formatDate, getInitials, STATUS_COLORS } from '@/lib/utils';
import { Pagination } from '@/components/ui/pagination';

interface ApplicationTableProps {
  applications: Application[];
  onView: (app: Application) => void;
  onEdit: (app: Application) => void;
  onDelete: (id: string) => void;
  onToggleFavorite?: (app: Application) => void;
  onStatusChange?: (id: string, newStatus: ApplicationStatus) => void;
}

type SortField = 'company_name' | 'job_title' | 'location' | 'date_applied' | 'match_score' | 'application_status';

export const ApplicationTable: React.FC<ApplicationTableProps> = ({
  applications,
  onView,
  onEdit,
  onDelete,
  onToggleFavorite,
}) => {
  const [sortField, setSortField] = useState<SortField>('date_applied');
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const sortedApplications = useMemo(() => {
    return [...applications].sort((a, b) => {
      let aVal: any = a[sortField] ?? '';
      let bVal: any = b[sortField] ?? '';

      if (sortField === 'match_score') {
        aVal = a.match_score ?? -1;
        bVal = b.match_score ?? -1;
      }

      if (aVal < bVal) return sortAsc ? -1 : 1;
      if (aVal > bVal) return sortAsc ? 1 : -1;
      return 0;
    });
  }, [applications, sortField, sortAsc]);

  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  const totalPages = Math.max(1, Math.ceil(sortedApplications.length / pageSize));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(1);
    }
  }, [totalPages, currentPage]);

  const paginatedApplications = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return sortedApplications.slice(startIndex, startIndex + pageSize);
  }, [sortedApplications, currentPage, pageSize]);

  return (
    <div className="rounded-xl border bg-card shadow-xs overflow-hidden">
      {/* Mobile Card List View (< sm) */}
      <div className="block sm:hidden divide-y divide-border/60">
        {/* Mobile Sort Controls */}
        <div className="p-3 bg-muted/30 flex items-center justify-between text-xs font-medium border-b">
          <span className="text-muted-foreground">Sort by:</span>
          <div className="flex items-center gap-1.5">
            <Button
              variant={sortField === 'company_name' ? 'default' : 'outline'}
              size="sm"
              className="h-7 px-2 text-[11px]"
              onClick={() => handleSort('company_name')}
            >
              Company
            </Button>
            <Button
              variant={sortField === 'date_applied' ? 'default' : 'outline'}
              size="sm"
              className="h-7 px-2 text-[11px]"
              onClick={() => handleSort('date_applied')}
            >
              Date
            </Button>
            <Button
              variant={sortField === 'application_status' ? 'default' : 'outline'}
              size="sm"
              className="h-7 px-2 text-[11px]"
              onClick={() => handleSort('application_status')}
            >
              Status
            </Button>
          </div>
        </div>

        {sortedApplications.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            No applications match your search or filter.
          </div>
        ) : (
          paginatedApplications.map((app) => (
            <div
              key={app.application_id}
              onClick={() => onView(app)}
              className="p-3.5 space-y-2.5 active:bg-muted/40 transition-colors cursor-pointer"
            >
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
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary font-bold text-xs">
                      {getInitials(app.company_name)}
                    </div>
                  )}
                  <div className="min-w-0">
                    <h4 className="font-semibold text-sm truncate text-foreground">
                      {app.job_title}
                    </h4>
                    <p className="text-xs text-muted-foreground truncate">
                      {app.company_name}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleFavorite?.(app);
                    }}
                    title={app.is_favorite ? 'Favorite (High Priority) - click to remove' : 'Mark as Favorite'}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-amber-500 hover:bg-muted/60 transition-colors focus:outline-none cursor-pointer"
                  >
                    <Star
                      className={cn(
                        'h-4 w-4 transition-transform active:scale-125',
                        app.is_favorite ? 'fill-amber-400 text-amber-500' : 'text-muted-foreground/35 hover:text-amber-400'
                      )}
                    />
                  </button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:bg-muted/60">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-40">
                      <DropdownMenuItem onClick={() => onView(app)}>
                        <Eye className="mr-2 h-4 w-4" />
                        View
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onToggleFavorite?.(app)}>
                        <Star className={cn("mr-2 h-4 w-4", app.is_favorite ? "fill-amber-400 text-amber-500" : "text-amber-500")} />
                        {app.is_favorite ? 'Remove Favorite' : 'Mark Favorite'}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onEdit(app)}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => onDelete(app.application_id)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs gap-2 pt-0.5">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span
                    className={cn(
                      'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border',
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

                <span className="text-[11px] text-muted-foreground shrink-0 flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {formatDate(app.date_applied)}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop Table View (>= sm) */}
      <div className="hidden sm:block overflow-x-auto">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead className="w-10 px-2 text-center">
                <span title="Favorites / High Priority">
                  <Star className="h-3.5 w-3.5 mx-auto text-amber-500 fill-amber-400" />
                </span>
              </TableHead>
              <TableHead className="min-w-[200px] sm:min-w-[240px]">
                <Button
                  variant="ghost"
                  size="sm"
                  className="-ml-3 h-8 font-semibold text-xs"
                  onClick={() => handleSort('company_name')}
                >
                  Company & Role
                  <ArrowUpDown className="ml-2 h-3.5 w-3.5" />
                </Button>
              </TableHead>
              <TableHead className="min-w-[150px]">
                <Button
                  variant="ghost"
                  size="sm"
                  className="-ml-3 h-8 font-semibold text-xs"
                  onClick={() => handleSort('location')}
                >
                  Location & Mode
                  <ArrowUpDown className="ml-2 h-3.5 w-3.5" />
                </Button>
              </TableHead>
              <TableHead className="min-w-[120px]">
                <Button
                  variant="ghost"
                  size="sm"
                  className="-ml-3 h-8 font-semibold text-xs"
                  onClick={() => handleSort('application_status')}
                >
                  Status
                  <ArrowUpDown className="ml-2 h-3.5 w-3.5" />
                </Button>
              </TableHead>
              <TableHead className="min-w-[130px]">
                <Button
                  variant="ghost"
                  size="sm"
                  className="-ml-3 h-8 font-semibold text-xs"
                  onClick={() => handleSort('date_applied')}
                >
                  Applied Date
                  <ArrowUpDown className="ml-2 h-3.5 w-3.5" />
                </Button>
              </TableHead>
              <TableHead className="min-w-[110px]">
                <Button
                  variant="ghost"
                  size="sm"
                  className="-ml-3 h-8 font-semibold text-xs"
                  onClick={() => handleSort('match_score')}
                >
                  Match Score
                  <ArrowUpDown className="ml-2 h-3.5 w-3.5" />
                </Button>
              </TableHead>
              <TableHead className="text-right min-w-[70px]">Actions</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
          {sortedApplications.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={7}
                className="h-32 text-center text-sm text-muted-foreground"
              >
                No applications match your search or filter.
              </TableCell>
            </TableRow>
          ) : (
            paginatedApplications.map((app) => (
              <TableRow
                key={app.application_id}
                className="cursor-pointer transition-colors hover:bg-muted/40"
                onClick={() => onView(app)}
              >
                {/* Dedicated Favorite Star Column */}
                <TableCell
                  className="w-10 px-2 text-center"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={() => onToggleFavorite?.(app)}
                    title={app.is_favorite ? 'Favorite (High Priority) - click to remove' : 'Mark as Favorite (High Priority)'}
                    className="flex h-7 w-7 mx-auto items-center justify-center rounded-md text-muted-foreground hover:text-amber-500 hover:bg-muted/60 transition-colors focus:outline-none cursor-pointer"
                  >
                    <Star
                      className={cn(
                        'h-4 w-4 transition-transform active:scale-125',
                        app.is_favorite ? 'fill-amber-400 text-amber-500' : 'text-muted-foreground/30 hover:text-amber-400'
                      )}
                    />
                  </button>
                </TableCell>

                {/* Company & Job Title */}
                <TableCell className="font-medium">
                  <div className="flex items-center gap-3">
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
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary font-bold text-xs">
                        {getInitials(app.company_name)}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-sm truncate text-foreground">
                          {app.company_name}
                        </span>
                        {app.is_favorite && (
                          <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 border border-amber-200/60 dark:border-amber-800/60 px-1.5 py-0.2 rounded-full shrink-0">
                            High Priority
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {app.job_title}
                      </div>
                    </div>
                  </div>
                </TableCell>

                {/* Location */}
                <TableCell>
                  <div className="flex flex-col text-xs">
                    <span className="flex items-center gap-1 font-medium truncate">
                      <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
                      {app.location || 'Remote'}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {app.work_mode || 'Flexible'} • {app.employment_type || 'Full Time'}
                    </span>
                  </div>
                </TableCell>

                {/* Status */}
                <TableCell>
                  <span
                    className={cn(
                      'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border',
                      STATUS_COLORS[app.application_status]
                    )}
                  >
                    {app.application_status}
                  </span>
                </TableCell>

                {/* Applied Date */}
                <TableCell className="text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 shrink-0" />
                    <span>{formatDate(app.date_applied)}</span>
                  </div>
                </TableCell>

                {/* Match Score */}
                <TableCell>
                  {app.match_score !== undefined && app.match_score !== null ? (
                    <Badge
                      variant="outline"
                      className={cn(
                        'text-xs font-semibold px-2 py-0.5',
                        app.match_score >= 80
                          ? 'border-emerald-500 text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40'
                          : app.match_score >= 60
                          ? 'border-amber-500 text-amber-600 bg-amber-50 dark:bg-amber-950/40'
                          : 'border-muted text-muted-foreground'
                      )}
                    >
                      {app.match_score}%
                    </Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>

                {/* Actions */}
                <TableCell
                  className="text-right"
                  onClick={(e) => e.stopPropagation()}
                >
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-40">
                      <DropdownMenuItem onClick={() => onView(app)}>
                        <Eye className="mr-2 h-4 w-4" />
                        View
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onToggleFavorite?.(app)}>
                        <Star className={cn("mr-2 h-4 w-4", app.is_favorite ? "fill-amber-400 text-amber-500" : "text-amber-500")} />
                        {app.is_favorite ? 'Remove Favorite' : 'Mark Favorite'}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onEdit(app)}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit
                      </DropdownMenuItem>
                      {app.job_url && (
                        <DropdownMenuItem asChild>
                          <a
                            href={app.job_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center"
                          >
                            <ExternalLink className="mr-2 h-4 w-4" />
                            Posting
                          </a>
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => onDelete(app.application_id)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
      </div>

      {/* Pagination Controls */}
      {sortedApplications.length > 0 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={sortedApplications.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={(newSize) => {
            setPageSize(newSize);
            setCurrentPage(1);
          }}
        />
      )}
    </div>
  );
};
