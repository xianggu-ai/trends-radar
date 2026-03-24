import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';

function tabsFixture(): string {
  return readFileSync(new URL('../fixtures/chrome-tabs.json', import.meta.url), 'utf-8');
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('chrome automation helpers', () => {
  it('parses and filters open Google Trends tabs from osascript JSON', async () => {
    const { listChromeTabs } = await import('../src/chrome');
    const execFile = vi.fn().mockResolvedValue({
      stdout: tabsFixture(),
      stderr: '',
    });

    const tabs = await listChromeTabs({ execFile });

    expect(tabs).toEqual([
      {
        windowIndex: 1,
        tabIndex: 1,
        title: 'Google Trends - agent compare',
        url: 'https://trends.google.com/trends/explore?date=now%207-d&geo=US&q=agent,ai,anime,answer,analyzer',
        active: true,
      },
      {
        windowIndex: 1,
        tabIndex: 2,
        title: 'Google Trends - ai compare',
        url: 'https://trends.google.com/trends/explore?date=now%207-d&geo=US&q=chatgpt,ghibli,midjourney,perplexity,mistral%20ai',
        active: false,
      },
      {
        windowIndex: 2,
        tabIndex: 1,
        title: 'Google Trends - anime compare',
        url: 'https://trends.google.com/trends/explore?date=now%207-d&geo=US&q=anime,manga,ghibli,one%20piece,naruto',
        active: true,
      },
    ]);
    expect(execFile).toHaveBeenCalledWith('osascript', ['-l', 'JavaScript', '-e', expect.stringContaining('activeTabIndex')]);
  });

  it('surfaces an actionable error when Automation permission is denied', async () => {
    const { listChromeTabs } = await import('../src/chrome');
    const execFile = vi.fn().mockRejectedValue(new Error('Not authorized to send Apple events to Google Chrome.'));

    await expect(listChromeTabs({ execFile })).rejects.toThrow(/Automation/i);
  });

  it('orders tabs by frontmost window and tab order', async () => {
    const { listChromeTabs, orderTabsForCollection } = await import('../src/chrome');
    const execFile = vi.fn().mockResolvedValue({
      stdout: tabsFixture(),
      stderr: '',
    });

    const ordered = orderTabsForCollection(await listChromeTabs({ execFile }));

    expect(ordered.map((tab) => [tab.windowIndex, tab.tabIndex])).toEqual([
      [1, 1],
      [1, 2],
      [2, 1],
    ]);
  });

  it('activates a Chrome tab by window and tab index', async () => {
    const { activateChromeTab } = await import('../src/chrome');
    const execFile = vi.fn().mockResolvedValue({
      stdout: '',
      stderr: '',
    });

    await activateChromeTab(
      {
        windowIndex: 2,
        tabIndex: 1,
        title: 'Google Trends - anime compare',
        url: 'https://trends.google.com/trends/explore?date=now%207-d&geo=US&q=anime,manga,ghibli,one%20piece,naruto',
        active: true,
      },
      { execFile },
    );

    expect(execFile).toHaveBeenCalledWith('osascript', ['-l', 'JavaScript', '-e', expect.stringContaining('windows[1]')]);
  });

  it('executes JavaScript in the active Chrome tab and parses JSON output', async () => {
    const { executeInChromeTab } = await import('../src/chrome');
    const execFile = vi.fn().mockResolvedValue({
      stdout: '{"ok":true,"count":25}',
      stderr: '',
    });

    const result = await executeInChromeTab<{ ok: boolean; count: number }>('JSON.stringify({ ok: true, count: 25 })', {
      execFile,
    });

    expect(result).toEqual({ ok: true, count: 25 });
    expect(execFile).toHaveBeenCalledWith('osascript', ['-l', 'JavaScript', '-e', expect.stringContaining('execute')]);
  });

  it('surfaces an actionable error when JavaScript from Apple Events is disabled in Chrome', async () => {
    const { executeInChromeTab } = await import('../src/chrome');
    const execFile = vi
      .fn()
      .mockRejectedValue(
        new Error(
          '执行错误: 通过 AppleScript 执行 JavaScript 的功能已关闭。要开启此功能，请在菜单栏中依次转到“查看”>“开发者”>“允许 Apple 事件中的 JavaScript”。如需更多信息，请访问 https://support.google.com/chrome/?p=applescript',
        ),
      );

    await expect(
      executeInChromeTab('JSON.stringify({ ok: true })', {
        execFile,
      }),
    ).rejects.toThrow(/Apple Events/i);
  });
});
