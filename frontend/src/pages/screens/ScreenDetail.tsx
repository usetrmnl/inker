import { useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { MainLayout } from '../../components/layout';
import { Button, Card, Modal } from '../../components/common';
import { useApi, useMutation } from '../../hooks/useApi';
import { screenService } from '../../services/api';
import type { Screen } from '../../types';

/**
 * ScreenDetail page component
 */
export function ScreenDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Support returning to a specific page (e.g., playlist) via 'from' query param
  const rawBack = searchParams.get('from') || '/screens';
  const backUrl = rawBack.startsWith('/') && !rawBack.startsWith('//') ? rawBack : '/screens';
  const isFromPlaylist = backUrl.startsWith('/playlists/');

  const { data: screen, isLoading } = useApi<Screen>(
    () => screenService.getById(id!)
  );

  const { mutate: deleteScreen, isLoading: isDeleting } = useMutation(
    () => screenService.delete(id!),
    {
      successMessage: 'Screen deleted successfully',
      onSuccess: () => navigate(backUrl),
    }
  );

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex flex-col justify-center items-center min-h-[400px] gap-4">
          <div className="relative">
            <div className="w-16 h-16 rounded-full border-4 border-indigo-100 border-t-indigo-600 animate-spin" />
          </div>
          <p className="text-text-muted animate-pulse">Loading screen details...</p>
        </div>
      </MainLayout>
    );
  }

  if (!screen) {
    return (
      <MainLayout>
        <div className="text-center py-16">
          <div className="mx-auto w-20 h-20 bg-gradient-to-br from-red-50 to-red-100 rounded-2xl flex items-center justify-center mb-6">
            <svg className="w-10 h-10 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-text-primary mb-2">Screen not found</h2>
          <p className="text-text-muted mb-6">The screen you're looking for doesn't exist or has been deleted.</p>
          <Button
            variant="outline"
            onClick={() => navigate(backUrl)}
            className="border-accent text-accent hover:bg-accent-light"
          >
            {isFromPlaylist ? 'Back to Playlist' : 'Back to Screens'}
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
          onClick={() => navigate(backUrl)}
          className="group flex items-center gap-2 text-text-secondary hover:text-accent transition-colors"
        >
          <span className="p-1.5 rounded-lg bg-bg-muted group-hover:bg-accent-light transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </span>
          <span className="text-sm font-medium">{isFromPlaylist ? 'Back to Playlist' : 'Back to Screens'}</span>
        </button>

        {/* Header Section */}
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <h1 className="text-3xl font-bold text-text-primary">{screen.name}</h1>
              {screen.isDefault && (
                <span className="px-3 py-1.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-sm font-semibold rounded-full shadow-lg shadow-indigo-200">
                  Default Screen
                </span>
              )}
            </div>
            {screen.description && (
              <p className="text-text-secondary max-w-2xl">{screen.description}</p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={() => navigate(`/screens/${id}/edit`)}
              className="border-border-default hover:border-accent hover:text-accent"
            >
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Edit
              </span>
            </Button>
            <Button
              variant="danger"
              onClick={() => setShowDeleteModal(true)}
              className="bg-red-50 text-red-600 hover:bg-red-100 border border-red-200"
            >
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Delete
              </span>
            </Button>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Screen Preview */}
          <div className="lg:col-span-2">
            <Card padding="none" className="overflow-hidden border border-border-light shadow-xl shadow-gray-100/50">
              <div className="p-4 bg-gradient-to-r from-bg-muted to-bg-page border-b border-border-light">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-400" />
                  <div className="w-3 h-3 rounded-full bg-yellow-400" />
                  <div className="w-3 h-3 rounded-full bg-green-400" />
                  <span className="ml-3 text-sm text-text-muted font-medium">Preview</span>
                </div>
              </div>
              <div className="bg-gradient-to-br from-gray-900 to-gray-800 p-8">
                <div className="relative rounded-lg overflow-hidden shadow-2xl">
                  {screen.imageUrl ? (
                    <img
                      src={screen.imageUrl}
                      alt={screen.name}
                      className="w-full h-auto"
                    />
                  ) : (
                    <div className="aspect-video bg-border-dark flex items-center justify-center">
                      <div className="text-center">
                        <svg className="w-16 h-16 text-text-secondary mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <p className="text-text-muted">No image available</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          </div>

          {/* Details Sidebar */}
          <div className="space-y-6">
            {/* Default Screen Notice */}
            {screen.isDefault && (
              <div className="p-4 bg-gradient-to-br from-accent-light to-bg-muted border border-accent rounded-xl">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-accent-light rounded-lg">
                    <svg className="w-5 h-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="font-semibold text-accent mb-1">Default Welcome Screen</h4>
                    <p className="text-sm text-accent">
                      This screen is shown to newly connected devices as their welcome display.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Screen Details Card */}
            <Card className="border border-border-light">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-gradient-to-br from-accent-light to-bg-muted rounded-xl">
                  <svg className="w-5 h-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h2 className="text-lg font-semibold text-text-primary">Screen Details</h2>
              </div>
              <dl className="space-y-5">
                <div className="group">
                  <dt className="text-sm font-medium text-text-muted mb-1.5 flex items-center gap-2">
                    <svg className="w-4 h-4 text-text-placeholder" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
                    </svg>
                    Description
                  </dt>
                  <dd className="text-text-primary pl-6">
                    {screen.description || (
                      <span className="text-text-placeholder italic">No description provided</span>
                    )}
                  </dd>
                </div>
                <div className="h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
                <div className="group">
                  <dt className="text-sm font-medium text-text-muted mb-1.5 flex items-center gap-2">
                    <svg className="w-4 h-4 text-text-placeholder" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Created
                  </dt>
                  <dd className="text-text-primary pl-6">
                    {new Date(screen.createdAt).toLocaleString(undefined, {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </dd>
                </div>
                {screen.updatedAt && screen.updatedAt !== screen.createdAt && (
                  <>
                    <div className="h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
                    <div className="group">
                      <dt className="text-sm font-medium text-text-muted mb-1.5 flex items-center gap-2">
                        <svg className="w-4 h-4 text-text-placeholder" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Last Updated
                      </dt>
                      <dd className="text-text-primary pl-6">
                        {new Date(screen.updatedAt).toLocaleString(undefined, {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}
                      </dd>
                    </div>
                  </>
                )}
              </dl>
            </Card>

            {/* Quick Actions */}
            <Card className="border border-border-light bg-gradient-to-br from-gray-50 to-white">
              <h3 className="text-sm font-semibold text-text-primary mb-4">Quick Actions</h3>
              <div className="space-y-2">
                <button
                  onClick={() => navigate(`/screens/${id}/edit`)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white hover:shadow-md transition-all text-left group"
                >
                  <span className="p-2 bg-accent-light rounded-lg group-hover:bg-accent/20 transition-colors">
                    <svg className="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </span>
                  <div>
                    <p className="font-medium text-text-primary">Edit Screen</p>
                    <p className="text-xs text-text-muted">Modify screen details</p>
                  </div>
                </button>
                <button
                  onClick={() => navigate('/playlists/new')}
                  className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white hover:shadow-md transition-all text-left group"
                >
                  <span className="p-2 bg-violet-100 rounded-lg group-hover:bg-violet-200 transition-colors">
                    <svg className="w-4 h-4 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                    </svg>
                  </span>
                  <div>
                    <p className="font-medium text-text-primary">Add to Playlist</p>
                    <p className="text-xs text-text-muted">Include in a screen rotation</p>
                  </div>
                </button>
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Delete Screen"
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
              onClick={() => deleteScreen()}
              isLoading={isDeleting}
              className="flex-1 bg-red-600 hover:bg-red-700"
            >
              Delete Screen
            </Button>
          </div>
        }
      >
        <div className="text-center py-4">
          <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-text-primary mb-2">
            Delete "{screen.name}"?
          </h3>
          <p className="text-text-secondary">
            This action cannot be undone. The screen will be permanently removed from your library.
          </p>
        </div>
      </Modal>
    </MainLayout>
  );
}
