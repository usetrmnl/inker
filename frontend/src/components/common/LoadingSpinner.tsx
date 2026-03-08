interface LoadingSpinnerProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  color?: 'primary' | 'secondary' | 'white' | 'muted';
  label?: string;
}

/**
 * Loading spinner component with monochrome theme
 * Uses CSS variables for easy theme customization
 */
export function LoadingSpinner({
  size = 'md',
  className = '',
  color = 'primary',
  label,
}: LoadingSpinnerProps) {
  const sizeClasses = {
    xs: 'h-3 w-3',
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12',
    xl: 'h-16 w-16',
  };

  const colorClasses = {
    primary: 'text-accent',
    secondary: 'text-text-secondary',
    white: 'text-white',
    muted: 'text-text-muted',
  };

  const trackColorClasses = {
    primary: 'text-border-light',
    secondary: 'text-border-light',
    white: 'text-white/30',
    muted: 'text-border-light',
  };

  return (
    <div className={`flex flex-col items-center justify-center gap-3 ${className}`}>
      <div className="relative">
        {/* Background track */}
        <svg
          className={`${sizeClasses[size]} ${trackColorClasses[color]}`}
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="3"
          />
        </svg>
        {/* Animated spinner */}
        <svg
          className={`absolute top-0 left-0 animate-spin ${sizeClasses[size]} ${colorClasses[color]}`}
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M12 2C6.47715 2 2 6.47715 2 12C2 14.5361 2.94409 16.8517 4.5 18.6055"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </svg>
      </div>
      {label && (
        <p className={`text-sm font-medium ${color === 'white' ? 'text-white' : 'text-text-muted'}`}>
          {label}
        </p>
      )}
    </div>
  );
}

/**
 * Full page loading spinner overlay
 */
export function LoadingOverlay({
  label = 'Loading...',
}: {
  label?: string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg-page/80 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-4 p-8 bg-bg-card rounded-2xl shadow-theme-xl border border-border-light">
        <LoadingSpinner size="lg" color="primary" />
        <p className="text-sm font-medium text-text-muted">{label}</p>
      </div>
    </div>
  );
}

/**
 * Inline loading spinner for buttons and small areas
 */
export function LoadingDots({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      <span className="h-1.5 w-1.5 bg-current rounded-full animate-bounce [animation-delay:-0.3s]" />
      <span className="h-1.5 w-1.5 bg-current rounded-full animate-bounce [animation-delay:-0.15s]" />
      <span className="h-1.5 w-1.5 bg-current rounded-full animate-bounce" />
    </span>
  );
}
