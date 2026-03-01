import type { ReactNode } from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';

interface MainLayoutProps {
  children: ReactNode;
}

/**
 * Main layout component with header, sidebar, and content area
 * Uses CSS variable-based theming for easy customization
 * Note: ToastContainer is now global in App.tsx
 */
export function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="min-h-screen bg-bg-page">
      {/* Sidebar - Fixed position on the left */}
      <Sidebar />

      {/* Main content area with left margin for sidebar */}
      <div className="ml-72">
        <Header />
        <main className="p-8">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
