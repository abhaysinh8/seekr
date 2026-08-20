import type { Metadata } from 'next';
import { RecommendationPlayground } from '../../components/recommendation-playground';

export const metadata: Metadata = { title: 'Recommendations' };
export default function RecommendationsPage() {
  return <RecommendationPlayground />;
}
