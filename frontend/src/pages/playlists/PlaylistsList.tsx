import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '../../components/layout';
import { Button, Card, Modal } from '../../components/common';
import { useMutation } from '../../hooks/useApi';
import { useInfiniteScroll } from '../../hooks';
import { playlistService } from '../../services/api';
import type { Playlist } from '../../types';

/**
 * PlaylistsList page component
 */
export function PlaylistsList() {
  const navigate = useNavigate();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [playlistToDelete, setPlaylistToDelete] = useState<Playlist | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [showForceDeleteOption, setShowForceDeleteOption] = useState(false);

  // Fetch playlists with infinite scroll
  const playlistsApi = useCallback(
    (page: number, limit: number) => playlistService.getAll(page, limit),
    []
  );
  const {
    items: playlists,
    isLoading,
    isLoadingMore,
    hasMore,
    refresh: refetch,
    sentinelRef,
    total,
  } = useInfiniteScroll<Playlist>(playlistsApi);

  const { mutate: deletePlaylist, isLoading: isDeleting } = useMutation(
    ({ id, force }: { id: number; force: boolean }) => playlistService.delete(id, force),
    {
      successMessage: 'Playlist deleted successfully',
      onSuccess: () => {
        setShowDeleteModal(false);
        setPlaylistToDelete(null);
        setDeleteError(null);
        setShowForceDeleteOption(false);
        refetch();
      },
      onError: (error) => {
        // Check if the error is about devices being assigned
        if (error.includes('assigned to') && error.includes('device')) {
          setDeleteError(error);
          setShowForceDeleteOption(true);
        } else {
          setDeleteError(error);
        }
      },
    }
  );

  const handleDeleteClick = (e: React.MouseEvent, playlist: Playlist) => {
    e.stopPropagation();
    setPlaylistToDelete(playlist);
    setDeleteError(null);
    setShowForceDeleteOption(false);
    setShowDeleteModal(true);
  };

  const confirmDelete = (force = false) => {
    if (playlistToDelete) {
      deletePlaylist({ id: Number(playlistToDelete.id), force });
    }
  };

  const closeDeleteModal = () => {
    setShowDeleteModal(false);
    setPlaylistToDelete(null);
    setDeleteError(null);
    setShowForceDeleteOption(false);
  };

  return (
    <MainLayout>
      <div className="space-y-8">
        {/* Page Header */}
        <div className="relative overflow-hidden rounded-2xl bg-accent p-8 shadow-theme-lg">
          <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="text-text-inverse">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
                <h1 className="text-3xl font-bold">Playlists</h1>
              </div>
              <p className="text-text-inverse/80 max-w-xl">
                Organize your screens into playlists for automatic rotation on your e-ink devices.
              </p>
            </div>
            <button
              onClick={() => navigate('/playlists/new')}
              className="inline-flex items-center px-4 py-2 rounded-lg font-medium shadow-lg transition-all"
              style={{
                backgroundColor: '#FFFFFF',
                color: '#D97706',
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#FEF3C7'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#FFFFFF'}
            >
              <span className="flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Create Playlist
              </span>
            </button>
          </div>
        </div>

        {/* Content Area */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <div className="w-16 h-16 rounded-full border-4 border-border-light border-t-accent animate-spin" />
            <p className="text-text-muted animate-pulse">Loading playlists...</p>
          </div>
        ) : playlists.length === 0 ? (
          /* Empty State */
          <Card className="border-2 border-dashed border-border-light bg-bg-muted">
            <div className="text-center py-16">
              <div className="mx-auto w-20 h-20 bg-accent-light rounded-2xl flex items-center justify-center mb-6 shadow-inner">
                <svg
                  className="w-10 h-10 text-accent"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-text-primary mb-2">No playlists yet</h3>
              <p className="text-text-secondary mb-8 max-w-md mx-auto">
                Create your first playlist to organize screens and set up automatic rotation on your devices.
              </p>
              <button
                onClick={() => navigate('/playlists/new')}
                className="inline-flex items-center px-4 py-2 rounded-lg font-medium transition-all text-white"
                style={{
                  backgroundColor: '#D97706',
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#B45309'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#D97706'}
              >
                <span className="flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Create Your First Playlist
                </span>
              </button>
            </div>
          </Card>
        ) : (
          /* Playlists Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {playlists.map((playlist) => (
              <Card
                key={playlist.id}
                hover
                onClick={() => navigate(`/playlists/${playlist.id}`)}
                className="group border border-border-light hover:border-accent hover:shadow-xl hover:shadow-accent-light/50 transition-all duration-300"
              >
                <div className="flex items-start justify-between mb-4">
                  <div
                    className="p-3 rounded-xl transition-colors"
                    style={{ backgroundColor: '#FEF3C7' }}
                  >
                    <svg className="w-6 h-6" style={{ color: '#D97706' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                  </div>
                  <span
                    className="px-3 py-1 rounded-full text-xs font-semibold"
                    style={playlist.isActive ? {
                      backgroundColor: '#DCFCE7',
                      color: '#16A34A',
                      boxShadow: 'inset 0 0 0 1px #86EFAC',
                    } : {
                      backgroundColor: '#F3F4F6',
                      color: '#6B7280',
                      boxShadow: 'inset 0 0 0 1px #E5E7EB',
                    }}
                  >
                    {playlist.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>

                <h3 className="text-lg font-semibold text-text-primary mb-1 group-hover:text-accent transition-colors">
                  {playlist.name}
                </h3>

                {playlist.description ? (
                  <p className="text-text-muted text-sm mb-4 line-clamp-2">
                    {playlist.description}
                  </p>
                ) : (
                  <p className="text-text-placeholder text-sm mb-4 italic">No description</p>
                )}

                <div className="pt-4 border-t border-border-light">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-text-muted">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span className="text-sm font-medium">
                        {playlist._count?.items ?? playlist.screens?.length ?? 0} {(playlist._count?.items ?? playlist.screens?.length ?? 0) === 1 ? 'screen' : 'screens'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => handleDeleteClick(e, playlist)}
                        className="p-1.5 rounded-lg bg-status-error-bg text-status-error-text opacity-0 group-hover:opacity-100 transition-opacity hover:bg-status-error-border"
                        title="Delete playlist"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                      <div className="p-1.5 rounded-lg bg-accent-light text-accent opacity-0 group-hover:opacity-100 transition-opacity">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>
                  </div>
                </div>

              </Card>
            ))}
          </div>
        )}

        {/* Loading more indicator */}
        {isLoadingMore && (
          <div className="py-4 text-center">
            <div className="inline-flex items-center gap-2 text-text-muted">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-accent" />
              <span className="text-sm">Loading more playlists...</span>
            </div>
          </div>
        )}

        {/* End of list indicator */}
        {!hasMore && playlists.length > 0 && (
          <div className="py-4 text-center text-text-muted text-sm">
            Showing all {total} playlists
          </div>
        )}

        {/* Sentinel element for infinite scroll */}
        <div ref={sentinelRef} />
      </div>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={closeDeleteModal}
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
                <Button variant="outline" onClick={closeDeleteModal}>
                  Cancel
                </Button>
                {showForceDeleteOption && (
                  <Button
                    variant="danger"
                    onClick={() => confirmDelete(true)}
                    isLoading={isDeleting}
                  >
                    Unassign Devices & Delete
                  </Button>
                )}
              </div>
            </>
          ) : (
            <>
              <p className="text-text-secondary">
                Are you sure you want to delete "{playlistToDelete?.name}"? This action cannot be undone.
              </p>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={closeDeleteModal}>
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  onClick={() => confirmDelete(false)}
                  isLoading={isDeleting}
                >
                  Delete
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </MainLayout>
  );
}
