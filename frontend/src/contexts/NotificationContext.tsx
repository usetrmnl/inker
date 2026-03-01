/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useReducer, type ReactNode, useCallback } from 'react';
import type { Notification, NotificationType } from '../types';

// Per scaling-up-with-reducer-and-context.md, create separate contexts for state and dispatch
const NotificationStateContext = createContext<Notification[]>([]);
const NotificationDispatchContext = createContext<React.Dispatch<NotificationAction> | null>(null);

type NotificationAction =
  | { type: 'ADD_NOTIFICATION'; payload: Notification }
  | { type: 'REMOVE_NOTIFICATION'; payload: string };

// Notification reducer
function notificationReducer(state: Notification[], action: NotificationAction): Notification[] {
  switch (action.type) {
    case 'ADD_NOTIFICATION':
      return [...state, action.payload];

    case 'REMOVE_NOTIFICATION':
      return state.filter(notification => notification.id !== action.payload);

    default:
      throw new Error('Unknown action: ' + (action as NotificationAction).type);
  }
}

// NotificationProvider component
export function NotificationProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(notificationReducer, []);

  return (
    <NotificationStateContext.Provider value={state}>
      <NotificationDispatchContext.Provider value={dispatch}>
        {children}
      </NotificationDispatchContext.Provider>
    </NotificationStateContext.Provider>
  );
}

// Custom hooks
export function useNotificationState() {
  return useContext(NotificationStateContext);
}

export function useNotificationDispatch() {
  const context = useContext(NotificationDispatchContext);
  if (context === null) {
    throw new Error('useNotificationDispatch must be used within NotificationProvider');
  }
  return context;
}

// High-level custom hook for notifications
// Per reusing-logic-with-custom-hooks.md, this provides a clean API for components
export function useNotification() {
  const notifications = useNotificationState();
  const dispatch = useNotificationDispatch();

  const showNotification = useCallback((
    type: NotificationType,
    message: string,
    duration: number = 5000
  ) => {
    const id = `notification-${Date.now()}-${Math.random()}`;
    const notification: Notification = { id, type, message, duration };

    dispatch({ type: 'ADD_NOTIFICATION', payload: notification });

    // Auto-remove after duration
    if (duration > 0) {
      setTimeout(() => {
        dispatch({ type: 'REMOVE_NOTIFICATION', payload: id });
      }, duration);
    }

    return id;
  }, [dispatch]);

  const removeNotification = useCallback((id: string) => {
    dispatch({ type: 'REMOVE_NOTIFICATION', payload: id });
  }, [dispatch]);

  const success = useCallback((message: string, duration?: number) => {
    return showNotification('success', message, duration);
  }, [showNotification]);

  const error = useCallback((message: string, duration?: number) => {
    return showNotification('error', message, duration);
  }, [showNotification]);

  const warning = useCallback((message: string, duration?: number) => {
    return showNotification('warning', message, duration);
  }, [showNotification]);

  const info = useCallback((message: string, duration?: number) => {
    return showNotification('info', message, duration);
  }, [showNotification]);

  return {
    notifications,
    showNotification,
    removeNotification,
    success,
    error,
    warning,
    info,
  };
}
