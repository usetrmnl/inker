import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MainLayout } from '../../components/layout';
import { Button, Card, Modal, Select } from '../../components/common';
import { useApi, useMutation } from '../../hooks/useApi';
import { playlistService, deviceService } from '../../services/api';
import { config } from '../../config';
import type { Playlist, Device } from '../../types';

/**
 * PlaylistDetail page component
 */
export function PlaylistDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [showForceDeleteOption, setShowForceDeleteOption] = useState(false);

  const { data: playlist, isLoading, refetch } = useApi<Playlist>(
    () => playlistService.getById(id!)
  );

  const { data: devicesData } = useApi<{ items: Device[]; total: number }>(
    () => deviceService.getAll(1, 100)
  );

  const { mutate: deletePlaylist, isLoading: isDeleting } = useMutation(
    (force: boolean) => playlistService.delete(id!, force),
    {
      successMessage: 'Playlist deleted successfully',
      onSuccess: () => navigate('/playlists'),
      onError: (error) => {
        if (error.includes('assigned to') && error.includes('device')) {
          setDeleteError(error);
          setShowForceDeleteOption(true);
        } else {
          setDeleteError(error);
        }
      },
    }
  );

  const { mutate: toggleActive, isLoading: isToggling } = useMutation(
    () => playlistService.update(id!, { isActive: !playlist?.isActive }),
    {
      successMessage: playlist?.isActive ? 'Playlist deactivated' : 'Playlist activated',
      onSuccess: () => refetch(),
    }
  );

  const hasDevices = playlist?.devices && playlist.devices.length > 0;
  const canDeactivate = !hasDevices;

  const { mutate: assignToDevice, isLoading: isAssigning } = useMutation(
    () => deviceService.assignPlaylist(selectedDeviceId, id!),
    {
      successMessage: 'Playlist assigned to device successfully',
      onSuccess: () => {
        setShowAssignModal(false);
        setSelectedDeviceId('');
        refetch();
      },
    }
  );

  const { mutate: unassignDevice, isLoading: isUnassigning } = useMutation(
    (deviceId: string) => deviceService.unassignPlaylist(deviceId),
    {
      successMessage: 'Device unassigned from playlist',
      onSuccess: () => {
        refetch();
      },
    }
  );

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex flex-col justify-center items-center min-h-[400px] gap-4">
          <div className="relative">
            <div className="w-16 h-16 rounded-full border-4 border-border-light border-t-accent animate-spin" />
          </div>
          <p className="text-text-muted animate-pulse">Loading playlist details...</p>
        </div>
      </MainLayout>
    );
  }

  if (!playlist) {
    return (
      <MainLayout>
        <div className="text-center py-16">
          <div className="mx-auto w-20 h-20 bg-status-error-bg rounded-2xl flex items-center justify-center mb-6">
            <svg className="w-10 h-10 text-status-error-text" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-text-primary mb-2">Playlist not found</h2>
          <p className="text-text-muted mb-6">The playlist you're looking for doesn't exist or has been deleted.</p>
          <Button
            variant="outline"
            onClick={() => navigate('/playlists')}
            className="border-accent text-accent hover:bg-accent-light"
          >
            Back to Playlists
          </Button>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-8">
        {/* Back Navigation */}
        <button
          onClick={() => navigate('/playlists')}
          className="group flex items-center gap-2 text-text-secondary hover:text-accent transition-colors"
        >
          <span className="p-1.5 rounded-lg bg-bg-muted group-hover:bg-accent-light transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </span>
          <span className="text-sm font-medium">Back to Playlists</span>
        </button>

        {/* Header Section */}
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="p-4 rounded-2xl" style={{ backgroundColor: '#FEF3C7' }}>
              <svg className="w-8 h-8" style={{ color: '#D97706' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl font-bold text-text-primary">{playlist.name}</h1>
                <button
                  onClick={() => {
                    if (playlist.isActive && !canDeactivate) return;
                    toggleActive();
                  }}
                  disabled={isToggling || (playlist.isActive && !canDeactivate)}
                  className={`px-3 py-1.5 rounded-full text-sm font-semibold transition-all ${
                    playlist.isActive && !canDeactivate ? 'cursor-not-allowed' : 'hover:scale-105 cursor-pointer'
                  } disabled:opacity-50`}
                  style={playlist.isActive ? {
                    backgroundColor: '#DCFCE7',
                    color: '#16A34A',
                    boxShadow: 'inset 0 0 0 1px #86EFAC',
                  } : {
                    backgroundColor: '#F3F4F6',
                    color: '#6B7280',
                    boxShadow: 'inset 0 0 0 1px #E5E7EB',
                  }}
                  title={
                    playlist.isActive && !canDeactivate
                      ? 'Cannot deactivate - devices are assigned to this playlist'
                      : playlist.isActive
                        ? 'Click to deactivate'
                        : 'Click to activate'
                  }
                >
                  {isToggling ? '...' : playlist.isActive ? 'Active' : 'Inactive'}
                </button>
              </div>
              {playlist.description && (
                <p className="text-text-secondary max-w-2xl">{playlist.description}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(`/playlists/${id}/edit`)}
              className="inline-flex items-center px-4 py-2 rounded-lg font-medium transition-all"
              style={{
                backgroundColor: 'transparent',
                color: '#D97706',
                border: '1px solid #FCD34D',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#FEF3C7';
                e.currentTarget.style.borderColor = '#D97706';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.borderColor = '#FCD34D';
              }}
            >
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Edit
              </span>
            </button>
            <button
              onClick={() => setShowDeleteModal(true)}
              className="inline-flex items-center px-4 py-2 rounded-lg font-medium transition-all"
              style={{
                backgroundColor: '#FEE2E2',
                color: '#DC2626',
                border: '1px solid #FCA5A5',
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#FECACA'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#FEE2E2'}
            >
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Delete
              </span>
            </button>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Screens List */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="border border-border-light">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-accent-light rounded-xl">
                    <svg className="w-5 h-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-text-primary">Screens in Playlist</h2>
                    <p className="text-sm text-text-muted">{playlist.screens?.length || 0} screens</p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/playlists/${id}/edit`)}
                  className="border-accent text-accent hover:bg-accent-light"
                >
                  <span className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add Screens
                  </span>
                </Button>
              </div>

              {!playlist.screens || playlist.screens.length === 0 ? (
                <div className="text-center py-12 bg-bg-muted rounded-xl border-2 border-dashed border-border-light">
                  <div className="mx-auto w-16 h-16 bg-accent-light rounded-2xl flex items-center justify-center mb-4">
                    <svg className="w-8 h-8 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <h3 className="text-text-primary font-medium mb-1">No screens added</h3>
                  <p className="text-text-muted text-sm mb-4">Add screens to this playlist to display on your devices.</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`/playlists/${id}/edit`)}
                    className="border-accent text-accent hover:bg-accent-light"
                  >
                    Add Screens
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {playlist.screens.map((screen, index) => (
                    <div
                      key={screen.id}
                      className="group flex items-center gap-4 p-4 rounded-xl bg-bg-muted border border-border-light hover:border-accent hover:shadow-lg hover:shadow-accent-light/50 transition-all cursor-pointer"
                      onClick={() => {
                        const screenId = String(screen.id);
                        if (screenId.startsWith('design-')) {
                          navigate(`/screens/designer/${screenId.replace('design-', '')}?from=/playlists/${id}`);
                        } else {
                          navigate(`/screens/${screen.id}?from=/playlists/${id}`);
                        }
                      }}
                    >
                      <div className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-lg bg-accent-light text-accent font-semibold text-sm">
                        {index + 1}
                      </div>
                      <div className="flex-shrink-0 w-20 h-14 rounded-lg overflow-hidden bg-border-light shadow-inner">
                        {screen.thumbnailUrl ? (
                          <img
                            src={screen.thumbnailUrl.startsWith('/') ? `${config.backendUrl}${screen.thumbnailUrl}` : screen.thumbnailUrl}
                            alt={screen.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <svg className="w-6 h-6 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-text-primary group-hover:text-accent transition-colors truncate">
                          {screen.name}
                        </h4>
                        {screen.description && (
                          <p className="text-sm text-text-muted truncate">{screen.description}</p>
                        )}
                      </div>
                      <div className="flex-shrink-0 p-1.5 rounded-lg bg-accent-light text-accent opacity-0 group-hover:opacity-100 transition-opacity">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* Details Sidebar */}
          <div className="space-y-6">
            {/* Playlist Details Card */}
            <Card className="border border-border-light">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-xl" style={{ backgroundColor: '#FEF3C7' }}>
                  <svg className="w-5 h-5" style={{ color: '#D97706' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h2 className="text-lg font-semibold text-text-primary">Playlist Details</h2>
              </div>
              <dl className="space-y-5">
                <div className="group">
                  <dt className="text-sm font-medium text-text-muted mb-1.5 flex items-center gap-2">
                    <svg className="w-4 h-4 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
                    </svg>
                    Description
                  </dt>
                  <dd className="text-text-primary pl-6">
                    {playlist.description || (
                      <span className="text-text-placeholder italic">No description provided</span>
                    )}
                  </dd>
                </div>
                <div className="h-px bg-gradient-to-r from-transparent via-border-light to-transparent" />
                <div className="group">
                  <dt className="text-sm font-medium text-text-muted mb-1.5 flex items-center gap-2">
                    <svg className="w-4 h-4 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Status
                  </dt>
                  <dd className="pl-6">
                    <button
                      onClick={() => {
                        if (playlist.isActive && !canDeactivate) return;
                        toggleActive();
                      }}
                      disabled={isToggling || (playlist.isActive && !canDeactivate)}
                      className={`inline-flex px-3 py-1 rounded-full text-sm font-medium transition-all ${
                        playlist.isActive && !canDeactivate ? 'cursor-not-allowed' : 'hover:scale-105 cursor-pointer'
                      } disabled:opacity-50`}
                      style={playlist.isActive ? {
                        backgroundColor: '#DCFCE7',
                        color: '#16A34A',
                      } : {
                        backgroundColor: '#F3F4F6',
                        color: '#6B7280',
                      }}
                      title={
                        playlist.isActive && !canDeactivate
                          ? 'Cannot deactivate - devices are assigned'
                          : playlist.isActive
                            ? 'Click to deactivate'
                            : 'Click to activate'
                      }
                    >
                      {isToggling ? '...' : playlist.isActive ? 'Active' : 'Inactive'}
                    </button>
                  </dd>
                </div>
                <div className="h-px bg-gradient-to-r from-transparent via-border-light to-transparent" />
                <div className="group">
                  <dt className="text-sm font-medium text-text-muted mb-1.5 flex items-center gap-2">
                    <svg className="w-4 h-4 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Screens Count
                  </dt>
                  <dd className="text-text-primary pl-6">
                    {playlist.screens?.length || 0} screens
                  </dd>
                </div>
              </dl>
            </Card>

            {/* Connected Devices */}
            <Card className="border border-border-light">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-xl" style={{ backgroundColor: '#DCFCE7' }}>
                  <svg className="w-5 h-5" style={{ color: '#16A34A' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-text-primary">Connected Devices</h2>
                  <p className="text-sm text-text-muted">{playlist.devices?.length || 0} devices</p>
                </div>
              </div>

              {playlist.devices && playlist.devices.length > 0 && (
                <div className="space-y-2 mb-4">
                  {playlist.devices.map((device) => (
                    <div
                      key={device.id}
                      className="flex items-center justify-between p-3 rounded-xl bg-bg-muted hover:bg-bg-card-hover transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-bg-card rounded-lg shadow-sm">
                          <svg className="w-4 h-4 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-text-primary">{device.name}</p>
                          <p className="text-xs text-text-muted font-mono">{device.macAddress}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => unassignDevice(String(device.id))}
                        disabled={isUnassigning}
                        className="p-1.5 text-text-muted hover:text-status-error-text hover:bg-status-error-bg rounded-lg transition-colors disabled:opacity-50"
                        title="Unassign from playlist"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Assign Device Button */}
              <button
                onClick={() => setShowAssignModal(true)}
                className="w-full flex items-center justify-center gap-2 p-3 rounded-xl border-2 border-dashed border-border-light text-text-muted hover:border-accent hover:text-accent hover:bg-accent-light transition-all"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span className="font-medium">Assign Device</span>
              </button>
            </Card>

          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setDeleteError(null);
          setShowForceDeleteOption(false);
        }}
        title="Delete Playlist"
      >
        <div className="space-y-4">
          {deleteError ? (
            <>
              <div className="p-4 bg-status-warning-bg border border-status-warning-border rounded-lg">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-status-warning-text flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <div>
                    <p className="text-status-warning-text font-medium">Cannot delete playlist</p>
                    <p className="text-status-warning-text text-sm mt-1">{deleteError}</p>
                  </div>
                </div>
              </div>
              {showForceDeleteOption && (
                <div className="p-4 bg-bg-muted border border-border-light rounded-lg">
                  <p className="text-text-secondary text-sm">
                    Would you like to <strong>unassign all devices</strong> from this playlist and delete it anyway?
                    The devices will display a default "Hello World" screen until you assign a new playlist.
                  </p>
                </div>
              )}
              <div className="flex justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowDeleteModal(false);
                    setDeleteError(null);
                    setShowForceDeleteOption(false);
                  }}
                >
                  Cancel
                </Button>
                {showForceDeleteOption && (
                  <Button
                    variant="danger"
                    onClick={() => deletePlaylist(true)}
                    isLoading={isDeleting}
                  >
                    Unassign Devices & Delete
                  </Button>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="text-center py-4">
                <div className="mx-auto w-16 h-16 bg-status-error-bg rounded-full flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-status-error-text" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-text-primary mb-2">
                  Delete "{playlist.name}"?
                </h3>
                <p className="text-text-secondary">
                  This action cannot be undone. The playlist will be permanently removed.
                </p>
              </div>
              <div className="flex justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowDeleteModal(false);
                    setDeleteError(null);
                    setShowForceDeleteOption(false);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  onClick={() => deletePlaylist(false)}
                  isLoading={isDeleting}
                >
                  Delete Playlist
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>

      {/* Assign to Device Modal */}
      <Modal
        isOpen={showAssignModal}
        onClose={() => {
          setShowAssignModal(false);
          setSelectedDeviceId('');
        }}
        title="Assign Playlist to Device"
        footer={
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setShowAssignModal(false);
                setSelectedDeviceId('');
              }}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => assignToDevice()}
              isLoading={isAssigning}
              disabled={!selectedDeviceId}
              className="flex-1"
            >
              Assign Playlist
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <p className="text-text-secondary">
            Select a device to assign the playlist "{playlist.name}" to:
          </p>
          <Select
            label="Device"
            value={selectedDeviceId}
            onChange={(e) => setSelectedDeviceId(e.target.value)}
          >
            <option value="">Select a device...</option>
            {devicesData?.items?.map((device) => (
              <option key={device.id} value={String(device.id)}>
                {device.name} {device.playlist?.id === Number(id) ? '(Already assigned)' : device.playlist ? `(Has: ${device.playlist.name})` : ''}
              </option>
            ))}
          </Select>
          {devicesData?.items?.length === 0 && (
            <p className="text-sm text-status-warning-text">
              No devices available. Please add a device first.
            </p>
          )}
        </div>
      </Modal>
    </MainLayout>
  );
}
