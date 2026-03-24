import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { execa } from 'execa';
import { ROOT } from './helpers';

const DEFAULT_CONFIG = {
  default_geo: 'US',
  default_time: '7d',
  default_min_rise: 2000,
  default_output_format: 'json',
};

describe('init-config.mjs', () => {
  it('creates the stable config under ~/.codex/data/trends-radar with the expected defaults', async () => {
    const home = mkdtempSync(join(tmpdir(), 'gt-config-'));
    const customCodexHome = `${home}/custom-codex`;
    const configPath = `${home}/.codex/data/trends-radar/config.json`;

    const result = await execa('node', ['scripts/init-config.mjs'], {
      cwd: ROOT,
      env: { HOME: home, CODEX_HOME: customCodexHome },
    });

    expect(result.stdout.trim()).toBe(configPath);
    expect(existsSync(configPath)).toBe(true);
    expect(JSON.parse(readFileSync(configPath, 'utf8'))).toEqual(DEFAULT_CONFIG);
    expect(existsSync(`${customCodexHome}/data/trends-radar/config.json`)).toBe(false);
  });

  it('preserves an existing config on rerun', async () => {
    const home = mkdtempSync(join(tmpdir(), 'gt-config-'));
    const configPath = `${home}/.codex/data/trends-radar/config.json`;
    const existingConfig = {
      default_geo: 'GB',
      default_time: '30d',
      default_min_rise: 5000,
      default_output_format: 'csv',
      custom_round2_limit: 25,
    };

    await execa('node', ['scripts/init-config.mjs'], {
      cwd: ROOT,
      env: { HOME: home },
    });

    writeFileSync(configPath, `${JSON.stringify(existingConfig, null, 2)}\n`);

    const rerun = await execa('node', ['scripts/init-config.mjs'], {
      cwd: ROOT,
      env: { HOME: home },
    });

    expect(rerun.stdout.trim()).toBe(configPath);
    expect(JSON.parse(readFileSync(configPath, 'utf8'))).toEqual(existingConfig);
  });

  it('replaces an unreadable config with the default payload', async () => {
    const home = mkdtempSync(join(tmpdir(), 'gt-config-'));
    const configPath = `${home}/.codex/data/trends-radar/config.json`;

    await execa('node', ['scripts/init-config.mjs'], {
      cwd: ROOT,
      env: { HOME: home },
    });

    writeFileSync(configPath, '{not json}\n');

    const repaired = await execa('node', ['scripts/init-config.mjs'], {
      cwd: ROOT,
      env: { HOME: home },
    });

    expect(repaired.stdout.trim()).toBe(configPath);
    expect(JSON.parse(readFileSync(configPath, 'utf8'))).toEqual(DEFAULT_CONFIG);
  });
});
