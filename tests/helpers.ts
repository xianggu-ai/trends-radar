import { chmodSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

function writeExecutable(target: string, body: string): void {
  writeFileSync(target, body);
  chmodSync(target, 0o755);
}

type FakeBinMode = boolean | string;

function buildScript(name: string, mode: FakeBinMode): string {
  if (name === 'uname') {
    return `#!/usr/bin/env bash\necho "${mode}"\n`;
  }

  if (name === 'opencli' && mode === 'collector-missing') {
    return `#!/usr/bin/env bash
if [ "\${1:-}" = "google" ] && [ "\${2:-}" = "collect-open-trends-tabs" ] && [ "\${3:-}" = "--help" ]; then
  echo "collector command missing" >&2
  exit 1
fi
exit 0
`;
  }

  if (name === 'osascript') {
    if (mode === 'probe-fails') {
      return '#!/usr/bin/env bash\necho "Apple Events probe failed" >&2\nexit 1\n';
    }

    if (mode === 'no-window') {
      return '#!/usr/bin/env bash\necho \'{\"ok\":false,\"reason\":\"no_window\"}\'\n';
    }

    if (mode === 'not-ok') {
      return '#!/usr/bin/env bash\necho \'{\"ok\":false,\"reason\":\"ExecutionError\"}\'\n';
    }

    return '#!/usr/bin/env bash\necho \'{\"ok\":true}\'\n';
  }

  return '#!/usr/bin/env bash\nexit 0\n';
}

export function setupFakeBin(opts: Record<string, FakeBinMode>): string {
  const bin = mkdtempSync(join(tmpdir(), 'gt-bin-'));

  for (const [name, mode] of Object.entries(opts)) {
    if (mode === false) {
      continue;
    }

    const target = join(bin, name === 'chrome' ? 'Google Chrome' : name);
    writeExecutable(target, buildScript(name, mode));
  }

  return bin;
}

export function seedInstalledLayout(): string {
  const home = mkdtempSync(join(tmpdir(), 'gt-home-'));

  mkdirSync(join(home, '.codex/skills/google-trends-rising-collector/scripts'), { recursive: true });
  mkdirSync(join(home, '.opencli/plugins/google-trends-rising'), { recursive: true });

  writeFileSync(join(home, '.codex/skills/google-trends-rising-collector/SKILL.md'), '# installed\n');
  writeFileSync(join(home, '.opencli/plugins/google-trends-rising/package.json'), '{}\n');

  return home;
}

export const ROOT = fileURLToPath(new URL('..', import.meta.url));
