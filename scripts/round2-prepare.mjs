import { readFileSync } from 'node:fs';
import { extname, resolve } from 'node:path';

class ValidationError extends Error {}

function fail(message) {
  console.error(message);
  process.exit(1);
}

function deriveOutputPath(inputPath, suffix) {
  if (extname(inputPath) === '.json') {
    return `${inputPath.slice(0, -5)}${suffix}.json`;
  }

  return `${inputPath}${suffix}.json`;
}

function ensureRecord(value, message) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ValidationError(message);
  }

  return value;
}

function normalizeRisePct(value) {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new ValidationError('rise_pct must be a finite number or null when provided');
  }

  return value;
}

function mergeRisePct(currentValue, nextValue) {
  if (currentValue === null) {
    return nextValue;
  }

  if (nextValue === null) {
    return currentValue;
  }

  return Math.max(currentValue, nextValue);
}

function normalizeRow(row, index) {
  const item = ensureRecord(row, `Result item ${index} must be an object`);

  for (const field of ['seed', 'related_query', 'is_breakout']) {
    if (!(field in item)) {
      throw new ValidationError(`Result item ${index} is missing required field "${field}"`);
    }
  }

  if (typeof item.seed !== 'string' || item.seed.trim() === '') {
    throw new ValidationError(`Result item ${index} field "seed" must be a non-empty string`);
  }

  if (typeof item.related_query !== 'string' || item.related_query.trim() === '') {
    throw new ValidationError(`Result item ${index} field "related_query" must be a non-empty string`);
  }

  if (typeof item.is_breakout !== 'boolean') {
    throw new ValidationError(`Result item ${index} field "is_breakout" must be a boolean`);
  }

  return {
    seed: item.seed,
    keyword: item.related_query,
    is_breakout: item.is_breakout,
    rise_pct: normalizeRisePct(item.rise_pct),
  };
}

function prepareCandidates(results) {
  const candidatesByKeyword = new Map();

  for (const [index, row] of results.entries()) {
    const normalized = normalizeRow(row, index);
    let candidate = candidatesByKeyword.get(normalized.keyword);

    if (!candidate) {
      candidate = {
        keyword: normalized.keyword,
        seeds: [],
        rise_pct: null,
        is_breakout: false,
        source_context: [],
        source_context_by_seed: new Map(),
      };
      candidatesByKeyword.set(normalized.keyword, candidate);
    }

    candidate.is_breakout = candidate.is_breakout || normalized.is_breakout;
    candidate.rise_pct = mergeRisePct(candidate.rise_pct, normalized.rise_pct);

    let sourceContext = candidate.source_context_by_seed.get(normalized.seed);

    if (!sourceContext) {
      sourceContext = {
        seed: normalized.seed,
        rise_pct: normalized.rise_pct,
        is_breakout: normalized.is_breakout,
      };
      candidate.source_context_by_seed.set(normalized.seed, sourceContext);
      candidate.source_context.push(sourceContext);
      candidate.seeds.push(normalized.seed);
      continue;
    }

    sourceContext.rise_pct = mergeRisePct(sourceContext.rise_pct, normalized.rise_pct);
    sourceContext.is_breakout = sourceContext.is_breakout || normalized.is_breakout;
  }

  return Array.from(candidatesByKeyword.values(), ({ source_context_by_seed, ...candidate }) => candidate);
}

function prepareRound2(payload, inputPath) {
  const envelope = ensureRecord(payload, 'Expected a top-level object with a results array');

  if (!Array.isArray(envelope.results)) {
    throw new ValidationError('Expected a top-level object with a results array');
  }

  return {
    inputPath,
    keepPath: deriveOutputPath(inputPath, '.keep'),
    rejectPath: deriveOutputPath(inputPath, '.reject'),
    candidates: prepareCandidates(envelope.results),
  };
}

function readInput(inputPath) {
  try {
    return readFileSync(inputPath, 'utf8');
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      throw new ValidationError(`Input file not found: ${inputPath}`);
    }

    throw error;
  }
}

function main() {
  const inputArg = process.argv[2];

  if (!inputArg) {
    throw new ValidationError('Usage: node scripts/round2-prepare.mjs <first-stage-json-path>');
  }

  const inputPath = resolve(inputArg);
  const raw = readInput(inputPath);
  let parsed;

  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ValidationError('Invalid JSON in first-stage input');
  }

  process.stdout.write(`${JSON.stringify(prepareRound2(parsed, inputPath), null, 2)}\n`);
}

try {
  main();
} catch (error) {
  if (error instanceof ValidationError) {
    fail(error.message);
  }

  throw error;
}
