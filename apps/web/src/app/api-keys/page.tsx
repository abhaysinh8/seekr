import type { Metadata } from 'next';

import { ApiKeyManager } from '../../components/api-key-manager';

export const metadata: Metadata = { title: 'API Keys' };
export default function ApiKeysPage() {
  return <ApiKeyManager />;
}
