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

export function yieldDelay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, Math.max(0, ms));
  });
}

export class PlaybackClock {
  playing = false;
  private generation = 0;

  pause(): void {
    this.playing = false;
    this.generation += 1;
  }

  async play(step: () => Promise<boolean>): Promise<void> {
    const generation = this.generation + 1;
    this.generation = generation;
    this.playing = true;
    while (this.playing && this.generation === generation) {
      const keepGoing = await step();
      if (!keepGoing) break;
    }
    if (this.generation === generation) this.playing = false;
  }
}
