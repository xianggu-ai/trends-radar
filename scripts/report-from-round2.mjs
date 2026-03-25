#!/usr/bin/env node

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, extname, resolve } from 'node:path';

class ValidationError extends Error {}

const SITE_TYPE_LABELS = {
  tool: '工具站',
  game: '小游戏站',
  content: '内容站',
  mixed: '混合机会',
};

function fail(message) {
  console.error(message);
  process.exit(1);
}

function deriveReportPath(round1Path) {
  if (extname(round1Path) === '.json') {
    return `${round1Path.slice(0, -5)}.report.md`;
  }

  return `${round1Path}.report.md`;
}

function parseArgs(argv) {
  const parsed = {
    round1: null,
    keep: null,
    reject: null,
    out: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    const value = argv[index + 1];

    if (!value) {
      throw new ValidationError(`Missing value for ${flag}`);
    }

    if (flag === '--round1') {
      parsed.round1 = resolve(value);
      index += 1;
      continue;
    }

    if (flag === '--keep') {
      parsed.keep = resolve(value);
      index += 1;
      continue;
    }

    if (flag === '--reject') {
      parsed.reject = resolve(value);
      index += 1;
      continue;
    }

    if (flag === '--out') {
      parsed.out = resolve(value);
      index += 1;
      continue;
    }

    throw new ValidationError(`Unknown option: ${flag}`);
  }

  if (!parsed.round1 || !parsed.keep || !parsed.reject) {
    throw new ValidationError('Usage: node scripts/report-from-round2.mjs --round1 <path> --keep <path> --reject <path> [--out <path>]');
  }

  return parsed;
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new ValidationError(`Invalid JSON in ${path}`);
    }

    throw error;
  }
}

function ensureArray(value, label) {
  if (!Array.isArray(value)) {
    throw new ValidationError(`${label} must contain a JSON array`);
  }

  return value;
}

function formatScope(run) {
  const scope = run && typeof run === 'object' && run.scope && typeof run.scope === 'object'
    ? run.scope
    : null;

  if (!scope) {
    return null;
  }

  const geo = scope.geo === '' ? 'Worldwide' : (scope.geo ?? 'unknown geo');
  const time = scope.time ?? 'unknown time';
  const category = scope.category ?? 'unknown category';
  const property = scope.search_property ?? 'unknown property';

  return `${geo} / ${time} / category ${category} / ${property}`;
}

function formatRise(row) {
  if (row.is_breakout) {
    return 'Breakout';
  }

  if (typeof row.rise_pct === 'number') {
    return `+${row.rise_pct}%`;
  }

  return '未提供具体涨幅';
}

function buildRejectBreakdown(rows) {
  const counts = new Map();

  for (const row of rows) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) {
      continue;
    }

    const reason = typeof row.reject_reason === 'string' && row.reject_reason.trim() !== ''
      ? row.reject_reason
      : 'unknown';
    counts.set(reason, (counts.get(reason) ?? 0) + 1);
  }

  return Array.from(counts.entries()).sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]));
}

function buildKeepSection(rows) {
  if (rows.length === 0) {
    return [
      '## 本轮脱颖而出的关键词',
      '',
      '本轮没有需要继续推进的网站机会词。',
    ].join('\n');
  }

  const sections = ['## 本轮脱颖而出的关键词', ''];

  for (const row of rows) {
    const keyword = typeof row.keyword === 'string' ? row.keyword : 'unknown keyword';
    const seeds = Array.isArray(row.seeds) ? row.seeds.join('、') : '未提供';
    const siteType = typeof row.site_type === 'string'
      ? (SITE_TYPE_LABELS[row.site_type] ?? row.site_type)
      : '未提供';
    const why = typeof row.why === 'string' ? row.why : '未提供判断说明。';
    const evidence = ensureArray(row.evidence, `Keep row "${keyword}" evidence`);

    sections.push(`### ${keyword}`);
    sections.push(`- 种子词：${seeds}`);
    sections.push(`- 热度变化：${formatRise(row)}`);
    sections.push(`- 建议站型：${siteType}`);
    sections.push(`- 判断：${why}`);

    if (evidence.length === 0) {
      sections.push('- 证据：未提供');
      sections.push('');
      continue;
    }

    sections.push('- 证据：');

    for (const item of evidence) {
      sections.push(`  - ${String(item)}`);
    }

    sections.push('');
  }

  return sections.join('\n').trimEnd();
}

function buildRejectSection(rows) {
  const breakdown = buildRejectBreakdown(rows);
  const lines = ['## 被淘汰关键词概况', ''];

  if (rows.length === 0) {
    lines.push('本轮没有淘汰的关键词。');
    return lines.join('\n');
  }

  lines.push(`本轮共淘汰 ${rows.length} 个关键词，主要原因如下：`);

  for (const [reason, count] of breakdown) {
    lines.push(`- ${reason}：${count}`);
  }

  return lines.join('\n');
}

function buildMethodNote(round1, keepRows, rejectRows) {
  const processedTabs = round1?.run && typeof round1.run === 'object' ? round1.run.processedTabs : undefined;
  const scopeLine = formatScope(round1?.run);
  const lines = ['## 补充说明', ''];

  if (typeof processedTabs === 'number') {
    lines.push(`- 本轮 round 1 共处理 ${processedTabs} 个 Trends compare 页面。`);
  }

  if (scopeLine) {
    lines.push(`- 采集范围：${scopeLine}`);
  }

  lines.push(`- 本轮共复核 ${keepRows.length + rejectRows.length} 个候选词。`);
  lines.push('- 这份报告只负责汇总已有 keep/reject 判断，不会替代二轮筛选本身。');

  return lines.join('\n');
}

function buildReport(round1, keepRows, rejectRows) {
  const standoutLine = keepRows.length === 0
    ? '本轮没有脱颖而出的关键词。'
    : `本轮脱颖而出的关键词有 ${keepRows.length} 个：${keepRows.map((row) => row.keyword).join('、')}。`;

  return [
    '# 趋势词筛选报告',
    '',
    '## 先看结论',
    '',
    standoutLine,
    '',
    buildKeepSection(keepRows),
    '',
    buildRejectSection(rejectRows),
    '',
    buildMethodNote(round1, keepRows, rejectRows),
    '',
  ].join('\n');
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const round1 = readJson(args.round1);
  const keepRows = ensureArray(readJson(args.keep), 'Keep payload');
  const rejectRows = ensureArray(readJson(args.reject), 'Reject payload');
  const reportPath = args.out ?? deriveReportPath(args.round1);
  const report = buildReport(round1, keepRows, rejectRows);

  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, report);

  process.stdout.write(`${JSON.stringify({
    reportPath,
    keepCount: keepRows.length,
    rejectCount: rejectRows.length,
  }, null, 2)}\n`);
}

try {
  main();
} catch (error) {
  if (error instanceof ValidationError) {
    fail(error.message);
  }

  throw error;
}
