import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { execa } from 'execa';
import { ROOT } from './helpers';

const SCRIPT_PATH = join(ROOT, 'scripts/round2-prepare.mjs');
const INPUT_FIXTURE = join(ROOT, 'tests/fixtures/round2-input.json');
const EMPTY_FIXTURE = join(ROOT, 'tests/fixtures/round2-empty.json');

type SourceContextRow = {
  seed: string;
  rise_pct: number | null;
  is_breakout: boolean;
};

type Candidate = {
  keyword: string;
  seeds: string[];
  rise_pct: number | null;
  is_breakout: boolean;
  source_context: SourceContextRow[];
};

type Round2Output = {
  inputPath: string;
  keepPath: string;
  rejectPath: string;
  candidates: Candidate[];
};

async function runPrepare(inputPath?: string) {
  const args = [SCRIPT_PATH];

  if (inputPath) {
    args.push(inputPath);
  }

  return execa('node', args, {
    cwd: ROOT,
    reject: false,
  });
}

function parseOutput(stdout: string): Round2Output {
  return JSON.parse(stdout) as Round2Output;
}

function findCandidate(output: Round2Output, keyword: string): Candidate {
  const candidate = output.candidates.find((entry) => entry.keyword === keyword);

  expect(candidate).toBeDefined();

  return candidate as Candidate;
}

function writeTempJsonFile(body: string): string {
  const directory = mkdtempSync(join(tmpdir(), 'round2-prepare-'));
  const inputPath = join(directory, 'input.json');

  writeFileSync(inputPath, body);

  return inputPath;
}

describe('round2-prepare.mjs', () => {
  it('normalizes valid first-stage input and derives keep/reject output paths', async () => {
    const result = await runPrepare(INPUT_FIXTURE);

    expect(result.exitCode).toBe(0);

    const output = parseOutput(result.stdout);

    expect(output.inputPath).toBe(INPUT_FIXTURE);
    expect(output.keepPath).toBe(join(ROOT, 'tests/fixtures/round2-input.keep.json'));
    expect(output.rejectPath).toBe(join(ROOT, 'tests/fixtures/round2-input.reject.json'));
    expect(output.candidates).toHaveLength(3);
  });

  it('deduplicates duplicate related_query rows under the same seed', async () => {
    const result = await runPrepare(INPUT_FIXTURE);
    const output = parseOutput(result.stdout);
    const candidate = findCandidate(output, 'ghibli style image');

    expect(candidate.source_context.filter((row) => row.seed === 'ghibli')).toHaveLength(1);
    expect(candidate.source_context).toContainEqual({
      seed: 'ghibli',
      rise_pct: 4200,
      is_breakout: false,
    });
  });

  it('merges the same keyword across seeds and preserves the highest numeric rise_pct', async () => {
    const result = await runPrepare(INPUT_FIXTURE);
    const output = parseOutput(result.stdout);
    const candidate = findCandidate(output, 'ghibli style image');

    expect(candidate.seeds).toEqual(['ghibli', 'ai image generator']);
    expect(candidate.rise_pct).toBe(4200);
    expect(candidate.is_breakout).toBe(true);
  });

  it('uses null rise_pct for breakout-only keywords', async () => {
    const result = await runPrepare(INPUT_FIXTURE);
    const output = parseOutput(result.stdout);
    const candidate = findCandidate(output, 'breakout only query');

    expect(candidate.seeds).toEqual(['ai']);
    expect(candidate.rise_pct).toBeNull();
    expect(candidate.is_breakout).toBe(true);
  });

  it('includes condensed source_context rows for the skill', async () => {
    const result = await runPrepare(INPUT_FIXTURE);
    const output = parseOutput(result.stdout);
    const candidate = findCandidate(output, 'ghibli style image');

    expect(candidate.source_context).toEqual([
      {
        seed: 'ghibli',
        rise_pct: 4200,
        is_breakout: false,
      },
      {
        seed: 'ai image generator',
        rise_pct: null,
        is_breakout: true,
      },
    ]);
  });

  it('returns zero candidates for a valid empty results payload', async () => {
    const result = await runPrepare(EMPTY_FIXTURE);

    expect(result.exitCode).toBe(0);

    const output = parseOutput(result.stdout);

    expect(output.keepPath).toBe(join(ROOT, 'tests/fixtures/round2-empty.keep.json'));
    expect(output.rejectPath).toBe(join(ROOT, 'tests/fixtures/round2-empty.reject.json'));
    expect(output.candidates).toEqual([]);
  });

  it('fails with actionable stderr when the input file is missing', async () => {
    const inputPath = join(ROOT, 'tests/fixtures/does-not-exist.json');
    const result = await runPrepare(inputPath);

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain('Input file not found');
    expect(result.stderr).toContain(inputPath);
  });

  it('fails with actionable stderr for invalid JSON syntax', async () => {
    const inputPath = writeTempJsonFile('{"results": [}');
    const result = await runPrepare(inputPath);

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain('Invalid JSON in first-stage input');
  });

  it('fails when the top-level payload does not contain a results array', async () => {
    const inputPath = writeTempJsonFile('{"run": {"scope": "US"}}');
    const result = await runPrepare(inputPath);

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain('Expected a top-level object with a results array');
  });

  it('fails when a result item is missing a required field', async () => {
    const inputPath = writeTempJsonFile(JSON.stringify({
      results: [
        {
          related_query: 'missing seed',
          is_breakout: false,
          rise_pct: 2400,
        },
      ],
    }));
    const result = await runPrepare(inputPath);

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain('Result item 0 is missing required field "seed"');
  });
});
