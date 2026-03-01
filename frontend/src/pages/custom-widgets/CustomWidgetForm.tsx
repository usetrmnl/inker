import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { customWidgetService, dataSourceService } from '../../services/api';
import { useNotification } from '../../contexts/NotificationContext';
import { ScriptEditor, type ScriptExecutionResult } from '../../components/common/ScriptEditor';
import { CustomWidgetPreviewRenderer } from '../../components/common';
import { MainLayout } from '../../components/layout';
import type { CustomWidgetFormData, CustomWidgetDisplayType, DataSource, FieldMeta, FieldDisplayType, GridCellConfig, CellAlignment, CellVerticalAlignment } from '../../types';

const DISPLAY_TYPES: { value: CustomWidgetDisplayType; label: string; description: string; icon: React.ReactNode }[] = [
  {
    value: 'value',
    label: 'Single Value',
    description: 'Show one field with optional label',
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
      </svg>
    ),
  },
  {
    value: 'list',
    label: 'List',
    description: 'Show multiple items',
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
      </svg>
    ),
  },
  {
    value: 'script',
    label: 'JavaScript',
    description: 'Transform data with code',
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
      </svg>
    ),
  },
  {
    value: 'grid',
    label: 'Grid',
    description: 'Multiple values in a grid layout',
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
      </svg>
    ),
  },
];

const FIELD_DISPLAY_TYPES: { value: FieldDisplayType; label: string; icon: React.ReactNode }[] = [
  {
    value: 'text',
    label: 'Text',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    value: 'image',
    label: 'Image',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    value: 'number',
    label: 'Number',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
      </svg>
    ),
  },
  {
    value: 'link',
    label: 'Link',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
      </svg>
    ),
  },
];

