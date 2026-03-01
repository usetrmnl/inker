/**
 * ScreenDesigner Page Component
 * Main page for designing screens with drag-and-drop widgets.
 */
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { LoadingSpinner, Modal } from '../../components/common';
import {
  WidgetLibrary,
  DesignCanvas,
  WidgetSettingsPanel,
  TimezoneSelectionModal,
} from '../../components/screen-designer';
import type { DesignCanvasHandle } from '../../components/screen-designer/DesignCanvas';
import { screenDesignerService, customWidgetService, dataSourceService } from '../../services/api';
import { useNotification } from '../../contexts/NotificationContext';
import type { ScreenDesign, ScreenWidget, WidgetTemplate } from '../../types';

const CUSTOM_WIDGET_TEMPLATE_OFFSET = 10000;

// Common e-ink display resolutions
const RESOLUTION_PRESETS = [
  { label: 'TRMNL Standard', width: 800, height: 480, description: '800 x 480 px (landscape)' },
  { label: 'TRMNL Portrait', width: 480, height: 800, description: '480 x 800 px (portrait)' },
  { label: 'Small Display', width: 400, height: 300, description: '400 x 300 px' },
  { label: 'Medium Display', width: 640, height: 384, description: '640 x 384 px' },
  { label: 'Large Display', width: 1024, height: 758, description: '1024 x 758 px' },
  { label: 'E-Paper 2.9"', width: 296, height: 128, description: '296 x 128 px' },
  { label: 'E-Paper 4.2"', width: 400, height: 300, description: '400 x 300 px' },
  { label: 'E-Paper 7.5"', width: 800, height: 480, description: '800 x 480 px' },
];

