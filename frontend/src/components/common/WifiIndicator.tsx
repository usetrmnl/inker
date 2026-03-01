/**
 * WiFi signal strength indicator component
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
  info: {
    bg: '#DBEAFE',
    text: '#2563EB',
    dot: '#3B82F6',
  },
};

interface WifiIndicatorProps {
  /** WiFi signal strength in dBm (typically -30 to -90) */
  signal: number | undefined | null;
  /** Whether to show the dBm value */
  showValue?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
}

type WifiConfig = {
  bars: number;
  colors: typeof STATUS_COLORS.success;
  label: string;
};

/**
 * Determines WiFi signal quality based on RSSI (dBm)
 */
function getWifiConfig(signal: number): WifiConfig {
  if (signal > -50) {
    return {
      bars: 4,
      colors: STATUS_COLORS.success,
      label: 'Excellent',
    };
  }
  if (signal >= -60) {
    return {
      bars: 3,
      colors: STATUS_COLORS.info,
      label: 'Good',
    };
  }
  if (signal >= -70) {
    return {
      bars: 2,
      colors: STATUS_COLORS.warning,
      label: 'Fair',
    };
  }
  return {
    bars: 1,
    colors: STATUS_COLORS.error,
    label: 'Poor',
  };
}

const sizeClasses = {
  sm: {
    container: 'h-4',
    text: 'text-xs font-medium',
    gap: 'gap-1',
    badge: 'px-2 py-0.5',
    barGap: 'gap-0.5',
    barWidth: 'w-1',
    barHeights: ['h-1.5', 'h-2.5', 'h-3.5', 'h-4'],
  },
  md: {
    container: 'h-5',
    text: 'text-sm font-medium',
    gap: 'gap-1.5',
    badge: 'px-2.5 py-1',
    barGap: 'gap-0.5',
    barWidth: 'w-1.5',
    barHeights: ['h-2', 'h-3', 'h-4', 'h-5'],
  },
  lg: {
    container: 'h-6',
    text: 'text-base font-semibold',
    gap: 'gap-2',
    badge: 'px-3 py-1.5',
    barGap: 'gap-1',
    barWidth: 'w-2',
    barHeights: ['h-2.5', 'h-3.5', 'h-5', 'h-6'],
  },
};

export function WifiIndicator({
  signal,
  showValue = false,
  className = '',
  size = 'md',
}: WifiIndicatorProps) {
  const sizes = sizeClasses[size];

  // Handle null/undefined values gracefully
  if (signal === null || signal === undefined) {
    return (
      <span className={`inline-flex items-center ${sizes.gap} ${className}`}>
        <div className={`${sizes.badge} rounded-full bg-bg-muted text-text-muted flex items-center ${sizes.gap}`}>
          <WifiIcon size={size} activeBars={0} barActiveColor="#E5E5E5" />
          {showValue && <span className={sizes.text}>N/A</span>}
        </div>
      </span>
    );
  }

  const config = getWifiConfig(signal);

  return (
    <span
      className={`inline-flex items-center ${sizes.gap} ${className}`}
      title={`WiFi: ${signal} dBm (${config.label})`}
    >
      <div
        className={`${sizes.badge} rounded-full flex items-center ${sizes.gap}`}
        style={{
          backgroundColor: config.colors.bg,
          color: config.colors.text,
        }}
      >
        <WifiIcon
          size={size}
          activeBars={config.bars}
          barActiveColor={config.colors.dot}
        />
        {showValue && (
          <span className={sizes.text}>{signal} dBm</span>
        )}
      </div>
    </span>
  );
}

interface WifiIconProps {
  size: 'sm' | 'md' | 'lg';
  activeBars: number;
  barActiveColor: string;
}

function WifiIcon({ size, activeBars, barActiveColor }: WifiIconProps) {
  const sizes = sizeClasses[size];

  return (
    <div className={`inline-flex items-end ${sizes.barGap}`}>
      {[1, 2, 3, 4].map((barNumber) => {
        const isActive = barNumber <= activeBars;
        const barHeight = sizes.barHeights[barNumber - 1];

        return (
          <div
            key={barNumber}
            className={`
              ${sizes.barWidth}
              ${barHeight}
              rounded-sm
              transition-all duration-300 ease-out
              ${isActive ? 'shadow-sm' : ''}
            `}
            style={{
              backgroundColor: isActive ? barActiveColor : '#E5E5E580',
            }}
          />
        );
      })}
    </div>
  );
}

/**
 * WiFi indicator with signal strength label
 */
export function WifiIndicatorLabeled({
  signal,
  className = '',
  size = 'md',
}: Omit<WifiIndicatorProps, 'showValue'>) {
  const sizes = sizeClasses[size];

  if (signal === null || signal === undefined) {
    return (
      <span className={`inline-flex items-center ${sizes.gap} ${className}`}>
        <div className={`${sizes.badge} rounded-full bg-bg-muted text-text-muted flex items-center ${sizes.gap}`}>
          <WifiIcon size={size} activeBars={0} barActiveColor="#E5E5E5" />
          <span className={sizes.text}>No Signal</span>
        </div>
      </span>
    );
  }

  const config = getWifiConfig(signal);

  return (
    <span
      className={`inline-flex items-center ${sizes.gap} ${className}`}
      title={`WiFi: ${signal} dBm (${config.label})`}
    >
      <div
        className={`${sizes.badge} rounded-full flex items-center ${sizes.gap}`}
        style={{
          backgroundColor: config.colors.bg,
          color: config.colors.text,
        }}
      >
        <WifiIcon
          size={size}
          activeBars={config.bars}
          barActiveColor={config.colors.dot}
        />
        <span className={sizes.text}>{config.label}</span>
      </div>
    </span>
  );
}

/**
 * Compact WiFi indicator showing just the bars
 */
export function WifiIndicatorCompact({
  signal,
  className = '',
  size = 'sm',
}: Omit<WifiIndicatorProps, 'showValue'>) {
  return (
    <WifiIndicator
      signal={signal}
      showValue={false}
      className={className}
      size={size}
    />
  );
}
