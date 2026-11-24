import type { ScrapeCandidate } from '../../services/api';

interface ScrapePreviewHost {
    html: string;
    baseUrl: string;
    candidates: ScrapeCandidate[];
    selected: string[];
    onToggle: (url: string, checked: boolean) => void;
}

function escapeHtml(value: string): string {
    return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const CSP =
    "default-src 'none'; img-src https: http: data:; style-src 'unsafe-inline' https: http:; " +
    "font-src https: http: data:; media-src https: http:; frame-src 'none'; form-action 'none'";

/**
 * Renders the fetched page in a script-free iframe and draws a box over every
 * element the current strategy recognises. Clicking a box toggles that story.
 * The text checkbox list stays in the panel for keyboard and screen readers.
 */
export class ScrapePreview extends HTMLElement {
    private root: HTMLDivElement | null = null;
    private frame: HTMLIFrameElement | null = null;
    private host: ScrapePreviewHost | null = null;
    private onFrameLoad = (): void => this.draw();

    connectedCallback(): void {
        if (!this.root) this.build();
    }

    disconnectedCallback(): void {
        this.frame?.contentWindow?.removeEventListener('resize', this.onFrameLoad);
        this.frame?.removeEventListener('load', this.onFrameLoad);
    }

    set config(value: ScrapePreviewHost) {
        const changedFrame = !this.host || this.host.html !== value.html || this.host.baseUrl !== value.baseUrl;
        this.host = value;
        if (changedFrame && this.frame) {
            this.frame.srcdoc = this.documentFor(value);
        } else {
            this.draw();
        }
    }

    private build(): void {
        const shadow = this.attachShadow({ mode: 'open' });
        const style = document.createElement('style');
        style.textContent = `
            :host { display: block; }
            .frame-wrap { position: relative; }
            iframe {
                display: block;
                width: 100%;
                height: 420px;
                border: 1px solid var(--border);
                background: #fff;
                border-radius: 6px;
            }
        `;
        const wrap = document.createElement('div');
        wrap.className = 'frame-wrap';
        const frame = document.createElement('iframe');
        frame.setAttribute('sandbox', 'allow-same-origin');
        frame.title = 'Page preview';
        frame.addEventListener('load', this.onFrameLoad);
        wrap.append(frame);
        shadow.append(style, wrap);
        this.root = wrap;
        this.frame = frame;
        if (this.host) frame.srcdoc = this.documentFor(this.host);
    }

    private documentFor(host: ScrapePreviewHost): string {
        return (
            '<!doctype html><html><head><meta charset="utf-8">' +
            `<meta http-equiv="Content-Security-Policy" content="${CSP}">` +
            `<base href="${escapeHtml(host.baseUrl)}"></head><body>${host.html}</body></html>`
        );
    }

    private draw(): void {
        if (!this.host || !this.frame) return;
        const doc = this.frame.contentDocument;
        if (!doc?.body) return;
        doc.querySelectorAll('.times-up-scrape-box').forEach((node) => node.remove());
        this.frame.contentWindow?.removeEventListener('resize', this.onFrameLoad);
        this.frame.contentWindow?.addEventListener('resize', this.onFrameLoad);
        for (const candidate of this.host.candidates) {
            this.drawBox(doc, candidate);
        }
    }

    private drawBox(doc: Document, candidate: ScrapeCandidate): void {
        if (!candidate.elementSelector) return;
        let element: Element | null = null;
        try {
            element = doc.querySelector(candidate.elementSelector);
        } catch {
            return;
        }
        if (!element) return;
        const rect = element.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;
        const active = this.host?.selected.includes(candidate.url) ?? true;
        const box = doc.createElement('button');
        box.className = 'times-up-scrape-box';
        box.type = 'button';
        box.textContent = candidate.title;
        box.setAttribute('aria-label', `${active ? 'Selected' : 'Not selected'}: ${candidate.title}`);
        box.style.cssText =
            `position:absolute;left:${rect.left + doc.defaultView!.scrollX}px;` +
            `top:${rect.top + doc.defaultView!.scrollY}px;width:${rect.width}px;height:${rect.height}px;` +
            'margin:0;padding:2px 4px;border:2px solid ' +
            (active ? '#2563eb' : '#9ca3af') +
            ';background:' +
            (active ? 'rgba(37,99,235,.12)' : 'rgba(156,163,175,.08)') +
            ';color:#111;font:12px sans-serif;cursor:pointer;text-align:left;overflow:hidden;z-index:2147483000;';
        box.addEventListener('click', () => this.host?.onToggle(candidate.url, !active));
        doc.body.appendChild(box);
    }
}

customElements.define('scrape-preview', ScrapePreview);

declare global {
    interface HTMLElementTagNameMap {
        'scrape-preview': ScrapePreview;
    }
}
