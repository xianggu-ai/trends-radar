import { detectBlocking } from './blocking';
import type { ExtractedPage, ExtractedRisingRow, RunScope } from './types';

export function buildExtractorScript(): string {
  return `
(() => {
  const text = (document.body?.innerText || '').slice(0, 200000);
  return JSON.stringify({
    url: location.href,
    title: document.title,
    text,
  });
})()
`.trim();
}

export function normalizeExtractedPage(raw: unknown): ExtractedPage {
  const page = asRecord(raw);
  const scope = normalizeScope(page.scope, page);
  const seeds = normalizeSeeds(page.seeds, page.resultsBySeed, page);
  const textResults = parseResultsBySeedFromText(stringOrUndefined(page.text), seeds);
  const pageInfoBySeed = normalizePageInfoBySeed(page.pageInfoBySeed, stringOrUndefined(page.text), seeds);
  const resultsSource = asRecord(page.resultsBySeed);
  const resultsBySeed: Record<string, ExtractedRisingRow[]> = {};

  for (const seed of seeds) {
    const rows = Array.isArray(resultsSource[seed]) ? resultsSource[seed] : (textResults[seed] ?? []);
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
    pageInfoBySeed,
    blocked: block.blocked,
    blockReason: block.reason,
  };
}

function normalizeScope(raw: unknown, page: Record<string, unknown>): RunScope {
  const scope = asRecord(raw);
  const url = parseUrl(stringOrUndefined(page.url));

  return {
    geo: String(scope.geo ?? url?.searchParams.get('geo') ?? ''),
    time: String(scope.time ?? url?.searchParams.get('date') ?? ''),
    category: String(scope.category ?? url?.searchParams.get('cat') ?? '0'),
    searchProperty: String(scope.searchProperty ?? scope.search_property ?? url?.searchParams.get('gprop') ?? ''),
  };
}

