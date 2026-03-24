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

    await execa('bash', ['scripts/install.sh'], {
      cwd: ROOT,
      env: { HOME: home, PATH: `${bin}:/usr/bin:/bin`, GOOGLE_TRENDS_SKIP_PLUGIN_BUILD: '1' },
    });

    expect(readFileSync(`${home}/.codex/skills/google-trends-rising-collector/SKILL.md`, 'utf8')).toContain('google-trends-rising-collector');
    expect(readFileSync(`${home}/.codex/skills/google-trends-rising-collector/vendor/opencli-plugin-google-trends-rising/package.json`, 'utf8')).toContain('opencli-plugin-google-trends-rising');
    expect(readFileSync(`${home}/.opencli/plugins/google-trends-rising/package.json`, 'utf8')).toContain('opencli-plugin-google-trends-rising');
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

  it('can repair from the installed skill bundle after the source checkout is unavailable', async () => {
    const home = mkdtempSync(join(tmpdir(), 'gt-install-'));
    const bin = setupFakeBin({ uname: 'Darwin', node: true, npm: true, opencli: true, chrome: true });
    const pluginPackage = `${home}/.opencli/plugins/google-trends-rising/package.json`;
    const staleFile = `${home}/.opencli/plugins/google-trends-rising/stale.txt`;

    await execa('bash', ['scripts/install.sh'], {
      cwd: ROOT,
      env: { HOME: home, PATH: `${bin}:/usr/bin:/bin`, GOOGLE_TRENDS_SKIP_PLUGIN_BUILD: '1' },
    });

    writeFileSync(pluginPackage, 'corrupted plugin package\n');
    writeFileSync(staleFile, 'stale runtime file\n');

    await execa('bash', [`${home}/.codex/skills/google-trends-rising-collector/scripts/install.sh`], {
      cwd: '/',
      env: { HOME: home, PATH: `${bin}:/bin`, GOOGLE_TRENDS_SKIP_PLUGIN_BUILD: '1' },
    });

    expect(readFileSync(pluginPackage, 'utf8')).toContain('opencli-plugin-google-trends-rising');
    expect(existsSync(staleFile)).toBe(false);
  });
});
