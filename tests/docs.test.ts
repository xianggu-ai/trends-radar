import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ROOT } from './helpers';

const README_PATH = `${ROOT}/README.md`;
const SKILL_PATH = `${ROOT}/skills/trends-radar/SKILL.md`;
const REFERENCES_DIR = `${ROOT}/skills/trends-radar/references`;
const ASSETS_DIR = `${ROOT}/skills/trends-radar/assets`;
const INSTALL_REFERENCE_PATH = `${REFERENCES_DIR}/install.md`;
const COLLECT_REFERENCE_PATH = `${REFERENCES_DIR}/collect.md`;
const ROUND2_REFERENCE_PATH = `${REFERENCES_DIR}/round2.md`;
const GOTCHAS_REFERENCE_PATH = `${REFERENCES_DIR}/gotchas.md`;
const RUNBOOK_REFERENCE_PATH = `${REFERENCES_DIR}/runbook.md`;
const KEEP_EXAMPLE_PATH = `${ASSETS_DIR}/keep.example.json`;
const REJECT_EXAMPLE_PATH = `${ASSETS_DIR}/reject.example.json`;
const CONFIG_EXAMPLE_PATH = `${ASSETS_DIR}/config.example.json`;
const EVALS_PATH = `${ROOT}/evals/evals.json`;

type EvalEntry = {
  name: string;
  prompt: string;
};

type EvalFile = {
  evals: EvalEntry[];
};

function expectContainsAll(body: string, snippets: string[]): void {
  for (const snippet of snippets) {
    expect(body).toContain(snippet);
  }
}

