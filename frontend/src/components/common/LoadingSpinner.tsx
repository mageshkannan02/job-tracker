import React from 'react';
import { cn } from '@/lib/utils';
import appLogo from '@/assets/app-logo.png';

interface LoadingSpinnerProps {
  label?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  label,
  size = 'md',
  className,
}) => {
  const dimensions = {
    xs: { logo: 'h-6 w-6', container: 'p-2 space-y-1.5' },
    sm: { logo: 'h-9 w-9', container: 'p-4 space-y-2' },
    md: { logo: 'h-14 w-14', container: 'p-8 space-y-3' },
    lg: { logo: 'h-20 w-20', container: 'p-10 space-y-4' },
    xl: { logo: 'h-28 w-28', container: 'p-12 space-y-5' },
  };

  const current = dimensions[size] || dimensions.md;

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center select-none bg-transparent',
        current.container,
        className
      )}
    >
      <div className="relative flex items-center justify-center bg-transparent">
        {/* Transparent rotating App Logo with no background, no outline, no border */}
        <img
          src={appLogo}
          alt="Loading..."
          className={cn(
            'relative z-10 object-contain animate-logo-spin border-0 outline-none ring-0 shadow-none bg-transparent',
            current.logo
          )}
        />
      </div>

      {label && (
        <p className="text-xs sm:text-sm font-semibold tracking-wide text-foreground/85 dark:text-foreground/90 animate-pulse text-center max-w-sm">
          {label}
        </p>
      )}
    </div>
  );
};

export const LogoLoadingIcon: React.FC<{ size?: 'xs' | 'sm' | 'md'; className?: string }> = ({
  size = 'sm',
  className,
}) => {
  const sizeMap = {
    xs: 'h-4 w-4',
    sm: 'h-5 w-5',
    md: 'h-6 w-6',
  };

  return (
    <img
      src={appLogo}
      alt="Loading..."
      className={cn(
        'object-contain animate-logo-spin inline-block shrink-0 border-0 outline-none ring-0 shadow-none bg-transparent',
        sizeMap[size],
        className
      )}
    />
  );
};
