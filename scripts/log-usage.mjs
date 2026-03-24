#!/usr/bin/env node

import { appendFileSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

function fail(message) {
  console.error(message);
  process.exit(1);
}

const args = process.argv.slice(2);
const [action, status] = args;

if (!action || !status) {
  fail('Usage: log-usage.mjs <action> <status> [--reason <reason>] [--counts <json>]');
}

let reason;
let counts;

for (let index = 2; index < args.length; index += 1) {
  const flag = args[index];
  const value = args[index + 1];

  if (!value) {
    fail(`Missing value for ${flag}`);
  }

  if (flag === '--reason') {
    reason = value;
    index += 1;
    continue;
  }

  if (flag === '--counts') {
    try {
      const parsed = JSON.parse(value);

      if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
        fail('--counts must be a JSON object');
      }

      counts = parsed;
    } catch {
      fail('--counts must be valid JSON');
    }

    index += 1;
    continue;
  }

  fail(`Unknown option: ${flag}`);
}

const record = {
  timestamp: new Date().toISOString(),
  action,
  status,
  ...(reason ? { reason } : {}),
  ...(counts ? { counts } : {}),
};

const dataDir = join(homedir(), '.codex', 'data', 'trends-radar');
mkdirSync(dataDir, { recursive: true });
appendFileSync(join(dataDir, 'usage.jsonl'), `${JSON.stringify(record)}\n`);
