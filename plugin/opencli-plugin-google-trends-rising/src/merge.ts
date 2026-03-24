import type { CandidateRow, MergedRow } from './types';

export function mergeResults(rows: CandidateRow[], config: { minRise: number }): MergedRow[] {
  const winners = new Map<
    string,
    {
      winner: CandidateRow;
      sourceKeys: Set<string>;
    }
  >();

  for (const row of rows) {
    if (!row.is_breakout && (row.rise_pct ?? Number.NEGATIVE_INFINITY) <= config.minRise) {
      continue;
    }

    const key = [
      row.seed,
      row.geo,
      row.time,
      row.category,
      row.search_property,
      row.related_query,
    ].join('\u0000');
    const current = winners.get(key);

    if (!current) {
      winners.set(key, {
        winner: row,
        sourceKeys: new Set([row.source_tab_key]),
      });
      continue;
    }

    current.sourceKeys.add(row.source_tab_key);

    if (compareRows(row, current.winner) < 0) {
      current.winner = row;
    }
  }

  return [...winners.values()]
    .map(({ winner, sourceKeys }) => ({
      seed: winner.seed,
      geo: winner.geo,
      time: winner.time,
      category: winner.category,
      search_property: winner.search_property,
      related_query: winner.related_query,
      rise_pct: winner.rise_pct,
      is_breakout: winner.is_breakout,
      rank: winner.rank,
      source_tab_count: sourceKeys.size,
      captured_at: winner.captured_at,
    }))
    .sort((left, right) => {
      if (left.seed !== right.seed) {
        return left.seed.localeCompare(right.seed);
      }
      if (left.is_breakout !== right.is_breakout) {
        return left.is_breakout ? -1 : 1;
      }
      if ((right.rise_pct ?? Number.NEGATIVE_INFINITY) !== (left.rise_pct ?? Number.NEGATIVE_INFINITY)) {
        return (right.rise_pct ?? Number.NEGATIVE_INFINITY) - (left.rise_pct ?? Number.NEGATIVE_INFINITY);
      }
      if (left.rank !== right.rank) {
        return left.rank - right.rank;
      }
      return left.related_query.localeCompare(right.related_query);
    });
}

function compareRows(left: CandidateRow, right: CandidateRow): number {
  if (left.is_breakout !== right.is_breakout) {
    return left.is_breakout ? -1 : 1;
  }

  const riseDiff = (right.rise_pct ?? Number.NEGATIVE_INFINITY) - (left.rise_pct ?? Number.NEGATIVE_INFINITY);
  if (riseDiff !== 0) {
    return riseDiff;
  }

  if (left.source_order !== right.source_order) {
    return left.source_order - right.source_order;
  }

  if (left.rank !== right.rank) {
    return left.rank - right.rank;
  }

  return left.related_query.localeCompare(right.related_query);
}
