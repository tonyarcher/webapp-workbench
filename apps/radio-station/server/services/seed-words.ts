import {randomInt} from 'node:crypto';

const ADJECTIVES = [
    'amber', 'velvet', 'neon', 'chrome', 'midnight', 'summer', 'glass', 'silver',
    'golden', 'static', 'lunar', 'pulse', 'signal', 'ivory', 'copper', 'violet',
    'autumn', 'sonic', 'bright', 'quiet',
];

const NOUNS = [
    'orbit', 'boulevard', 'frequency', 'skyline', 'chorus', 'voltage', 'afterglow',
    'oak', 'signal', 'harbor', 'echo', 'antenna', 'marquee', 'circuit', 'horizon',
    'stereo', 'dial', 'ribbon', 'canyon', 'spark',
];

export function randomSeed(): string {
    return `${ADJECTIVES[randomInt(ADJECTIVES.length)]}-${NOUNS[randomInt(NOUNS.length)]}`;
}

export function normalizeSeed(raw: string): string {
    const trimmed = raw.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return trimmed || randomSeed();
}
