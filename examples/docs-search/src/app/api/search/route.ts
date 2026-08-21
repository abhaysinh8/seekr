import { NextResponse } from 'next/server';
import { SeekrClient, SeekrError } from '@seekr/sdk';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = url.searchParams.get('q')?.slice(0, 256) ?? '';
  const indexId = process.env.SEEKR_INDEX_ID;
  const section = url.searchParams.get('section')?.slice(0, 100);
  const page = Math.max(0, Number(url.searchParams.get('page') ?? '0') || 0);
  if (!indexId)
    return NextResponse.json({ error: 'SEEKR_INDEX_ID is not configured' }, { status: 503 });
  const client = new SeekrClient({
    baseUrl: process.env.SEEKR_URL ?? 'http://localhost:4000',
    ...(process.env.SEEKR_API_KEY ? { apiKey: process.env.SEEKR_API_KEY } : {}),
  });
  try {
    if (url.searchParams.get('mode') === 'autocomplete')
      return NextResponse.json(
        await client.indexes.autocomplete(indexId, { prefix: query, limit: 6 }),
      );
    return NextResponse.json(
      await client.indexes.search(indexId, {
        query,
        limit: 8,
        offset: page * 8,
        ...(section ? { filters: [{ field: 'section', operator: 'equals', value: section }] } : {}),
        typoTolerance: true,
        spellCorrection: true,
        highlight: { fields: ['title', 'content'] },
        facets: ['section'],
      }),
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof SeekrError ? error.message : 'Seekr request failed' },
      { status: error instanceof SeekrError ? error.status : 502 },
    );
  }
}
