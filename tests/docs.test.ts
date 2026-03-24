import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ROOT } from './helpers';

const README_PATH = `${ROOT}/README.md`;
const SKILL_PATH = `${ROOT}/skills/trends-radar/SKILL.md`;
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
  it('keeps README bootstrap, upgrade, collection-prep, and troubleshooting guidance aligned with the packaged workflow', () => {
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
    ]);
  });

  it('keeps SKILL.md on the explicit-trigger, state-driven workflow contract', () => {
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
      'source_context',
      'If doctor fails, stop',
      'On a fresh machine, install happens from README.md plus scripts/install.sh',
      'If the plugin is missing or damaged on an already-installed machine',
      'same geo, time, category, and search property',
      'Resolve any CAPTCHA or unusual-traffic interstitial manually',
      'opencli google collect-open-trends-tabs --min-rise 2000 -f json',
      'tool',
      'game',
      'content',
      'mixed',
      'short_term_event',
      'noise',
      'not_siteable',
      'too_broad',
      'navigational',
      'write `[]` to both output files',
      'Write bare-array JSON outputs',
      'Keep output fields:',
      'Reject output fields:',
      'keyword',
      'seeds',
      'rise_pct',
      'site_type',
      'why',
      'evidence',
      'reject_reason',
      'hard cap of three evidence items',
      'If live context is unavailable, continue with first-stage context only',
      "include one short fallback note inside the kept row's `evidence` array",
      'no candidates were available for round 2',
    ]);
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
