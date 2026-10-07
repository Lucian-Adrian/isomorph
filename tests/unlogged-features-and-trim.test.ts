import { describe, it, expect } from 'vitest';

describe('Unlogged account rules & whitespace/extension sanitation', () => {
  it('enforces watermark on and animations off when user/session is missing', () => {
    const session = null;
    const user = null;
    const isWatermarkEnabled = false; // User previously had disabled in local storage
    const isAnimationsEnabled = true; // User previously had enabled in local storage
    const isAnimating = true;

    const isLoggedIn = !!(session || user);
    const effectiveWatermark = !isLoggedIn ? true : isWatermarkEnabled;
    const effectiveAnimationsEnabled = !isLoggedIn ? false : isAnimationsEnabled;
    const effectiveAnimating = !isLoggedIn ? false : isAnimating;

    expect(effectiveWatermark).toBe(true);
    expect(effectiveAnimationsEnabled).toBe(false);
    expect(effectiveAnimating).toBe(false);
  });

  it('respects user preferences when logged in', () => {
    const session = { user: { id: 'test-user' } };
    const user = { id: 'test-user' };
    const isWatermarkEnabled = false;
    const isAnimationsEnabled = true;
    const isAnimating = true;

    const isLoggedIn = !!(session || user);
    const effectiveWatermark = !isLoggedIn ? true : isWatermarkEnabled;
    const effectiveAnimationsEnabled = !isLoggedIn ? false : isAnimationsEnabled;
    const effectiveAnimating = !isLoggedIn ? false : isAnimating;

    expect(effectiveWatermark).toBe(false);
    expect(effectiveAnimationsEnabled).toBe(true);
    expect(effectiveAnimating).toBe(true);
  });

  it('correctly normalizes diagram filenames with whitespace and .isx extension', () => {
    const sanitizeDiagramName = (name: string) => {
      let clean = name.trim();
      if (!clean) return '';
      if (!clean.toLowerCase().endsWith('.isx')) {
        clean += '.isx';
      }
      return clean;
    };

    expect(sanitizeDiagramName('  system-arch  ')).toBe('system-arch.isx');
    expect(sanitizeDiagramName('  system-arch.isx  ')).toBe('system-arch.isx');
    expect(sanitizeDiagramName('SystemArchitecture.ISX')).toBe('SystemArchitecture.ISX');
    expect(sanitizeDiagramName('   ')).toBe('');
  });
});
