import type { SVGProps } from 'react';

export type IconName =
  | 'analytics'
  | 'crawler'
  | 'documents'
  | 'indexes'
  | 'key'
  | 'overview'
  | 'recommendations'
  | 'search'
  | 'settings';

const paths: Record<IconName, React.ReactNode> = {
  analytics: <path d="M4 19V9m6 10V5m6 14v-7m4 7H2" />,
  crawler: <path d="M8 7h8m-9 5H4m16 0h-3M8 17h8M9 3h6l2 4v10l-2 4H9l-2-4V7z" />,
  documents: <path d="M6 3h8l4 4v14H6zM14 3v5h4M9 13h6M9 17h6" />,
  indexes: <path d="m12 3 9 5-9 5-9-5zm-7 9 7 4 7-4M5 16l7 4 7-4" />,
  key: <path d="M15 7a5 5 0 1 0 2 4l4-4-2-2-2 2-2-2-2 2M7 12h.01" />,
  overview: <path d="M4 4h6v6H4zm10 0h6v6h-6zM4 14h6v6H4zm10 0h6v6h-6z" />,
  recommendations: (
    <path d="m12 3 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" />
  ),
  search: <path d="m20 20-4.5-4.5M18 11a7 7 0 1 1-14 0 7 7 0 0 1 14 0" />,
  settings: (
    <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.6v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1z" />
  ),
};

export function Icon({ name, ...props }: SVGProps<SVGSVGElement> & { name: IconName }) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.7"
      viewBox="0 0 24 24"
      {...props}
    >
      {paths[name]}
    </svg>
  );
}
