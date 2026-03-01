/**
 * DesignCanvas Component
 *
 * Simple 800×480 canvas for placing widgets.
 * Anti-aliasing disabled for pixel-perfect e-ink output.
 * What you see = what device gets.
 */
import { useRef, useCallback, useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import type { ScreenWidget, WidgetTemplate } from '../../types';
import { DraggableWidget, type ActiveGuides } from './DraggableWidget';
import { screenDesignerService } from '../../services/api';
import config from '../../config';

export interface DesignCanvasHandle {
  captureForDevice: () => Promise<{ captureUrl: string; filename: string; size: number } | null>;
  hasDrawingContent: () => boolean;
  saveDrawingAsWidget: () => Promise<void>;
  clearDrawing: (deleteFromServer?: boolean) => void;
}

interface DesignCanvasProps {
  screenId?: number;
  width: number;
  height: number;
  background: string;
  widgets: ScreenWidget[];
  templates: WidgetTemplate[];
  selectedWidgetId: number | null;
  onSelectWidget: (id: number | null) => void;
  onUpdateWidget: (id: number, updates: Partial<ScreenWidget>) => void;
  onDeleteWidget: (id: number) => void;
  onDropWidget: (template: WidgetTemplate, x: number, y: number) => void;
}

export const DesignCanvas = forwardRef<DesignCanvasHandle, DesignCanvasProps>(function DesignCanvas({
  screenId,
  width,
  height,
  background,
  widgets,
  templates,
  selectedWidgetId,
  onSelectWidget,
  onUpdateWidget,
  onDeleteWidget,
  onDropWidget,
}, ref) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const widgetsContainerRef = useRef<HTMLDivElement>(null);

  // UI state
  const [isDragOver, setIsDragOver] = useState(false);
  const [showGrid, setShowGrid] = useState(true);

  // Track dragging state and active snap guides
  const [isWidgetDragging, setIsWidgetDragging] = useState(false);
  const [activeGuides, setActiveGuides] = useState<ActiveGuides>({
    vertical: [],
    horizontal: [],
    widgetVertical: [],
    widgetHorizontal: [],
  });

  // Drawing mode state
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [brushSize, setBrushSize] = useState(3);
  const [brushColor, setBrushColor] = useState('#000000');
  const [isEraser, setIsEraser] = useState(false);
  const [isBucket, setIsBucket] = useState(false);
  const [hasDrawing, setHasDrawing] = useState(false);
  const drawingCanvasRef = useRef<HTMLCanvasElement>(null);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);

  // Undo/Redo history (capped to limit memory — each entry is ~1.5 MB)
  const MAX_HISTORY = 50;
  const [history, setHistory] = useState<ImageData[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  /**
   * Load existing drawing when screen is opened
   */
  useEffect(() => {
    if (!screenId) return;

    let img: HTMLImageElement | null = null;

    const loadDrawing = async () => {
      try {
        const drawingInfo = await screenDesignerService.getDrawing(screenId);
        if (drawingInfo.exists && drawingInfo.url) {
          const canvas = drawingCanvasRef.current;
          if (!canvas) return;
          const ctx = canvas.getContext('2d');
          if (!ctx) return;

          // Load the drawing image
          img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            // Clear canvas first
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            // Draw the loaded image
            ctx.drawImage(img!, 0, 0, canvas.width, canvas.height);
            setHasDrawing(true);
          };
          img.onerror = (err) => {
            console.warn(`[DesignCanvas] Failed to load drawing:`, err);
          };
          // Add cache buster to avoid stale images
          img.src = `${config.backendUrl}${drawingInfo.url}?t=${Date.now()}`;
        }
      } catch (error) {
        console.warn('[DesignCanvas] Error loading drawing:', error);
      }
    };

    loadDrawing();

    return () => {
      if (img) {
        img.onload = null;
        img.onerror = null;
        img.src = '';
      }
    };
  }, [screenId]);

  /**
   * Check if drawing canvas has any content
   */
  const hasDrawingContent = useCallback((): boolean => {
    const canvas = drawingCanvasRef.current;
    if (!canvas) return false;
    const ctx = canvas.getContext('2d');
    if (!ctx) return false;
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return imageData.data.some((val, i) => i % 4 === 3 && val > 0);
  }, []);

  /**
   * Capture for device - sends exact pixels to backend.
   * Includes any freehand drawings on the canvas.
   *
   * Strategy: Send drawing as separate PNG to backend, let backend render
   * widgets with Puppeteer and composite them together. This avoids browser
   * canvas taint restrictions.
   */
  const captureForDevice = useCallback(async (): Promise<{ captureUrl: string; filename: string; size: number } | null> => {
    if (!screenId) {
      console.warn('Cannot capture: missing screenId');
      return null;
    }

    const drawingCanvas = drawingCanvasRef.current;
    const hasDrawingData = hasDrawingContent();

    try {
      // Capture drawing as PNG blob (if there's drawing content)
      let drawingBlob: Blob | null = null;
      if (hasDrawingData && drawingCanvas) {
        drawingBlob = await new Promise<Blob>((resolve, reject) => {
          drawingCanvas.toBlob((b) => {
            if (b) resolve(b);
            else reject(new Error('Failed to convert drawing to blob'));
          }, 'image/png');
        });
      }

      // Send to backend - backend will render widgets with Puppeteer and composite drawing
      const result = await screenDesignerService.captureWithDrawing(screenId, drawingBlob);
      return result;
    } catch (error) {
      console.error('[captureForDevice] Failed:', error);
      return null;
    }
  }, [screenId, hasDrawingContent]);

  const handleWidgetDragStateChange = useCallback((isDragging: boolean, guides: ActiveGuides) => {
    setIsWidgetDragging(isDragging);
    setActiveGuides(guides);
  }, []);

  const handleCanvasClick = useCallback(() => {
    onSelectWidget(null);
  }, [onSelectWidget]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const data = e.dataTransfer.getData('application/json');
    if (!data) return;

    try {
      const template = JSON.parse(data) as WidgetTemplate;
      if (canvasRef.current) {
        const canvasRect = canvasRef.current.getBoundingClientRect();
        const x = e.clientX - canvasRect.left;
        const y = e.clientY - canvasRect.top;
        const dropX = Math.max(0, Math.min(width - template.minWidth, x - template.minWidth / 2));
        const dropY = Math.max(0, Math.min(height - template.minHeight, y - template.minHeight / 2));
        onDropWidget(template, Math.round(dropX), Math.round(dropY));
      }
    } catch (err) {
      console.error('Failed to parse dropped widget data:', err);
    }
  }, [width, height, onDropWidget]);

  const getTemplate = useCallback((templateId: number): WidgetTemplate | undefined => {
    return templates.find((t) => t.id === templateId);
  }, [templates]);

  // Drawing mode handlers
  const handleToggleDrawingMode = useCallback(() => {
    // Warn if leaving drawing mode with unsaved content
    if (isDrawingMode && hasDrawingContent()) {
      const confirmLeave = window.confirm(
        'You have unsaved drawing content. The drawing will be included when you save the screen.\n\nClick "Save" in the toolbar to convert it to an image widget first, or click OK to keep as overlay.'
      );
      if (!confirmLeave) return;
    }
    setIsDrawingMode((prev) => !prev);
    if (!isDrawingMode) onSelectWidget(null);
  }, [isDrawingMode, onSelectWidget, hasDrawingContent]);

  const handleClearDrawing = useCallback(async (deleteFromServer = false) => {
    const canvas = drawingCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawing(false);

    // Optionally delete from server
    if (deleteFromServer && screenId) {
      try {
        await screenDesignerService.deleteDrawing(screenId);
      } catch (error) {
        console.warn('[DesignCanvas] Failed to delete drawing from server:', error);
      }
    }
  }, [screenId]);

  const handleSaveDrawing = useCallback(async () => {
    const canvas = drawingCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const hasContent = imageData.data.some((val, i) => i % 4 === 3 && val > 0);
    if (!hasContent) {
      alert('Nothing to save - draw something first');
      return;
    }

    const imageTemplate = templates.find(t => t.name === 'image');
    if (!imageTemplate) {
      alert('Error: Image widget template not found');
      return;
    }

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) {
      alert('Error: Failed to save drawing');
      return;
    }

    try {
      const file = new File([blob], 'drawing.png', { type: 'image/png' });
      const result = await screenDesignerService.uploadWidgetImage(file);
      const dropX = Math.max(0, (width - 200) / 2);
      const dropY = Math.max(0, (height - 150) / 2);
      onDropWidget({
        ...imageTemplate,
        defaultConfig: { ...imageTemplate.defaultConfig, imageUrl: result.url },
      }, dropX, dropY);
      handleClearDrawing();
      setIsDrawingMode(false);
    } catch (error) {
      console.error('Failed to save drawing:', error);
      alert('Failed to save drawing. Please try again.');
    }
  }, [templates, width, height, onDropWidget, handleClearDrawing]);

  // Expose methods to parent component
  useImperativeHandle(ref, () => ({
    captureForDevice,
    hasDrawingContent,
    saveDrawingAsWidget: handleSaveDrawing,
    clearDrawing: handleClearDrawing,
  }), [captureForDevice, hasDrawingContent, handleSaveDrawing, handleClearDrawing]);

  const getCanvasPoint = useCallback((e: MouseEvent | React.MouseEvent): { x: number; y: number } => {
    const canvas = drawingCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    // Scale from displayed coordinates to canvas internal coordinates
    // This handles cases where CSS display size differs from canvas resolution
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  }, []);

  // Flood fill (bucket) function - defined before handleDrawStart since it's used there
  const handleBucketFill = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawingMode || !isBucket) return;
    e.preventDefault();
    e.stopPropagation();

    const canvas = drawingCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const point = getCanvasPoint(e);
    const x = Math.floor(point.x);
    const y = Math.floor(point.y);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;

    // Get target color at click position
    const targetIdx = (y * canvasWidth + x) * 4;
    const targetR = data[targetIdx];
    const targetG = data[targetIdx + 1];
    const targetB = data[targetIdx + 2];
    const targetA = data[targetIdx + 3];

    // Parse fill color
    const fillColor = brushColor === '#000000'
      ? { r: 0, g: 0, b: 0, a: 255 }
      : { r: 255, g: 255, b: 255, a: 255 };

    // Don't fill if target is same as fill color
    if (targetR === fillColor.r && targetG === fillColor.g &&
        targetB === fillColor.b && targetA === fillColor.a) {
      return;
    }

    // Flood fill using stack-based algorithm
    const stack: [number, number][] = [[x, y]];
    const visited = new Set<string>();

    const matchesTarget = (idx: number) => {
      return data[idx] === targetR &&
             data[idx + 1] === targetG &&
             data[idx + 2] === targetB &&
             data[idx + 3] === targetA;
    };

    while (stack.length > 0) {
      const [cx, cy] = stack.pop()!;
      const key = `${cx},${cy}`;

      if (visited.has(key)) continue;
      if (cx < 0 || cx >= canvasWidth || cy < 0 || cy >= canvasHeight) continue;

      const idx = (cy * canvasWidth + cx) * 4;
      if (!matchesTarget(idx)) continue;

      visited.add(key);

      // Fill pixel
      data[idx] = fillColor.r;
      data[idx + 1] = fillColor.g;
      data[idx + 2] = fillColor.b;
      data[idx + 3] = fillColor.a;

      // Add neighbors
      stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
    }

    ctx.putImageData(imageData, 0, 0);
    setHasDrawing(true);

    // Save to history (capped at MAX_HISTORY entries)
    const newImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    setHistory(prev => {
      const trimmed = [...prev.slice(0, historyIndex + 1), newImageData];
      if (trimmed.length > MAX_HISTORY) {
        const overflow = trimmed.length - MAX_HISTORY;
        return trimmed.slice(overflow);
      }
      return trimmed;
    });
    setHistoryIndex(prev => Math.min(prev + 1, MAX_HISTORY - 1));
  }, [isDrawingMode, isBucket, getCanvasPoint, brushColor, historyIndex]);

  const handleDrawStart = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawingMode) return;
    // Bucket fill is handled separately
    if (isBucket) {
      handleBucketFill(e);
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    setIsDrawing(true);
    if (!isEraser) setHasDrawing(true);
    const point = getCanvasPoint(e);
    lastPointRef.current = point;

    const canvas = drawingCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (isEraser) {
      // Eraser: clear to transparent (reveals widgets underneath)
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.arc(point.x, point.y, brushSize / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    } else {
      // Draw: paint with color
      ctx.beginPath();
      ctx.arc(point.x, point.y, brushSize / 2, 0, Math.PI * 2);
      ctx.fillStyle = brushColor;
      ctx.fill();
    }
  }, [isDrawingMode, isBucket, handleBucketFill, getCanvasPoint, brushSize, brushColor, isEraser]);

  // Window-level move handler for drawing outside canvas bounds
  const handleWindowDrawMove = useCallback((e: MouseEvent) => {
    if (!isDrawingMode || !isDrawing) return;

    const canvas = drawingCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const point = getCanvasPoint(e);
    const lastPoint = lastPointRef.current;
    if (lastPoint) {
      if (isEraser) {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.beginPath();
        ctx.moveTo(lastPoint.x, lastPoint.y);
        ctx.lineTo(point.x, point.y);
        ctx.lineWidth = brushSize;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();
        ctx.globalCompositeOperation = 'source-over';
      } else {
        ctx.beginPath();
        ctx.moveTo(lastPoint.x, lastPoint.y);
        ctx.lineTo(point.x, point.y);
        ctx.strokeStyle = brushColor;
        ctx.lineWidth = brushSize;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();
      }
    }
    lastPointRef.current = point;
  }, [isDrawingMode, isDrawing, getCanvasPoint, brushSize, brushColor, isEraser]);

  const handleDrawEnd = useCallback(() => {
    if (isDrawing) {
      // Save to history after drawing stroke ends
      const canvas = drawingCanvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          setHistory(prev => {
            const trimmed = [...prev.slice(0, historyIndex + 1), imageData];
            if (trimmed.length > MAX_HISTORY) {
              const overflow = trimmed.length - MAX_HISTORY;
              return trimmed.slice(overflow);
            }
            return trimmed;
          });
          setHistoryIndex(prev => Math.min(prev + 1, MAX_HISTORY - 1));
        }
      }
    }
    setIsDrawing(false);
    lastPointRef.current = null;
  }, [isDrawing, historyIndex]);

  // Attach window-level events when drawing to continue drawing outside canvas
  useEffect(() => {
    if (isDrawing) {
      window.addEventListener('mousemove', handleWindowDrawMove);
      window.addEventListener('mouseup', handleDrawEnd);
      return () => {
        window.removeEventListener('mousemove', handleWindowDrawMove);
        window.removeEventListener('mouseup', handleDrawEnd);
      };
    }
  }, [isDrawing, handleWindowDrawMove, handleDrawEnd]);

  // Save initial state to history when drawing mode is enabled
  useEffect(() => {
    if (isDrawingMode && history.length === 0) {
      const canvas = drawingCanvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          setHistory([imageData]);
          setHistoryIndex(0);
        }
      }
    }
  }, [isDrawingMode, history.length]);

  // Undo function
  const handleUndo = useCallback(() => {
    if (historyIndex <= 0) return;
    const canvas = drawingCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const newIndex = historyIndex - 1;
    ctx.putImageData(history[newIndex], 0, 0);
    setHistoryIndex(newIndex);
  }, [history, historyIndex]);

  // Redo function
  const handleRedo = useCallback(() => {
    if (historyIndex >= history.length - 1) return;
    const canvas = drawingCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const newIndex = historyIndex + 1;
    ctx.putImageData(history[newIndex], 0, 0);
    setHistoryIndex(newIndex);
  }, [history, historyIndex]);

  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isDrawingMode) return;
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDrawingMode, handleUndo, handleRedo]);

  return (
    <div className="flex-1 flex flex-col bg-bg-muted overflow-hidden">
      {/* Toolbar */}
      <div className="flex-shrink-0 px-4 py-2.5 bg-bg-card border-b border-border-light flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Grid toggle */}
          <button
            onClick={() => setShowGrid(!showGrid)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${showGrid ? 'bg-bg-muted text-text-secondary' : 'text-text-muted hover:bg-bg-muted'}`}
            title={showGrid ? 'Hide grid' : 'Show grid'}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM9 4v16M15 4v16M4 9h16M4 15h16" />
            </svg>
            <span>Grid</span>
          </button>

          {/* Snap indicator */}
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm ${isWidgetDragging ? 'bg-accent-light text-accent' : 'text-text-placeholder'}`}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16M4 12h16" />
            </svg>
            <span>Snap</span>
          </div>

          <div className="w-px h-5 bg-border-light" />

          {/* Draw mode */}
          <button
            onClick={handleToggleDrawingMode}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${isDrawingMode ? 'bg-accent text-text-inverse' : 'text-text-muted hover:bg-bg-muted'}`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            <span>Draw</span>
          </button>

          {isDrawingMode && (
            <>
              <div className="w-px h-5 bg-border-light" />
              {/* Color and tool selection */}
              <div className="flex items-center gap-1">
                <button onClick={() => { setBrushColor('#000000'); setIsEraser(false); setIsBucket(false); }} className={`w-6 h-6 rounded border-2 ${brushColor === '#000000' && !isEraser && !isBucket ? 'border-accent' : 'border-border-light'}`} style={{ backgroundColor: '#000000' }} title="Black brush" />
                <button onClick={() => { setBrushColor('#ffffff'); setIsEraser(false); setIsBucket(false); }} className={`w-6 h-6 rounded border-2 ${brushColor === '#ffffff' && !isEraser && !isBucket ? 'border-accent' : 'border-border-light'}`} style={{ backgroundColor: '#ffffff' }} title="White brush" />
                <button onClick={() => { setIsEraser(!isEraser); setIsBucket(false); }} className={`p-1 rounded ${isEraser ? 'bg-accent text-text-inverse' : 'text-text-muted hover:bg-bg-muted'}`} title="Eraser">
                  {/* Lucide eraser icon - MIT license */}
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 21H8a2 2 0 0 1-1.42-.587l-3.994-3.999a2 2 0 0 1 0-2.828l10-10a2 2 0 0 1 2.829 0l5.999 6a2 2 0 0 1 0 2.828L12.834 21" />
                    <path d="m5.082 11.09 8.828 8.828" />
                  </svg>
                </button>
                <button onClick={() => { setIsBucket(!isBucket); setIsEraser(false); }} className={`p-1 rounded ${isBucket ? 'bg-accent text-text-inverse' : 'text-text-muted hover:bg-bg-muted'}`} title="Bucket fill">
                  {/* Lucide paint-bucket icon - MIT license */}
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="m19 11-8-8-8.6 8.6a2 2 0 0 0 0 2.8l5.2 5.2c.8.8 2 .8 2.8 0L19 11Z" />
                    <path d="m5 2 5 5" />
                    <path d="M2 13h15" />
                    <path d="M22 20a2 2 0 1 1-4 0c0-1.6 1.7-2.4 2-4 .3 1.6 2 2.4 2 4Z" />
                  </svg>
                </button>
              </div>
              <input type="range" min="1" max="20" value={brushSize} onChange={(e) => setBrushSize(parseInt(e.target.value))} className="w-16 h-1 accent-accent" title="Brush size" />
              <span className="text-xs text-text-muted">{brushSize}px</span>

              <div className="w-px h-5 bg-border-light" />

              {/* Undo/Redo buttons */}
              <div className="flex items-center gap-1">
                <button
                  onClick={handleUndo}
                  disabled={historyIndex <= 0}
                  className={`p-1 rounded ${historyIndex <= 0 ? 'text-text-placeholder cursor-not-allowed' : 'text-text-muted hover:bg-bg-muted'}`}
                  title="Undo (Ctrl+Z)"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                  </svg>
                </button>
                <button
                  onClick={handleRedo}
                  disabled={historyIndex >= history.length - 1}
                  className={`p-1 rounded ${historyIndex >= history.length - 1 ? 'text-text-placeholder cursor-not-allowed' : 'text-text-muted hover:bg-bg-muted'}`}
                  title="Redo (Ctrl+Shift+Z)"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" />
                  </svg>
                </button>
              </div>

              <div className="w-px h-5 bg-border-light" />

              <button onClick={() => {
                if (!window.confirm('Clear the drawing?')) return;
                const deleteFromServer = window.confirm('Also delete from server?');
                handleClearDrawing(deleteFromServer);
              }} className="px-2 py-1 text-xs text-text-muted hover:bg-bg-muted rounded">Clear</button>
              <button onClick={handleSaveDrawing} className="px-2 py-1 text-xs bg-status-success-bg text-status-success-text rounded">Save</button>
            </>
          )}
        </div>

        <div className="flex items-center gap-3">
          <span className="text-sm text-text-muted">{width} × {height}</span>
          <span className="text-sm text-text-muted">{widgets.length} widget{widgets.length !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 overflow-auto flex items-center justify-center p-8">
        <div className="relative pt-8"> {/* pt-8 adds space for labels above canvas */}
          {/* Canvas container - widgets can overflow for visibility in designer */}
          <div
            className={`relative transition-shadow ${isDragOver ? 'ring-2 ring-accent ring-offset-2' : ''}`}
            style={{
              border: '3px solid #1a1a1a',
              borderRadius: '2px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
            }}
          >
            <div
              ref={canvasRef}
              data-canvas
              className="relative"
              style={{ width, height, backgroundColor: background || '#ffffff', isolation: 'isolate' }}
              onClick={handleCanvasClick}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              {/* Grid */}
              {showGrid && (
                <div className="absolute inset-0 pointer-events-none opacity-40" style={{
                  backgroundImage: 'linear-gradient(to right, rgba(156,163,175,0.3) 1px, transparent 1px), linear-gradient(to bottom, rgba(156,163,175,0.3) 1px, transparent 1px)',
                  backgroundSize: '20px 20px',
                }} />
              )}

              {/* Drawing canvas - rendered BEFORE widgets so it's behind them in DOM order */}
              {/* When in drawing mode, it gets higher z-index to allow drawing on top */}
              <canvas
                ref={drawingCanvasRef}
                width={width}
                height={height}
                className="absolute inset-0"
                style={{
                  zIndex: isDrawingMode ? 100 : 1,
                  cursor: isDrawingMode
                    ? (isBucket ? 'cell' : isEraser ? 'not-allowed' : 'crosshair')
                    : 'default',
                  pointerEvents: isDrawingMode ? 'auto' : 'none',
                }}
                onMouseDown={handleDrawStart}
              />

              {/* Snap guides */}
              {isWidgetDragging && (
                <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 50 }}>
                  {activeGuides.vertical.map((x, i) => (
                    <div key={`v-${i}`} className="absolute top-0 bottom-0" style={{ left: x, width: 1, background: 'rgba(59,130,246,0.9)' }} />
                  ))}
                  {activeGuides.horizontal.map((y, i) => (
                    <div key={`h-${i}`} className="absolute left-0 right-0" style={{ top: y, height: 1, background: 'rgba(59,130,246,0.9)' }} />
                  ))}
                </div>
              )}

              {/* Widgets container - anti-aliasing disabled for pixel-perfect e-ink rendering */}
              {/* Background is transparent so drawing canvas shows through */}
              {/* overflow-visible so designer shows full widgets, device will clip */}
              <div
                ref={widgetsContainerRef}
                className="absolute inset-0 overflow-visible"
                style={{
                  width,
                  height,
                  zIndex: 10,
                  backgroundColor: 'transparent', // Transparent so drawing shows through
                  // Disable font anti-aliasing for crisp B&W text
                  WebkitFontSmoothing: 'none',
                  MozOsxFontSmoothing: 'grayscale',
                  textRendering: 'optimizeSpeed',
                  fontSmooth: 'never',
                }}
              >
                {widgets.map((widget) => {
                  const template = getTemplate(widget.templateId);
                  if (!template) return null;
                  return (
                    <DraggableWidget
                      key={widget.id}
                      widget={widget}
                      template={template}
                      isSelected={selectedWidgetId === widget.id}
                      scale={1}
                      canvasWidth={width}
                      canvasHeight={height}
                      otherWidgets={widgets.filter(w => w.id !== widget.id)}
                      snapThreshold={8}
                      onSelect={() => onSelectWidget(widget.id)}
                      onMove={(x, y) => onUpdateWidget(widget.id, { x, y })}
                      onResize={(w, h) => onUpdateWidget(widget.id, { width: w, height: h })}
                      onRotate={(rotation) => onUpdateWidget(widget.id, { rotation })}
                      onDelete={() => onDeleteWidget(widget.id)}
                      onDragStateChange={handleWidgetDragStateChange}
                    />
                  );
                })}

                {/* Empty state */}
                {widgets.length === 0 && !isDragOver && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="text-center px-8">
                      <p className="text-sm font-medium text-text-secondary mb-1">Drop widgets here</p>
                      <p className="text-xs text-text-placeholder">Drag from the sidebar</p>
                    </div>
                  </div>
                )}

                {/* Drop indicator */}
                {isDragOver && (
                  <div className="absolute inset-0 flex items-center justify-center bg-accent-light/50 pointer-events-none">
                    <p className="text-sm font-medium text-accent">Drop to add</p>
                  </div>
                )}
              </div>
            </div>

            {/* Widget labels overlay - always visible above everything */}
            <div className="absolute inset-0 overflow-visible pointer-events-none" style={{ zIndex: 1000 }}>
              {widgets.map((widget) => {
                const template = getTemplate(widget.templateId);
                if (!template) return null;

                const isSelected = selectedWidgetId === widget.id;

                // Position label above widget, or below if near top edge
                const labelAbove = widget.y >= 30;
                const labelTop = labelAbove ? widget.y - 24 : widget.y + widget.height + 4;

                return (
                  <div
                    key={`label-${widget.id}`}
                    className={`absolute px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap shadow-sm ${
                      isSelected
                        ? 'bg-accent text-text-inverse shadow-md'
                        : 'bg-gray-700 text-white opacity-80'
                    }`}
                    style={{
                      left: widget.x,
                      top: labelTop,
                    }}
                  >
                    {template.label}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Status bar */}
      <div className="flex-shrink-0 px-4 py-2 bg-bg-card border-t border-border-light flex items-center justify-between text-xs text-text-muted">
        <span>{width} × {height}px</span>
        <div className="flex items-center gap-3">
          {hasDrawing && (
            <div className="flex items-center gap-1.5 text-accent">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
              <span>Drawing overlay</span>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-status-success-text" />
            <span>Ready</span>
          </div>
        </div>
      </div>
    </div>
  );
});
