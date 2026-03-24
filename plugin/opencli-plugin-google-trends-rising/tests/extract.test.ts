import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function extractedFixture(): unknown {
  return JSON.parse(readFileSync(new URL('../fixtures/extracted-trends-page.json', import.meta.url), 'utf-8'));
}

describe('buildExtractorScript', () => {
  it('builds a script that returns structured results by seed', async () => {
    const { buildExtractorScript } = await import('../src/extract');

    const script = buildExtractorScript();

    expect(script).toContain('resultsBySeed');
    expect(script).toContain('Related queries');
    expect(script).toContain('JSON.stringify');
  });
});

describe('normalizeExtractedPage', () => {
  it('keeps the full Rising list for every compare seed', async () => {
    const { normalizeExtractedPage } = await import('../src/extract');

    const page = normalizeExtractedPage(extractedFixture());

    expect(page.seeds).toEqual(['agent', 'ai', 'anime', 'answer', 'analyzer']);
    expect(page.resultsBySeed.agent).toHaveLength(25);
  });

  it('normalizes missing scope fields to explicit defaults', async () => {
    const { normalizeExtractedPage } = await import('../src/extract');

    const page = normalizeExtractedPage(extractedFixture());

    expect(page.scope).toEqual({
      geo: 'US',
      time: 'now 7-d',
      category: '0',
      searchProperty: '',
    });
  });

  it('parses breakout and numeric percentage rows', async () => {
    const { normalizeExtractedPage } = await import('../src/extract');

    const page = normalizeExtractedPage(extractedFixture());

    expect(page.resultsBySeed.agent[0]).toMatchObject({
      query: 'ghibli style image',
      isBreakout: true,
      risePct: undefined,
      rank: 1,
    });
    expect(page.resultsBySeed.agent[1]).toMatchObject({
      query: 'agentic rag',
      isBreakout: false,
      risePct: 2300,
      rank: 2,
    });
  });
});
