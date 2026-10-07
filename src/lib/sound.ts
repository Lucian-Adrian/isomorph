// ============================================================
// Isomorph Sound FX Engine (SND.dev integration)
// ============================================================

export type SoundEffect =
  | 'button'
  | 'select'
  | 'toggle_on'
  | 'toggle_off'
  | 'transition_up'
  | 'transition_down'
  | 'notification'
  | 'celebration'
  | 'caution'
  | 'beep_warning'
  | 'disabled'
  | 'swipe_01'
  | 'tap_01';

const SOUND_PATHS: Record<SoundEffect, string> = {
  button: '/sounds/button.wav',
  select: '/sounds/select.wav',
  toggle_on: '/sounds/toggle_on.wav',
  toggle_off: '/sounds/toggle_off.wav',
  transition_up: '/sounds/transition_up.wav',
  transition_down: '/sounds/transition_down.wav',
  notification: '/sounds/notification.wav',
  celebration: '/sounds/celebration.wav',
  caution: '/sounds/caution.wav',
  beep_warning: '/sounds/beep_warning.wav',
  disabled: '/sounds/disabled.wav',
  swipe_01: '/sounds/swipe_01.wav',
  tap_01: '/sounds/tap_01.wav',
};

const STORAGE_KEY_ENABLED = 'isomorph-sound-enabled';
const STORAGE_KEY_VOLUME = 'isomorph-sound-volume';

let soundEnabledCache: boolean | null = null;
let soundVolumeCache: number | null = null;

export function isSoundEnabled(): boolean {
  if (soundEnabledCache !== null) return soundEnabledCache;
  if (typeof window === 'undefined' || !window.localStorage || typeof window.localStorage.getItem !== 'function') {
    soundEnabledCache = true;
    return true;
  }
  try {
    const val = window.localStorage.getItem(STORAGE_KEY_ENABLED);
    soundEnabledCache = val !== 'false';
  } catch {
    soundEnabledCache = true;
  }
  return soundEnabledCache;
}

export function setSoundEnabled(enabled: boolean): void {
  soundEnabledCache = enabled;
  if (typeof window !== 'undefined' && window.localStorage && typeof window.localStorage.setItem === 'function') {
    try {
      window.localStorage.setItem(STORAGE_KEY_ENABLED, enabled ? 'true' : 'false');
    } catch {
      // Ignore storage errors
    }
  }
}

export function getSoundVolume(): number {
  if (soundVolumeCache !== null) return soundVolumeCache;
  if (typeof window === 'undefined' || !window.localStorage || typeof window.localStorage.getItem !== 'function') {
    soundVolumeCache = 0.5;
    return 0.5;
  }
  try {
    const val = window.localStorage.getItem(STORAGE_KEY_VOLUME);
    if (val === null) {
      soundVolumeCache = 0.5;
    } else {
      const num = parseFloat(val);
      soundVolumeCache = isNaN(num) ? 0.5 : Math.max(0, Math.min(1, num));
    }
  } catch {
    soundVolumeCache = 0.5;
  }
  return soundVolumeCache;
}

export function setSoundVolume(volume: number): void {
  const clamped = Math.max(0, Math.min(1, volume));
  soundVolumeCache = clamped;
  if (typeof window !== 'undefined' && window.localStorage && typeof window.localStorage.setItem === 'function') {
    try {
      window.localStorage.setItem(STORAGE_KEY_VOLUME, clamped.toFixed(2));
    } catch {
      // Ignore storage errors
    }
  }
}

// Audio element cache for instant playback
const audioPool: Partial<Record<SoundEffect, HTMLAudioElement[]>> = {};

function getAudioInstance(effect: SoundEffect): HTMLAudioElement | null {
  if (typeof window === 'undefined' || typeof Audio === 'undefined') return null;
  const pool = audioPool[effect] || [];
  // Find an audio element that is currently paused/idle
  for (const audio of pool) {
    if (audio.paused || audio.ended) {
      return audio;
    }
  }

  // Create a new audio element (pool up to 4 concurrent sounds per effect)
  if (pool.length < 4) {
    try {
      const audio = new Audio(SOUND_PATHS[effect]);
      audio.preload = 'auto';
      pool.push(audio);
      audioPool[effect] = pool;
      return audio;
    } catch {
      return null;
    }
  }

  // Re-use first element if pool is full
  return pool[0] ?? null;
}

export function playSound(effect: SoundEffect): void {
  if (!isSoundEnabled()) return;
  const volume = getSoundVolume();
  if (volume <= 0) return;

  const audio = getAudioInstance(effect);
  if (!audio) return;

  try {
    audio.volume = volume;
    audio.currentTime = 0;
    const playPromise = audio.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(() => {
        // Silently catch browser autoplay prevention
      });
    }
  } catch {
    // Ignore audio playback exceptions
  }
}

export const sound = {
  play: playSound,
  button: () => playSound('button'),
  select: () => playSound('select'),
  toggle: (state?: boolean) => {
    if (state === undefined) {
      playSound('button');
    } else {
      playSound(state ? 'toggle_on' : 'toggle_off');
    }
  },
  tab: () => playSound('swipe_01'),
  modalOpen: () => playSound('transition_up'),
  modalClose: () => playSound('transition_down'),
  toast: (type?: 'success' | 'error' | 'info') => {
    if (type === 'error') {
      playSound('caution');
    } else {
      playSound('notification');
    }
  },
  celebrate: () => playSound('celebration'),
  warn: () => playSound('beep_warning'),
  disabled: () => playSound('disabled'),
  tap: () => playSound('tap_01'),
};
