import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { customWidgetService } from '../../services/api';
import { useNotification } from '../../contexts/NotificationContext';
import { MainLayout } from '../../components/layout';
import { EInkImage } from '../../components/common';
import type { CustomWidgetPreview as PreviewType } from '../../types';

export function CustomWidgetPreview() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { showNotification } = useNotification();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [preview, setPreview] = useState<PreviewType | null>(null);

  useEffect(() => {
    if (id) {
      loadPreview(parseInt(id, 10));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadPreview uses stable dependencies
  }, [id]);

  const loadPreview = async (widgetId: number) => {
    try {
      setLoading(true);
      const data = await customWidgetService.getPreview(widgetId);
      setPreview(data);
    } catch {
      showNotification('error', 'Failed to load preview');
      navigate('/extensions?tab=custom-widgets');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    if (!id) return;

    try {
      setRefreshing(true);
      const data = await customWidgetService.getPreview(parseInt(id, 10));
      setPreview(data);
      showNotification('success', 'Preview refreshed');
    } catch {
      showNotification('error', 'Failed to refresh');
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" />
        </div>
      </MainLayout>
    );
  }

  if (!preview) {
    return <MainLayout><div /></MainLayout>;
  }

  const { widget, data, renderedContent } = preview;
  const config = widget.config as Record<string, unknown>;
  const fontSize = (config.fontSize as number) || 24;

  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/extensions?tab=custom-widgets')}
            className="p-2 text-text-secondary hover:text-text-primary hover:bg-bg-muted rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <div>
            <h1 className="text-2xl font-bold text-text-primary">{widget.name}</h1>
            <p className="mt-1 text-sm text-text-muted">Widget Preview</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-2 px-4 py-2 bg-bg-muted text-text-secondary rounded-lg hover:bg-border-light transition-colors disabled:opacity-50"
          >
            {refreshing ? (
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            )}
            Refresh
          </button>
          <button
            onClick={() => navigate(`/custom-widgets/${id}/edit`)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent-hover transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Edit
          </button>
        </div>
      </div>

      {/* Preview Card */}
      <div className="bg-white rounded-xl shadow-sm border border-border-light overflow-hidden">
        <div className="p-6 border-b border-border-light">
          <h2 className="text-lg font-medium text-text-primary">Live Preview</h2>
          <p className="text-sm text-text-muted">
            This is how your widget will appear in the screen designer
          </p>
        </div>

        {/* Widget Preview Area */}
        <div className="p-8 bg-bg-muted flex items-center justify-center">
          <div
            className="bg-white border-2 border-dashed border-border-default rounded-lg flex items-center justify-center p-6"
            style={{
              minWidth: widget.minWidth,
              minHeight: widget.minHeight,
            }}
          >
            <div style={{ fontSize: `${fontSize}px` }} className="text-center w-full">
              {typeof renderedContent === 'string' ? (
                // Check if fieldType is 'image' - render with EInkImage for e-ink optimization
                config.fieldType === 'image' ? (
                  <EInkImage
                    src={renderedContent}
                    alt="Widget content"
                    fit="contain"
                    maxHeight="200px"
                  />
                ) : (
                  <span>{renderedContent}</span>
                )
              ) : Array.isArray(renderedContent) ? (
                <ul className="text-left list-disc list-inside space-y-1">
                  {renderedContent.map((item, i) => (
                    <li key={i} style={{ fontSize: `${fontSize * 0.75}px` }}>
                      {item}
                    </li>
                  ))}
                </ul>
              ) : typeof renderedContent === 'object' && renderedContent !== null && 'type' in renderedContent && renderedContent.type === 'grid' ? (
                // Grid display type
                <div
                  className="grid w-full"
                  style={{
                    gridTemplateColumns: `repeat(${(renderedContent as { gridCols: number }).gridCols || 2}, 1fr)`,
                    gap: `${(renderedContent as { gridGap: number }).gridGap || 8}px`,
                  }}
                >
                  {((renderedContent as { cells: Array<{ label?: string; formattedValue: string }> }).cells || []).map((cell, i) => (
                    <div key={i} className="text-center">
                      {cell.label && (
                        <div className="text-text-muted" style={{ fontSize: `${fontSize * 0.5}px` }}>{cell.label}</div>
                      )}
                      <div className="font-bold" style={{ fontSize: `${fontSize * 0.8}px` }}>{cell.formattedValue}</div>
                    </div>
                  ))}
                </div>
              ) : typeof renderedContent === 'object' && renderedContent !== null ? (
                <div>
                  {'title' in renderedContent && 'value' in renderedContent ? (
                    <>
                      <div className="text-text-muted" style={{ fontSize: `${fontSize * 0.6}px` }}>
                        {String(renderedContent.title)}
                      </div>
                      {config.valueFieldType === 'image' ? (
                        <div className="mt-2">
                          <EInkImage
                            src={String(renderedContent.value)}
                            alt="Widget content"
                            fit="contain"
                            maxHeight="200px"
                          />
                        </div>
                      ) : (
                        <div className="font-bold">{String(renderedContent.value)}</div>
                      )}
                    </>
                  ) : 'label' in renderedContent && 'value' in renderedContent ? (
                    <>
                      <div className="text-text-muted" style={{ fontSize: `${fontSize * 0.6}px` }}>
                        {String(renderedContent.label)}
                      </div>
                      <div className="font-bold">{String(renderedContent.value)}</div>
                    </>
                  ) : (
                    <pre className="text-sm text-left">
                      {JSON.stringify(renderedContent, null, 2)}
                    </pre>
                  )}
                </div>
              ) : (
                <span className="text-text-placeholder">No content</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Widget Info */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Configuration */}
        <div className="bg-white rounded-xl shadow-sm border border-border-light p-6">
          <h3 className="text-lg font-medium text-text-primary mb-4">Configuration</h3>
          <dl className="space-y-3">
            <div className="flex justify-between">
              <dt className="text-sm text-text-muted">Display Type</dt>
              <dd className="text-sm font-medium text-text-primary capitalize">{widget.displayType}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-sm text-text-muted">Data Source</dt>
              <dd className="text-sm font-medium text-text-primary">{widget.dataSource?.name}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-sm text-text-muted">Min Size</dt>
              <dd className="text-sm font-medium text-text-primary">
                {widget.minWidth} x {widget.minHeight}px
              </dd>
            </div>
            {widget.template && (
              <div className="pt-2 border-t border-border-light">
                <dt className="text-sm text-text-muted mb-1">Template</dt>
                <dd className="text-sm font-mono bg-bg-muted p-2 rounded">{widget.template}</dd>
              </div>
            )}
          </dl>
        </div>

        {/* Raw Data */}
        <div className="bg-white rounded-xl shadow-sm border border-border-light p-6">
          <h3 className="text-lg font-medium text-text-primary mb-4">Raw Data</h3>
          <pre className="text-xs bg-bg-muted p-3 rounded overflow-auto max-h-64 text-text-secondary">
            {JSON.stringify(data, null, 2)}
          </pre>
        </div>
      </div>
      </div>
    </MainLayout>
  );
}
