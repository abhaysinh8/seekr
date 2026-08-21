import type { Metadata } from 'next';
import './styles.css';

export const metadata: Metadata = {
  title: 'Seekr Documentation Search',
  description: 'A complete Seekr SDK example.',
};
export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
