import { execFile as execFileCallback } from 'node:child_process';
import { promisify } from 'node:util';
import type { ChromeTab } from './types';

interface ExecFileResult {
  stdout: string;
  stderr: string;
}

type ExecFileFn = (file: string, args: string[]) => Promise<ExecFileResult>;

export interface ChromeDeps {
  execFile: ExecFileFn;
}

const execFile = promisify(execFileCallback) as ExecFileFn;

const LIST_TABS_SCRIPT = `
const chrome = Application('Google Chrome');
const tabs = [];
const windows = chrome.windows();
for (let w = 0; w < windows.length; w++) {
  const window = windows[w];
  const activeTabIndex = Number(window.activeTabIndex());
  const windowTabs = window.tabs();
  for (let t = 0; t < windowTabs.length; t++) {
    const tab = windowTabs[t];
    tabs.push({
      windowIndex: w + 1,
      tabIndex: t + 1,
      title: String(tab.title()),
      url: String(tab.url()),
      active: activeTabIndex === t + 1
    });
  }
}
JSON.stringify(tabs);
`;

export async function listChromeTabs(deps: Partial<ChromeDeps> = {}): Promise<ChromeTab[]> {
  const stdout = await runJxa(LIST_TABS_SCRIPT, deps);
  const parsed = JSON.parse(stdout) as ChromeTab[];

  return parsed.filter((tab) => tab.url.startsWith('https://trends.google.com/trends/explore'));
}

export function orderTabsForCollection(tabs: ChromeTab[]): ChromeTab[] {
  return [...tabs].sort((a, b) => {
    if (a.windowIndex !== b.windowIndex) {
      return a.windowIndex - b.windowIndex;
    }

    return a.tabIndex - b.tabIndex;
  });
}

export async function activateChromeTab(tab: ChromeTab, deps: Partial<ChromeDeps> = {}): Promise<void> {
  await runJxa(
    `
const chrome = Application('Google Chrome');
chrome.activate();
const window = chrome.windows[${tab.windowIndex - 1}];
window.activeTabIndex = ${tab.tabIndex};
`,
    deps,
  );
}

export async function executeInChromeTab<T>(tab: ChromeTab, script: string, deps: Partial<ChromeDeps> = {}): Promise<T> {
  const escapedScript = JSON.stringify(script);
  const stdout = await runJxa(
    `
const chrome = Application('Google Chrome');
const window = chrome.windows[${tab.windowIndex - 1}];
const tab = window.tabs[${tab.tabIndex - 1}];
const result = tab.execute({ javascript: ${escapedScript} });
result;
`,
    deps,
  );

  return JSON.parse(stdout) as T;
}

export async function clickNextQueryPage(
  tab: ChromeTab,
  queryIndex: number,
  deps: Partial<ChromeDeps> = {},
): Promise<{ clicked: boolean; reason?: string }> {
  return executeInChromeTab<{ clicked: boolean; reason?: string }>(
    tab,
    `
(() => {
  const nextButtons = Array.from(document.querySelectorAll('button[aria-label="Next"]'))
    .filter((button) => /queries/i.test(button.parentElement?.textContent || ''));
  const button = nextButtons[${queryIndex}];
  if (!button) {
    return JSON.stringify({ clicked: false, reason: 'not_found' });
  }
  if (button.disabled || button.getAttribute('disabled') !== null) {
    return JSON.stringify({ clicked: false, reason: 'disabled' });
  }
  button.click();
  return JSON.stringify({ clicked: true });
})()
`.trim(),
    deps,
  );
}

async function runJxa(script: string, deps: Partial<ChromeDeps>): Promise<string> {
  const runtime: ChromeDeps = {
    execFile,
    ...deps,
  };

  try {
    const result = await runtime.execFile('osascript', ['-l', 'JavaScript', '-e', script]);

    return result.stdout.trim();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (message.toLowerCase().includes('not authorized to send apple events')) {
      throw new Error('Automation permission for Google Chrome is required on macOS.');
    }

    if (message.includes('允许 Apple 事件中的 JavaScript') || message.toLowerCase().includes('apple events')) {
      throw new Error('Enable "Allow JavaScript from Apple Events" in Google Chrome Developer settings.');
    }

    throw error;
  }
}
