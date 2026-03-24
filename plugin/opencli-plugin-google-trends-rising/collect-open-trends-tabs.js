// collect-open-trends-tabs.ts
import { cli, Strategy } from "@jackwener/opencli/registry";

// src/chrome.ts
import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";
var execFile = promisify(execFileCallback);
var LIST_TABS_SCRIPT = `
const chrome = Application('Google Chrome');
const tabs = [];
const windows = chrome.windows();
for (let w = 0; w < windows.length; w++) {
  const window = windows[w];
  const activeTabIndex = Number(window.activeTabIndex());
  const windowTabs = window.tabs();
  for (let t = 0; t < windowTabs.length; t++) {
    const tab = windowTabs[t];
    tabs.push({
      windowIndex: w + 1,
      tabIndex: t + 1,
      title: String(tab.title()),
      url: String(tab.url()),
      active: activeTabIndex === t + 1
    });
  }
}
JSON.stringify(tabs);
`;
async function listChromeTabs(deps = {}) {
  const stdout = await runJxa(LIST_TABS_SCRIPT, deps);
  const parsed = JSON.parse(stdout);
  return parsed.filter((tab) => tab.url.startsWith("https://trends.google.com/trends/explore"));
}
function orderTabsForCollection(tabs) {
  return [...tabs].sort((a, b) => {
    if (a.windowIndex !== b.windowIndex) {
      return a.windowIndex - b.windowIndex;
    }
    return a.tabIndex - b.tabIndex;
  });
}
async function activateChromeTab(tab, deps = {}) {
  await runJxa(
    `
const chrome = Application('Google Chrome');
chrome.activate();
const window = chrome.windows[${tab.windowIndex - 1}];
window.activeTabIndex = ${tab.tabIndex};
`,
    deps
  );
}
async function executeInChromeTab(tab, script, deps = {}) {
  const escapedScript = JSON.stringify(script);
  const stdout = await runJxa(
    `
const chrome = Application('Google Chrome');
const window = chrome.windows[${tab.windowIndex - 1}];
const tab = window.tabs[${tab.tabIndex - 1}];
const result = tab.execute({ javascript: ${escapedScript} });
result;
`,
    deps
  );
  return JSON.parse(stdout);
}
async function clickNextQueryPage(tab, queryIndex, deps = {}) {
  return executeInChromeTab(
    tab,
    `
(() => {
  const nextButtons = Array.from(document.querySelectorAll('button[aria-label="Next"]'))
    .filter((button) => /queries/i.test(button.parentElement?.textContent || ''));
  const button = nextButtons[${queryIndex}];
  if (!button) {
    return JSON.stringify({ clicked: false, reason: 'not_found' });
  }
  if (button.disabled || button.getAttribute('disabled') !== null) {
    return JSON.stringify({ clicked: false, reason: 'disabled' });
  }
  button.click();
  return JSON.stringify({ clicked: true });
})()
`.trim(),
    deps
  );
}
async function runJxa(script, deps) {
  const runtime = {
    execFile,
    ...deps
  };
  try {
    const result = await runtime.execFile("osascript", ["-l", "JavaScript", "-e", script]);
    return result.stdout.trim();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.toLowerCase().includes("not authorized to send apple events")) {
      throw new Error("Automation permission for Google Chrome is required on macOS.");
    }
    if (message.includes("\u5141\u8BB8 Apple \u4E8B\u4EF6\u4E2D\u7684 JavaScript") || message.toLowerCase().includes("apple events")) {
      throw new Error('Enable "Allow JavaScript from Apple Events" in Google Chrome Developer settings.');
    }
    throw error;
  }
}

// src/blocking.ts
function detectBlocking(input) {
  const combined = `${input.html ?? ""}
${input.text ?? ""}`;
  const haystack = combined.toLowerCase();
  if (haystack.includes("unusual traffic") || haystack.includes("our systems have detected")) {
    return { blocked: true, reason: "unusual_traffic" };
  }
  if (haystack.includes("captcha")) {
    return { blocked: true, reason: "captcha" };
  }
  if (haystack.includes("enable javascript") || haystack.includes("please wait while google trends finishes loading") || combined.trim().length === 0) {
    return { blocked: true, reason: "interstitial" };
  }
  return { blocked: false };
}

