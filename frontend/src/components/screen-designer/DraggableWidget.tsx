/**
 * DraggableWidget Component
 * Wrapper for widgets on the canvas that handles dragging and resizing.
 * Uses refs to access DOM elements for measuring and positioning,
 * and handles mouse events to implement drag and resize functionality.
 */
import { useState, useRef, useCallback } from 'react';
import type { ScreenWidget, WidgetTemplate } from '../../types';
import { WidgetRenderer } from './WidgetRenderer';

// Snap guide lines configuration
export interface SnapGuide {
  position: number;  // Position in pixels
  type: 'center' | 'third' | 'edge' | 'widget';
  orientation: 'horizontal' | 'vertical';
}

export interface ActiveGuides {
  vertical: number[];    // X positions of active vertical guides
  horizontal: number[];  // Y positions of active horizontal guides
  widgetVertical: number[];   // X positions from other widgets
  widgetHorizontal: number[]; // Y positions from other widgets
}

interface DraggableWidgetProps {
  widget: ScreenWidget;
  template: WidgetTemplate;
  isSelected: boolean;
  scale: number;
  canvasWidth: number;
  canvasHeight: number;
  otherWidgets?: ScreenWidget[];  // Other widgets for widget-to-widget snapping
  snapThreshold?: number;  // Distance to snap (default 8px)
  onSelect: () => void;
  onMove: (x: number, y: number) => void;
  onResize: (width: number, height: number) => void;
  onRotate: (rotation: number) => void;
  onDelete: () => void;
  onDragStateChange?: (isDragging: boolean, activeGuides: ActiveGuides) => void;
}

type ResizeHandle = 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'e' | 'w';

