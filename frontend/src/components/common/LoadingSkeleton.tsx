/**
 * LoadingSkeleton component for showing placeholder content while data loads
 * Uses CSS variables for easy theme customization
 */

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular';
  width?: string | number;
  height?: string | number;
  animation?: 'pulse' | 'wave' | 'none';
}

export function Skeleton({
  className = '',
  variant = 'rectangular',
  width,
  height,
  animation = 'pulse',
}: SkeletonProps) {
  const baseClasses = 'bg-border-light';

  const variantClasses = {
    text: 'rounded h-4',
    circular: 'rounded-full',
    rectangular: 'rounded-lg',
  };

  const animationClasses = {
    pulse: 'animate-pulse',
    wave: 'animate-wave',
    none: '',
  };

  const style: React.CSSProperties = {
    width: width ? (typeof width === 'number' ? `${width}px` : width) : '100%',
    height: height
      ? typeof height === 'number'
        ? `${height}px`
        : height
      : variant === 'text'
      ? '1rem'
      : '100%',
  };

  return (
    <div
      className={`${baseClasses} ${variantClasses[variant]} ${animationClasses[animation]} ${className}`}
      style={style}
    />
  );
}

/**
 * Card skeleton for grid layouts
 */
export function CardSkeleton() {
  return (
    <div className="bg-bg-card rounded-2xl shadow-theme-sm overflow-hidden border border-border-light">
      <Skeleton variant="rectangular" height={200} className="rounded-none" />
      <div className="p-4 space-y-3">
        <Skeleton variant="text" width="80%" />
        <Skeleton variant="text" width="60%" />
      </div>
    </div>
  );
}

/**
 * Table row skeleton
 */
export function TableRowSkeleton({ columns = 4 }: { columns?: number }) {
  return (
    <tr className="border-b border-border-light">
      {Array.from({ length: columns }).map((_, index) => (
        <td key={index} className="px-6 py-4">
          <Skeleton variant="text" />
        </td>
      ))}
    </tr>
  );
}

/**
 * List item skeleton
 */
export function ListItemSkeleton() {
  return (
    <div className="flex items-center space-x-4 p-4">
      <Skeleton variant="circular" width={48} height={48} />
      <div className="flex-1 space-y-2">
        <Skeleton variant="text" width="40%" />
        <Skeleton variant="text" width="60%" />
      </div>
    </div>
  );
}

/**
 * Grid of card skeletons for common loading states
 */
export function GridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {Array.from({ length: count }).map((_, index) => (
        <CardSkeleton key={index} />
      ))}
    </div>
  );
}

/**
 * Form skeleton
 */
export function FormSkeleton({ fields = 4 }: { fields?: number }) {
  return (
    <div className="space-y-6">
      {Array.from({ length: fields }).map((_, index) => (
        <div key={index} className="space-y-2">
          <Skeleton variant="text" width="30%" height={20} />
          <Skeleton variant="rectangular" height={40} />
        </div>
      ))}
      <div className="flex gap-4 pt-4">
        <Skeleton variant="rectangular" width={100} height={40} />
        <Skeleton variant="rectangular" width={100} height={40} />
      </div>
    </div>
  );
}
