import type { Metadata } from 'next';

import { SearchPlayground } from '../../components/search-playground';

export const metadata: Metadata = { title: 'Search Playground' };

export default function SearchPlaygroundPage() {
  return <SearchPlayground />;
}
