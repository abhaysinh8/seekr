import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

const sections = {
  'api-keys': {
    description: 'API key issuance and revocation will arrive with project authentication.',
    title: 'API Keys',
  },
  analytics: {
    description: 'Query and interaction analytics will be populated by real search traffic.',
    title: 'Analytics',
  },
  crawler: {
    description: 'Crawl source and job controls will arrive with the ingestion milestone.',
    title: 'Crawler',
  },
  documents: {
    description:
      'Document management will become available after index creation APIs are implemented.',
    title: 'Documents',
  },
  indexes: {
    description: 'Index lifecycle controls will arrive with the lexical indexing core.',
    title: 'Indexes',
  },
  recommendations: {
    description: 'Recommendation controls are reserved for the recommendation engine milestone.',
    title: 'Recommendations',
  },
  'search-playground': {
    description:
      'The playground will connect to real retrieval results once search is implemented.',
    title: 'Search Playground',
  },
  settings: {
    description:
      'Project configuration will appear here when project APIs and authentication are ready.',
    title: 'Settings',
  },
} as const;

type Section = keyof typeof sections;

function isSection(value: string): value is Section {
  return value in sections;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ section: string }>;
}): Promise<Metadata> {
  const { section } = await params;
  return isSection(section) ? { title: sections[section].title } : {};
}

export function generateStaticParams() {
  return Object.keys(sections).map((section) => ({ section }));
}

export default async function SectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (!isSection(section)) notFound();
  const content = sections[section];

  return (
    <div className="mx-auto max-w-7xl px-5 py-8 lg:px-8 lg:py-10">
      <p className="font-mono text-xs font-medium uppercase tracking-[0.18em] text-accent">
        Dashboard
      </p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
        {content.title}
      </h1>
      <div className="mt-8 rounded-xl border border-panel bg-surface p-8 sm:p-12">
        <span className="inline-flex rounded-full border border-panel bg-canvas px-3 py-1 text-xs text-muted">
          Planned capability
        </span>
        <h2 className="mt-5 text-lg font-medium text-slate-100">
          This section is intentionally inactive.
        </h2>
        <p className="mt-2 max-w-xl text-sm leading-6 text-muted">{content.description}</p>
      </div>
    </div>
  );
}
