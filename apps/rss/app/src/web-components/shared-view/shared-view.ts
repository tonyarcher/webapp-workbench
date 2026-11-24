import { navigate } from '../../router';
import { requestAddFeed } from '../../services/add-feed-intent';
import { saveSharedSnapshot } from '../../mutations-saved';
import { type SharedLink } from '../../services/shared-links';
import { safeHttpUrl } from '../../services/parser';
import styles from './shared-view.css?inline';

export class SharedView extends HTMLElement {
    private root: HTMLDivElement | null = null;
    private busy = false;
    private shared: SharedLink | null = null;

    get link(): SharedLink | null {
        return this.shared;
    }

    set link(value: SharedLink | null) {
        this.shared = value;
        this.paint();
    }

    connectedCallback(): void {
        const shadow = this.attachShadow({ mode: 'open' });
        const style = document.createElement('style');
        style.textContent = styles;
        this.root = document.createElement('div');
        this.root.className = 'view';
        shadow.append(style, this.root);
        this.paint();
    }

    private paint(): void {
        if (!this.root) return;
        this.root.replaceChildren();
        const toolbar = document.createElement('div');
        toolbar.className = 'toolbar';
        const heading = document.createElement('h2');
        heading.textContent = 'Shared link';
        toolbar.appendChild(heading);
        this.root.appendChild(toolbar);

        const body = document.createElement('div');
        body.className = 'body';
        body.tabIndex = 0;
        const shared = this.shared;
        const url = shared ? safeHttpUrl(shared.url) : undefined;
        if (!shared || !url) {
            body.appendChild(this.message('No valid web link was shared.'));
            body.appendChild(this.button('Back to reading', () => navigate({ kind: 'all' })));
            this.root.appendChild(body);
            body.focus();
            return;
        }
        const link: SharedLink = { ...shared, url };

        const title = document.createElement('p');
        title.className = 'shared-title';
        title.textContent = link.title || link.url;
        body.appendChild(title);
        const anchor = document.createElement('a');
        anchor.className = 'shared-url';
        anchor.href = link.url;
        anchor.target = '_blank';
        anchor.rel = 'noopener noreferrer';
        anchor.textContent = link.url;
        body.appendChild(anchor);
        if (link.text) body.appendChild(this.message(link.text));

        const actions = document.createElement('div');
        actions.className = 'actions';
        const subscribe = this.button('Subscribe to feed', () => requestAddFeed(link.url), true);
        const save = this.button('Save for later', () => void this.save(link));
        save.disabled = this.busy;
        const cancel = this.button('Cancel', () => navigate({ kind: 'all' }));
        actions.append(subscribe, save, cancel);
        body.appendChild(actions);
        this.root.appendChild(body);
        body.focus();
    }

    private async save(link: SharedLink): Promise<void> {
        this.busy = true;
        this.paint();
        const ok = await saveSharedSnapshot(link);
        this.busy = false;
        if (!this.isConnected || safeHttpUrl(this.shared?.url ?? '') !== link.url) return;
        if (ok) navigate({ kind: 'saved' });
        else this.paint();
    }

    private message(text: string): HTMLParagraphElement {
        const node = document.createElement('p');
        node.className = 'shared-copy';
        node.textContent = text;
        return node;
    }

    private button(label: string, onClick: () => void, primary = false): HTMLButtonElement {
        const node = document.createElement('button');
        node.className = `btn${primary ? ' primary' : ''}`;
        node.textContent = label;
        node.addEventListener('click', onClick);
        return node;
    }
}

customElements.define('shared-view', SharedView);

declare global {
    interface HTMLElementTagNameMap {
        'shared-view': SharedView;
    }
}
