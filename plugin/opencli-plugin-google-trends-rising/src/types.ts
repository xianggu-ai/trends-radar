export interface RunConfig {
  minRise: number;
}

export interface ChromeTab {
  windowIndex: number;
  tabIndex: number;
  title: string;
  url: string;
  active: boolean;
}

export interface ExtractedRisingRow {
  query: string;
  value: string;
  rank: number;
  risePct?: number;
  isBreakout: boolean;
}

export interface ExtractedPage {
  scope: RunScope;
  seeds: string[];
  resultsBySeed: Record<string, ExtractedRisingRow[]>;
  blocked: boolean;
  blockReason?: string;
}

export interface CandidateRow {
  seed: string;
  geo: string;
  time: string;
  category: string;
  search_property: string;
  related_query: string;
  rise_pct?: number;
  is_breakout: boolean;
  rank: number;
  captured_at: string;
  source_tab_key: string;
  source_order: number;
}

export interface RunScope {
  geo: string;
  time: string;
  category: string;
  searchProperty: string;
}

export interface MergedRow {
  seed: string;
  geo: string;
  time: string;
  category: string;
  search_property: string;
  related_query: string;
  rise_pct?: number;
  is_breakout: boolean;
  rank: number;
  source_tab_count: number;
  captured_at: string;
}

export type TabStatus =
  | 'ok'
  | 'blocked'
  | 'mismatch_skipped'
  | 'no_data'
  | 'dom_error'
  | 'duplicate_skipped';

export interface TabSummary {
  tab_url: string;
  tab_scope: RunScope | null;
  page_seeds: string[];
  status: TabStatus;
  detail?: string;
}

export interface RunEnvelope {
  run: {
    scope: RunScope | null;
    processedTabs: number;
    capturedAt: string;
  };
  results: MergedRow[];
  tabs: TabSummary[];
}
