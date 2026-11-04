import React from 'react';
import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  description?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  iconColor?: string;
  className?: string;
  onClick?: () => void;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  icon: Icon,
  description,
  trend,
  trendValue,
  iconColor = 'text-primary bg-primary/10',
  className,
  onClick,
}) => {
  return (
    <Card
      onClick={onClick}
      className={cn(
        'overflow-hidden transition-all duration-200 border border-border/80 autumn-card-hover bg-gradient-to-br from-card via-card to-amber-500/[0.03] autumn-tree-shading',
        onClick && 'cursor-pointer hover:border-primary/40',
        className
      )}
    >
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {title}
          </p>
          <div
            className={cn(
              'flex h-9 w-9 items-center justify-center rounded-lg',
              iconColor
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
          </div>
        </div>

        <div className="mt-3 flex items-baseline justify-between">
          <div className="text-2xl font-bold tracking-tight text-foreground">
            {value}
          </div>

          {trend && trendValue && (
            <div
              className={cn(
                'flex items-center text-xs font-semibold',
                trend === 'up'
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : trend === 'down'
                  ? 'text-rose-600 dark:text-rose-400'
                  : 'text-muted-foreground'
              )}
            >
              {trend === 'up' ? (
                <TrendingUp className="mr-1 h-3.5 w-3.5" />
              ) : trend === 'down' ? (
                <TrendingDown className="mr-1 h-3.5 w-3.5" />
              ) : null}
              {trendValue}
            </div>
          )}
        </div>

        {description && (
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        )}
      </CardContent>
    </Card>
  );
};
