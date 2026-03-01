import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'warning' | 'outline' | 'ghost';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  fullWidth?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

/**
 * Reusable Button component with monochrome theme and accent color
 * Uses CSS variables for easy theme customization
 */
export function Button({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  fullWidth = false,
  leftIcon,
  rightIcon,
  disabled,
  className = '',
  ...props
}: ButtonProps) {
  const baseClasses = `
    inline-flex items-center justify-center font-semibold
    rounded-xl transition-all duration-200 ease-in-out
    focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-bg-page
    disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none
    transform active:scale-[0.98]
  `;

  const variantClasses = {
    primary: `
      bg-accent text-text-inverse shadow-theme-md
      hover:bg-accent-hover hover:shadow-theme-lg
      focus:ring-accent
    `,
    secondary: `
      bg-text-primary text-text-inverse shadow-theme-md
      hover:opacity-90 hover:shadow-theme-lg
      focus:ring-text-muted
    `,
    danger: `
      bg-status-error-text text-text-inverse shadow-theme-md
      hover:opacity-90 hover:shadow-theme-lg
      focus:ring-status-error-border
    `,
    success: `
      bg-status-success-text text-text-inverse shadow-theme-md
      hover:opacity-90 hover:shadow-theme-lg
      focus:ring-status-success-border
    `,
    warning: `
      bg-status-warning-text text-text-inverse shadow-theme-md
      hover:opacity-90 hover:shadow-theme-lg
      focus:ring-status-warning-border
    `,
    outline: `
      bg-transparent border-2 border-border-default
      text-text-secondary shadow-theme-sm
      hover:bg-bg-muted hover:border-border-dark hover:shadow-theme-md
      focus:ring-border-dark
    `,
    ghost: `
      bg-transparent text-text-secondary
      hover:bg-bg-muted hover:text-text-primary
      focus:ring-border-default
    `,
  };

  const sizeClasses = {
    xs: 'px-2.5 py-1 text-xs gap-1',
    sm: 'px-3 py-1.5 text-sm gap-1.5',
    md: 'px-4 py-2.5 text-sm gap-2',
    lg: 'px-6 py-3 text-base gap-2',
  };

  const widthClass = fullWidth ? 'w-full' : '';

  const classes = `
    ${baseClasses}
    ${variantClasses[variant]}
    ${sizeClasses[size]}
    ${widthClass}
    ${className}
  `.replace(/\s+/g, ' ').trim();

  return (
    <button
      className={classes}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <svg
          className="animate-spin h-4 w-4"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      ) : (
        leftIcon
      )}
      {children}
      {!isLoading && rightIcon}
    </button>
  );
}
