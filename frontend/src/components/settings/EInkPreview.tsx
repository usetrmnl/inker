
interface EInkPreviewProps {
  title: string;
  subtitle: string;
  width?: number;
  height?: number;
}

/**
 * EInkPreview component simulates e-ink display rendering
 *
 * Displays a black and white preview of what will appear on the e-ink device
 * Default dimensions are 800x480 (standard TRMNL screen size)
 */
export function EInkPreview({
  title,
  subtitle,
  width = 800,
  height = 480,
}: EInkPreviewProps) {
  // Calculate aspect ratio for responsive scaling
  const aspectRatio = (height / width) * 100;

  return (
    <div className="w-full">
      <div
        className="relative bg-bg-card border-4 border-border-dark rounded-lg overflow-hidden shadow-lg"
        style={{ paddingBottom: `${aspectRatio}%` }}
      >
        {/* E-ink display simulation - grayscale only */}
        <div className="absolute inset-0 flex flex-col items-center justify-center p-8 bg-gradient-to-br from-bg-muted to-border-light">
          {/* Title */}
          <h1
            className="text-black font-bold text-center mb-4"
            style={{
              fontSize: `clamp(1.5rem, 4vw, 3rem)`,
              textShadow: 'none',
              letterSpacing: '0.05em'
            }}
          >
            {title || 'Hello World'}
          </h1>

          {/* Subtitle */}
          <p
            className="text-text-primary text-center max-w-2xl"
            style={{
              fontSize: `clamp(1rem, 2vw, 1.5rem)`,
              textShadow: 'none',
              letterSpacing: '0.02em'
            }}
          >
            {subtitle || 'Welcome to TRMNL'}
          </p>

          {/* E-ink indicator badge */}
          <div className="absolute bottom-4 right-4 px-3 py-1 bg-bg-muted border border-border-default rounded text-xs font-mono text-text-primary">
            {width}×{height} E-Ink
          </div>

          {/* Simulated dither pattern overlay for e-ink effect */}
          <div
            className="absolute inset-0 pointer-events-none opacity-10"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='4' height='4' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 0h1v1H0zm2 2h1v1H2z' fill='%23000'/%3E%3C/svg%3E")`,
              backgroundSize: '4px 4px'
            }}
          />
        </div>
      </div>

      {/* Display info */}
      <p className="mt-2 text-xs text-text-muted text-center">
        Preview of {width}×{height}px e-ink display (monochrome simulation)
      </p>
    </div>
  );
}
