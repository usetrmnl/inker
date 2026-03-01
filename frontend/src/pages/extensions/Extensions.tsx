import { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { MainLayout } from '../../components/layout';
import { CustomWidgetPreviewRenderer } from '../../components/common';
import { useInfiniteScroll } from '../../hooks';
import { useNotification } from '../../contexts/NotificationContext';
import { dataSourceService, customWidgetService } from '../../services/api';
import type { DataSource, CustomWidget, CustomWidgetPreview } from '../../types';

type Tab = 'data-sources' | 'custom-widgets';

/**
 * Extensions Page - Combines Data Sources and Custom Widgets into one view
 *
 * This page provides a unified interface for managing:
 * - Data Sources: External APIs and RSS feeds for dynamic widget content
 * - Custom Widgets: User-created widgets that use data sources
 */
export function Extensions() {
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') === 'custom-widgets' ? 'custom-widgets' : 'data-sources';
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);

  // Fetch data sources with infinite scroll
  const dataSourcesApi = useCallback(
    (page: number, limit: number) => dataSourceService.getAll(page, limit),
    []
  );
  const {
    items: dataSources,
    isLoading: loadingDataSources,
    isLoadingMore: loadingMoreDataSources,
    hasMore: hasMoreDataSources,
    error: dataSourcesError,
    refresh: refetchDataSources,
    sentinelRef: dataSourcesSentinelRef,
    total: totalDataSources,
  } = useInfiniteScroll<DataSource>(dataSourcesApi);

  // Fetch custom widgets with infinite scroll
  const customWidgetsApi = useCallback(
    (page: number, limit: number) => customWidgetService.getAll(page, limit),
    []
  );
  const {
    items: customWidgets,
    isLoading: loadingCustomWidgets,
    isLoadingMore: loadingMoreCustomWidgets,
    hasMore: hasMoreCustomWidgets,
    error: customWidgetsError,
    refresh: refetchCustomWidgets,
    sentinelRef: customWidgetsSentinelRef,
    total: totalCustomWidgets,
  } = useInfiniteScroll<CustomWidget>(customWidgetsApi);

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Extensions</h1>
            <p className="mt-1 text-sm text-text-muted">
              Manage data sources and custom widgets for dynamic content
            </p>
          </div>
          <div className="flex items-center gap-3">
            {activeTab === 'data-sources' && (
              <Link
                to="/data-sources/new"
                className="flex items-center gap-2 px-4 py-2 bg-accent text-text-inverse rounded-lg hover:bg-accent-hover transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                New Data Source
              </Link>
            )}
            {activeTab === 'custom-widgets' && (
              <Link
                to="/custom-widgets/new"
                className="flex items-center gap-2 px-4 py-2 bg-accent text-text-inverse rounded-lg hover:bg-accent-hover transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                New Custom Widget
              </Link>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-border-light">
          <nav className="flex gap-8">
            <button
              onClick={() => setActiveTab('data-sources')}
              className={`pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'data-sources'
                  ? 'border-accent text-accent'
                  : 'border-transparent text-text-muted hover:text-text-secondary hover:border-border-default'
              }`}
            >
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
                Data Sources
                <span className="px-2 py-0.5 text-xs bg-bg-muted text-text-muted rounded-full">
                  {totalDataSources}
                </span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('custom-widgets')}
              className={`pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'custom-widgets'
                  ? 'border-accent text-accent'
                  : 'border-transparent text-text-muted hover:text-text-secondary hover:border-border-default'
              }`}
            >
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                </svg>
                Custom Widgets
                <span className="px-2 py-0.5 text-xs bg-bg-muted text-text-muted rounded-full">
                  {totalCustomWidgets}
                </span>
              </div>
            </button>
          </nav>
        </div>

        {/* Content */}
        {activeTab === 'data-sources' && (
          <DataSourcesTab
            dataSources={dataSources}
            loading={loadingDataSources}
            loadingMore={loadingMoreDataSources}
            hasMore={hasMoreDataSources}
            error={dataSourcesError}
            onRefetch={refetchDataSources}
            sentinelRef={dataSourcesSentinelRef}
            total={totalDataSources}
          />
        )}

        {activeTab === 'custom-widgets' && (
          <CustomWidgetsTab
            customWidgets={customWidgets}
            loading={loadingCustomWidgets}
            loadingMore={loadingMoreCustomWidgets}
            hasMore={hasMoreCustomWidgets}
            error={customWidgetsError}
            onRefetch={refetchCustomWidgets}
            sentinelRef={customWidgetsSentinelRef}
            total={totalCustomWidgets}
          />
        )}
      </div>
    </MainLayout>
  );
}

