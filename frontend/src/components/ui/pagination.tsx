import React from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems?: number;
  pageSize?: number;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: number[];
  className?: string;
  showPageSizeSelector?: boolean;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  onPageChange,
  totalItems,
  pageSize = 10,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100],
  className,
  showPageSizeSelector = true,
}) => {
  if (totalPages <= 1 && (!totalItems || totalItems <= pageSize) && !showPageSizeSelector) {
    return null;
  }

  const startItem = totalItems !== undefined && totalItems > 0 ? (currentPage - 1) * pageSize + 1 : 0;
  const endItem = totalItems !== undefined ? Math.min(currentPage * pageSize, totalItems) : 0;

  // Generate page numbers with ellipses
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible + 2) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      pages.push(1);
      const leftBoundary = Math.max(2, currentPage - 1);
      const rightBoundary = Math.min(totalPages - 1, currentPage + 1);

      if (leftBoundary > 2) {
        pages.push('...');
      }

      for (let i = leftBoundary; i <= rightBoundary; i++) {
        pages.push(i);
      }

      if (rightBoundary < totalPages - 1) {
        pages.push('...');
      }

      pages.push(totalPages);
    }
    return pages;
  };

  return (
    <div
      className={cn(
        'flex flex-col sm:flex-row items-center justify-between gap-3 px-3 py-3 border-t bg-card text-card-foreground text-xs select-none',
        className
      )}
    >
      {/* Left side: Results Count info */}
      <div className="text-muted-foreground font-medium text-center sm:text-left">
        {totalItems !== undefined ? (
          totalItems > 0 ? (
            <span>
              Showing <span className="font-semibold text-foreground">{startItem}</span> to{' '}
              <span className="font-semibold text-foreground">{endItem}</span> of{' '}
              <span className="font-semibold text-foreground">{totalItems}</span> applications
            </span>
          ) : (
            <span>0 applications</span>
          )
        ) : (
          <span>
            Page <span className="font-semibold text-foreground">{currentPage}</span> of{' '}
            <span className="font-semibold text-foreground">{totalPages}</span>
          </span>
        )}
      </div>

      {/* Right side: Page size dropdown & Navigation buttons */}
      <div className="flex items-center gap-2 sm:gap-4 flex-wrap justify-center">
        {/* Page Size Selector */}
        {showPageSizeSelector && onPageSizeChange && (
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <span className="hidden sm:inline">Rows per page:</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="h-8 rounded-md border border-input bg-background px-2 text-xs font-medium text-foreground focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring cursor-pointer"
              aria-label="Rows per page"
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt} className="bg-popover text-popover-foreground">
                  {opt}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex items-center gap-1">
          {/* First Page */}
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8 hidden sm:inline-flex"
            onClick={() => onPageChange(1)}
            disabled={currentPage <= 1}
            title="First Page"
            aria-label="First page"
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>

          {/* Previous Page */}
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage <= 1}
            title="Previous Page"
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          {/* Page numbers (visible on sm+) */}
          <div className="hidden sm:flex items-center gap-1">
            {getPageNumbers().map((page, idx) => {
              if (page === '...') {
                return (
                  <span
                    key={`ellipsis-${idx}`}
                    className="h-8 w-7 flex items-center justify-center text-muted-foreground"
                  >
                    …
                  </span>
                );
              }

              const pageNum = Number(page);
              const isActive = pageNum === currentPage;

              return (
                <Button
                  key={`page-${pageNum}`}
                  type="button"
                  variant={isActive ? 'default' : 'outline'}
                  size="icon"
                  className={cn(
                    'h-8 w-8 text-xs font-semibold',
                    isActive && 'pointer-events-none shadow-xs'
                  )}
                  onClick={() => onPageChange(pageNum)}
                  aria-label={`Page ${pageNum}`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  {pageNum}
                </Button>
              );
            })}
          </div>

          {/* Mobile Current Page Indicator */}
          <span className="sm:hidden text-xs text-muted-foreground px-2 font-medium">
            {currentPage} / {totalPages}
          </span>

          {/* Next Page */}
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages}
            title="Next Page"
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>

          {/* Last Page */}
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8 hidden sm:inline-flex"
            onClick={() => onPageChange(totalPages)}
            disabled={currentPage >= totalPages}
            title="Last Page"
            aria-label="Last page"
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};
