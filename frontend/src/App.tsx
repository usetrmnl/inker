import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { ErrorBoundary, ToastContainer } from './components/common';

// Auth pages
import { Login } from './pages/auth/Login';

// Main pages
import { Dashboard } from './pages/Dashboard';
import { DevicesList } from './pages/devices/DevicesList';
import { DeviceDetail } from './pages/devices/DeviceDetail';
import { DeviceForm } from './pages/devices/DeviceForm';
import { ScreensList } from './pages/screens/ScreensList';
import { ScreenDetail } from './pages/screens/ScreenDetail';
import { ScreenForm } from './pages/screens/ScreenForm';
import { ScreenDesigner } from './pages/screens/ScreenDesigner';
import { PlaylistsList } from './pages/playlists/PlaylistsList';
import { PlaylistDetail } from './pages/playlists/PlaylistDetail';
import { PlaylistForm } from './pages/playlists/PlaylistForm';
import { Settings } from './pages/settings/Settings';
import { ModelsList } from './pages/models/ModelsList';
import { DataSourceForm } from './pages/data-sources';
import { CustomWidgetForm, CustomWidgetPreview } from './pages/custom-widgets';
import { Extensions } from './pages/extensions';

/**
 * Main App component with routing
 * Per scaling-up-with-reducer-and-context.md, we wrap the app with context providers
 * ErrorBoundary catches any runtime errors and displays a fallback UI
 */
function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <NotificationProvider>
          <Router>
            <Routes>
            {/* Public routes */}
            <Route path="/login" element={<Login />} />

            {/* Protected routes */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />

            {/* Devices */}
            <Route
              path="/devices"
              element={
                <ProtectedRoute>
                  <DevicesList />
                </ProtectedRoute>
              }
            />
            <Route
              path="/devices/:id"
              element={
                <ProtectedRoute>
                  <DeviceDetail />
                </ProtectedRoute>
              }
            />
            <Route
              path="/devices/:id/edit"
              element={
                <ProtectedRoute>
                  <DeviceForm />
                </ProtectedRoute>
              }
            />

            {/* Screens */}
            <Route
              path="/screens"
              element={
                <ProtectedRoute>
                  <ScreensList />
                </ProtectedRoute>
              }
            />
            <Route
              path="/screens/new"
              element={
                <ProtectedRoute>
                  <ScreenForm />
                </ProtectedRoute>
              }
            />
            <Route
              path="/screens/designer"
              element={
                <ProtectedRoute>
                  <ScreenDesigner />
                </ProtectedRoute>
              }
            />
            <Route
              path="/screens/designer/:id"
              element={
                <ProtectedRoute>
                  <ScreenDesigner />
                </ProtectedRoute>
              }
            />
            <Route
              path="/screens/:id"
              element={
                <ProtectedRoute>
                  <ScreenDetail />
                </ProtectedRoute>
              }
            />
            <Route
              path="/screens/:id/edit"
              element={
                <ProtectedRoute>
                  <ScreenForm />
                </ProtectedRoute>
              }
            />

            {/* Playlists */}
            <Route
              path="/playlists"
              element={
                <ProtectedRoute>
                  <PlaylistsList />
                </ProtectedRoute>
              }
            />
            <Route
              path="/playlists/new"
              element={
                <ProtectedRoute>
                  <PlaylistForm />
                </ProtectedRoute>
              }
            />
            <Route
              path="/playlists/:id"
              element={
                <ProtectedRoute>
                  <PlaylistDetail />
                </ProtectedRoute>
              }
            />
            <Route
              path="/playlists/:id/edit"
              element={
                <ProtectedRoute>
                  <PlaylistForm />
                </ProtectedRoute>
              }
            />

            {/* Settings */}
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <Settings />
                </ProtectedRoute>
              }
            />

            {/* Models */}
            <Route
              path="/models"
              element={
                <ProtectedRoute>
                  <ModelsList />
                </ProtectedRoute>
              }
            />

            {/* Extensions - combines Data Sources and Custom Widgets */}
            <Route
              path="/extensions"
              element={
                <ProtectedRoute>
                  <Extensions />
                </ProtectedRoute>
              }
            />

            {/* Data Sources - redirect list to extensions, keep forms */}
            <Route
              path="/data-sources"
              element={<Navigate to="/extensions" replace />}
            />
            <Route
              path="/data-sources/new"
              element={
                <ProtectedRoute>
                  <DataSourceForm />
                </ProtectedRoute>
              }
            />
            <Route
              path="/data-sources/:id/edit"
              element={
                <ProtectedRoute>
                  <DataSourceForm />
                </ProtectedRoute>
              }
            />

            {/* Custom Widgets - redirect list to extensions, keep forms */}
            <Route
              path="/custom-widgets"
              element={<Navigate to="/extensions" replace />}
            />
            <Route
              path="/custom-widgets/new"
              element={
                <ProtectedRoute>
                  <CustomWidgetForm />
                </ProtectedRoute>
              }
            />
            <Route
              path="/custom-widgets/:id/edit"
              element={
                <ProtectedRoute>
                  <CustomWidgetForm />
                </ProtectedRoute>
              }
            />
            <Route
              path="/custom-widgets/:id/preview"
              element={
                <ProtectedRoute>
                  <CustomWidgetPreview />
                </ProtectedRoute>
              }
            />

            {/* Redirect root to dashboard */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />

            {/* 404 */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
          <ToastContainer />
        </Router>
      </NotificationProvider>
    </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
