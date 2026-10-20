// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readHighScore, writeHighScore } from './high-score';

beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
});

describe('high score', () => {
    it('starts at zero', () => {
        expect(readHighScore()).toBe(0);
    });

    it('keeps the best score only', () => {
        writeHighScore(120);
        writeHighScore(80);
        expect(readHighScore()).toBe(120);
        writeHighScore(240);
        expect(readHighScore()).toBe(240);
    });

    it('ignores bad stored values', () => {
        window.localStorage.setItem('coldwater:high-score:v1', 'not a number');
        expect(readHighScore()).toBe(0);
        window.localStorage.setItem('coldwater:high-score:v1', '-4');
        expect(readHighScore()).toBe(0);
    });

    it('survives a storage denial', () => {
        vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
            throw new Error('denied');
        });
        expect(readHighScore()).toBe(0);
        expect(() => writeHighScore(10)).not.toThrow();
    });
});
