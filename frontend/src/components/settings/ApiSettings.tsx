import { useState, useEffect } from 'react';
import { Card, Input, Button } from '../common';
import { settingsService } from '../../services/api';
import { useNotification } from '../../contexts/NotificationContext';
import type { GitHubTokenTestResult } from '../../types';

/**
 * ApiSettings component for managing external API tokens
 * Currently supports GitHub token for the GitHub Stars widget
 */
export function ApiSettings() {
  const { showNotification } = useNotification();
  const [githubToken, setGithubToken] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [hasToken, setHasToken] = useState(false);
  const [testResult, setTestResult] = useState<GitHubTokenTestResult | null>(null);

  // Load current settings
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const settings = await settingsService.getAll();
        // If token exists, it's returned as masked value
        if (settings.github_token && settings.github_token !== null) {
          setHasToken(true);
          setGithubToken(''); // Don't show masked value in input
        }
      } catch (error) {
        console.error('Failed to load settings:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadSettings();
  }, []);

  const handleTestToken = async () => {
    if (!githubToken.trim()) {
      showNotification('error', 'Please enter a GitHub token to test');
      return;
    }

    setIsTesting(true);
    setTestResult(null);
    try {
      const result = await settingsService.testGitHubToken(githubToken.trim());
      setTestResult(result);
      if (result.valid) {
        showNotification('success', result.message);
      } else {
        showNotification('error', result.message);
      }
    } catch (error) {
      showNotification('error', 'Failed to test token');
      console.error('Failed to test token:', error);
    } finally {
      setIsTesting(false);
    }
  };

  const handleSaveToken = async () => {
    if (!githubToken.trim()) {
      showNotification('error', 'Please enter a GitHub token');
      return;
    }

    // If not tested yet, test first
    if (!testResult || !testResult.valid) {
      showNotification('error', 'Please test the token first to verify it works');
      return;
    }

    setIsSaving(true);
    try {
      await settingsService.update('github_token', githubToken.trim());
      setHasToken(true);
      setGithubToken(''); // Clear input after saving
      setTestResult(null);
      showNotification('success', 'GitHub token saved successfully');
    } catch (error) {
      showNotification('error', 'Failed to save GitHub token');
      console.error('Failed to save token:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteToken = async () => {
    setIsSaving(true);
    try {
      await settingsService.delete('github_token');
      setHasToken(false);
      setGithubToken('');
      setTestResult(null);
      showNotification('success', 'GitHub token removed');
    } catch (error) {
      showNotification('error', 'Failed to remove GitHub token');
      console.error('Failed to delete token:', error);
    } finally {
      setIsSaving(false);
    }
  };

  // Clear test result when token changes
  const handleTokenChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setGithubToken(e.target.value);
    setTestResult(null);
  };

  if (isLoading) {
    return (
      <Card>
        <div className="animate-pulse">
          <div className="h-6 bg-bg-muted rounded w-1/4 mb-4" />
          <div className="h-10 bg-bg-muted rounded w-full" />
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <h2 className="text-lg font-semibold text-text-primary mb-4">
        GitHub API Token
      </h2>

      <div className="space-y-4">
        <div className="text-sm text-text-secondary">
          <p className="mb-2">
            Add a GitHub Personal Access Token to increase API rate limits for the GitHub Stars widget.
          </p>
          <ul className="list-disc ml-5 space-y-1 text-text-muted">
            <li>Without token: 60 requests/hour (shared across all widgets)</li>
            <li>With token: 5,000 requests/hour</li>
          </ul>
        </div>

        {hasToken ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-status-success-bg border border-status-success-border rounded-lg">
              <svg className="w-5 h-5 text-status-success-text" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm text-status-success-text font-medium">
                GitHub token is configured
              </span>
            </div>

            <div className="flex gap-3">
              <Input
                type="password"
                value={githubToken}
                onChange={handleTokenChange}
                placeholder="Enter new token to replace..."
                className="flex-1"
              />
              <Button
                variant="secondary"
                onClick={handleTestToken}
                disabled={isTesting || !githubToken.trim()}
              >
                {isTesting ? 'Testing...' : 'Test'}
              </Button>
              <Button
                variant="primary"
                onClick={handleSaveToken}
                disabled={isSaving || !githubToken.trim() || !testResult?.valid}
              >
                {isSaving ? 'Saving...' : 'Update'}
              </Button>
              <Button
                variant="danger"
                onClick={handleDeleteToken}
                disabled={isSaving}
              >
                Remove
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-status-warning-bg border border-status-warning-border rounded-lg">
              <svg className="w-5 h-5 text-status-warning-text" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span className="text-sm text-status-warning-text font-medium">
                No GitHub token configured - using limited rate (60 req/hr)
              </span>
            </div>

            <div className="flex gap-3">
              <Input
                type="password"
                value={githubToken}
                onChange={handleTokenChange}
                placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                className="flex-1"
              />
              <Button
                variant="secondary"
                onClick={handleTestToken}
                disabled={isTesting || !githubToken.trim()}
              >
                {isTesting ? 'Testing...' : 'Test'}
              </Button>
              <Button
                variant="primary"
                onClick={handleSaveToken}
                disabled={isSaving || !githubToken.trim() || !testResult?.valid}
              >
                {isSaving ? 'Saving...' : 'Save Token'}
              </Button>
            </div>
          </div>
        )}

        {/* Test Result Display */}
        {testResult && (
          <div
            className={`p-4 rounded-lg border ${
              testResult.valid
                ? 'bg-status-success-bg border-status-success-border'
                : 'bg-status-error-bg border-status-error-border'
            }`}
          >
            <div className="flex items-start gap-3">
              {testResult.valid ? (
                <svg className="w-5 h-5 text-status-success-text flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ) : (
                <svg className="w-5 h-5 text-status-error-text flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
              <div className="flex-1">
                <p className={`font-medium ${testResult.valid ? 'text-status-success-text' : 'text-status-error-text'}`}>
                  {testResult.message}
                </p>
                {testResult.valid && testResult.rateLimit && (
                  <p className="text-sm text-status-success-text mt-1">
                    Rate limit: {testResult.rateLimitRemaining?.toLocaleString()} / {testResult.rateLimit?.toLocaleString()} requests remaining
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="mt-6 p-4 bg-bg-muted rounded-lg">
          <h3 className="text-sm font-semibold text-text-primary mb-2">
            How to get a GitHub token:
          </h3>
          <ol className="list-decimal ml-5 space-y-1 text-sm text-text-secondary">
            <li>Go to <a href="https://github.com/settings/tokens" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">GitHub Settings → Developer settings → Personal access tokens</a></li>
            <li>Click "Generate new token (classic)"</li>
            <li>Give it a name (e.g., "Inker GitHub Widget")</li>
            <li>No scopes needed - public repo data is accessible without permissions</li>
            <li>Click "Generate token" and copy it here</li>
            <li><strong>Test the token</strong> before saving to verify it works</li>
          </ol>
        </div>
      </div>
    </Card>
  );
}
