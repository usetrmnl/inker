/**
 * EInkImage Component
 * Renders images optimized for e-ink displays:
 * - Applies grayscale + high contrast filter to simulate e-ink appearance
 * - Freezes GIF animations by drawing first frame to canvas
 * - Handles loading and error states
 * - Transforms /uploads/* paths to use backend public URL when configured
 *
 * E-ink displays can't show animations and look best with high contrast
 * black and white images, so this component processes images accordingly.
 */
import { useState, useEffect, useRef, useMemo } from 'react';
import { config } from '../../config';

interface EInkImageProps {
  src: string;
  alt?: string;
  fit?: 'contain' | 'cover' | 'fill';
  className?: string;
  style?: React.CSSProperties;
  maxHeight?: string | number;
}

interface EInkImageState {
  canvasDataUrl: string | null;
  imageError: boolean;
  loading: boolean;
  currentSrc: string;
}

export function EInkImage({
  src,
  alt = 'Image',
  fit = 'contain',
  className = '',
  style = {},
  maxHeight,
}: EInkImageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Transform src URL to use backend public URL for /uploads/* paths
  const resolvedSrc = useMemo(() => config.getAssetUrl(src), [src]);

  // Use a single state object that includes the src it was computed for
  const [state, setState] = useState<EInkImageState>({
    canvasDataUrl: null,
    imageError: false,
    loading: true,
    currentSrc: resolvedSrc,
  });

  // Derive isGif from src using useMemo (no state needed)
  const isGif = useMemo(() => {
    if (!src) return false;
    const urlLower = src.toLowerCase();
    if (urlLower.endsWith('.gif') || urlLower.includes('.gif?')) {
      return true;
    }
    if (urlLower.includes('giphy.com') || urlLower.includes('tenor.com')) {
      return true;
    }
    return false;
  }, [src]);

  // Reset state when src changes - using useEffect to comply with lint rules
  useEffect(() => {
    // Reset state when src changes
    setState({
      canvasDataUrl: null,
      imageError: false,
      loading: true,
      currentSrc: resolvedSrc,
    });
  }, [resolvedSrc]);

  // For GIFs, load image and draw first frame to canvas to freeze animation
  useEffect(() => {
    // Skip if state hasn't been updated for current src yet
    if (state.currentSrc !== resolvedSrc) return;

    if (!isGif || !resolvedSrc) {
      // For non-GIFs, mark as not loading via callback
      setState(prev => prev.currentSrc === resolvedSrc ? { ...prev, loading: false } : prev);
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      const canvas = canvasRef.current;
      if (canvas) {
        // Set canvas size to match image
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;

        const ctx = canvas.getContext('2d');
        if (ctx) {
          // Draw the first frame (this freezes the GIF)
          ctx.drawImage(img, 0, 0);

          // Convert to data URL for display
          try {
            const dataUrl = canvas.toDataURL('image/png');
            setState(prev => ({ ...prev, canvasDataUrl: dataUrl, loading: false }));
          } catch {
            // CORS error - fall back to regular image (will still animate)
            setState(prev => ({ ...prev, canvasDataUrl: null, loading: false }));
          }
        } else {
          setState(prev => ({ ...prev, loading: false }));
        }
      } else {
        setState(prev => ({ ...prev, loading: false }));
      }
    };

    img.onerror = () => {
      setState(prev => ({ ...prev, imageError: true, loading: false }));
    };

    img.src = resolvedSrc;

    return () => {
      img.onload = null;
      img.onerror = null;
    };
    // state.currentSrc is intentionally excluded - we sync based on resolvedSrc, not state
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGif, resolvedSrc]);

  // E-ink filter styles - grayscale with high contrast
  const einkFilter: React.CSSProperties = {
    filter: 'grayscale(100%) contrast(1.5)',
    objectFit: fit,
    ...(maxHeight ? { maxHeight } : {}),
    ...style,
  };

  // Destructure state for cleaner access
  const { canvasDataUrl, imageError, loading } = state;

  if (imageError) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-bg-muted text-text-placeholder">
        <svg className="w-8 h-8 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <span className="text-xs">Image error</span>
      </div>
    );
  }

  if (loading && isGif) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-pulse text-text-placeholder text-xs">Loading...</div>
        {/* Hidden canvas for GIF processing */}
        <canvas ref={canvasRef} style={{ display: 'none' }} />
      </div>
    );
  }

  // For GIFs, use the frozen canvas image (first frame only)
  if (isGif && canvasDataUrl) {
    return (
      <>
        <img
          src={canvasDataUrl}
          alt={alt}
          className={`max-w-full max-h-full ${className}`}
          style={einkFilter}
        />
        {/* Hidden canvas for processing */}
        <canvas ref={canvasRef} style={{ display: 'none' }} />
      </>
    );
  }

  // For regular images (or GIFs that couldn't be processed due to CORS)
  return (
    <>
      <img
        src={resolvedSrc}
        alt={alt}
        className={`max-w-full max-h-full ${className}`}
        style={einkFilter}
        onError={() => setState(prev => ({ ...prev, imageError: true }))}
        onLoad={() => setState(prev => ({ ...prev, loading: false }))}
      />
      {/* Hidden canvas in case needed for GIF processing */}
      {isGif && <canvas ref={canvasRef} style={{ display: 'none' }} />}
    </>
  );
}
