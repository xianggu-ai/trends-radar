#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const DEFAULT_CONFIG = {
  default_geo: 'US',
  default_time: '7d',
  default_min_rise: 2000,
  default_output_format: 'json',
};

const HOME_DIR = process.env.HOME || homedir();
const DATA_DIR = join(HOME_DIR, '.codex', 'data', 'trends-radar');
const CONFIG_PATH = join(DATA_DIR, 'config.json');

mkdirSync(DATA_DIR, { recursive: true });

if (!existsSync(CONFIG_PATH)) {
  writeFileSync(CONFIG_PATH, `${JSON.stringify(DEFAULT_CONFIG, null, 2)}\n`);
  console.log(CONFIG_PATH);
  process.exit(0);
}

try {
  JSON.parse(readFileSync(CONFIG_PATH, 'utf8'));
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Existing config is unreadable at ${CONFIG_PATH}: ${message}`);
  process.exit(1);
}

console.log(CONFIG_PATH);
