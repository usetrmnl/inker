import { type SelectHTMLAttributes, forwardRef, type ReactNode } from 'react';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helperText?: string;
  fullWidth?: boolean;
  children: ReactNode;
}

/**
 * Reusable Select component with monochrome theme
 * Uses CSS variables for easy theme customization
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      label,
      error,
      helperText,
      fullWidth = true,
      className = '',
      id,
      children,
      ...props
    },
    ref
  ) => {
    const selectId = id || `select-${label?.toLowerCase().replace(/\s+/g, '-')}`;
    const widthClass = fullWidth ? 'w-full' : '';

    const selectClasses = `
      block px-4 py-2.5 border-2 rounded-xl
      bg-bg-input text-text-primary
      transition-all duration-200 ease-in-out
      focus:outline-none focus:ring-0
      disabled:bg-bg-muted disabled:text-text-muted disabled:cursor-not-allowed
      ${error
        ? 'border-status-error-border focus:border-status-error-text'
        : 'border-border-light focus:border-accent hover:border-border-default'
      }
      ${widthClass}
      ${className}
    `.replace(/\s+/g, ' ').trim();

    return (
      <div className={widthClass}>
        {label && (
          <label
            htmlFor={selectId}
            className="block text-sm font-semibold text-text-secondary mb-2"
          >
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          className={selectClasses}
          {...props}
        >
          {children}
        </select>
        {error && (
          <p className="mt-2 text-sm text-status-error-text">{error}</p>
        )}
        {helperText && !error && (
          <p className="mt-2 text-sm text-text-muted">{helperText}</p>
        )}
      </div>
    );
  }
);

Select.displayName = 'Select';
