import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface Response<T> {
  data: T;
}

/**
 * Transform interceptor that wraps successful responses in a standard format
 */
@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, Response<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<Response<T>> {
    const request = context.switchToHttp().getRequest();
    const path = request?.url || '';

    // Device API endpoints (/api/setup, /api/display, /api/log) return raw responses
    // to match Ruby Inker API format (no {data: ...} wrapper)
    const isDeviceApi = path.startsWith('/api/setup') ||
                        path.startsWith('/api/display') ||
                        path.startsWith('/api/log');

    return next.handle().pipe(
      map((data) => {
        // Return raw response for device API endpoints
        if (isDeviceApi) {
          return data;
        }

        // Don't transform if already wrapped with ONLY 'data' as the key
        // This prevents skipping wrap when response happens to contain a 'data' field
        // among other fields (like testUrl returning { success, data, fields })
        if (
          data &&
          typeof data === 'object' &&
          'data' in data &&
          Object.keys(data).length === 1
        ) {
          return data;
        }
        return { data };
      }),
    );
  }
}