export class LazyImg extends HTMLElement {
    private _src = '';
    private observer: IntersectionObserver | null = null;
    private root: HTMLDivElement | null = null;

    static get observedAttributes() {
        return ['src'];
    }

    get src(): string {
        return this._src;
    }

    set src(value: string) {
        const next = value ?? '';
        if (this._src === next) return;
        this._src = next;
        if (this.isConnected) this.load();
    }

    connectedCallback() {
        if (!this.root) {
            this.root = document.createElement('div');
            this.root.className = 'lazy-img';
            this.appendChild(this.root);
        }
        const attr = this.getAttribute('src');
        if (attr != null && !this._src) this._src = attr;
        this.observe();
    }

    disconnectedCallback() {
        this.observer?.disconnect();
        this.observer = null;
    }

    attributeChangedCallback(name: string, _old: string | null, value: string | null) {
        if (name === 'src') this.src = value ?? '';
    }

    private observe() {
        if (this.observer) return;
        if (!('IntersectionObserver' in window)) {
            this.load();
            return;
        }
        this.observer = new IntersectionObserver(
            (entries) => {
                for (const e of entries) {
                    if (e.isIntersecting) {
                        this.load();
                        this.observer?.disconnect();
                        this.observer = null;
                    }
                }
            },
            { rootMargin: '500px 0px' },
        );
        this.observer.observe(this);
    }

    private load() {
        if (!this.root || !this._src) return;
        this.root.replaceChildren();
        const img = document.createElement('img');
        img.alt = this.getAttribute('alt') ?? '';
        img.decoding = 'async';
        img.src = this._src;
        img.addEventListener('load', () => {
            this.root?.classList.add('loaded');
        });
        img.addEventListener('error', () => {
            this.root?.classList.add('error');
        });
        this.root.appendChild(img);
    }
}

customElements.define('lazy-img', LazyImg);
