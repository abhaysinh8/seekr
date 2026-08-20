import type { Metadata } from 'next';

import { IndexManager } from '../../components/index-manager';

export const metadata: Metadata = { title: 'Indexes' };

export default function IndexesPage() {
  return <IndexManager />;
}
