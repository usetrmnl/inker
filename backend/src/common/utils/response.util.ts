/**
 * Response wrapper utility for consistent API responses across all endpoints
 *
 * This ensures that list endpoints return data in the format:
 * {
 *   data: {
 *     items: [...],
 *     total: number
 *   }
 * }
 */

export interface ListResponse<T> {
  data: {
    items: T[];
    total: number;
  };
}

export interface PaginatedResponse<T> {
  data: {
    items: T[];
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
  };
}

export interface SingleResponse<T> {
  data: T;
}

export interface MessageResponse {
  message: string;
}

/**
 * Wraps an array of items into a consistent list response format
 * @param items - Array of items to return
 * @returns Standardized list response with items and total count
 */
export function wrapListResponse<T>(items: T[]): ListResponse<T> {
  return {
    data: {
      items,
      total: items.length,
    },
  };
}

/**
 * Wraps an array of items into a paginated response format
 * @param items - Array of items for the current page
 * @param total - Total count of all items (not just this page)
 * @param page - Current page number (1-indexed)
 * @param limit - Number of items per page
 * @returns Standardized paginated response
 */
export function wrapPaginatedResponse<T>(
  items: T[],
  total: number,
  page: number,
  limit: number,
): PaginatedResponse<T> {
  return {
    data: {
      items,
      total,
      page,
      limit,
      hasMore: page * limit < total,
    },
  };
}

/**
 * Wraps a single item into a consistent response format
 * @param item - Single item to return
 * @returns Standardized single item response
 */
export function wrapSingleResponse<T>(item: T): SingleResponse<T> {
  return {
    data: item,
  };
}

/**
 * Creates a message response
 * @param message - Message to return
 * @returns Standardized message response
 */
export function wrapMessageResponse(message: string): MessageResponse {
  return {
    message,
  };
}
