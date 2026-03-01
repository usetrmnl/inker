/**
 * Online/offline status indicator component
 * Uses hardcoded colors that don't change with theme
 */

// Hardcoded status colors (theme-independent, bright/vivid)
const STATUS_COLORS = {
  success: {
    bg: '#DCFCE7',
    text: '#16A34A',
    border: '#86EFAC',
    dot: '#22C55E',
  },
  error: {
    bg: '#FEE2E2',
    text: '#DC2626',
    border: '#FCA5A5',
    dot: '#EF4444',
  },
  warning: {
    bg: '#FEF3C7',
    text: '#D97706',
    border: '#FCD34D',
    dot: '#F59E0B',
  },
};

interface OnlineStatusProps {
  /** Device status - 'online' or 'offline' */
  status: 'online' | 'offline' | string;
  /** Whether to show the status text label */
  showLabel?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Last seen timestamp (ISO string) for computing staleness */
  lastSeen?: string;
  /** Threshold in minutes to consider a device stale (default: 5) */
  staleThresholdMinutes?: number;
}

type StatusConfig = {
  colors: typeof STATUS_COLORS.success;
  label: string;
  pulse: boolean;
};

const sizeClasses = {
  sm: {
    dot: 'h-2 w-2',
    ring: 'h-3 w-3',
    text: 'text-xs font-medium',
    gap: 'gap-1.5',
    padding: 'px-2 py-0.5',
  },
  md: {
    dot: 'h-2.5 w-2.5',
    ring: 'h-4 w-4',
    text: 'text-sm font-medium',
    gap: 'gap-2',
    padding: 'px-3 py-1',
  },
  lg: {
    dot: 'h-3 w-3',
    ring: 'h-5 w-5',
    text: 'text-base font-semibold',
    gap: 'gap-2.5',
    padding: 'px-4 py-1.5',
  },
};

/**
 * Determines if a device should be considered stale based on lastSeen
 */
function isStale(lastSeen: string | undefined, thresholdMinutes: number): boolean {
  if (!lastSeen) return false;

  const lastSeenDate = new Date(lastSeen);
  const now = new Date();
  const diffMs = now.getTime() - lastSeenDate.getTime();
  const diffMinutes = diffMs / (1000 * 60);

  return diffMinutes > thresholdMinutes;
}

/**
 * Formats the last seen time in a human-readable way
 */
function formatLastSeen(lastSeen: string | undefined): string {
  if (!lastSeen) return '';

  const lastSeenDate = new Date(lastSeen);
  const now = new Date();
  const diffMs = now.getTime() - lastSeenDate.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));

  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

function getStatusConfig(
  status: string,
  lastSeen: string | undefined,
  staleThresholdMinutes: number
): StatusConfig {
  const normalizedStatus = status?.toLowerCase();

  if (normalizedStatus === 'online') {
    // Check if the device is actually stale despite reporting online
    const stale = isStale(lastSeen, staleThresholdMinutes);
    if (stale) {
      return {
        colors: STATUS_COLORS.warning,
        label: 'Stale',
        pulse: false,
      };
    }
    return {
      colors: STATUS_COLORS.success,
      label: 'Online',
      pulse: true,
    };
  }

  // Offline or unknown status
  return {
    colors: STATUS_COLORS.error,
    label: 'Offline',
    pulse: false,
  };
}

