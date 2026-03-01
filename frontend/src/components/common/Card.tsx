import type { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  hover?: boolean;
  onClick?: () => void;
  variant?: 'default' | 'bordered' | 'elevated';
}

interface CardHeaderProps {
  children: ReactNode;
  className?: string;
  action?: ReactNode;
}

interface CardBodyProps {
  children: ReactNode;
  className?: string;
}

interface CardFooterProps {
  children: ReactNode;
  className?: string;
}

/**
 * Card component with monochrome theme
 * Uses CSS variables for easy theme customization
 */
export function Card({
  children,
  className = '',
  padding = 'md',
  hover = false,
  onClick,
  variant = 'default',
}: CardProps) {
  const baseClasses = 'bg-bg-card rounded-2xl transition-all duration-200';

  const paddingClasses = {
    none: '',
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
  };

  const variantClasses = {
    default: 'shadow-theme-sm border border-border-light',
    bordered: 'border-2 border-border-default',
    elevated: 'shadow-theme-lg',
  };

  const hoverClass = hover
    ? 'hover:shadow-theme-xl hover:border-accent/30 hover:-translate-y-0.5'
    : '';

  const clickableClass = onClick ? 'cursor-pointer' : '';

  const classes = `
    ${baseClasses}
    ${paddingClasses[padding]}
    ${variantClasses[variant]}
    ${hoverClass}
    ${clickableClass}
    ${className}
  `.replace(/\s+/g, ' ').trim();

  return (
    <div className={classes} onClick={onClick}>
      {children}
    </div>
  );
}

/**
 * Card Header component for consistent card titles
 */
export function CardHeader({ children, className = '', action }: CardHeaderProps) {
  return (
    <div className={`flex items-center justify-between pb-4 border-b border-border-light ${className}`}>
      <div className="font-semibold text-lg text-text-primary">{children}</div>
      {action && <div>{action}</div>}
    </div>
  );
}

/**
 * Card Body component for card content
 */
export function CardBody({ children, className = '' }: CardBodyProps) {
  return <div className={`py-4 ${className}`}>{children}</div>;
}

/**
 * Card Footer component for card actions
 */
export function CardFooter({ children, className = '' }: CardFooterProps) {
  return (
    <div className={`pt-4 border-t border-border-light flex items-center gap-3 ${className}`}>
      {children}
    </div>
  );
}
