import { safeHttpUrl } from '../../services/parser';
import { upgradeImageUrl } from '../../services/image';
import styles from './lazy-img.css?inline';

type LoadState = 'waiting' | 'loading' | 'loaded' | 'error';

const loadedSrcs = new Set<string>();

export class LazyImg extends HTMLElement {
    private _src = '';
    private _primary = '';
    private _fallback: string | undefined;
    private triedFallback = false;
    private state: LoadState = 'waiting';
    private img: HTMLImageElement | null = null;
    private observer: IntersectionObserver | null = null;
    private readonly root: ShadowRoot;

    static get observedAttributes() {
        return ['src'];
    }

    constructor() {
        super();
        this.root = this.attachShadow({ mode: 'open' });
        const style = document.createElement('style');
        style.textContent = styles;
        this.root.appendChild(style);
    }

    get src(): string {
        return this._src;
    }

    set src(value: string) {
        const next = value ?? '';
        if (this._src === next) return;
        this._src = next;
        // Try the crisp sibling first; the URL the feed actually served stays
        // as fallback for CMSs where only the sized filename exists.
        this._primary = upgradeImageUrl(next) ?? next;
        this._fallback = this._primary === next ? undefined : next;
        this.triedFallback = false;
        this.reset();
    }

    connectedCallback() {
        const attr = this.getAttribute('src');
        if (attr != null && !this._src) this.src = attr;
        if (this.state === 'loaded' && !this.img && this.resolvedSrc()) {
            this.restoreLoaded();
            return;
        }
        if (this.state === 'loading') {
            // A prior load was interrupted by disconnect (virtual scroll);
            // restart, giving the fallback another chance if one is pending.
            this.state = 'waiting';
            this.img = null;
            this.triedFallback = false;
        }
        this.render();
        this.ensureObserved();
    }

    disconnectedCallback() {
        this.observer?.disconnect();
        this.observer = null;
        if (this.state !== 'loaded' && this.img) {
            this.img.src = '';
        }
        this.img = null;
    }

    attributeChangedCallback(name: string, _old: string | null, value: string | null) {
        if (name === 'src') this.src = value ?? '';
    }

    private reset() {
        this.observer?.disconnect();
        this.observer = null;
        if (this.img) {
            this.img.src = '';
            this.img = null;
        }
        this.state = 'waiting';
        if (this.isConnected) {
            this.render();
            this.ensureObserved();
        }
    }

    private resolvedSrc(): string | undefined {
        const raw = (this.triedFallback && this._fallback ? this._fallback : this._primary).trim();
        return safeHttpUrl(raw) ?? (raw.startsWith('data:image/') ? raw : undefined);
    }

    private restoreLoaded() {
        const src = this.resolvedSrc();
        if (!src) {
            this.state = 'error';
            this.img = null;
            this.render();
            return;
        }
        const img = document.createElement('img');
        img.alt = this.getAttribute('alt') ?? '';
        img.decoding = 'async';
        img.style.animation = 'none';
        img.src = src;
        this.img = img;
        this.state = 'loaded';
        loadedSrcs.add(src);
        this.render();
    }

    private ensureObserved() {
        if (!this.isConnected || this.state !== 'waiting' || !this._src) return;
        // Start loading promptly so above-the-fold media appears quickly, while
        // the placeholder/fade-in states keep the transition soft.
        this.load();
    }

    private load() {
        if (!this._src || this.state !== 'waiting') return;
        const src = this.resolvedSrc();
        if (!src) {
            this.state = 'error';
            this.render();
            return;
        }

        if (loadedSrcs.has(src)) {
            this.restoreLoaded();
            return;
        }

        const img = document.createElement('img');
        img.alt = this.getAttribute('alt') ?? '';
        img.decoding = 'async';
        img.addEventListener(
            'load',
            () => {
                loadedSrcs.add(img.src);
                this.state = 'loaded';
                this.img = img;
                this.render();
            },
            { once: false },
        );
        img.addEventListener(
            'error',
            () => {
                if (!this.triedFallback && this._fallback) {
                    this.triedFallback = true;
                    img.src = this._fallback;
                    return;
                }
                this.state = 'error';
                this.img = null;
                this.render();
            },
            { once: false },
        );
        img.src = src;
        this.img = img;

        if (img.complete) {
            loadedSrcs.add(src);
            this.state = 'loaded';
            this.render();
            return;
        }

        this.state = 'loading';
        this.render();
    }

    private render() {
        // Keep the adopted <style> as first child.
        while (this.root.childNodes.length > 1) {
            this.root.removeChild(this.root.lastChild!);
        }
        if (this.state === 'loaded' && this.img) {
            this.root.appendChild(this.img);
            return;
        }
        const placeholder = document.createElement('div');
        placeholder.className = `lazy-placeholder${this.state === 'error' ? ' lazy-error' : ''}`;
        this.root.appendChild(placeholder);
    }
}

customElements.define('lazy-img', LazyImg);
