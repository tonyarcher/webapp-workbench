import { html, LitElement, unsafeCSS } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { resolveEmbedUrl, type ArticleVideo } from '../../services/video';
import styles from './video-header.css?inline';

/**
 * Click-to-play video header for cards (the lite-facade pattern).
 *
 * Cards show a sharp poster with a play button; the iframe/<video> only loads
 * when the reader presses play. That keeps the list light (no autoplay, no
 * third-party player per row) and keeps keyboard users on a real button with
 * a named label. Posters fall back maxres -> sd -> hq -> mq because YouTube
 * only ships maxres for higher-resolution uploads; a missing maxres answers
 * 404 *or* a 120x90 placeholder with a 200, so the load handler rejects tiny
 * images by their natural size and the chain steps down.
 */

@customElement('video-header')
export class VideoHeader extends LitElement {
    static override styles = unsafeCSS(styles);

    @property({ attribute: false }) video!: ArticleVideo;
    @property({ attribute: false }) videoTitle = '';

    @state() private playing = false;
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

    private play() {
        this.playing = true;
    }

    private onKey(e: KeyboardEvent) {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            this.play();
        }
    }

    override render() {
        if (this.playing) return this.renderPlayer();
        const poster = this.video.posters[this.posterIndex];
        return html`
      <div class="poster-wrap">
        ${
            poster && !this.posterFailed
                ? html`<img class="poster" src=${poster} alt="" loading="lazy" decoding="async" @error=${() => this.onPosterError()} @load=${(e: Event) => this.onPosterLoad(e)} />`
                : html`<div class="poster poster-empty" aria-hidden="true"></div>`
        }
        <button type="button" class="play" aria-label="Play ${this.video.label}${this.videoTitle ? `: ${this.videoTitle}` : ''}" @click=${(
            e: Event,
        ) => {
            e.stopPropagation();
            this.play();
        }} @keydown=${(e: KeyboardEvent) => this.onKey(e)}>
          <span class="play-glyph" aria-hidden="true"></span>
        </button>
      </div>
    `;
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
