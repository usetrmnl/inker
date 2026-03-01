/**
 * ScreenDesignPreview Component
 * Renders a 1:1 scaled-down preview of a screen design with its widgets.
 *
 * Uses CSS transform to scale the entire design uniformly, ensuring
 * the preview looks exactly like the designer - just smaller.
 */
import { useRef, useState, useEffect } from 'react';
import type { ScreenDesign, WidgetTemplate } from '../../types';
import { WidgetRenderer } from './WidgetRenderer';

interface ScreenDesignPreviewProps {
  design: ScreenDesign;
  templates: WidgetTemplate[];
  className?: string;
}

export function ScreenDesignPreview({ design, templates, className = '' }: ScreenDesignPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.2);

  // Create a template lookup map for quick access
  const templateMap = new Map(templates.map(t => [t.id, t]));

  // Calculate scale factor when container size changes
  useEffect(() => {
    const updateScale = () => {
      if (containerRef.current) {
        const containerWidth = containerRef.current.offsetWidth;
        const containerHeight = containerRef.current.offsetHeight;

        // Calculate scale to fit design in container
        const scaleX = containerWidth / design.width;
        const scaleY = containerHeight / design.height;

        // Use the smaller scale to ensure it fits
        setScale(Math.min(scaleX, scaleY));
      }
    };

    updateScale();

    // Update on resize
    const resizeObserver = new ResizeObserver(updateScale);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => resizeObserver.disconnect();
  }, [design.width, design.height]);

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full overflow-hidden ${className}`}
      style={{ backgroundColor: design.background || '#FFFFFF' }}
    >
      {/* Container for the scaled design */}
      <div
        className="absolute origin-top-left"
        style={{
          width: design.width,
          height: design.height,
          transform: `scale(${scale})`,
          // Center the scaled design
          left: '50%',
          top: '50%',
          marginLeft: -(design.width * scale) / 2,
          marginTop: -(design.height * scale) / 2,
        }}
      >
        {/* Render each widget at actual size - transform handles scaling */}
        {design.widgets.map((widget) => {
          const template = templateMap.get(widget.templateId);
          if (!template) return null;

          return (
            <div
              key={widget.id}
              className="absolute overflow-hidden"
              style={{
                left: widget.x,
                top: widget.y,
                width: widget.width,
                height: widget.height,
                zIndex: widget.zIndex,
                transform: widget.rotation ? `rotate(${widget.rotation}deg)` : undefined,
                transformOrigin: 'center center',
                opacity: ((widget.config.opacity as number) ?? 100) / 100,
              }}
            >
              {/* Use the actual WidgetRenderer for 1:1 fidelity */}
              <WidgetRenderer widget={widget} template={template} />
            </div>
          );
        })}

        {/* Show placeholder if no widgets */}
        {design.widgets.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-text-placeholder">
            <span className="text-xl">Empty design</span>
          </div>
        )}
      </div>
    </div>
  );
}
