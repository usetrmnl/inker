import { Link } from 'react-router-dom';
import { MainLayout } from '../components/layout';
import { Card, Skeleton, CardSkeleton, OnlineStatus, BatteryIndicator, WifiIndicator } from '../components/common';
import { useApi } from '../hooks/useApi';
import { dashboardService } from '../services/api';
import { config } from '../config';
import type { DashboardStats } from '../types';

/**
 * StatCard component for displaying statistics
 * Uses hardcoded bright colors (theme-independent)
 */
interface StatCardProps {
  title: string;
  value: number;
  subtitle?: string;
  icon: React.ReactNode;
  gradientFrom: string;
  gradientTo: string;
  iconBgColor: string;
  link: string;
}

function StatCard({ title, value, subtitle, icon, gradientFrom, gradientTo, iconBgColor, link }: StatCardProps) {
  return (
    <Link to={link} className="block group h-full">
      <div
        className="relative overflow-hidden rounded-2xl p-6 shadow-theme-lg transition-all duration-300 hover:shadow-theme-xl hover:scale-[1.02] h-full flex flex-col"
        style={{
          background: `linear-gradient(to bottom right, ${gradientFrom}, ${gradientTo})`,
        }}
      >
        {/* Background decoration */}
        <div className="absolute top-0 right-0 -mt-4 -mr-4 h-24 w-24 rounded-full bg-white/10" />
        <div className="absolute bottom-0 left-0 -mb-8 -ml-8 h-32 w-32 rounded-full bg-white/5" />

        <div className="relative flex items-start justify-between flex-1">
          <div className="space-y-2">
            <p className="text-sm font-medium text-white/80">{title}</p>
            <p className="text-4xl font-bold text-white">{value}</p>
            {subtitle && (
              <p className="text-sm text-white/60">{subtitle}</p>
            )}
          </div>
          <div
            className="flex h-14 w-14 items-center justify-center rounded-xl shadow-theme-md flex-shrink-0"
            style={{ backgroundColor: iconBgColor }}
          >
            {icon}
          </div>
        </div>

        {/* Hover indicator */}
        <div className="mt-4 flex items-center text-sm text-white/70 group-hover:text-white transition-colors">
          <span>View details</span>
          <svg className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>
    </Link>
  );
}

/**
 * QuickActionButton component for quick action cards
 * Uses hardcoded bright colors (theme-independent)
 */
interface QuickActionProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  link: string;
  bgColor: string;
  hoverColor: string;
}

function QuickActionButton({ title, description, icon, link, bgColor, hoverColor }: QuickActionProps) {
  return (
    <Link
      to={link}
      className="flex items-center gap-4 p-4 bg-bg-card rounded-xl border border-border-light hover:shadow-theme-md transition-all duration-200 group"
      style={{
        ['--hover-color' as string]: hoverColor,
      }}
    >
      <div
        className="flex h-12 w-12 items-center justify-center rounded-lg"
        style={{ backgroundColor: bgColor }}
      >
        {icon}
      </div>
      <div className="flex-1">
        <h3 className="font-semibold text-text-primary transition-colors" style={{ color: undefined }}>{title}</h3>
        <p className="text-sm text-text-muted">{description}</p>
      </div>
      <svg className="h-5 w-5 text-text-muted transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </Link>
  );
}

/**
 * Dashboard page with monochrome theme
 * Uses CSS variables for easy theme customization
 */
