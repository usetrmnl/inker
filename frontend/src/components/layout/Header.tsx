import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../common';

/**
 * Header component with user menu
 * Uses CSS variable-based theming for easy customization
 */
export function Header() {
  const { logout, isAuthenticated } = useAuth();

  const handleLogout = () => {
    logout();
  };

  // Get current date for display
  const currentDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <header className="sticky top-0 z-30 bg-bg-card/80 backdrop-blur-xl border-b border-border-light shadow-theme-sm">
      <div className="px-8 py-4">
        <div className="flex justify-between items-center">
          {/* Left side - Page context / Breadcrumb area */}
          <div className="flex flex-col">
            <span className="text-sm text-text-muted font-medium">
              {currentDate}
            </span>
            <h1 className="text-xl font-semibold text-text-primary">
              Welcome back
            </h1>
          </div>

          {/* Right side - User actions */}
          {isAuthenticated && (
            <div className="flex items-center gap-4">
              {/* User profile section */}
              <div className="flex items-center gap-3">
                {/* User avatar */}
                <div className="relative">
                  <div className="h-10 w-10 rounded-xl bg-accent flex items-center justify-center shadow-theme-md">
                    <span className="text-text-inverse font-semibold text-sm">
                      AD
                    </span>
                  </div>
                  {/* Online indicator */}
                  <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-status-success-dot rounded-full ring-2 ring-bg-card" />
                </div>

                {/* User info */}
                <div className="hidden md:block">
                  <p className="text-sm font-semibold text-text-primary">
                    Administrator
                  </p>
                  <div className="flex items-center gap-1.5">
                    <span className="px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-accent-light text-accent-text rounded-md">
                      Admin
                    </span>
                  </div>
                </div>

                {/* Logout button */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLogout}
                  className="ml-2"
                >
                  <svg
                    className="w-4 h-4 mr-1.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9"
                    />
                  </svg>
                  Logout
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
