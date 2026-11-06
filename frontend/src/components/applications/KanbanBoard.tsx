import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  closestCorners,
  useDroppable,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { Application, ApplicationStatus } from '@/types';
import { ApplicationCard } from './ApplicationCard';
import { STATUS_KANBAN_COLORS } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { Plus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface KanbanBoardProps {
  applications: Application[];
  onStatusChange: (id: string, newStatus: ApplicationStatus) => void;
  onView: (app: Application) => void;
  onEdit: (app: Application) => void;
  onDelete: (id: string) => void;
  onToggleFavorite?: (app: Application) => void;
  onAddApplication?: (defaultStatus?: ApplicationStatus) => void;
}

const COLUMNS: ApplicationStatus[] = [
  'Wishlist',
  'Applied',
  'Assessment',
  'Interview',
  'Offer',
  'Rejected',
  'NoResponse',
];

interface KanbanColumnProps {
  status: ApplicationStatus;
  applications: Application[];
  onView: (app: Application) => void;
  onEdit: (app: Application) => void;
  onDelete: (id: string) => void;
  onToggleFavorite?: (app: Application) => void;
  onAddApplication?: (defaultStatus?: ApplicationStatus) => void;
}

const INITIAL_BATCH = 10;
const BATCH_SIZE = 10;

const KanbanColumn: React.FC<KanbanColumnProps> = ({
  status,
  applications,
  onView,
  onEdit,
  onDelete,
  onToggleFavorite,
  onAddApplication,
}) => {
  const { setNodeRef, isOver } = useDroppable({
    id: status,
    data: { status },
  });

  const [visibleCount, setVisibleCount] = useState<number>(INITIAL_BATCH);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // If applications list changes or filters change, keep visibleCount in valid range
  useEffect(() => {
    if (visibleCount < INITIAL_BATCH) {
      setVisibleCount(INITIAL_BATCH);
    }
  }, [applications.length]);

  const loadMore = () => {
    if (visibleCount >= applications.length || isLoadingMore) return;
    setIsLoadingMore(true);
    setTimeout(() => {
      setVisibleCount((prev) => Math.min(prev + BATCH_SIZE, applications.length));
      setIsLoadingMore(false);
    }, 120);
  };

  // Scroll listener on container
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 120) {
      loadMore();
    }
  };

  // IntersectionObserver on bottom sentinel
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && visibleCount < applications.length) {
          loadMore();
        }
      },
      {
        root: scrollContainerRef.current,
        rootMargin: '100px',
        threshold: 0.1,
      }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [visibleCount, applications.length, isLoadingMore]);

  const visibleApps = useMemo(() => {
    return applications.slice(0, visibleCount);
  }, [applications, visibleCount]);

  const cardIds = useMemo(() => {
    return visibleApps.map((a) => a.application_id);
  }, [visibleApps]);

  const hasMore = visibleCount < applications.length;

  return (
    <div
      ref={setNodeRef}
      id={`kanban-col-${status}`}
      className={cn(
        'flex flex-col h-[calc(100vh-14rem)] min-h-[460px] min-w-[260px] sm:min-w-[280px] w-[84vw] sm:w-80 shrink-0 snap-center rounded-xl border border-t-4 bg-muted/40 p-2.5 sm:p-3 transition-colors',
        STATUS_KANBAN_COLORS[status],
        isOver && 'bg-primary/5 ring-2 ring-primary/30 border-primary/40'
      )}
    >
      {/* Column Header */}
      <div className="flex items-center justify-between pb-2.5 sm:pb-3 px-1">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-sm tracking-tight text-foreground">
            {status}
          </h3>
          <span
            className="flex h-5 min-w-5 items-center justify-center rounded-full bg-background px-1.5 text-xs font-semibold text-muted-foreground shadow-xs"
            title={hasMore ? `Showing ${visibleApps.length} of ${applications.length}` : `${applications.length} total`}
          >
            {hasMore ? `${visibleApps.length}/${applications.length}` : applications.length}
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-foreground"
          onClick={() => onAddApplication?.(status)}
          title={`Add application in ${status}`}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* Cards List with Scroll Loading */}
      <SortableContext items={cardIds} strategy={verticalListSortingStrategy}>
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto space-y-2.5 sm:space-y-3 pr-1 pb-2 overscroll-contain"
        >
          {visibleApps.map((app) => (
            <ApplicationCard
              key={app.application_id}
              application={app}
              onView={onView}
              onEdit={onEdit}
              onDelete={onDelete}
              onToggleFavorite={onToggleFavorite}
            />
          ))}

          {/* Bottom Sentinel & Infinite Scroll Loader */}
          {hasMore && (
            <div
              ref={sentinelRef}
              className="py-2 px-1 text-center flex flex-col items-center justify-center gap-1.5 text-[11px] text-muted-foreground rounded-lg border border-dashed border-border/50 bg-background/50"
            >
              {isLoadingMore ? (
                <div className="flex items-center gap-1.5 text-primary font-medium">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Loading more jobs...</span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={loadMore}
                  className="hover:text-primary transition-colors cursor-pointer text-[10px]"
                >
                  Scroll down for more ({applications.length - visibleCount} remaining)
                </button>
              )}
            </div>
          )}

          {applications.length === 0 && (
            <div className="flex h-28 sm:h-32 flex-col items-center justify-center rounded-lg border border-dashed border-border/80 text-center p-3 sm:p-4">
              <p className="text-xs text-muted-foreground font-medium">
                No jobs in {status}
              </p>
              <Button
                variant="link"
                size="sm"
                className="text-xs mt-1 text-primary"
                onClick={() => onAddApplication?.(status)}
              >
                + Add one
              </Button>
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  );
};

