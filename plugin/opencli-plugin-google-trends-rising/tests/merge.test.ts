import { describe, expect, it } from 'vitest';
import type { CandidateRow } from '../src/types';

function sampleRows(): CandidateRow[] {
  return [
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
      captured_at: '2026-03-23T00:00:00.000Z',
      source_tab_key: 'w1:t1',
      source_order: 0,
    },
    {
      seed: 'agent',
      geo: 'US',
      time: 'now 7-d',
      category: '0',
      search_property: '',
      related_query: 'ghibli style image',
      rise_pct: 5000,
      is_breakout: false,
      rank: 3,
      captured_at: '2026-03-23T00:00:00.000Z',
      source_tab_key: 'w1:t2',
      source_order: 1,
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
      captured_at: '2026-03-23T00:00:00.000Z',
      source_tab_key: 'w1:t1',
      source_order: 0,
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
      rank: 4,
      captured_at: '2026-03-23T00:00:00.000Z',
      source_tab_key: 'w2:t1',
      source_order: 2,
    },
    {
      seed: 'agent',
      geo: 'US',
      time: 'now 7-d',
      category: '0',
      search_property: '',
      related_query: 'agent workflow',
      rise_pct: 1900,
      is_breakout: false,
      rank: 5,
      captured_at: '2026-03-23T00:00:00.000Z',
      source_tab_key: 'w1:t1',
      source_order: 0,
    },
  ];
}

describe('mergeResults', () => {
  it('prefers Breakout, then higher rise_pct, then earlier ordered source tab', async () => {
    const { mergeResults } = await import('../src/merge');

    const merged = mergeResults(sampleRows(), { minRise: 2000 });

    expect(merged).toEqual([
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
    ]);
  });
});
