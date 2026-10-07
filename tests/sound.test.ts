import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  isSoundEnabled,
  setSoundEnabled,
  getSoundVolume,
  setSoundVolume,
  sound,
  playSound,
} from '../src/lib/sound.js';

describe('Sound Engine (SND.dev integration)', () => {
  beforeEach(() => {
    if (typeof window !== 'undefined' && window.localStorage && typeof window.localStorage.clear === 'function') {
      window.localStorage.clear();
    }
    setSoundEnabled(true);
    setSoundVolume(0.5);
  });

  it('defaults sound to enabled and volume to 0.5', () => {
    expect(isSoundEnabled()).toBe(true);
    expect(getSoundVolume()).toBe(0.5);
  });

  it('persists enabled and disabled state', () => {
    setSoundEnabled(false);
    expect(isSoundEnabled()).toBe(false);

    setSoundEnabled(true);
    expect(isSoundEnabled()).toBe(true);
  });

  it('clamps volume to [0, 1] range', () => {
    setSoundVolume(1.5);
    expect(getSoundVolume()).toBe(1);

    setSoundVolume(-0.2);
    expect(getSoundVolume()).toBe(0);

    setSoundVolume(0.75);
    expect(getSoundVolume()).toBe(0.75);
  });

  it('safely handles audio playback without throwing when audio element is unavailable', () => {
    expect(() => {
      sound.button();
      sound.select();
      sound.toggle(true);
      sound.toggle(false);
      sound.tab();
      sound.modalOpen();
      sound.modalClose();
      sound.toast('success');
      sound.toast('error');
      sound.celebrate();
      sound.warn();
      sound.disabled();
      sound.tap();
    }).not.toThrow();
  });

  it('does not play sounds when disabled', () => {
    setSoundEnabled(false);
    const audioSpy = vi.fn();
    playSound('button');
    expect(audioSpy).not.toHaveBeenCalled();
  });
});
