import type { Notification } from '../../types';
import { useNotification } from '../../contexts/NotificationContext';

interface ToastProps {
  notification: Notification;
}

/**
 * Individual toast notification component with monochrome theme
 * Uses CSS variables for easy theme customization
 */
function ToastItem({ notification }: ToastProps) {
  const { removeNotification } = useNotification();

  const typeConfig = {
    success: {
      bg: 'bg-status-success-bg',
      border: 'border-status-success-border',
      text: 'text-status-success-text',
      iconBg: 'bg-status-success-text',
      icon: (
        <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      ),
    },
    error: {
      bg: 'bg-status-error-bg',
      border: 'border-status-error-border',
      text: 'text-status-error-text',
      iconBg: 'bg-status-error-text',
      icon: (
        <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      ),
    },
    warning: {
      bg: 'bg-status-warning-bg',
      border: 'border-status-warning-border',
      text: 'text-status-warning-text',
      iconBg: 'bg-status-warning-text',
      icon: (
        <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      ),
    },
    info: {
      bg: 'bg-status-info-bg',
      border: 'border-status-info-border',
      text: 'text-status-info-text',
      iconBg: 'bg-status-info-text',
      icon: (
        <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
  };

  const config = typeConfig[notification.type];

  return (
    <div
      className={`
        flex items-start gap-4 p-4 rounded-2xl border shadow-theme-lg backdrop-blur-sm
        ${config.bg} ${config.border}
        animate-in slide-in-from-right-full fade-in duration-300
        hover:shadow-theme-xl transition-shadow
      `.replace(/\s+/g, ' ').trim()}
    >
      {/* Icon container */}
      <div className={`flex-shrink-0 h-8 w-8 rounded-xl ${config.iconBg} flex items-center justify-center shadow-theme-sm`}>
        {config.icon}
      </div>

      {/* Message */}
      <div className="flex-1 min-w-0 pt-0.5">
        <p className={`text-sm font-semibold ${config.text}`}>
          {notification.type.charAt(0).toUpperCase() + notification.type.slice(1)}
        </p>
        <p className={`mt-1 text-sm ${config.text} opacity-80`}>
          {notification.message}
        </p>
      </div>

      {/* Close button */}
      <button
        onClick={() => removeNotification(notification.id)}
        className={`
          flex-shrink-0 p-1.5 rounded-lg
          ${config.text} opacity-60 hover:opacity-100
          hover:bg-bg-card/50 transition-all duration-200
          focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-current
        `.replace(/\s+/g, ' ').trim()}
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

/**
 * Toast container that displays all notifications
 */
export function ToastContainer() {
  const { notifications } = useNotification();

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-3 max-w-sm w-full pointer-events-none">
      {notifications.map((notification) => (
        <div key={notification.id} className="pointer-events-auto">
          <ToastItem notification={notification} />
        </div>
      ))}
    </div>
  );
}
