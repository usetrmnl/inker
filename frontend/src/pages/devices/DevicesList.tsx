import { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '../../components/layout';
import {
  Button,
  LoadingSpinner,
  BatteryIndicator,
  WifiIndicator,
  OnlineStatus,
} from '../../components/common';
import { useInfiniteScroll } from '../../hooks';
import { deviceService } from '../../services/api';
import type { Device } from '../../types';

// Auto-refresh interval in milliseconds (30 seconds)
const AUTO_REFRESH_INTERVAL = 30 * 1000;

type ViewMode = 'grid' | 'list';
type FilterStatus = 'all' | 'online' | 'offline';

const DEVICES_VIEW_MODE_KEY = 'devices-view-mode';

export function DevicesList() {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const saved = localStorage.getItem(DEVICES_VIEW_MODE_KEY);
    return (saved === 'grid' || saved === 'list') ? saved : 'grid';
  });
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem(DEVICES_VIEW_MODE_KEY, mode);
  };

  // Fetch devices with infinite scroll
  const devicesApi = useCallback(
    (page: number, limit: number) => deviceService.getAll(page, limit),
    []
  );
  const {
    items: devices,
    isLoading,
    isLoadingMore,
    hasMore,
    refresh,
    sentinelRef,
    total,
  } = useInfiniteScroll<Device>(devicesApi);

  // Auto-refresh device list to keep online status current
  useEffect(() => {
    const interval = setInterval(() => {
      refresh();
    }, AUTO_REFRESH_INTERVAL);

    return () => clearInterval(interval);
  }, [refresh]);

  // Compute filtered devices
  const filteredDevices = useMemo(() => {
    if (!devices.length) return [];

    return devices.filter((device) => {
      if (filterStatus !== 'all' && device.status !== filterStatus) {
        return false;
      }

      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          device.name.toLowerCase().includes(query) ||
          device.macAddress.toLowerCase().includes(query) ||
          device.friendlyId?.toLowerCase().includes(query)
        );
      }

      return true;
    });
  }, [devices, filterStatus, searchQuery]);

  // Calculate stats
  const stats = useMemo(() => {
    if (!devices.length) return { total: 0, online: 0, offline: 0 };
    const deviceTotal = devices.length;
    const online = devices.filter((d) => d.status === 'online').length;
    return { total: deviceTotal, online, offline: deviceTotal - online };
  }, [devices]);

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header Section */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-text-primary">
              Devices
            </h1>
            <p className="mt-2 text-text-muted">
              Manage your TRMNL e-ink devices
            </p>
          </div>
          <Button onClick={() => navigate('/settings#device-connection')}>
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Device
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatsCard label="Total Devices" value={stats.total} type="total" />
          <StatsCard label="Online" value={stats.online} type="online" />
          <StatsCard label="Offline" value={stats.offline} type="offline" />
        </div>

        {/* Filters and View Toggle */}
        <div className="bg-bg-card rounded-xl shadow-theme-sm border border-border-light p-4">
          <div className="flex flex-col lg:flex-row lg:items-center gap-4">
            {/* Search */}
            <div className="relative flex-1">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search devices..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border-light bg-bg-input text-text-primary placeholder-text-placeholder focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
              />
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-text-muted whitespace-nowrap">Status:</span>
              <div className="flex rounded-lg border border-border-light overflow-hidden">
                {(['all', 'online', 'offline'] as FilterStatus[]).map((status) => (
                  <button
                    key={status}
                    onClick={() => setFilterStatus(status)}
                    className={`
                      px-4 py-2 text-sm font-medium capitalize transition-colors
                      ${filterStatus === status
                        ? 'bg-text-primary text-text-inverse'
                        : 'bg-bg-card text-text-secondary hover:bg-bg-muted'
                      }
                    `}
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>

            {/* View Toggle */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-text-muted whitespace-nowrap">View:</span>
              <div className="flex rounded-lg border border-border-light overflow-hidden">
                <button
                  onClick={() => handleViewModeChange('grid')}
                  className={`p-2 transition-colors ${viewMode === 'grid' ? 'bg-text-primary text-text-inverse' : 'bg-bg-card text-text-secondary hover:bg-bg-muted'}`}
                  title="Grid view"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                  </svg>
                </button>
                <button
                  onClick={() => handleViewModeChange('list')}
                  className={`p-2 transition-colors ${viewMode === 'list' ? 'bg-text-primary text-text-inverse' : 'bg-bg-card text-text-secondary hover:bg-bg-muted'}`}
                  title="List view"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Loading State */}
        {isLoading ? (
          <div className="flex justify-center items-center py-20">
            <LoadingSpinner size="lg" />
          </div>
        ) : filteredDevices.length === 0 ? (
          /* Empty State */
          <EmptyState
            hasDevices={Boolean(devices.length)}
            onAddDevice={() => navigate('/settings#device-connection')}
          />
        ) : viewMode === 'grid' ? (
          /* Grid View */
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredDevices.map((device) => (
              <DeviceCard
                key={device.id}
                device={device}
                onClick={() => navigate(`/devices/${device.id}`)}
              />
            ))}
          </div>
        ) : (
          /* List View */
          <div className="bg-bg-card rounded-xl shadow-theme-sm border border-border-light overflow-hidden">
            <div className="divide-y divide-border-light">
              {filteredDevices.map((device) => (
                <DeviceListItem
                  key={device.id}
                  device={device}
                  onClick={() => navigate(`/devices/${device.id}`)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Loading more indicator */}
        {isLoadingMore && (
          <div className="py-4 text-center">
            <div className="inline-flex items-center gap-2 text-text-muted">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-accent" />
              <span className="text-sm">Loading more devices...</span>
            </div>
          </div>
        )}

        {/* End of list indicator */}
        {!hasMore && devices.length > 0 && (
          <div className="py-4 text-center text-text-muted text-sm">
            Showing all {total} devices
          </div>
        )}

        {/* Sentinel element for infinite scroll */}
        <div ref={sentinelRef} />
      </div>
    </MainLayout>
  );
}

/**
 * Stats card component with hardcoded bright colors (theme-independent)
 */
interface StatsCardProps {
  label: string;
  value: number;
  type: 'total' | 'online' | 'offline';
}

// Hardcoded stats colors (bright/vivid, theme-independent)
const STATS_COLORS = {
  total: {
    bg: '#E0E7FF',      // Indigo-100
    text: '#4338CA',    // Indigo-700
    border: '#A5B4FC',  // Indigo-300
    label: '#6366F1',   // Indigo-500
  },
  online: {
    bg: '#DCFCE7',      // Green-100
    text: '#16A34A',    // Green-600
    border: '#86EFAC',  // Green-300
    label: '#22C55E',   // Green-500
  },
  offline: {
    bg: '#FEE2E2',      // Red-100
    text: '#DC2626',    // Red-600
    border: '#FCA5A5',  // Red-300
    label: '#EF4444',   // Red-500
  },
};

function StatsCard({ label, value, type }: StatsCardProps) {
  const colors = STATS_COLORS[type];

  return (
    <div
      className="rounded-xl p-5 border"
      style={{
        backgroundColor: colors.bg,
        borderColor: colors.border,
      }}
    >
      <p className="text-sm font-medium" style={{ color: colors.label }}>{label}</p>
      <p className="text-3xl font-bold" style={{ color: colors.text }}>{value}</p>
    </div>
  );
}

/**
 * Device card component for grid view
 */
interface DeviceCardProps {
  device: Device;
  onClick: () => void;
}

function DeviceCard({ device, onClick }: DeviceCardProps) {
  const isOnline = device.status === 'online';

  return (
    <div
      onClick={onClick}
      className={`
        bg-bg-card rounded-xl shadow-theme-sm border transition-all duration-200 cursor-pointer
        hover:shadow-theme-lg hover:-translate-y-1
        ${isOnline ? 'border-status-success-border' : 'border-border-light'}
      `}
    >
      {/* Card Header */}
      <div className="px-5 py-4 border-b border-border-light">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-text-primary truncate">
              {device.name}
            </h3>
            <p className="text-sm text-text-muted font-mono mt-0.5">
              {device.friendlyId || device.macAddress}
            </p>
          </div>
          <OnlineStatus status={device.status} lastSeen={device.lastSeenAt} size="sm" />
        </div>
      </div>

      {/* Card Body */}
      <div className="px-5 py-4 space-y-3">
        <div className="flex items-center gap-3">
          <BatteryIndicator level={device.battery} size="sm" showPercentage={true} />
          <WifiIndicator signal={device.wifi} size="sm" showValue={false} />
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className="text-text-muted">Last seen</span>
          <span className="text-text-secondary font-medium">{formatRelativeTime(device.lastSeenAt)}</span>
        </div>

        {device.firmwareVersion && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-text-muted">Firmware</span>
            <span className="text-text-secondary font-mono text-xs bg-bg-muted px-2 py-0.5 rounded">
              v{device.firmwareVersion}
            </span>
          </div>
        )}

        {device.playlist && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-text-muted">Playlist</span>
            <span className="text-accent font-medium truncate max-w-[150px]">{device.playlist.name}</span>
          </div>
        )}
      </div>

      {/* Card Footer */}
      <div className="px-5 py-3 bg-bg-muted rounded-b-xl border-t border-border-light">
        <div className="flex items-center justify-between">
          <span className="text-xs text-text-muted">Click to view details</span>
          <svg className="w-4 h-4 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>
    </div>
  );
}

/**
 * Device list item component for list view
 */
function DeviceListItem({ device, onClick }: DeviceCardProps) {
  return (
    <div
      onClick={onClick}
      className="flex items-center gap-4 px-6 py-4 hover:bg-bg-muted cursor-pointer transition-colors"
    >
      <OnlineStatus status={device.status} lastSeen={device.lastSeenAt} showLabel={false} size="md" />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3">
          <h3 className="text-base font-semibold text-text-primary truncate">{device.name}</h3>
          <span className="text-xs text-text-muted font-mono">{device.friendlyId || device.macAddress}</span>
        </div>
        <div className="flex items-center gap-4 mt-1">
          <span className="text-sm text-text-muted">Last seen {formatRelativeTime(device.lastSeenAt)}</span>
          {device.playlist && <span className="text-sm text-accent">{device.playlist.name}</span>}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <BatteryIndicator level={device.battery} size="sm" showPercentage={true} />
        <WifiIndicator signal={device.wifi} size="sm" showValue={false} />
      </div>

      <svg className="w-5 h-5 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </div>
  );
}

/**
 * Empty state component
 */
interface EmptyStateProps {
  hasDevices: boolean;
  onAddDevice: () => void;
}

function EmptyState({ hasDevices, onAddDevice }: EmptyStateProps) {
  return (
    <div className="bg-bg-card rounded-xl shadow-theme-sm border border-border-light py-16 px-8 text-center">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-bg-muted text-text-muted mb-4">
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-text-primary mb-2">
        {hasDevices ? 'No devices match your filters' : 'No devices yet'}
      </h3>
      <p className="text-text-muted mb-6 max-w-sm mx-auto">
        {hasDevices
          ? 'Try adjusting your search or filter criteria.'
          : 'Connect your first TRMNL device to get started managing your e-ink displays.'}
      </p>
      {!hasDevices && (
        <Button onClick={onAddDevice}>
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Connect Your First Device
        </Button>
      )}
    </div>
  );
}

/**
 * Format relative time for display
 */
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));

  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString();
}
