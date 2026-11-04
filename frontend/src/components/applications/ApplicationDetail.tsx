import React from 'react';
import {
  Building2,
  Calendar,
  Clock,
  DollarSign,
  ExternalLink,
  Globe,
  Mail,
  MapPin,
  Pencil,
  Trash2,
  User,
  Sparkles,
  ArrowRight,
  Star,
} from 'lucide-react';
import { Application, ApplicationStatus } from '@/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn, formatDate, getInitials, STATUS_COLORS } from '@/lib/utils';
import { calendarApi } from '@/lib/api';
import { toast } from 'sonner';

interface ApplicationDetailProps {
  application: Application | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (app: Application) => void;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, newStatus: ApplicationStatus) => void;
  onToggleFavorite?: (app: Application) => void;
}

const ALL_STATUSES: ApplicationStatus[] = [
  'Wishlist',
  'Applied',
  'Assessment',
  'Interview',
  'Offer',
  'Rejected',
  'NoResponse',
];

export const ApplicationDetail: React.FC<ApplicationDetailProps> = ({
  application,
  open,
  onOpenChange,
  onEdit,
  onDelete,
  onStatusChange,
  onToggleFavorite,
}) => {
  if (!application) return null;

  const handleAddToGoogleCalendar = async () => {
    try {
      const res = await calendarApi.getWebLink({
        application_id: application.application_id,
      });
      if (res.data?.url) {
        window.open(res.data.url, '_blank', 'noopener,noreferrer');
        toast.success('Opening Google Calendar event creation...');
      }
    } catch {
      toast.error('Could not generate Google Calendar link');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] p-0 overflow-hidden flex flex-col">
        {/* Header Banner */}
        <div className="bg-muted/40 p-4 sm:p-6 border-b">
          <div className="flex flex-col sm:flex-row items-start justify-between gap-3 sm:gap-4">
            <div className="flex items-start gap-3 sm:gap-4 min-w-0">
              {application.company_logo ? (
                <img
                  src={application.company_logo}
                  alt={application.company_name}
                  className="h-12 w-12 sm:h-14 sm:w-14 rounded-xl border bg-card p-1.5 object-contain shadow-xs shrink-0"
                />
              ) : (
                <div className="flex h-12 w-12 sm:h-14 sm:w-14 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary font-bold text-base sm:text-lg border">
                  {getInitials(application.company_name)}
                </div>
              )}

              <div className="min-w-0">
                <DialogTitle className="text-xl sm:text-2xl font-bold tracking-tight truncate">
                  {application.job_title}
                </DialogTitle>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="text-sm sm:text-base font-semibold text-foreground/80 truncate">
                    {application.company_name}
                  </span>
                  {application.company_website && (
                    <a
                      href={application.company_website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-primary transition-colors"
                      title="Company Website"
                    >
                      <Globe className="h-4 w-4" />
                    </a>
                  )}
                  {application.job_url && (
                    <a
                      href={application.job_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-primary transition-colors"
                      title="Job Posting"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  )}
                </div>
              </div>
            </div>

            {/* Edit / Delete / Favorite actions */}
            <div className="flex items-center gap-2 self-end sm:self-auto shrink-0 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onToggleFavorite?.(application)}
                className={cn(
                  'gap-1.5 h-8 text-xs',
                  application.is_favorite
                    ? 'text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100'
                    : 'text-muted-foreground hover:text-amber-500'
                )}
              >
                <Star
                  className={cn(
                    'h-3.5 w-3.5',
                    application.is_favorite ? 'fill-amber-400 text-amber-500' : ''
                  )}
                />
                {application.is_favorite ? 'High Priority' : 'Mark Priority'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onOpenChange(false);
                  onEdit(application);
                }}
                className="gap-1.5 h-8 text-xs"
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onOpenChange(false);
                  onDelete(application.application_id);
                }}
                className="text-destructive hover:bg-destructive/10 border-destructive/30 h-8 w-8 p-0"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Quick Status Bar */}
          <div className="mt-4 flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
            <span className="text-xs font-medium text-muted-foreground mr-1 shrink-0">
              Move Stage:
            </span>
            {ALL_STATUSES.map((status) => {
              const isCurrent = application.application_status === status;
              return (
                <button
                  key={status}
                  onClick={() =>
                    !isCurrent &&
                    onStatusChange(application.application_id, status)
                  }
                  className={cn(
                    'px-2.5 py-1 text-xs font-medium rounded-full border transition-all cursor-pointer shrink-0 whitespace-nowrap',
                    isCurrent
                      ? `${STATUS_COLORS[status]} ring-2 ring-primary/40 font-semibold shadow-xs`
                      : 'bg-background hover:bg-muted text-muted-foreground border-border/80'
                  )}
                >
                  {status}
                </button>
              );
            })}
          </div>
        </div>

        {/* Scrollable Body Content */}
        <ScrollArea className="flex-1 p-4 sm:p-6">
          <div className="space-y-6">
            {/* Highlights Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="rounded-lg border bg-card p-3 shadow-xs">
                <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" /> Location
                </span>
                <p className="mt-1 font-semibold text-sm truncate">
                  {application.location || 'Remote'}
                </p>
                <span className="text-[10px] text-muted-foreground">
                  {application.work_mode || 'Flexible'}
                </span>
              </div>

              <div className="rounded-lg border bg-card p-3 shadow-xs">
                <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                  <DollarSign className="h-3.5 w-3.5" /> Salary
                </span>
                <p className="mt-1 font-semibold text-sm truncate">
                  {application.salary_range || 'Not Disclosed'}
                </p>
                <span className="text-[10px] text-muted-foreground">
                  {application.employment_type || 'Full Time'}
                </span>
              </div>

              <div className="rounded-lg border bg-card p-3 shadow-xs">
                <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" /> Applied
                </span>
                <p className="mt-1 font-semibold text-sm">
                  {formatDate(application.date_applied)}
                </p>
                <span className="text-[10px] text-muted-foreground">
                  Discovered: {formatDate(application.date_discovered)}
                </span>
              </div>

              <div className="rounded-lg border bg-card p-3 shadow-xs">
                <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                  <Sparkles className="h-3.5 w-3.5 text-primary" /> Match Score
                </span>
                <p className="mt-1 font-semibold text-sm text-primary">
                  {application.match_score ? `${application.match_score}%` : 'N/A'}
                </p>
                <span className="text-[10px] text-muted-foreground">
                  {application.resume_version ? `v: ${application.resume_version}` : 'Standard'}
                </span>
              </div>
            </div>

            {/* Recruiter / Contact Info */}
            {(application.recruiter_name || application.recruiter_email || application.follow_up_date) && (
              <div className="rounded-lg border p-4 bg-muted/20">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  Contact & Follow-up Details
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                  {application.recruiter_name && (
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div>
                        <p className="text-xs text-muted-foreground">Contact</p>
                        <p className="font-medium">{application.recruiter_name}</p>
                      </div>
                    </div>
                  )}

                  {application.recruiter_email && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div>
                        <p className="text-xs text-muted-foreground">Email</p>
                        <a
                          href={`mailto:${application.recruiter_email}`}
                          className="font-medium text-primary hover:underline truncate block max-w-[180px]"
                        >
                          {application.recruiter_email}
                        </a>
                      </div>
                    </div>
                  )}

                  {application.follow_up_date && (
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-amber-500 shrink-0" />
                      <div>
                        <p className="text-xs text-muted-foreground">Follow-up Due</p>
                        <p className="font-medium text-amber-600 dark:text-amber-400">
                          {formatDate(application.follow_up_date)}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-3 pt-3 border-t flex items-center justify-between">
                  <p className="text-[11px] text-muted-foreground">
                    Add this interview or follow-up deadline to your schedule:
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddToGoogleCalendar}
                    className="h-7 text-xs gap-1.5 text-blue-600 dark:text-blue-400 hover:text-blue-700"
                  >
                    <Calendar className="h-3.5 w-3.5" />
                    Add to Google Calendar
                  </Button>
                </div>
              </div>
            )}

            {/* Skills */}
            {application.required_skills && application.required_skills.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Required Skills & Technologies
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {application.required_skills.map((skill, index) => (
                    <Badge
                      key={index}
                      variant="secondary"
                      className="text-xs px-2.5 py-0.5 font-normal"
                    >
                      {skill}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Notes */}
            {application.notes && (
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Personal Notes
                </h4>
                <div className="rounded-lg border bg-muted/30 p-3.5 text-sm whitespace-pre-wrap leading-relaxed">
                  {application.notes}
                </div>
              </div>
            )}

            {/* Job Description */}
            {application.job_description && (
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Job Description
                </h4>
                <div className="rounded-lg border p-4 text-sm whitespace-pre-wrap leading-relaxed text-muted-foreground bg-card">
                  {application.job_description}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
