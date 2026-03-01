import { Link, useLocation } from 'react-router-dom';
import { version } from '../../../package.json';

interface NavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
}

/**
 * Sidebar navigation component with monochrome theme and subtle accent
 * Uses CSS variables for easy theme customization
 */
export function Sidebar() {
  const location = useLocation();

  const navItems: NavItem[] = [
    {
      to: '/dashboard',
      label: 'Dashboard',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z"
          />
        </svg>
      ),
    },
    {
      to: '/devices',
      label: 'Devices',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M10.5 19.5h3m-6.75 2.25h10.5a2.25 2.25 0 002.25-2.25v-15a2.25 2.25 0 00-2.25-2.25H6.75A2.25 2.25 0 004.5 4.5v15a2.25 2.25 0 002.25 2.25z"
          />
        </svg>
      ),
    },
    {
      to: '/screens',
      label: 'Screens',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
          />
        </svg>
      ),
    },
    {
      to: '/playlists',
      label: 'Playlists',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z"
          />
        </svg>
      ),
    },
    {
      to: '/extensions',
      label: 'Extensions',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M14.25 6.087c0-.355.186-.676.401-.959.221-.29.349-.634.349-1.003 0-1.036-1.007-1.875-2.25-1.875s-2.25.84-2.25 1.875c0 .369.128.713.349 1.003.215.283.401.604.401.959v0a.64.64 0 01-.657.643 48.39 48.39 0 01-4.163-.3c.186 1.613.293 3.25.315 4.907a.656.656 0 01-.658.663v0c-.355 0-.676-.186-.959-.401a1.647 1.647 0 00-1.003-.349c-1.036 0-1.875 1.007-1.875 2.25s.84 2.25 1.875 2.25c.369 0 .713-.128 1.003-.349.283-.215.604-.401.959-.401v0c.31 0 .555.26.532.57a48.039 48.039 0 01-.642 5.056c1.518.19 3.058.309 4.616.354a.64.64 0 00.657-.643v0c0-.355-.186-.676-.401-.959a1.647 1.647 0 01-.349-1.003c0-1.035 1.008-1.875 2.25-1.875 1.243 0 2.25.84 2.25 1.875 0 .369-.128.713-.349 1.003-.215.283-.4.604-.4.959v0c0 .333.277.599.61.58a48.1 48.1 0 005.427-.63 48.05 48.05 0 00.582-4.717.532.532 0 00-.533-.57v0c-.355 0-.676.186-.959.401-.29.221-.634.349-1.003.349-1.035 0-1.875-1.007-1.875-2.25s.84-2.25 1.875-2.25c.37 0 .713.128 1.003.349.283.215.604.401.96.401v0a.656.656 0 00.658-.663 48.422 48.422 0 00-.37-5.36c-1.886.342-3.81.574-5.766.689a.578.578 0 01-.61-.58z"
          />
        </svg>
      ),
    },
    {
      to: '/settings',
      label: 'Settings',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
      ),
    },
  ];

  const isActive = (path: string) => location.pathname.startsWith(path);

  return (
    <aside className="fixed left-0 top-0 h-screen w-72 bg-sidebar-bg shadow-2xl overflow-hidden">
      {/* Content */}
      <div className="relative z-10 flex flex-col h-full">
        {/* Logo and Brand */}
        <div className="p-6 border-b border-sidebar-border">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="relative">
              <div className="h-10 w-10 bg-white/10 rounded-xl flex items-center justify-center border border-white/20">
                {/* Ink drop logo */}
                <svg width="28" height="28" viewBox="0 0 40 40" fill="none">
                  <defs>
                    <linearGradient id="dropGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#ffffff"/>
                      <stop offset="100%" stopColor="#e0e0e0"/>
                    </linearGradient>
                  </defs>
                  {/* Main ink drop */}
                  <path d="M20 4 C20 4 10 14 10 23 C10 29 14.5 34 20 34 C25.5 34 30 29 30 23 C30 14 20 4 20 4Z" fill="url(#dropGradient)"/>
                  {/* E-ink pixel pattern */}
                  <g opacity="0.15">
                    <rect x="16" y="26" width="3" height="3" rx="0.5" fill="#1a1a1a"/>
                    <rect x="21" y="26" width="3" height="3" rx="0.5" fill="#1a1a1a"/>
                    <rect x="18.5" y="29.5" width="3" height="3" rx="0.5" fill="#1a1a1a"/>
                  </g>
                </svg>
              </div>
            </div>
            <div>
              <span className="text-xl font-bold text-sidebar-text tracking-tight">
                Inker
              </span>
              <span className="block text-xs text-sidebar-text-muted font-medium">
                Device Management
              </span>
            </div>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          <div className="mb-4">
            <span className="px-3 text-xs font-semibold text-sidebar-text-muted uppercase tracking-wider">
              Main Menu
            </span>
          </div>

          {navItems.map((item) => {
            const active = isActive(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`
                  flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group relative
                  ${active
                    ? 'bg-sidebar-active-bg text-sidebar-text'
                    : 'text-sidebar-text-muted hover:bg-sidebar-bg-hover hover:text-sidebar-text'
                  }
                `}
              >
                {/* Active indicator bar */}
                {active && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-sidebar-active-accent rounded-r-full" />
                )}

                {/* Icon container */}
                <div
                  className={`
                    flex-shrink-0 transition-transform duration-200
                    ${active ? 'text-sidebar-active-accent' : 'group-hover:text-sidebar-active-accent'}
                    ${!active && 'group-hover:scale-110'}
                  `}
                >
                  {item.icon}
                </div>

                {/* Label */}
                <span className="font-medium">
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>

        {/* Buy Me a Coffee */}
        <div className="px-4 pb-2 pt-4 border-t border-sidebar-border flex justify-center">
          <a
            href="https://buymeacoffee.com/wojo_o"
            target="_blank"
            rel="noopener noreferrer"
          >
            <img
              src="/bmc-button.png"
              alt="Buy Me A Coffee"
              className="h-10"
            />
          </a>
        </div>

        {/* Footer with version info */}
        <div className="px-4 pb-4">
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white/5">
            <div className="w-2 h-2 bg-status-success-dot rounded-full animate-pulse" />
            <span className="text-xs text-sidebar-text-muted">
              System Online
            </span>
            <span className="ml-auto text-xs text-sidebar-text-muted">
              {version}
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
}
