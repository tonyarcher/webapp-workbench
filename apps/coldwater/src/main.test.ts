// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { mountApp } from './main';

beforeEach(() => {
    document.body.innerHTML = '';
});

describe('entry point', () => {
    it('mounts the app shell into a root element', () => {
        const root = document.createElement('div');
        document.body.appendChild(root);
        mountApp(root);
        expect(root.querySelector('cw-app-shell')).not.toBeNull();
    });

    it('does nothing without an app root', () => {
        mountApp(null);
        expect(document.querySelector('cw-app-shell')).toBeNull();
    });
});
