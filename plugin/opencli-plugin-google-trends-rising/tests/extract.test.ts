import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function livePageFixture(): Record<string, unknown> {
  return JSON.parse(readFileSync(new URL('../fixtures/live-trends-page.json', import.meta.url), 'utf-8')) as Record<string, unknown>;
}

describe('normalizeExtractedPage', () => {
  it('builds a bounded extractor payload instead of returning the full page html', async () => {
    const { buildExtractorScript } = await import('../src/extract');

    const script = buildExtractorScript();

    expect(script).toContain('document.body?.innerText');
    expect(script).not.toContain('document.documentElement?.outerHTML');
  });

  it('derives scope, seeds, and rising rows from live Google Trends page text', async () => {
    const { normalizeExtractedPage } = await import('../src/extract');

    const result = normalizeExtractedPage(livePageFixture());

    expect(result.scope).toEqual({
      geo: '',
      time: 'now 7-d',
      category: '0',
      searchProperty: '',
    });
    expect(result.seeds).toEqual(['Comparator', 'Navigator', 'Syncer', 'Connector', 'Cataloger']);
    expect(result.pageInfoBySeed).toEqual({
      Comparator: { shownFrom: 1, shownTo: 5, total: 20 },
      Navigator: { shownFrom: 1, shownTo: 5, total: 16 },
      Syncer: { shownFrom: 1, shownTo: 3, total: 3 },
      Connector: { shownFrom: 1, shownTo: 2, total: 2 },
      Cataloger: { shownFrom: 1, shownTo: 2, total: 2 },
    });
    expect(result.resultsBySeed.Comparator).toEqual([
      {
        query: 'minecraft wordle',
        value: 'Breakout',
        rank: 1,
        risePct: undefined,
        isBreakout: true,
      },
      {
        query: 'craftle',
        value: 'Breakout',
        rank: 2,
        risePct: undefined,
        isBreakout: true,
      },
      {
        query: 'minecraftdle',
        value: '+4,400%',
        rank: 3,
        risePct: 4400,
        isBreakout: false,
      },
      {
        query: 'minecraftle',
        value: '+3,900%',
        rank: 4,
        risePct: 3900,
        isBreakout: false,
      },
      {
        query: 'minecraft wordle answer',
        value: '+2,300%',
        rank: 5,
        risePct: 2300,
        isBreakout: false,
      },
    ]);
    expect(result.resultsBySeed.Navigator).toEqual([
      {
        query: 'shark navigator lift-away adv upright vacuum la300',
        value: '+3,100%',
        rank: 1,
        risePct: 3100,
        isBreakout: false,
      },
      {
        query: 'edric the guild navigator',
        value: '+1,150%',
        rank: 2,
        risePct: 1150,
        isBreakout: false,
      },
      {
        query: 'edric dune',
        value: '+1,100%',
        rank: 3,
        risePct: 1100,
        isBreakout: false,
      },
      {
        query: 'pirate navigator tibia',
        value: '+700%',
        rank: 4,
        risePct: 700,
        isBreakout: false,
      },
      {
        query: 'guild navigator dune',
        value: '+700%',
        rank: 5,
        risePct: 700,
        isBreakout: false,
      },
    ]);
    expect(result.resultsBySeed.Connector).toEqual([
      {
        query: 'mcp connector',
        value: '+4,200%',
        rank: 1,
        risePct: 4200,
        isBreakout: false,
      },
      {
        query: 'remote connector',
        value: '+1,800%',
        rank: 2,
        risePct: 1800,
        isBreakout: false,
      },
    ]);
  });
});