export function OnlineStatus({
  status,
  showLabel = true,
  className = '',
  size = 'md',
  lastSeen,
  staleThresholdMinutes = 5,
}: OnlineStatusProps) {
  const sizes = sizeClasses[size];
  const config = getStatusConfig(status, lastSeen, staleThresholdMinutes);
  const lastSeenText = formatLastSeen(lastSeen);

  const title = lastSeen
    ? `${config.label} - Last seen: ${lastSeenText}`
    : config.label;

  return (
    <span
      className={`
        inline-flex items-center ${sizes.gap}
        ${showLabel ? `${sizes.padding} rounded-full border` : ''}
        ${className}
      `}
      style={showLabel ? {
        backgroundColor: config.colors.bg,
        borderColor: config.colors.border,
      } : undefined}
      title={title}
    >
      {/* Status dot with optional pulse animation */}
      <span className={`relative flex items-center justify-center ${sizes.ring}`}>
        {/* Outer ring for online status */}
        {config.pulse && (
          <span
            className="absolute inset-0 rounded-full ring-4 animate-ping opacity-75"
            style={{
              '--tw-ring-color': `${config.colors.dot}4D`,
            } as React.CSSProperties}
          />
        )}
        {/* Inner dot */}
        <span
          className={`relative ${sizes.dot} rounded-full`}
          style={{
            backgroundColor: config.colors.dot,
            boxShadow: config.pulse ? `0 10px 15px -3px ${config.colors.dot}80` : undefined,
          }}
        />
      </span>
      {showLabel && (
        <span
          className={sizes.text}
          style={{ color: config.colors.text }}
        >
          {config.label}
        </span>
      )}
    </span>
  );
}

/**
 * Compact version that only shows the dot indicator
 */
export function OnlineStatusDot({
  status,
  className = '',
  size = 'md',
  lastSeen,
  staleThresholdMinutes = 5,
}: Omit<OnlineStatusProps, 'showLabel'>) {
  return (
    <OnlineStatus
      status={status}
      showLabel={false}
      className={className}
      size={size}
      lastSeen={lastSeen}
      staleThresholdMinutes={staleThresholdMinutes}
    />
  );
}

/**
 * Extended status indicator with last seen time
 */
export function OnlineStatusWithTime({
  status,
  className = '',
  size = 'md',
  lastSeen,
  staleThresholdMinutes = 5,
}: Omit<OnlineStatusProps, 'showLabel'>) {
  const sizes = sizeClasses[size];
  const lastSeenText = formatLastSeen(lastSeen);

  return (
    <div className={`inline-flex flex-col ${className}`}>
      <OnlineStatus
        status={status}
        showLabel={true}
        size={size}
        lastSeen={lastSeen}
        staleThresholdMinutes={staleThresholdMinutes}
      />
      {lastSeenText && (
        <span className={`${sizes.text} mt-1 ml-0.5`} style={{ color: '#1A1A1A' }}>
          {lastSeenText}
        </span>
      )}
    </div>
  );
}

/**
 * Large status badge with icon
 */
export function OnlineStatusBadge({
  status,
  className = '',
  lastSeen,
  staleThresholdMinutes = 5,
}: Omit<OnlineStatusProps, 'showLabel' | 'size'>) {
  const config = getStatusConfig(status, lastSeen, staleThresholdMinutes);
  const lastSeenText = formatLastSeen(lastSeen);

  return (
    <div
      className={`inline-flex items-center gap-3 px-4 py-2 rounded-xl border ${className}`}
      style={{
        backgroundColor: config.colors.bg,
        borderColor: config.colors.border,
      }}
    >
      {/* Status icon */}
      <div className="relative">
        {config.pulse && (
          <span
            className="absolute inset-0 rounded-full animate-ping"
            style={{ backgroundColor: `${config.colors.dot}4D` }}
          />
        )}
        <div
          className="w-4 h-4 rounded-full"
          style={{
            backgroundColor: config.colors.dot,
            boxShadow: config.pulse ? `0 10px 15px -3px ${config.colors.dot}80` : undefined,
          }}
        />
      </div>

      {/* Status text */}
      <div className="flex flex-col">
        <span
          className="text-sm font-semibold"
          style={{ color: config.colors.text }}
        >
          {config.label}
        </span>
        {lastSeenText && (
          <span className="text-xs" style={{ color: '#1A1A1A' }}>
            Last seen {lastSeenText}
          </span>
        )}
      </div>
    </div>
  );
}
