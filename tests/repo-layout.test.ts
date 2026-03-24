import { existsSync } from 'node:fs';
import { ROOT } from './helpers';
import { describe, expect, it } from 'vitest';

describe('repo layout', () => {
  it('contains the vendored plugin and required top-level artifacts', () => {
    expect(existsSync(`${ROOT}/VERSION`)).toBe(true);
    expect(existsSync(`${ROOT}/package.json`)).toBe(true);
    expect(existsSync(`${ROOT}/plugin/opencli-plugin-google-trends-rising/package.json`)).toBe(true);
    expect(existsSync(`${ROOT}/plugin/opencli-plugin-google-trends-rising/collect-open-trends-tabs.ts`)).toBe(true);
  });
});
