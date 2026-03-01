import { type ReactNode, useEffect, useCallback } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  closeOnBackdrop?: boolean;
  showCloseButton?: boolean;
}

/**
 * Reusable Modal component with monochrome theme
 * Uses CSS variables for easy theme customization
 */
export function Modal({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = 'md',
  closeOnBackdrop = true,
  showCloseButton = true,
}: ModalProps) {
  // Close modal on Escape key
  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    },
    [isOpen, onClose]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [handleEscape]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    full: 'max-w-[90vw]',
  };

  const handleBackdropClick = () => {
    if (closeOnBackdrop) {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[99999] overflow-y-auto">
      {/* Backdrop with blur effect */}
      <div
        className="fixed inset-0 bg-bg-overlay backdrop-blur-sm transition-opacity duration-300"
        onClick={handleBackdropClick}
      />

      {/* Modal container */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          className={`
            relative bg-bg-card rounded-2xl shadow-theme-xl
            ${sizeClasses[size]} w-full
            transform transition-all duration-300 ease-out
            animate-in fade-in zoom-in-95
          `.replace(/\s+/g, ' ').trim()}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-border-light">
            <h3 className="text-xl font-bold text-text-primary">{title}</h3>
            {showCloseButton && (
              <button
                onClick={onClose}
                className="
                  p-2 rounded-xl text-text-muted
                  hover:text-text-secondary hover:bg-bg-muted
                  transition-all duration-200
                  focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-bg-card
                "
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            )}
          </div>

          {/* Body */}
          <div className="px-6 py-5 max-h-[60vh] overflow-y-auto">{children}</div>

          {/* Footer */}
          {footer && (
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border-light bg-bg-muted/50 rounded-b-2xl">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
