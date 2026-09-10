const IN_PLAY = new Set([
  'SINGLE',
  'DOUBLE',
  'TRIPLE',
  'HOME_RUN',
  'GROUNDOUT',
  'FLYOUT',
  'LINE_OUT',
  'POP_OUT',
  'SACRIFICE_FLY',
  'SACRIFICE_BUNT',
  'ERROR',
  'FIELDER_CHOICE',
]);

export const SPEED_OPTIONS = [
  { label: '1x', value: 1 },
  { label: '2x', value: 2 },
  { label: '4x', value: 4 },
  { label: '8x', value: 8 },
  { label: '16x', value: 16 },
  { label: 'Max', value: 0 },
] as const;

export function delayForPlay(type: string, speed: number, animations: boolean): number {
  if (speed <= 0) return 0;
  let base = 4000;
  if (type === 'HOME_RUN') base = 7000;
  else if (IN_PLAY.has(type)) base = 5500;
  else if (type === 'STOLEN_BASE' || type === 'CAUGHT_STEALING') base = 3000;
  const ms = base / speed;
  if (!animations) return Math.min(ms, 40);
  return ms;
}

export function yieldDelay(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) return Promise.resolve();
  return new Promise((resolve) => {
    const id = setTimeout(resolve, Math.max(0, ms));
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(id);
        resolve();
      },
      { once: true },
    );
  });
}

export class PlaybackClock {
  playing = false;
  private generation = 0;
  private abort: AbortController | null = null;

  get signal(): AbortSignal | undefined {
    return this.abort?.signal;
  }

  pause(): void {
    this.playing = false;
    this.generation += 1;
    this.abort?.abort();
    this.abort = null;
  }

  async play(step: () => Promise<boolean>): Promise<void> {
    this.abort?.abort();
    const generation = this.generation + 1;
    this.generation = generation;
    this.abort = new AbortController();
    const { signal } = this.abort;
    this.playing = true;
    while (this.playing && this.generation === generation && !signal.aborted) {
      const keepGoing = await step();
      if (!keepGoing || this.generation !== generation || signal.aborted) break;
    }
    if (this.generation === generation) this.playing = false;
  }
}
