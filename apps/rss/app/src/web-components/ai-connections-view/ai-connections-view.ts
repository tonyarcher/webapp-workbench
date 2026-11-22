import {
    issueMcpClient,
    listMcpClients,
    revokeMcpClient,
    setMcpConsent,
    type McpClientInfo,
    type McpIssuedClient,
} from '../../services/api';
import styles from './ai-connections-view.css?inline';

/** One credential per AI client. The raw token is shown only when issued. */
export class AiConnectionsView extends HTMLElement {
    private root: HTMLDivElement | null = null;
    private clients: McpClientInfo[] = [];
    private issued: McpIssuedClient | null = null;
    private error: string | null = null;
    private loading = true;

    connectedCallback(): void {
        if (this.root) return;
        const shadow = this.attachShadow({ mode: 'open' });
        const style = document.createElement('style');
        style.textContent = styles;
        shadow.appendChild(style);
        this.root = document.createElement('div');
        this.root.className = 'view';
        shadow.appendChild(this.root);
        void this.load();
    }

    private async load(): Promise<void> {
        this.loading = true;
        this.paint();
        try {
            this.clients = await listMcpClients();
            this.error = null;
        } catch {
            this.error = 'Could not load AI connections.';
        }
        this.loading = false;
        this.paint();
    }

    private async issue(label: string): Promise<void> {
        try {
            this.issued = await issueMcpClient(label);
            this.error = null;
            await this.load();
        } catch {
            this.error = 'Could not create the client credential.';
            this.paint();
        }
    }

    private async revoke(id: string): Promise<void> {
        try {
            await revokeMcpClient(id);
            this.error = null;
            await this.load();
        } catch {
            this.error = 'Could not revoke that client.';
            this.paint();
        }
    }

    private async consent(client: McpClientInfo, enabled: boolean): Promise<void> {
        try {
            await setMcpConsent(client.id, enabled);
            this.error = null;
            await this.load();
        } catch {
            this.error = 'Could not change write consent.';
            this.paint();
        }
    }

    private paint(): void {
        if (!this.root) return;
        const root = this.root;
        root.replaceChildren();
        const heading = document.createElement('h2');
        heading.textContent = 'AI connections';
        root.appendChild(heading);
        const intro = document.createElement('p');
        intro.className = 'intro';
        intro.textContent =
            'Issue a credential for your AI assistant. It can read your feeds, search, summaries and bodies. ' +
            'Writes stay off until you allow them. Consent and revocation take effect in the next 15 minutes; ' +
            'issue a new credential to grant writes immediately.';
        root.appendChild(intro);
        if (this.error) {
            const alert = document.createElement('p');
            alert.className = 'error';
            alert.setAttribute('role', 'alert');
            alert.textContent = this.error;
            root.appendChild(alert);
        }
        root.appendChild(this.tokenPanel());
        root.appendChild(this.issueForm());
        root.appendChild(this.clientList());
    }

    private tokenPanel(): HTMLElement {
        const panel = document.createElement('section');
        panel.className = 'token-panel';
        if (!this.issued) return panel;
        const label = document.createElement('h3');
        label.textContent = `Save this token for ${this.issued.label}`;
        panel.appendChild(label);
        const note = document.createElement('p');
        note.textContent =
            'Shown once. The server keeps only a hash. Configure it as a Bearer token on your MCP client.';
        panel.appendChild(note);
        const code = document.createElement('code');
        code.className = 'token';
        code.textContent = this.issued.token;
        panel.appendChild(code);
        const dismiss = document.createElement('button');
        dismiss.type = 'button';
        dismiss.textContent = 'Done';
        dismiss.addEventListener('click', () => {
            this.issued = null;
            this.paint();
        });
        panel.appendChild(dismiss);
        return panel;
    }

    private issueForm(): HTMLElement {
        const form = document.createElement('form');
        form.className = 'issue';
        const label = document.createElement('label');
        label.textContent = 'Client name';
        const input = document.createElement('input');
        input.type = 'text';
        input.name = 'label';
        input.required = true;
        input.maxLength = 80;
        input.setAttribute('aria-label', 'Client name');
        label.appendChild(input);
        const button = document.createElement('button');
        button.type = 'submit';
        button.textContent = 'Issue credential';
        form.append(label, button);
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            void this.issue(input.value);
        });
        return form;
    }

    private clientList(): HTMLElement {
        const section = document.createElement('section');
        const heading = document.createElement('h3');
        heading.textContent = 'Connected clients';
        section.appendChild(heading);
        if (this.loading) {
            const text = document.createElement('p');
            text.textContent = 'Loading…';
            section.appendChild(text);
            return section;
        }
        if (!this.clients.length) {
            const text = document.createElement('p');
            text.textContent = 'No clients yet.';
            section.appendChild(text);
            return section;
        }
        const list = document.createElement('ul');
        list.className = 'clients';
        for (const client of this.clients) list.appendChild(this.clientRow(client));
        section.appendChild(list);
        return section;
    }

    private clientRow(client: McpClientInfo): HTMLLIElement {
        const row = document.createElement('li');
        const name = document.createElement('span');
        name.className = 'name';
        name.textContent = client.label;
        const writes = document.createElement('label');
        writes.className = 'consent';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = client.writesEnabled;
        checkbox.setAttribute('aria-label', `Allow writes for ${client.label}`);
        checkbox.addEventListener('change', () => void this.consent(client, checkbox.checked));
        writes.append(checkbox, document.createTextNode(' Allow writes'));
        const revoke = document.createElement('button');
        revoke.type = 'button';
        revoke.className = 'revoke';
        revoke.textContent = 'Revoke';
        revoke.addEventListener('click', () => void this.revoke(client.id));
        row.append(name, writes, revoke);
        return row;
    }
}

customElements.define('ai-connections-view', AiConnectionsView);

declare global {
    interface HTMLElementTagNameMap {
        'ai-connections-view': AiConnectionsView;
    }
}
