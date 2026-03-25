#!/usr/bin/env node

import { existsSync } from 'node:fs';
import { extname, resolve } from 'node:path';

class ValidationError extends Error {}

function fail(message) {
  console.error(message);
  process.exit(1);
}

function deriveSiblingPath(inputPath, suffix, extension) {
  if (extname(inputPath) === extension) {
    return `${inputPath.slice(0, -extension.length)}${suffix}${extension}`;
  }

  return `${inputPath}${suffix}${extension}`;
}

function deriveReportPath(inputPath) {
  if (extname(inputPath) === '.json') {
    return `${inputPath.slice(0, -5)}.report.md`;
  }

  return `${inputPath}.report.md`;
}

function parseArgs(argv) {
  const parsed = {
    round1: null,
    keep: null,
    reject: null,
    report: null,
    doctorPassed: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];

    if (flag === '--doctor-passed') {
      parsed.doctorPassed = true;
      continue;
    }

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

    if (flag === '--report') {
      parsed.report = resolve(value);
      index += 1;
      continue;
    }

    throw new ValidationError(`Unknown option: ${flag}`);
  }

  return parsed;
}

function buildEnvelope(args) {
  const round1Path = args.round1;

  if (round1Path && !existsSync(round1Path)) {
    throw new ValidationError(`Round 1 file not found: ${round1Path}`);
  }

  const keepPath = round1Path
    ? (args.keep ?? deriveSiblingPath(round1Path, '.keep', '.json'))
    : (args.keep ?? null);
  const rejectPath = round1Path
    ? (args.reject ?? deriveSiblingPath(round1Path, '.reject', '.json'))
    : (args.reject ?? null);
  const reportPath = round1Path
    ? (args.report ?? deriveReportPath(round1Path))
    : (args.report ?? null);

  const artifacts = {
    round1_exists: round1Path ? existsSync(round1Path) : false,
    keep_exists: keepPath ? existsSync(keepPath) : false,
    reject_exists: rejectPath ? existsSync(rejectPath) : false,
    report_exists: reportPath ? existsSync(reportPath) : false,
  };

  if (!artifacts.round1_exists) {
    return {
      next_action: args.doctorPassed ? 'collect' : 'doctor',
      round1_path: round1Path,
      keep_path: keepPath,
      reject_path: rejectPath,
      report_path: reportPath,
      artifacts,
      reason: args.doctorPassed
        ? 'Doctor 已经通过，但还没有 round 1 产物；下一步通常是执行 collect。'
        : '还没有 round 1 产物；先跑 doctor，确认环境和 Chrome 状态健康，再决定是否 collect。',
    };
  }

  if (!artifacts.keep_exists || !artifacts.reject_exists) {
    return {
      next_action: 'round2',
      round1_path: round1Path,
      keep_path: keepPath,
      reject_path: rejectPath,
      report_path: reportPath,
      artifacts,
      reason: 'round 1 已存在，但 round 2 的 keep/reject 产物还不完整；下一步应准备或执行 round 2 判断。',
    };
  }

  return {
    next_action: 'report',
    round1_path: round1Path,
    keep_path: keepPath,
    reject_path: rejectPath,
      report_path: reportPath,
      artifacts,
      reason: artifacts.report_exists
        ? 'round 1、round 2 和 report 路径都已存在；下一步通常是复核或刷新报告，而不是重新拼装 workflow。'
        : 'round 1 和 round 2 产物已齐；下一步应生成 report 或完善现有的结论优先报告。',
    };
  }

function main() {
  const envelope = buildEnvelope(parseArgs(process.argv.slice(2)));
  process.stdout.write(`${JSON.stringify(envelope, null, 2)}\n`);
}

try {
  main();
} catch (error) {
  if (error instanceof ValidationError) {
    fail(error.message);
  }

  throw error;
}