function normalizeSeeds(
  rawSeeds: unknown,
  rawResultsBySeed: unknown,
  page: Record<string, unknown>,
): string[] {
  if (Array.isArray(rawSeeds)) {
    return rawSeeds.map((seed) => String(seed));
  }

  const url = parseUrl(stringOrUndefined(page.url));
  const query = url?.searchParams.get('q');
  if (query) {
    return query.split(',').map((seed) => seed.trim()).filter(Boolean);
  }

  const title = stringOrUndefined(page.title);
  if (title) {
    const titleMatch = title.match(/^(.*?)\s+-\s+Explore\s+-\s+Google Trends$/);
    if (titleMatch?.[1]) {
      return titleMatch[1].split(',').map((seed) => seed.trim()).filter(Boolean);
    }
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

function parseUrl(rawUrl: string | undefined): URL | null {
  if (!rawUrl) {
    return null;
  }

  try {
    return new URL(rawUrl);
  } catch {
    return null;
  }
}

function parseResultsBySeedFromText(text: string | undefined, seeds: string[]): Record<string, Array<Record<string, unknown>>> {
  if (!text || seeds.length === 0) {
    return {};
  }

  const normalizedText = normalizePageText(text);
  const sections = findSeedSections(normalizedText, seeds);
  const results: Record<string, Array<Record<string, unknown>>> = {};

  for (const seed of seeds) {
    const section = sections.get(seed);
    if (!section) {
      continue;
    }

    const rows = parseSeedSection(section);
    if (rows.length > 0) {
      results[seed] = rows;
    }
  }

  return results;
}

function parsePageInfoBySeedFromText(
  text: string | undefined,
  seeds: string[],
): Record<string, { shownFrom: number; shownTo: number; total: number }> {
  if (!text || seeds.length === 0) {
    return {};
  }

  const normalizedText = normalizePageText(text);
  const sections = findSeedSections(normalizedText, seeds);
  const pageInfoBySeed: Record<string, { shownFrom: number; shownTo: number; total: number }> = {};

  for (const seed of seeds) {
    const section = sections.get(seed);
    if (!section) {
      continue;
    }

    const match = section.match(/Showing\s+(\d+)[–-](\d+)\s+of\s+(\d+)\s+queries/i);
    if (!match) {
      continue;
    }

    pageInfoBySeed[seed] = {
      shownFrom: Number(match[1]),
      shownTo: Number(match[2]),
      total: Number(match[3]),
    };
  }

  return pageInfoBySeed;
}

function normalizePageInfoBySeed(
  rawPageInfo: unknown,
  text: string | undefined,
  seeds: string[],
): Record<string, { shownFrom: number; shownTo: number; total: number }> {
  const explicit = asRecord(rawPageInfo);
  const normalizedExplicit: Record<string, { shownFrom: number; shownTo: number; total: number }> = {};

  for (const seed of seeds) {
    const candidate = asRecord(explicit[seed]);
    if (
      typeof candidate.shownFrom === 'number' &&
      typeof candidate.shownTo === 'number' &&
      typeof candidate.total === 'number'
    ) {
      normalizedExplicit[seed] = {
        shownFrom: candidate.shownFrom,
        shownTo: candidate.shownTo,
        total: candidate.total,
      };
    }
  }

  if (Object.keys(normalizedExplicit).length > 0) {
    return normalizedExplicit;
  }

  return parsePageInfoBySeedFromText(text, seeds);
}

function normalizePageText(text: string): string {
  return text
    .replace(/\r/g, '')
    .replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, '')
    .replace(/\u00a0/g, ' ');
}

function findSeedSections(text: string, seeds: string[]): Map<string, string> {
  const markers = seeds
    .map((seed) => ({
      seed,
      index: findSeedMarkerIndex(text, seed),
    }))
    .filter((marker) => marker.index >= 0)
    .sort((left, right) => left.index - right.index);

  const sections = new Map<string, string>();

  for (let index = 0; index < markers.length; index += 1) {
    const current = markers[index];
    const next = markers[index + 1];
    sections.set(current.seed, text.slice(current.index, next?.index ?? text.length));
  }

  return sections;
}

function findSeedMarkerIndex(text: string, seed: string): number {
  const sectionHeader = `${seed}\nInterest by region`;
  if (text.startsWith(sectionHeader)) {
    return 0;
  }

  const index = text.indexOf(`\n${sectionHeader}`);
  return index >= 0 ? index + 1 : -1;
}

function parseSeedSection(section: string): Array<Record<string, unknown>> {
  const relatedQueriesIndex = section.indexOf('Related queries');
  if (relatedQueriesIndex < 0) {
    return [];
  }

  let lines = section
    .slice(relatedQueriesIndex)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const risingIndex = lines.findIndex((line) => line === 'Rising');
  if (risingIndex >= 0) {
    lines = lines.slice(risingIndex + 1);
  }

  const rows: Array<Record<string, unknown>> = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (isSectionBoundary(line)) {
      break;
    }

    if (!/^\d+$/.test(line)) {
      continue;
    }

    const rank = Number(line);
    let query: string | undefined;
    let value: string | undefined;
    let cursor = index + 1;

    while (cursor < lines.length) {
      const candidate = lines[cursor];
      if (isSectionBoundary(candidate)) {
        break;
      }

      if (isControlLine(candidate)) {
        cursor += 1;
        continue;
      }

      if (!query) {
        if (/^\d+$/.test(candidate)) {
          break;
        }

        query = candidate;
        cursor += 1;
        continue;
      }

      if (isValueLine(candidate)) {
        value = candidate;
        break;
      }

      cursor += 1;
    }

    if (query && value) {
      rows.push({ query, value, rank });
      index = cursor;
    }
  }

  return rows;
}

function isSectionBoundary(line: string): boolean {
  return /^Showing \d+[–-]\d+ of \d+ queries$/i.test(line) || line === 'Related queries';
}

function isControlLine(line: string): boolean {
  return line === 'help_outline' || line === '分析' || line === 'Rising' || line === 'file_download' || line === 'code' || line === 'share' || line === 'more_vert';
}

function isValueLine(line: string): boolean {
  return /^Breakout$/i.test(line) || /^\+[0-9][0-9,]*%$/.test(line);
}
