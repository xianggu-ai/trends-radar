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
async function executeInChromeTab(script, deps = {}) {
  const escapedScript = JSON.stringify(script);
  const stdout = await runJxa(
    `
const chrome = Application('Google Chrome');
const window = chrome.windows[0];
const tab = window.activeTab();
const result = tab.execute({ javascript: ${escapedScript} });
result;
`,
    deps
  );
  return JSON.parse(stdout);
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
  const resultsBySeed = {};
  // Walk the Google Trends "Related queries" UI and capture Rising rows.
  const sectionLabel = 'Related queries';
  return JSON.stringify({ sectionLabel, resultsBySeed });
})()
`.trim();
}
function normalizeExtractedPage(raw) {
  const page = asRecord(raw);
  const scope = normalizeScope(page.scope);
  const seeds = normalizeSeeds(page.seeds, page.resultsBySeed);
  const resultsSource = asRecord(page.resultsBySeed);
  const resultsBySeed = {};
  for (const seed of seeds) {
    const rows = Array.isArray(resultsSource[seed]) ? resultsSource[seed] : [];
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
    blocked: block.blocked,
    blockReason: block.reason
  };
}
function normalizeScope(raw) {
  const scope = asRecord(raw);
  return {
    geo: String(scope.geo ?? ""),
    time: String(scope.time ?? ""),
    category: String(scope.category ?? "0"),
    searchProperty: String(scope.searchProperty ?? scope.search_property ?? "")
  };
}
function normalizeSeeds(rawSeeds, rawResultsBySeed) {
  if (Array.isArray(rawSeeds)) {
    return rawSeeds.map((seed) => String(seed));
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
    executeInChromeTab,
    buildExtractorScript,
    normalizeExtractedPage,
    mergeResults,
    now: () => (/* @__PURE__ */ new Date()).toISOString(),
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
      extracted = runtime.normalizeExtractedPage(await runtime.executeInChromeTab(extractorScript));
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
