import './test-setup';
import { expect } from '@esm-bundle/chai';
import { ArticleFocus } from '../src/web-components/article-view/article-view-focus';

describe('article focus mode', () => {
    it('spotlights one block and cleans up when disabled', async () => {
        const host = document.createElement('div');
        host.style.height = '200px';
        host.style.overflow = 'auto';
        const shadow = host.attachShadow({ mode: 'open' });
        const content = document.createElement('div');
        content.className = 'content';
        for (let index = 0; index < 3; index += 1) {
            const paragraph = document.createElement('p');
            paragraph.textContent = `Paragraph ${index + 1}`;
            paragraph.style.height = '100px';
            content.appendChild(paragraph);
        }
        shadow.appendChild(content);
        document.body.appendChild(host);
        const focus = new ArticleFocus(host);
        try {
            focus.enable();
            await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
            expect(host.classList.contains('focus-mode')).to.equal(true);
            expect(content.querySelectorAll('.focus-active').length).to.equal(1);
            focus.disable();
            expect(host.classList.contains('focus-mode')).to.equal(false);
            expect(content.querySelectorAll('.focus-active').length).to.equal(0);
        } finally {
            focus.reset();
            host.remove();
        }
    });
});
