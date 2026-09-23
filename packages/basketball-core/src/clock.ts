import type { ClockStamp, ClockState } from './types';

export function formatClock(seconds: number): string {
    const clamped = Math.max(0, Math.round(seconds));
    const mins = Math.floor(clamped / 60);
    const secs = clamped % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function parseClock(text: string): number | null {
    const match = /^(\d{1,2}):([0-5]\d)$/.exec(text.trim());
    if (!match) return null;
    const mins = match[1];
    const secs = match[2];
    if (mins === undefined || secs === undefined) return null;
    return Number(mins) * 60 + Number(secs);
}

export function formatShotClock(seconds: number): string {
    return String(Math.max(0, Math.round(seconds)));
}

export function parseShotClock(text: string): number | null {
    const trimmed = text.trim();
    if (!/^\d{1,2}$/.test(trimmed)) return null;
    return Number(trimmed);
}

export function stepSeconds(current: number, delta: number, max: number): number {
    return Math.min(max, Math.max(0, current + delta));
}

export function stampFromClock(clock: ClockState): ClockStamp {
    return {
        period: clock.period,
        gameClockSeconds: clock.gameClockSeconds,
        shotClockSeconds: clock.shotClockSeconds,
    };
}

export function applyStamp(clock: ClockState, stamp: ClockStamp, running = clock.running): ClockState {
    return {
        period: stamp.period,
        gameClockSeconds: Math.max(0, stamp.gameClockSeconds),
        shotClockSeconds: Math.max(0, stamp.shotClockSeconds),
        running,
    };
}

export function elapsedSeconds(from: ClockStamp, until: ClockStamp): number {
    if (until.period !== from.period) return Math.max(0, from.gameClockSeconds);
    return Math.max(0, from.gameClockSeconds - until.gameClockSeconds);
}

export function isValidStamp(stamp: ClockStamp): boolean {
    if (!Number.isFinite(stamp.period) || stamp.period < 1) return false;
    if (!Number.isFinite(stamp.gameClockSeconds) || stamp.gameClockSeconds < 0) return false;
    return Number.isFinite(stamp.shotClockSeconds) && stamp.shotClockSeconds >= 0;
}
