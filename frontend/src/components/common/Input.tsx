import { type InputHTMLAttributes, forwardRef } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  fullWidth?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

/**
 * Reusable Input component with monochrome theme
 * Uses CSS variables for easy theme customization
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      helperText,
      fullWidth = true,
      leftIcon,
      rightIcon,
      className = '',
      id,
      disabled,
      ...props
    },
    ref
  ) => {
    const inputId = id || `input-${label?.toLowerCase().replace(/\s+/g, '-')}`;
    const widthClass = fullWidth ? 'w-full' : '';

    const inputClasses = `
      block w-full px-4 py-2.5
      bg-bg-input border-2 rounded-xl
      text-text-primary placeholder-text-placeholder
      transition-all duration-200 ease-in-out
      focus:outline-none focus:ring-0
      disabled:bg-bg-muted disabled:text-text-muted disabled:cursor-not-allowed
      ${leftIcon ? 'pl-11' : ''}
      ${rightIcon ? 'pr-11' : ''}
      ${error
        ? 'border-status-error-border focus:border-status-error-text focus:shadow-theme-md'
        : 'border-border-light focus:border-accent focus:shadow-theme-sm hover:border-border-default'
      }
      ${className}
    `.replace(/\s+/g, ' ').trim();

    return (
      <div className={widthClass}>
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-semibold text-text-secondary mb-2"
          >
            {label}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-text-muted">
              {leftIcon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            disabled={disabled}
            className={inputClasses}
            {...props}
          />
          {rightIcon && (
            <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-text-muted">
              {rightIcon}
            </div>
          )}
        </div>
        {error && (
          <p className="mt-2 text-sm text-status-error-text flex items-center gap-1.5">
            <svg className="h-4 w-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            {error}
          </p>
        )}
        {helperText && !error && (
          <p className="mt-2 text-sm text-text-muted">{helperText}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
