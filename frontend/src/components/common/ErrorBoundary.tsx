import { Component } from 'react';
import type { ReactNode } from 'react';
import { Button } from './Button';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: { componentStack: string } | null;
}

/**
 * ErrorBoundary component to catch JavaScript errors anywhere in the component tree
 *
 * Error boundaries are special React components that catch errors during rendering,
 * in lifecycle methods, and in constructors of the whole tree below them.
 * They must be class components as there is no hook equivalent for error boundaries.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: { componentStack: string }) {
    // Log error details for debugging
    console.error('ErrorBoundary caught an error:', error, errorInfo);

    this.setState({
      error,
      errorInfo,
    });

    // You can also log the error to an error reporting service here
    // Example: logErrorToService(error, errorInfo);
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI provided by parent
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI
      return (
        <div className="min-h-screen flex items-center justify-center bg-bg-page py-12 px-4 sm:px-6 lg:px-8">
          <div className="max-w-md w-full space-y-8">
            <div className="text-center">
              <svg
                className="w-20 h-20 text-status-error-text mx-auto mb-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <h1 className="text-3xl font-bold text-text-primary mb-2">
                Oops! Something went wrong
              </h1>
              <p className="text-text-secondary mb-6">
                We encountered an unexpected error. Please try refreshing the page.
              </p>

              {this.state.error && (
                <div className="bg-status-error-bg border border-status-error-border rounded-lg p-4 mb-6 text-left">
                  <p className="font-semibold text-status-error-text mb-2">Error Details:</p>
                  <p className="text-sm text-status-error-text font-mono break-words">
                    {this.state.error.toString()}
                  </p>
                  {import.meta.env.DEV && this.state.errorInfo && (
                    <details className="mt-4">
                      <summary className="cursor-pointer text-sm text-status-error-text hover:opacity-80">
                        Stack Trace
                      </summary>
                      <pre className="mt-2 text-xs text-status-error-text overflow-auto max-h-48">
                        {this.state.errorInfo.componentStack}
                      </pre>
                    </details>
                  )}
                </div>
              )}

              <div className="flex gap-4 justify-center">
                <Button onClick={this.handleReset} variant="secondary">
                  Try Again
                </Button>
                <Button onClick={() => window.location.reload()} variant="primary">
                  Refresh Page
                </Button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
