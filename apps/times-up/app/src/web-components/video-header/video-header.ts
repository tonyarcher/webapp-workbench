import type { ArticleVideo } from '../../services/video';
import styles from './video-header.css?inline';

export type VideoHeaderMode = 'preview' | 'embed';

export class VideoHeader extends HTMLElement {
    private _video: ArticleVideo | null = null;
    private _videoTitle = '';
    private _videoLink: string | undefined = undefined;
    private _mode: VideoHeaderMode = 'preview';

    get video() {
        return this._video as ArticleVideo;
    }
    set video(v: ArticleVideo) {
        this._video = v;
        this.paint();
    }
    get videoTitle() {
        return this._videoTitle;
    }
    set videoTitle(v: string) {
        this._videoTitle = v;
        this.paint();
    }
    get videoLink() {
        return this._videoLink;
    }
    set videoLink(v: string | undefined) {
        this._videoLink = v;
        this.paint();
    }
    get mode() {
        return this._mode;
    }
    set mode(v: VideoHeaderMode) {
        this._mode = v;
        this.paint();
    }
    private posterIndex = 0;
    private root: HTMLDivElement | null = null;

    static get observedAttributes() {
        return ['mode', 'video-title', 'video-link'];
    }

    connectedCallback() {
        const shadow = this.attachShadow({ mode: 'open' });
        const style = document.createElement('style');
        style.textContent = styles;
        shadow.appendChild(style);
        this.root = document.createElement('div');
        this.root.className = 'video-header';
        shadow.appendChild(this.root);
        this.paint();
    }

    attributeChangedCallback(name: string, _old: string | null, value: string | null) {
        if (name === 'mode') this.mode = (value as VideoHeaderMode) ?? 'preview';
        if (name === 'video-title') this.videoTitle = value ?? '';
        if (name === 'video-link') this.videoLink = value ?? undefined;
        this.paint();
    }

    // property setters for .video, .videoTitle, .videoLink, .mode
    private stepPoster() {
        if (!this.video) return;
        if (this.posterIndex < this.video.posters.length - 1) {
            this.posterIndex += 1;
        }
        this.paint();
    }

    private onPosterError() {
        this.stepPoster();
    }

    private onPosterLoad(img: HTMLImageElement) {
        if (img && img.naturalWidth > 0 && img.naturalWidth < 200) this.stepPoster();
    }

    private paint() {
        if (!this.root || !this.video) return;
        this.root.replaceChildren();
        if (this.mode === 'embed') {
            this.renderPlayer();
        } else {
            this.renderPreview();
        }
    }

    private renderPreview() {
        if (!this.root || !this.video) return;
        const link = this.videoLink ?? '#';
        const a = document.createElement('a');
        a.href = link;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        const img = document.createElement('img');
        img.className = 'poster';
        const posterUrl = this.video.posters[this.posterIndex];
        if (posterUrl) img.src = posterUrl;
        img.alt = this.videoTitle;
        img.addEventListener('load', (e) => this.onPosterLoad(e.target as HTMLImageElement));
        img.addEventListener('error', () => this.onPosterError());
        a.appendChild(img);
        this.root.appendChild(a);
    }

    private renderPlayer() {
        if (!this.root || !this.video) return;
        const iframe = document.createElement('iframe');
        iframe.src = this.video.embedUrl;
        iframe.title = this.videoTitle;
        iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
        iframe.allowFullscreen = true;
        this.root.appendChild(iframe);
    }
}

customElements.define('video-header', VideoHeader);
