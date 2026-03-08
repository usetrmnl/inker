import { useState, useEffect, useCallback } from 'react';
import { MainLayout } from '../../components/layout';
import { DeviceConnection } from '../../components/settings/DeviceConnection';
import { WelcomeScreenSettings } from '../../components/settings/WelcomeScreenSettings';
import { ApiSettings } from '../../components/settings/ApiSettings';
import { Card } from '../../components/common';
import { settingsService } from '../../services/api';
import { useNotification } from '../../contexts/NotificationContext';

function NetworkSettings() {
  const { showNotification } = useNotification();
  const [allowLocalNetwork, setAllowLocalNetwork] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const settings = await settingsService.getAll();
        setAllowLocalNetwork(settings.allow_local_network === 'true');
      } catch {
        // ignore
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  const handleToggle = useCallback(async () => {
    const newValue = !allowLocalNetwork;
    setIsSaving(true);
    try {
      await settingsService.update('allow_local_network', String(newValue));
      setAllowLocalNetwork(newValue);
      showNotification(
        'success',
        newValue ? 'Local network access enabled' : 'Local network access disabled',
      );
    } catch {
      showNotification('error', 'Failed to update setting');
    } finally {
      setIsSaving(false);
    }
  }, [allowLocalNetwork, showNotification]);

  if (isLoading) {
    return <Card><div className="p-4 text-text-secondary">Loading...</div></Card>;
  }

  return (
    <Card>
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-text-primary">Allow local network data sources</h3>
            <p className="text-sm text-text-secondary mt-1">
              Enable data sources from private/local network IPs (e.g., HomeAssistant, n8n).
              Internal service hostnames remain blocked for security.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={allowLocalNetwork}
            disabled={isSaving}
            onClick={handleToggle}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 ${
              allowLocalNetwork ? 'bg-accent' : 'bg-gray-300'
            } ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                allowLocalNetwork ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
        {allowLocalNetwork && (
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
            <p className="text-sm text-amber-800">
              When enabled, data sources can connect to private IP ranges (10.x.x.x, 192.168.x.x, etc.)
              and domains that resolve to local addresses. Use only in trusted networks.
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}

/**
 * Settings page component
 * Simplified for PIN-based auth (no user accounts)
 */
export function Settings() {

  return (
    <MainLayout>
      <div className="space-y-8">
        {/* Page Header */}
        <div className="relative overflow-hidden rounded-2xl bg-sidebar-bg p-8 shadow-xl">
          <div className="absolute inset-0 bg-grid-white/5" />
          <div className="relative">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-white/10 rounded-xl backdrop-blur-sm">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <h1 className="text-3xl font-bold text-white">Settings</h1>
            </div>
            <p className="text-white/70 max-w-xl">
              Configure device connections and welcome screen settings.
            </p>
          </div>
          {/* Decorative elements */}
          <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-white/5 rounded-full blur-3xl" />
          <div className="absolute -top-10 -left-10 w-32 h-32 bg-accent/20 rounded-full blur-3xl" />
        </div>

        {/* Welcome Screen Section */}
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-accent-light to-bg-muted rounded-xl">
              <svg className="w-5 h-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-text-primary">Welcome Screen</h2>
          </div>
          <WelcomeScreenSettings />
        </div>

        {/* API Settings Section */}
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-purple-100 to-bg-muted rounded-xl">
              <svg className="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-text-primary">API Settings</h2>
          </div>
          <ApiSettings />
        </div>

        {/* Network Security Section */}
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-amber-100 to-bg-muted rounded-xl">
              <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-text-primary">Network Security</h2>
          </div>
          <NetworkSettings />
        </div>

        {/* Server & Troubleshooting Section */}
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-status-success-bg to-bg-muted rounded-xl">
              <svg className="w-5 h-5 text-status-success-text" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-text-primary">Server & Troubleshooting</h2>
          </div>
          <DeviceConnection />
        </div>
      </div>
    </MainLayout>
  );
}