describe('documentation contract', () => {
  it('keeps README bootstrap guidance aligned with the resource-layered packaged workflow', () => {
    expect(existsSync(README_PATH)).toBe(true);

    const readme = readFileSync(README_PATH, 'utf8');

    expectContainsAll(readme, [
      './scripts/install.sh',
      'git pull',
      'collect-open-trends-tabs',
      'Round 2',
      'Round 2 is a Codex Skill step, not an OpenCLI command.',
      'custom OpenCLI plugin',
      'same geo, time, category, and search property',
      'resolve any CAPTCHA or unusual-traffic interstitial manually',
      'run ~/.codex/skills/trends-radar/scripts/doctor.sh',
      '使用 trends-radar 做二轮筛选',
      'Start from the round 1 collector command',
      'opencli google collect-open-trends-tabs --min-rise 2000 -f json',
      'node ~/.codex/skills/trends-radar/scripts/round2-prepare.mjs /path/to/round1.json',
      'round1.keep.json',
      'round1.reject.json',
      'The public Skill name remains `trends-radar`.',
      'Detailed workflow rules and operational gotchas live under `skills/trends-radar/references/`.',
      'Example config and round-2 payloads live under `skills/trends-radar/assets/`.',
    ]);
  });

  it('keeps SKILL.md on the explicit-trigger, thin-entrypoint workflow contract', () => {
    expect(existsSync(SKILL_PATH)).toBe(true);

    const skill = readFileSync(SKILL_PATH, 'utf8');
    expect(skill).toContain('Do not auto-trigger from generic Google Trends requests.');

    expectContainsAll(skill, [
      '使用 trends-radar',
      '使用 trends-radar 做二轮筛选',
      'install',
      'doctor',
      'collect',
      'round2',
      '${CODEX_HOME:-$HOME/.codex}/skills/trends-radar/scripts/doctor.sh',
      '${CODEX_HOME:-$HOME/.codex}/skills/trends-radar/scripts/install.sh',
      '${CODEX_HOME:-$HOME/.codex}/skills/trends-radar/scripts/round2-prepare.mjs',
      'If doctor fails, stop',
      'Read `references/install.md` for install, repair, upgrade, and installed-path details.',
      'Read `references/collect.md` for collection preparation, scope rules, merge semantics, and CAPTCHA handling.',
      'Read `references/round2.md` for the keep/reject contract, output schema, and live-context budget.',
      'Read `references/gotchas.md` for observed failure modes before improvising a fix.',
      'Read `references/runbook.md` to map symptoms to the next remediation step.',
      'Use `assets/config.example.json` as the config shape reference.',
      'Use `assets/keep.example.json` and `assets/reject.example.json` as round-2 output examples.',
    ]);

    expect(skill).not.toContain('Keep output fields:');
    expect(skill).not.toContain('Reject output fields:');
    expect(skill).not.toContain('Allowed `site_type` values:');
    expect(skill).not.toContain('Allowed `reject_reason` values:');
  });

  it('ships focused reference docs for install, collect, round2, gotchas, and runbook guidance', () => {
    expect(existsSync(INSTALL_REFERENCE_PATH)).toBe(true);
    expect(existsSync(COLLECT_REFERENCE_PATH)).toBe(true);
    expect(existsSync(ROUND2_REFERENCE_PATH)).toBe(true);
    expect(existsSync(GOTCHAS_REFERENCE_PATH)).toBe(true);
    expect(existsSync(RUNBOOK_REFERENCE_PATH)).toBe(true);

    const installReference = readFileSync(INSTALL_REFERENCE_PATH, 'utf8');
    expectContainsAll(installReference, [
      'Fresh-machine bootstrap path',
      'Installed repair path',
      'Upgrade path',
      'Expected installed locations',
      '`~/.codex/skills/trends-radar/`',
    ]);

    const collectReference = readFileSync(COLLECT_REFERENCE_PATH, 'utf8');
    expectContainsAll(collectReference, [
      'same geo, time, category, and search property',
      'Resolve any CAPTCHA or unusual-traffic interstitial manually.',
      'merge and dedupe',
      'collector limitations',
    ]);

    const round2Reference = readFileSync(ROUND2_REFERENCE_PATH, 'utf8');
    expectContainsAll(round2Reference, [
      'keep/reject contract',
      'hard cap of three evidence items',
      'site_type',
      'reject_reason',
      '`assets/keep.example.json`',
      '`assets/reject.example.json`',
    ]);

    const gotchasReference = readFileSync(GOTCHAS_REFERENCE_PATH, 'utf8');
    expectContainsAll(gotchasReference, [
      'OpenCLI daemon or bridge instability',
      'Chrome Apple Events JavaScript disabled',
      'mismatched compare-tab scope',
      'CAPTCHA or unusual-traffic interstitials',
      'live extractor DOM drift',
      'repeated seed overlap and result-merge confusion',
      'round-2 false positives and false negatives',
    ]);

    const runbookReference = readFileSync(RUNBOOK_REFERENCE_PATH, 'utf8');
    expectContainsAll(runbookReference, [
      'install problems',
      'doctor failures',
      'collection failures',
      'extractor failures',
      'round-2 input/output problems',
    ]);
  });

  it('ships parseable example assets for keep, reject, and config output shapes', () => {
    expect(existsSync(KEEP_EXAMPLE_PATH)).toBe(true);
    expect(existsSync(REJECT_EXAMPLE_PATH)).toBe(true);
    expect(existsSync(CONFIG_EXAMPLE_PATH)).toBe(true);

    const keepExample = JSON.parse(readFileSync(KEEP_EXAMPLE_PATH, 'utf8')) as {
      keyword: string;
      seeds: string[];
      rise_pct: number;
      site_type: string;
      why: string;
      evidence: string[];
    };
    const rejectExample = JSON.parse(readFileSync(REJECT_EXAMPLE_PATH, 'utf8')) as {
      keyword: string;
      seeds: string[];
      reject_reason: string;
      why: string;
    };
    const configExample = JSON.parse(readFileSync(CONFIG_EXAMPLE_PATH, 'utf8')) as {
      default_geo: string;
      default_time: string;
      default_min_rise: number;
      default_output_format: string;
    };

    expect(keepExample.keyword.length).toBeGreaterThan(0);
    expect(keepExample.seeds.length).toBeGreaterThan(0);
    expect(keepExample.rise_pct).toBeGreaterThan(0);
    expect(keepExample.site_type.length).toBeGreaterThan(0);
    expect(keepExample.why.length).toBeGreaterThan(0);
    expect(keepExample.evidence.length).toBeGreaterThan(0);

    expect(rejectExample.keyword.length).toBeGreaterThan(0);
    expect(rejectExample.seeds.length).toBeGreaterThan(0);
    expect(rejectExample.reject_reason.length).toBeGreaterThan(0);
    expect(rejectExample.why.length).toBeGreaterThan(0);

    expect(configExample.default_geo).toBe('US');
    expect(configExample.default_time).toBe('7d');
    expect(configExample.default_min_rise).toBe(2000);
    expect(configExample.default_output_format).toBe('json');
  });

  it('ships parseable eval prompts covering bootstrap, doctor, collect, and non-trigger scenarios', () => {
    expect(existsSync(EVALS_PATH)).toBe(true);

    const parsed = JSON.parse(readFileSync(EVALS_PATH, 'utf8')) as EvalFile;

    expect(Array.isArray(parsed.evals)).toBe(true);
    expect(parsed.evals.length).toBeGreaterThanOrEqual(6);

    for (const entry of parsed.evals) {
      expect(typeof entry.name).toBe('string');
      expect(entry.name.length).toBeGreaterThan(0);
      expect(typeof entry.prompt).toBe('string');
      expect(entry.prompt.length).toBeGreaterThan(0);
    }

    const byName = new Map(parsed.evals.map((entry) => [entry.name, entry.prompt]));

    expect(byName.get('bootstrap-fresh-macos-machine')).toContain('fresh macOS machine');
    expect(byName.get('doctor-apple-events-remediation')).toContain('JavaScript from Apple Events');
    expect(byName.get('collect-rising-queries')).toContain('collect rising queries');
    expect(byName.get('round2-filter-file')).toContain('二轮筛选');
    expect(byName.get('generic-keyword-filtering-request')).toContain('filter');

    const genericPrompt = byName.get('generic-google-trends-request');
    expect(genericPrompt).toBeDefined();
    expect(genericPrompt).toContain('Google Trends');
    expect(genericPrompt).not.toContain('trends-radar');
    expect(genericPrompt?.toLowerCase()).not.toContain('trigger');
    expect(genericPrompt?.toLowerCase()).not.toContain('skill');
    expect(genericPrompt?.toLowerCase()).not.toContain('workflow');

    const genericFilterPrompt = byName.get('generic-keyword-filtering-request');
    expect(genericFilterPrompt).toBeDefined();
    expect(genericFilterPrompt?.toLowerCase()).toContain('filter');
    expect(genericFilterPrompt).not.toContain('trends-radar');
  });
});
