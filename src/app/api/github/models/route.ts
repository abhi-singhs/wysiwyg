import { NextRequest, NextResponse } from 'next/server';

// Fetch model catalog from public GitHub Models catalog endpoint.
// We still require Authorization because some downstream usage may depend on PAT presence.
// Endpoint: https://models.github.ai/catalog/models (no org scoping needed)
// Returns simplified: { models: [{ id, label }] }
export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (!auth) {
    return NextResponse.json({ error: 'Missing Authorization header' }, { status: 401 });
  }
  const token = auth.split(' ')[1];
  if (!token) {
    return NextResponse.json({ error: 'Invalid Authorization header' }, { status: 401 });
  }

  // Keep owner param for backward compatibility in response shape, though catalog is global
  const { searchParams } = new URL(req.url);
  const owner = searchParams.get('owner') || process.env.GITHUB_REPO_OWNER || 'github';

  try {
    const catalogRes = await fetch('https://models.github.ai/catalog/models', {
      headers: {
        // Authorization not strictly required for public catalog, but passing PAT is harmless
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      },
      cache: 'no-store'
    });

    if (!catalogRes.ok) {
      const text = await catalogRes.text();
      return NextResponse.json({ error: 'Failed to fetch model catalog', status: catalogRes.status, details: text }, { status: catalogRes.status });
    }

    interface ModelCatalogEntry {
      id?: string;
      slug?: string;
      name?: string;
      displayName?: string;
    }
    const raw: unknown = await catalogRes.json();
    let list: ModelCatalogEntry[] = [];
    if (Array.isArray(raw)) {
      list = raw.filter(r => typeof r === 'object' && r !== null) as ModelCatalogEntry[];
    } else if (typeof raw === 'object' && raw !== null) {
      const candidate = (raw as Record<string, unknown>).models;
      if (Array.isArray(candidate)) {
        list = candidate.filter(r => typeof r === 'object' && r !== null) as ModelCatalogEntry[];
      }
    }
    const simplified = list
      .map((m) => ({
        id: m.id || m.slug || m.name,
        label: m.displayName || m.name || m.id || m.slug || 'Unnamed Model'
      }))
      .filter((m) => !!m.id);

    return NextResponse.json({ owner, models: simplified });
  } catch (e: unknown) {
    console.error('Model catalog error:', e);
    return NextResponse.json({ error: 'Unexpected error fetching model catalog' }, { status: 500 });
  }
}
