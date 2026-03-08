/**
 * WidgetLibrary Component
 * Displays available widget templates that can be dragged onto the canvas.
 */
import { useState } from 'react';
import type { WidgetTemplate } from '../../types';

interface WidgetLibraryProps {
  templates: WidgetTemplate[];
  onDragStart: (template: WidgetTemplate) => void;
}

// Category configuration with icons
const categoryConfig: Record<string, { icon: React.ReactNode; label: string }> = {
  time: {
    label: 'Time & Date',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  weather: {
    label: 'Weather',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
      </svg>
    ),
  },
  content: {
    label: 'Content',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h7" />
      </svg>
    ),
  },
  system: {
    label: 'System',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
  },
  layout: {
    label: 'Layout',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
      </svg>
    ),
  },
  custom: {
    label: 'Custom',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
      </svg>
    ),
  },
};

// Widget-specific icons
const widgetIcons: Record<string, React.ReactNode> = {
  clock: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  date: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
  weather: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
    </svg>
  ),
  text: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  ),
  qrcode: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h2M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
    </svg>
  ),
  battery: (
    // Battery icon - matches WidgetRenderer style
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <rect x="1" y="6" width="18" height="12" rx="2" strokeWidth={1.5} />
      <rect x="19" y="9" width="4" height="6" rx="1" strokeWidth={1.5} />
      <rect x="3" y="8" width="10" height="8" fill="currentColor" rx="1" />
    </svg>
  ),
  image: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
  divider: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 12h16" />
    </svg>
  ),
  countdown: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l2 2m4-6V5a1 1 0 00-1-1h-2M8 4H6a1 1 0 00-1 1v3m14 4a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  ),
  rectangle: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <rect x="3" y="5" width="18" height="14" rx="2" strokeWidth={1.5} />
    </svg>
  ),
  wifi: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.14 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
    </svg>
  ),
  deviceinfo: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
    </svg>
  ),
  daysuntil: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 12v4l2 1" />
    </svg>
  ),
  github: (
    // GitHub logo - MIT license from Simple Icons
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  ),
  // Custom widgets get a star icon to indicate they're user-created
  custom: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
    </svg>
  ),
};

export function WidgetLibrary({ templates, onDragStart }: WidgetLibraryProps) {
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    Object.keys(categoryConfig).forEach((key) => {
      initial[key] = true;
    });
    return initial;
  });
  const [draggingTemplate, setDraggingTemplate] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const templateArray = Array.isArray(templates) ? templates : [];

  const filteredTemplates = searchQuery
    ? templateArray.filter(
        (template) =>
          template.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
          template.description?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : templateArray;

  const groupedTemplates = filteredTemplates.reduce<Record<string, WidgetTemplate[]>>((acc, template) => {
    const category = template.category;
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(template);
    return acc;
  }, {});

  /** Toggle category expansion */
  function toggleCategory(category: string) {
    setExpandedCategories((prev) => ({
      ...prev,
      [category]: !prev[category],
    }));
  }

  /** Handle drag start event */
  function handleDragStart(e: React.DragEvent, template: WidgetTemplate) {
    e.dataTransfer.setData('application/json', JSON.stringify(template));
    e.dataTransfer.effectAllowed = 'copy';
    setDraggingTemplate(template.id);
    onDragStart(template);
  }

  function handleDragEnd() {
    setDraggingTemplate(null);
  }

  const isLoading = templateArray.length === 0;

  return (
    <div className="w-64 bg-bg-card border-r border-border-light flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-border-light">
        <h2 className="text-sm font-semibold text-text-primary mb-3">Widgets</h2>

        {/* Search input */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="h-4 w-4 text-text-placeholder" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm bg-bg-muted border border-border-light rounded-lg placeholder-text-placeholder focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-shadow"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-text-placeholder hover:text-text-secondary"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Widget list */}
      <div className="flex-1 overflow-y-auto p-2">
        {/* Loading state */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <div className="w-10 h-10 rounded-xl bg-bg-muted flex items-center justify-center mb-3">
              <svg className="w-5 h-5 text-text-placeholder animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6z" />
              </svg>
            </div>
            <p className="text-sm text-text-muted">Loading widgets...</p>
          </div>
        )}

        {/* Empty search results */}
        {!isLoading && searchQuery && filteredTemplates.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <div className="w-10 h-10 rounded-xl bg-bg-muted flex items-center justify-center mb-3">
              <svg className="w-5 h-5 text-text-placeholder" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <p className="text-sm text-text-secondary mb-1">No results</p>
            <p className="text-xs text-text-placeholder">Try a different search term</p>
          </div>
        )}

        {/* Categories */}
        {Object.entries(groupedTemplates).map(([category, categoryTemplates]) => {
          const config = categoryConfig[category] || {
            label: category.charAt(0).toUpperCase() + category.slice(1),
            icon: (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            ),
          };
          const isExpanded = expandedCategories[category] ?? true;

          return (
            <div key={category} className="mb-1">
              {/* Category header */}
              <button
                onClick={() => toggleCategory(category)}
                className="w-full flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-bg-muted transition-colors"
              >
                <span className="text-text-placeholder">{config.icon}</span>
                <span className="flex-1 text-left text-xs font-medium text-text-secondary uppercase tracking-wide">
                  {config.label}
                </span>
                <svg
                  className={`w-4 h-4 text-text-placeholder transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Category templates */}
              {isExpanded && (
                <div className="mt-1 space-y-1">
                  {categoryTemplates.map((template) => {
                    const isDragging = draggingTemplate === template.id;
                    return (
                      <div
                        key={template.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, template)}
                        onDragEnd={handleDragEnd}
                        className={`
                          group flex items-center gap-3 px-3 py-2.5 rounded-xl
                          cursor-grab active:cursor-grabbing
                          transition-all duration-150
                          ${isDragging
                            ? 'bg-accent-light ring-2 ring-accent shadow-md'
                            : 'bg-bg-muted hover:bg-bg-page border border-transparent hover:border-border-light'
                          }
                        `}
                        title={template.description}
                      >
                        <div className={`
                          flex-shrink-0 w-8 h-8 rounded-lg
                          flex items-center justify-center
                          transition-colors duration-150
                          ${isDragging
                            ? 'bg-accent-light text-accent'
                            : 'bg-bg-card text-text-muted group-hover:text-text-secondary shadow-sm border border-border-light'
                          }
                        `}>
                          {/* Use custom icon for custom widgets (name starts with "custom-") */}
                          {widgetIcons[template.name] || (template.name.startsWith('custom-') ? widgetIcons.custom : null) || (
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6z" />
                            </svg>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium ${isDragging ? 'text-accent' : 'text-text-primary'}`}>
                            {template.label}
                          </p>
                        </div>
                        <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          <svg className="w-4 h-4 text-text-placeholder" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                          </svg>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer hint */}
      <div className="p-3 border-t border-border-light">
        <p className="text-xs text-text-placeholder text-center">
          Drag widgets onto the canvas
        </p>
      </div>
    </div>
  );
}
