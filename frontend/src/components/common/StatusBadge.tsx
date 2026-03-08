interface StatusBadgeProps {
  status: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'solid' | 'soft' | 'outline';
}

type StatusConfig = {
  solid: {
    bg: string;
    text: string;
  };
  soft: {
    bg: string;
    text: string;
    border: string;
  };
  outline: {
    border: string;
    text: string;
  };
  dot: string;
  label: string;
};

/**
 * Status badge component with monochrome theme
 * Uses CSS variables for easy theme customization
 */
export function StatusBadge({
  status,
  className = '',
  size = 'md',
  variant = 'soft',
}: StatusBadgeProps) {
  const statusConfig: Record<string, StatusConfig> = {
    online: {
      solid: { bg: 'bg-status-success-text', text: 'text-white' },
      soft: { bg: 'bg-status-success-bg', text: 'text-status-success-text', border: 'border-status-success-border' },
      outline: { border: 'border-status-success-border', text: 'text-status-success-text' },
      dot: 'bg-status-success-dot',
      label: 'Online',
    },
    offline: {
      soft: { bg: 'bg-bg-muted', text: 'text-text-secondary', border: 'border-border-light' },
      solid: { bg: 'bg-text-muted', text: 'text-text-inverse' },
      outline: { border: 'border-border-default', text: 'text-text-secondary' },
      dot: 'bg-text-muted',
      label: 'Offline',
    },
    active: {
      solid: { bg: 'bg-accent', text: 'text-white' },
      soft: { bg: 'bg-accent-light', text: 'text-accent-text', border: 'border-accent/30' },
      outline: { border: 'border-accent', text: 'text-accent' },
      dot: 'bg-accent',
      label: 'Active',
    },
    inactive: {
      solid: { bg: 'bg-status-warning-text', text: 'text-white' },
      soft: { bg: 'bg-status-warning-bg', text: 'text-status-warning-text', border: 'border-status-warning-border' },
      outline: { border: 'border-status-warning-border', text: 'text-status-warning-text' },
      dot: 'bg-status-warning-dot',
      label: 'Inactive',
    },
    pending: {
      solid: { bg: 'bg-status-info-text', text: 'text-white' },
      soft: { bg: 'bg-status-info-bg', text: 'text-status-info-text', border: 'border-status-info-border' },
      outline: { border: 'border-status-info-border', text: 'text-status-info-text' },
      dot: 'bg-status-info-dot',
      label: 'Pending',
    },
    error: {
      solid: { bg: 'bg-status-error-text', text: 'text-white' },
      soft: { bg: 'bg-status-error-bg', text: 'text-status-error-text', border: 'border-status-error-border' },
      outline: { border: 'border-status-error-border', text: 'text-status-error-text' },
      dot: 'bg-status-error-dot',
      label: 'Error',
    },
    success: {
      solid: { bg: 'bg-status-success-text', text: 'text-white' },
      soft: { bg: 'bg-status-success-bg', text: 'text-status-success-text', border: 'border-status-success-border' },
      outline: { border: 'border-status-success-border', text: 'text-status-success-text' },
      dot: 'bg-status-success-dot',
      label: 'Success',
    },
    warning: {
      solid: { bg: 'bg-status-warning-text', text: 'text-white' },
      soft: { bg: 'bg-status-warning-bg', text: 'text-status-warning-text', border: 'border-status-warning-border' },
      outline: { border: 'border-status-warning-border', text: 'text-status-warning-text' },
      dot: 'bg-status-warning-dot',
      label: 'Warning',
    },
  };

  // Default fallback for unknown status values
  const defaultConfig: StatusConfig = {
    solid: { bg: 'bg-text-muted', text: 'text-text-inverse' },
    soft: { bg: 'bg-bg-muted', text: 'text-text-secondary', border: 'border-border-light' },
    outline: { border: 'border-border-default', text: 'text-text-secondary' },
    dot: 'bg-text-muted',
    label: status || 'Unknown',
  };

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs gap-1',
    md: 'px-2.5 py-1 text-xs gap-1.5',
    lg: 'px-3 py-1.5 text-sm gap-2',
  };

  const dotSizeClasses = {
    sm: 'h-1.5 w-1.5',
    md: 'h-2 w-2',
    lg: 'h-2.5 w-2.5',
  };

  // Safely access config with fallback
  const config = statusConfig[status?.toLowerCase()] || defaultConfig;

  const getVariantClasses = () => {
    switch (variant) {
      case 'solid':
        return `${config.solid.bg} ${config.solid.text}`;
      case 'outline':
        return `bg-transparent border-2 ${config.outline.border} ${config.outline.text}`;
      case 'soft':
      default:
        return `${config.soft.bg} ${config.soft.text} border ${config.soft.border}`;
    }
  };

  return (
    <span
      className={`
        inline-flex items-center font-semibold rounded-full
        transition-all duration-200
        ${sizeClasses[size]}
        ${getVariantClasses()}
        ${className}
      `.replace(/\s+/g, ' ').trim()}
    >
      <span className={`rounded-full ${dotSizeClasses[size]} ${config.dot} animate-pulse`} />
      {config.label}
    </span>
  );
}
