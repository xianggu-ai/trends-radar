import { chmodSync, existsSync, mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { execa } from 'execa';
import { ROOT, setupFakeBin } from './helpers';

const DEFAULT_CONFIG = {
  default_geo: 'US',
  default_time: '7d',
  default_min_rise: 2000,
  default_output_format: 'json',
};
const REAL_NODE_DIR = dirname(process.execPath);

type UsageRecord = {
  timestamp: string;
  action: string;
  status: string;
  reason?: string;
};

function readUsageLog(home: string): UsageRecord[] {
  return readFileSync(join(home, '.codex/data/trends-radar/usage.jsonl'), 'utf8')
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line) as UsageRecord);
}

describe('install.sh', () => {
  it('copies the full skill bundle and plugin into the configured runtime locations', async () => {
    const home = mkdtempSync(join(tmpdir(), 'gt-install-'));
    const codexHome = `${home}/custom-codex`;
    const opencliHome = `${home}/custom-opencli`;
    const bin = setupFakeBin({ uname: 'Darwin', npm: true, opencli: true, chrome: true });
    const installedRoot = `${codexHome}/skills/trends-radar`;
    const installedHelperPath = `${installedRoot}/scripts/round2-prepare.mjs`;
    const installedInitConfigPath = `${installedRoot}/scripts/init-config.mjs`;
    const installedLogUsagePath = `${installedRoot}/scripts/log-usage.mjs`;
    const stableConfigPath = `${home}/.codex/data/trends-radar/config.json`;

    await execa('bash', ['scripts/install.sh'], {
      cwd: ROOT,
      env: {
        HOME: home,
        PATH: `${bin}:${REAL_NODE_DIR}:/usr/bin:/bin`,
        GOOGLE_TRENDS_SKIP_PLUGIN_BUILD: '1',
        CODEX_HOME: codexHome,
        OPENCLI_HOME: opencliHome,
      },
    });

    expect(readFileSync(`${installedRoot}/SKILL.md`, 'utf8')).toContain('trends-radar');
    expect(readFileSync(`${installedRoot}/vendor/opencli-plugin-google-trends-rising/package.json`, 'utf8')).toContain('opencli-plugin-google-trends-rising');
    expect(readFileSync(`${opencliHome}/plugins/google-trends-rising/package.json`, 'utf8')).toContain('opencli-plugin-google-trends-rising');
    expect(readFileSync(`${installedRoot}/references/install.md`, 'utf8')).toContain('Install Reference');
    expect(readFileSync(`${installedRoot}/references/install.md`, 'utf8')).toContain('malformed JSON');
    expect(readFileSync(`${installedRoot}/references/install.md`, 'utf8')).toContain('fix the file permissions or remove the file manually');
    expect(readFileSync(`${installedRoot}/references/collect.md`, 'utf8')).toContain('Collect Reference');
    expect(readFileSync(`${installedRoot}/references/round2.md`, 'utf8')).toContain('Round 2 Reference');
    expect(readFileSync(`${installedRoot}/references/gotchas.md`, 'utf8')).toContain('Gotchas');
    expect(readFileSync(`${installedRoot}/references/runbook.md`, 'utf8')).toContain('Runbook');
    expect(readFileSync(`${installedRoot}/assets/config.example.json`, 'utf8')).toContain('default_geo');
    expect(readFileSync(`${installedRoot}/assets/keep.example.json`, 'utf8')).toContain('"keyword"');
    expect(readFileSync(`${installedRoot}/assets/reject.example.json`, 'utf8')).toContain('"reject_reason"');
    expect(readFileSync(installedHelperPath, 'utf8')).toBe(readFileSync(join(ROOT, 'scripts/round2-prepare.mjs'), 'utf8'));
    expect(readFileSync(installedInitConfigPath, 'utf8')).toBe(readFileSync(join(ROOT, 'scripts/init-config.mjs'), 'utf8'));
    expect(readFileSync(installedLogUsagePath, 'utf8')).toBe(readFileSync(join(ROOT, 'scripts/log-usage.mjs'), 'utf8'));
    expect(statSync(installedHelperPath).mode & 0o111).not.toBe(0);
    expect(statSync(join(ROOT, 'scripts/round2-prepare.mjs')).mode & 0o111).toBe(0);
    expect(existsSync(`${home}/.codex/data/trends-radar`)).toBe(true);
    expect(JSON.parse(readFileSync(stableConfigPath, 'utf8'))).toEqual(DEFAULT_CONFIG);
    expect(existsSync(`${codexHome}/data/trends-radar/config.json`)).toBe(false);

    expect(readUsageLog(home)).toEqual([
      {
        timestamp: expect.any(String),
        action: 'install',
        status: 'ok',
      },
    ]);

    const prepared = await execa('node', [installedHelperPath, join(ROOT, 'tests/fixtures/round2-input.json')], {
      cwd: '/',
    });

    expect(prepared.stdout).toContain('"keepPath"');
    expect(prepared.stdout).toContain('"candidates"');
  });

  it('fails fast on non-macOS hosts', async () => {
    const home = mkdtempSync(join(tmpdir(), 'gt-install-'));
    const bin = setupFakeBin({ uname: 'Linux', node: true, npm: true, opencli: true, chrome: true });

    await expect(execa('bash', ['scripts/install.sh'], {
      cwd: ROOT,
      env: { HOME: home, PATH: `${bin}:/usr/bin:/bin` },
      reject: true,
    })).rejects.toThrow(/macOS/i);
  });

  it('preserves the installed helper when repairing from the installed skill bundle after the source checkout is unavailable', async () => {
    const home = mkdtempSync(join(tmpdir(), 'gt-install-'));
    const codexHome = `${home}/custom-codex`;
    const opencliHome = `${home}/custom-opencli`;
    const bin = setupFakeBin({ uname: 'Darwin', npm: true, opencli: true, chrome: true });
    const pluginPackage = `${opencliHome}/plugins/google-trends-rising/package.json`;
    const staleFile = `${opencliHome}/plugins/google-trends-rising/stale.txt`;
    const installedRoot = `${codexHome}/skills/trends-radar`;
    const installedHelperPath = `${installedRoot}/scripts/round2-prepare.mjs`;
    const stableConfigPath = `${home}/.codex/data/trends-radar/config.json`;
    const existingConfig = {
      default_geo: 'GB',
      default_time: '30d',
      default_min_rise: 5000,
      default_output_format: 'csv',
      custom_round2_limit: 25,
    };

    await execa('bash', ['scripts/install.sh'], {
      cwd: ROOT,
      env: {
        HOME: home,
        PATH: `${bin}:${REAL_NODE_DIR}:/usr/bin:/bin`,
        GOOGLE_TRENDS_SKIP_PLUGIN_BUILD: '1',
        CODEX_HOME: codexHome,
        OPENCLI_HOME: opencliHome,
      },
    });

    writeFileSync(pluginPackage, 'corrupted plugin package\n');
    writeFileSync(staleFile, 'stale runtime file\n');
    writeFileSync(stableConfigPath, `${JSON.stringify(existingConfig, null, 2)}\n`);

    await execa('bash', [`${installedRoot}/scripts/install.sh`], {
      cwd: '/',
      env: {
        HOME: home,
        PATH: `${bin}:${REAL_NODE_DIR}:/usr/bin:/bin`,
        GOOGLE_TRENDS_SKIP_PLUGIN_BUILD: '1',
        CODEX_HOME: codexHome,
        OPENCLI_HOME: opencliHome,
      },
    });

    expect(readFileSync(pluginPackage, 'utf8')).toContain('opencli-plugin-google-trends-rising');
    expect(existsSync(staleFile)).toBe(false);
    expect(readFileSync(`${installedRoot}/references/install.md`, 'utf8')).toContain('Install Reference');
    expect(readFileSync(`${installedRoot}/assets/config.example.json`, 'utf8')).toContain('default_geo');
    expect(readFileSync(installedHelperPath, 'utf8')).toBe(readFileSync(join(ROOT, 'scripts/round2-prepare.mjs'), 'utf8'));
    expect(statSync(installedHelperPath).mode & 0o111).not.toBe(0);
    expect(statSync(join(ROOT, 'scripts/round2-prepare.mjs')).mode & 0o111).toBe(0);
    expect(JSON.parse(readFileSync(stableConfigPath, 'utf8'))).toEqual(existingConfig);
    expect(readUsageLog(home).map(({ action, status }) => ({ action, status }))).toEqual([
      { action: 'install', status: 'ok' },
      { action: 'install', status: 'ok' },
    ]);

    const prepared = await execa('node', [installedHelperPath, join(ROOT, 'tests/fixtures/round2-empty.json')], {
      cwd: '/',
    });

    expect(prepared.stdout).toContain('"rejectPath"');
    expect(prepared.stdout).toContain('"candidates": []');
  });

  it('repairs a malformed stable config when rerunning the installed installer', async () => {
    const home = mkdtempSync(join(tmpdir(), 'gt-install-'));
    const codexHome = `${home}/custom-codex`;
    const opencliHome = `${home}/custom-opencli`;
    const bin = setupFakeBin({ uname: 'Darwin', npm: true, opencli: true, chrome: true });
    const installedRoot = `${codexHome}/skills/trends-radar`;
    const stableConfigPath = `${home}/.codex/data/trends-radar/config.json`;

    await execa('bash', ['scripts/install.sh'], {
      cwd: ROOT,
      env: {
        HOME: home,
        PATH: `${bin}:${REAL_NODE_DIR}:/usr/bin:/bin`,
        GOOGLE_TRENDS_SKIP_PLUGIN_BUILD: '1',
        CODEX_HOME: codexHome,
        OPENCLI_HOME: opencliHome,
      },
    });

    writeFileSync(stableConfigPath, '{not json}\n');

    await execa('bash', [`${installedRoot}/scripts/install.sh`], {
      cwd: '/',
      env: {
        HOME: home,
        PATH: `${bin}:${REAL_NODE_DIR}:/usr/bin:/bin`,
        GOOGLE_TRENDS_SKIP_PLUGIN_BUILD: '1',
        CODEX_HOME: codexHome,
        OPENCLI_HOME: opencliHome,
      },
    });

    expect(JSON.parse(readFileSync(stableConfigPath, 'utf8'))).toEqual(DEFAULT_CONFIG);
  });

  it('fails with manual remediation guidance when the stable config file cannot be read', async () => {
    const home = mkdtempSync(join(tmpdir(), 'gt-install-'));
    const codexHome = `${home}/custom-codex`;
    const opencliHome = `${home}/custom-opencli`;
    const bin = setupFakeBin({ uname: 'Darwin', npm: true, opencli: true, chrome: true });
    const installedRoot = `${codexHome}/skills/trends-radar`;
    const stableConfigPath = `${home}/.codex/data/trends-radar/config.json`;

    await execa('bash', ['scripts/install.sh'], {
      cwd: ROOT,
      env: {
        HOME: home,
        PATH: `${bin}:${REAL_NODE_DIR}:/usr/bin:/bin`,
        GOOGLE_TRENDS_SKIP_PLUGIN_BUILD: '1',
        CODEX_HOME: codexHome,
        OPENCLI_HOME: opencliHome,
      },
    });

    chmodSync(stableConfigPath, 0o000);

    try {
      await execa('bash', [`${installedRoot}/scripts/install.sh`], {
        all: true,
        cwd: '/',
        env: {
          HOME: home,
          PATH: `${bin}:${REAL_NODE_DIR}:/usr/bin:/bin`,
          GOOGLE_TRENDS_SKIP_PLUGIN_BUILD: '1',
          CODEX_HOME: codexHome,
          OPENCLI_HOME: opencliHome,
        },
        reject: true,
      });
    } catch (error) {
      expect((error as { all?: string }).all?.trim()).toBe(
        `Stable config is unreadable at ${stableConfigPath}. Fix file permissions or remove it, then rerun install.`,
      );
      chmodSync(stableConfigPath, 0o600);
      return;
    }

    chmodSync(stableConfigPath, 0o600);
    throw new Error('install.sh unexpectedly succeeded');
  });
});
