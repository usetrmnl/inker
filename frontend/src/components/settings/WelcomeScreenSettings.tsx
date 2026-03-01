import { useState } from 'react';
import { Card, Input } from '../common';
import { EInkPreview } from './EInkPreview';
import { useNotification } from '../../contexts/NotificationContext';
import { welcomeScreenService, type WelcomeScreenConfig } from '../../services/api';

/**
 * WelcomeScreenSettings component manages default welcome screens for new devices
 */
export function WelcomeScreenSettings() {
  const notification = useNotification();

  const [config, setConfig] = useState<WelcomeScreenConfig>({
    enabled: true,
    title: 'Hello World',
    subtitle: 'This is inker!',
    autoAssignPlaylist: true,
  });

  const [isLoading, setIsLoading] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);

  /**
   * Handle form input changes
   */
  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setConfig(prev => ({ ...prev, title: e.target.value }));
  };

  const handleSubtitleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setConfig(prev => ({ ...prev, subtitle: e.target.value }));
  };

  const handleToggleAutoCreate = () => {
    setConfig(prev => ({ ...prev, enabled: !prev.enabled }));
  };

  const handleToggleAutoAssign = () => {
    setConfig(prev => ({ ...prev, autoAssignPlaylist: !prev.autoAssignPlaylist }));
  };

  /**
   * Save welcome screen configuration
   */
  const handleSave = async () => {
    setIsLoading(true);
    try {
      await welcomeScreenService.saveConfig(config);
      notification.success('Welcome screen settings saved successfully');
    } catch (error) {
      notification.error(`Failed to save settings: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Regenerate welcome screens for all existing devices
   */
  const handleRegenerateAll = async () => {
    if (!confirm('This will regenerate welcome screens for all devices. Continue?')) {
      return;
    }

    setIsRegenerating(true);
    try {
      const result = await welcomeScreenService.regenerateAll();
      notification.success(`Successfully regenerated welcome screens for ${result.count || 0} devices`);
    } catch (error) {
      notification.error(`Failed to regenerate screens: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsRegenerating(false);
    }
  };

  /**
   * Reset to default values
   */
  const handleReset = () => {
    setConfig({
      enabled: true,
      title: 'Hello World',
      subtitle: 'This is inker!',
      autoAssignPlaylist: true,
    });
    notification.info('Settings reset to defaults');
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-text-primary mb-2">
          Welcome Screen Configuration
        </h2>
        <p className="text-sm text-text-secondary">
          Configure the default welcome screen shown to newly connected TRMNL devices
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Configuration Form */}
        <Card>
          <h3 className="text-lg font-semibold text-text-primary mb-4">
            Welcome Screen Settings
          </h3>

          <div className="space-y-4">
            {/* Auto-create toggle */}
            <div className="flex items-center justify-between p-3 bg-bg-muted rounded-lg">
              <div>
                <label className="text-sm font-medium text-text-primary">
                  Auto-create welcome screen
                </label>
                <p className="text-xs text-text-muted mt-1">
                  Automatically create welcome screen when device connects
                </p>
              </div>
              <button
                type="button"
                onClick={handleToggleAutoCreate}
                className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
                style={{ backgroundColor: config.enabled ? '#22c55e' : '#d1d5db' }}
                aria-label="Toggle auto-create"
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    config.enabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Auto-assign playlist toggle */}
            <div className="flex items-center justify-between p-3 bg-bg-muted rounded-lg">
              <div>
                <label className="text-sm font-medium text-text-primary">
                  Auto-assign playlist to new devices
                </label>
                <p className="text-xs text-text-muted mt-1">
                  Automatically assign default playlist with welcome screen
                </p>
              </div>
              <button
                type="button"
                onClick={handleToggleAutoAssign}
                className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
                style={{ backgroundColor: config.autoAssignPlaylist ? '#22c55e' : '#d1d5db' }}
                aria-label="Toggle auto-assign playlist"
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    config.autoAssignPlaylist ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Title input */}
            <Input
              label="Welcome Screen Title"
              value={config.title}
              onChange={handleTitleChange}
              placeholder="Hello World"
              helperText="Main heading displayed on the welcome screen"
            />

            {/* Subtitle textarea */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">
                Welcome Screen Subtitle
              </label>
              <textarea
                value={config.subtitle}
                onChange={handleSubtitleChange}
                placeholder="This is inker!"
                rows={3}
                className="block w-full px-3 py-2 border border-border-default rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:border-accent focus:ring-accent transition-colors"
              />
              <p className="mt-1 text-sm text-text-muted">
                Subtitle or description text shown below the title
              </p>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={handleSave}
                disabled={isLoading}
                className="flex-1 inline-flex items-center justify-center px-4 py-2.5 text-sm font-semibold text-white rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: '#3b82f6' }}
                onMouseEnter={(e) => { if (!isLoading) e.currentTarget.style.backgroundColor = '#2563eb'; }}
                onMouseLeave={(e) => { if (!isLoading) e.currentTarget.style.backgroundColor = '#3b82f6'; }}
              >
                {isLoading ? (
                  <svg className="animate-spin h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                ) : null}
                Save Settings
              </button>
              <button
                type="button"
                onClick={handleReset}
                disabled={isLoading}
                className="inline-flex items-center justify-center px-4 py-2.5 text-sm font-semibold rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db' }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#e5e7eb'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#f3f4f6'; }}
              >
                Reset
              </button>
            </div>
          </div>
        </Card>

        {/* Live Preview */}
        <Card>
          <h3 className="text-lg font-semibold text-text-primary mb-4">
            Live Preview
          </h3>
          <EInkPreview
            title={config.title}
            subtitle={config.subtitle}
          />
        </Card>
      </div>

      {/* Screen Templates Section */}
      <Card>
        <h3 className="text-lg font-semibold text-text-primary mb-4">
          Default Screen Templates
        </h3>

        <div className="space-y-4">
          <p className="text-sm text-text-secondary">
            Pre-configured welcome screen templates for common e-ink display sizes
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 800x480 template */}
            <div className="rounded-lg p-4" style={{ border: '2px solid #3b82f6', backgroundColor: 'rgba(59, 130, 246, 0.1)' }}>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-semibold" style={{ color: '#1f2937' }}>
                  Standard (800×480)
                </h4>
                <span className="px-2 py-1 text-xs font-medium rounded flex items-center gap-1" style={{ backgroundColor: '#dcfce7', color: '#166534' }}>
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Current Default
                </span>
              </div>
              <p className="text-xs mb-3" style={{ color: '#6b7280' }}>
                Standard TRMNL e-ink display resolution
              </p>
              <div className="rounded p-2 mb-3" style={{ aspectRatio: '800/480', backgroundColor: '#f3f4f6' }}>
                <div className="w-full h-full flex items-center justify-center text-xs" style={{ color: '#9ca3af' }}>
                  800×480 preview
                </div>
              </div>
              <div className="text-center text-xs font-medium py-2" style={{ color: '#15803d' }}>
                Currently in use
              </div>
            </div>

            {/* 640x384 template */}
            <div className="rounded-lg p-4 transition-colors" style={{ border: '1px solid #e5e7eb' }}>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-semibold" style={{ color: '#1f2937' }}>
                  Compact (640×384)
                </h4>
              </div>
              <p className="text-xs mb-3" style={{ color: '#6b7280' }}>
                Smaller e-ink display format
              </p>
              <div className="rounded p-2 mb-3" style={{ aspectRatio: '640/384', backgroundColor: '#f3f4f6' }}>
                <div className="w-full h-full flex items-center justify-center text-xs" style={{ color: '#9ca3af' }}>
                  640×384 preview
                </div>
              </div>
              <button
                type="button"
                className="w-full inline-flex items-center justify-center px-3 py-1.5 text-sm font-semibold rounded-xl transition-all duration-200"
                style={{ backgroundColor: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db' }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#e5e7eb'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#f3f4f6'; }}
              >
                Set as Default
              </button>
            </div>
          </div>
        </div>
      </Card>

      {/* Bulk Actions Section */}
      <Card>
        <h3 className="text-lg font-semibold mb-4" style={{ color: '#1f2937' }}>
          Bulk Actions
        </h3>

        <div className="space-y-4">
          <div className="p-4 rounded-lg" style={{ backgroundColor: '#fefce8', border: '1px solid #fde047' }}>
            <h4 className="text-sm font-semibold mb-2" style={{ color: '#713f12' }}>
              Regenerate Welcome Screens
            </h4>
            <p className="text-sm mb-3" style={{ color: '#854d0e' }}>
              This will regenerate welcome screens for all devices using the current settings.
              Existing custom screens will be replaced.
            </p>
            <button
              type="button"
              onClick={handleRegenerateAll}
              disabled={isRegenerating}
              className="inline-flex items-center justify-center px-4 py-2.5 text-sm font-semibold text-white rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: '#dc2626' }}
              onMouseEnter={(e) => { if (!isRegenerating) e.currentTarget.style.backgroundColor = '#b91c1c'; }}
              onMouseLeave={(e) => { if (!isRegenerating) e.currentTarget.style.backgroundColor = '#dc2626'; }}
            >
              {isRegenerating ? (
                <svg className="animate-spin h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              ) : null}
              Regenerate All Welcome Screens
            </button>
          </div>

          <div className="p-4 rounded-lg" style={{ backgroundColor: '#eff6ff', border: '1px solid #bfdbfe' }}>
            <h4 className="text-sm font-semibold mb-2" style={{ color: '#1e3a8a' }}>
              How Welcome Screens Work
            </h4>
            <ul className="text-sm space-y-2" style={{ color: '#1e40af' }}>
              <li className="flex items-start">
                <svg className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" style={{ color: '#2563eb' }} fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                  <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                <span>When a new device connects, a welcome screen is automatically generated using your configured text</span>
              </li>
              <li className="flex items-start">
                <svg className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" style={{ color: '#2563eb' }} fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                  <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                <span>The welcome screen is added to a default playlist and assigned to the device</span>
              </li>
              <li className="flex items-start">
                <svg className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" style={{ color: '#2563eb' }} fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                  <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                <span>Devices display the welcome screen immediately instead of showing a blank screen</span>
              </li>
              <li className="flex items-start">
                <svg className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" style={{ color: '#2563eb' }} fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                  <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                <span>You can later customize the playlist or assign different screens to each device</span>
              </li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
}
