import { useState, useEffect, useRef, useCallback } from 'react';

interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

interface UseInfiniteScrollOptions {
  limit?: number;
  rootMargin?: string;
}

interface UseInfiniteScrollResult<T> {
  items: T[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  error: string | null;
  loadMore: () => void;
  refresh: () => void;
  sentinelRef: React.RefObject<HTMLDivElement | null>;
  total: number;
}

/**
 * Hook for infinite scroll pagination.
 * Uses IntersectionObserver to detect when sentinel element is visible.
 *
 * @param apiFunction - Function that fetches paginated data
 * @param options - Configuration options
 * @returns Infinite scroll state and controls
 *
 * @example
 * ```tsx
 * const { items, isLoading, hasMore, sentinelRef } = useInfiniteScroll(
 *   (page, limit) => dataSourceService.getAll(page, limit)
 * );
 *
 * return (
 *   <div>
 *     {items.map(item => <Item key={item.id} {...item} />)}
 *     <div ref={sentinelRef} />
 *   </div>
 * );
 * ```
 */
export function useInfiniteScroll<T>(
  apiFunction: (page: number, limit: number) => Promise<PaginatedResponse<T>>,
  options: UseInfiniteScrollOptions = {}
): UseInfiniteScrollResult<T> {
  const { limit = 20, rootMargin = '100px' } = options;

  const [items, setItems] = useState<T[]>([]);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);

  const sentinelRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const isLoadingRef = useRef(false);

  // Fetch data for a specific page
  const fetchPage = useCallback(async (pageNum: number, append: boolean) => {
    if (isLoadingRef.current) return;

    isLoadingRef.current = true;

    if (append) {
      setIsLoadingMore(true);
    } else {
      setIsLoading(true);
    }
    setError(null);

    try {
      const response = await apiFunction(pageNum, limit);

      if (append) {
        setItems(prev => [...prev, ...response.items]);
      } else {
        setItems(response.items);
      }

      setTotal(response.total);
      setHasMore(response.hasMore);
      setPage(pageNum);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
      isLoadingRef.current = false;
    }
  }, [apiFunction, limit]);

  // Load more items
  const loadMore = useCallback(() => {
    if (!isLoadingRef.current && hasMore) {
      fetchPage(page + 1, true);
    }
  }, [fetchPage, page, hasMore]);

  // Refresh from the beginning
  const refresh = useCallback(() => {
    setItems([]);
    setPage(1);
    setHasMore(true);
    fetchPage(1, false);
  }, [fetchPage]);

  // Initial load
  useEffect(() => {
    fetchPage(1, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Only fetch on mount
  }, []);

  // Setup IntersectionObserver
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    // Disconnect previous observer
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    // Create new observer
    observerRef.current = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && hasMore && !isLoadingRef.current) {
          loadMore();
        }
      },
      { rootMargin }
    );

    observerRef.current.observe(sentinel);

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [hasMore, loadMore, rootMargin]);

  return {
    items,
    isLoading,
    isLoadingMore,
    hasMore,
    error,
    loadMore,
    refresh,
    sentinelRef,
    total,
  };
}
