import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { execa } from 'execa';
import { ROOT, setupFakeBin } from './helpers';

describe('install.sh', () => {
  it('copies the skill bundle and plugin into stable runtime locations', async () => {
    const home = mkdtempSync(join(tmpdir(), 'gt-install-'));
    const bin = setupFakeBin({ uname: 'Darwin', node: true, npm: true, opencli: true, chrome: true });
    const installedHelperPath = `${home}/.codex/skills/trends-radar/scripts/round2-prepare.mjs`;

    await execa('bash', ['scripts/install.sh'], {
      cwd: ROOT,
      env: { HOME: home, PATH: `${bin}:/usr/bin:/bin`, GOOGLE_TRENDS_SKIP_PLUGIN_BUILD: '1' },
    });

    expect(readFileSync(`${home}/.codex/skills/trends-radar/SKILL.md`, 'utf8')).toContain('trends-radar');
    expect(readFileSync(`${home}/.codex/skills/trends-radar/vendor/opencli-plugin-google-trends-rising/package.json`, 'utf8')).toContain('opencli-plugin-google-trends-rising');
    expect(readFileSync(`${home}/.opencli/plugins/google-trends-rising/package.json`, 'utf8')).toContain('opencli-plugin-google-trends-rising');
    expect(readFileSync(installedHelperPath, 'utf8')).toBe(readFileSync(join(ROOT, 'scripts/round2-prepare.mjs'), 'utf8'));

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
    const bin = setupFakeBin({ uname: 'Darwin', node: true, npm: true, opencli: true, chrome: true });
    const pluginPackage = `${home}/.opencli/plugins/google-trends-rising/package.json`;
    const staleFile = `${home}/.opencli/plugins/google-trends-rising/stale.txt`;
    const installedHelperPath = `${home}/.codex/skills/trends-radar/scripts/round2-prepare.mjs`;

    await execa('bash', ['scripts/install.sh'], {
      cwd: ROOT,
      env: { HOME: home, PATH: `${bin}:/usr/bin:/bin`, GOOGLE_TRENDS_SKIP_PLUGIN_BUILD: '1' },
    });

    writeFileSync(pluginPackage, 'corrupted plugin package\n');
    writeFileSync(staleFile, 'stale runtime file\n');

    await execa('bash', [`${home}/.codex/skills/trends-radar/scripts/install.sh`], {
      cwd: '/',
      env: { HOME: home, PATH: `${bin}:/bin`, GOOGLE_TRENDS_SKIP_PLUGIN_BUILD: '1' },
    });

    expect(readFileSync(pluginPackage, 'utf8')).toContain('opencli-plugin-google-trends-rising');
    expect(existsSync(staleFile)).toBe(false);
    expect(readFileSync(installedHelperPath, 'utf8')).toBe(readFileSync(join(ROOT, 'scripts/round2-prepare.mjs'), 'utf8'));

    const prepared = await execa('node', [installedHelperPath, join(ROOT, 'tests/fixtures/round2-empty.json')], {
      cwd: '/',
    });

    expect(prepared.stdout).toContain('"rejectPath"');
    expect(prepared.stdout).toContain('"candidates": []');
  });
});
