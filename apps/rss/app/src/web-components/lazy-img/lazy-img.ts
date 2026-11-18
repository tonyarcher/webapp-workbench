export class LazyImg extends HTMLElement {
    private src = '';
    private observer: IntersectionObserver | null = null;
    private root: HTMLDivElement | null = null;

    static get observedAttributes() {
        return ['src'];
    }

    connectedCallback() {
        this.src = this.getAttribute('src') ?? '';
        this.root = document.createElement('div');
        this.root.className = 'lazy-img';
        this.appendChild(this.root);
        this.observe();
    }

    disconnectedCallback() {
        this.observer?.disconnect();
    }

    attributeChangedCallback(name: string, _old: string | null, value: string | null) {
        if (name === 'src') {
            this.src = value ?? '';
            this.load();
        }
    }

    private observe() {
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
                    }
                }
            },
            { rootMargin: '500px 0px' },
        );
        this.observer.observe(this);
    }

    private load() {
        if (!this.root || !this.src) return;
        this.root.replaceChildren();
        const img = document.createElement('img');
        img.decoding = 'async';
        img.src = this.src;
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
