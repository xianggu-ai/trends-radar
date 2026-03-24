import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { execa } from 'execa';
import { ROOT } from './helpers';

type PreparedCandidate = {
  keyword: string;
  seeds: string[];
  rise_pct: number | null;
  is_breakout: boolean;
  source_context: Array<{
    seed: string;
    rise_pct?: number;
    is_breakout: boolean;
  }>;
};

type PreparedEnvelope = {
  inputPath: string;
  keepPath: string;
  rejectPath: string;
  candidates: PreparedCandidate[];
};

async function runHelper(inputPath: string): Promise<PreparedEnvelope> {
  const result = await execa('node', ['scripts/round2-prepare.mjs', inputPath], {
    cwd: ROOT,
  });

  return JSON.parse(result.stdout) as PreparedEnvelope;
}

describe('round2-prepare.mjs', () => {
  it('normalizes first-stage results into deduplicated candidates with merged seeds and source context', async () => {
    const prepared = await runHelper(`${ROOT}/tests/fixtures/round2-input.json`);

    expect(prepared.inputPath).toContain('round2-input.json');
    expect(prepared.keepPath.endsWith('round2-input.keep.json')).toBe(true);
    expect(prepared.rejectPath.endsWith('round2-input.reject.json')).toBe(true);
    expect(prepared.candidates).toHaveLength(2);

    expect(prepared.candidates[0]).toEqual({
      keyword: 'ghibli style image',
      seeds: ['ai image generator', 'ghibli'],
      rise_pct: 4200,
      is_breakout: true,
      source_context: [
        { seed: 'ai image generator', rise_pct: 4200, is_breakout: false },
        { seed: 'ghibli', rise_pct: null, is_breakout: true },
      ],
    });

    expect(prepared.candidates[1]).toEqual({
      keyword: 'agent template',
      seeds: ['agent'],
      rise_pct: null,
      is_breakout: true,
      source_context: [{ seed: 'agent', rise_pct: null, is_breakout: true }],
    });
  });

  it('returns zero candidates for a valid-but-empty results array', async () => {
    const prepared = await runHelper(`${ROOT}/tests/fixtures/round2-empty.json`);

    expect(prepared.candidates).toEqual([]);
    expect(prepared.keepPath.endsWith('round2-empty.keep.json')).toBe(true);
    expect(prepared.rejectPath.endsWith('round2-empty.reject.json')).toBe(true);
  });

  it('fails fast when the input file is missing', async () => {
    await expect(runHelper(`${ROOT}/tests/fixtures/does-not-exist.json`)).rejects.toThrow(/Input file not found/i);
  });

  it('fails fast when the input file contains invalid JSON syntax', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'round2-invalid-json-'));
    const inputPath = join(dir, 'broken.json');
    writeFileSync(inputPath, '{results: [');

    await expect(runHelper(inputPath)).rejects.toThrow(/Invalid JSON/i);
  });

  it('fails fast when the top-level results array is missing', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'round2-invalid-shape-'));
    const inputPath = join(dir, 'shape.json');
    writeFileSync(inputPath, JSON.stringify({ run: { scope: null } }));

    await expect(runHelper(inputPath)).rejects.toThrow(/top-level object with a results array/i);
  });

  it('fails fast when a result item is missing required fields', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'round2-invalid-item-'));
    const inputPath = join(dir, 'item.json');
    writeFileSync(inputPath, JSON.stringify({
      results: [
        {
          seed: 'agent',
          related_query: 'agent template',
        },
      ],
    }));

    await expect(runHelper(inputPath)).rejects.toThrow(/Missing required field/i);
  });
});
