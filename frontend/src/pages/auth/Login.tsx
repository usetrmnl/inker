import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/common';

/**
 * Login page component - simplified for PIN-based auth
 * Uses CSS variables for easy theme customization
 */
export function Login() {
  const [pin, setPin] = useState('');
  const { login, isLoading, error } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    const result = await login(pin);
    if (result.success) {
      navigate('/dashboard');
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-sidebar-bg relative overflow-hidden">
        {/* Content */}
        <div className="relative z-10 flex flex-col justify-center px-12 xl:px-20">
          <div className="mb-8">
            <div className="inline-flex items-center gap-3 px-4 py-2 bg-white/10 rounded-full backdrop-blur-sm mb-8">
              <div className="w-2 h-2 rounded-full bg-status-success-dot animate-pulse" />
              <span className="text-white/90 text-sm font-medium">E-ink Device Management</span>
            </div>
            <h1 className="text-5xl xl:text-6xl font-bold text-white mb-6 leading-tight">
              Welcome to<br />
              <span className="text-accent">
                Inker
              </span>
            </h1>
            <p className="text-xl text-white/70 max-w-md leading-relaxed">
              Manage your TRMNL e-ink devices, screens, and playlists from a single, powerful dashboard.
            </p>
          </div>

          {/* Feature List */}
          <div className="space-y-4">
            <div className="flex items-center gap-4 text-white/90">
              <div className="p-2 bg-white/10 rounded-lg backdrop-blur-sm">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </div>
              <span>Centralized device management</span>
            </div>
            <div className="flex items-center gap-4 text-white/90">
              <div className="p-2 bg-white/10 rounded-lg backdrop-blur-sm">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <span>Custom screen designer</span>
            </div>
            <div className="flex items-center gap-4 text-white/90">
              <div className="p-2 bg-white/10 rounded-lg backdrop-blur-sm">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <span>Automated playlists and scheduling</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 lg:px-8 bg-bg-page">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden mb-10 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-sidebar-bg rounded-2xl shadow-theme-xl mb-4">
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                <defs>
                  <linearGradient id="dropGradientLogin" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#ffffff"/>
                    <stop offset="100%" stopColor="#e0e0e0"/>
                  </linearGradient>
                </defs>
                <path d="M20 4 C20 4 10 14 10 23 C10 29 14.5 34 20 34 C25.5 34 30 29 30 23 C30 14 20 4 20 4Z" fill="url(#dropGradientLogin)"/>
                <g opacity="0.15">
                  <rect x="16" y="26" width="3" height="3" rx="0.5" fill="#1a1a1a"/>
                  <rect x="21" y="26" width="3" height="3" rx="0.5" fill="#1a1a1a"/>
                  <rect x="18.5" y="29.5" width="3" height="3" rx="0.5" fill="#1a1a1a"/>
                </g>
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-text-primary">Inker</h1>
          </div>

          {/* Form Header */}
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-text-primary mb-2">
              Welcome back
            </h2>
            <p className="text-text-muted">
              Enter your PIN to access the dashboard
            </p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="pin" className="block text-sm font-medium text-text-secondary mb-1.5">
                PIN
              </label>
              <input
                id="pin"
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                required
                autoComplete="current-password"
                placeholder="Enter your PIN"
                className="w-full px-4 py-3 rounded-xl border-2 border-border-light bg-bg-input text-text-primary placeholder-text-placeholder focus:border-accent focus:ring-4 focus:ring-accent/10 transition-all outline-none text-center text-lg tracking-widest"
              />
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-4 rounded-xl bg-status-error-bg border border-status-error-border">
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0 p-1.5 bg-status-error-border/30 rounded-lg">
                    <svg className="h-5 w-5 text-status-error-text" viewBox="0 0 20 20" fill="currentColor">
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-status-error-text">{error}</p>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <Button
              type="submit"
              fullWidth
              isLoading={isLoading}
              disabled={isLoading}
              className="py-3"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Signing in...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  Sign in
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </span>
              )}
            </Button>
          </form>

        </div>
      </div>
    </div>
  );
}