export function ScreenDesigner() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { showNotification } = useNotification();

  // Get the return URL from query params (e.g., ?from=/playlists/5)
  const rawBack = searchParams.get('from') || '/screens';
  const backUrl = rawBack.startsWith('/') && !rawBack.startsWith('//') ? rawBack : '/screens';

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [design, setDesign] = useState<ScreenDesign | null>(null);
  const [widgets, setWidgets] = useState<ScreenWidget[]>([]);
  const [templates, setTemplates] = useState<WidgetTemplate[]>([]);

  const [selectedWidgetId, setSelectedWidgetId] = useState<number | null>(null);

  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showResolutionModal, setShowResolutionModal] = useState(false);
  const [showTimezoneModal, setShowTimezoneModal] = useState(false);
  const [pendingWidgetData, setPendingWidgetData] = useState<{
    template: WidgetTemplate;
    x: number;
    y: number;
  } | null>(null);
  const [designName, setDesignName] = useState('');
  const [designDescription, setDesignDescription] = useState('');
  const [exportCode, setExportCode] = useState('');
  const [isGeneratingExport, setIsGeneratingExport] = useState(false);
  const [customWidth, setCustomWidth] = useState(800);
  const [customHeight, setCustomHeight] = useState(480);

  const [nextWidgetId, setNextWidgetId] = useState(-1);
  const [hasChanges, setHasChanges] = useState(false);

  // Clipboard for copy/paste functionality
  const [copiedWidget, setCopiedWidget] = useState<ScreenWidget | null>(null);

  // Ref for capturing canvas for pixel-perfect device rendering
  const designCanvasRef = useRef<DesignCanvasHandle>(null);

  /**
   * Load widget templates and existing design (if editing)
   */
  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        const loadedTemplates = await screenDesignerService.getTemplates();
        setTemplates(loadedTemplates);

        if (id) {
          const loadedDesign = await screenDesignerService.getById(parseInt(id));
          setDesign(loadedDesign);
          setWidgets(loadedDesign.widgets || []);
          setDesignName(loadedDesign.name);
          setDesignDescription(loadedDesign.description || '');
        } else {
          // New screen - show resolution selection modal
          setShowResolutionModal(true);
          setDesignName('Untitled Design');
        }
      } catch (error) {
        showNotification('error', 'Failed to load design data');
        console.error('Load error:', error);
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [id, showNotification]);

  /**
   * Handle resolution selection for new screen
   */
  const handleSelectResolution = useCallback((width: number, height: number) => {
    setDesign({
      id: 0,
      name: 'Untitled Design',
      description: '',
      width,
      height,
      background: '#ffffff',
      widgets: [],
      isTemplate: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    setShowResolutionModal(false);
  }, []);

  const selectedWidget = useMemo(() => {
    if (!selectedWidgetId) return null;
    return widgets.find((w) => w.id === selectedWidgetId) || null;
  }, [widgets, selectedWidgetId]);

  const selectedTemplate = useMemo(() => {
    if (!selectedWidget) return null;
    return templates.find((t) => t.id === selectedWidget.templateId) || null;
  }, [selectedWidget, templates]);

  /**
   * Create a widget and add it to the canvas
   */
  const createWidget = useCallback(
    (template: WidgetTemplate, x: number, y: number, configOverrides?: Record<string, unknown>) => {
      const newWidget: ScreenWidget = {
        id: nextWidgetId,
        templateId: template.id,
        template: template,
        x,
        y,
        width: template.minWidth * 1.5,
        height: template.minHeight * 1.5,
        rotation: 0,
        config: { ...template.defaultConfig, ...configOverrides },
        zIndex: widgets.length,
      };

      setWidgets((prev) => [...prev, newWidget]);
      setNextWidgetId((prev) => prev - 1);
      setSelectedWidgetId(newWidget.id);
      setHasChanges(true);
    },
    [nextWidgetId, widgets.length]
  );

  /**
   * Handle dropping a new widget onto the canvas
   */
  const handleDropWidget = useCallback(
    (template: WidgetTemplate, x: number, y: number) => {
      // Intercept clock/date widgets to show timezone selection modal
      if (template.name === 'clock' || template.name === 'date') {
        setPendingWidgetData({ template, x, y });
        setShowTimezoneModal(true);
        return;
      }
      // Create widget directly for other types
      createWidget(template, x, y);
    },
    [createWidget]
  );

  /**
   * Handle timezone selection confirmation
   */
  const handleTimezoneConfirm = useCallback(
    (timezone: string) => {
      if (pendingWidgetData) {
        createWidget(pendingWidgetData.template, pendingWidgetData.x, pendingWidgetData.y, { timezone });
      }
      setShowTimezoneModal(false);
      setPendingWidgetData(null);
    },
    [pendingWidgetData, createWidget]
  );

  /**
   * Handle using default timezone (local)
   */
  const handleTimezoneDefault = useCallback(() => {
    if (pendingWidgetData) {
      createWidget(pendingWidgetData.template, pendingWidgetData.x, pendingWidgetData.y);
    }
    setShowTimezoneModal(false);
    setPendingWidgetData(null);
  }, [pendingWidgetData, createWidget]);

  /**
   * Handle updating a widget
   */
  const handleUpdateWidget = useCallback((widgetId: number, updates: Partial<ScreenWidget>) => {
    setWidgets((prev) =>
      prev.map((w) =>
        w.id === widgetId
          ? {
              ...w,
              ...updates,
            }
          : w
      )
    );
    setHasChanges(true);
  }, []);

  const handleDeleteWidget = useCallback(
    (widgetId: number) => {
      setWidgets((prev) => prev.filter((w) => w.id !== widgetId));
      if (selectedWidgetId === widgetId) {
        setSelectedWidgetId(null);
      }
      setHasChanges(true);
    },
    [selectedWidgetId]
  );

  const handleUpdateSelectedWidget = useCallback(
    (updates: Partial<ScreenWidget>) => {
      if (!selectedWidgetId) return;
      handleUpdateWidget(selectedWidgetId, updates);
    },
    [selectedWidgetId, handleUpdateWidget]
  );

  const handleDeleteSelectedWidget = useCallback(() => {
    if (!selectedWidgetId) return;
    handleDeleteWidget(selectedWidgetId);
  }, [selectedWidgetId, handleDeleteWidget]);

  const handleDragStart = useCallback(() => {
    setSelectedWidgetId(null);
  }, []);

  /**
   * Copy the selected widget to clipboard
   */
  const handleCopyWidget = useCallback(() => {
    if (!selectedWidget) return;
    setCopiedWidget({ ...selectedWidget });
    showNotification('info', 'Widget copied');
  }, [selectedWidget, showNotification]);

  /**
   * Paste the copied widget with offset position
   */
  const handlePasteWidget = useCallback(() => {
    if (!copiedWidget || !design) return;

    // Offset the pasted widget by 20px so it's visible
    const offsetX = 20;
    const offsetY = 20;

    // Make sure it stays within canvas bounds
    const newX = Math.min(copiedWidget.x + offsetX, design.width - copiedWidget.width);
    const newY = Math.min(copiedWidget.y + offsetY, design.height - copiedWidget.height);

    const newWidget: ScreenWidget = {
      ...copiedWidget,
      id: nextWidgetId,
      x: Math.max(0, newX),
      y: Math.max(0, newY),
      zIndex: widgets.length,
    };

    setWidgets((prev) => [...prev, newWidget]);
    setNextWidgetId((prev) => prev - 1);
    setSelectedWidgetId(newWidget.id);
    setHasChanges(true);
    showNotification('info', 'Widget pasted');
  }, [copiedWidget, design, nextWidgetId, widgets.length, showNotification]);

  /**
   * Keyboard shortcuts for copy/paste
   */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input/textarea
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      // Ctrl+C or Cmd+C to copy
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        if (selectedWidgetId) {
          e.preventDefault();
          handleCopyWidget();
        }
      }

      // Ctrl+V or Cmd+V to paste
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        if (copiedWidget) {
          e.preventDefault();
          handlePasteWidget();
        }
      }

      // Ctrl+D or Cmd+D to duplicate (copy + paste in one action)
      if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        if (selectedWidgetId && selectedWidget) {
          e.preventDefault();
          // Directly duplicate without going through clipboard
          const offsetX = 20;
          const offsetY = 20;
          const newX = design ? Math.min(selectedWidget.x + offsetX, design.width - selectedWidget.width) : selectedWidget.x + offsetX;
          const newY = design ? Math.min(selectedWidget.y + offsetY, design.height - selectedWidget.height) : selectedWidget.y + offsetY;

          const newWidget: ScreenWidget = {
            ...selectedWidget,
            id: nextWidgetId,
            x: Math.max(0, newX),
            y: Math.max(0, newY),
            zIndex: widgets.length,
          };

          setWidgets((prev) => [...prev, newWidget]);
          setNextWidgetId((prev) => prev - 1);
          setSelectedWidgetId(newWidget.id);
          setHasChanges(true);
          showNotification('info', 'Widget duplicated');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedWidgetId, selectedWidget, copiedWidget, design, nextWidgetId, widgets.length, handleCopyWidget, handlePasteWidget, showNotification]);

  const handleSave = useCallback(async () => {
    if (!design) return;

    setIsSaving(true);
    try {
      const designData = {
        name: designName,
        description: designDescription,
        width: design.width,
        height: design.height,
        background: design.background,
        // Strip frontend-only fields (id, template) before sending to backend
        // The backend DTO only accepts: templateId, x, y, width, height, config, zIndex, rotation
        widgets: widgets.map((w) => ({
          templateId: w.templateId,
          x: w.x,
          y: w.y,
          width: w.width,
          height: w.height,
          config: w.config,
          zIndex: w.zIndex,
          rotation: w.rotation || 0,
        })),
        isTemplate: design.isTemplate,
      };

      let savedDesignId = design.id;

      if (design.id && design.id > 0) {
        await screenDesignerService.update(design.id, designData as Partial<ScreenDesign>);
        showNotification('success', 'Design saved successfully');
      } else {
        const newDesign = await screenDesignerService.create(designData as Partial<ScreenDesign>);
        setDesign(newDesign);
        savedDesignId = newDesign.id;
        navigate(`/screens/designer/${newDesign.id}`, { replace: true });
        showNotification('success', 'Design created successfully');
      }

      setHasChanges(false);
      setShowSaveModal(false);

      // Auto-capture screen for pixel-perfect device rendering
      // This happens after save so the screen ID exists
      if (savedDesignId && savedDesignId > 0 && designCanvasRef.current) {
        try {
          await designCanvasRef.current.captureForDevice();
        } catch (captureError) {
          console.error('Failed to capture screen for device:', captureError);
          // Don't show error to user - capture is a background optimization
        }
      }
    } catch (error) {
      showNotification('error', 'Failed to save design');
      console.error('Save error:', error);
    } finally {
      setIsSaving(false);
    }
  }, [design, designName, designDescription, widgets, navigate, showNotification]);

  const handleBack = useCallback(() => {
    if (hasChanges) {
      if (window.confirm('You have unsaved changes. Are you sure you want to leave?')) {
        navigate(backUrl);
      }
    } else {
      navigate(backUrl);
    }
  }, [hasChanges, navigate, backUrl]);


  /**
   * Generate exportable screen code (async to fetch custom widget data)
   */
  const generateExportCode = useCallback(async (): Promise<string> => {
    if (!design) return '';

    // Find custom widgets used in this design
    const customWidgetIds = widgets
      .filter((w) => w.templateId >= CUSTOM_WIDGET_TEMPLATE_OFFSET)
      .map((w) => w.templateId - CUSTOM_WIDGET_TEMPLATE_OFFSET);

    // Fetch custom widgets and their data sources if needed
    let customWidgets: Array<{
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
        type: string;
        url: string;
        method: string;
        headers?: Record<string, string>;
        refreshInterval: number;
        jsonPath?: string;
      };
    }> = [];

    if (customWidgetIds.length > 0) {
      try {
        // Fetch all custom widgets and data sources
        const [allCustomWidgetsResponse, allDataSourcesResponse] = await Promise.all([
          customWidgetService.getAll(1, 1000),
          dataSourceService.getAll(1, 1000),
        ]);

        // Filter to only the ones used in this design
        const usedWidgets = allCustomWidgetsResponse.items.filter((cw) => customWidgetIds.includes(cw.id));

        // Build export data for each custom widget
        customWidgets = usedWidgets.map((cw) => {
          const dataSource = allDataSourcesResponse.items.find((ds) => ds.id === cw.dataSourceId);
          return {
            id: cw.id,
            name: cw.name,
            description: cw.description,
            displayType: cw.displayType,
            template: cw.template,
            config: cw.config,
            minWidth: cw.minWidth,
            minHeight: cw.minHeight,
            dataSource: dataSource ? {
              name: dataSource.name,
              description: dataSource.description,
              type: dataSource.type,
              url: dataSource.url,
              method: dataSource.method,
              headers: dataSource.headers,
              refreshInterval: dataSource.refreshInterval,
              jsonPath: dataSource.jsonPath,
            } : {
              name: 'Unknown',
              type: 'json',
              url: '',
              method: 'GET',
              refreshInterval: 300,
            },
          };
        });
      } catch (error) {
        console.error('Failed to fetch custom widgets for export:', error);
      }
    }

    const exportData = {
      _inkerScreen: 2, // Version 2 with custom widgets support
      name: designName,
      description: designDescription,
      width: design.width,
      height: design.height,
      background: design.background,
      widgets: widgets.map((w) => ({
        templateId: w.templateId,
        x: w.x,
        y: w.y,
        width: w.width,
        height: w.height,
        rotation: w.rotation || 0,
        config: w.config,
        zIndex: w.zIndex,
      })),
      customWidgets: customWidgets.length > 0 ? customWidgets : undefined,
    };

    // Encode as base64 for easy copy/paste
    const jsonString = JSON.stringify(exportData);
    return btoa(unescape(encodeURIComponent(jsonString)));
  }, [design, designName, designDescription, widgets]);

  const handleCopyExportCode = useCallback(async () => {
    const code = exportCode || await generateExportCode();

    // Try modern clipboard API first, fallback to execCommand
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(code).then(() => {
        showNotification('success', 'Screen code copied to clipboard!');
      }).catch(() => {
        showNotification('error', 'Failed to copy to clipboard');
      });
    } else {
      // Fallback for non-HTTPS contexts
      const textArea = document.createElement('textarea');
      textArea.value = code;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        document.execCommand('copy');
        showNotification('success', 'Screen code copied to clipboard!');
      } catch {
        showNotification('error', 'Failed to copy to clipboard');
      }
      textArea.remove();
    }
  }, [exportCode, generateExportCode, showNotification]);

  // Generate export code when opening the export modal
  const handleOpenExportModal = useCallback(async () => {
    setShowExportModal(true);
    setIsGeneratingExport(true);
    setExportCode('');
    try {
      const code = await generateExportCode();
      setExportCode(code);
    } catch {
      showNotification('error', 'Failed to generate export code');
    } finally {
      setIsGeneratingExport(false);
    }
  }, [generateExportCode, showNotification]);

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-bg-page">
        <div className="text-center">
          <LoadingSpinner size="lg" />
          <p className="mt-4 text-sm text-text-muted">Loading designer...</p>
        </div>
      </div>
    );
  }

  if (!design && !showResolutionModal) {
    return (
      <div className="h-screen flex items-center justify-center bg-bg-page">
        <div className="text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-status-error-bg flex items-center justify-center">
            <svg className="w-7 h-7 text-status-error-text" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 className="text-base font-semibold text-text-primary mb-1">Failed to load</h3>
          <p className="text-sm text-text-muted mb-4">There was an error loading the design.</p>
          <button
            onClick={() => navigate(backUrl)}
            className="px-4 py-2 text-sm font-medium text-text-inverse bg-accent rounded-lg hover:bg-accent-hover transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  // Show resolution modal for new screens
  if (!design && showResolutionModal) {
    return (
      <div className="h-screen flex items-center justify-center bg-bg-page">
        {/* Resolution Selection Modal */}
        <Modal
          isOpen={showResolutionModal}
          onClose={() => navigate(backUrl)}
          title="Select Screen Resolution"
        >
          <div className="space-y-4">
            <p className="text-sm text-text-secondary">
              Choose a resolution for your screen design. This should match the resolution of the e-ink display you're targeting.
            </p>

            {/* Preset Resolutions */}
            <div className="grid grid-cols-2 gap-2">
              {RESOLUTION_PRESETS.map((preset) => (
                <button
                  key={`${preset.width}x${preset.height}-${preset.label}`}
                  onClick={() => handleSelectResolution(preset.width, preset.height)}
                  className="p-3 text-left rounded-lg border border-border-light hover:border-accent hover:bg-accent-light transition-all group"
                >
                  <div className="font-medium text-text-primary group-hover:text-accent text-sm">
                    {preset.label}
                  </div>
                  <div className="text-xs text-text-muted mt-0.5">
                    {preset.description}
                  </div>
                </button>
              ))}
            </div>

            {/* Custom Resolution */}
            <div className="pt-4 border-t border-border-light">
              <h4 className="text-sm font-medium text-text-secondary mb-3">Custom Resolution</h4>
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <label className="block text-xs text-text-muted mb-1">Width (px)</label>
                  <input
                    type="number"
                    value={customWidth}
                    onChange={(e) => setCustomWidth(Math.max(100, parseInt(e.target.value) || 100))}
                    min={100}
                    max={2000}
                    className="w-full px-3 py-2 bg-bg-muted border border-border-light rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
                  />
                </div>
                <div className="text-text-muted mt-5">×</div>
                <div className="flex-1">
                  <label className="block text-xs text-text-muted mb-1">Height (px)</label>
                  <input
                    type="number"
                    value={customHeight}
                    onChange={(e) => setCustomHeight(Math.max(100, parseInt(e.target.value) || 100))}
                    min={100}
                    max={2000}
                    className="w-full px-3 py-2 bg-bg-muted border border-border-light rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
                  />
                </div>
                <button
                  onClick={() => handleSelectResolution(customWidth, customHeight)}
                  className="mt-5 px-4 py-2 text-sm font-medium text-text-inverse bg-accent rounded-lg hover:bg-accent-hover transition-colors"
                >
                  Use
                </button>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => navigate(backUrl)}
                className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </Modal>
      </div>
    );
  }

  // At this point design is guaranteed to exist (TypeScript narrowing)
  if (!design) return null;

  return (
    <div className="h-screen flex flex-col bg-bg-page">
      {/* Header */}
      <header className="flex-shrink-0 bg-bg-card border-b border-border-light px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* Back button */}
          <button
            onClick={handleBack}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-muted transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span className="text-sm font-medium">Back</span>
          </button>

          <div className="h-6 w-px bg-border-light" />

          {/* Design info */}
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-semibold text-text-primary">{designName}</h1>
              {hasChanges && (
                <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-status-warning-bg text-status-warning-text">
                  Unsaved
                </span>
              )}
            </div>
            <p className="text-xs text-text-muted">
              {design.width} x {design.height}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {/* Export/Copy Code Button */}
          <button
            onClick={handleOpenExportModal}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-text-secondary bg-bg-card border border-border-light rounded-lg hover:bg-bg-muted transition-colors"
            title="Copy screen code for sharing"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            Copy Code
          </button>

          <button
            onClick={() => setShowSaveModal(true)}
            className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium text-text-inverse bg-accent rounded-lg hover:bg-accent-hover transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
            </svg>
            Save
          </button>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        <WidgetLibrary templates={templates} onDragStart={handleDragStart} />

        <DesignCanvas
          ref={designCanvasRef}
          screenId={id ? parseInt(id, 10) : undefined}
          width={design.width}
          height={design.height}
          background={design.background}
          widgets={widgets}
          templates={templates}
          selectedWidgetId={selectedWidgetId}
          onSelectWidget={setSelectedWidgetId}
          onUpdateWidget={handleUpdateWidget}
          onDeleteWidget={handleDeleteWidget}
          onDropWidget={handleDropWidget}
        />

        <WidgetSettingsPanel
          widget={selectedWidget}
          template={selectedTemplate}
          allWidgets={widgets}
          templates={templates}
          onUpdateWidget={handleUpdateSelectedWidget}
          onDeleteWidget={handleDeleteSelectedWidget}
          onSelectWidget={setSelectedWidgetId}
        />
      </div>

      {/* Save Modal */}
      <Modal
        isOpen={showSaveModal}
        onClose={() => setShowSaveModal(false)}
        title="Save Design"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">
              Name
            </label>
            <input
              type="text"
              value={designName}
              onChange={(e) => setDesignName(e.target.value)}
              placeholder="Enter design name"
              className="w-full px-3 py-2 bg-bg-muted border border-border-light rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent focus:bg-bg-card transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">
              Description <span className="text-text-placeholder font-normal">(optional)</span>
            </label>
            <textarea
              value={designDescription}
              onChange={(e) => setDesignDescription(e.target.value)}
              className="w-full px-3 py-2 bg-bg-muted border border-border-light rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent focus:bg-bg-card transition-all resize-none"
              rows={3}
              placeholder="Add a description..."
            />
          </div>

          <div className="p-3 bg-bg-muted rounded-lg">
            <div className="flex items-center justify-between text-sm">
              <span className="text-text-secondary">Canvas</span>
              <span className="font-medium text-text-primary">{design.width} x {design.height}</span>
            </div>
            <div className="flex items-center justify-between text-sm mt-1">
              <span className="text-text-secondary">Widgets</span>
              <span className="font-medium text-text-primary">{widgets.length}</span>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setShowSaveModal(false)}
              className="px-4 py-2 text-sm font-medium text-text-secondary bg-bg-card border border-border-light rounded-lg hover:bg-bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!designName.trim() || isSaving}
              className="px-4 py-2 text-sm font-medium text-text-inverse bg-accent rounded-lg hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Preview Modal */}
      <Modal
        isOpen={showPreviewModal}
        onClose={() => setShowPreviewModal(false)}
        title="Preview"
        size="lg"
      >
        <div className="flex flex-col items-center">
          <p className="text-sm text-text-muted mb-4">
            Preview of how the design will appear on the display.
          </p>

          <div className="relative p-4 bg-bg-muted rounded-xl">
            <div
              className="relative border border-border-light rounded-lg shadow-md overflow-hidden"
              style={{
                width: Math.min(design.width, 720),
                height: (Math.min(design.width, 720) / design.width) * design.height,
                backgroundColor: design.background,
              }}
            >
              <div
                style={{
                  transform: `scale(${Math.min(720 / design.width, 1)})`,
                  transformOrigin: 'top left',
                  width: design.width,
                  height: design.height,
                }}
              >
                {widgets.map((widget) => {
                  const template = templates.find((t) => t.id === widget.templateId);
                  if (!template) return null;

                  return (
                    <div
                      key={widget.id}
                      className="absolute bg-bg-card border border-border-light rounded shadow-sm"
                      style={{
                        left: widget.x,
                        top: widget.y,
                        width: widget.width,
                        height: widget.height,
                        zIndex: widget.zIndex,
                      }}
                    >
                      <div className="w-full h-full flex items-center justify-center text-text-secondary text-sm">
                        {template.label}
                      </div>
                    </div>
                  );
                })}

                {widgets.length === 0 && (
                  <div className="absolute inset-0 flex items-center justify-center text-text-placeholder">
                    <p className="text-sm">No widgets</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-3 text-xs text-text-muted">
            <span>{design.width} x {design.height}px</span>
            <span className="w-px h-3 bg-border-light" />
            <span>{widgets.length} widget{widgets.length !== 1 ? 's' : ''}</span>
          </div>
        </div>
      </Modal>

      {/* Export Code Modal */}
      <Modal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        title="Export Screen Code"
      >
        <div className="space-y-4">
          <p className="text-sm text-text-secondary">
            Copy this code and paste it in another Inker instance to import this screen design.
            {widgets.some((w) => w.templateId >= CUSTOM_WIDGET_TEMPLATE_OFFSET) && (
              <span className="block mt-1 text-accent">
                Custom widgets and their data sources will be included.
              </span>
            )}
          </p>

          <div className="p-3 bg-bg-muted rounded-lg border border-border-light">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-text-secondary">Screen</span>
              <span className="font-medium text-text-primary">{designName}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-text-secondary">Widgets</span>
              <span className="font-medium text-text-primary">{widgets.length}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-text-secondary">Custom Widgets</span>
              <span className="font-medium text-text-primary">
                {widgets.filter((w) => w.templateId >= CUSTOM_WIDGET_TEMPLATE_OFFSET).length}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-text-secondary">Canvas</span>
              <span className="font-medium text-text-primary">{design.width} x {design.height}</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">
              Screen Code
            </label>
            {isGeneratingExport ? (
              <div className="w-full px-3 py-8 bg-border-dark rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 animate-spin text-status-success-text" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span className="ml-2 text-status-success-text text-sm">Generating export code...</span>
              </div>
            ) : (
              <textarea
                readOnly
                value={exportCode}
                className="w-full px-3 py-2 bg-border-dark text-status-success-text border border-border-default rounded-lg text-xs font-mono focus:outline-none resize-none"
                rows={4}
                onClick={(e) => (e.target as HTMLTextAreaElement).select()}
              />
            )}
            <p className="text-xs text-text-muted mt-1">
              Click to select all, then copy
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setShowExportModal(false)}
              className="px-4 py-2 text-sm font-medium text-text-secondary bg-bg-card border border-border-light rounded-lg hover:bg-bg-muted transition-colors"
            >
              Close
            </button>
            <button
              onClick={() => {
                handleCopyExportCode();
                setShowExportModal(false);
              }}
              disabled={isGeneratingExport || !exportCode}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-text-inverse bg-accent rounded-lg hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Copy Code
            </button>
          </div>
        </div>
      </Modal>

      {/* Timezone Selection Modal */}
      <TimezoneSelectionModal
        isOpen={showTimezoneModal}
        onConfirm={handleTimezoneConfirm}
        onUseDefault={handleTimezoneDefault}
        widgetType={pendingWidgetData?.template.name === 'clock' ? 'clock' : 'date'}
      />
    </div>
  );
}
