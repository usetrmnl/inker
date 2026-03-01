import { useState, useCallback, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { MainLayout } from '../../components/layout';
import { Button, Card, GridSkeleton, Modal } from '../../components/common';
import { ScreenDesignPreview } from '../../components/screen-designer/ScreenDesignPreview';
import { useApi, useMutation } from '../../hooks/useApi';
import { useInfiniteScroll } from '../../hooks';
import { screenService, screenDesignerService, customWidgetService, dataSourceService } from '../../services/api';
import { useNotification } from '../../contexts/NotificationContext';

const CUSTOM_WIDGET_TEMPLATE_OFFSET = 10000;
import type { Screen, ScreenDesign, WidgetTemplate } from '../../types';

// Combined screen type for display
interface CombinedScreen {
  id: string | number;
  name: string;
  description?: string;
  thumbnailUrl?: string;
  isDefault?: boolean;
  isDesigned: boolean;
  createdAt?: string;
  // Full design data for preview (only for designed screens)
  design?: ScreenDesign;
}

/**
 * ScreensList Page Component
 * Displays a list of screens with options to upload or design new screens.
 */
// Interface for imported screen data
interface ImportedScreenData {
  _inkerScreen: number;
  name: string;
  description?: string;
  width: number;
  height: number;
  background: string;
  widgets: Array<{
    templateId: number;
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number;
    config: Record<string, unknown>;
    zIndex: number;
  }>;
  customWidgets?: Array<{
    id: number;
    name: string;
    description?: string;
    displayType: string;
    template?: string;
    config: Record<string, unknown>;
    minWidth: number;
    minHeight: number;
    dataSource: {
      name: string;
      description?: string;
      type: string;
      url: string;
      method: string;
      headers?: Record<string, string>;
      refreshInterval: number;
      jsonPath?: string;
    };
  }>;
}

export function ScreensList() {
  const navigate = useNavigate();
  const location = useLocation();
  const { showNotification } = useNotification();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [screenToDelete, setScreenToDelete] = useState<CombinedScreen | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importCode, setImportCode] = useState('');
  const [importPreview, setImportPreview] = useState<ImportedScreenData | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  // Fetch uploaded screens with infinite scroll
  const uploadedScreensApi = useCallback(
    (page: number, limit: number) => screenService.getAll(page, limit),
    []
  );
  const {
    items: uploadedScreens,
    isLoading: isLoadingUploaded,
    isLoadingMore: isLoadingMoreUploaded,
    hasMore: hasMoreUploaded,
    refresh: refetchUploaded,
    sentinelRef: uploadedSentinelRef,
  } = useInfiniteScroll<Screen>(uploadedScreensApi);

  // Fetch designed screens with infinite scroll
  const designedScreensApi = useCallback(
    (page: number, limit: number) => screenDesignerService.getAll(page, limit),
    []
  );
  const {
    items: designedScreens,
    isLoading: isLoadingDesigned,
    isLoadingMore: isLoadingMoreDesigned,
    hasMore: hasMoreDesigned,
    refresh: refetchDesigned,
    sentinelRef: designedSentinelRef,
  } = useInfiniteScroll<ScreenDesign>(designedScreensApi);

  // Fetch widget templates for preview rendering
  const { data: widgetTemplates } = useApi<WidgetTemplate[]>(
    () => screenDesignerService.getTemplates()
  );

  // Refresh data when navigating to this page (e.g., back from designer)
  // location.key changes on each navigation, ensuring fresh data
  useEffect(() => {
    refetchUploaded();
    refetchDesigned();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Refresh on navigation only
  }, [location.key]);

  const { mutate: deleteScreen, isLoading: isDeleting } = useMutation(
    async (screen: CombinedScreen) => {
      if (screen.isDesigned) {
        const designId = String(screen.id).replace('design-', '');
        return screenDesignerService.delete(Number(designId));
      } else {
        return screenService.delete(String(screen.id));
      }
    },
    {
      successMessage: 'Screen deleted successfully',
      onSuccess: () => {
        setShowDeleteModal(false);
        setScreenToDelete(null);
        refetchUploaded();
        refetchDesigned();
      },
    }
  );

  const isLoading = isLoadingUploaded || isLoadingDesigned;
  const isLoadingMore = isLoadingMoreUploaded || isLoadingMoreDesigned;
  const hasMore = hasMoreUploaded || hasMoreDesigned;

  // Combine uploaded and designed screens
  const combinedScreens: CombinedScreen[] = [
    // Map uploaded screens
    ...uploadedScreens.map((screen): CombinedScreen => ({
      id: screen.id,
      name: screen.name,
      description: screen.description,
      thumbnailUrl: screen.thumbnailUrl,
      isDefault: screen.isDefault,
      isDesigned: false,
      createdAt: screen.createdAt,
    })),
    // Map designed screens - include full design data for preview
    ...(designedScreens || []).map((design): CombinedScreen => ({
      id: `design-${design.id}`,
      name: design.name,
      description: design.description,
      thumbnailUrl: undefined,
      isDefault: false,
      isDesigned: true,
      createdAt: design.createdAt,
      design: design, // Include full design for preview rendering
    })),
  ].sort((a, b) => {
    // Sort by createdAt descending (newest first)
    if (!a.createdAt || !b.createdAt) return 0;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const handleScreenClick = (screen: CombinedScreen) => {
    if (screen.isDesigned) {
      // Extract numeric ID from "design-123" format
      const designId = String(screen.id).replace('design-', '');
      navigate(`/screens/designer/${designId}`);
    } else {
      navigate(`/screens/${screen.id}`);
    }
  };

  const handleDeleteClick = (e: React.MouseEvent, screen: CombinedScreen) => {
    e.stopPropagation();
    setScreenToDelete(screen);
    setShowDeleteModal(true);
  };

  const confirmDelete = () => {
    if (screenToDelete) {
      deleteScreen(screenToDelete);
    }
  };

  // Parse import code and show preview
  const handleImportCodeChange = (code: string) => {
    setImportCode(code);
    setImportError(null);
    setImportPreview(null);

    if (!code.trim()) return;

    try {
      // Decode base64
      const jsonString = decodeURIComponent(escape(atob(code.trim())));
      const data = JSON.parse(jsonString) as ImportedScreenData;

      // Validate structure
      if (!data._inkerScreen) {
        throw new Error('Invalid screen code format');
      }
      if (!data.name || !data.width || !data.height) {
        throw new Error('Missing required screen data');
      }
      if (!Array.isArray(data.widgets)) {
        throw new Error('Invalid widgets data');
      }

      setImportPreview(data);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Invalid screen code');
    }
  };

  // Import the screen
  const handleImportScreen = async () => {
    if (!importPreview) return;

    setIsImporting(true);
    try {
      // Map old custom widget IDs to new ones
      const customWidgetIdMap = new Map<number, number>();

      // If there are custom widgets, create data sources and widgets first
      if (importPreview.customWidgets && importPreview.customWidgets.length > 0) {
        // Get existing data sources to check for duplicates by URL
        const existingDataSourcesResponse = await dataSourceService.getAll(1, 1000); // Fetch all for matching
        const existingDataSources = existingDataSourcesResponse.items;

        for (const cw of importPreview.customWidgets) {
          // Check if data source with same URL already exists
          let dataSourceId: number;
          const existingDs = existingDataSources.find(
            (ds) => ds.url === cw.dataSource.url && ds.type === cw.dataSource.type
          );

          if (existingDs) {
            dataSourceId = existingDs.id;
          } else {
            // Create new data source
            const newDs = await dataSourceService.create({
              name: cw.dataSource.name + ' (Imported)',
              description: cw.dataSource.description,
              type: cw.dataSource.type as 'json' | 'rss',
              url: cw.dataSource.url,
              method: cw.dataSource.method as 'GET' | 'POST',
              headers: cw.dataSource.headers,
              refreshInterval: cw.dataSource.refreshInterval,
              jsonPath: cw.dataSource.jsonPath,
              isActive: true,
            });
            dataSourceId = newDs.id;
            // Add to existing list for subsequent checks
            existingDataSources.push(newDs);
          }

          // Create custom widget
          const newWidget = await customWidgetService.create({
            name: cw.name + ' (Imported)',
            description: cw.description,
            dataSourceId,
            displayType: cw.displayType as 'value' | 'list' | 'script',
            template: cw.template,
            config: cw.config,
            minWidth: cw.minWidth,
            minHeight: cw.minHeight,
          });

          // Map old ID to new ID
          customWidgetIdMap.set(cw.id, newWidget.id);
        }
      }

      // Update widget templateIds for custom widgets
      const updatedWidgets = importPreview.widgets.map((w) => {
        if (w.templateId >= CUSTOM_WIDGET_TEMPLATE_OFFSET) {
          const oldCustomWidgetId = w.templateId - CUSTOM_WIDGET_TEMPLATE_OFFSET;
          const newCustomWidgetId = customWidgetIdMap.get(oldCustomWidgetId);
          if (newCustomWidgetId) {
            return {
              ...w,
              templateId: CUSTOM_WIDGET_TEMPLATE_OFFSET + newCustomWidgetId,
            };
          }
        }
        return w;
      });

      const designData = {
        name: importPreview.name + ' (Imported)',
        description: importPreview.description,
        width: importPreview.width,
        height: importPreview.height,
        background: importPreview.background,
        widgets: updatedWidgets,
        isTemplate: false,
      };

      const newDesign = await screenDesignerService.create(designData as Partial<ScreenDesign>);

      const customWidgetCount = importPreview.customWidgets?.length || 0;
      const message = customWidgetCount > 0
        ? `Screen "${importPreview.name}" imported with ${customWidgetCount} custom widget(s)!`
        : `Screen "${importPreview.name}" imported successfully!`;

      showNotification('success', message);
      setShowImportModal(false);
      setImportCode('');
      setImportPreview(null);
      refetchDesigned();
      // Navigate to the imported screen
      navigate(`/screens/designer/${newDesign.id}`);
    } catch (error) {
      showNotification('error', 'Failed to import screen');
      console.error('Import error:', error);
    } finally {
      setIsImporting(false);
    }
  };

  const closeImportModal = () => {
    setShowImportModal(false);
    setImportCode('');
    setImportPreview(null);
    setImportError(null);
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
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                </div>
                <h1 className="text-3xl font-bold">Screens</h1>
              </div>
              <p className="text-text-inverse/80 max-w-xl">
                Manage your screen content for e-ink devices. Upload images or design custom screens with widgets.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="secondary"
                onClick={() => setShowImportModal(true)}
                className="bg-white/10 hover:bg-white/20 text-white border-white/20 backdrop-blur-sm"
              >
                <span className="flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                    />
                  </svg>
                  Import
                </span>
              </Button>
              <Button
                variant="secondary"
                onClick={() => navigate('/screens/designer')}
                className="bg-white/20 hover:bg-white/30 text-white border-white/30 backdrop-blur-sm"
              >
                <span className="flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"
                    />
                  </svg>
                  Design Screen
                </span>
              </Button>
            </div>
          </div>
        </div>

        {/* Content Area */}
        {isLoading ? (
          <GridSkeleton count={8} />
        ) : combinedScreens.length === 0 ? (
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
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-text-primary mb-2">No screens yet</h3>
              <p className="text-text-secondary mb-8 max-w-md mx-auto">
                Get started by designing a screen with widgets to display on your e-ink devices.
              </p>
              <div className="flex items-center justify-center gap-4">
                <Button
                  onClick={() => navigate('/screens/designer')}
                  className="bg-accent hover:bg-accent-hover"
                >
                  <span className="flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                    </svg>
                    Design Screen
                  </span>
                </Button>
              </div>
            </div>
          </Card>
        ) : (
          /* Screens Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {combinedScreens.map((screen) => (
              <Card
                key={screen.id}
                hover
                onClick={() => handleScreenClick(screen)}
                padding="none"
                className="group overflow-hidden border border-border-light hover:border-accent hover:shadow-xl hover:shadow-accent-light/50 transition-all duration-300"
              >
                <div className="aspect-video bg-bg-muted relative overflow-hidden">
                  {screen.thumbnailUrl ? (
                    <img
                      src={screen.thumbnailUrl}
                      alt={screen.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : screen.isDesigned && screen.design && widgetTemplates ? (
                    // Always use live preview for designed screens
                    <ScreenDesignPreview
                      design={screen.design}
                      templates={widgetTemplates}
                      className="group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : screen.isDesigned ? (
                    // Fallback for designed screens without data
                    <div className="w-full h-full flex flex-col items-center justify-center bg-accent-light">
                      <svg className="w-12 h-12 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                      </svg>
                      <span className="text-xs text-accent mt-2 font-medium">Widget Design</span>
                    </div>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <svg className="w-12 h-12 text-border-dark" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  )}
                  {screen.isDefault && (
                    <span className="absolute top-3 right-3 px-3 py-1.5 bg-accent text-text-inverse text-xs font-semibold rounded-full shadow-lg">
                      Default
                    </span>
                  )}
                  {screen.isDesigned && (
                    <span className="absolute top-3 left-3 px-2 py-1 bg-accent text-text-inverse text-xs font-medium rounded-md shadow">
                      Designed
                    </span>
                  )}
                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-center pb-4">
                    <span className="text-white text-sm font-medium flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      {screen.isDesigned ? 'Edit Design' : 'View Details'}
                    </span>
                  </div>
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-text-primary truncate group-hover:text-accent transition-colors">
                        {screen.name}
                      </h3>
                      {screen.description && (
                        <p className="mt-1 text-sm text-text-muted line-clamp-2">
                          {screen.description}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => handleDeleteClick(e, screen)}
                        className="flex-shrink-0 p-1.5 rounded-lg bg-status-error-bg text-status-error-text opacity-0 group-hover:opacity-100 transition-opacity hover:bg-status-error-border"
                        title="Delete screen"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                      <div className="flex-shrink-0 p-1.5 rounded-lg bg-accent-light text-accent opacity-0 group-hover:opacity-100 transition-opacity">
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
              <span className="text-sm">Loading more screens...</span>
            </div>
          </div>
        )}

        {/* End of list indicator */}
        {!hasMore && combinedScreens.length > 0 && (
          <div className="py-4 text-center text-text-muted text-sm">
            Showing all screens
          </div>
        )}

        {/* Sentinel elements for infinite scroll - one for each list */}
        <div ref={uploadedSentinelRef} />
        <div ref={designedSentinelRef} />
      </div>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setScreenToDelete(null);
        }}
        title="Delete Screen"
      >
        <div className="space-y-4">
          <p className="text-text-secondary">
            Are you sure you want to delete "{screenToDelete?.name}"? This action cannot be undone.
          </p>
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setShowDeleteModal(false);
                setScreenToDelete(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={confirmDelete}
              isLoading={isDeleting}
            >
              Delete
            </Button>
          </div>
        </div>
      </Modal>

      {/* Import Screen Modal */}
      <Modal
        isOpen={showImportModal}
        onClose={closeImportModal}
        title="Import Screen"
      >
        <div className="space-y-4">
          <p className="text-sm text-text-secondary">
            Paste a screen code from another Inker instance to import a screen design.
          </p>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">
              Screen Code
            </label>
            <textarea
              value={importCode}
              onChange={(e) => handleImportCodeChange(e.target.value)}
              className="w-full px-3 py-2 bg-bg-muted border border-border-light rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent focus:bg-bg-input transition-all resize-none"
              rows={4}
              placeholder="Paste the screen code here..."
            />
          </div>

          {/* Error message */}
          {importError && (
            <div className="p-3 bg-status-error-bg border border-status-error-border rounded-lg">
              <div className="flex items-center gap-2 text-status-error-text text-sm">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {importError}
              </div>
            </div>
          )}

          {/* Preview */}
          {importPreview && (
            <div className="p-4 bg-status-success-bg border border-status-success-border rounded-lg">
              <div className="flex items-center gap-2 text-status-success-text text-sm font-medium mb-3">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Valid screen code detected
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-text-secondary">Name</span>
                  <span className="font-medium text-text-primary">{importPreview.name}</span>
                </div>
                {importPreview.description && (
                  <div className="flex items-center justify-between">
                    <span className="text-text-secondary">Description</span>
                    <span className="font-medium text-text-primary truncate max-w-[200px]">{importPreview.description}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-text-secondary">Canvas Size</span>
                  <span className="font-medium text-text-primary">{importPreview.width} x {importPreview.height}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-text-secondary">Widgets</span>
                  <span className="font-medium text-text-primary">{importPreview.widgets.length}</span>
                </div>
                {importPreview.customWidgets && importPreview.customWidgets.length > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-text-secondary">Custom Widgets</span>
                    <span className="font-medium text-accent">{importPreview.customWidgets.length}</span>
                  </div>
                )}
              </div>
              {importPreview.customWidgets && importPreview.customWidgets.length > 0 && (
                <div className="mt-3 pt-3 border-t border-status-success-border">
                  <p className="text-xs text-status-success-text">
                    Custom widgets and their data sources will be created automatically.
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="outline"
              onClick={closeImportModal}
            >
              Cancel
            </Button>
            <Button
              onClick={handleImportScreen}
              disabled={!importPreview || isImporting}
              isLoading={isImporting}
              className="bg-accent hover:bg-accent-hover"
            >
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Import Screen
              </span>
            </Button>
          </div>
        </div>
      </Modal>
    </MainLayout>
  );
}
