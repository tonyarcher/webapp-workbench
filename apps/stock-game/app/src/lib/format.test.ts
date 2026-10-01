import { describe, expect, it } from 'vitest';
import { fmtDate, fmtDateTime, fmtMoney, fmtMoneySigned, fmtNumber, fmtPct, fmtPrice } from './format';

describe('fmtMoney', () => {
    it('renders dollars from integer cents', () => {
        expect(fmtMoney(123_456)).toContain('1,234.56');
        expect(fmtMoney(0)).toContain('0.00');
        expect(fmtMoney(-2_500)).toContain('25.00');
    });
});

describe('fmtMoneySigned', () => {
    it('marks a gain with a plus', () => {
        expect(fmtMoneySigned(5_000)).toMatch(/^\+\$?/);
        expect(fmtMoneySigned(5_000)).toContain('50.00');
    });

    it('marks a loss with a minus, and shows the magnitude', () => {
        expect(fmtMoneySigned(-5_000)).toMatch(/^-/);
        expect(fmtMoneySigned(-5_000)).toContain('50.00');
        expect(fmtMoneySigned(-5_000)).not.toContain('-50.00');
    });

    it('carries no sign at all for zero', () => {
        expect(fmtMoneySigned(0)).not.toMatch(/^[+-]/);
        expect(fmtMoneySigned(0)).toContain('0.00');
    });
});

describe('fmtPct', () => {
    it('marks a gain with a plus and a loss with nothing', () => {
        expect(fmtPct(1.5)).toBe('+1.50%');
        expect(fmtPct(-1.5)).toBe('-1.50%');
        expect(fmtPct(0)).toBe('0.00%');
    });

    it('rounds to two places', () => {
        expect(fmtPct(0.126)).toBe('+0.13%');
        expect(fmtPct(12)).toBe('+12.00%');
    });
});

describe('fmtPrice', () => {
    it('always shows two decimal places', () => {
        expect(fmtPrice(234.5)).toBe('$234.50');
        expect(fmtPrice(234)).toBe('$234.00');
        expect(fmtPrice(0.005)).toBe('$0.01');
    });
});

describe('fmtNumber', () => {
    it('groups thousands', () => {
        expect(fmtNumber(1234567)).toContain('1,234,567');
        expect(fmtNumber(0)).toBe('0');
    });
});

describe('dates', () => {
    const ms = Date.parse('2024-01-02T14:30:00Z');

    it('names the day', () => {
        const text = fmtDate(ms);
        expect(text).toContain('2024');
        expect(text).toContain('2');
    });

    it('adds the time of day', () => {
        const text = fmtDateTime(ms);
        expect(text).toContain('2024');
        expect(text).toMatch(/\d{1,2}:\d{2}/);
    });
});
