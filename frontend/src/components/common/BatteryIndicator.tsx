/**
 * Battery indicator component for displaying device battery level
 * Uses hardcoded colors that don't change with theme
 */

// Hardcoded status colors (theme-independent, bright/vivid)
const STATUS_COLORS = {
  success: {
    bg: '#DCFCE7',
    text: '#16A34A',
    dot: '#22C55E',
  },
  error: {
    bg: '#FEE2E2',
    text: '#DC2626',
    dot: '#EF4444',
  },
  warning: {
    bg: '#FEF3C7',
    text: '#D97706',
    dot: '#F59E0B',
  },
};

interface BatteryIndicatorProps {
  /** Battery level percentage (0-100) */
  level: number | undefined | null;
  /** Whether to show the percentage text */
  showPercentage?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Show animated charging indicator */
  isCharging?: boolean;
}

type BatteryConfig = {
  colors: typeof STATUS_COLORS.success;
  label: string;
  fillWidth: number;
};

/**
 * Determines battery status configuration based on level
 */
function getBatteryConfig(level: number): BatteryConfig {
  if (level >= 75) {
    return {
      colors: STATUS_COLORS.success,
      label: 'Full',
      fillWidth: level,
    };
  }
  if (level >= 50) {
    return {
      colors: STATUS_COLORS.warning,
      label: 'Medium',
      fillWidth: level,
    };
  }
  if (level >= 25) {
    return {
      colors: STATUS_COLORS.warning,
      label: 'Low',
      fillWidth: level,
    };
  }
  return {
    colors: STATUS_COLORS.error,
    label: 'Critical',
    fillWidth: Math.max(level, 5),
  };
}

const sizeClasses = {
  sm: {
    container: 'h-4 w-8',
    tip: 'w-1 h-2',
    text: 'text-xs font-medium',
    gap: 'gap-1.5',
    badge: 'px-2 py-0.5 text-xs',
  },
  md: {
    container: 'h-5 w-10',
    tip: 'w-1.5 h-2.5',
    text: 'text-sm font-medium',
    gap: 'gap-2',
    badge: 'px-2.5 py-1 text-sm',
  },
  lg: {
    container: 'h-6 w-12',
    tip: 'w-2 h-3',
    text: 'text-base font-semibold',
    gap: 'gap-2.5',
    badge: 'px-3 py-1.5 text-base',
  },
};

export function BatteryIndicator({
  level,
  showPercentage = true,
  className = '',
  size = 'md',
  isCharging = false,
}: BatteryIndicatorProps) {
  const sizes = sizeClasses[size];

  // Handle null/undefined/invalid values gracefully
  if (level === null || level === undefined) {
    return (
      <span className={`inline-flex items-center ${sizes.gap} ${className}`}>
        <div className={`${sizes.badge} rounded-full bg-bg-muted text-text-muted flex items-center ${sizes.gap}`}>
          <BatteryIcon size={size} fillPercent={0} colors={{ bg: '#F3F4F6', text: '#9CA3AF', dot: '#D1D5DB' }} />
          {showPercentage && <span className={sizes.text}>N/A</span>}
        </div>
      </span>
    );
  }

  // Clamp level to valid range (0-100)
  const clampedLevel = Math.max(0, Math.min(100, level));
  const config = getBatteryConfig(clampedLevel);

  return (
    <span
      className={`inline-flex items-center ${sizes.gap} ${className}`}
      title={`Battery: ${clampedLevel}% (${config.label})${isCharging ? ' - Charging' : ''}`}
    >
      <div
        className={`${sizes.badge} rounded-full flex items-center ${sizes.gap}`}
        style={{
          backgroundColor: config.colors.bg,
          color: config.colors.text,
        }}
      >
        <BatteryIcon
          size={size}
          fillPercent={clampedLevel}
          colors={config.colors}
          isCharging={isCharging}
        />
        {showPercentage && (
          <span className={sizes.text}>{clampedLevel}%</span>
        )}
      </div>
    </span>
  );
}

interface BatteryIconProps {
  size: 'sm' | 'md' | 'lg';
  fillPercent: number;
  colors: typeof STATUS_COLORS.success;
  isCharging?: boolean;
}

function BatteryIcon({ size, fillPercent, colors, isCharging = false }: BatteryIconProps) {
  const sizes = sizeClasses[size];

  return (
    <div className="relative inline-flex items-center">
      {/* Battery body */}
      <div
        className={`${sizes.container} border-2 border-current rounded-md relative overflow-hidden bg-white/50`}
      >
        {/* Fill level with gradient */}
        <div
          className="absolute left-0 top-0 bottom-0 transition-all duration-500 ease-out rounded-sm"
          style={{
            width: `${fillPercent}%`,
            background: `linear-gradient(to right, ${colors.dot}, ${colors.text})`,
          }}
        />
        {/* Charging bolt icon */}
        {isCharging && (
          <div className="absolute inset-0 flex items-center justify-center">
            <svg
              className="w-3 h-3 text-white drop-shadow-md animate-pulse"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" />
            </svg>
          </div>
        )}
      </div>
      {/* Battery tip */}
      <div
        className={`${sizes.tip} bg-current rounded-r-sm -ml-0.5`}
      />
    </div>
  );
}

/**
 * Compact battery indicator showing just the icon
 */
export function BatteryIndicatorCompact({
  level,
  className = '',
  size = 'sm',
}: Omit<BatteryIndicatorProps, 'showPercentage'>) {
  return (
    <BatteryIndicator
      level={level}
      showPercentage={false}
      className={className}
      size={size}
    />
  );
}