export function CustomWidgetForm() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEditing = Boolean(id);
  const { showNotification } = useNotification();

  // UI state
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingSource, setTestingSource] = useState(false);

  // Data
  const [dataSources, setDataSources] = useState<DataSource[]>([]);
  const [sampleData, setSampleData] = useState<unknown>(null);
  const [availableFields, setAvailableFields] = useState<FieldMeta[]>([]);
  const [scriptResult, setScriptResult] = useState<ScriptExecutionResult | null>(null);

  // Form data
  // Note: Font settings (fontSize, fontFamily, etc.) are configured in the screen designer,
  // not here. This form only handles data source connection and field mapping.
  const [formData, setFormData] = useState<CustomWidgetFormData>({
    name: '',
    description: '',
    dataSourceId: 0,
    displayType: 'value',
    template: '',
    config: {
      field: '',
      fieldType: 'text' as FieldDisplayType,
      titleField: '',
      valueField: '',
      valueFieldType: 'text' as FieldDisplayType,
      itemField: '',
      maxItems: 5,
      prefix: '',
      suffix: '',
    },
    minWidth: 150,
    minHeight: 80,
  });

  // Load data sources on mount
  useEffect(() => {
    loadDataSources();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Only fetch on mount
  }, []);

  // Load widget if editing
  useEffect(() => {
    if (isEditing && id && dataSources.length > 0) {
      loadWidget(parseInt(id, 10));
    } else if (!isEditing) {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadWidget uses stable dependencies
  }, [id, isEditing, dataSources]);

  const loadDataSources = async () => {
    try {
      const response = await dataSourceService.getAll(1, 1000); // Fetch all for dropdown
      setDataSources(response.items);
    } catch {
      showNotification('error', 'Failed to load data sources');
    }
  };

  const loadWidget = async (widgetId: number) => {
    try {
      const widget = await customWidgetService.getById(widgetId);
      setFormData({
        name: widget.name,
        description: widget.description || '',
        dataSourceId: widget.dataSourceId,
        displayType: widget.displayType,
        template: widget.template || '',
        config: widget.config || {},
        minWidth: widget.minWidth,
        minHeight: widget.minHeight,
      });
      // Skip to last step when editing
      setStep(3);
      // Load sample data for the selected source
      if (widget.dataSourceId) {
        fetchSampleData(widget.dataSourceId);
      }
    } catch {
      showNotification('error', 'Failed to load widget');
      navigate('/extensions?tab=custom-widgets');
    } finally {
      setLoading(false);
    }
  };

  const fetchSampleData = async (sourceId: number) => {
    try {
      setTestingSource(true);
      const result = await dataSourceService.testFetch(sourceId);
      if (result.success) {
        setSampleData(result.data);
        // Use the fields from the test result if available
        if (result.fields) {
          setAvailableFields(result.fields);
        } else {
          // Fallback to extracting fields locally
          const fields = extractFields(result.data);
          setAvailableFields(fields.map(f => ({ path: f, type: 'string' as const, sample: null })));
        }
      } else {
        showNotification('error', `Failed to fetch data: ${result.error}`);
        setSampleData(null);
        setAvailableFields([]);
      }
    } catch {
      showNotification('error', 'Failed to test data source');
      setSampleData(null);
      setAvailableFields([]);
    } finally {
      setTestingSource(false);
    }
  };

  // Extract all field paths from data (fallback)
  const extractFields = (data: unknown, prefix = ''): string[] => {
    const fields: string[] = [];

    if (data === null || data === undefined) return fields;

    if (Array.isArray(data)) {
      if (data.length > 0) {
        const itemFields = extractFields(data[0], prefix ? `${prefix}[0]` : '[0]');
        fields.push(...itemFields);
        if (data.length > 0 && typeof data[0] === 'object') {
          Object.keys(data[0] as object).forEach((key) => {
            if (!fields.includes(key)) fields.push(key);
          });
        }
      }
    } else if (typeof data === 'object') {
      const obj = data as Record<string, unknown>;
      if ('items' in obj && Array.isArray(obj.items)) {
        fields.push('title', 'description', 'link');
        if (obj.items.length > 0) {
          const itemObj = obj.items[0] as Record<string, unknown>;
          Object.keys(itemObj).forEach((key) => {
            if (!fields.includes(key)) fields.push(key);
          });
        }
      } else {
        Object.entries(obj).forEach(([key, value]) => {
          const path = prefix ? `${prefix}.${key}` : key;
          if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            fields.push(...extractFields(value, path));
          } else {
            fields.push(path);
          }
        });
      }
    }

    return [...new Set(fields)];
  };

  const updateConfig = (key: string, value: unknown) => {
    // Use functional setState to ensure we get the latest state
    // This prevents race conditions when multiple updates happen quickly
    setFormData((prev) => ({
      ...prev,
      config: {
        ...prev.config,
        [key]: value,
      },
    }));
  };

  const handleSourceSelect = (sourceId: number) => {
    setFormData({ ...formData, dataSourceId: sourceId });
    setSampleData(null);
    setAvailableFields([]);
    if (sourceId) {
      fetchSampleData(sourceId);
    }
  };

  const handleSubmit = async () => {
    // Collect all validation errors
    const errors: string[] = [];

    if (!formData.name.trim()) {
      errors.push('Widget name is required');
    }

    if (!formData.dataSourceId) {
      errors.push('Data source is required');
    }

    // Display type specific validation
    if (formData.displayType === 'value') {
      const field = (formData.config?.field as string) || '';
      if (!field.trim()) {
        errors.push('Field to display is required');
      }
    }

    if (formData.displayType === 'script') {
      const scriptCode = (formData.config?.scriptCode as string) || '';
      if (!scriptCode.trim()) {
        errors.push('JavaScript code is required');
      }
    }

    if (formData.displayType === 'grid') {
      const gridCells = (formData.config?.gridCells as Record<string, GridCellConfig>) || {};
      const configuredCells = Object.values(gridCells).filter(cell => cell?.field);
      if (configuredCells.length === 0) {
        errors.push('At least one grid cell must be configured');
      }
    }

    // Show errors if any
    if (errors.length > 0) {
      showNotification('error', errors.join('. '));
      // Navigate to appropriate step if data source is missing
      if (!formData.dataSourceId) {
        setStep(1);
      }
      return;
    }

    try {
      setSaving(true);

      if (isEditing && id) {
        await customWidgetService.update(parseInt(id, 10), formData);
        showNotification('success', 'Widget updated');
      } else {
        await customWidgetService.create(formData);
        showNotification('success', 'Widget created');
      }

      navigate('/extensions?tab=custom-widgets');
    } catch (error) {
      showNotification('error', error instanceof Error ? error.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  // Render preview using the shared component
  const renderPreview = useCallback(() => {
    if (!sampleData) {
      return (
        <div className="text-text-placeholder text-sm">
          {testingSource ? 'Loading data...' : 'Select a data source to see preview'}
        </div>
      );
    }

    // For grid display type, show helper message if no cells configured
    if (formData.displayType === 'grid') {
      const cells = (formData.config?.gridCells as Record<string, GridCellConfig>) || {};
      const activeCells = Object.entries(cells).filter(([, cell]) => cell.field || cell.useScript);
      if (activeCells.length === 0) {
        return (
          <div className="text-text-placeholder text-sm text-center">
            Click cells in the grid to configure them
          </div>
        );
      }
    }

    // For script display type, show helper message if no code
    if (formData.displayType === 'script') {
      const code = (formData.config?.scriptCode as string) || '';
      if (!code) {
        return <div className="text-text-placeholder text-sm">Write JavaScript code to see preview</div>;
      }
    }

    return (
      <CustomWidgetPreviewRenderer
        displayType={formData.displayType}
        config={(formData.config as Record<string, unknown>) || {}}
        sampleData={sampleData}
        scriptResult={scriptResult}
        template={formData.template}
        fontSize={24}
      />
    );
  }, [sampleData, formData.displayType, formData.config, formData.template, testingSource, scriptResult]);

  /**
   * Get suggested display type based on field metadata
   */
  const getSuggestedFieldType = (fieldPath: string): FieldDisplayType => {
    const fieldMeta = availableFields.find(f => f.path === fieldPath);
    if (fieldMeta) {
      if (fieldMeta.isImageUrl) return 'image';
      if (fieldMeta.isLink) return 'link';
      if (fieldMeta.type === 'number') return 'number';
    }
    return 'text';
  };

  /**
   * Render field selector with display type dropdown
   * Allows both dropdown selection and manual text input for custom paths like rates[0].mid
   */
  const renderFieldSelector = (
    label: string,
    fieldKey: string,
    fieldTypeKey: string,
    showTypeSelector = true
  ) => {
    const currentField = (formData.config?.[fieldKey] as string) || '';
    const currentType = (formData.config?.[fieldTypeKey] as FieldDisplayType) || 'text';

    return (
      <div className="space-y-2">
        <label className="block text-sm font-medium text-text-secondary">{label}</label>
        <div className="flex gap-2">
          {/* Field input - always allow typing, with datalist for suggestions */}
          <div className="flex-1">
            <input
              type="text"
              list={`${fieldKey}-suggestions`}
              value={currentField}
              onChange={(e) => {
                const newField = e.target.value;
                updateConfig(fieldKey, newField);
                // Auto-suggest display type based on field
                if (showTypeSelector && newField) {
                  const suggestedType = getSuggestedFieldType(newField);
                  updateConfig(fieldTypeKey, suggestedType);
                }
              }}
              className="w-full px-3 py-2 border border-border-default rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent font-mono text-sm"
              placeholder="e.g., rates[0].mid or data.value"
            />
            {availableFields.length > 0 && (
              <datalist id={`${fieldKey}-suggestions`}>
                {availableFields.map((field) => (
                  <option key={field.path} value={field.path}>
                    {field.path}
                    {field.isImageUrl && ' (image)'}
                    {field.isLink && !field.isImageUrl && ' (link)'}
                  </option>
                ))}
              </datalist>
            )}
          </div>

          {/* Display type selector */}
          {showTypeSelector && (
            <select
              value={currentType}
              onChange={(e) => updateConfig(fieldTypeKey, e.target.value as FieldDisplayType)}
              className="px-3 py-2 border border-border-default rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent bg-bg-card"
            >
              {FIELD_DISPLAY_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Hint about array notation */}
        <p className="text-xs text-text-muted">
          Use dot notation for nested fields (e.g., <code className="bg-bg-muted px-1 rounded">rates[0].mid</code>)
        </p>

        {/* Show hint for image fields */}
        {showTypeSelector && currentType === 'image' && (
          <p className="text-xs text-pink-600 flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            This field will be displayed as an image
          </p>
        )}
      </div>
    );
  };

  const selectedSource = dataSources.find((ds) => ds.id === formData.dataSourceId);

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
      <div className="max-w-6xl mx-auto">
        {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate('/extensions?tab=custom-widgets')}
          className="p-2 text-text-secondary hover:text-text-primary hover:bg-bg-muted rounded-lg transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>
        <div>
          <h1 className="text-2xl font-bold text-text-primary">
            {isEditing ? 'Edit Widget' : 'Create Custom Widget'}
          </h1>
          <p className="text-sm text-text-muted">
            {isEditing ? 'Update your widget' : 'Build a widget to display data from external sources'}
          </p>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center justify-center mb-8">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center">
            <button
              onClick={() => s <= step && setStep(s)}
              disabled={s > step}
              className={`
                w-10 h-10 rounded-full flex items-center justify-center font-medium transition-all
                ${step === s
                  ? 'bg-accent text-text-inverse'
                  : s < step
                    ? 'bg-accent-light text-accent hover:bg-accent-light cursor-pointer'
                    : 'bg-bg-muted text-text-placeholder cursor-not-allowed'
                }
              `}
            >
              {s < step ? (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                s
              )}
            </button>
            {s < 3 && (
              <div className={`w-24 h-1 mx-2 rounded ${s < step ? 'bg-accent' : 'bg-bg-muted'}`} />
            )}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Form */}
        <div className="bg-bg-card rounded-xl shadow-sm border border-border-light p-6">
          {/* Step 1: Select Data Source */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-text-primary mb-1">Select Data Source</h2>
                <p className="text-sm text-text-muted">Choose where your widget will get its data</p>
              </div>

              {dataSources.length === 0 ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 mx-auto mb-4 bg-bg-muted rounded-full flex items-center justify-center">
                    <svg className="w-8 h-8 text-text-placeholder" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                    </svg>
                  </div>
                  <h3 className="font-medium text-text-primary mb-2">No Data Sources</h3>
                  <p className="text-sm text-text-muted mb-4">Create a data source first to connect to an API or RSS feed</p>
                  <button
                    onClick={() => navigate('/data-sources/new')}
                    className="px-4 py-2 bg-accent text-text-inverse rounded-lg hover:bg-accent-hover transition-colors"
                  >
                    Create Data Source
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {dataSources.map((ds) => (
                    <button
                      key={ds.id}
                      onClick={() => handleSourceSelect(ds.id)}
                      className={`
                        w-full p-4 rounded-xl border-2 text-left transition-all
                        ${formData.dataSourceId === ds.id
                          ? 'border-accent bg-accent-light'
                          : 'border-border-light hover:border-border-default hover:bg-bg-muted'
                        }
                      `}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-text-primary">{ds.name}</span>
                            <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                              ds.type === 'json' ? 'bg-status-info-bg text-status-info-text' : 'bg-status-warning-bg text-status-warning-text'
                            }`}>
                              {ds.type.toUpperCase()}
                            </span>
                          </div>
                          <p className="text-sm text-text-muted mt-1 truncate">{ds.url}</p>
                        </div>
                        {formData.dataSourceId === ds.id && (
                          <svg className="w-6 h-6 text-accent" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              <div className="flex justify-end pt-4 border-t border-border-light">
                <button
                  onClick={() => setStep(2)}
                  disabled={!formData.dataSourceId}
                  className="px-6 py-2 bg-accent text-text-inverse rounded-lg hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Choose Display Type */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-text-primary mb-1">Choose Display Type</h2>
                <p className="text-sm text-text-muted">How should your data be displayed?</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {DISPLAY_TYPES.map((type) => (
                  <button
                    key={type.value}
                    onClick={() => setFormData({ ...formData, displayType: type.value })}
                    className={`
                      p-4 rounded-xl border-2 text-center transition-all
                      ${formData.displayType === type.value
                        ? 'border-accent bg-accent-light'
                        : 'border-border-light hover:border-border-default hover:bg-bg-muted'
                      }
                    `}
                  >
                    <div className={`mx-auto mb-2 ${formData.displayType === type.value ? 'text-accent' : 'text-text-placeholder'}`}>
                      {type.icon}
                    </div>
                    <div className="font-medium text-text-primary">{type.label}</div>
                    <div className="text-xs text-text-muted mt-1">{type.description}</div>
                  </button>
                ))}
              </div>

              <div className="flex justify-between pt-4 border-t border-border-light">
                <button
                  onClick={() => setStep(1)}
                  className="px-6 py-2 text-text-secondary hover:text-text-primary transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={() => setStep(3)}
                  className="px-6 py-2 bg-accent text-text-inverse rounded-lg hover:bg-accent-hover transition-colors"
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Configure Widget */}
          {step === 3 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-text-primary mb-1">Configure Widget</h2>
                <p className="text-sm text-text-muted">Set up how your widget displays data</p>
              </div>

              {/* Widget Name */}
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">
                  Widget Name <span className="text-status-error-text">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-border-default rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent"
                  placeholder="e.g., Random Dog Image"
                />
              </div>

              {/* Display Type Config */}
              {formData.displayType === 'value' && (
                <div className="space-y-4 p-4 bg-bg-muted rounded-lg">
                  <h3 className="font-medium text-text-primary">Value Settings</h3>
                  {renderFieldSelector('Field to Display', 'field', 'fieldType', true)}

                  {(formData.config?.fieldType as FieldDisplayType) !== 'image' && (
                    <>
                      {/* Label (optional) */}
                      <div>
                        <label className="block text-sm font-medium text-text-secondary mb-1">Label (optional)</label>
                        <input
                          type="text"
                          value={(formData.config?.label as string) || ''}
                          onChange={(e) => updateConfig('label', e.target.value)}
                          className="w-full px-3 py-2 border border-border-default rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent"
                          placeholder="e.g., Price, Temperature, EUR/PLN"
                        />
                        <p className="text-xs text-text-muted mt-1">
                          Displayed above the value
                        </p>
                      </div>

                      {/* Prefix / Suffix */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-text-secondary mb-1">Prefix</label>
                          <input
                            type="text"
                            value={(formData.config?.prefix as string) || ''}
                            onChange={(e) => updateConfig('prefix', e.target.value)}
                            className="w-full px-3 py-2 border border-border-default rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent"
                            placeholder="e.g., $"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-text-secondary mb-1">Suffix</label>
                          <input
                            type="text"
                            value={(formData.config?.suffix as string) || ''}
                            onChange={(e) => updateConfig('suffix', e.target.value)}
                            className="w-full px-3 py-2 border border-border-default rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent"
                            placeholder="e.g., USD"
                          />
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {formData.displayType === 'list' && (
                <div className="space-y-4 p-4 bg-bg-muted rounded-lg">
                  <h3 className="font-medium text-text-primary">List Settings</h3>

                  {/* Array Path - which array in the data to use */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-text-secondary">Array Path</label>
                    <input
                      type="text"
                      list="arrayPath-suggestions"
                      value={(formData.config?.arrayPath as string) || ''}
                      onChange={(e) => updateConfig('arrayPath', e.target.value)}
                      className="w-full px-3 py-2 border border-border-default rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent font-mono text-sm"
                      placeholder="e.g., items, rates, data.results (leave empty for root array)"
                    />
                    {availableFields.length > 0 && (
                      <datalist id="arrayPath-suggestions">
                        {[...new Set(
                          availableFields
                            .filter((f) => f.type === 'array' || f.path.includes('['))
                            .map((field) => field.path.replace(/\[\d+\].*$/, ''))
                        )].map((path) => (
                          <option key={path} value={path} />
                        ))}
                      </datalist>
                    )}
                    <p className="text-xs text-text-muted">
                      Path to the array in JSON data. Leave empty if root is an array.
                    </p>
                  </div>

                  {/* Item Field - which field from each item to display */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-text-secondary">Item Field</label>
                    <input
                      type="text"
                      list="itemField-suggestions"
                      value={(formData.config?.itemField as string) || ''}
                      onChange={(e) => updateConfig('itemField', e.target.value)}
                      className="w-full px-3 py-2 border border-border-default rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent font-mono text-sm"
                      placeholder="e.g., title, name, mid (leave empty to show whole item)"
                    />
                    {availableFields.length > 0 && (
                      <datalist id="itemField-suggestions">
                        {availableFields
                          .filter((f) => f.path.includes('[0].'))
                          .map((field) => {
                            const itemField = field.path.split('[0].')[1];
                            return itemField ? <option key={itemField} value={itemField} /> : null;
                          })}
                      </datalist>
                    )}
                    <p className="text-xs text-text-muted">
                      Field to extract from each array item. Leave empty to use whole item.
                    </p>
                  </div>

                  {/* List Style */}
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-2">List Style</label>
                    <div className="flex gap-3">
                      {[
                        { value: 'bullet', label: '• Bullet' },
                        { value: 'number', label: '1. Number' },
                        { value: 'dash', label: '- Dash' },
                        { value: 'none', label: 'None' },
                      ].map((style) => (
                        <label key={style.value} className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="radio"
                            name="listStyle"
                            value={style.value}
                            checked={(formData.config?.listStyle as string) === style.value || (!formData.config?.listStyle && style.value === 'bullet')}
                            onChange={() => updateConfig('listStyle', style.value)}
                            className="text-accent"
                          />
                          <span className="text-sm">{style.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Max Items */}
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1">
                      Max Items: {(formData.config?.maxItems as number) || 5}
                    </label>
                    <input
                      type="range"
                      min={1}
                      max={20}
                      value={(formData.config?.maxItems as number) || 5}
                      onChange={(e) => updateConfig('maxItems', parseInt(e.target.value, 10))}
                      className="w-full"
                    />
                  </div>
                </div>
              )}

              {formData.displayType === 'script' && (
                <div className="space-y-4 p-4 bg-bg-muted rounded-lg">
                  <h3 className="font-medium text-text-primary">JavaScript Transform</h3>

                  {/* Output Mode Selector */}
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-2">Output Mode</label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="scriptOutputMode"
                          value="value"
                          checked={(formData.config?.scriptOutputMode as string) !== 'template'}
                          onChange={() => updateConfig('scriptOutputMode', 'value')}
                          className="text-accent"
                        />
                        <span className="text-sm">Single Value</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="scriptOutputMode"
                          value="template"
                          checked={(formData.config?.scriptOutputMode as string) === 'template'}
                          onChange={() => updateConfig('scriptOutputMode', 'template')}
                          className="text-accent"
                        />
                        <span className="text-sm">Template Variables</span>
                      </label>
                    </div>
                  </div>

                  {/* Code Editor with CodeMirror */}
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1">
                      JavaScript Code
                    </label>
                    <ScriptEditor
                      value={(formData.config?.scriptCode as string) || ''}
                      onChange={(code) => updateConfig('scriptCode', code)}
                      availableFields={availableFields}
                      sampleData={sampleData}
                      outputMode={(formData.config?.scriptOutputMode as 'value' | 'template') || 'value'}
                      template={formData.template}
                      prefix={(formData.config?.prefix as string) || ''}
                      suffix={(formData.config?.suffix as string) || ''}
                      placeholder={
                        (formData.config?.scriptOutputMode as string) === 'template'
                          ? `// Define variables for your template\nvar EuroX1000 = $.euroPrice * 1000;\nvar formatted = "€" + EuroX1000.toFixed(2);\n// Use in template: {{formatted}}`
                          : `// Return a single value\nreturn $.euroPrice * 1000;`
                      }
                      onExecutionResult={setScriptResult}
                    />
                  </div>

                  {/* Template field for template mode */}
                  {(formData.config?.scriptOutputMode as string) === 'template' && (
                    <div>
                      <label className="block text-sm font-medium text-text-secondary mb-1">
                        Output Template
                      </label>
                      <textarea
                        value={formData.template || ''}
                        onChange={(e) => setFormData({ ...formData, template: e.target.value })}
                        rows={2}
                        className="w-full px-3 py-2 border border-border-default rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent font-mono text-sm"
                        placeholder="Converted: {{formatted}}"
                      />
                      <p className="text-xs text-text-muted mt-1">
                        Use <code className="bg-bg-muted px-1 rounded">{'{{varName}}'}</code> to insert script variables
                      </p>
                    </div>
                  )}

                  {/* Prefix/Suffix for value mode */}
                  {(formData.config?.scriptOutputMode as string) !== 'template' && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-text-secondary mb-1">Prefix</label>
                        <input
                          type="text"
                          value={(formData.config?.prefix as string) || ''}
                          onChange={(e) => updateConfig('prefix', e.target.value)}
                          className="w-full px-3 py-2 border border-border-default rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent"
                          placeholder="e.g., $"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-text-secondary mb-1">Suffix</label>
                        <input
                          type="text"
                          value={(formData.config?.suffix as string) || ''}
                          onChange={(e) => updateConfig('suffix', e.target.value)}
                          className="w-full px-3 py-2 border border-border-default rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent"
                          placeholder="e.g., USD"
                        />
                      </div>
                    </div>
                  )}

                </div>
              )}

              {formData.displayType === 'grid' && (
                <div className="space-y-4 p-4 bg-bg-muted rounded-lg">
                  <h3 className="font-medium text-text-primary">Grid Settings</h3>

                  {/* Grid Size Inputs */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-text-secondary mb-1">Columns</label>
                      <input
                        type="number"
                        min={1}
                        max={8}
                        value={(formData.config?.gridCols as number) || 2}
                        onChange={(e) => updateConfig('gridCols', Math.min(8, Math.max(1, parseInt(e.target.value, 10) || 1)))}
                        className="w-full px-3 py-2 border border-border-default rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-text-secondary mb-1">Rows</label>
                      <input
                        type="number"
                        min={1}
                        max={6}
                        value={(formData.config?.gridRows as number) || 2}
                        onChange={(e) => updateConfig('gridRows', Math.min(6, Math.max(1, parseInt(e.target.value, 10) || 1)))}
                        className="w-full px-3 py-2 border border-border-default rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent"
                      />
                    </div>
                  </div>

                  {/* Grid Visual Editor */}
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-2">
                      Click cells to configure them
                    </label>
                    <div
                      className="grid gap-2 p-3 bg-bg-card rounded-lg border border-border-default overflow-hidden"
                      style={{
                        gridTemplateColumns: `repeat(${(formData.config?.gridCols as number) || 2}, minmax(0, 1fr))`,
                        gridTemplateRows: `repeat(${(formData.config?.gridRows as number) || 2}, minmax(40px, 1fr))`,
                      }}
                    >
                      {Array.from({ length: ((formData.config?.gridRows as number) || 2) * ((formData.config?.gridCols as number) || 2) }).map((_, index) => {
                        const cols = (formData.config?.gridCols as number) || 2;
                        const row = Math.floor(index / cols);
                        const col = index % cols;
                        const cellKey = `${row}-${col}`;
                        const cells = (formData.config?.gridCells as Record<string, GridCellConfig>) || {};
                        const cellConfig = cells[cellKey];
                        const isActive = !!cellConfig?.field;
                        const isSelected = (formData.config?.selectedCell as string) === cellKey;

                        return (
                          <button
                            key={cellKey}
                            type="button"
                            onClick={() => updateConfig('selectedCell', isSelected ? '' : cellKey)}
                            className={`
                              min-w-0 rounded-lg border-2 transition-all flex flex-col items-center justify-center text-xs p-1 overflow-hidden
                              ${isSelected
                                ? 'border-accent bg-accent-light ring-2 ring-accent ring-offset-2'
                                : isActive
                                  ? 'border-status-success-border bg-status-success-bg hover:border-accent'
                                  : 'border-border-default bg-bg-muted hover:border-accent hover:bg-accent-light'
                              }
                            `}
                          >
                            {isActive ? (
                              <>
                                <span className="font-medium text-text-primary truncate w-full text-center">
                                  {cellConfig.label || cellConfig.field}
                                </span>
                                <span className="text-text-muted text-[10px] truncate w-full text-center">
                                  {cellConfig.field}
                                </span>
                              </>
                            ) : (
                              <span className="text-text-placeholder">Empty</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Cell Configuration Panel */}
                  {(formData.config?.selectedCell as string) && (
                    <div className="p-4 bg-bg-card rounded-lg border border-accent space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-text-primary">
                          Cell {(formData.config?.selectedCell as string).replace('-', ', ')}
                        </h4>
                        <button
                          type="button"
                          onClick={() => {
                            const cellKey = formData.config?.selectedCell as string;
                            const cells = { ...((formData.config?.gridCells as Record<string, GridCellConfig>) || {}) };
                            delete cells[cellKey];
                            setFormData((prev) => ({
                              ...prev,
                              config: {
                                ...prev.config,
                                gridCells: cells,
                                selectedCell: '',
                              },
                            }));
                          }}
                          className="text-xs text-status-error-text hover:underline"
                        >
                          Clear Cell
                        </button>
                      </div>

                      {/* Field Selection */}
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-text-secondary">Field</label>
                        <input
                          type="text"
                          list="grid-field-suggestions"
                          value={(() => {
                            const cellKey = formData.config?.selectedCell as string;
                            const cells = (formData.config?.gridCells as Record<string, GridCellConfig>) || {};
                            return cells[cellKey]?.field || '';
                          })()}
                          onChange={(e) => {
                            const cellKey = formData.config?.selectedCell as string;
                            const cells = { ...((formData.config?.gridCells as Record<string, GridCellConfig>) || {}) };
                            const newField = e.target.value;
                            const suggestedType = getSuggestedFieldType(newField);
                            cells[cellKey] = {
                              ...cells[cellKey],
                              field: newField,
                              fieldType: suggestedType,
                            };
                            updateConfig('gridCells', cells);
                          }}
                          className="w-full px-3 py-2 border border-border-default rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent font-mono text-sm"
                          placeholder="e.g., rates[0].mid"
                        />
                        {availableFields.length > 0 && (
                          <datalist id="grid-field-suggestions">
                            {availableFields.map((field) => (
                              <option key={field.path} value={field.path} />
                            ))}
                          </datalist>
                        )}
                      </div>

                      {/* Display Type */}
                      <div>
                        <label className="block text-sm font-medium text-text-secondary mb-1">Display As</label>
                        <select
                          value={(() => {
                            const cellKey = formData.config?.selectedCell as string;
                            const cells = (formData.config?.gridCells as Record<string, GridCellConfig>) || {};
                            return cells[cellKey]?.fieldType || 'text';
                          })()}
                          onChange={(e) => {
                            const cellKey = formData.config?.selectedCell as string;
                            const cells = { ...((formData.config?.gridCells as Record<string, GridCellConfig>) || {}) };
                            cells[cellKey] = {
                              ...cells[cellKey],
                              fieldType: e.target.value as FieldDisplayType,
                            };
                            updateConfig('gridCells', cells);
                          }}
                          className="w-full px-3 py-2 border border-border-default rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent bg-bg-card"
                        >
                          {FIELD_DISPLAY_TYPES.map((type) => (
                            <option key={type.value} value={type.value}>
                              {type.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Label */}
                      <div>
                        <label className="block text-sm font-medium text-text-secondary mb-1">Label (optional)</label>
                        <input
                          type="text"
                          value={(() => {
                            const cellKey = formData.config?.selectedCell as string;
                            const cells = (formData.config?.gridCells as Record<string, GridCellConfig>) || {};
                            return cells[cellKey]?.label || '';
                          })()}
                          onChange={(e) => {
                            const cellKey = formData.config?.selectedCell as string;
                            const cells = { ...((formData.config?.gridCells as Record<string, GridCellConfig>) || {}) };
                            cells[cellKey] = {
                              ...cells[cellKey],
                              label: e.target.value,
                            };
                            updateConfig('gridCells', cells);
                          }}
                          className="w-full px-3 py-2 border border-border-default rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent"
                          placeholder="e.g., EUR/PLN"
                        />
                      </div>

                      {/* Horizontal Alignment */}
                      <div>
                        <label className="block text-sm font-medium text-text-secondary mb-1">Horizontal Alignment</label>
                        <div className="flex gap-1 p-1 bg-bg-muted rounded-lg">
                          {([
                            { value: 'left', icon: 'M4 6h16M4 12h10M4 18h14' },
                            { value: 'center', icon: 'M4 6h16M7 12h10M5 18h14' },
                            { value: 'right', icon: 'M4 6h16M10 12h10M6 18h14' },
                          ] as const).map((alignOpt) => {
                            const cellKey = formData.config?.selectedCell as string;
                            const cells = (formData.config?.gridCells as Record<string, GridCellConfig>) || {};
                            const currentAlign = cells[cellKey]?.align || 'center';
                            return (
                              <button
                                key={alignOpt.value}
                                type="button"
                                onClick={() => {
                                  const updatedCells = { ...cells };
                                  updatedCells[cellKey] = {
                                    ...updatedCells[cellKey],
                                    align: alignOpt.value as CellAlignment,
                                  };
                                  updateConfig('gridCells', updatedCells);
                                }}
                                className={`
                                  flex-1 p-2 rounded-md transition-colors
                                  ${currentAlign === alignOpt.value
                                    ? 'bg-bg-card text-accent shadow-sm'
                                    : 'text-text-muted hover:text-text-secondary'
                                  }
                                `}
                                title={alignOpt.value.charAt(0).toUpperCase() + alignOpt.value.slice(1)}
                              >
                                <svg className="w-4 h-4 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={alignOpt.icon} />
                                </svg>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Vertical Alignment */}
                      <div>
                        <label className="block text-sm font-medium text-text-secondary mb-1">Vertical Alignment</label>
                        <div className="flex gap-1 p-1 bg-bg-muted rounded-lg">
                          {([
                            { value: 'top', label: 'Top', icon: 'M5 15l7-7 7 7' },
                            { value: 'middle', label: 'Middle', icon: 'M4 12h16' },
                            { value: 'bottom', label: 'Bottom', icon: 'M19 9l-7 7-7-7' },
                          ] as const).map((vAlignOpt) => {
                            const cellKey = formData.config?.selectedCell as string;
                            const cells = (formData.config?.gridCells as Record<string, GridCellConfig>) || {};
                            const currentVAlign = cells[cellKey]?.verticalAlign || 'middle';
                            return (
                              <button
                                key={vAlignOpt.value}
                                type="button"
                                onClick={() => {
                                  const updatedCells = { ...cells };
                                  updatedCells[cellKey] = {
                                    ...updatedCells[cellKey],
                                    verticalAlign: vAlignOpt.value as CellVerticalAlignment,
                                  };
                                  updateConfig('gridCells', updatedCells);
                                }}
                                className={`
                                  flex-1 p-2 rounded-md transition-colors
                                  ${currentVAlign === vAlignOpt.value
                                    ? 'bg-bg-card text-accent shadow-sm'
                                    : 'text-text-muted hover:text-text-secondary'
                                  }
                                `}
                                title={vAlignOpt.label}
                              >
                                <svg className="w-4 h-4 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={vAlignOpt.icon} />
                                </svg>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Prefix / Suffix - only show when not using script */}
                      {!(() => {
                        const cellKey = formData.config?.selectedCell as string;
                        const cells = (formData.config?.gridCells as Record<string, GridCellConfig>) || {};
                        return cells[cellKey]?.useScript;
                      })() && (
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-text-secondary mb-1">Prefix</label>
                            <input
                              type="text"
                              value={(() => {
                                const cellKey = formData.config?.selectedCell as string;
                                const cells = (formData.config?.gridCells as Record<string, GridCellConfig>) || {};
                                return cells[cellKey]?.prefix || '';
                              })()}
                              onChange={(e) => {
                                const cellKey = formData.config?.selectedCell as string;
                                const cells = { ...((formData.config?.gridCells as Record<string, GridCellConfig>) || {}) };
                                cells[cellKey] = {
                                  ...cells[cellKey],
                                  prefix: e.target.value,
                                };
                                updateConfig('gridCells', cells);
                              }}
                              className="w-full px-3 py-2 border border-border-default rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent"
                              placeholder="e.g., $"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-text-secondary mb-1">Suffix</label>
                            <input
                              type="text"
                              value={(() => {
                                const cellKey = formData.config?.selectedCell as string;
                                const cells = (formData.config?.gridCells as Record<string, GridCellConfig>) || {};
                                return cells[cellKey]?.suffix || '';
                              })()}
                              onChange={(e) => {
                                const cellKey = formData.config?.selectedCell as string;
                                const cells = { ...((formData.config?.gridCells as Record<string, GridCellConfig>) || {}) };
                                cells[cellKey] = {
                                  ...cells[cellKey],
                                  suffix: e.target.value,
                                };
                                updateConfig('gridCells', cells);
                              }}
                              className="w-full px-3 py-2 border border-border-default rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent"
                              placeholder="e.g., PLN"
                            />
                          </div>
                        </div>
                      )}

                      {/* JavaScript Toggle */}
                      <div className="border-t border-border-light pt-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={(() => {
                              const cellKey = formData.config?.selectedCell as string;
                              const cells = (formData.config?.gridCells as Record<string, GridCellConfig>) || {};
                              return cells[cellKey]?.useScript || false;
                            })()}
                            onChange={(e) => {
                              const cellKey = formData.config?.selectedCell as string;
                              const cells = { ...((formData.config?.gridCells as Record<string, GridCellConfig>) || {}) };
                              cells[cellKey] = {
                                ...cells[cellKey],
                                useScript: e.target.checked,
                              };
                              updateConfig('gridCells', cells);
                            }}
                            className="rounded text-accent focus:ring-accent"
                          />
                          <span className="text-sm font-medium text-text-secondary">Use JavaScript</span>
                        </label>
                      </div>

                      {/* Script Editor - show when useScript is enabled */}
                      {(() => {
                        const cellKey = formData.config?.selectedCell as string;
                        const cells = (formData.config?.gridCells as Record<string, GridCellConfig>) || {};
                        return cells[cellKey]?.useScript;
                      })() && (
                        <div className="space-y-2">
                          <label className="block text-sm font-medium text-text-secondary">
                            JavaScript Code
                          </label>
                          <ScriptEditor
                            value={(() => {
                              const cellKey = formData.config?.selectedCell as string;
                              const cells = (formData.config?.gridCells as Record<string, GridCellConfig>) || {};
                              return cells[cellKey]?.script || '';
                            })()}
                            onChange={(code) => {
                              const cellKey = formData.config?.selectedCell as string;
                              const cells = { ...((formData.config?.gridCells as Record<string, GridCellConfig>) || {}) };
                              cells[cellKey] = {
                                ...cells[cellKey],
                                script: code,
                              };
                              updateConfig('gridCells', cells);
                            }}
                            availableFields={availableFields}
                            sampleData={sampleData}
                            outputMode="value"
                            placeholder="// Return a value for this cell\nreturn $.rates[0].mid.toFixed(4);"
                          />
                          <p className="text-xs text-text-muted">
                            Access data with <code className="bg-bg-muted px-1 rounded">$.fieldName</code>. Return a single value.
                          </p>
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => updateConfig('selectedCell', '')}
                        className="w-full px-3 py-2 bg-accent text-text-inverse rounded-lg hover:bg-accent-hover transition-colors"
                      >
                        Done
                      </button>
                    </div>
                  )}

                  {/* Gap Setting */}
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1">
                      Cell Gap: {(formData.config?.gridGap as number) || 8}px
                    </label>
                    <input
                      type="range"
                      min={0}
                      max={24}
                      value={(formData.config?.gridGap as number) || 8}
                      onChange={(e) => updateConfig('gridGap', parseInt(e.target.value, 10))}
                      className="w-full"
                    />
                  </div>
                </div>
              )}

              {/* Note: Font settings (size, family, weight, color) are configured in the screen designer */}

              <div className="flex justify-between pt-4 border-t border-border-light">
                <button
                  onClick={() => setStep(2)}
                  className="px-6 py-2 text-text-secondary hover:text-text-primary transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={saving}
                  className="px-6 py-2 bg-accent text-text-inverse rounded-lg hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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
                    isEditing ? 'Save Changes' : 'Create Widget'
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right: Preview */}
        <div className="space-y-4">
          {/* Live Preview */}
          <div className="bg-bg-card rounded-xl shadow-sm border border-border-light overflow-hidden sticky top-4">
            <div className="px-4 py-3 bg-bg-muted border-b border-border-light flex items-center justify-between">
              <h3 className="font-medium text-text-primary">Live Preview</h3>
              {selectedSource && (
                <button
                  onClick={() => fetchSampleData(selectedSource.id)}
                  disabled={testingSource}
                  className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-accent bg-accent-light rounded-lg hover:bg-accent-light transition-colors disabled:opacity-50"
                >
                  {testingSource ? (
                    <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : (
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  )}
                  Refresh
                </button>
              )}
            </div>
            <div className="p-8 bg-gradient-to-br from-bg-muted to-border-light min-h-[250px] flex items-center justify-center">
              <div
                className="bg-bg-card rounded-lg shadow-lg p-6 flex items-center justify-center"
                style={{
                  minWidth: formData.minWidth || 150,
                  minHeight: formData.minHeight || 80,
                }}
              >
                {testingSource ? (
                  <div className="flex items-center gap-2 text-text-placeholder">
                    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Loading data...
                  </div>
                ) : (
                  renderPreview()
                )}
              </div>
            </div>
            {/* Hint when preview is empty */}
            {!sampleData && selectedSource && !testingSource && (
              <div className="px-4 py-3 bg-status-warning-bg border-t border-status-warning-border text-xs text-status-warning-text">
                Click "Refresh" to load data from the API
              </div>
            )}
          </div>

          {/* Data Source Info */}
          {selectedSource && (
            <div className="bg-bg-card rounded-xl shadow-sm border border-border-light p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium text-text-primary">Data Source</h3>
                <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                  selectedSource.type === 'json' ? 'bg-status-info-bg text-status-info-text' : 'bg-status-warning-bg text-status-warning-text'
                }`}>
                  {selectedSource.type.toUpperCase()}
                </span>
              </div>
              <p className="text-sm text-text-secondary mb-2">{selectedSource.name}</p>
              <p className="text-xs text-text-placeholder truncate">{selectedSource.url}</p>

              <button
                onClick={() => fetchSampleData(selectedSource.id)}
                disabled={testingSource}
                className="mt-3 w-full px-3 py-2 text-sm bg-bg-muted text-text-secondary rounded-lg hover:bg-border-light transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {testingSource ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Fetching...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Refresh Data
                  </>
                )}
              </button>
            </div>
          )}

          {/* Available Fields Summary */}
          {availableFields.length > 0 && (
            <div className="bg-bg-card rounded-xl shadow-sm border border-border-light p-4">
              <h3 className="font-medium text-text-primary mb-3">Available Fields</h3>
              <div className="space-y-2 max-h-48 overflow-auto">
                {availableFields.map((field, index) => (
                  <div key={index} className="flex items-center justify-between text-sm">
                    <code className="text-accent bg-accent-light px-1.5 py-0.5 rounded text-xs">
                      {field.path}
                    </code>
                    <div className="flex items-center gap-1">
                      {field.isImageUrl && (
                        <span className="text-pink-500 text-xs">🖼️</span>
                      )}
                      {field.isLink && !field.isImageUrl && (
                        <span className="text-accent text-xs">🔗</span>
                      )}
                      <span className="text-text-placeholder text-xs">{field.type}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sample Data */}
          {!!sampleData && (
            <details className="bg-bg-card rounded-xl shadow-sm border border-border-light overflow-hidden">
              <summary className="px-4 py-3 bg-bg-muted border-b border-border-light cursor-pointer font-medium text-text-secondary hover:bg-border-light">
                Raw Data
              </summary>
              <pre className="p-4 text-xs overflow-auto max-h-64 bg-gray-900 text-green-400">
                {JSON.stringify(sampleData, null, 2)}
              </pre>
            </details>
          )}
        </div>
      </div>
      </div>
    </MainLayout>
  );
}
