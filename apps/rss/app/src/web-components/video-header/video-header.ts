import { html, LitElement, unsafeCSS } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { resolveEmbedUrl, type ArticleVideo } from '../../services/video';
import styles from './video-header.css?inline';

/**
 * Video header in two modes.
 *
 * Cards show the preview: cover art only, wrapped in a link to the watch
 * page (the YouTube page for YouTube articles, else the article link). No
 * inline player lives in the list. The expanded article shows the embed:
 * the iframe/<video> player directly, with no click-to-play step in between.
 *
 * Posters fall back maxres -> sd -> hq -> mq because YouTube only ships
 * maxres for higher-resolution uploads; a missing maxres answers 404 *or* a
 * 120x90 placeholder with a 200, so the load handler rejects tiny images by
 * their natural size and the chain steps down.
 */
export type VideoHeaderMode = 'preview' | 'embed';

@customElement('video-header')
export class VideoHeader extends LitElement {
    static override styles = unsafeCSS(styles);

    @property({ attribute: false }) video!: ArticleVideo;
    @property({ attribute: false }) videoTitle = '';
    /** Where the preview cover links. Embed mode ignores it. */
    @property({ attribute: false }) videoLink: string | undefined = undefined;
    @property({ attribute: false }) mode: VideoHeaderMode = 'preview';

    @state() private posterIndex = 0;
    @state() private posterFailed = false;

    private stepPoster() {
        if (this.posterIndex < this.video.posters.length - 1) {
            this.posterIndex += 1;
        } else {
            this.posterFailed = true;
        }
    }

    private onPosterError() {
        this.stepPoster();
    }

    /**
     * YouTube answers a missing maxres with a 120x90 placeholder and a 200,
     * so no error fires. Every real thumbnail is at least 320px wide, so a
     * tiny natural size means "no such poster" and the chain steps down.
     */
    private onPosterLoad(e: Event) {
        const img = e.target as HTMLImageElement | null;
        if (img && img.naturalWidth > 0 && img.naturalWidth < 200) this.stepPoster();
    }

    override render() {
        if (this.mode === 'embed') return this.renderPlayer();
        return this.renderPreview();
    }

    /**
     * Cover art only. In article lists the click bubbles to the card so the
     * picture opens the article view like any other cover.
     */
    private renderPreview() {
        const poster = this.video.posters[this.posterIndex];
        const visual =
            poster && !this.posterFailed
                ? html`<img class="poster" src=${poster} alt="" loading="lazy" decoding="async" @error=${() => this.onPosterError()} @load=${(e: Event) => this.onPosterLoad(e)} />`
                : html`<div class="poster poster-empty" aria-hidden="true"></div>`;
        return html`<div class="poster-wrap">${visual}</div>`;
    }

    private renderPlayer() {
        if (this.video.provider === 'direct') {
            return html`<video class="player" src=${this.video.embedUrl} controls autoplay playsinline></video>`;
        }
        const src = resolveEmbedUrl(this.video, globalThis.location?.hostname ?? '');
        return html`<iframe
        class="player"
        src=${src}
        title=${this.videoTitle || this.video.label}
        allow="accelerometer; autoplay; encrypted-media; picture-in-picture"
        allowfullscreen
      ></iframe>`;
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'video-header': VideoHeader;
    }
}