export function DraggableWidget({
  widget,
  template,
  isSelected,
  scale,
  canvasWidth,
  canvasHeight,
  otherWidgets = [],
  snapThreshold = 8,
  onSelect,
  onMove,
  onResize,
  onRotate,
  onDelete,
  onDragStateChange,
}: DraggableWidgetProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [isRotating, setIsRotating] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const dragStartRef = useRef({ x: 0, y: 0 });
  const widgetStartRef = useRef({ x: 0, y: 0, width: 0, height: 0 });
  const rotationStartRef = useRef({ angle: 0, startRotation: 0 });

  /**
   * Calculate snap guides based on canvas dimensions and other widgets
   * Returns arrays of vertical (X) and horizontal (Y) snap positions
   */
  const getSnapGuides = useCallback(() => {
    // Canvas-based guides
    const verticalGuides = [
      0,                          // Left edge
      canvasWidth / 3,            // Left third
      canvasWidth / 2,            // Center
      (canvasWidth * 2) / 3,      // Right third
      canvasWidth,                // Right edge
    ];
    const horizontalGuides = [
      0,                          // Top edge
      canvasHeight / 3,           // Top third
      canvasHeight / 2,           // Center
      (canvasHeight * 2) / 3,     // Bottom third
      canvasHeight,               // Bottom edge
    ];

    // Widget-based guides (from other widgets' edges and centers)
    const widgetVerticalGuides: number[] = [];
    const widgetHorizontalGuides: number[] = [];

    for (const other of otherWidgets) {
      // Vertical guides from other widget (X positions)
      widgetVerticalGuides.push(other.x);                           // Left edge
      widgetVerticalGuides.push(other.x + other.width / 2);         // Center X
      widgetVerticalGuides.push(other.x + other.width);             // Right edge

      // Horizontal guides from other widget (Y positions)
      widgetHorizontalGuides.push(other.y);                          // Top edge
      widgetHorizontalGuides.push(other.y + other.height / 2);       // Center Y
      widgetHorizontalGuides.push(other.y + other.height);           // Bottom edge
    }

    return {
      verticalGuides,
      horizontalGuides,
      widgetVerticalGuides,
      widgetHorizontalGuides,
    };
  }, [canvasWidth, canvasHeight, otherWidgets]);

  /**
   * Calculate snapped position and active guides
   * Checks widget edges and center against canvas guides and other widgets
   */
  const calculateSnappedPosition = useCallback(
    (x: number, y: number, width: number, height: number) => {
      const { verticalGuides, horizontalGuides, widgetVerticalGuides, widgetHorizontalGuides } = getSnapGuides();
      const activeVertical: number[] = [];
      const activeHorizontal: number[] = [];
      const activeWidgetVertical: number[] = [];
      const activeWidgetHorizontal: number[] = [];

      let snappedX = x;
      let snappedY = y;
      let snapXFound = false;
      let snapYFound = false;

      // Widget edges and center for X axis
      const widgetLeft = x;
      const widgetCenterX = x + width / 2;
      const widgetRight = x + width;

      // Widget edges and center for Y axis
      const widgetTop = y;
      const widgetCenterY = y + height / 2;
      const widgetBottom = y + height;

      // Check canvas vertical guides (X positions) first
      for (const guide of verticalGuides) {
        if (snapXFound) break;
        // Snap left edge
        if (Math.abs(widgetLeft - guide) < snapThreshold) {
          snappedX = guide;
          activeVertical.push(guide);
          snapXFound = true;
        }
        // Snap center X
        else if (Math.abs(widgetCenterX - guide) < snapThreshold) {
          snappedX = guide - width / 2;
          activeVertical.push(guide);
          snapXFound = true;
        }
        // Snap right edge
        else if (Math.abs(widgetRight - guide) < snapThreshold) {
          snappedX = guide - width;
          activeVertical.push(guide);
          snapXFound = true;
        }
      }

      // Check widget vertical guides if no canvas snap found
      if (!snapXFound) {
        for (const guide of widgetVerticalGuides) {
          if (snapXFound) break;
          // Snap left edge to widget
          if (Math.abs(widgetLeft - guide) < snapThreshold) {
            snappedX = guide;
            activeWidgetVertical.push(guide);
            snapXFound = true;
          }
          // Snap center X to widget
          else if (Math.abs(widgetCenterX - guide) < snapThreshold) {
            snappedX = guide - width / 2;
            activeWidgetVertical.push(guide);
            snapXFound = true;
          }
          // Snap right edge to widget
          else if (Math.abs(widgetRight - guide) < snapThreshold) {
            snappedX = guide - width;
            activeWidgetVertical.push(guide);
            snapXFound = true;
          }
        }
      }

      // Check canvas horizontal guides (Y positions) first
      for (const guide of horizontalGuides) {
        if (snapYFound) break;
        // Snap top edge
        if (Math.abs(widgetTop - guide) < snapThreshold) {
          snappedY = guide;
          activeHorizontal.push(guide);
          snapYFound = true;
        }
        // Snap center Y
        else if (Math.abs(widgetCenterY - guide) < snapThreshold) {
          snappedY = guide - height / 2;
          activeHorizontal.push(guide);
          snapYFound = true;
        }
        // Snap bottom edge
        else if (Math.abs(widgetBottom - guide) < snapThreshold) {
          snappedY = guide - height;
          activeHorizontal.push(guide);
          snapYFound = true;
        }
      }

      // Check widget horizontal guides if no canvas snap found
      if (!snapYFound) {
        for (const guide of widgetHorizontalGuides) {
          if (snapYFound) break;
          // Snap top edge to widget
          if (Math.abs(widgetTop - guide) < snapThreshold) {
            snappedY = guide;
            activeWidgetHorizontal.push(guide);
            snapYFound = true;
          }
          // Snap center Y to widget
          else if (Math.abs(widgetCenterY - guide) < snapThreshold) {
            snappedY = guide - height / 2;
            activeWidgetHorizontal.push(guide);
            snapYFound = true;
          }
          // Snap bottom edge to widget
          else if (Math.abs(widgetBottom - guide) < snapThreshold) {
            snappedY = guide - height;
            activeWidgetHorizontal.push(guide);
            snapYFound = true;
          }
        }
      }

      return {
        x: snappedX,
        y: snappedY,
        activeGuides: {
          vertical: activeVertical,
          horizontal: activeHorizontal,
          widgetVertical: activeWidgetVertical,
          widgetHorizontal: activeWidgetHorizontal,
        },
      };
    },
    [getSnapGuides, snapThreshold]
  );

  /**
   * Handle click on widget to select it
   * Uses e.stopPropagation() to prevent the click from bubbling
   * to the canvas and deselecting the widget
   */
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onSelect();
    },
    [onSelect]
  );

  /**
   * Handle mouse down on widget for dragging
   */
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      onSelect();

      setIsDragging(true);
      dragStartRef.current = { x: e.clientX, y: e.clientY };
      widgetStartRef.current = {
        x: widget.x,
        y: widget.y,
        width: widget.width,
        height: widget.height,
      };

      // Notify parent that dragging started
      onDragStateChange?.(true, { vertical: [], horizontal: [], widgetVertical: [], widgetHorizontal: [] });

      const handleMouseMove = (e: MouseEvent) => {
        const dx = (e.clientX - dragStartRef.current.x) / scale;
        const dy = (e.clientY - dragStartRef.current.y) / scale;

        // Allow widgets to be placed anywhere (no boundary restrictions)
        const rawX = widgetStartRef.current.x + dx;
        const rawY = widgetStartRef.current.y + dy;

        // Calculate snapped position and active guides
        const snapped = calculateSnappedPosition(
          rawX,
          rawY,
          widget.width,
          widget.height
        );

        // Notify parent about active guides for rendering
        onDragStateChange?.(true, snapped.activeGuides);

        onMove(Math.round(snapped.x), Math.round(snapped.y));
      };

      const handleMouseUp = () => {
        setIsDragging(false);
        // Notify parent that dragging ended
        onDragStateChange?.(false, { vertical: [], horizontal: [], widgetVertical: [], widgetHorizontal: [] });
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [widget.x, widget.y, widget.width, widget.height, scale, onSelect, onMove, onDragStateChange, calculateSnappedPosition]
  );

  /**
   * Handle mouse down on resize handle
   */
  const handleResizeMouseDown = useCallback(
    (e: React.MouseEvent, handle: ResizeHandle) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      e.preventDefault();

      setIsResizing(true);
      dragStartRef.current = { x: e.clientX, y: e.clientY };
      widgetStartRef.current = {
        x: widget.x,
        y: widget.y,
        width: widget.width,
        height: widget.height,
      };

      const handleMouseMove = (e: MouseEvent) => {
        const dx = (e.clientX - dragStartRef.current.x) / scale;
        const dy = (e.clientY - dragStartRef.current.y) / scale;

        let newWidth = widgetStartRef.current.width;
        let newHeight = widgetStartRef.current.height;
        let newX = widgetStartRef.current.x;
        let newY = widgetStartRef.current.y;

        // Allow free resizing with a small minimum (10px)
        const minSize = 10;

        switch (handle) {
          case 'se':
            newWidth = Math.max(minSize, widgetStartRef.current.width + dx);
            newHeight = Math.max(minSize, widgetStartRef.current.height + dy);
            break;
          case 'sw':
            newWidth = Math.max(minSize, widgetStartRef.current.width - dx);
            newHeight = Math.max(minSize, widgetStartRef.current.height + dy);
            newX = widgetStartRef.current.x + (widgetStartRef.current.width - newWidth);
            break;
          case 'ne':
            newWidth = Math.max(minSize, widgetStartRef.current.width + dx);
            newHeight = Math.max(minSize, widgetStartRef.current.height - dy);
            newY = widgetStartRef.current.y + (widgetStartRef.current.height - newHeight);
            break;
          case 'nw':
            newWidth = Math.max(minSize, widgetStartRef.current.width - dx);
            newHeight = Math.max(minSize, widgetStartRef.current.height - dy);
            newX = widgetStartRef.current.x + (widgetStartRef.current.width - newWidth);
            newY = widgetStartRef.current.y + (widgetStartRef.current.height - newHeight);
            break;
          case 'n':
            newHeight = Math.max(minSize, widgetStartRef.current.height - dy);
            newY = widgetStartRef.current.y + (widgetStartRef.current.height - newHeight);
            break;
          case 's':
            newHeight = Math.max(minSize, widgetStartRef.current.height + dy);
            break;
          case 'e':
            newWidth = Math.max(minSize, widgetStartRef.current.width + dx);
            break;
          case 'w':
            newWidth = Math.max(minSize, widgetStartRef.current.width - dx);
            newX = widgetStartRef.current.x + (widgetStartRef.current.width - newWidth);
            break;
        }

        // Allow widgets to be positioned anywhere (no boundary restrictions)
        if (newX !== widget.x || newY !== widget.y) {
          onMove(Math.round(newX), Math.round(newY));
        }
        onResize(Math.round(newWidth), Math.round(newHeight));
      };

      const handleMouseUp = () => {
        setIsResizing(false);
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [widget.x, widget.y, widget.width, widget.height, scale, onMove, onResize]
  );

  /**
   * Handle mouse down on rotation handle
   * Calculates rotation based on angle from widget center to mouse position
   */
  const handleRotationMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      e.preventDefault();

      setIsRotating(true);

      // Calculate widget center in screen coordinates
      const widgetCenterX = widget.x + widget.width / 2;
      const widgetCenterY = widget.y + widget.height / 2;

      // Get the canvas element to calculate proper offset
      const target = e.currentTarget as HTMLElement;
      const canvas = target.closest('[data-canvas]') as HTMLElement;
      const canvasRect = canvas?.getBoundingClientRect() || { left: 0, top: 0 };

      // Calculate initial angle from center to mouse
      const mouseX = (e.clientX - canvasRect.left) / scale;
      const mouseY = (e.clientY - canvasRect.top) / scale;
      const initialAngle = Math.atan2(mouseY - widgetCenterY, mouseX - widgetCenterX) * (180 / Math.PI);

      rotationStartRef.current = {
        angle: initialAngle,
        startRotation: widget.rotation || 0,
      };

      const handleMouseMove = (e: MouseEvent) => {
        const mouseX = (e.clientX - canvasRect.left) / scale;
        const mouseY = (e.clientY - canvasRect.top) / scale;

        // Calculate current angle
        const currentAngle = Math.atan2(mouseY - widgetCenterY, mouseX - widgetCenterX) * (180 / Math.PI);
        const angleDelta = currentAngle - rotationStartRef.current.angle;

        // Calculate new rotation
        let newRotation = rotationStartRef.current.startRotation + angleDelta;

        // Snap to 15-degree increments when holding Shift
        if (e.shiftKey) {
          newRotation = Math.round(newRotation / 15) * 15;
        }

        // Normalize to 0-359 range (360 = 0)
        newRotation = ((newRotation % 360) + 360) % 360;
        if (newRotation === 360) newRotation = 0;

        onRotate(Math.round(newRotation));
      };

      const handleMouseUp = () => {
        setIsRotating(false);
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [widget.x, widget.y, widget.width, widget.height, widget.rotation, scale, onRotate]
  );

  /**
   * Handle keyboard events for deletion
   */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (isSelected && (e.key === 'Delete' || e.key === 'Backspace')) {
        e.preventDefault();
        onDelete();
      }
    },
    [isSelected, onDelete]
  );

  // Only bring widget to top when actively dragging, not just when selected
  // This allows users to see all widgets while selecting/positioning
  const widgetZIndex = isDragging || isResizing || isRotating ? 10000 : widget.zIndex;

  return (
    <div
      className={`absolute ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
      style={{
        left: widget.x,
        top: widget.y,
        width: widget.width,
        height: widget.height,
        zIndex: widgetZIndex,
        transform: widget.rotation ? `rotate(${widget.rotation}deg)` : undefined,
        transformOrigin: 'center center',
      }}
      onClick={handleClick}
      onMouseDown={handleMouseDown}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onKeyDown={handleKeyDown}
      tabIndex={isSelected ? 0 : -1}
    >
      {/* Widget content - transparent background so drawing shows through */}
      {/* When dragging: make widget semi-transparent to see other widgets and edges */}
      <div
        className={`
          w-full h-full bg-transparent overflow-hidden
          transition-shadow duration-150
          ${isSelected
            ? 'ring-2 ring-accent shadow-lg'
            : isHovered
              ? 'border-2 border-dashed border-gray-400 shadow-sm'
              : 'border border-dashed border-gray-300'
          }
          ${isDragging ? 'ring-2 ring-accent ring-offset-1' : ''}
        `}
        style={{
          opacity: isDragging
            ? 0.4  // Very transparent when dragging to see underneath
            : ((widget.config.opacity as number) ?? 100) / 100,
        }}
      >
        <WidgetRenderer widget={widget} template={template} />
      </div>

      {/* Selection label is now rendered in DesignCanvas overlay for visibility */}

      {/* Resize handles - always on top when selected */}
      {isSelected && (
        <>
          <ResizeHandleCorner position="nw" onMouseDown={handleResizeMouseDown} />
          <ResizeHandleCorner position="ne" onMouseDown={handleResizeMouseDown} />
          <ResizeHandleCorner position="sw" onMouseDown={handleResizeMouseDown} />
          <ResizeHandleCorner position="se" onMouseDown={handleResizeMouseDown} />
          <ResizeHandleEdge position="n" onMouseDown={handleResizeMouseDown} />
          <ResizeHandleEdge position="s" onMouseDown={handleResizeMouseDown} />
          <ResizeHandleEdge position="e" onMouseDown={handleResizeMouseDown} />
          <ResizeHandleEdge position="w" onMouseDown={handleResizeMouseDown} />
        </>
      )}

      {/* Rotation handle - circular knob below widget, always on top */}
      {isSelected && (
        <div
          className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center"
          style={{ top: '100%', marginTop: 8 }}
        >
          {/* Connecting line */}
          <div className="w-px h-4 bg-accent" />
          {/* Rotation knob */}
          <div
            className="w-5 h-5 rounded-full bg-accent border-2 border-white shadow-md cursor-grab hover:scale-110 transition-transform flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
            onMouseDown={handleRotationMouseDown}
          >
            {/* Rotate icon */}
            <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M1 4v6h6M23 20v-6h-6" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>
      )}

      {/* Size indicator when resizing */}
      {isResizing && (
        <div className="absolute -bottom-14 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-text-primary rounded text-text-inverse text-xs font-mono whitespace-nowrap">
          {Math.round(widget.width)} x {Math.round(widget.height)}
        </div>
      )}

      {/* Position indicator when dragging */}
      {isDragging && (
        <div className="absolute -bottom-14 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-text-primary rounded text-text-inverse text-xs font-mono whitespace-nowrap">
          {Math.round(widget.x)}, {Math.round(widget.y)}
        </div>
      )}

      {/* Rotation indicator when rotating */}
      {isRotating && (
        <div className="absolute -bottom-14 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-accent rounded text-text-inverse text-xs font-mono whitespace-nowrap">
          {Math.round(widget.rotation || 0)}°
        </div>
      )}
    </div>
  );
}

/**
 * Corner resize handle component
 */
function ResizeHandleCorner({
  position,
  onMouseDown,
}: {
  position: 'nw' | 'ne' | 'sw' | 'se';
  onMouseDown: (e: React.MouseEvent, handle: ResizeHandle) => void;
}) {
  const positionStyles: Record<string, string> = {
    nw: 'top-0 left-0 -translate-x-1/2 -translate-y-1/2 cursor-nw-resize',
    ne: 'top-0 right-0 translate-x-1/2 -translate-y-1/2 cursor-ne-resize',
    sw: 'bottom-0 left-0 -translate-x-1/2 translate-y-1/2 cursor-sw-resize',
    se: 'bottom-0 right-0 translate-x-1/2 translate-y-1/2 cursor-se-resize',
  };

  return (
    <div
      className={`
        absolute w-2.5 h-2.5 z-10
        bg-white border-2 border-blue-500 rounded-full
        hover:scale-125 transition-transform
        ${positionStyles[position]}
      `}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => onMouseDown(e, position)}
    />
  );
}

/**
 * Edge resize handle component
 */
function ResizeHandleEdge({
  position,
  onMouseDown,
}: {
  position: 'n' | 's' | 'e' | 'w';
  onMouseDown: (e: React.MouseEvent, handle: ResizeHandle) => void;
}) {
  const positionStyles: Record<string, string> = {
    n: 'top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 cursor-n-resize',
    s: 'bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 cursor-s-resize',
    e: 'right-0 top-1/2 translate-x-1/2 -translate-y-1/2 cursor-e-resize',
    w: 'left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 cursor-w-resize',
  };

  const isHorizontal = position === 'n' || position === 's';

  return (
    <div
      className={`
        absolute z-10
        bg-white border-2 border-blue-500 rounded-full
        hover:scale-110 transition-transform
        ${positionStyles[position]}
      `}
      style={{
        width: isHorizontal ? 12 : 5,
        height: isHorizontal ? 5 : 12,
      }}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => onMouseDown(e, position)}
    />
  );
}
