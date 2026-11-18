import { safeHttpUrl } from '../../services/parser';
import styles from './lazy-img.css?inline';

type LoadState = 'waiting' | 'loading' | 'loaded' | 'error';

export class LazyImg extends HTMLElement {
    private _src = '';
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
        this.reset();
    }

    connectedCallback() {
        const attr = this.getAttribute('src');
        if (attr != null && !this._src) this._src = attr;
        this.render();
        this.ensureObserved();
    }

    disconnectedCallback() {
        this.observer?.disconnect();
        this.observer = null;
        if (this.img) {
            this.img.src = '';
            this.img = null;
        }
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

    private ensureObserved() {
        if (!this.isConnected || this.state !== 'waiting' || !this._src) return;
        // Start loading promptly so above-the-fold media appears quickly, while
        // the placeholder/fade-in states keep the transition soft.
        this.load();
    }

    private load() {
        if (!this._src || this.state !== 'waiting') return;
        const raw = this._src.trim();
        const src = safeHttpUrl(raw) ?? (raw.startsWith('data:image/') ? raw : undefined);
        if (!src) {
            this.state = 'error';
            this.render();
            return;
        }
        this.state = 'loading';
        this.render();
        const img = document.createElement('img');
        img.alt = this.getAttribute('alt') ?? '';
        img.decoding = 'async';
        img.addEventListener(
            'load',
            () => {
                this.state = 'loaded';
                this.render();
            },
            { once: true },
        );
        img.addEventListener(
            'error',
            () => {
                this.state = 'error';
                this.img = null;
                this.render();
            },
            { once: true },
        );
        img.src = src;
        this.img = img;
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
