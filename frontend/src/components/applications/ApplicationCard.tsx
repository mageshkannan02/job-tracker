import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Building2,
  Calendar,
  ExternalLink,
  GripVertical,
  MapPin,
  MoreVertical,
  Pencil,
  Trash2,
  Star,
} from 'lucide-react';
import { Application } from '@/types';
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

interface ApplicationCardProps {
  application: Application;
  onView?: (app: Application) => void;
  onEdit?: (app: Application) => void;
  onDelete?: (id: string) => void;
  onToggleFavorite?: (app: Application) => void;
  isDraggable?: boolean;
}

const ApplicationCardComponent: React.FC<ApplicationCardProps> = ({
  application,
  onView,
  onEdit,
  onDelete,
  onToggleFavorite,
  isDraggable = true,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: application.application_id,
    disabled: !isDraggable,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group relative rounded-xl border bg-card p-4 text-card-foreground shadow-xs transition-all duration-200 ease-out hover:-translate-y-1 hover:shadow-md hover:border-primary/50 active:scale-[0.99] cursor-pointer',
        isDragging && 'opacity-40 shadow-2xl border-primary ring-2 ring-primary/30 rotate-2 scale-105 z-50'
      )}
    >
      {/* Top Header: Company Info + Grip + Dropdown */}
      <div className="flex items-start justify-between gap-2">
        <div
          className="flex items-center gap-2.5 min-w-0 cursor-pointer flex-1"
          onClick={() => onView?.(application)}
        >
          {application.company_logo ? (
            <img
              src={application.company_logo}
              alt={application.company_name}
              className="h-8 w-8 rounded-lg object-contain bg-muted p-1 shrink-0"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          ) : (
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary font-semibold text-xs">
              {getInitials(application.company_name)}
            </div>
          )}

          <div className="min-w-0 flex-1">
            <h4 className="text-sm font-semibold truncate hover:text-primary transition-colors">
              {application.company_name}
            </h4>
            <p className="text-xs text-muted-foreground truncate font-medium">
              {application.job_title}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {/* Favorite Star Toggle */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite?.(application);
            }}
            title={application.is_favorite ? 'Favorite (High Priority) - click to remove' : 'Mark as Favorite (High Priority)'}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-amber-500 hover:bg-muted/70 transition-colors focus:outline-none cursor-pointer shrink-0"
          >
            <Star
              className={cn(
                'h-4 w-4 transition-transform active:scale-125',
                application.is_favorite
                  ? 'fill-amber-400 text-amber-500 drop-shadow-xs'
                  : 'text-muted-foreground/35 hover:text-amber-400'
              )}
            />
          </button>

          {/* Drag Handle */}
          {isDraggable && (
            <button
              {...attributes}
              {...listeners}
              aria-label="Drag application card"
              className="flex h-7 w-7 items-center justify-center text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing rounded-md opacity-40 group-hover:opacity-100 transition-opacity focus:outline-none shrink-0"
            >
              <GripVertical className="h-4 w-4" />
            </button>
          )}

          {/* Action Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-foreground opacity-60 group-hover:opacity-100"
              >
                <MoreVertical className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={() => onView?.(application)}>
                <Building2 className="mr-2 h-4 w-4" />
                View Details
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onToggleFavorite?.(application)}>
                <Star className={cn("mr-2 h-4 w-4", application.is_favorite ? "fill-amber-400 text-amber-500" : "text-amber-500")} />
                {application.is_favorite ? 'Remove Favorite' : 'Mark Favorite'}
              </DropdownMenuItem>
              {application.job_url && (
                <DropdownMenuItem asChild>
                  <a
                    href={application.job_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center"
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Open Posting
                  </a>
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => onEdit?.(application)}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => onDelete?.(application.application_id)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* High Priority Badge if marked favorite */}
      {application.is_favorite && (
        <div className="mt-2 flex items-center gap-1.5">
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 border border-amber-200/60 dark:border-amber-800/60 px-2 py-0.5 rounded-full">
            <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-500" />
            High Priority
          </span>
        </div>
      )}

      {/* Details Row: Location & Work Mode */}
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {application.location && (
          <span className="flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            <span className="truncate max-w-[130px]">
              {application.location}
            </span>
          </span>
        )}
        {application.date_applied && (
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            <span>{formatDate(application.date_applied, 'MMM d')}</span>
          </span>
        )}
      </div>

      {/* Badges / Footer */}
      <div className="mt-3.5 flex items-center justify-between border-t border-border/60 pt-2.5">
        <span
          className={cn(
            'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border',
            STATUS_COLORS[application.application_status]
          )}
        >
          {application.application_status}
        </span>

        {application.match_score !== undefined &&
          application.match_score !== null && (
            <Badge
              variant="outline"
              className={cn(
                'text-[10px] px-1.5 py-0 font-medium',
                application.match_score >= 80
                  ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40'
                  : application.match_score >= 60
                  ? 'border-amber-500 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40'
                  : 'border-muted text-muted-foreground'
              )}
            >
              {application.match_score}% Match
            </Badge>
          )}
      </div>
    </div>
  );
};

export const ApplicationCard = React.memo(ApplicationCardComponent);