// src/extract.ts
function buildExtractorScript() {
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
function normalizeExtractedPage(raw) {
  const page = asRecord(raw);
  const scope = normalizeScope(page.scope, page);
  const seeds = normalizeSeeds(page.seeds, page.resultsBySeed, page);
  const textResults = parseResultsBySeedFromText(stringOrUndefined(page.text), seeds);
  const pageInfoBySeed = normalizePageInfoBySeed(page.pageInfoBySeed, stringOrUndefined(page.text), seeds);
  const resultsSource = asRecord(page.resultsBySeed);
  const resultsBySeed = {};
  for (const seed of seeds) {
    const rows = Array.isArray(resultsSource[seed]) ? resultsSource[seed] : textResults[seed] ?? [];
    resultsBySeed[seed] = rows.map((row, index) => normalizeRow(row, index));
  }
  const block = page.blocked === true ? { blocked: true, reason: typeof page.blockReason === "string" ? page.blockReason : "blocked" } : hasBlockingContent(page) ? detectBlocking({
    html: stringOrUndefined(page.html),
    text: stringOrUndefined(page.text)
  }) : { blocked: false };
  return {
    scope,
    seeds,
    resultsBySeed,
    pageInfoBySeed,
    blocked: block.blocked,
    blockReason: block.reason
  };
}
function normalizeScope(raw, page) {
  const scope = asRecord(raw);
  const url = parseUrl(stringOrUndefined(page.url));
  return {
    geo: String(scope.geo ?? url?.searchParams.get("geo") ?? ""),
    time: String(scope.time ?? url?.searchParams.get("date") ?? ""),
    category: String(scope.category ?? url?.searchParams.get("cat") ?? "0"),
    searchProperty: String(scope.searchProperty ?? scope.search_property ?? url?.searchParams.get("gprop") ?? "")
  };
}
function normalizeSeeds(rawSeeds, rawResultsBySeed, page) {
  if (Array.isArray(rawSeeds)) {
    return rawSeeds.map((seed) => String(seed));
  }
  const url = parseUrl(stringOrUndefined(page.url));
  const query = url?.searchParams.get("q");
  if (query) {
    return query.split(",").map((seed) => seed.trim()).filter(Boolean);
  }
  const title = stringOrUndefined(page.title);
  if (title) {
    const titleMatch = title.match(/^(.*?)\s+-\s+Explore\s+-\s+Google Trends$/);
    if (titleMatch?.[1]) {
      return titleMatch[1].split(",").map((seed) => seed.trim()).filter(Boolean);
    }
  }
  return Object.keys(asRecord(rawResultsBySeed));
}
function normalizeRow(raw, index) {
  const row = asRecord(raw);
  const value = String(row.value ?? "");
  const isBreakout = /breakout/i.test(value);
  const riseMatch = value.match(/([0-9][0-9,]*)\s*%/);
  return {
    query: String(row.query ?? ""),
    value,
    rank: Number(row.rank ?? index + 1),
    risePct: isBreakout || !riseMatch ? void 0 : Number(riseMatch[1]?.replace(/,/g, "")),
    isBreakout
  };
}
function asRecord(value) {
  return value !== null && typeof value === "object" ? value : {};
}
function stringOrUndefined(value) {
  return typeof value === "string" ? value : void 0;
}
function hasBlockingContent(value) {
  return typeof value.html === "string" || typeof value.text === "string";
}
function parseUrl(rawUrl) {
  if (!rawUrl) {
    return null;
  }
  try {
    return new URL(rawUrl);
  } catch {
    return null;
  }
}
function parseResultsBySeedFromText(text, seeds) {
  if (!text || seeds.length === 0) {
    return {};
  }
  const normalizedText = normalizePageText(text);
  const sections = findSeedSections(normalizedText, seeds);
  const results = {};
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
function parsePageInfoBySeedFromText(text, seeds) {
  if (!text || seeds.length === 0) {
    return {};
  }
  const normalizedText = normalizePageText(text);
  const sections = findSeedSections(normalizedText, seeds);
  const pageInfoBySeed = {};
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
      total: Number(match[3])
    };
  }
  return pageInfoBySeed;
}
function normalizePageInfoBySeed(rawPageInfo, text, seeds) {
  const explicit = asRecord(rawPageInfo);
  const normalizedExplicit = {};
  for (const seed of seeds) {
    const candidate = asRecord(explicit[seed]);
    if (typeof candidate.shownFrom === "number" && typeof candidate.shownTo === "number" && typeof candidate.total === "number") {
      normalizedExplicit[seed] = {
        shownFrom: candidate.shownFrom,
        shownTo: candidate.shownTo,
        total: candidate.total
      };
    }
  }
  if (Object.keys(normalizedExplicit).length > 0) {
    return normalizedExplicit;
  }
  return parsePageInfoBySeedFromText(text, seeds);
}
function normalizePageText(text) {
  return text.replace(/\r/g, "").replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, "").replace(/\u00a0/g, " ");
}
function findSeedSections(text, seeds) {
  const markers = seeds.map((seed) => ({
    seed,
    index: findSeedMarkerIndex(text, seed)
  })).filter((marker) => marker.index >= 0).sort((left, right) => left.index - right.index);
  const sections = /* @__PURE__ */ new Map();
  for (let index = 0; index < markers.length; index += 1) {
    const current = markers[index];
    const next = markers[index + 1];
    sections.set(current.seed, text.slice(current.index, next?.index ?? text.length));
  }
  return sections;
}
function findSeedMarkerIndex(text, seed) {
  const sectionHeader = `${seed}
Interest by region`;
  if (text.startsWith(sectionHeader)) {
    return 0;
  }
  const index = text.indexOf(`
${sectionHeader}`);
  return index >= 0 ? index + 1 : -1;
}
function parseSeedSection(section) {
  const relatedQueriesIndex = section.indexOf("Related queries");
  if (relatedQueriesIndex < 0) {
    return [];
  }
  let lines = section.slice(relatedQueriesIndex).split("\n").map((line) => line.trim()).filter(Boolean);
  const risingIndex = lines.findIndex((line) => line === "Rising");
  if (risingIndex >= 0) {
    lines = lines.slice(risingIndex + 1);
  }
  const rows = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (isSectionBoundary(line)) {
      break;
    }
    if (!/^\d+$/.test(line)) {
      continue;
    }
    const rank = Number(line);
    let query;
    let value;
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
function isSectionBoundary(line) {
  return /^Showing \d+[–-]\d+ of \d+ queries$/i.test(line) || line === "Related queries";
}
function isControlLine(line) {
  return line === "help_outline" || line === "\u5206\u6790" || line === "Rising" || line === "file_download" || line === "code" || line === "share" || line === "more_vert";
}
function isValueLine(line) {
  return /^Breakout$/i.test(line) || /^\+[0-9][0-9,]*%$/.test(line);
}

// src/merge.ts
function mergeResults(rows, config) {
  const winners = /* @__PURE__ */ new Map();
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
      row.related_query
    ].join("\0");
    const current = winners.get(key);
    if (!current) {
      winners.set(key, {
        winner: row,
        sourceKeys: /* @__PURE__ */ new Set([row.source_tab_key])
      });
      continue;
    }
    current.sourceKeys.add(row.source_tab_key);
    if (compareRows(row, current.winner) < 0) {
      current.winner = row;
    }
  }
  return [...winners.values()].map(({ winner, sourceKeys }) => ({
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
    captured_at: winner.captured_at
  })).sort((left, right) => {
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
function compareRows(left, right) {
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

// src/command.ts
async function runCollectOpenTrendsTabs(config, deps = {}) {
  const runtime = {
    listChromeTabs,
    orderTabsForCollection,
    activateChromeTab,
    clickNextQueryPage,
    executeInChromeTab,
    buildExtractorScript,
    normalizeExtractedPage,
    mergeResults,
    now: () => (/* @__PURE__ */ new Date()).toISOString(),
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    ...deps
  };
  const tabs = runtime.orderTabsForCollection(await runtime.listChromeTabs());
  const summaries = [];
  const candidateRows = [];
  let canonicalScope = null;
  let processedTabs = 0;
  const seenComparePages = /* @__PURE__ */ new Set();
  const extractorScript = runtime.buildExtractorScript();
  for (const [sourceOrder, tab] of tabs.entries()) {
    await runtime.activateChromeTab(tab);
    let extracted;
    try {
      extracted = runtime.normalizeExtractedPage(await runtime.executeInChromeTab(tab, extractorScript));
    } catch (error) {
      summaries.push({
        tab_url: tab.url,
        tab_scope: null,
        page_seeds: [],
        status: "dom_error",
        detail: error instanceof Error ? error.message : String(error)
      });
      continue;
    }
    const summaryBase = {
      tab_url: tab.url,
      tab_scope: extracted.scope,
      page_seeds: extracted.seeds
    };
    if (extracted.blocked) {
      summaries.push({
        ...summaryBase,
        status: "blocked",
        detail: extracted.blockReason
      });
      continue;
    }
    if (!canonicalScope) {
      canonicalScope = extracted.scope;
    }
    if (!scopesEqual(canonicalScope, extracted.scope)) {
      summaries.push({
        ...summaryBase,
        status: "mismatch_skipped"
      });
      continue;
    }
    const compareKey = comparePageKey(extracted);
    if (seenComparePages.has(compareKey)) {
      summaries.push({
        ...summaryBase,
        status: "duplicate_skipped"
      });
      continue;
    }
    seenComparePages.add(compareKey);
    const rows = rowsFromExtractedPage(extracted, tab, sourceOrder, runtime.now());
    processedTabs += 1;
    if (rows.length === 0) {
      summaries.push({
        ...summaryBase,
        status: "no_data"
      });
      continue;
    }
    candidateRows.push(...rows);
    candidateRows.push(...await collectAdditionalQueryPages(extracted, tab, sourceOrder, extractorScript, runtime));
    summaries.push({
      ...summaryBase,
      status: "ok"
    });
  }
  if (!canonicalScope) {
    const detail = summaries.find((summary) => summary.detail)?.detail;
    const suffix = detail ? ` Last tab error: ${detail}` : "";
    throw new Error(`Could not establish canonical scope from any open Google Trends tab.${suffix}`);
  }
  return {
    run: {
      scope: canonicalScope,
      processedTabs,
      capturedAt: runtime.now()
    },
    results: runtime.mergeResults(candidateRows, { minRise: config.minRise }),
    tabs: summaries
  };
}
function rowsFromExtractedPage(extracted, tab, sourceOrder, capturedAt) {
  const rows = [];
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
        source_order: sourceOrder
      });
    }
  }
  return rows;
}
async function collectAdditionalQueryPages(extracted, tab, sourceOrder, extractorScript, runtime) {
  const rows = [];
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
function rowsForSeed(extracted, seed, tab, sourceOrder, capturedAt) {
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
    source_order: sourceOrder
  }));
}
function hasAdditionalQueryPages(pageInfo) {
  return Boolean(pageInfo && pageInfo.shownTo < pageInfo.total);
}
function advancedPage(previous, next) {
  if (!previous || !next) {
    return false;
  }
  return next.shownFrom > previous.shownFrom || next.shownTo > previous.shownTo;
}
function comparePageKey(extracted) {
  return [
    extracted.scope.geo,
    extracted.scope.time,
    extracted.scope.category,
    extracted.scope.searchProperty,
    [...extracted.seeds].sort().join(",")
  ].join("\0");
}
function scopesEqual(left, right) {
  return left.geo === right.geo && left.time === right.time && left.category === right.category && left.searchProperty === right.searchProperty;
}

// collect-open-trends-tabs.ts
var collectOpenTrendsTabsCommand = cli({
  site: "google",
  name: "collect-open-trends-tabs",
  description: "Collect rising related queries from manually opened Google Trends compare tabs",
  strategy: Strategy.PUBLIC,
  browser: false,
  args: [
    {
      name: "min-rise",
      type: "int",
      default: 2e3,
      help: "Minimum rising percentage to keep"
    }
  ],
  func: async (_page, kwargs) => runCollectOpenTrendsTabs(toRunConfig(kwargs))
});
function toRunConfig(kwargs) {
  return {
    minRise: Number(kwargs["min-rise"] ?? 2e3)
  };
}
export {
  collectOpenTrendsTabsCommand
};
