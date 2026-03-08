import { useState } from 'react';
import { Card, StatusBadge } from '../common';
import { useServerStatus } from '../../hooks/useServerStatus';

/**
 * DeviceConnection component displays server status
 * and troubleshooting information for device connectivity
 */
export function DeviceConnection() {
  const { status, isChecking, checkStatus } = useServerStatus();

  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId);
      } else {
        newSet.add(sectionId);
      }
      return newSet;
    });
  };

  // Build the full API URL that devices should use
  const browserPort = typeof window !== 'undefined' ? window.location.port : '';
  const deviceApiUrl = browserPort && browserPort !== '80'
    ? `http://${status.localIp}:${browserPort}`
    : `http://${status.localIp}`;

  return (
    <div className="space-y-6">
      {/* Server Status */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-text-primary">Server Status</h2>
          <button
            type="button"
            onClick={checkStatus}
            disabled={isChecking}
            className="inline-flex items-center justify-center px-3 py-1.5 text-sm font-semibold rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db' }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#e5e7eb'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#f3f4f6'; }}
          >
            {isChecking ? (
              <svg className="animate-spin h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : null}
            Refresh
          </button>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-text-muted">Status</span>
            <StatusBadge status={status.isOnline ? 'online' : 'offline'} />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-text-muted">Server IP</span>
            <code className="text-sm bg-bg-muted px-2 py-1 rounded">
              {status.localIp}
            </code>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-text-muted">Device URL</span>
            <code className="text-sm bg-bg-muted px-2 py-1 rounded">
              {deviceApiUrl}
            </code>
          </div>

          {status.lastChecked && (
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-text-muted">Last Checked</span>
              <span className="text-sm text-text-secondary">
                {status.lastChecked.toLocaleTimeString()}
              </span>
            </div>
          )}

          {status.error && !status.isOnline && (
            <div className="mt-3 p-3 bg-status-error-bg border border-status-error-border rounded-lg">
              <p className="text-sm text-status-error-text">
                <strong>Error:</strong> {status.error}
              </p>
            </div>
          )}
        </div>
      </Card>

      {/* Troubleshooting */}
      <Card>
        <h2 className="text-lg font-semibold text-text-primary mb-4">
          Troubleshooting
        </h2>

        <div className="space-y-2">
          {/* Device Can't Connect */}
          <div className="border rounded-lg overflow-hidden" style={{ borderColor: '#e5e7eb' }}>
            <button
              type="button"
              onClick={() => toggleSection('cant-connect')}
              className="w-full flex items-center justify-between p-4 text-left transition-colors"
              style={{ backgroundColor: expandedSections.has('cant-connect') ? '#f9fafb' : '#ffffff' }}
            >
              <span className="font-medium" style={{ color: '#1f2937' }}>Device can't connect to server</span>
              <svg
                className={`w-5 h-5 transition-transform ${expandedSections.has('cant-connect') ? 'rotate-180' : ''}`}
                style={{ color: '#6b7280' }}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {expandedSections.has('cant-connect') && (
              <div className="p-4 border-t" style={{ borderColor: '#e5e7eb', backgroundColor: '#f9fafb' }}>
                <div className="space-y-3 text-sm" style={{ color: '#374151' }}>
                  <ul className="list-disc ml-5 space-y-1">
                    <li>Make sure the device and this server are on the <strong>same WiFi / LAN</strong></li>
                    <li>Verify the URL entered on the device is exactly <code className="bg-bg-muted px-1 rounded">{deviceApiUrl}</code></li>
                    <li>Check that the Inker container is running: <code className="bg-bg-muted px-1 rounded">docker ps</code></li>
                    <li>If using a firewall, allow incoming connections on port <strong>80</strong></li>
                    <li>Try accessing <code className="bg-bg-muted px-1 rounded">{deviceApiUrl}</code> from your phone's browser to confirm it's reachable</li>
                  </ul>
                </div>
              </div>
            )}
          </div>

          {/* Device Stuck on Loading */}
          <div className="border rounded-lg overflow-hidden" style={{ borderColor: '#e5e7eb' }}>
            <button
              type="button"
              onClick={() => toggleSection('stuck-loading')}
              className="w-full flex items-center justify-between p-4 text-left transition-colors"
              style={{ backgroundColor: expandedSections.has('stuck-loading') ? '#f9fafb' : '#ffffff' }}
            >
              <span className="font-medium" style={{ color: '#1f2937' }}>Device stuck on loading screen</span>
              <svg
                className={`w-5 h-5 transition-transform ${expandedSections.has('stuck-loading') ? 'rotate-180' : ''}`}
                style={{ color: '#6b7280' }}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {expandedSections.has('stuck-loading') && (
              <div className="p-4 border-t" style={{ borderColor: '#e5e7eb', backgroundColor: '#f9fafb' }}>
                <div className="space-y-3 text-sm" style={{ color: '#374151' }}>
                  <ul className="list-disc ml-5 space-y-1">
                    <li>Make sure you used <code className="bg-bg-muted px-1 rounded">{deviceApiUrl}</code> (port 80, <strong>not</strong> port 3002)</li>
                    <li>Wait up to 2 minutes for the initial setup to complete</li>
                    <li>Power cycle the device (unplug and replug) if it's stuck for more than 5 minutes</li>
                    <li>Check <code className="bg-bg-muted px-1 rounded">docker logs inker</code> for errors</li>
                  </ul>
                </div>
              </div>
            )}
          </div>

          {/* Device Shows Offline */}
          <div className="border rounded-lg overflow-hidden" style={{ borderColor: '#e5e7eb' }}>
            <button
              type="button"
              onClick={() => toggleSection('shows-offline')}
              className="w-full flex items-center justify-between p-4 text-left transition-colors"
              style={{ backgroundColor: expandedSections.has('shows-offline') ? '#f9fafb' : '#ffffff' }}
            >
              <span className="font-medium" style={{ color: '#1f2937' }}>Device shows offline in dashboard</span>
              <svg
                className={`w-5 h-5 transition-transform ${expandedSections.has('shows-offline') ? 'rotate-180' : ''}`}
                style={{ color: '#6b7280' }}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {expandedSections.has('shows-offline') && (
              <div className="p-4 border-t" style={{ borderColor: '#e5e7eb', backgroundColor: '#f9fafb' }}>
                <div className="space-y-3 text-sm" style={{ color: '#374151' }}>
                  <ul className="list-disc ml-5 space-y-1">
                    <li>TRMNL devices sleep between updates to save battery. Wait for the next refresh cycle (default: 15 minutes).</li>
                    <li>Power cycle the device to force an immediate reconnection</li>
                    <li>Check that the device's WiFi signal is strong enough</li>
                    <li>You can lower the refresh interval in device settings for more frequent polling</li>
                  </ul>
                </div>
              </div>
            )}
          </div>

          {/* Screen Not Updating */}
          <div className="border rounded-lg overflow-hidden" style={{ borderColor: '#e5e7eb' }}>
            <button
              type="button"
              onClick={() => toggleSection('not-updating')}
              className="w-full flex items-center justify-between p-4 text-left transition-colors"
              style={{ backgroundColor: expandedSections.has('not-updating') ? '#f9fafb' : '#ffffff' }}
            >
              <span className="font-medium" style={{ color: '#1f2937' }}>Screen not updating on device</span>
              <svg
                className={`w-5 h-5 transition-transform ${expandedSections.has('not-updating') ? 'rotate-180' : ''}`}
                style={{ color: '#6b7280' }}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {expandedSections.has('not-updating') && (
              <div className="p-4 border-t" style={{ borderColor: '#e5e7eb', backgroundColor: '#f9fafb' }}>
                <div className="space-y-3 text-sm" style={{ color: '#374151' }}>
                  <ul className="list-disc ml-5 space-y-1">
                    <li>Make sure a <strong>playlist</strong> is assigned to the device (Devices page &rarr; edit device)</li>
                    <li>Make sure the playlist has at least one <strong>screen</strong></li>
                    <li>Click <strong>Refresh Devices</strong> on the Devices page to push an update on next poll</li>
                    <li>Check <code className="bg-bg-muted px-1 rounded">docker logs inker</code> for rendering errors</li>
                  </ul>
                </div>
              </div>
            )}
          </div>

          {/* Re-setup Device */}
          <div className="border rounded-lg overflow-hidden" style={{ borderColor: '#e5e7eb' }}>
            <button
              type="button"
              onClick={() => toggleSection('re-setup')}
              className="w-full flex items-center justify-between p-4 text-left transition-colors"
              style={{ backgroundColor: expandedSections.has('re-setup') ? '#f9fafb' : '#ffffff' }}
            >
              <span className="font-medium" style={{ color: '#1f2937' }}>How to re-setup a device</span>
              <svg
                className={`w-5 h-5 transition-transform ${expandedSections.has('re-setup') ? 'rotate-180' : ''}`}
                style={{ color: '#6b7280' }}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {expandedSections.has('re-setup') && (
              <div className="p-4 border-t" style={{ borderColor: '#e5e7eb', backgroundColor: '#f9fafb' }}>
                <div className="space-y-3 text-sm" style={{ color: '#374151' }}>
                  <p>To change the server URL or WiFi network on an already configured device:</p>
                  <ol className="list-decimal ml-5 space-y-1">
                    <li>Hold the device button for 10+ seconds to enter setup mode</li>
                    <li>The device will create its own WiFi network again</li>
                    <li>Follow the setup steps above with the new URL or WiFi credentials</li>
                  </ol>
                  <p className="mt-2 text-text-muted">
                    The device will re-register with the server. If it was previously deleted from Inker,
                    it will appear as a new device.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
