import { activateChromeTab, clickNextQueryPage, executeInChromeTab, listChromeTabs, orderTabsForCollection } from './chrome';
import { buildExtractorScript, normalizeExtractedPage } from './extract';
import { mergeResults } from './merge';
import type { CandidateRow, ChromeTab, ExtractedPage, RunConfig, RunEnvelope, RunScope, TabSummary } from './types';

interface RunDeps {
  listChromeTabs: typeof listChromeTabs;
  orderTabsForCollection: typeof orderTabsForCollection;
  activateChromeTab: typeof activateChromeTab;
  clickNextQueryPage: typeof clickNextQueryPage;
  executeInChromeTab: typeof executeInChromeTab;
  buildExtractorScript: typeof buildExtractorScript;
  normalizeExtractedPage: typeof normalizeExtractedPage;
  mergeResults: typeof mergeResults;
  now: () => string;
  sleep: (ms: number) => Promise<void>;
}

export async function runCollectOpenTrendsTabs(
  config: RunConfig,
  deps: Partial<RunDeps> = {},
): Promise<RunEnvelope> {
  const runtime: RunDeps = {
    listChromeTabs,
    orderTabsForCollection,
    activateChromeTab,
    clickNextQueryPage,
    executeInChromeTab,
    buildExtractorScript,
    normalizeExtractedPage,
    mergeResults,
    now: () => new Date().toISOString(),
    sleep: (ms: number) => new Promise((resolve) => setTimeout(resolve, ms)),
    ...deps,
  };
  const tabs = runtime.orderTabsForCollection(await runtime.listChromeTabs());
  const summaries: TabSummary[] = [];
  const candidateRows: CandidateRow[] = [];
  let canonicalScope: RunScope | null = null;
  let processedTabs = 0;
  const seenComparePages = new Set<string>();
  const extractorScript = runtime.buildExtractorScript();

  for (const [sourceOrder, tab] of tabs.entries()) {
    await runtime.activateChromeTab(tab);

    let extracted: ExtractedPage;
    try {
      extracted = runtime.normalizeExtractedPage(await runtime.executeInChromeTab(tab, extractorScript));
    } catch (error) {
      summaries.push({
        tab_url: tab.url,
        tab_scope: null,
        page_seeds: [],
        status: 'dom_error',
        detail: error instanceof Error ? error.message : String(error),
      });
      continue;
    }

    const summaryBase = {
      tab_url: tab.url,
      tab_scope: extracted.scope,
      page_seeds: extracted.seeds,
    };

    if (extracted.blocked) {
      summaries.push({
        ...summaryBase,
        status: 'blocked',
        detail: extracted.blockReason,
      });
      continue;
    }

    if (!canonicalScope) {
      canonicalScope = extracted.scope;
    }

    if (!scopesEqual(canonicalScope, extracted.scope)) {
      summaries.push({
        ...summaryBase,
        status: 'mismatch_skipped',
      });
      continue;
    }

    const compareKey = comparePageKey(extracted);
    if (seenComparePages.has(compareKey)) {
      summaries.push({
        ...summaryBase,
        status: 'duplicate_skipped',
      });
      continue;
    }
    seenComparePages.add(compareKey);

    const rows = rowsFromExtractedPage(extracted, tab, sourceOrder, runtime.now());
    processedTabs += 1;

    if (rows.length === 0) {
      summaries.push({
        ...summaryBase,
        status: 'no_data',
      });
      continue;
    }

    candidateRows.push(...rows);
    candidateRows.push(...(await collectAdditionalQueryPages(extracted, tab, sourceOrder, extractorScript, runtime)));
    summaries.push({
      ...summaryBase,
      status: 'ok',
    });
  }

  if (!canonicalScope) {
    const detail = summaries.find((summary) => summary.detail)?.detail;
    const suffix = detail ? ` Last tab error: ${detail}` : '';
    throw new Error(`Could not establish canonical scope from any open Google Trends tab.${suffix}`);
  }

  return {
    run: {
      scope: canonicalScope,
      processedTabs,
      capturedAt: runtime.now(),
    },
    results: runtime.mergeResults(candidateRows, { minRise: config.minRise }),
    tabs: summaries,
  };
}

