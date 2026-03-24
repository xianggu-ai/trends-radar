import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { execa } from 'execa';
import { ROOT, seedInstalledLayout, setupFakeBin } from './helpers';

const DEFAULT_CONFIG = {
  default_geo: 'US',
  default_time: '7d',
  default_min_rise: 2000,
  default_output_format: 'json',
};
const REAL_NODE_DIR = dirname(process.execPath);

function seedStableConfig(home: string, config: Record<string, unknown> = DEFAULT_CONFIG): void {
  const configDir = join(home, '.codex/data/trends-radar');
  mkdirSync(configDir, { recursive: true });
  writeFileSync(join(configDir, 'config.json'), `${JSON.stringify(config, null, 2)}\n`);
}

async function expectDoctorFailure(
  env: Record<string, string>,
  expectedOutput: string,
): Promise<void> {
  try {
    await execa('bash', ['scripts/doctor.sh'], {
      all: true,
      cwd: ROOT,
      env,
      reject: true,
    });
  } catch (error) {
    expect((error as { all?: string }).all?.trim()).toBe(expectedOutput);
    return;
  }

  throw new Error('doctor.sh unexpectedly succeeded');
}

describe('doctor.sh', () => {
  it('runs from the installed skill bundle after install.sh copies doctor.sh into place', async () => {
    const home = mkdtempSync(join(tmpdir(), 'gt-install-'));
    const bin = setupFakeBin({ uname: 'Darwin', npm: true, opencli: true, chrome: true, osascript: true });
    const installedDoctorPath = `${home}/.codex/skills/trends-radar/scripts/doctor.sh`;

    await execa('bash', ['scripts/install.sh'], {
      cwd: ROOT,
      env: { HOME: home, PATH: `${bin}:${REAL_NODE_DIR}:/usr/bin:/bin`, GOOGLE_TRENDS_SKIP_PLUGIN_BUILD: '1' },
    });

    expect(existsSync(installedDoctorPath)).toBe(true);
    expect(readFileSync(installedDoctorPath, 'utf8')).toBe(readFileSync(join(ROOT, 'scripts/doctor.sh'), 'utf8'));

    const result = await execa('bash', [installedDoctorPath], {
      all: true,
      cwd: '/',
      env: { HOME: home, PATH: `${bin}:${REAL_NODE_DIR}:/usr/bin:/bin` },
    });

    expect(result.all).toContain('Doctor OK: install, plugin, and Apple Events probe all look healthy');
  });

  it('fails with install guidance when stable runtime data has not been initialized', async () => {
    const home = seedInstalledLayout();
    const bin = setupFakeBin({ uname: 'Darwin', npm: true, opencli: true, chrome: true, osascript: true });

    await expectDoctorFailure(
      { HOME: home, PATH: `${bin}:${REAL_NODE_DIR}:/usr/bin:/bin` },
      `Stable data directory is missing at ${home}/.codex/data/trends-radar. Run ${home}/.codex/skills/trends-radar/scripts/install.sh to initialize it.`,
    );
  });

  it('fails with install guidance when the stable config is malformed JSON', async () => {
    const home = seedInstalledLayout();
    const bin = setupFakeBin({ uname: 'Darwin', npm: true, opencli: true, chrome: true, osascript: true });
    const configDir = join(home, '.codex/data/trends-radar');

    mkdirSync(configDir, { recursive: true });
    writeFileSync(join(configDir, 'config.json'), '{not json}\n');

    await expectDoctorFailure(
      { HOME: home, PATH: `${bin}:${REAL_NODE_DIR}:/usr/bin:/bin` },
      `Stable config is malformed at ${home}/.codex/data/trends-radar/config.json. Run ${home}/.codex/skills/trends-radar/scripts/install.sh to repair it.`,
    );
  });

  it('fails with manual remediation guidance when the stable config file cannot be read', async () => {
    const home = seedInstalledLayout();
    const bin = setupFakeBin({ uname: 'Darwin', npm: true, opencli: true, chrome: true, osascript: true });
    const configDir = join(home, '.codex/data/trends-radar');
    const configPath = join(configDir, 'config.json');

    mkdirSync(configDir, { recursive: true });
    writeFileSync(configPath, `${JSON.stringify(DEFAULT_CONFIG, null, 2)}\n`);
    chmodSync(configPath, 0o000);

    try {
      await expectDoctorFailure(
        { HOME: home, PATH: `${bin}:${REAL_NODE_DIR}:/usr/bin:/bin` },
        `Stable config is unreadable at ${home}/.codex/data/trends-radar/config.json. Fix file permissions or remove it, then rerun ${home}/.codex/skills/trends-radar/scripts/install.sh.`,
      );
    } finally {
      chmodSync(configPath, 0o600);
    }
  });

  it('fails with install guidance when the stable config is missing', async () => {
    const home = seedInstalledLayout();
    const bin = setupFakeBin({ uname: 'Darwin', npm: true, opencli: true, chrome: true, osascript: true });

    mkdirSync(join(home, '.codex/data/trends-radar'), { recursive: true });

    await expectDoctorFailure(
      { HOME: home, PATH: `${bin}:${REAL_NODE_DIR}:/usr/bin:/bin` },
      `Stable config is missing at ${home}/.codex/data/trends-radar/config.json. Run ${home}/.codex/skills/trends-radar/scripts/install.sh to initialize it.`,
    );
  });

  it('fails with a Chrome-specific message when Google Chrome is not installed', async () => {
    const home = seedInstalledLayout();
    const bin = setupFakeBin({ uname: 'Darwin', npm: true, opencli: true, chrome: false, osascript: true });

    await expectDoctorFailure(
      { HOME: home, PATH: `${bin}:${REAL_NODE_DIR}:/usr/bin:/bin`, DOCTOR_CHROME_APP_PATH: '/tmp/does-not-exist' },
      'Google Chrome is required',
    );
  });

  it('fails with an actionable message when the collector command is unavailable', async () => {
    const home = seedInstalledLayout();
    const bin = setupFakeBin({ uname: 'Darwin', npm: true, opencli: 'collector-missing', chrome: true, osascript: true });
    seedStableConfig(home);

    await expectDoctorFailure(
      { HOME: home, PATH: `${bin}:${REAL_NODE_DIR}:/usr/bin:/bin` },
      'OpenCLI collector command is not available',
    );
  });

  it('fails with Apple Events guidance when the probe cannot execute JavaScript in Chrome', async () => {
    const home = seedInstalledLayout();
    const bin = setupFakeBin({ uname: 'Darwin', npm: true, opencli: true, chrome: true, osascript: 'probe-fails' });
    seedStableConfig(home);

    await expectDoctorFailure(
      { HOME: home, PATH: `${bin}:${REAL_NODE_DIR}:/usr/bin:/bin` },
      'Apple Events probe failed. Enable "Allow JavaScript from Apple Events" in Google Chrome Developer settings, then rerun doctor.',
    );
  });

  it('fails with Chrome window guidance when the probe reports no window', async () => {
    const home = seedInstalledLayout();
    const bin = setupFakeBin({ uname: 'Darwin', npm: true, opencli: true, chrome: true, osascript: 'no-window' });
    seedStableConfig(home);

    await expectDoctorFailure(
      { HOME: home, PATH: `${bin}:${REAL_NODE_DIR}:/usr/bin:/bin` },
      'Open a Google Chrome window and rerun doctor.',
    );
  });

  it('fails with Apple Events guidance when the probe returns another not-ok reason', async () => {
    const home = seedInstalledLayout();
    const bin = setupFakeBin({ uname: 'Darwin', npm: true, opencli: true, chrome: true, osascript: 'not-ok' });
    seedStableConfig(home);

    await expectDoctorFailure(
      { HOME: home, PATH: `${bin}:${REAL_NODE_DIR}:/usr/bin:/bin` },
      'Apple Events probe failed. Enable "Allow JavaScript from Apple Events" in Google Chrome Developer settings, then rerun doctor.',
    );
  });

  it('reports a healthy install when prerequisites and the Apple Events probe succeed', async () => {
    const home = seedInstalledLayout();
    const bin = setupFakeBin({ uname: 'Darwin', npm: true, opencli: true, chrome: true, osascript: true });
    seedStableConfig(home);

    const result = await execa('bash', ['scripts/doctor.sh'], {
      all: true,
      cwd: ROOT,
      env: { HOME: home, PATH: `${bin}:${REAL_NODE_DIR}:/usr/bin:/bin` },
    });

    expect(result.all).toContain('Doctor OK: install, plugin, and Apple Events probe all look healthy');
  });
});
