import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { execa } from 'execa';
import { ROOT } from './helpers';

type UsageRecord = {
  timestamp: string;
  action: string;
  status: string;
  reason?: string;
  counts?: Record<string, number>;
};

function readUsageLog(home: string): UsageRecord[] {
  return readFileSync(join(home, '.codex/data/trends-radar/usage.jsonl'), 'utf8')
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line) as UsageRecord);
}

describe('log-usage.mjs', () => {
  it('appends newline-delimited JSON usage records at the stable path', async () => {
    const home = mkdtempSync(join(tmpdir(), 'gt-log-'));
    const scriptPath = join(ROOT, 'scripts/log-usage.mjs');

    await execa(process.execPath, [scriptPath, 'install', 'ok'], {
      env: { HOME: home },
    });
    await execa(process.execPath, [scriptPath, 'round2', 'error', '--reason', 'no_candidates', '--counts', '{"kept":0,"rejected":0}'], {
      env: { HOME: home },
    });

    const usagePath = join(home, '.codex/data/trends-radar/usage.jsonl');
    expect(existsSync(usagePath)).toBe(true);

    const raw = readFileSync(usagePath, 'utf8');
    expect(raw.endsWith('\n')).toBe(true);

    const [installRecord, round2Record] = readUsageLog(home);

    expect(installRecord).toEqual({
      timestamp: expect.any(String),
      action: 'install',
      status: 'ok',
    });
    expect(round2Record).toEqual({
      timestamp: expect.any(String),
      action: 'round2',
      status: 'error',
      reason: 'no_candidates',
      counts: {
        kept: 0,
        rejected: 0,
      },
    });
  });
});
