export function detectBlocking(input: { html?: string; text?: string }): { blocked: boolean; reason?: string } {
  const combined = `${input.html ?? ''}\n${input.text ?? ''}`;
  const haystack = combined.toLowerCase();

  if (haystack.includes('unusual traffic') || haystack.includes('our systems have detected')) {
    return { blocked: true, reason: 'unusual_traffic' };
  }

  if (haystack.includes('captcha')) {
    return { blocked: true, reason: 'captcha' };
  }

  if (
    haystack.includes('enable javascript') ||
    haystack.includes('please wait while google trends finishes loading') ||
    combined.trim().length === 0
  ) {
    return { blocked: true, reason: 'interstitial' };
  }

  return { blocked: false };
}
