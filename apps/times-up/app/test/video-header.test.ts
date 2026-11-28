// A video poster in a list card must open the article, and the expanded
// player must fill its 16:9 frame. Both broke in the vanilla-DOM refactor.
import './test-setup';
import { expect } from '@esm-bundle/chai';
import '../src/web-components/video-header/video-header';
import type { VideoHeader } from '../src/web-components/video-header/video-header';
import type { ArticleVideo } from '../src/services/video';

const video: ArticleVideo = {
    provider: 'youtube',
    id: 'abcdefghijk',
    embedUrl: 'https://www.youtube-nocookie.com/embed/abcdefghijk',
    posters: ['https://i.ytimg.com/vi/abcdefghijk/maxresdefault.jpg'],
    label: 'YouTube',
};

function mount(): VideoHeader {
    const el = document.createElement('video-header') as VideoHeader;
    document.body.append(el);
    el.video = video;
    el.videoTitle = 'A video article';
    el.videoLink = 'https://www.youtube.com/watch?v=abcdefghijk';
    return el;
}

describe('video-header', () => {
    let el: VideoHeader | undefined;

    afterEach(() => {
        el?.remove();
        el = undefined;
    });

    it('opens the article on a poster click instead of linking to the watch page', () => {
        el = mount();
        const root = el.shadowRoot!;
        expect(root.querySelector('a')).to.equal(null);
        const poster = root.querySelector<HTMLImageElement>('img.poster')!;
        expect(poster.alt).to.equal('A video article');
        let opens = 0;
        el.addEventListener('click', () => {
            opens += 1;
        });
        poster.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
        expect(opens).to.equal(1);
    });

    it('sizes the embedded player with the .player class', () => {
        el = mount();
        el.mode = 'embed';
        const frame = el.shadowRoot!.querySelector<HTMLIFrameElement>('iframe')!;
        expect(frame.className).to.equal('player');
        expect(frame.src).to.equal(video.embedUrl);
    });
});