export function Dashboard() {
  const { data: stats, isLoading, error } = useApi<DashboardStats>(
    () => dashboardService.getStats(),
    {
      showErrorNotification: false,
    }
  );

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  // PIN-based auth doesn't have user info, so we use a generic greeting
  const displayName = 'there';

  if (isLoading) {
    return (
      <MainLayout>
        <div className="space-y-8">
          <div className="space-y-2">
            <Skeleton variant="text" width="280px" height="40px" />
            <Skeleton variant="text" width="400px" height="24px" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="h-44 rounded-2xl bg-bg-muted animate-pulse" />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <CardSkeleton />
            </div>
            <CardSkeleton />
          </div>
        </div>
      </MainLayout>
    );
  }

  if (error) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center max-w-md">
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-status-error-bg">
              <svg className="h-10 w-10 text-status-error-text" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-text-primary mb-2">Unable to Load Dashboard</h2>
            <p className="text-text-secondary mb-6">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent-hover transition-colors"
            >
              <svg className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Retry
            </button>
          </div>
        </div>
      </MainLayout>
    );
  }

  if (!stats) {
    return (
      <MainLayout>
        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="h-44 rounded-2xl bg-bg-muted animate-pulse" />
            ))}
          </div>
        </div>
      </MainLayout>
    );
  }

  const isUsingMockData = stats.totalDevices === 0 && stats.totalScreens === 0 && stats.totalPlaylists === 0;

  // Stat cards with hardcoded bright colors (theme-independent)
  const statCards: StatCardProps[] = [
    {
      title: 'Online Devices',
      value: stats.onlineDevices,
      subtitle: stats.totalDevices > 0 ? `${stats.totalDevices - stats.onlineDevices} offline` : undefined,
      icon: (
        <svg className="h-7 w-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      gradientFrom: '#16A34A',  // Green-600
      gradientTo: '#15803D',    // Green-700
      iconBgColor: 'rgba(34, 197, 94, 0.3)',  // Green-500/30
      link: '/devices',
    },
    {
      title: 'Total Screens',
      value: stats.totalScreens,
      icon: (
        <svg className="h-7 w-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
      gradientFrom: '#4338CA',  // Indigo-700
      gradientTo: '#3730A3',    // Indigo-800
      iconBgColor: 'rgba(255, 255, 255, 0.2)',
      link: '/screens',
    },
    {
      title: 'Total Playlists',
      value: stats.totalPlaylists,
      icon: (
        <svg className="h-7 w-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      ),
      gradientFrom: '#D97706',  // Amber-600
      gradientTo: '#B45309',    // Amber-700
      iconBgColor: 'rgba(245, 158, 11, 0.3)',  // Amber-500/30
      link: '/playlists',
    },
  ];

  // Quick actions with hardcoded bright colors (theme-independent)
  const quickActions: QuickActionProps[] = [
    {
      title: 'Add Device',
      description: 'Connect a new e-ink device',
      icon: (
        <svg className="h-6 w-6" style={{ color: '#16A34A' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
      ),
      link: '/settings#device-connection',
      bgColor: '#DCFCE7',  // Green-100
      hoverColor: '#16A34A',
    },
    {
      title: 'Create Screen',
      description: 'Design a new display screen',
      icon: (
        <svg className="h-6 w-6" style={{ color: '#4338CA' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
        </svg>
      ),
      link: '/screens',
      bgColor: '#E0E7FF',  // Indigo-100
      hoverColor: '#4338CA',
    },
    {
      title: 'Create Playlist',
      description: 'Organize your screens',
      icon: (
        <svg className="h-6 w-6" style={{ color: '#D97706' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
        </svg>
      ),
      link: '/playlists/new',
      bgColor: '#FEF3C7',  // Amber-100
      hoverColor: '#D97706',
    },
  ];

  return (
    <MainLayout>
      <div className="space-y-8">
        {/* Welcome Header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-sidebar-bg via-text-primary to-accent-hover p-8 text-white shadow-theme-lg">
          {/* Background patterns */}
          <div className="absolute inset-0 bg-grid-white/5 [mask-image:linear-gradient(0deg,transparent,rgba(255,255,255,0.4))]" />
          <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-accent/10 blur-3xl" />
          <div className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-white/5 blur-3xl" />

          <div className="relative">
            <h1 className="text-3xl font-bold">
              {getGreeting()}, {displayName}!
            </h1>
            <p className="mt-2 text-lg text-white/80">
              Welcome to your Inker dashboard. Manage your e-ink devices, screens, and playlists all in one place.
            </p>

            {/* Quick stats summary */}
            <div className="mt-6 flex flex-wrap gap-6">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                </div>
                <span className="text-sm font-medium">{stats.totalDevices} devices registered</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-status-success-dot/30">
                  <div className="h-2 w-2 rounded-full bg-status-success-dot animate-pulse" />
                </div>
                <span className="text-sm font-medium">{stats.onlineDevices} currently online</span>
              </div>
            </div>
          </div>
        </div>

        {/* Info banner when using mock data */}
        {isUsingMockData && (
          <div className="flex items-start gap-4 rounded-xl bg-status-info-bg border border-status-info-border p-5">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-accent-light">
              <svg className="h-5 w-5 text-accent" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-text-primary">
                Get started with Inker
              </h3>
              <p className="mt-1 text-sm text-text-secondary">
                Your dashboard is ready! Connect your first device, create some screens, or create a playlist to start managing your e-ink displays.
              </p>
              <div className="mt-3 flex flex-wrap gap-3">
                <Link
                  to="/settings#device-connection"
                  className="inline-flex items-center text-sm font-medium text-accent hover:text-accent-hover"
                >
                  Connect a device
                  <svg className="ml-1 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
                <Link
                  to="/screens"
                  className="inline-flex items-center text-sm font-medium text-accent hover:text-accent-hover"
                >
                  Create a screen
                  <svg className="ml-1 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {statCards.map((stat) => (
            <StatCard key={stat.title} {...stat} />
          ))}
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Activity - Takes 2 columns */}
          <div className="lg:col-span-2 space-y-6">
            {/* Recent Devices */}
            <Card>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-light">
                    <svg className="h-5 w-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <h2 className="text-lg font-semibold text-text-primary">Recent Devices</h2>
                </div>
                <Link
                  to="/devices"
                  className="inline-flex items-center text-sm font-medium text-accent hover:text-accent-hover transition-colors"
                >
                  View all
                  <svg className="ml-1 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              </div>

              {stats.recentDevices.length === 0 ? (
                <div className="text-center py-12">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-bg-muted">
                    <svg className="h-8 w-8 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <p className="text-text-secondary mb-4">No devices registered yet</p>
                  <Link
                    to="/settings#device-connection"
                    className="inline-flex items-center px-4 py-2 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent-hover transition-colors"
                  >
                    <svg className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    Connect your first device
                  </Link>
                </div>
              ) : (
                <div className="divide-y divide-border-light">
                  {stats.recentDevices.slice(0, 5).map((device) => (
                    <Link
                      key={device.id}
                      to={`/devices/${device.id}`}
                      className="flex items-center justify-between py-4 px-2 -mx-2 rounded-lg hover:bg-bg-muted/50 transition-colors group"
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className="flex h-10 w-10 items-center justify-center rounded-lg"
                          style={{
                            backgroundColor: device.status === 'online' ? '#DCFCE7' : '#F0F0F0',
                          }}
                        >
                          <svg
                            className="h-5 w-5"
                            style={{
                              color: device.status === 'online' ? '#16A34A' : '#888888',
                            }}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <div>
                          <p className="font-medium text-text-primary group-hover:text-accent transition-colors">{device.name}</p>
                          <p className="text-sm text-text-muted">{device.macAddress}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {device.wifi !== undefined && device.wifi !== null && (
                          <WifiIndicator signal={device.wifi} size="sm" />
                        )}
                        {device.battery !== undefined && device.battery !== null && (
                          <BatteryIndicator level={device.battery} size="sm" />
                        )}
                        <OnlineStatus status={device.status} size="sm" />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </Card>

            {/* Recent Screens */}
            <Card>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-bg-muted">
                    <svg className="h-5 w-5 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <h2 className="text-lg font-semibold text-text-primary">Recent Screens</h2>
                </div>
                <Link
                  to="/screens"
                  className="inline-flex items-center text-sm font-medium text-accent hover:text-accent-hover transition-colors"
                >
                  View all
                  <svg className="ml-1 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              </div>

              {stats.recentScreens.length === 0 ? (
                <div className="text-center py-12">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-bg-muted">
                    <svg className="h-8 w-8 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <p className="text-text-secondary mb-4">No screens uploaded yet</p>
                  <Link
                    to="/screens/new"
                    className="inline-flex items-center px-4 py-2 bg-text-secondary text-white text-sm font-medium rounded-lg hover:bg-text-primary transition-colors"
                  >
                    <svg className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    Upload your first screen
                  </Link>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {stats.recentScreens.slice(0, 6).map((screen) => (
                    <Link
                      key={screen.id}
                      to={`/screens/designer/${screen.id}`}
                      className="group relative rounded-xl overflow-hidden bg-bg-muted aspect-video hover:ring-2 hover:ring-accent hover:ring-offset-2 hover:ring-offset-bg-card transition-all"
                    >
                      <img
                        src={`${config.backendUrl}/api/device-images/design/${screen.id}?preview=true&t=${new Date(screen.updatedAt).getTime()}`}
                        alt={screen.name}
                        className="w-full h-full object-cover"
                      />
                      {/* Hover overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-sidebar-bg/60 via-sidebar-bg/0 to-sidebar-bg/0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="absolute bottom-0 left-0 right-0 p-3">
                          <p className="text-sm font-medium text-white truncate">{screen.name}</p>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* Quick Actions Sidebar */}
          <div className="space-y-6">
            <Card>
              <div className="flex items-center gap-3 mb-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent">
                  <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h2 className="text-lg font-semibold text-text-primary">Quick Actions</h2>
              </div>

              <div className="space-y-3">
                {quickActions.map((action) => (
                  <QuickActionButton key={action.title} {...action} />
                ))}
              </div>
            </Card>

            {/* System Status Card */}
            <Card>
              <div className="flex items-center gap-3 mb-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-status-success-bg">
                  <svg className="h-5 w-5 text-status-success-text" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h2 className="text-lg font-semibold text-text-primary">System Status</h2>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-status-success-dot animate-pulse" />
                    <span className="text-sm text-text-secondary">API Server</span>
                  </div>
                  <span className="text-sm font-medium text-status-success-text">Online</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-status-success-dot animate-pulse" />
                    <span className="text-sm text-text-secondary">Database</span>
                  </div>
                  <span className="text-sm font-medium text-status-success-text">Connected</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-status-success-dot animate-pulse" />
                    <span className="text-sm text-text-secondary">Cache</span>
                  </div>
                  <span className="text-sm font-medium text-status-success-text">Active</span>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-border-light">
                <div className="text-xs text-text-muted">
                  Last updated: {new Date().toLocaleTimeString()}
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
