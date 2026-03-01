import { MainLayout } from '../../components/layout';
import { Card, LoadingSpinner } from '../../components/common';
import { useApi } from '../../hooks/useApi';
import type { Model } from '../../types';

export function ModelsList() {
  const { isLoading } = useApi<Model[]>(
    async () => {
      // Placeholder - will connect to API when endpoint is available
      return [];
    },
    { showErrorNotification: false }
  );

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-text-primary">Device Models</h1>
            <p className="mt-2 text-sm text-text-secondary">
              Manage device model configurations
            </p>
          </div>
        </div>

        <Card>
          {isLoading ? (
            <div className="flex justify-center py-12">
              <LoadingSpinner size="lg" />
            </div>
          ) : (
            <div className="text-center py-12">
              <svg
                className="mx-auto h-12 w-12 text-text-placeholder"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
                />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-text-primary">
                Models Management
              </h3>
              <p className="mt-1 text-sm text-text-muted">
                Device models management will be available when the backend endpoint is implemented.
              </p>
            </div>
          )}
        </Card>
      </div>
    </MainLayout>
  );
}
