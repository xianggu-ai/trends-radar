import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { execa } from 'execa';
import { ROOT } from './helpers';

type ReportEnvelope = {
  reportPath: string;
  keepCount: number;
  rejectCount: number;
};

async function runHelper(args: string[]): Promise<ReportEnvelope> {
  const result = await execa('node', ['scripts/report-from-round2.mjs', ...args], {
    cwd: ROOT,
  });

  return JSON.parse(result.stdout) as ReportEnvelope;
}

describe('report-from-round2.mjs', () => {
  it('writes a conclusion-first markdown report from keep and reject outputs', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'round2-report-'));
    const round1Path = join(dir, 'round1.json');
    const keepPath = join(dir, 'round1.keep.json');
    const rejectPath = join(dir, 'round1.reject.json');

    writeFileSync(round1Path, JSON.stringify({
      run: {
        scope: {
          geo: 'US',
          time: '7d',
          category: '0',
          search_property: 'web',
        },
        processedTabs: 4,
      },
      results: [
        { seed: 'agent', related_query: 'pascal editor', rise_pct: 3200, is_breakout: false },
        { seed: 'dispatch', related_query: 'claude dispatch', rise_pct: 2800, is_breakout: false },
        { seed: 'vacuum', related_query: 'go daddy email', rise_pct: 3100, is_breakout: false },
      ],
    }, null, 2));

    writeFileSync(keepPath, JSON.stringify([
      {
        keyword: 'pascal editor',
        seeds: ['agent'],
        rise_pct: 3200,
        site_type: 'mixed',
        why: '更像一个开源项目生态词，能承接教程、模板和案例内容。',
        evidence: [
          '搜索意图不止是找仓库首页。',
          '围绕项目会自然出现上手、部署和案例需求。',
        ],
      },
      {
        keyword: 'claude dispatch',
        seeds: ['dispatch'],
        rise_pct: 2800,
        site_type: 'content',
        why: '带品牌属性，但明显存在非官方教程和排障需求。',
        evidence: [
          '用户会找教程和使用说明。',
        ],
      },
    ], null, 2));

    writeFileSync(rejectPath, JSON.stringify([
      {
        keyword: 'go daddy email',
        seeds: ['vacuum'],
        reject_reason: 'navigational',
        why: '更像在找现成服务入口，不是新的独立建站机会。',
      },
    ], null, 2));

    const envelope = await runHelper([
      '--round1',
      round1Path,
      '--keep',
      keepPath,
      '--reject',
      rejectPath,
    ]);

    expect(envelope.keepCount).toBe(2);
    expect(envelope.rejectCount).toBe(1);
    expect(envelope.reportPath).toBe(join(dir, 'round1.report.md'));

    const report = readFileSync(envelope.reportPath, 'utf8');
    expect(report).toContain('# 趋势词筛选报告');
    expect(report).toContain('## 先看结论');
    expect(report).toContain('本轮脱颖而出的关键词有 2 个');
    expect(report).toContain('pascal editor');
    expect(report).toContain('claude dispatch');
    expect(report).toContain('更像一个开源项目生态词，能承接教程、模板和案例内容。');
    expect(report).toContain('搜索意图不止是找仓库首页。');
    expect(report).toContain('## 被淘汰关键词概况');
    expect(report).toContain('navigational：1');
  });

  it('preserves keep judgment text exactly instead of inventing new reasoning', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'round2-report-'));
    const round1Path = join(dir, 'round1.json');
    const keepPath = join(dir, 'round1.keep.json');
    const rejectPath = join(dir, 'round1.reject.json');
    const outPath = join(dir, 'custom.md');

    writeFileSync(round1Path, JSON.stringify({ run: {}, results: [] }, null, 2));
    writeFileSync(keepPath, JSON.stringify([
      {
        keyword: 'uitm timetable generator',
        seeds: ['generator'],
        rise_pct: 4100,
        site_type: 'tool',
        why: '这是一个明确的工具词。',
        evidence: ['用户想直接生成课表。'],
      },
    ], null, 2));
    writeFileSync(rejectPath, '[]\n');

    const envelope = await runHelper([
      '--round1',
      round1Path,
      '--keep',
      keepPath,
      '--reject',
      rejectPath,
      '--out',
      outPath,
    ]);

    expect(envelope.reportPath).toBe(outPath);

    const report = readFileSync(outPath, 'utf8');
    expect(report).toContain('这是一个明确的工具词。');
    expect(report).toContain('用户想直接生成课表。');
    expect(report).not.toContain('我认为');
    expect(report).not.toContain('推测');
  });

  it('fails fast when keep or reject payloads are not arrays', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'round2-report-'));
    const round1Path = join(dir, 'round1.json');
    const keepPath = join(dir, 'round1.keep.json');
    const rejectPath = join(dir, 'round1.reject.json');

    writeFileSync(round1Path, JSON.stringify({ run: {}, results: [] }, null, 2));
    writeFileSync(keepPath, JSON.stringify({ nope: true }, null, 2));
    writeFileSync(rejectPath, '[]\n');

    await expect(runHelper([
      '--round1',
      round1Path,
      '--keep',
      keepPath,
      '--reject',
      rejectPath,
    ])).rejects.toThrow(/must contain a JSON array/i);
  });
});
