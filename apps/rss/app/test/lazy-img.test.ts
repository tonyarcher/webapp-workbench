import './test-setup';
import { expect } from '@esm-bundle/chai';
import '../src/web-components/lazy-img/lazy-img';

describe('lazy-img', () => {
    let host: HTMLElement | undefined;

    afterEach(() => {
        host?.remove();
        host = undefined;
    });

    async function waitForImg(el: Element): Promise<HTMLImageElement> {
        for (let i = 0; i < 50; i++) {
            const img = (el.shadowRoot ?? el).querySelector('img');
            if (img) return img as HTMLImageElement;
            await new Promise((r) => setTimeout(r, 20));
        }
        throw new Error('lazy-img did not render an img');
    }

    it('loads an image when src is assigned as a property', async () => {
        host = document.createElement('div');
        document.body.append(host);
        const el = document.createElement('lazy-img') as HTMLElement & { src: string };
        host.appendChild(el);
        el.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="1" height="1"%3E%3C/svg%3E';
        const img = await waitForImg(el);
        expect(img.getAttribute('src')).to.equal(
            'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="1" height="1"%3E%3C/svg%3E',
        );
    });

    it('loads an image when src is set as an attribute', async () => {
        host = document.createElement('div');
        document.body.append(host);
        const el = document.createElement('lazy-img') as HTMLElement & { src: string };
        host.appendChild(el);
        el.setAttribute(
            'src',
            'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="1" height="1"%3E%3C/svg%3E',
        );
        const img = await waitForImg(el);
        expect(img.getAttribute('src')).to.equal(
            'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="1" height="1"%3E%3C/svg%3E',
        );
    });
});
