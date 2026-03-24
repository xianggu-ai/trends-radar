import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ChromeTab } from '../src/types';

function extractedFixture(): Record<string, unknown> {
  return JSON.parse(readFileSync(new URL('../fixtures/extracted-trends-page.json', import.meta.url), 'utf-8')) as Record<string, unknown>;
}

function cloneFixture(): Record<string, unknown> {
  return JSON.parse(JSON.stringify(extractedFixture())) as Record<string, unknown>;
}

function createTab(overrides: Partial<ChromeTab> = {}): ChromeTab {
  return {
    windowIndex: 1,
    tabIndex: 1,
    title: 'Google Trends compare',
    url: 'https://trends.google.com/trends/explore?date=now%207-d&geo=US&q=agent,ai,anime,answer,analyzer',
    active: true,
    ...overrides,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('runCollectOpenTrendsTabs', () => {
  it('returns a JSON envelope merged across multiple compare tabs', async () => {
    const { runCollectOpenTrendsTabs } = await import('../src/command');
    const tabA = createTab();
    const tabB = createTab({
      tabIndex: 2,
      title: 'Google Trends compare 2',
      url: 'https://trends.google.com/trends/explore?date=now%207-d&geo=US&q=chatgpt,ghibli,midjourney,perplexity,mistral%20ai',
      active: false,
    });

    const pageA = cloneFixture();
    const pageB = cloneFixture();
    pageB.seeds = ['agent', 'ai'];
    pageB.resultsBySeed = {
      agent: [
        { query: 'ghibli style image', value: '+5000%', rank: 3 },
        { query: 'agentic rag', value: '+2300%', rank: 4 },
      ],
      ai: [{ query: 'ai ghibli', value: 'Breakout', rank: 1 }],
    };

    const listChromeTabs = vi.fn().mockResolvedValue([tabA, tabB]);
    const activateChromeTab = vi.fn().mockResolvedValue(undefined);
    const executeInChromeTab = vi
      .fn()
      .mockResolvedValueOnce(pageA)
      .mockResolvedValueOnce(pageB);

    const result = await runCollectOpenTrendsTabs(
      { minRise: 2000 },
      {
        listChromeTabs,
        activateChromeTab,
        executeInChromeTab,
        now: () => '2026-03-23T00:00:00.000Z',
      },
    );

    expect(result.run).toEqual({
      scope: {
        geo: 'US',
        time: 'now 7-d',
        category: '0',
        searchProperty: '',
      },
      processedTabs: 2,
      capturedAt: '2026-03-23T00:00:00.000Z',
    });
    expect(result.results).toEqual([
      {
        seed: 'agent',
        geo: 'US',
        time: 'now 7-d',
        category: '0',
        search_property: '',
        related_query: 'ghibli style image',
        rise_pct: undefined,
        is_breakout: true,
        rank: 1,
        source_tab_count: 2,
        captured_at: '2026-03-23T00:00:00.000Z',
      },
      {
        seed: 'agent',
        geo: 'US',
        time: 'now 7-d',
        category: '0',
        search_property: '',
        related_query: 'agentic rag',
        rise_pct: 2300,
        is_breakout: false,
        rank: 2,
        source_tab_count: 2,
        captured_at: '2026-03-23T00:00:00.000Z',
      },
      {
        seed: 'ai',
        geo: 'US',
        time: 'now 7-d',
        category: '0',
        search_property: '',
        related_query: 'ai ghibli',
        rise_pct: undefined,
        is_breakout: true,
        rank: 1,
        source_tab_count: 2,
        captured_at: '2026-03-23T00:00:00.000Z',
      },
      {
        seed: 'ai',
        geo: 'US',
        time: 'now 7-d',
        category: '0',
        search_property: '',
        related_query: 'ai agent',
        rise_pct: 2100,
        is_breakout: false,
        rank: 2,
        source_tab_count: 1,
        captured_at: '2026-03-23T00:00:00.000Z',
      },
      {
        seed: 'analyzer',
        geo: 'US',
        time: 'now 7-d',
        category: '0',
        search_property: '',
        related_query: 'video analyzer',
        rise_pct: 2400,
        is_breakout: false,
        rank: 1,
        source_tab_count: 1,
        captured_at: '2026-03-23T00:00:00.000Z',
      },
      {
        seed: 'anime',
        geo: 'US',
        time: 'now 7-d',
        category: '0',
        search_property: '',
        related_query: 'anime ghibli',
        rise_pct: 2200,
        is_breakout: false,
        rank: 1,
        source_tab_count: 1,
        captured_at: '2026-03-23T00:00:00.000Z',
      },
      {
        seed: 'answer',
        geo: 'US',
        time: 'now 7-d',
        category: '0',
        search_property: '',
        related_query: 'answer engine',
        rise_pct: 2050,
        is_breakout: false,
        rank: 1,
        source_tab_count: 1,
        captured_at: '2026-03-23T00:00:00.000Z',
      },
    ]);
    expect(result.tabs.map((tab) => tab.status)).toEqual(['ok', 'ok']);
    expect(activateChromeTab).toHaveBeenCalledTimes(2);
    expect(listChromeTabs).toHaveBeenCalledOnce();
  });

  it('fails when no canonical scope can be established', async () => {
    const { runCollectOpenTrendsTabs } = await import('../src/command');

    await expect(
      runCollectOpenTrendsTabs(
        { minRise: 2000 },
        {
          listChromeTabs: vi.fn().mockResolvedValue([createTab()]),
          activateChromeTab: vi.fn().mockResolvedValue(undefined),
          executeInChromeTab: vi.fn().mockResolvedValue({
            blocked: true,
            blockReason: 'captcha',
            seeds: [],
            resultsBySeed: {},
          }),
          now: () => '2026-03-23T00:00:00.000Z',
        },
      ),
    ).rejects.toThrow(/canonical scope/i);
  });

  it('surfaces the underlying tab error when no canonical scope can be established', async () => {
    const { runCollectOpenTrendsTabs } = await import('../src/command');

    await expect(
      runCollectOpenTrendsTabs(
        { minRise: 2000 },
        {
          listChromeTabs: vi.fn().mockResolvedValue([createTab()]),
          activateChromeTab: vi.fn().mockResolvedValue(undefined),
          executeInChromeTab: vi
            .fn()
            .mockRejectedValue(new Error('Enable "Allow JavaScript from Apple Events" in Google Chrome Developer settings.')),
          now: () => '2026-03-23T00:00:00.000Z',
        },
      ),
    ).rejects.toThrow(/Allow JavaScript from Apple Events/i);
  });

  it('marks mismatched scope tabs and duplicate pages without aborting the batch', async () => {
    const { runCollectOpenTrendsTabs } = await import('../src/command');
    const tabA = createTab();
    const tabB = createTab({
      tabIndex: 2,
      url: 'https://trends.google.com/trends/explore?date=now%207-d&geo=US&q=anime,answer,analyzer,agent,ai',
      active: false,
    });
    const tabC = createTab({
      windowIndex: 2,
      tabIndex: 1,
      url: 'https://trends.google.com/trends/explore?date=now%2030-d&geo=JP&q=anime,manga,ghibli,one%20piece,naruto',
      active: true,
    });

    const pageA = cloneFixture();
    const pageB = cloneFixture();
    pageB.seeds = ['anime', 'answer', 'analyzer', 'agent', 'ai'];
    const pageC = cloneFixture();
    pageC.scope = {
      geo: 'JP',
      time: 'now 30-d',
      category: '0',
      searchProperty: '',
    };

    const result = await runCollectOpenTrendsTabs(
      { minRise: 2000 },
      {
        listChromeTabs: vi.fn().mockResolvedValue([tabA, tabB, tabC]),
        activateChromeTab: vi.fn().mockResolvedValue(undefined),
        executeInChromeTab: vi
          .fn()
          .mockResolvedValueOnce(pageA)
          .mockResolvedValueOnce(pageB)
          .mockResolvedValueOnce(pageC),
        now: () => '2026-03-23T00:00:00.000Z',
      },
    );

    expect(result.tabs.map((tab) => tab.status)).toEqual(['ok', 'duplicate_skipped', 'mismatch_skipped']);
    expect(result.run.processedTabs).toBe(1);
  });

  it('paginates query results within a compare page until all rising rows are collected', async () => {
    const { runCollectOpenTrendsTabs } = await import('../src/command');
    const tab = createTab({
      url: 'https://trends.google.com/trends/explore?date=now%207-d&q=Comparator,Navigator,Syncer,Connector,Cataloger',
    });

    const pageOne = {
      scope: {
        geo: '',
        time: 'now 7-d',
        category: '0',
        searchProperty: '',
      },
      seeds: ['Comparator', 'Navigator'],
      pageInfoBySeed: {
        Comparator: { shownFrom: 1, shownTo: 5, total: 8 },
        Navigator: { shownFrom: 1, shownTo: 5, total: 5 },
      },
      resultsBySeed: {
        Comparator: [
          { query: 'minecraft wordle', value: 'Breakout', rank: 1 },
          { query: 'craftle', value: 'Breakout', rank: 2 },
          { query: 'minecraftdle', value: '+4,400%', rank: 3 },
          { query: 'minecraftle', value: '+3,900%', rank: 4 },
          { query: 'minecraft wordle answer', value: '+2,300%', rank: 5 },
        ],
        Navigator: [
          { query: 'shark navigator lift-away adv upright vacuum la300', value: '+3,100%', rank: 1 },
        ],
      },
    };

    const pageTwo = {
      ...pageOne,
      pageInfoBySeed: {
        Comparator: { shownFrom: 6, shownTo: 8, total: 8 },
        Navigator: { shownFrom: 1, shownTo: 5, total: 5 },
      },
      resultsBySeed: {
        Comparator: [
          { query: 'minecraft wordle solver', value: '+2,200%', rank: 6 },
          { query: 'minecraft wordle list', value: '+2,150%', rank: 7 },
          { query: 'minecraft wordle archive', value: '+1,900%', rank: 8 },
        ],
        Navigator: [
          { query: 'shark navigator lift-away adv upright vacuum la300', value: '+3,100%', rank: 1 },
        ],
      },
    };

    const clickNextQueryPage = vi.fn().mockResolvedValue({ clicked: true });

    const result = await runCollectOpenTrendsTabs(
      { minRise: 2000 },
      {
        listChromeTabs: vi.fn().mockResolvedValue([tab]),
        activateChromeTab: vi.fn().mockResolvedValue(undefined),
        executeInChromeTab: vi.fn().mockResolvedValueOnce(pageOne).mockResolvedValueOnce(pageTwo),
        clickNextQueryPage,
        now: () => '2026-03-24T11:49:46.118Z',
      },
    );

    expect(clickNextQueryPage).toHaveBeenCalledWith(tab, 0);
    expect(result.results.filter((row) => row.seed === 'Comparator').map((row) => row.related_query)).toEqual([
      'minecraft wordle',
      'craftle',
      'minecraftdle',
      'minecraftle',
      'minecraft wordle answer',
      'minecraft wordle solver',
      'minecraft wordle list',
    ]);
  });
});

describe('collect-open-trends-tabs entry module', () => {
  it('registers the new OpenCLI command surface and delegates to runCollectOpenTrendsTabs', async () => {
    const command = await import('../src/command');
    const expectedEnvelope = {
      run: {
        scope: null,
        processedTabs: 0,
        capturedAt: '2026-03-23T00:00:00.000Z',
      },
      results: [],
      tabs: [],
    };
    const runCollectOpenTrendsTabs = vi
      .spyOn(command, 'runCollectOpenTrendsTabs')
      .mockResolvedValue(expectedEnvelope);
    const { collectOpenTrendsTabsCommand } = await import('../collect-open-trends-tabs.ts');

    expect(collectOpenTrendsTabsCommand.name).toBe('collect-open-trends-tabs');
    expect(collectOpenTrendsTabsCommand.browser).toBe(false);
    expect(collectOpenTrendsTabsCommand.args).toEqual([
      {
        name: 'min-rise',
        type: 'int',
        default: 2000,
        help: 'Minimum rising percentage to keep',
      },
    ]);

    const result = await collectOpenTrendsTabsCommand.func?.({} as never, {
      'min-rise': 2500,
    });

    expect(runCollectOpenTrendsTabs).toHaveBeenCalledWith({ minRise: 2500 });
    expect(result).toEqual(expectedEnvelope);
  });
});
