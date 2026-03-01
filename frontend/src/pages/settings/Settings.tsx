import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { MainLayout } from '../../components/layout';
import { DeviceConnection } from '../../components/settings/DeviceConnection';
import { WelcomeScreenSettings } from '../../components/settings/WelcomeScreenSettings';
import { ApiSettings } from '../../components/settings/ApiSettings';

/**
 * Settings page component
 * Simplified for PIN-based auth (no user accounts)
 */
export function Settings() {
  const { hash } = useLocation();

  useEffect(() => {
    if (hash) {
      const el = document.getElementById(hash.replace('#', ''));
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }
  }, [hash]);

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

        {/* Device Connection Section */}
        <div id="device-connection" className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-status-success-bg to-bg-muted rounded-xl">
              <svg className="w-5 h-5 text-status-success-text" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-text-primary">Device Connection</h2>
          </div>
          <DeviceConnection />
        </div>
      </div>
    </MainLayout>
  );
}
