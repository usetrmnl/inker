import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MainLayout } from '../../components/layout';
import {
  Button,
  LoadingSpinner,
  Modal,
  BatteryIndicator,
  WifiIndicator,
  OnlineStatus,
} from '../../components/common';
import { OnlineStatusBadge } from '../../components/common/OnlineStatus';
import { useApi, useMutation } from '../../hooks/useApi';
import { deviceService } from '../../services/api';
import { config } from '../../config';
import type { Device } from '../../types';

// Auto-refresh interval in milliseconds (30 seconds)
const AUTO_REFRESH_INTERVAL = 30 * 1000;

interface DeviceLog {
  id: number;
  deviceId: number;
  level: string;
  message: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

/**
 * Device detail page with monochrome theme
 * Uses CSS variables for easy theme customization
 */
export function DeviceDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showLogsModal, setShowLogsModal] = useState(false);
  const [screenPreviewKey, setScreenPreviewKey] = useState(() => Date.now());

  // Logs state
  const [logs, setLogs] = useState<DeviceLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsError, setLogsError] = useState<string | null>(null);

  const { data: device, isLoading, error, refetch } = useApi<Device>(
    () => deviceService.getById(id!)
  );

  // Auto-refresh device data to keep online status current
  useEffect(() => {
    const interval = setInterval(() => {
      refetch();
    }, AUTO_REFRESH_INTERVAL);

    return () => clearInterval(interval);
  }, [refetch]);

  // Fetch logs when modal opens
  /* eslint-disable react-hooks/set-state-in-effect -- Valid pattern for conditional data fetching on modal open */
  useEffect(() => {
    if (showLogsModal && id) {
      setLogsLoading(true);
      setLogsError(null);
      deviceService.getLogs(id)
        .then((data) => {
          setLogs(data);
        })
        .catch((err) => {
          setLogsError(err instanceof Error ? err.message : 'Failed to load logs');
        })
        .finally(() => {
          setLogsLoading(false);
        });
    }
  }, [showLogsModal, id]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const { mutate: deleteDevice, isLoading: isDeleting } = useMutation(
    () => deviceService.delete(id!),
    {
      successMessage: 'Device deleted successfully',
      onSuccess: () => navigate('/devices'),
    }
  );

  // Device refresh functionality available but not currently exposed in UI
  useMutation(
    () => deviceService.refresh(id!),
    {
      successMessage: 'Device refresh triggered - screen will update on next poll',
    }
  );

  const { mutate: unassignPlaylist, isLoading: isUnassigning } = useMutation(
    () => deviceService.unassignPlaylist(id!),
    {
      successMessage: 'Playlist unassigned - device will display "Hello World" default screen',
      onSuccess: () => window.location.reload(),
    }
  );

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex flex-col justify-center items-center min-h-[400px] gap-4">
          <LoadingSpinner size="lg" />
          <p className="text-text-muted">Loading device details...</p>
        </div>
      </MainLayout>
    );
  }

  if (error || !device) {
    return (
      <MainLayout>
        <div className="bg-bg-card rounded-xl shadow-theme-sm border border-border-light py-16 px-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-status-error-bg text-status-error-text mb-4">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-text-primary mb-2">Device not found</h3>
          <p className="text-text-muted mb-6">
            The device you're looking for doesn't exist or has been removed.
          </p>
          <Button onClick={() => navigate('/devices')}>
            Back to Devices
          </Button>
        </div>
      </MainLayout>
    );
  }

  const handleDelete = async () => {
    await deleteDevice();
  };


  const isOnline = device.status === 'online';

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Breadcrumb Navigation */}
        <nav className="flex items-center gap-2 text-sm">
          <button
            onClick={() => navigate('/devices')}
            className="text-text-muted hover:text-accent transition-colors flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Devices
          </button>
          <span className="text-text-muted">/</span>
          <span className="text-text-primary font-medium">{device.name}</span>
        </nav>

        {/* Header Section */}
        <div
          className={`
            bg-gradient-to-r rounded-2xl shadow-theme-lg p-6 lg:p-8
            ${isOnline
              ? 'from-status-success-text to-[#2d5a40]'
              : 'from-text-secondary to-text-primary'
            }
          `}
        >
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            {/* Device Info */}
            <div className="flex items-start gap-5">
              {/* Device Icon */}
              <div className="hidden sm:flex items-center justify-center w-16 h-16 rounded-xl bg-white/20 backdrop-blur-sm">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>

              <div>
                <h1 className="text-2xl lg:text-3xl font-bold text-white mb-2">
                  {device.name}
                </h1>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-white/80 font-mono text-sm bg-white/10 px-3 py-1 rounded-lg">
                    {device.friendlyId || device.macAddress}
                  </span>
                  <OnlineStatusBadge
                    status={device.status}
                    lastSeen={device.lastSeenAt}
                    className="!bg-white/20 !border-white/30"
                  />
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => navigate(`/devices/${id}/edit`)}
                className="inline-flex items-center px-4 py-2 rounded-lg font-medium transition-all"
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.2)',
                  color: '#FFFFFF',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.3)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.2)'}
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Edit Device
              </button>
              <button
                onClick={() => setShowLogsModal(true)}
                className="inline-flex items-center px-4 py-2 rounded-lg font-medium transition-all"
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.2)',
                  color: '#FFFFFF',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.3)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.2)'}
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                View Logs
              </button>
              <button
                onClick={() => setShowDeleteModal(true)}
                className="inline-flex items-center px-4 py-2 rounded-lg font-medium transition-all"
                style={{
                  backgroundColor: '#DC2626',
                  color: '#FFFFFF',
                  border: '1px solid #FCA5A5',
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#B91C1C'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#DC2626'}
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Delete
              </button>
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Device Status */}
          <div className="lg:col-span-2 space-y-6">
            {/* Status Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <StatusCard
                label="Status"
                value={
                  <OnlineStatus
                    status={device.status}
                    lastSeen={device.lastSeenAt}
                    size="md"
                  />
                }
                icon={
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                }
                color={isOnline ? 'success' : 'muted'}
              />
              <StatusCard
                label="Battery"
                value={
                  <BatteryIndicator
                    level={device.battery}
                    size="md"
                    showPercentage={true}
                  />
                }
                icon={
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                }
                color="warning"
              />
              <StatusCard
                label="WiFi Signal"
                value={
                  <WifiIndicator
                    signal={device.wifi}
                    size="md"
                    showValue={true}
                  />
                }
                icon={
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
                  </svg>
                }
                color="accent"
              />
            </div>

            {/* Device Information Card */}
            <div className="bg-bg-card rounded-xl shadow-theme-sm border border-border-light overflow-hidden">
              <div className="px-6 py-4 border-b border-border-light bg-bg-muted">
                <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
                  <svg className="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Device Information
                </h2>
              </div>
              <div className="p-6">
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <InfoItem label="Device Name" value={device.name} />
                  <InfoItem
                    label="MAC Address"
                    value={device.macAddress}
                    mono
                  />
                  {device.friendlyId && (
                    <InfoItem
                      label="Friendly ID"
                      value={device.friendlyId}
                      mono
                    />
                  )}
                  <InfoItem
                    label="Last Seen"
                    value={new Date(device.lastSeenAt).toLocaleString()}
                  />
                  {device.firmwareVersion && (
                    <InfoItem
                      label="Firmware Version"
                      value={`v${device.firmwareVersion}`}
                      mono
                      badge
                    />
                  )}
                  <InfoItem
                    label="Created"
                    value={new Date(device.createdAt).toLocaleString()}
                  />
                  {device.model && (
                    <>
                      <InfoItem label="Model" value={device.model.name} />
                      <InfoItem
                        label="Screen Size"
                        value={`${device.model.width} x ${device.model.height}px`}
                        mono
                      />
                    </>
                  )}
                </dl>
              </div>
            </div>

          </div>

          {/* Right Column - Current Screen, Playlist & API Key */}
          <div className="space-y-6">
            {/* Current Screen Preview Card */}
            <div className="bg-bg-card rounded-xl shadow-theme-sm border border-border-light overflow-hidden">
              <div className="px-6 py-4 border-b border-border-light bg-bg-muted flex items-center justify-between">
                <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
                  <svg className="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  Current Screen
                </h2>
                <button
                  onClick={() => setScreenPreviewKey(Date.now())}
                  className="p-1.5 text-text-muted hover:text-accent hover:bg-accent-light rounded-lg transition-colors"
                  title="Refresh preview"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              </div>
              <div className="p-4">
                <div className="bg-bg-muted rounded-lg overflow-hidden">
                  <img
                    key={screenPreviewKey}
                    src={`${config.backendUrl}/api/device-images/device/${id}?t=${screenPreviewKey}`}
                    alt="Current device screen"
                    className="w-full h-auto"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </div>
                <p className="text-xs text-text-muted mt-2 text-center">
                  Preview of what this device is currently displaying
                </p>
              </div>
            </div>

            {/* Current Playlist Card */}
            <div className="bg-bg-card rounded-xl shadow-theme-sm border border-border-light overflow-hidden">
              <div className="px-6 py-4 border-b border-border-light bg-bg-muted">
                <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
                  <svg className="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                  </svg>
                  Current Playlist
                </h2>
              </div>
              <div className="p-6">
                {device.playlist ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-accent to-accent-hover flex items-center justify-center">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div>
                        <p className="font-medium text-text-primary">{device.playlist.name}</p>
                        <p className="text-sm text-text-muted">Active playlist</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => navigate(`/playlists/${device.playlistId}`)}
                        className="flex-1 inline-flex items-center justify-center px-3 py-1.5 text-sm font-medium rounded-lg transition-all"
                        style={{
                          backgroundColor: 'transparent',
                          color: '#16A34A',
                          border: '1px solid rgba(22, 163, 74, 0.3)',
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#DCFCE7'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        View Playlist
                      </button>
                      <button
                        onClick={() => unassignPlaylist()}
                        disabled={isUnassigning}
                        className="flex-1 inline-flex items-center justify-center px-3 py-1.5 text-sm font-medium rounded-lg transition-all disabled:opacity-50"
                        style={{
                          backgroundColor: 'transparent',
                          color: '#DC2626',
                          border: '1px solid #FCA5A5',
                        }}
                        onMouseEnter={(e) => { if (!isUnassigning) e.currentTarget.style.backgroundColor = '#FEE2E2'; }}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        {isUnassigning ? 'Unassigning...' : 'Unassign'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <div className="w-12 h-12 mx-auto rounded-full bg-bg-muted flex items-center justify-center mb-3">
                      <svg className="w-6 h-6 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                      </svg>
                    </div>
                    <p className="text-sm text-text-muted mb-3">No playlist assigned</p>
                    <button
                      onClick={() => navigate('/playlists')}
                      className="inline-flex items-center justify-center px-3 py-1.5 text-sm font-medium rounded-lg transition-all"
                      style={{
                        backgroundColor: 'transparent',
                        color: '#16A34A',
                        border: '1px solid rgba(22, 163, 74, 0.3)',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#DCFCE7'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      Assign Playlist
                    </button>
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Delete Device"
        footer={
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => setShowDeleteModal(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleDelete}
              isLoading={isDeleting}
              className="flex-1"
            >
              Delete Device
            </Button>
          </div>
        }
      >
        <div className="text-center py-4">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-status-error-bg text-status-error-text mb-4">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-text-primary mb-2">
            Are you sure?
          </h3>
          <p className="text-text-muted">
            You are about to delete <strong className="text-text-primary">{device.name}</strong>.
            This action cannot be undone.
          </p>
        </div>
      </Modal>

      {/* Device Logs Modal */}
      <Modal
        isOpen={showLogsModal}
        onClose={() => setShowLogsModal(false)}
        title="Device Logs"
        size="lg"
      >
        <div className="max-h-[60vh] overflow-y-auto">
          {logsLoading ? (
            <div className="flex flex-col justify-center items-center py-12 gap-4">
              <LoadingSpinner size="md" />
              <p className="text-text-muted">Loading logs...</p>
            </div>
          ) : logsError ? (
            <div className="text-center py-8">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-status-error-bg text-status-error-text mb-3">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <p className="text-status-error-text font-medium">{logsError}</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-bg-muted text-text-muted mb-4">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-text-primary mb-2">No logs yet</h3>
              <p className="text-text-muted text-sm">
                Device logs will appear here once the device starts sending data.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {logs.map((log) => (
                <LogEntry key={log.id} log={log} />
              ))}
            </div>
          )}
        </div>
      </Modal>
    </MainLayout>
  );
}

/**
 * Status card component for displaying key metrics
 * Uses hardcoded bright colors (theme-independent)
 */
interface StatusCardProps {
  label: string;
  value: React.ReactNode;
  icon: React.ReactNode;
  color: 'success' | 'warning' | 'accent' | 'muted';
}

// Hardcoded status card colors (bright/vivid, theme-independent)
const STATUS_CARD_COLORS = {
  success: {
    bg: '#DCFCE7',      // Green-100
    border: '#86EFAC',  // Green-300
    text: '#16A34A',    // Green-600
  },
  warning: {
    bg: '#FEF3C7',      // Amber-100
    border: '#FCD34D',  // Amber-300
    text: '#D97706',    // Amber-600
  },
  accent: {
    bg: '#DBEAFE',      // Blue-100
    border: '#93C5FD',  // Blue-300
    text: '#2563EB',    // Blue-600
  },
  muted: {
    bg: '#F3F4F6',      // Gray-100
    border: '#E5E7EB',  // Gray-200
    text: '#6B7280',    // Gray-500
  },
};

function StatusCard({ label, value, icon, color }: StatusCardProps) {
  const colors = STATUS_CARD_COLORS[color];

  return (
    <div
      className="rounded-xl border p-4"
      style={{
        backgroundColor: colors.bg,
        borderColor: colors.border,
        color: colors.text,
      }}
    >
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-sm font-medium">{label}</span>
      </div>
      <div className="mt-1">{value}</div>
    </div>
  );
}

/**
 * Information item component for device details
 */
interface InfoItemProps {
  label: string;
  value: string;
  mono?: boolean;
  badge?: boolean;
}

function InfoItem({ label, value, mono = false, badge = false }: InfoItemProps) {
  return (
    <div>
      <dt className="text-sm font-medium text-text-muted mb-1">{label}</dt>
      <dd className={`${mono ? 'font-mono' : ''} ${badge ? 'inline-block bg-bg-muted px-2 py-0.5 rounded text-sm' : 'text-text-primary'}`}>
        {value}
      </dd>
    </div>
  );
}

/**
 * Log entry component for displaying individual log items
 */
interface LogEntryProps {
  log: DeviceLog;
}

function LogEntry({ log }: LogEntryProps) {
  const [expanded, setExpanded] = useState(false);

  const levelColors: Record<string, string> = {
    error: 'bg-status-error-bg text-status-error-text border-status-error-border',
    warn: 'bg-status-warning-bg text-status-warning-text border-status-warning-border',
    warning: 'bg-status-warning-bg text-status-warning-text border-status-warning-border',
    info: 'bg-status-info-bg text-status-info-text border-status-info-border',
    debug: 'bg-bg-muted text-text-secondary border-border-light',
  };

  const levelColor = levelColors[log.level.toLowerCase()] || levelColors.info;
  const hasMetadata = log.metadata && Object.keys(log.metadata).length > 0;

  return (
    <div className="border border-border-light rounded-lg overflow-hidden">
      <div
        className={`flex items-start gap-3 p-3 ${hasMetadata ? 'cursor-pointer hover:bg-bg-muted' : ''}`}
        onClick={() => hasMetadata && setExpanded(!expanded)}
      >
        {/* Level Badge */}
        <span className={`px-2 py-0.5 text-xs font-medium rounded border ${levelColor} uppercase shrink-0`}>
          {log.level}
        </span>

        {/* Message and Time */}
        <div className="flex-1 min-w-0">
          <p className="text-sm text-text-primary break-words">{log.message}</p>
          <p className="text-xs text-text-muted mt-1">
            {new Date(log.createdAt).toLocaleString()}
          </p>
        </div>

        {/* Expand indicator */}
        {hasMetadata && (
          <svg
            className={`w-4 h-4 text-text-muted transition-transform ${expanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </div>

      {/* Metadata (expanded) */}
      {expanded && hasMetadata && (
        <div className="border-t border-border-light bg-bg-muted p-3">
          <p className="text-xs font-medium text-text-muted mb-2">Metadata</p>
          <pre className="text-xs text-text-secondary bg-bg-card p-2 rounded border border-border-light overflow-x-auto">
            {JSON.stringify(log.metadata, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
