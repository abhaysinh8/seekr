'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { Icon, type IconName } from './icons';

const navigation: ReadonlyArray<{ href: string; icon: IconName; label: string }> = [
  { href: '/', icon: 'overview', label: 'Overview' },
  { href: '/indexes', icon: 'indexes', label: 'Indexes' },
  { href: '/documents', icon: 'documents', label: 'Documents' },
  { href: '/search-playground', icon: 'search', label: 'Search Playground' },
  { href: '/crawler', icon: 'crawler', label: 'Crawler' },
  { href: '/recommendations', icon: 'recommendations', label: 'Recommendations' },
  { href: '/analytics', icon: 'analytics', label: 'Analytics' },
  { href: '/api-keys', icon: 'key', label: 'API Keys' },
  { href: '/settings', icon: 'settings', label: 'Settings' },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="border-panel hidden w-64 shrink-0 border-r bg-surface lg:flex lg:flex-col">
      <div className="flex h-16 items-center border-b border-panel px-6">
        <Link className="flex items-center gap-2.5" href="/">
          <span className="grid size-7 place-items-center rounded-md bg-accent text-sm font-bold text-slate-950">
            S
          </span>
          <span className="text-base font-semibold tracking-tight text-white">Seekr</span>
        </Link>
        <span className="ml-2 rounded border border-panel px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted">
          alpha
        </span>
      </div>

      <nav aria-label="Dashboard" className="flex-1 space-y-1 px-3 py-5">
        {navigation.map((item) => (
          <Link
            className={`group flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors hover:bg-elevated hover:text-white ${
              pathname === item.href || (item.href !== '/' && pathname.startsWith(`${item.href}/`))
                ? 'bg-elevated text-white'
                : 'text-muted'
            }`}
            href={item.href}
            key={item.href}
          >
            <Icon className="size-[18px] text-subtle group-hover:text-accent" name={item.icon} />
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="border-t border-panel p-4">
        <div className="rounded-lg border border-panel bg-canvas p-3">
          <div className="mb-2 flex items-center gap-2 text-xs font-medium text-slate-200">
            <span className="size-1.5 rounded-full bg-accent" /> Self-hosted runtime
          </div>
          <p className="text-xs leading-5 text-muted">
            Search and recommendation algorithms run inside Seekr.
          </p>
        </div>
      </div>
    </aside>
  );
}

export function MobileNavigation() {
  return (
    <nav
      aria-label="Dashboard"
      className="flex gap-1 overflow-x-auto border-b border-panel bg-surface px-3 py-2 lg:hidden"
    >
      {navigation.map((item) => (
        <Link
          className="flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-xs text-muted hover:bg-elevated hover:text-white"
          href={item.href}
          key={item.href}
        >
          <Icon className="size-4" name={item.icon} />
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
