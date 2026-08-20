import type { Metadata } from 'next';

import { IndexDetail } from '../../../components/index-detail';

export const metadata: Metadata = { title: 'Index' };

export default async function IndexPage({ params }: { params: Promise<{ indexId: string }> }) {
  const { indexId } = await params;
  return <IndexDetail indexId={indexId} />;
}
