import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { NotificationProvider, useNotification, useNotificationState } from './NotificationContext';

const wrapper = ({ children }: { children: ReactNode }) => (
  <NotificationProvider>{children}</NotificationProvider>
);

describe('NotificationContext', () => {
  it('should start with empty notifications', () => {
    const { result } = renderHook(() => useNotificationState(), { wrapper });
    expect(result.current).toEqual([]);
  });

  it('should add a notification', () => {
    const { result } = renderHook(() => useNotification(), { wrapper });

    act(() => {
      result.current.success('Test message', 0); // duration 0 = no auto-remove
    });

    expect(result.current.notifications).toHaveLength(1);
    expect(result.current.notifications[0].type).toBe('success');
    expect(result.current.notifications[0].message).toBe('Test message');
  });

  it('should remove a notification', () => {
    const { result } = renderHook(() => useNotification(), { wrapper });

    let id: string;
    act(() => {
      id = result.current.error('Error msg', 0);
    });

    expect(result.current.notifications).toHaveLength(1);

    act(() => {
      result.current.removeNotification(id!);
    });

    expect(result.current.notifications).toHaveLength(0);
  });

  it('should support all notification types', () => {
    const { result } = renderHook(() => useNotification(), { wrapper });

    act(() => {
      result.current.success('s', 0);
      result.current.error('e', 0);
      result.current.warning('w', 0);
      result.current.info('i', 0);
    });

    const types = result.current.notifications.map(n => n.type);
    expect(types).toEqual(['success', 'error', 'warning', 'info']);
  });

  it('should auto-remove notification after duration', async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useNotification(), { wrapper });

    act(() => {
      result.current.success('Auto remove', 1000);
    });

    expect(result.current.notifications).toHaveLength(1);

    act(() => {
      vi.advanceTimersByTime(1100);
    });

    expect(result.current.notifications).toHaveLength(0);
    vi.useRealTimers();
  });
});
