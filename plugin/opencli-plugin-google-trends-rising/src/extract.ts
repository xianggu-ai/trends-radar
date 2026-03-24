import { detectBlocking } from './blocking';
import type { ExtractedPage, ExtractedRisingRow, RunScope } from './types';

export function buildExtractorScript(): string {
  return `
(() => {
  const resultsBySeed = {};
  // Walk the Google Trends "Related queries" UI and capture Rising rows.
  const sectionLabel = 'Related queries';
  return JSON.stringify({ sectionLabel, resultsBySeed });
})()
`.trim();
}

export function normalizeExtractedPage(raw: unknown): ExtractedPage {
  const page = asRecord(raw);
  const scope = normalizeScope(page.scope);
  const seeds = normalizeSeeds(page.seeds, page.resultsBySeed);
  const resultsSource = asRecord(page.resultsBySeed);
  const resultsBySeed: Record<string, ExtractedRisingRow[]> = {};

  for (const seed of seeds) {
    const rows = Array.isArray(resultsSource[seed]) ? resultsSource[seed] : [];
    resultsBySeed[seed] = rows.map((row, index) => normalizeRow(row, index));
  }

  const block = page.blocked === true
    ? { blocked: true, reason: typeof page.blockReason === 'string' ? page.blockReason : 'blocked' }
    : hasBlockingContent(page)
      ? detectBlocking({
          html: stringOrUndefined(page.html),
          text: stringOrUndefined(page.text),
        })
      : { blocked: false };

  return {
    scope,
    seeds,
    resultsBySeed,
    blocked: block.blocked,
    blockReason: block.reason,
  };
}

function normalizeScope(raw: unknown): RunScope {
  const scope = asRecord(raw);

  return {
    geo: String(scope.geo ?? ''),
    time: String(scope.time ?? ''),
    category: String(scope.category ?? '0'),
    searchProperty: String(scope.searchProperty ?? scope.search_property ?? ''),
  };
}

function normalizeSeeds(rawSeeds: unknown, rawResultsBySeed: unknown): string[] {
  if (Array.isArray(rawSeeds)) {
    return rawSeeds.map((seed) => String(seed));
  }

  return Object.keys(asRecord(rawResultsBySeed));
}

function normalizeRow(raw: unknown, index: number): ExtractedRisingRow {
  const row = asRecord(raw);
  const value = String(row.value ?? '');
  const isBreakout = /breakout/i.test(value);
  const riseMatch = value.match(/([0-9][0-9,]*)\s*%/);

  return {
    query: String(row.query ?? ''),
    value,
    rank: Number(row.rank ?? index + 1),
    risePct: isBreakout || !riseMatch ? undefined : Number(riseMatch[1]?.replace(/,/g, '')),
    isBreakout,
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function stringOrUndefined(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function hasBlockingContent(value: Record<string, unknown>): boolean {
  return typeof value.html === 'string' || typeof value.text === 'string';
}
