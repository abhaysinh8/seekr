import type { Metadata } from 'next';

import { MobileNavigation, Sidebar } from '../components/sidebar';

import './globals.css';

export const metadata: Metadata = {
  description: 'Self-hosted search and recommendations, built from first principles.',
  title: {
    default: 'Seekr Console',
    template: '%s · Seekr',
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <div className="flex min-h-screen bg-canvas">
          <Sidebar />
          <div className="min-w-0 flex-1">
            <header className="flex h-16 items-center justify-between border-b border-panel bg-surface px-5 lg:px-8">
              <div className="flex items-center gap-3">
                <span className="grid size-7 place-items-center rounded-md bg-accent text-sm font-bold text-slate-950 lg:hidden">
                  S
                </span>
                <div>
                  <p className="text-xs text-muted">Workspace</p>
                  <p className="text-sm font-medium text-slate-100">Local development</p>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-md border border-panel bg-canvas px-2.5 py-1.5 font-mono text-xs text-muted">
                <span className="size-1.5 rounded-full bg-accent" /> localhost
              </div>
            </header>
            <MobileNavigation />
            <main>{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}