/**
 * Confirmation Modal Component
 */
function ConfirmDeleteModal({
  isOpen,
  title,
  message,
  itemName,
  onConfirm,
  onCancel,
  isDeleting,
}: {
  isOpen: boolean;
  title: string;
  message: string;
  itemName: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDeleting: boolean;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-bg-overlay"
        onClick={onCancel}
      />

      {/* Modal */}
      <div className="relative bg-bg-card rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-12 h-12 rounded-full bg-status-error-bg flex items-center justify-center flex-shrink-0">
            <svg className="w-6 h-6 text-status-error-text" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-text-primary">{title}</h3>
            <p className="text-sm text-text-muted">{message}</p>
          </div>
        </div>

        <div className="bg-bg-muted rounded-lg p-3 mb-6">
          <p className="text-sm font-medium text-text-primary truncate">{itemName}</p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={isDeleting}
            className="flex-1 px-4 py-2 text-text-secondary bg-bg-muted rounded-lg hover:bg-border-light transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isDeleting}
            className="flex-1 px-4 py-2 text-text-inverse bg-status-error-dot rounded-lg hover:bg-status-error-text transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isDeleting ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Deleting...
              </>
            ) : (
              'Delete'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Data Sources Tab Content
 */
const MAX_AUTO_TEST = 5; // Auto-test if 5 or fewer data sources

function DataSourcesTab({
  dataSources,
  loading,
  loadingMore,
  hasMore,
  error,
  onRefetch,
  sentinelRef,
  total,
}: {
  dataSources: DataSource[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  error: string | null;
  onRefetch: () => void;
  sentinelRef: React.RefObject<HTMLDivElement | null>;
  total: number;
}) {
  const { showNotification } = useNotification();
  const [deleteTarget, setDeleteTarget] = useState<DataSource | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [testingIds, setTestingIds] = useState<Set<number>>(new Set());
  const [dotCount, setDotCount] = useState(1);
  const [hasAutoTested, setHasAutoTested] = useState(false);

  // Animated dots for "Waiting" state
  useEffect(() => {
    if (testingIds.size === 0) return;
    const interval = setInterval(() => {
      setDotCount((prev) => (prev % 3) + 1);
    }, 400);
    return () => clearInterval(interval);
  }, [testingIds.size]);

  // Wrap handleTestAll in useCallback to avoid dependency issues
  const handleTestAllCallback = useCallback(async () => {
    const ids = dataSources.map((ds) => ds.id);
    setTestingIds(new Set(ids));

    await Promise.all(
      ids.map(async (id) => {
        try {
          await dataSourceService.testFetch(id);
        } catch {
          // Error will be stored in lastError
        } finally {
          setTestingIds((prev) => {
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
        }
      })
    );
    onRefetch();
  }, [dataSources, onRefetch]);

  // Auto-test all data sources on mount (if not too many)
  useEffect(() => {
    if (!hasAutoTested && dataSources.length > 0 && dataSources.length <= MAX_AUTO_TEST) {
      setHasAutoTested(true);
      handleTestAllCallback();
    }
  }, [dataSources, hasAutoTested, handleTestAllCallback]);

  const handleTestDataSource = async (id: number) => {
    setTestingIds((prev) => new Set(prev).add(id));
    try {
      await dataSourceService.testFetch(id);
    } catch {
      // Error will be stored in lastError
    } finally {
      setTestingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      onRefetch();
    }
  };

  // handleTestAll now uses the memoized callback
  const handleTestAll = handleTestAllCallback;

  const getWaitingDots = () => '.'.repeat(dotCount);

  const handleDelete = async () => {
    if (!deleteTarget) return;

    setIsDeleting(true);
    try {
      await dataSourceService.delete(deleteTarget.id);
      setDeleteTarget(null);
      showNotification('success', 'Data source deleted successfully');
      onRefetch();
    } catch (err) {
      console.error('Failed to delete data source:', err);
      showNotification('error', 'Failed to delete data source. It may be in use by custom widgets.');
    } finally {
      setIsDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-status-error-bg rounded-lg p-4">
        <p className="text-status-error-text">{error}</p>
        <button onClick={onRefetch} className="mt-2 text-status-error-text hover:underline">
          Try again
        </button>
      </div>
    );
  }

  if (dataSources.length === 0) {
    return (
      <div className="text-center py-12 bg-bg-muted rounded-xl border-2 border-dashed border-border-light">
        <svg className="w-12 h-12 mx-auto text-text-muted mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
        </svg>
        <h3 className="text-lg font-medium text-text-primary mb-1">No data sources yet</h3>
        <p className="text-text-muted mb-4">Create a data source to pull data from external APIs</p>
        <Link
          to="/data-sources/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-accent text-text-inverse rounded-lg hover:bg-accent-hover transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Create Data Source
        </Link>
      </div>
    );
  }

  return (
    <>
      {/* Test All button when too many data sources */}
      {dataSources.length > MAX_AUTO_TEST && (
        <div className="mb-4 flex items-center justify-between bg-status-warning-bg border border-status-warning-border rounded-lg px-4 py-3">
          <p className="text-sm text-status-warning-text">
            {testingIds.size > 0
              ? `Testing ${testingIds.size} of ${dataSources.length} data sources...`
              : `${dataSources.length} data sources found. Click to test all APIs.`}
          </p>
          <button
            onClick={handleTestAll}
            disabled={testingIds.size > 0}
            className="px-4 py-1.5 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
            style={{ backgroundColor: '#F59E0B', color: '#FFFFFF' }}
            onMouseEnter={(e) => {
              if (!e.currentTarget.disabled) {
                e.currentTarget.style.backgroundColor = '#D97706';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#F59E0B';
            }}
          >
            {testingIds.size > 0 ? `Testing${getWaitingDots()}` : 'Test All'}
          </button>
        </div>
      )}

      <div className="bg-bg-card rounded-xl shadow-sm border border-border-light overflow-hidden">
        <table className="min-w-full divide-y divide-border-light">
          <thead className="bg-bg-muted">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                Widgets
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-text-muted uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-bg-card divide-y divide-border-light">
            {dataSources.map((ds) => (
              <tr key={ds.id} className="hover:bg-bg-muted">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div>
                    <div className="text-sm font-medium text-text-primary">{ds.name}</div>
                    <div className="text-xs text-text-muted truncate max-w-xs">{ds.url}</div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className="px-2 py-1 text-xs font-medium rounded-full"
                    style={ds.type === 'json' ? {
                      backgroundColor: '#DBEAFE',
                      color: '#2563EB',
                    } : {
                      backgroundColor: '#FEF3C7',
                      color: '#D97706',
                    }}
                  >
                    {ds.type.toUpperCase()}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <button
                    onClick={() => handleTestDataSource(ds.id)}
                    disabled={testingIds.has(ds.id)}
                    className="px-2 py-1 text-xs font-medium rounded-full transition-colors min-w-[80px]"
                    style={
                      testingIds.has(ds.id)
                        ? { backgroundColor: '#FEF3C7', color: '#D97706' }
                        : ds.lastError
                          ? { backgroundColor: '#FEE2E2', color: '#DC2626' }
                          : ds.lastFetchedAt
                            ? { backgroundColor: '#DCFCE7', color: '#16A34A' }
                            : { backgroundColor: '#F3F4F6', color: '#6B7280' }
                    }
                    title={ds.lastError ? `Error: ${ds.lastError}\nClick to test again` : 'Click to test API'}
                  >
                    {testingIds.has(ds.id) ? (
                      <span className="font-mono">Waiting{getWaitingDots()}</span>
                    ) : ds.lastError ? (
                      'Not responding'
                    ) : ds.lastFetchedAt ? (
                      'Active'
                    ) : (
                      'Test'
                    )}
                  </button>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-text-muted">
                  {ds._count?.customWidgets || 0}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <div className="flex items-center justify-end gap-3">
                    <Link
                      to={`/data-sources/${ds.id}/edit`}
                      className="text-sm font-medium transition-colors"
                      style={{ color: '#2563EB' }}
                      onMouseEnter={(e) => e.currentTarget.style.color = '#1D4ED8'}
                      onMouseLeave={(e) => e.currentTarget.style.color = '#2563EB'}
                    >
                      Edit
                    </Link>
                    <button
                      onClick={() => setDeleteTarget(ds)}
                      className="text-sm font-medium transition-colors"
                      style={{ color: '#DC2626' }}
                      onMouseEnter={(e) => e.currentTarget.style.color = '#B91C1C'}
                      onMouseLeave={(e) => e.currentTarget.style.color = '#DC2626'}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Loading more indicator */}
      {loadingMore && (
        <div className="py-4 text-center">
          <div className="inline-flex items-center gap-2 text-text-muted">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-accent" />
            <span className="text-sm">Loading more...</span>
          </div>
        </div>
      )}

      {/* End of list indicator */}
      {!hasMore && dataSources.length > 0 && (
        <div className="py-4 text-center text-text-muted text-sm">
          Showing all {total} data sources
        </div>
      )}

      {/* Sentinel element for infinite scroll */}
      <div ref={sentinelRef} />

      <ConfirmDeleteModal
        isOpen={!!deleteTarget}
        title="Delete Data Source"
        message="Are you sure you want to delete this data source? This action cannot be undone."
        itemName={deleteTarget?.name || ''}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        isDeleting={isDeleting}
      />
    </>
  );
}

/**
 * Custom Widgets Tab Content
 */
function CustomWidgetsTab({
  customWidgets,
  loading,
  loadingMore,
  hasMore,
  error,
  onRefetch,
  sentinelRef,
  total,
}: {
  customWidgets: CustomWidget[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  error: string | null;
  onRefetch: () => void;
  sentinelRef: React.RefObject<HTMLDivElement | null>;
  total: number;
}) {
  const { showNotification } = useNotification();
  const [deleteTarget, setDeleteTarget] = useState<CustomWidget | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [previews, setPreviews] = useState<Record<number, CustomWidgetPreview>>({});
  const [previewLoading, setPreviewLoading] = useState<Record<number, boolean>>({});

  // Load previews when widgets change
  useEffect(() => {
    if (customWidgets.length > 0) {
      customWidgets.forEach((widget) => {
        loadPreview(widget.id);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadPreview checks internal state before loading
  }, [customWidgets]);

  const loadPreview = async (id: number) => {
    if (previews[id] || previewLoading[id]) return;

    setPreviewLoading((prev) => ({ ...prev, [id]: true }));
    try {
      const preview = await customWidgetService.getPreview(id);
      setPreviews((prev) => ({ ...prev, [id]: preview }));
    } catch {
      // Silent fail for preview loading
    } finally {
      setPreviewLoading((prev) => ({ ...prev, [id]: false }));
    }
  };

  // Render preview content using the shared component
  const renderPreviewContent = (preview: CustomWidgetPreview) => {
    const { widget, data } = preview;

    if (!data) {
      return <span className="text-text-placeholder italic text-sm">---</span>;
    }

    return (
      <CustomWidgetPreviewRenderer
        displayType={widget.displayType}
        config={(widget.config as Record<string, unknown>) || {}}
        sampleData={data}
        fontSize={16}
      />
    );
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    setIsDeleting(true);
    try {
      await customWidgetService.delete(deleteTarget.id);
      setDeleteTarget(null);
      showNotification('success', 'Custom widget deleted successfully');
      onRefetch();
    } catch (err) {
      console.error('Failed to delete custom widget:', err);
      showNotification('error', 'Failed to delete custom widget.');
    } finally {
      setIsDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-status-error-bg rounded-lg p-4">
        <p className="text-status-error-text">{error}</p>
        <button onClick={onRefetch} className="mt-2 text-status-error-text hover:underline">
          Try again
        </button>
      </div>
    );
  }

  if (customWidgets.length === 0) {
    return (
      <div className="text-center py-12 bg-bg-muted rounded-xl border-2 border-dashed border-border-light">
        <svg className="w-12 h-12 mx-auto text-text-muted mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
        </svg>
        <h3 className="text-lg font-medium text-text-primary mb-1">No custom widgets yet</h3>
        <p className="text-text-muted mb-4">Create a custom widget using your data sources</p>
        <Link
          to="/custom-widgets/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-accent text-text-inverse rounded-lg hover:bg-accent-hover transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Create Custom Widget
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {customWidgets.map((widget) => (
          <div
            key={widget.id}
            className="bg-bg-card rounded-xl shadow-sm border border-border-light p-5 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-text-primary truncate">{widget.name}</h3>
                {widget.description && (
                  <p className="text-sm text-text-muted mt-1 truncate">{widget.description}</p>
                )}
              </div>
              <span
                className="ml-2 px-2 py-1 text-xs font-medium rounded-full flex-shrink-0"
                style={
                  widget.displayType === 'value'
                    ? { backgroundColor: '#DBEAFE', color: '#2563EB' }
                    : widget.displayType === 'list'
                    ? { backgroundColor: '#DCFCE7', color: '#16A34A' }
                    : { backgroundColor: '#F3E8FF', color: '#9333EA' }
                }
              >
                {widget.displayType}
              </span>
            </div>

            {widget.dataSource && (
              <p className="text-xs text-text-placeholder mb-3">
                Data from: {widget.dataSource.name}
              </p>
            )}

            {/* Widget Preview - styled like Live Preview in form */}
            <div className="rounded-lg overflow-hidden mb-4 bg-gradient-to-br from-bg-muted to-border-light p-4 flex items-center justify-center min-h-[120px]">
              <div
                className="bg-bg-card rounded-lg shadow-lg p-4 flex items-center justify-center"
                style={{
                  minWidth: Math.min(widget.minWidth || 100, 200),
                  minHeight: Math.min(widget.minHeight || 60, 100),
                  maxWidth: '100%',
                }}
              >
                {previewLoading[widget.id] ? (
                  <div className="flex items-center gap-2 text-text-placeholder">
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  </div>
                ) : previews[widget.id] ? (
                  <div className="w-full h-full">{renderPreviewContent(previews[widget.id])}</div>
                ) : (
                  <span className="text-text-placeholder text-sm italic">--</span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Link
                to={`/custom-widgets/${widget.id}/edit`}
                className="flex-1 px-3 py-1.5 text-sm text-center rounded-lg transition-colors"
                style={{ backgroundColor: '#DBEAFE', color: '#2563EB' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#BFDBFE';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#DBEAFE';
                }}
              >
                Edit
              </Link>
              <button
                onClick={() => setDeleteTarget(widget)}
                className="p-1.5 rounded-lg transition-colors"
                style={{ color: '#6B7280' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#FEE2E2';
                  e.currentTarget.style.color = '#DC2626';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = '#6B7280';
                }}
                title="Delete widget"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Loading more indicator */}
      {loadingMore && (
        <div className="py-4 text-center">
          <div className="inline-flex items-center gap-2 text-text-muted">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-accent" />
            <span className="text-sm">Loading more...</span>
          </div>
        </div>
      )}

      {/* End of list indicator */}
      {!hasMore && customWidgets.length > 0 && (
        <div className="py-4 text-center text-text-muted text-sm">
          Showing all {total} custom widgets
        </div>
      )}

      {/* Sentinel element for infinite scroll */}
      <div ref={sentinelRef} />

      <ConfirmDeleteModal
        isOpen={!!deleteTarget}
        title="Delete Custom Widget"
        message="Are you sure you want to delete this custom widget? This action cannot be undone."
        itemName={deleteTarget?.name || ''}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        isDeleting={isDeleting}
      />
    </>
  );
}