export const KanbanBoard: React.FC<KanbanBoardProps> = ({
  applications,
  onStatusChange,
  onView,
  onEdit,
  onDelete,
  onToggleFavorite,
  onAddApplication,
}) => {
  const [activeCard, setActiveCard] = useState<Application | null>(null);

  // Optimized dual sensors: MouseSensor for instant desktop drag, TouchSensor with press-and-hold delay to allow butter-smooth scrolling on mobile touchscreens
  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 8,
      },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const card = applications.find((app) => app.application_id === active.id);
    if (card) {
      setActiveCard(card);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveCard(null);

    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    // If dropped over a column directly
    if (COLUMNS.includes(overId as ApplicationStatus)) {
      const currentApp = applications.find(
        (a) => a.application_id === activeId
      );
      if (currentApp && currentApp.application_status !== overId) {
        onStatusChange(activeId, overId as ApplicationStatus);
      }
      return;
    }

    // If dropped over another card
    const targetCard = applications.find((a) => a.application_id === overId);
    if (targetCard) {
      const sourceCard = applications.find(
        (a) => a.application_id === activeId
      );
      if (
        sourceCard &&
        sourceCard.application_status !== targetCard.application_status
      ) {
        onStatusChange(activeId, targetCard.application_status);
      }
    }
  };

  const scrollToColumn = (status: ApplicationStatus) => {
    const el = document.getElementById(`kanban-col-${status}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      {/* Mobile Column Quick-Jump Bar */}
      <div className="flex sm:hidden overflow-x-auto gap-1.5 pb-2 -mx-1 px-1">
        {COLUMNS.map((colStatus) => {
          const count = applications.filter((a) => a.application_status === colStatus).length;
          return (
            <button
              key={colStatus}
              type="button"
              onClick={() => scrollToColumn(colStatus)}
              className="px-2.5 py-1 text-xs font-semibold rounded-full border bg-muted/50 text-muted-foreground hover:text-foreground shrink-0 flex items-center gap-1.5 active:bg-primary active:text-primary-foreground transition-colors"
            >
              <span>{colStatus}</span>
              <span className="text-[10px] bg-background px-1.5 py-0.2 rounded-full font-bold shadow-2xs">
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex gap-3 sm:gap-4 overflow-x-auto pb-4 pt-1 snap-x snap-mandatory sm:snap-none -mx-1 px-1 sm:mx-0 sm:px-0">
        {COLUMNS.map((colStatus) => {
          const colApps = applications.filter(
            (app) => app.application_status === colStatus
          );
          return (
            <KanbanColumn
              key={colStatus}
              status={colStatus}
              applications={colApps}
              onView={onView}
              onEdit={onEdit}
              onDelete={onDelete}
              onToggleFavorite={onToggleFavorite}
              onAddApplication={onAddApplication}
            />
          );
        })}
      </div>

      <DragOverlay>
        {activeCard ? (
          <ApplicationCard
            application={activeCard}
            isDraggable={false}
            onToggleFavorite={onToggleFavorite}
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};
