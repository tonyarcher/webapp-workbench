import { html, LitElement, unsafeCSS } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { libraryKey, QueryController, fetchLibrary } from '../../query';
import {
    createMuteRuleId,
    loadMuteRules,
    muteScopeLabel,
    parseMuteTerms,
    saveMuteRules,
    type MuteMatch,
    type MuteRule,
    type MuteScope,
} from '../../services/mute-rules';
import type { Feed, Folder, SavedSearch } from '../../types';
import styles from './mute-filters-view.css?inline';

interface Library {
    folders: Folder[];
    feeds: Feed[];
    savedSearches: SavedSearch[];
}

@customElement('mute-filters-view')
export class MuteFiltersView extends LitElement {
    static override styles = unsafeCSS(styles);

    @state() private rules: MuteRule[] = loadMuteRules();
    @state() private editingId: string | null = null;
    @state() private terms = '';
    @state() private match: MuteMatch = 'either';
    @state() private scopeKind: 'all' | 'folders' = 'all';
    @state() private scopeFolderIds: string[] = [];
    @state() private status = '';
    @state() private statusError = false;

    private library = new QueryController<Library>(this, () => ({
        queryKey: libraryKey,
        queryFn: () => fetchLibrary(),
        refetchInterval: 60_000,
    }));

    private get folders(): Folder[] {
        return this.library.data?.folders ?? [];
    }

    override render() {
        return html`
            <div class="view">
                <div class="toolbar">
                    <div>
                        <h2>Mute filters</h2>
                        <p class="sub">Hide articles matching any muted word or phrase. Apply filters to all folders or choose specific folders.</p>
                    </div>
                </div>
                <div class="body" tabindex="0">
                    <section class="panel form-panel" aria-label="Mute filter editor">
                        <h3>${this.editingId ? 'Edit filter' : 'New filter'}</h3>
                        <label class="field">
                            <span>Words or phrases</span>
                            <textarea
                                rows="3"
                                placeholder="keyword, another phrase"
                                .value=${this.terms}
                                @input=${(e: Event) => (this.terms = (e.target as HTMLTextAreaElement).value)}
                            ></textarea>
                            <span class="hint">Separate multiple terms with commas or new lines. Any matching term mutes the article.</span>
                        </label>
                        <div class="row">
                            <label class="field inline">
                                <span>Match in</span>
                                <select .value=${this.match} @change=${(e: Event) => (this.match = (e.target as HTMLSelectElement).value as MuteMatch)}>
                                    <option value="either">Title or body</option>
                                    <option value="title">Title</option>
                                    <option value="body">Body</option>
                                </select>
                            </label>
                            <label class="field inline">
                                <span>Scope</span>
                                <select .value=${this.scopeKind} @change=${this.onScopeKindChange}>
                                    <option value="all">All folders</option>
                                    <option value="folders">Selected folders</option>
                                </select>
                            </label>
                        </div>
                        ${this.scopeKind === 'folders' ? this.renderFolderPicker() : ''}
                        <div class="actions">
                            <button class="btn primary" @click=${this.saveRule}>${this.editingId ? 'Save changes' : 'Add filter'}</button>
                            ${this.editingId ? html`<button class="btn" @click=${this.cancelEdit}>Cancel</button>` : ''}
                        </div>
                        ${this.status ? html`<div class="status ${this.statusError ? 'error' : ''}">${this.status}</div>` : ''}
                    </section>

                    <section class="panel" aria-label="Mute filters list">
                        <h3>Active and saved filters</h3>
                        ${
                            this.rules.length === 0
                                ? html`<p class="empty">No mute filters yet. Add one above to hide articles you never want to see.</p>`
                                : html`<ul class="rules">${this.rules.map((rule) => this.renderRule(rule))}</ul>`
                        }
                    </section>
                </div>
            </div>
        `;
    }

    private renderFolderPicker() {
        const folders = this.folders;
        if (folders.length === 0) {
            return html`<p class="hint">No folders yet. Create folders in Organize, or use “All folders”.</p>`;
        }
        return html`
            <fieldset class="folder-picker">
                <legend>Folders</legend>
                <div class="folder-grid">
                    ${folders.map(
                        (folder) => html`
                        <label class="folder-opt">
                            <input
                                type="checkbox"
                                .checked=${this.scopeFolderIds.includes(folder.id)}
                                @change=${(e: Event) => this.toggleScopeFolder(folder.id, (e.target as HTMLInputElement).checked)}
                            />
                            <span>${folder.title}</span>
                        </label>`,
                    )}
                </div>
                <p class="hint">Select one or more folders. The rule applies to feeds in any selected folder.</p>
            </fieldset>
        `;
    }