function rowsFromExtractedPage(
  extracted: ExtractedPage,
  tab: ChromeTab,
  sourceOrder: number,
  capturedAt: string,
): CandidateRow[] {
  const rows: CandidateRow[] = [];
  const sourceTabKey = `${tab.windowIndex}:${tab.tabIndex}`;

  for (const seed of extracted.seeds) {
    for (const row of extracted.resultsBySeed[seed] ?? []) {
      rows.push({
        seed,
        geo: extracted.scope.geo,
        time: extracted.scope.time,
        category: extracted.scope.category,
        search_property: extracted.scope.searchProperty,
        related_query: row.query,
        rise_pct: row.risePct,
        is_breakout: row.isBreakout,
        rank: row.rank,
        captured_at: capturedAt,
        source_tab_key: sourceTabKey,
        source_order: sourceOrder,
      });
    }
  }

  return rows;
}

async function collectAdditionalQueryPages(
  extracted: ExtractedPage,
  tab: ChromeTab,
  sourceOrder: number,
  extractorScript: string,
  runtime: RunDeps,
): Promise<CandidateRow[]> {
  const rows: CandidateRow[] = [];

  for (const [seedIndex, seed] of extracted.seeds.entries()) {
    let pageInfo = extracted.pageInfoBySeed[seed];
    let guard = 0;

    while (hasAdditionalQueryPages(pageInfo) && guard < 20) {
      const clickResult = await runtime.clickNextQueryPage(tab, seedIndex);
      if (!clickResult.clicked) {
        break;
      }

      await runtime.sleep(250);
      const nextPage = runtime.normalizeExtractedPage(await runtime.executeInChromeTab(tab, extractorScript));
      const nextInfo = nextPage.pageInfoBySeed[seed];
      if (!advancedPage(pageInfo, nextInfo)) {
        break;
      }

      rows.push(...rowsForSeed(nextPage, seed, tab, sourceOrder, runtime.now()));
      pageInfo = nextInfo;
      guard += 1;
    }
  }

  return rows;
}

function rowsForSeed(
  extracted: ExtractedPage,
  seed: string,
  tab: ChromeTab,
  sourceOrder: number,
  capturedAt: string,
): CandidateRow[] {
  const sourceTabKey = `${tab.windowIndex}:${tab.tabIndex}`;

  return (extracted.resultsBySeed[seed] ?? []).map((row) => ({
    seed,
    geo: extracted.scope.geo,
    time: extracted.scope.time,
    category: extracted.scope.category,
    search_property: extracted.scope.searchProperty,
    related_query: row.query,
    rise_pct: row.risePct,
    is_breakout: row.isBreakout,
    rank: row.rank,
    captured_at: capturedAt,
    source_tab_key: sourceTabKey,
    source_order: sourceOrder,
  }));
}

function hasAdditionalQueryPages(pageInfo: ExtractedPage['pageInfoBySeed'][string] | undefined): boolean {
  return Boolean(pageInfo && pageInfo.shownTo < pageInfo.total);
}

function advancedPage(
  previous: ExtractedPage['pageInfoBySeed'][string] | undefined,
  next: ExtractedPage['pageInfoBySeed'][string] | undefined,
): boolean {
  if (!previous || !next) {
    return false;
  }

  return next.shownFrom > previous.shownFrom || next.shownTo > previous.shownTo;
}

function comparePageKey(extracted: ExtractedPage): string {
  return [
    extracted.scope.geo,
    extracted.scope.time,
    extracted.scope.category,
    extracted.scope.searchProperty,
    [...extracted.seeds].sort().join(','),
  ].join('\u0000');
}

function scopesEqual(left: RunScope, right: RunScope): boolean {
  return (
    left.geo === right.geo &&
    left.time === right.time &&
    left.category === right.category &&
    left.searchProperty === right.searchProperty
  );
}
