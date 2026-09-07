import { describe, expect, it, vi } from 'vitest';
import { delayForPlay, PlaybackClock, SPEED_OPTIONS } from './playback';

describe('playback', () => {
  it('scales delay with speed and collapses it when animations are off', () => {
    expect(delayForPlay('BALL', 1, true)).toBe(4000);
    expect(delayForPlay('BALL', 2, true)).toBe(2000);
    expect(delayForPlay('SINGLE', 1, true)).toBe(5500);
    expect(delayForPlay('BALL', 0, true)).toBe(0);
    expect(delayForPlay('HOME_RUN', 1, false)).toBe(40);
  });

  it('exposes speed presets including max', () => {
    expect(SPEED_OPTIONS.some((option) => option.value === 0 && option.label === 'Max')).toBe(true);
  });

  it('stops the loop on pause', async () => {
    const clock = new PlaybackClock();
    let steps = 0;
    await clock.play(async () => {
      steps += 1;
      if (steps === 3) clock.pause();
      return true;
    });
    expect(steps).toBe(3);
    expect(clock.playing).toBe(false);
  });

  it('does not continue a previous run after a new play() call', async () => {
    vi.useFakeTimers();
    const clock = new PlaybackClock();
    let first = 0;
    let second = 0;
    const firstRun = clock.play(async () => {
      first += 1;
      await new Promise((resolve) => setTimeout(resolve, 10));
      return true;
    });
    const secondRun = clock.play(async () => {
      second += 1;
      clock.pause();
      return true;
    });
    await vi.runAllTimersAsync();
    await Promise.all([firstRun, secondRun]);
    expect(second).toBe(1);
    expect(first).toBeLessThanOrEqual(2);
    vi.useRealTimers();
  });
});