    private renderRule(rule: MuteRule) {
        const folderNames = new Map(this.folders.map((f) => [f.id, f.title]));
        const matchLabel = rule.match === 'title' ? 'Title' : rule.match === 'body' ? 'Body' : 'Title or body';
        return html`
            <li class="rule ${rule.enabled ? '' : 'disabled'}">
                <div class="rule-main">
                    <label class="rule-toggle">
                        <input type="checkbox" .checked=${rule.enabled} @change=${() => this.toggleRule(rule.id)} />
                        <span class="rule-terms">${rule.terms.join(', ')}</span>
                    </label>
                    <div class="rule-meta">
                        <span class="chip">${matchLabel}</span>
                        <span class="chip">${muteScopeLabel(rule.scope, folderNames)}</span>
                        ${!rule.enabled ? html`<span class="chip muted">Disabled</span>` : ''}
                    </div>
                </div>
                <div class="rule-actions">
                    <button class="btn" @click=${() => this.editRule(rule)}>Edit</button>
                    <button class="btn danger" @click=${() => this.deleteRule(rule.id)}>Delete</button>
                </div>
            </li>
        `;
    }

    private onScopeKindChange = (e: Event) => {
        const kind = (e.target as HTMLSelectElement).value as 'all' | 'folders';
        this.scopeKind = kind;
        if (kind === 'all') this.scopeFolderIds = [];
    };

    private toggleScopeFolder(folderId: string, checked: boolean) {
        const next = new Set(this.scopeFolderIds);
        if (checked) next.add(folderId);
        else next.delete(folderId);
        this.scopeFolderIds = [...next];
    }

    private currentScope(): MuteScope | null {
        if (this.scopeKind === 'all') return { kind: 'all' };
        if (this.scopeFolderIds.length === 0) return null;
        return { kind: 'folders', folderIds: [...this.scopeFolderIds] };
    }

    private commit(next: MuteRule[], status = '', error = false) {
        saveMuteRules(next);
        this.rules = next;
        this.status = status;
        this.statusError = error;
        window.dispatchEvent(new CustomEvent('mute-rules-changed'));
    }

    private saveRule = () => {
        const terms = parseMuteTerms(this.terms);
        if (!terms.length) {
            this.status = 'Enter at least one word or phrase to mute.';
            this.statusError = true;
            return;
        }
        const scope = this.currentScope();
        if (!scope) {
            this.status = 'Select at least one folder, or choose “All folders”.';
            this.statusError = true;
            return;
        }
        if (this.editingId) {
            const next = this.rules.map((r) =>
                r.id === this.editingId ? { ...r, terms, match: this.match, scope } : r,
            );
            this.editingId = null;
            this.terms = '';
            this.match = 'either';
            this.scopeKind = 'all';
            this.scopeFolderIds = [];
            this.commit(next, 'Mute filter updated.');
            return;
        }
        const next = [...this.rules, { id: createMuteRuleId(), terms, match: this.match, enabled: true, scope }];
        this.terms = '';
        this.match = 'either';
        this.scopeKind = 'all';
        this.scopeFolderIds = [];
        this.commit(next, 'Mute filter added.');
    };

    private editRule(rule: MuteRule) {
        this.editingId = rule.id;
        this.terms = rule.terms.join(', ');
        this.match = rule.match;
        if (rule.scope.kind === 'folders') {
            this.scopeKind = 'folders';
            this.scopeFolderIds = [...rule.scope.folderIds];
        } else {
            this.scopeKind = 'all';
            this.scopeFolderIds = [];
        }
        this.status = '';
        this.statusError = false;
    }

    private cancelEdit = () => {
        this.editingId = null;
        this.terms = '';
        this.match = 'either';
        this.scopeKind = 'all';
        this.scopeFolderIds = [];
        this.status = '';
        this.statusError = false;
    };

    private toggleRule(id: string) {
        const next = this.rules.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r));
        this.commit(next);
    }

    private deleteRule(id: string) {
        const rule = this.rules.find((r) => r.id === id);
        const next = this.rules.filter((r) => r.id !== id);
        if (this.editingId === id) this.cancelEdit();
        this.commit(next, rule ? 'Mute filter deleted.' : '');
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'mute-filters-view': MuteFiltersView;
    }
}
