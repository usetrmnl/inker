import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { dataSourceService } from '../../services/api';
import { useNotification } from '../../contexts/NotificationContext';
import { MainLayout } from '../../components/layout';
import type { DataSourceFormData, DataSourceTestResult, FieldMeta } from '../../types';

export function DataSourceForm() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEditing = Boolean(id);
  const { showNotification } = useNotification();

  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<DataSourceTestResult | null>(null);

  const [formData, setFormData] = useState<DataSourceFormData>({
    name: '',
    description: '',
    type: 'json',
    url: '',
    method: 'GET',
    headers: {},
    refreshInterval: 300,
    isActive: true,
  });

  const [headerKey, setHeaderKey] = useState('');
  const [headerValue, setHeaderValue] = useState('');
  const [showRawData, setShowRawData] = useState(false);
  const [expandedArrays, setExpandedArrays] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (isEditing && id) {
      loadDataSource(parseInt(id, 10));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadDataSource uses stable dependencies
  }, [id, isEditing]);

  const loadDataSource = async (dataSourceId: number) => {
    try {
      const ds = await dataSourceService.getById(dataSourceId);
      setFormData({
        name: ds.name,
        description: ds.description || '',
        type: ds.type,
        url: ds.url,
        method: ds.method,
        headers: ds.headers || {},
        refreshInterval: ds.refreshInterval,
        isActive: ds.isActive,
      });
    } catch {
      showNotification('error', 'Failed to load data source');
      navigate('/extensions');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      showNotification('error', 'Name is required');
      return;
    }

    if (!formData.url.trim()) {
      showNotification('error', 'URL is required');
      return;
    }

    try {
      setSaving(true);

      if (isEditing && id) {
        await dataSourceService.update(parseInt(id, 10), formData);
        showNotification('success', 'Data source updated');
      } else {
        await dataSourceService.create(formData);
        showNotification('success', 'Data source created');
      }

      navigate('/extensions');
    } catch (error) {
      showNotification('error', error instanceof Error ? error.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  /**
   * Test the URL without saving - works for both new and existing data sources!
   * This calls the new test-url endpoint that doesn't require a saved data source.
   */
  const handleTestUrl = async () => {
    if (!formData.url.trim()) {
      showNotification('error', 'Please enter a URL to test');
      return;
    }

    try {
      setTesting(true);
      setTestResult(null);

      const result = await dataSourceService.testUrl({
        url: formData.url,
        type: formData.type,
        method: formData.method,
        headers: formData.headers,
      });

      setTestResult(result);

      if (result.success) {
        showNotification('success', `Found ${result.fields?.length || 0} fields`);
      } else {
        showNotification('error', `Test failed: ${result.error}`);
      }
    } catch (error) {
      showNotification('error', error instanceof Error ? error.message : 'Test failed');
    } finally {
      setTesting(false);
    }
  };

  const addHeader = () => {
    if (!headerKey.trim()) return;

    setFormData({
      ...formData,
      headers: {
        ...formData.headers,
        [headerKey]: headerValue,
      },
    });
    setHeaderKey('');
    setHeaderValue('');
  };

  const removeHeader = (key: string) => {
    const newHeaders = { ...formData.headers };
    delete newHeaders[key];
    setFormData({ ...formData, headers: newHeaders });
  };

  /**
   * Render the type badge for a field.
   * Shows special badges for image URLs and links.
   */
  const renderTypeBadge = (field: FieldMeta) => {
    const typeColors: Record<string, string> = {
      string: 'bg-status-info-bg text-status-info-text',
      number: 'bg-status-success-bg text-status-success-text',
      boolean: 'bg-status-warning-bg text-status-warning-text',
      array: 'bg-accent-light text-accent',
      object: 'bg-bg-muted text-text-secondary',
      null: 'bg-bg-muted text-text-muted',
    };

    return (
      <div className="flex items-center gap-2">
        <span className={`px-2 py-0.5 text-xs font-medium rounded ${typeColors[field.type] || 'bg-bg-muted text-text-secondary'}`}>
          {field.type}
        </span>
        {field.isImageUrl && (
          <span className="px-2 py-0.5 text-xs font-medium rounded bg-status-error-bg text-status-error-text flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Image
          </span>
        )}
        {field.isLink && !field.isImageUrl && (
          <span className="px-2 py-0.5 text-xs font-medium rounded bg-accent-light text-accent flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
            Link
          </span>
        )}
      </div>
    );
  };

  /**
   * Format sample value for display
   */
  const formatSample = (sample: unknown): string => {
    if (sample === null || sample === undefined) return 'null';
    if (typeof sample === 'string') {
      if (sample.length > 60) {
        return sample.substring(0, 60) + '...';
      }
      return sample;
    }
    return String(sample);
  };

  /**
   * Toggle array expansion
   */
  const toggleArray = (arrayName: string) => {
    setExpandedArrays((prev) => {
      const next = new Set(prev);
      if (next.has(arrayName)) {
        next.delete(arrayName);
      } else {
        next.add(arrayName);
      }
      return next;
    });
  };

  /**
   * Group fields by array prefix for collapsible display
   * Returns: { arrayName: { arrayField, indices: FieldMeta[] }, ... }
   */
  const groupFieldsByArray = (fields: FieldMeta[]) => {
    const groups: Map<string, { arrayField: FieldMeta | null; indices: FieldMeta[] }> = new Map();
    const standalone: FieldMeta[] = [];

    fields.forEach((field) => {
      // Check if this field is nested inside an array (e.g., results[0].authors)
      const arrayMatch = field.path.match(/^([^[]+)\[(\d+)\](.*)$/);

      if (arrayMatch) {
        // This field is inside an array - group it under the parent array
        const [, arrayName] = arrayMatch;
        if (!groups.has(arrayName)) {
          groups.set(arrayName, { arrayField: null, indices: [] });
        }
        groups.get(arrayName)!.indices.push(field);
      } else if (field.type === 'array') {
        // This is a top-level array field
        if (!groups.has(field.path)) {
          groups.set(field.path, { arrayField: field, indices: [] });
        } else {
          const group = groups.get(field.path)!;
          group.arrayField = field;
        }
      } else {
        // Standalone field (not in array, not an array)
        standalone.push(field);
      }
    });

    return { groups, standalone };
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

  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/extensions')}
          className="p-2 text-text-secondary hover:text-text-primary hover:bg-bg-muted rounded-lg transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>
        <div>
          <h1 className="text-2xl font-bold text-text-primary">
            {isEditing ? 'Edit Data Source' : 'New Data Source'}
          </h1>
          <p className="mt-1 text-sm text-text-muted">
            {isEditing ? 'Update your data source configuration' : 'Connect to an external API or RSS feed'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-bg-card rounded-xl shadow-sm border border-border-light p-6 space-y-6">
            {/* Basic Info */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-text-primary">Basic Information</h3>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-border-default rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent"
                  placeholder="e.g., Random Dog API"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-border-default rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent"
                  placeholder="Optional description..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">Type</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      value="json"
                      checked={formData.type === 'json'}
                      onChange={() => setFormData({ ...formData, type: 'json' })}
                      className="text-accent focus:ring-accent"
                    />
                    <span className="text-sm">JSON API</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      value="rss"
                      checked={formData.type === 'rss'}
                      onChange={() => setFormData({ ...formData, type: 'rss' })}
                      className="text-accent focus:ring-accent"
                    />
                    <span className="text-sm">RSS/Atom Feed</span>
                  </label>
                </div>
              </div>
            </div>

            {/* URL & Method */}
            <div className="space-y-4 pt-4 border-t border-border-light">
              <h3 className="text-lg font-medium text-text-primary">Connection</h3>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">URL</label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={formData.url}
                    onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                    className="flex-1 px-3 py-2 border border-border-default rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent"
                    placeholder="https://api.example.com/data"
                  />
                  <button
                    type="button"
                    onClick={handleTestUrl}
                    disabled={testing || !formData.url.trim()}
                    className="px-4 py-2 bg-accent text-text-inverse rounded-lg hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 whitespace-nowrap"
                  >
                    {testing ? (
                      <>
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Testing...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        Test URL
                      </>
                    )}
                  </button>
                </div>
                <p className="mt-1 text-xs text-text-muted">
                  Click "Test URL" to see available fields before saving
                </p>
              </div>

              {formData.type === 'json' && (
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">HTTP Method</label>
                  <select
                    value={formData.method}
                    onChange={(e) => setFormData({ ...formData, method: e.target.value as 'GET' | 'POST' })}
                    className="w-full px-3 py-2 border border-border-default rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent"
                  >
                    <option value="GET">GET</option>
                    <option value="POST">POST</option>
                  </select>
                </div>
              )}

              {/* Headers */}
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">Custom Headers</label>
                <p className="text-xs text-text-muted mb-2">Add headers for authentication or custom requirements</p>

                {/* Existing headers */}
                {Object.entries(formData.headers || {}).length > 0 && (
                  <div className="space-y-2 mb-3">
                    {Object.entries(formData.headers || {}).map(([key, value]) => (
                      <div key={key} className="flex items-center gap-2 bg-bg-muted px-3 py-2 rounded-lg">
                        <span className="font-medium text-sm text-text-secondary">{key}:</span>
                        <span className="text-sm text-text-secondary flex-1 truncate">{value}</span>
                        <button
                          type="button"
                          onClick={() => removeHeader(key)}
                          className="text-status-error-text hover:opacity-80"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add header */}
                <div className="flex gap-2 items-center">
                  <input
                    type="text"
                    value={headerKey}
                    onChange={(e) => setHeaderKey(e.target.value)}
                    className="flex-1 min-w-0 px-3 py-2 border border-border-default rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent text-sm"
                    placeholder="Header name"
                  />
                  <input
                    type="text"
                    value={headerValue}
                    onChange={(e) => setHeaderValue(e.target.value)}
                    className="flex-1 min-w-0 px-3 py-2 border border-border-default rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent text-sm"
                    placeholder="Header value"
                  />
                  <button
                    type="button"
                    onClick={addHeader}
                    className="flex-shrink-0 px-3 py-2 bg-bg-muted text-text-secondary rounded-lg hover:bg-border-light transition-colors text-sm"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>

            {/* Settings */}
            <div className="space-y-4 pt-4 border-t border-border-light">
              <h3 className="text-lg font-medium text-text-primary">Settings</h3>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">
                  Refresh Interval (seconds)
                </label>
                <input
                  type="number"
                  value={formData.refreshInterval}
                  onChange={(e) => setFormData({ ...formData, refreshInterval: parseInt(e.target.value, 10) || 300 })}
                  min={60}
                  className="w-full px-3 py-2 border border-border-default rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent"
                />
                <p className="mt-1 text-xs text-text-muted">Minimum: 60 seconds</p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => navigate('/extensions')}
              className="px-4 py-2 text-text-secondary hover:text-text-primary transition-colors"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-accent text-text-inverse rounded-lg hover:bg-accent-hover transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Saving...
                </>
              ) : (
                <>{isEditing ? 'Save Changes' : 'Create Data Source'}</>
              )}
            </button>
          </div>
        </form>

        {/* Right: Available Fields */}
        <div className="space-y-4">
          {/* Fields Table */}
          <div className="bg-bg-card rounded-xl shadow-sm border border-border-light overflow-hidden">
            <div className="px-4 py-3 bg-bg-muted border-b border-border-light flex items-center justify-between">
              <h3 className="font-medium text-text-primary">Available Fields</h3>
              {testResult?.fields && testResult.fields.length > 0 && (
                <span className="px-2 py-0.5 text-xs font-medium rounded bg-status-success-bg text-status-success-text">
                  {testResult.fields.length} fields found
                </span>
              )}
            </div>

            {!testResult ? (
              <div className="p-8 text-center">
                <div className="w-16 h-16 mx-auto mb-4 bg-bg-muted rounded-full flex items-center justify-center">
                  <svg className="w-8 h-8 text-text-placeholder" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h4 className="font-medium text-text-primary mb-2">No data yet</h4>
                <p className="text-sm text-text-muted">
                  Enter a URL and click "Test URL" to see available fields
                </p>
              </div>
            ) : !testResult.success ? (
              <div className="p-6 text-center">
                <div className="w-16 h-16 mx-auto mb-4 bg-status-error-bg rounded-full flex items-center justify-center">
                  <svg className="w-8 h-8 text-status-error-text" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h4 className="font-medium text-status-error-text mb-2">Test Failed</h4>
                <p className="text-sm text-status-error-text">{testResult.error}</p>
              </div>
            ) : testResult.fields && testResult.fields.length > 0 ? (
              <div className="divide-y divide-border-light max-h-[500px] overflow-auto">
                {(() => {
                  const { groups, standalone } = groupFieldsByArray(testResult.fields);
                  return (
                    <>
                      {/* Standalone fields (not in arrays) */}
                      {standalone.map((field, index) => (
                        <div key={`standalone-${index}`} className="p-3 hover:bg-bg-muted">
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0 flex-1">
                              <code className="text-sm font-medium text-accent bg-accent-light px-2 py-0.5 rounded">
                                {field.path}
                              </code>
                              <div className="mt-1 text-xs text-text-muted truncate">
                                {formatSample(field.sample)}
                              </div>
                            </div>
                            <div className="flex-shrink-0">
                              {renderTypeBadge(field)}
                            </div>
                          </div>
                        </div>
                      ))}

                      {/* Array groups with collapsible indices */}
                      {Array.from(groups.entries()).map(([arrayName, { arrayField, indices }]) => (
                        <div key={arrayName} className="border-b border-border-light last:border-b-0">
                          {/* Array header - clickable to expand */}
                          <button
                            type="button"
                            onClick={() => toggleArray(arrayName)}
                            className="w-full p-3 hover:bg-bg-muted flex items-center justify-between gap-4 text-left"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <svg
                                  className={`w-4 h-4 text-text-placeholder transition-transform ${expandedArrays.has(arrayName) ? 'rotate-90' : ''}`}
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                                <code className="text-sm font-medium text-accent bg-accent-light px-2 py-0.5 rounded">
                                  {arrayName}
                                </code>
                              </div>
                              <div className="mt-1 text-xs text-text-muted ml-6">
                                {arrayField?.sample ? formatSample(arrayField.sample) : `${indices.length} items`}
                              </div>
                            </div>
                            <div className="flex-shrink-0 flex items-center gap-2">
                              <span className="px-2 py-0.5 text-xs font-medium rounded bg-accent-light text-accent">
                                array
                              </span>
                              <span className="text-xs text-text-placeholder">
                                {indices.length} fields
                              </span>
                            </div>
                          </button>

                          {/* Expanded array indices */}
                          {expandedArrays.has(arrayName) && indices.length > 0 && (
                            <div className="bg-bg-muted border-t border-border-light">
                              {indices.map((field, idx) => (
                                <div key={idx} className="p-3 pl-8 hover:bg-border-light border-b border-border-light last:border-b-0">
                                  <div className="flex items-start justify-between gap-4">
                                    <div className="min-w-0 flex-1">
                                      <code className="text-sm font-medium text-accent bg-accent-light px-2 py-0.5 rounded">
                                        {field.path}
                                      </code>
                                      <div className="mt-1 text-xs text-text-muted truncate">
                                        {formatSample(field.sample)}
                                      </div>
                                    </div>
                                    <div className="flex-shrink-0">
                                      {renderTypeBadge(field)}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </>
                  );
                })()}
              </div>
            ) : (
              <div className="p-6 text-center">
                <p className="text-sm text-text-muted">No fields found in response</p>
              </div>
            )}
          </div>

          {/* Raw Data Viewer */}
          {testResult?.success && !!testResult.data && (
            <div className="bg-bg-card rounded-xl shadow-sm border border-border-light overflow-hidden">
              <button
                onClick={() => setShowRawData(!showRawData)}
                className="w-full px-4 py-3 bg-bg-muted border-b border-border-light flex items-center justify-between hover:bg-border-light transition-colors"
              >
                <h3 className="font-medium text-text-secondary">Raw Data</h3>
                <svg
                  className={`w-5 h-5 text-text-muted transition-transform ${showRawData ? 'rotate-180' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {showRawData && (
                <pre className="p-4 text-xs overflow-auto max-h-64 bg-gray-900 text-green-400">
                  {JSON.stringify(testResult.data, null, 2)}
                </pre>
              )}
            </div>
          )}

          {/* Help Text */}
          <div className="bg-status-info-bg rounded-xl p-4">
            <h4 className="font-medium text-status-info-text mb-2">How to use</h4>
            <ol className="text-sm text-status-info-text space-y-1 list-decimal list-inside">
              <li>Enter the API URL</li>
              <li>Click "Test URL" to fetch and see available fields</li>
              <li>Fields marked with <span className="inline-flex items-center gap-1 px-1 py-0.5 bg-status-error-bg text-status-error-text rounded text-xs">Image</span> can be displayed as images in widgets</li>
              <li>Save the data source to use it in widgets</li>
            </ol>
          </div>
        </div>
      </div>
      </div>
    </MainLayout>
  );
}
