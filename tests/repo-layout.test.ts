import { existsSync } from 'node:fs';
import { ROOT } from './helpers';
import { describe, expect, it } from 'vitest';

describe('repo layout', () => {
  it('contains the vendored plugin, required top-level artifacts, and skill resource layers', () => {
    expect(existsSync(`${ROOT}/VERSION`)).toBe(true);
    expect(existsSync(`${ROOT}/package.json`)).toBe(true);
    expect(existsSync(`${ROOT}/scripts/round2-prepare.mjs`)).toBe(true);
    expect(existsSync(`${ROOT}/plugin/opencli-plugin-google-trends-rising/package.json`)).toBe(true);
    expect(existsSync(`${ROOT}/plugin/opencli-plugin-google-trends-rising/collect-open-trends-tabs.ts`)).toBe(true);
    expect(existsSync(`${ROOT}/skills/trends-radar/references/install.md`)).toBe(true);
    expect(existsSync(`${ROOT}/skills/trends-radar/references/collect.md`)).toBe(true);
    expect(existsSync(`${ROOT}/skills/trends-radar/references/round2.md`)).toBe(true);
    expect(existsSync(`${ROOT}/skills/trends-radar/references/gotchas.md`)).toBe(true);
    expect(existsSync(`${ROOT}/skills/trends-radar/references/runbook.md`)).toBe(true);
    expect(existsSync(`${ROOT}/skills/trends-radar/assets/keep.example.json`)).toBe(true);
    expect(existsSync(`${ROOT}/skills/trends-radar/assets/reject.example.json`)).toBe(true);
    expect(existsSync(`${ROOT}/skills/trends-radar/assets/config.example.json`)).toBe(true);
  });
});
