import './test-setup';
import { expect } from '@esm-bundle/chai';
import '../src/web-components/lazy-img/lazy-img';

describe('lazy-img', () => {
    let host: HTMLElement | undefined;

    afterEach(() => {
        host?.remove();
        host = undefined;
    });

    it('loads an image when src is assigned as a property', async () => {
        host = document.createElement('div');
        document.body.append(host);
        const el = document.createElement('lazy-img') as HTMLElement & { src: string };
        host.appendChild(el);
        el.src = 'data:image/gif;base64,R0lGODlhAQABAAAAACw=';
        await Promise.resolve();
        const img = el.querySelector('img');
        expect(img).to.exist;
        expect(img!.getAttribute('src')).to.equal('data:image/gif;base64,R0lGODlhAQABAAAAACw=');
    });

    it('loads an image when src is set as an attribute', async () => {
        host = document.createElement('div');
        document.body.append(host);
        const el = document.createElement('lazy-img') as HTMLElement & { src: string };
        host.appendChild(el);
        el.setAttribute('src', 'data:image/gif;base64,R0lGODlhAQABAAAAACw=');
        await Promise.resolve();
        const img = el.querySelector('img');
        expect(img).to.exist;
        expect(img!.getAttribute('src')).to.equal('data:image/gif;base64,R0lGODlhAQABAAAAACw=');
    });
});
