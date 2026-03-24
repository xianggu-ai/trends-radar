import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { execa } from 'execa';
import { ROOT, seedInstalledLayout, setupFakeBin } from './helpers';

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
    const bin = setupFakeBin({ uname: 'Darwin', node: true, npm: true, opencli: true, chrome: true, osascript: true });
    const installedDoctorPath = `${home}/.codex/skills/google-trends-rising-collector/scripts/doctor.sh`;

    await execa('bash', ['scripts/install.sh'], {
      cwd: ROOT,
      env: { HOME: home, PATH: `${bin}:/usr/bin:/bin`, GOOGLE_TRENDS_SKIP_PLUGIN_BUILD: '1' },
    });

    expect(existsSync(installedDoctorPath)).toBe(true);
    expect(readFileSync(installedDoctorPath, 'utf8')).toBe(readFileSync(join(ROOT, 'scripts/doctor.sh'), 'utf8'));

    const result = await execa('bash', [installedDoctorPath], {
      all: true,
      cwd: '/',
      env: { HOME: home, PATH: `${bin}:/usr/bin:/bin` },
    });

    expect(result.all).toContain('Doctor OK: install, plugin, and Apple Events probe all look healthy');
  });

  it('fails with a Chrome-specific message when Google Chrome is not installed', async () => {
    const home = seedInstalledLayout();
    const bin = setupFakeBin({ uname: 'Darwin', node: true, npm: true, opencli: true, chrome: false, osascript: true });

    await expectDoctorFailure(
      { HOME: home, PATH: `${bin}:/usr/bin:/bin`, DOCTOR_CHROME_APP_PATH: '/tmp/does-not-exist' },
      'Google Chrome is required',
    );
  });

  it('fails with an actionable message when the collector command is unavailable', async () => {
    const home = seedInstalledLayout();
    const bin = setupFakeBin({ uname: 'Darwin', node: true, npm: true, opencli: 'collector-missing', chrome: true, osascript: true });

    await expectDoctorFailure(
      { HOME: home, PATH: `${bin}:/usr/bin:/bin` },
      'OpenCLI collector command is not available',
    );
  });

  it('fails with Apple Events guidance when the probe cannot execute JavaScript in Chrome', async () => {
    const home = seedInstalledLayout();
    const bin = setupFakeBin({ uname: 'Darwin', node: true, npm: true, opencli: true, chrome: true, osascript: 'probe-fails' });

    await expectDoctorFailure(
      { HOME: home, PATH: `${bin}:/usr/bin:/bin` },
      'Apple Events probe failed. Enable "Allow JavaScript from Apple Events" in Google Chrome Developer settings, then rerun doctor.',
    );
  });

  it('fails with Chrome window guidance when the probe reports no window', async () => {
    const home = seedInstalledLayout();
    const bin = setupFakeBin({ uname: 'Darwin', node: true, npm: true, opencli: true, chrome: true, osascript: 'no-window' });

    await expectDoctorFailure(
      { HOME: home, PATH: `${bin}:/usr/bin:/bin` },
      'Open a Google Chrome window and rerun doctor.',
    );
  });

  it('fails with Apple Events guidance when the probe returns another not-ok reason', async () => {
    const home = seedInstalledLayout();
    const bin = setupFakeBin({ uname: 'Darwin', node: true, npm: true, opencli: true, chrome: true, osascript: 'not-ok' });

    await expectDoctorFailure(
      { HOME: home, PATH: `${bin}:/usr/bin:/bin` },
      'Apple Events probe failed. Enable "Allow JavaScript from Apple Events" in Google Chrome Developer settings, then rerun doctor.',
    );
  });

  it('reports a healthy install when prerequisites and the Apple Events probe succeed', async () => {
    const home = seedInstalledLayout();
    const bin = setupFakeBin({ uname: 'Darwin', node: true, npm: true, opencli: true, chrome: true, osascript: true });

    const result = await execa('bash', ['scripts/doctor.sh'], {
      all: true,
      cwd: ROOT,
      env: { HOME: home, PATH: `${bin}:/usr/bin:/bin` },
    });

    expect(result.all).toContain('Doctor OK: install, plugin, and Apple Events probe all look healthy');
  });
});
