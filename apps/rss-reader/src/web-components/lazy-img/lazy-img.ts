import {html, LitElement, unsafeCSS} from 'lit';
import {customElement, property, state} from 'lit/decorators.js';
import styles from './lazy-img.css?inline';

/**
 * Lazy-loads an image only when it approaches the viewport (500px preload
 * margin), with a pulsing placeholder while waiting and a fade-in on load.
 * Errors degrade to a quiet placeholder instead of a broken-image icon.
 */
@customElement('lazy-img')
export class LazyImg extends LitElement {
    static override styles = unsafeCSS(styles);

    @property() src: string | undefined;

    @state() private state: 'waiting' | 'loading' | 'loaded' | 'error' = 'waiting';

    private img: HTMLImageElement | null = null;
    private observer: IntersectionObserver | null = null;

    override willUpdate(changed: Map<string, unknown>) {
        if (changed.has('src')) {
            this.observer?.disconnect();
            this.observer = null;
            this.state = 'waiting';
        }
    }

    override updated() {
        if (this.state === 'waiting' && this.src && !this.observer) {
            this.observer = new IntersectionObserver(
                (entries) => {
                    if (entries.some((e) => e.isIntersecting)) {
                        this.observer?.disconnect();
                        this.observer = null;
                        this.load();
                    }
                },
                {rootMargin: '500px 0px'},
            );
            this.observer.observe(this);
        }
    }

    private load() {
        if (!this.src || this.state !== 'waiting') return;
        this.state = 'loading';
        const img = document.createElement('img');
        img.alt = '';
        img.decoding = 'async';
        img.addEventListener('load', () => {
            this.state = 'loaded';
        });
        img.addEventListener('error', () => {
            this.state = 'error';
        });
        img.src = this.src;
        this.img = img;
    }

    override disconnectedCallback() {
        super.disconnectedCallback();
        this.observer?.disconnect();
        this.observer = null;
        if (this.img) {
            this.img.src = '';
            this.img = null;
        }
    }

    override render() {
        if (this.state === 'loaded' && this.img) {
            return html`${this.img}`;
        }
        return html`<div class="lazy-placeholder ${this.state === 'error' ? 'lazy-error' : ''}"></div>`;
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'lazy-img': LazyImg;
    }
}
