import { describe, expect, it } from 'vitest';
import { apiUrl } from './api';
import { parseAppConfig, resolveApiBase, setAppConfig } from './config';

describe('config', () => {
    it('parses the app-config block', () => {
        expect(parseAppConfig(null).apiBase).toBe('');
        expect(parseAppConfig(undefined).apiBase).toBe('');
        expect(parseAppConfig('').apiBase).toBe('');
        expect(parseAppConfig('{"apiBase":"https://api.example.com"}').apiBase).toBe('https://api.example.com');
        expect(parseAppConfig('{}').apiBase).toBe('');
        expect(parseAppConfig('{"apiBase":123}').apiBase).toBe('');
        expect(parseAppConfig('{"apiBase":null}').apiBase).toBe('');
        expect(parseAppConfig('not json').apiBase).toBe('');
    });

    it('resolves the api base chain', () => {
        expect(resolveApiBase('https://cfg.example', 'https://vite.example', '/stock-game/')).toBe(
            'https://cfg.example',
        );
        expect(resolveApiBase('', 'https://vite.example', '/stock-game/')).toBe('https://vite.example');
        expect(resolveApiBase('', undefined, '/stock-game/')).toBe('/stock-game/api');
        expect(resolveApiBase('', undefined, '/')).toBe('/api');
        expect(resolveApiBase('', undefined, 'stock-game')).toBe('stock-game/api');
    });

    it('reads the api base through apiUrl', () => {
        setAppConfig(parseAppConfig('{"apiBase":"https://cfg.example"}'));
        expect(apiUrl('/config')).toBe('https://cfg.example/config');
        setAppConfig(parseAppConfig(''));
        expect(apiUrl('/config')).toBe('/api/config');
    });
});
