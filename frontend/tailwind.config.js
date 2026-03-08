/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Background colors (using CSS variables)
        bg: {
          page: 'var(--bg-page)',
          card: 'var(--bg-card)',
          'card-hover': 'var(--bg-card-hover)',
          input: 'var(--bg-input)',
          muted: 'var(--bg-muted)',
        },
        // Sidebar colors
        sidebar: {
          bg: 'var(--sidebar-bg)',
          'bg-hover': 'var(--sidebar-bg-hover)',
          text: 'var(--sidebar-text)',
          'text-muted': 'var(--sidebar-text-muted)',
          border: 'var(--sidebar-border)',
          'active-bg': 'var(--sidebar-active-bg)',
          'active-accent': 'var(--sidebar-active-accent)',
        },
        // Text colors
        text: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          muted: 'var(--text-muted)',
          placeholder: 'var(--text-placeholder)',
          inverse: 'var(--text-inverse)',
        },
        // Border colors
        border: {
          light: 'var(--border-light)',
          DEFAULT: 'var(--border-default)',
          dark: 'var(--border-dark)',
        },
        // Accent color (sepia/amber)
        accent: {
          DEFAULT: 'var(--accent)',
          hover: 'var(--accent-hover)',
          light: 'var(--accent-light)',
          text: 'var(--accent-text)',
        },
        // Status colors
        status: {
          success: {
            bg: 'var(--status-success-bg)',
            text: 'var(--status-success-text)',
            border: 'var(--status-success-border)',
            dot: 'var(--status-success-dot)',
          },
          error: {
            bg: 'var(--status-error-bg)',
            text: 'var(--status-error-text)',
            border: 'var(--status-error-border)',
            dot: 'var(--status-error-dot)',
          },
          warning: {
            bg: 'var(--status-warning-bg)',
            text: 'var(--status-warning-text)',
            border: 'var(--status-warning-border)',
            dot: 'var(--status-warning-dot)',
          },
          info: {
            bg: 'var(--status-info-bg)',
            text: 'var(--status-info-text)',
            border: 'var(--status-info-border)',
            dot: 'var(--status-info-dot)',
          },
        },
      },
      boxShadow: {
        'theme-sm': 'var(--shadow-sm)',
        'theme-md': 'var(--shadow-md)',
        'theme-lg': 'var(--shadow-lg)',
        'theme-xl': 'var(--shadow-xl)',
      },
      borderRadius: {
        'theme-sm': 'var(--radius-sm)',
        'theme-md': 'var(--radius-md)',
        'theme-lg': 'var(--radius-lg)',
        'theme-xl': 'var(--radius-xl)',
      },
    },
  },
  plugins: [],
  darkMode: 'class',
}
