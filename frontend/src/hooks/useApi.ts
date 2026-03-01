import { useState, useEffect, useCallback } from 'react';
import { useNotification } from '../contexts/NotificationContext';

interface UseApiOptions<T> {
  onSuccess?: (data: T) => void;
  onError?: (error: string) => void;
  showErrorNotification?: boolean;
  showSuccessNotification?: boolean;
  successMessage?: string;
}

interface UseApiResult<T> {
  data: T | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Custom hook for data fetching with loading and error states.
 * Uses useRef to avoid recreating the fetch function when callbacks change,
 * preventing infinite loops.
 */
export function useApi<T>(
  apiFunction: () => Promise<T>,
  options: UseApiOptions<T> = {}
): UseApiResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const { error: showError, success: showSuccess } = useNotification();

  const {
    onSuccess,
    onError,
    showErrorNotification = true,
    showSuccessNotification = false,
    successMessage = 'Operation completed successfully',
  } = options;

  // Store the latest callback refs to avoid adding them to dependencies
  // Per escape-hatches.md, refs don't trigger re-renders
  const onSuccessRef = useCallback((result: T) => {
    if (onSuccess) {
      onSuccess(result);
    }
  }, [onSuccess]);

  const onErrorRef = useCallback((errorMessage: string) => {
    if (onError) {
      onError(errorMessage);
    }
  }, [onError]);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await apiFunction();
      setData(result);
      setError(null);

      onSuccessRef(result);

      if (showSuccessNotification) {
        showSuccess(successMessage);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);
      setData(null);

      onErrorRef(errorMessage);

      if (showErrorNotification) {
        showError(errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  }, [
    apiFunction,
    onSuccessRef,
    onErrorRef,
    showErrorNotification,
    showSuccessNotification,
    successMessage,
    showError,
    showSuccess,
  ]);

  // Fetch data on mount only
  // Per synchronizing-with-effects.md, empty dependency array means effect runs once on mount
  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount, not when fetchData changes

  return {
    data,
    isLoading,
    error,
    refetch: fetchData,
  };
}

/**
 * Custom hook for mutation operations (create, update, delete)
 */
interface UseMutationOptions<T> {
  onSuccess?: (data: T) => void;
  onError?: (error: string) => void;
  showErrorNotification?: boolean;
  showSuccessNotification?: boolean;
  successMessage?: string;
}

interface UseMutationResult<T, V> {
  mutate: (variables: V) => Promise<T | null>;
  data: T | null;
  isLoading: boolean;
  error: string | null;
  reset: () => void;
}

export function useMutation<T, V = void>(
  mutationFunction: (variables: V) => Promise<T>,
  options: UseMutationOptions<T> = {}
): UseMutationResult<T, V> {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const { error: showError, success: showSuccess } = useNotification();

  const {
    onSuccess,
    onError,
    showErrorNotification = true,
    showSuccessNotification = true,
    successMessage = 'Operation completed successfully',
  } = options;

  const mutate = useCallback(
    async (variables: V): Promise<T | null> => {
      setIsLoading(true);
      setError(null);

      try {
        const result = await mutationFunction(variables);
        setData(result);
        setError(null);

        if (onSuccess) {
          onSuccess(result);
        }

        if (showSuccessNotification) {
          showSuccess(successMessage);
        }

        return result;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'An error occurred';
        setError(errorMessage);
        setData(null);

        if (onError) {
          onError(errorMessage);
        }

        if (showErrorNotification) {
          showError(errorMessage);
        }

        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [
      mutationFunction,
      onSuccess,
      onError,
      showErrorNotification,
      showSuccessNotification,
      successMessage,
      showError,
      showSuccess,
    ]
  );

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setIsLoading(false);
  }, []);

  return {
    mutate,
    data,
    isLoading,
    error,
    reset,
  };
}

/**
 * Custom hook for paginated data fetching
 */
interface UsePaginatedApiOptions<T> {
  initialPage?: number;
  initialLimit?: number;
  onSuccess?: (data: T) => void;
  onError?: (error: string) => void;
}

interface UsePaginatedApiResult<T> {
  data: T | null;
  isLoading: boolean;
  error: string | null;
  page: number;
  limit: number;
  setPage: (page: number) => void;
  setLimit: (limit: number) => void;
  refetch: () => Promise<void>;
}

export function usePaginatedApi<T>(
  apiFunction: (page: number, limit: number) => Promise<T>,
  options: UsePaginatedApiOptions<T> = {}
): UsePaginatedApiResult<T> {
  const { initialPage = 1, initialLimit = 20, onSuccess, onError } = options;

  const [page, setPage] = useState<number>(initialPage);
  const [limit, setLimit] = useState<number>(initialLimit);
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const { error: showError } = useNotification();

  // Stabilize callbacks to prevent infinite loops
  const onSuccessRef = useCallback((result: T) => {
    if (onSuccess) {
      onSuccess(result);
    }
  }, [onSuccess]);

  const onErrorRef = useCallback((errorMessage: string) => {
    if (onError) {
      onError(errorMessage);
    }
  }, [onError]);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await apiFunction(page, limit);
      setData(result);
      setError(null);

      onSuccessRef(result);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);
      setData(null);

      onErrorRef(errorMessage);

      showError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [apiFunction, page, limit, onSuccessRef, onErrorRef, showError]);

  // Re-fetch when page or limit changes
  // Per lifecycle-of-reactive-effects.md, effects re-run when dependencies change
  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit]); // Only re-fetch when page/limit changes, not when fetchData changes

  return {
    data,
    isLoading,
    error,
    page,
    limit,
    setPage,
    setLimit,
    refetch: fetchData,
  };
}
