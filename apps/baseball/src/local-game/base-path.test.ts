import { describe, expect, it } from 'vitest';
import { addBasePath, normalizeBasePath, normalizePath, stripBasePath } from './base-path';

describe('normalizeBasePath', () => {
  it('normalizes root base `/` and empty string to `/`', () => {
    expect(normalizeBasePath('/')).toBe('/');
    expect(normalizeBasePath('')).toBe('/');
  });

  it('strips a trailing slash from a subpath base', () => {
    expect(normalizeBasePath('/baseball/')).toBe('/baseball');
  });

  it('adds a leading slash to a bare subpath base', () => {
    expect(normalizeBasePath('baseball/')).toBe('/baseball');
  });
});

describe('normalizePath', () => {
  it('keeps root as `/`', () => {
    expect(normalizePath('/')).toBe('/');
    expect(normalizePath('')).toBe('/');
    expect(normalizePath('/game/')).toBe('/game');
    expect(normalizePath('game')).toBe('/game');
  });
});

describe('stripBasePath', () => {
  it('returns normalized path unchanged for root base `/`', () => {
    expect(stripBasePath('/', '/')).toBe('/');
    expect(stripBasePath('/game', '/')).toBe('/game');
    expect(stripBasePath('/game/', '/')).toBe('/game');
  });

  it('maps the subpath base root to `/`', () => {
    expect(stripBasePath('/', '/baseball/')).toBe('/');
    expect(stripBasePath('/baseball/', '/baseball/')).toBe('/');
    expect(stripBasePath('/baseball', '/baseball/')).toBe('/');
  });

  it('strips the subpath base from nested paths', () => {
    expect(stripBasePath('/baseball/game', '/baseball/')).toBe('/game');
    expect(stripBasePath('/baseball/game/', '/baseball/')).toBe('/game');
  });

  it('leaves unrelated paths untouched', () => {
    expect(stripBasePath('/some/other', '/baseball/')).toBe('/some/other');
  });
});

describe('addBasePath', () => {
  it('returns path unchanged for root base `/`', () => {
    expect(addBasePath('/', '/')).toBe('/');
    expect(addBasePath('/game', '/')).toBe('/game');
  });

  it('prefixes the base for a subpath base', () => {
    expect(addBasePath('/', '/baseball/')).toBe('/baseball');
    expect(addBasePath('/game', '/baseball/')).toBe('/baseball/game');
  });

  it('preserves root and nested paths', () => {
    expect(addBasePath('/', '/baseball')).toBe('/baseball');
    expect(addBasePath('/game', '/baseball')).toBe('/baseball/game');
  });
});
