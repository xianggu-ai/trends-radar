import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { detectBlocking } from '../src/blocking';

function unusualTrafficFixture(): string {
  return readFileSync(new URL('../fixtures/trends-unusual-traffic.html', import.meta.url), 'utf-8');
}

function emptyInterstitialFixture(): string {
  return readFileSync(new URL('../fixtures/trends-empty-interstitial.html', import.meta.url), 'utf-8');
}

describe('detectBlocking', () => {
  it('does not classify normal trends content as blocked', async () => {
    const html = '<main><h1>Related queries</h1><p>chatgpt sell house</p></main>';

    expect(detectBlocking({ html, text: html })).toEqual({ blocked: false });
  });

  it('detects unusual traffic html', async () => {
    const html = unusualTrafficFixture();

    expect(detectBlocking({ html, text: html })).toMatchObject({
      blocked: true,
      reason: 'unusual_traffic',
    });
  });

  it('treats blank/interstitial responses as blocked instead of empty success', async () => {
    const html = emptyInterstitialFixture();

    expect(detectBlocking({ html, text: html })).toMatchObject({
      blocked: true,
      reason: 'interstitial',
    });
  });
});
