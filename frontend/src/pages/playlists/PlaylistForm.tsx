import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MainLayout } from '../../components/layout';
import { Button, Card, Input, LoadingSpinner, Select } from '../../components/common';
import { ScreenDesignPreview } from '../../components/screen-designer/ScreenDesignPreview';
import { useApi, useMutation } from '../../hooks/useApi';
import { playlistService, screenService, screenDesignerService } from '../../services/api';
import { config } from '../../config';
import type { Playlist, PlaylistFormData, Screen, ScreenDesign, PlaylistScreen, PaginatedResponse, WidgetTemplate } from '../../types';

// Combined screen option for the dropdown
interface ScreenOption {
  id: string;
  name: string;
  isDesigned: boolean;
  thumbnailUrl?: string;
  design?: ScreenDesign;
  width?: number;
  height?: number;
}

// Device with resolution info
interface DeviceWithResolution {
  id: number;
  name: string;
  width: number;
  height: number;
}

export function PlaylistForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEditMode = id !== 'new' && !!id;

  const [formData, setFormData] = useState<PlaylistFormData>({
    name: '',
    description: '',
    screens: [],
    isActive: true, // Always active by default
  });

  const [selectedScreenId, setSelectedScreenId] = useState<string>('');
  const [duration, setDuration] = useState<number>(60);

  const { data: playlist, isLoading: isLoadingPlaylist } = useApi<Playlist>(
    async () => {
      // Skip API call when creating a new playlist
      if (!isEditMode) {
        return null as unknown as Playlist;
      }
      return playlistService.getById(id!);
    },
    { showErrorNotification: false }
  );

  const { data: screensData } = useApi<PaginatedResponse<Screen>>(
    () => screenService.getAll(1, 100)
  );

  const { data: designedScreensData } = useApi<PaginatedResponse<ScreenDesign>>(
    () => screenDesignerService.getAll(1, 100)
  );

  const { data: templates } = useApi<WidgetTemplate[]>(
    () => screenDesignerService.getTemplates()
  );

  // Get devices assigned to this playlist (for resolution filtering)
  // Type assertion needed because playlist devices have resolution info from backend
  const playlistDevices: DeviceWithResolution[] =
    ((playlist as Playlist & { devices?: DeviceWithResolution[] })?.devices) || [];

  // Get unique resolutions from assigned devices
  const deviceResolutions = playlistDevices
    .filter((d) => d.width > 0 && d.height > 0)
    .map((d) => ({ width: d.width, height: d.height }));

  // Get resolution from first screen in playlist (to enforce single resolution)
  const getPlaylistResolution = (): { width: number; height: number } | null => {
    const screens = formData.screens || [];
    if (screens.length === 0) return null;

    const firstScreenId = screens[0].screenId;
    const firstScreen = allScreens.find((s) => s.id === firstScreenId);
    if (firstScreen?.width && firstScreen?.height) {
      return { width: firstScreen.width, height: firstScreen.height };
    }
    return null;
  };

  // Check if a screen matches the required resolution (device or playlist)
  const matchesRequiredResolution = (width?: number, height?: number): boolean => {
    if (!width || !height) return true;

    // First priority: match existing screens in playlist
    const playlistRes = getPlaylistResolution();
    if (playlistRes) {
      return playlistRes.width === width && playlistRes.height === height;
    }

    // Second priority: match device resolutions
    if (deviceResolutions.length > 0) {
      return deviceResolutions.some((r) => r.width === width && r.height === height);
    }

    return true;
  };

  // Combine uploaded and designed screens for the dropdown
  const allScreens: ScreenOption[] = [
    ...(screensData?.items || []).map((screen): ScreenOption => ({
      id: String(screen.id),
      name: screen.name,
      isDesigned: false,
      thumbnailUrl: screen.thumbnailUrl,
      width: screen.width,
      height: screen.height,
    })),
    ...(designedScreensData?.items || []).map((design): ScreenOption => ({
      id: `design-${design.id}`,
      name: `${design.name} (Designed)`,
      isDesigned: true,
      design: design,
      width: design.width,
      height: design.height,
    })),
  ];

  // Filter screens by required resolution (playlist screens or device)
  const playlistResolution = getPlaylistResolution();
  const hasResolutionFilter = playlistResolution || deviceResolutions.length > 0;

  const availableScreens: ScreenOption[] = hasResolutionFilter
    ? allScreens.filter((s) => matchesRequiredResolution(s.width, s.height))
    : allScreens;

  // Get screen option by ID (check all screens, not just filtered)
  const getScreenOption = (screenId: string): ScreenOption | undefined => {
    return allScreens.find((s) => s.id === screenId);
  };

  // Get unique resolution string for display
  const getResolutionDisplay = (): string | null => {
    // First priority: playlist resolution
    if (playlistResolution) {
      return `${playlistResolution.width}×${playlistResolution.height}`;
    }
    // Second priority: device resolutions
    if (deviceResolutions.length === 0) return null;
    const unique = deviceResolutions.filter(
      (r, i, arr) => arr.findIndex((x) => x.width === r.width && x.height === r.height) === i
    );
    return unique.map((r) => `${r.width}×${r.height}`).join(', ');
  };

  const { mutate: createPlaylist, isLoading: isCreating } = useMutation(
    (data: PlaylistFormData) => playlistService.create(data),
    {
      successMessage: 'Playlist created successfully',
      onSuccess: (newPlaylist) => navigate(`/playlists/${newPlaylist.id}`),
    }
  );

  const { mutate: updatePlaylist, isLoading: isUpdating } = useMutation(
    (data: Partial<PlaylistFormData>) => playlistService.update(id!, data),
    {
      successMessage: 'Playlist updated successfully',
      onSuccess: () => navigate(`/playlists/${id}`),
    }
  );

  // Track the playlist ID that was used to populate form to avoid re-populating
  const populatedPlaylistIdRef = useRef<string | null>(null);

  // Populate form data when playlist is loaded (only once per playlist)
  // This is an intentional pattern for form initialization from server data
  useEffect(() => {
    if (playlist && playlist.id !== populatedPlaylistIdRef.current) {
      populatedPlaylistIdRef.current = playlist.id;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Form initialization from server data
      setFormData({
        name: playlist.name,
        description: playlist.description || '',
        screens: playlist.screens || [],
        isActive: playlist.isActive,
      });
    }
  }, [playlist]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Strip extra properties from screens - backend DTO only accepts screenId, duration, order
    const cleanedFormData = {
      ...formData,
      screens: (formData.screens || []).map((screen) => ({
        screenId: screen.screenId,
        duration: screen.duration,
        order: screen.order,
      })),
    };

    if (isEditMode) {
      await updatePlaylist(cleanedFormData);
    } else {
      await createPlaylist(cleanedFormData);
    }
  };

  const handleChange = (field: keyof PlaylistFormData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setFormData((prev) => ({
      ...prev,
      [field]: e.target.value,
    }));
  };

  const handleAddScreen = () => {
    if (!selectedScreenId) return;

    const currentScreens = formData.screens || [];
    const newScreen: PlaylistScreen = {
      screenId: selectedScreenId,
      duration,
      order: currentScreens.length,
    };

    setFormData((prev) => ({
      ...prev,
      screens: [...(prev.screens || []), newScreen],
    }));

    setSelectedScreenId('');
    setDuration(60);
  };

  const handleRemoveScreen = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      screens: (prev.screens || []).filter((_, i) => i !== index).map((screen, i) => ({
        ...screen,
        order: i,
      })),
    }));
  };

  const handleMoveScreen = (index: number, direction: 'up' | 'down') => {
    const screens = formData.screens || [];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= screens.length) return;

    const newScreens = [...screens];
    const temp = newScreens[index];
    newScreens[index] = newScreens[newIndex];
    newScreens[newIndex] = temp;

    setFormData((prev) => ({
      ...prev,
      screens: newScreens.map((screen, i) => ({
        ...screen,
        order: i,
      })),
    }));
  };

  const handleUpdateScreenDuration = (index: number, newDuration: number) => {
    const validDuration = Math.max(60, newDuration);
    setFormData((prev) => ({
      ...prev,
      screens: (prev.screens || []).map((screen, i) =>
        i === index ? { ...screen, duration: validDuration } : screen
      ),
    }));
  };

  const getScreenName = (screenId: string) => {
    const screen = availableScreens.find((s) => s.id === screenId);
    return screen?.name || screenId;
  };

  if (isEditMode && isLoadingPlaylist) {
    return (
      <MainLayout>
        <div className="flex justify-center items-center min-h-[400px]">
          <LoadingSpinner size="lg" />
        </div>
      </MainLayout>
    );
  }

  const isLoading = isCreating || isUpdating;

  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(isEditMode ? `/playlists/${id}` : '/playlists')}
            className="mb-4"
          >
            ← {isEditMode ? 'Back to Playlist' : 'Back to Playlists'}
          </Button>
          <h1 className="text-3xl font-bold text-text-primary">
            {isEditMode ? 'Edit Playlist' : 'Create New Playlist'}
          </h1>
          <p className="mt-2 text-sm text-text-secondary">
            {isEditMode
              ? 'Update playlist details and screen order'
              : 'Create a new playlist of screens for your devices'}
          </p>
        </div>

        <Card>
          <form onSubmit={handleSubmit} className="space-y-6">
            <Input
              label="Playlist Name"
              value={formData.name || ''}
              onChange={handleChange('name')}
              placeholder="Enter playlist name"
              required
            />

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Description
              </label>
              <textarea
                value={formData.description || ''}
                onChange={handleChange('description')}
                placeholder="Enter playlist description (optional)"
                className="w-full px-3 py-2 border border-border-light rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                rows={3}
              />
            </div>

            <div className="border-t border-border-light pt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-text-primary">Screens</h3>
                {getResolutionDisplay() && (
                  <span className="text-xs text-text-muted bg-bg-muted px-2 py-1 rounded-full">
                    Filtered: {getResolutionDisplay()}
                  </span>
                )}
              </div>

              {/* Resolution filter info */}
              {hasResolutionFilter && (
                <div className="mb-4 p-3 bg-status-info-bg border border-status-info-border rounded-lg">
                  <p className="text-sm text-status-info-text">
                    {playlistResolution ? (
                      <>Only showing screens matching playlist resolution ({getResolutionDisplay()}).</>
                    ) : (
                      <>Only showing screens matching device resolution ({getResolutionDisplay()}).</>
                    )}
                    {availableScreens.length === 0 && (
                      <span className="block mt-1 font-medium">
                        No matching screens found. Create a new screen with {getResolutionDisplay()} resolution.
                      </span>
                    )}
                  </p>
                </div>
              )}

              {/* Add screen section */}
              <div className="flex gap-4 mb-4">
                {/* Screen Selection Preview */}
                <div className="flex-shrink-0 w-40 h-28 rounded-lg overflow-hidden bg-white border border-border-light shadow-inner">
                  {selectedScreenId ? (
                    (() => {
                      const selectedScreen = getScreenOption(selectedScreenId);
                      if (selectedScreen?.isDesigned && selectedScreen.design && templates) {
                        return (
                          <ScreenDesignPreview
                            design={selectedScreen.design}
                            templates={templates}
                          />
                        );
                      } else if (selectedScreen?.thumbnailUrl) {
                        return (
                          <img
                            src={selectedScreen.thumbnailUrl.startsWith('/') ? `${config.backendUrl}${selectedScreen.thumbnailUrl}` : selectedScreen.thumbnailUrl}
                            alt={selectedScreen.name}
                            className="w-full h-full object-cover"
                          />
                        );
                      }
                      return (
                        <div className="w-full h-full flex items-center justify-center bg-bg-muted">
                          <svg className="w-8 h-8 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                      );
                    })()
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-bg-muted text-text-muted">
                      <svg className="w-8 h-8 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span className="text-xs">Preview</span>
                    </div>
                  )}
                </div>

                {/* Selection Controls */}
                <div className="flex-1 flex gap-3">
                  <div className="flex-1">
                    <Select
                      label="Select Screen"
                      value={selectedScreenId || ''}
                      onChange={(e) => setSelectedScreenId(e.target.value)}
                    >
                      <option value="">Choose a screen</option>
                      {availableScreens.map((screen) => (
                        <option key={screen.id} value={screen.id}>
                          {screen.name}{screen.width && screen.height ? ` (${screen.width}×${screen.height})` : ''}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="w-32">
                    <Input
                      label="Duration (s)"
                      type="number"
                      value={duration.toString()}
                      onChange={(e) => setDuration(Math.max(60, Number(e.target.value)))}
                      min={60}
                    />
                  </div>
                  <div className="flex items-end">
                    <Button
                      type="button"
                      onClick={handleAddScreen}
                      disabled={!selectedScreenId}
                    >
                      Add
                    </Button>
                  </div>
                </div>
              </div>

              {/* Screens list */}
              {(formData.screens || []).length === 0 ? (
                <p className="text-center text-text-muted py-8 border-2 border-dashed border-border-light rounded-lg">
                  No screens added yet
                </p>
              ) : (
                <div className="space-y-3">
                  {(formData.screens || []).map((screen, index) => {
                    const screenOption = getScreenOption(screen.screenId);
                    return (
                      <div
                        key={`${screen.screenId}-${index}`}
                        className="flex items-center gap-4 p-3 bg-bg-muted rounded-lg border border-border-light"
                      >
                        <span className="text-sm font-medium text-text-muted w-8">
                          #{index + 1}
                        </span>
                        {/* Screen Preview */}
                        <div className="flex-shrink-0 w-24 h-16 rounded-lg overflow-hidden bg-white border border-border-light shadow-inner">
                          {screenOption?.isDesigned && screenOption.design && templates ? (
                            <ScreenDesignPreview
                              design={screenOption.design}
                              templates={templates}
                            />
                          ) : screenOption?.thumbnailUrl ? (
                            <img
                              src={screenOption.thumbnailUrl.startsWith('/') ? `${config.backendUrl}${screenOption.thumbnailUrl}` : screenOption.thumbnailUrl}
                              alt={screenOption.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-bg-muted">
                              <svg className="w-6 h-6 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-text-primary truncate">
                              {getScreenName(screen.screenId)}
                            </span>
                            {screenOption && !matchesRequiredResolution(screenOption.width, screenOption.height) && hasResolutionFilter && (
                              <span className="px-1.5 py-0.5 text-xs font-medium bg-status-warning-bg text-status-warning-text rounded" title="Resolution doesn't match playlist">
                                ⚠
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs">
                            {screenOption?.isDesigned && (
                              <span className="text-accent">Designed</span>
                            )}
                            {screenOption?.width && screenOption?.height && (
                              <span className="text-text-muted">{screenOption.width}×{screenOption.height}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <input
                            type="number"
                            value={screen.duration}
                            onChange={(e) => handleUpdateScreenDuration(index, Number(e.target.value))}
                            min={60}
                            className="w-16 px-2 py-1 text-sm text-center border border-border-light rounded focus:outline-none focus:ring-1 focus:ring-accent"
                          />
                          <span className="text-sm text-text-secondary">s</span>
                        </div>
                        <div className="flex gap-1 flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => handleMoveScreen(index, 'up')}
                            disabled={index === 0}
                            className="p-1.5 text-text-secondary hover:text-text-primary hover:bg-bg-card disabled:opacity-30 rounded transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveScreen(index, 'down')}
                            disabled={index === (formData.screens || []).length - 1}
                            className="p-1.5 text-text-secondary hover:text-text-primary hover:bg-bg-card disabled:opacity-30 rounded transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveScreen(index)}
                            className="p-1.5 text-status-error-text hover:bg-status-error-bg rounded transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex gap-3 justify-end pt-4 border-t border-border-light">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate(isEditMode ? `/playlists/${id}` : '/playlists')}
              >
                Cancel
              </Button>
              <Button type="submit" isLoading={isLoading}>
                {isEditMode ? 'Update Playlist' : 'Create Playlist'}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </MainLayout>
  );
}
