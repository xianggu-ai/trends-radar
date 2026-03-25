import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { execa } from 'execa';
import { ROOT } from './helpers';

type WorkflowEnvelope = {
  next_action: 'doctor' | 'collect' | 'round2' | 'report';
  round1_path: string | null;
  keep_path: string | null;
  reject_path: string | null;
  report_path: string | null;
  artifacts: {
    round1_exists: boolean;
    keep_exists: boolean;
    reject_exists: boolean;
    report_exists: boolean;
  };
  reason: string;
};

async function runHelper(args: string[] = []): Promise<WorkflowEnvelope> {
  const result = await execa('node', ['scripts/workflow-next-step.mjs', ...args], {
    cwd: ROOT,
  });

  return JSON.parse(result.stdout) as WorkflowEnvelope;
}

describe('workflow-next-step.mjs', () => {
  it('recommends doctor when no workflow artifacts are provided', async () => {
    const envelope = await runHelper();

    expect(envelope.next_action).toBe('doctor');
    expect(envelope.round1_path).toBeNull();
    expect(envelope.keep_path).toBeNull();
    expect(envelope.reject_path).toBeNull();
    expect(envelope.report_path).toBeNull();
    expect(envelope.artifacts).toEqual({
      round1_exists: false,
      keep_exists: false,
      reject_exists: false,
      report_exists: false,
    });
    expect(envelope.reason).toMatch(/doctor/i);
  });

  it('derives sibling artifact paths and recommends round2 when only round1 exists', async () => {
    const round1Path = resolve(ROOT, 'tests/fixtures/round2-input.json');
    const envelope = await runHelper(['--round1', round1Path]);

    expect(envelope.next_action).toBe('round2');
    expect(envelope.round1_path).toBe(round1Path);
    expect(envelope.keep_path).toBe(round1Path.replace(/\.json$/, '.keep.json'));
    expect(envelope.reject_path).toBe(round1Path.replace(/\.json$/, '.reject.json'));
    expect(envelope.report_path).toBe(round1Path.replace(/\.json$/, '.report.md'));
    expect(envelope.artifacts).toEqual({
      round1_exists: true,
      keep_exists: false,
      reject_exists: false,
      report_exists: false,
    });
    expect(envelope.reason).toMatch(/round 2/i);
  });

  it('recommends report when round2 outputs exist but the report does not', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'workflow-next-step-'));
    const round1Path = join(dir, 'round1.json');
    const keepPath = join(dir, 'round1.keep.json');
    const rejectPath = join(dir, 'round1.reject.json');

    writeFileSync(round1Path, JSON.stringify({ run: {}, results: [] }, null, 2));
    writeFileSync(keepPath, '[]\n');
    writeFileSync(rejectPath, '[]\n');

    const envelope = await runHelper(['--round1', round1Path]);

    expect(envelope.next_action).toBe('report');
    expect(envelope.keep_path).toBe(keepPath);
    expect(envelope.reject_path).toBe(rejectPath);
    expect(envelope.report_path).toBe(join(dir, 'round1.report.md'));
    expect(envelope.artifacts).toEqual({
      round1_exists: true,
      keep_exists: true,
      reject_exists: true,
      report_exists: false,
    });
    expect(envelope.reason).toMatch(/report/i);
  });

  it('normalizes explicit keep, reject, and report paths', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'workflow-next-step-'));
    const round1Path = join(dir, 'nested', '..', 'round1.json');
    const keepPath = join(dir, 'outputs', '..', 'outputs', 'keep.json');
    const rejectPath = join(dir, 'outputs', '..', 'outputs', 'reject.json');
    const reportPath = join(dir, 'reports', '..', 'reports', 'summary.md');

    mkdirSync(join(dir, 'outputs'), { recursive: true });
    writeFileSync(resolve(round1Path), JSON.stringify({ run: {}, results: [] }, null, 2));
    writeFileSync(resolve(keepPath), '[]\n');
    writeFileSync(resolve(rejectPath), '[]\n');

    const envelope = await runHelper([
      '--round1',
      round1Path,
      '--keep',
      keepPath,
      '--reject',
      rejectPath,
      '--report',
      reportPath,
    ]);

    expect(envelope.round1_path).toBe(resolve(round1Path));
    expect(envelope.keep_path).toBe(resolve(keepPath));
    expect(envelope.reject_path).toBe(resolve(rejectPath));
    expect(envelope.report_path).toBe(resolve(reportPath));
    expect(typeof envelope.reason).toBe('string');
    expect(envelope.reason.length).toBeGreaterThan(10);
  });
});
