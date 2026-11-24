import { fetchStorageStatus, purgeStoredBodies, type StorageStatus } from '../../services/api';
import { purgeAvailable, purgeResultLine, storageSizeLine } from '../../services/storage-status';
import { forgetLearning } from '../../services/interesting-settings';
import { invalidateStarredTitles } from '../../services/interesting-starred';
import {
    ENGAGEMENT_KINDS,
    engagementLabel,
    formatWeight,
    loadLearningProfile,
    profileFileName,
    serializeLearningProfile,
    type LearningProfile,
} from '../../services/learning-profile';
import { LEARNING_SIGNALS, setSignalEnabled, type LearningSignal } from '../../services/learning-signals';
import styles from './privacy-view.css?inline';

/** Deranked ids are shown as a sample; the count above is the real number. */
const DERANK_SAMPLE = 20;

type FocusTarget = 'cancel' | 'forget' | 'status' | 'cancel-purge' | 'purge';

type Action = 'export' | 'forget' | 'confirm-forget' | 'cancel-forget' | 'purge' | 'confirm-purge' | 'cancel-purge';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string): HTMLElementTagNameMap[K] {
    const node = document.createElement(tag);
    if (className) node.className = className;
    return node;
}

function text<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    className: string,
    content: string,
): HTMLElementTagNameMap[K] {
    const node = el(tag, className);
    node.textContent = content;
    return node;
}

/**
 * Privacy dashboard (H3): everything the local Interesting model learned,
 * which signals it may learn from, a downloadable profile, and one-tap
 * forget with an inline confirmation. Reads localStorage synchronously, so
 * the screen is a pure projection of the model rather than a cached copy.
 */
export class PrivacyView extends HTMLElement {
    private root: HTMLDivElement | null = null;
    private statusEl: HTMLElement | null = null;
    private confirming = false;
    private status = '';
    private focusAfter: FocusTarget | null = null;
    private storage: StorageStatus | null = null;
    private storageEl: HTMLElement | null = null;
    private purgeConfirming = false;
    private purging = false;

    connectedCallback(): void {
        if (!this.root) {
            const shadow = this.attachShadow({ mode: 'open' });
            const style = document.createElement('style');
            style.textContent = styles;
            this.root = el('div', 'view');
            shadow.append(style, this.root);
        }
        this.render();
        void this.loadStorage();
    }

    private async loadStorage(): Promise<void> {
        try {
            this.storage = await fetchStorageStatus();
        } catch {
            this.storage = null;
        }
        // Replace only this section. A full render after the async status
        // arrives would rebuild the Forget buttons and steal focus that the
        // settings search just placed on them.
        const previous = this.storageEl;
        const next = this.storageSection();
        if (previous?.isConnected) previous.replaceWith(next);
        this.storageEl = next;
    }

    private render(): void {
        if (!this.root) return;
        const profile = loadLearningProfile();
        const statusEl = text('p', 'status', this.status);
        statusEl.setAttribute('role', 'status');
        statusEl.tabIndex = -1;
        this.statusEl = statusEl;
        this.root.replaceChildren(
            text('h2', '', 'Privacy dashboard'),
            text(
                'p',
                'intro',
                'Everything on this screen is stored in this browser. The reader never sends your learned profile anywhere.',
            ),
            this.summary(profile),
            this.signals(profile),
            this.words(profile),
            this.engagements(profile),
            this.deranks(profile),
            this.decay(profile),
            this.storageSection(),
            this.actions(),
            statusEl,
        );
        this.applyFocus();
    }

    private summary(profile: LearningProfile): HTMLElement {
        const grid = el('div', 'grid');
        grid.append(
            this.card('Words learned', String(profile.words.length)),
            this.card('Engagement records', String(profile.records.length)),
            this.card('Articles deranked', String(profile.derankedIds.length)),
            this.card(
                'Last decay',
                profile.decayAt === null ? 'Never' : new Date(profile.decayAt).toLocaleDateString(),
            ),
        );
        return grid;
    }

    private card(label: string, value: string): HTMLElement {
        const card = el('div', 'card');
        card.append(text('span', 'label', label), text('span', 'value', value));
        return card;
    }

    private signals(profile: LearningProfile): HTMLElement {
        const section = document.createElement('section');
        section.setAttribute('data-setting', 'signals');
        section.tabIndex = -1;
        section.append(text('h3', '', 'What the reader learns from'));
        const list = el('ul', 'signals');
        for (const spec of LEARNING_SIGNALS) {
            const row = el('li', 'signal');
            const input = document.createElement('input');
            input.type = 'checkbox';
            input.id = `learning-signal-${spec.kind}`;
            input.checked = profile.toggles[spec.kind];
            input.addEventListener('change', () => this.toggleSignal(spec.kind, input.checked, spec.label));
            const label = text('label', '', spec.label);
            label.htmlFor = input.id;
            const detail = text('span', 'signal-detail', spec.detail);
            detail.id = `learning-signal-detail-${spec.kind}`;
            input.setAttribute('aria-describedby', detail.id);
            row.append(input, label, detail);
            list.append(row);
        }
        section.append(list);
        return section;
    }

    private words(profile: LearningProfile): HTMLElement {
        const section = document.createElement('section');
        section.append(text('h3', '', `Learned words (${profile.words.length})`));
        if (!profile.words.length) {
            section.append(
                text('p', 'empty', 'Nothing learned yet. Star or read a few stories and the words appear here.'),
            );
            return section;
        }
        const scroll = el('div', 'scroll');
        scroll.tabIndex = 0;
        scroll.setAttribute('role', 'region');
        scroll.setAttribute('aria-label', 'Learned word weights');
        const list = el('ul', 'words');
        for (const word of profile.words) {
            const cls = word.weight < 0 ? 'negative' : 'positive';
            const row = el('li', 'word');
            row.append(text('span', '', word.word), text('span', `weight ${cls}`, formatWeight(word.weight)));
            list.append(row);
        }
        scroll.append(list);
        section.append(scroll);
        return section;
    }

    private engagements(profile: LearningProfile): HTMLElement {
        const section = document.createElement('section');
        section.append(text('h3', '', 'Engagement totals'));
        const list = el('ul', 'engagements');
        for (const kind of ENGAGEMENT_KINDS) {
            const count = profile.recordCountByKind[kind];
            const row = el('li', 'engagement');
            row.append(
                text('span', '', engagementLabel(kind)),
                text('span', 'count', `${count} ${count === 1 ? 'record' : 'records'}`),
                text('span', 'count', `weight ${formatWeight(profile.totalsByKind[kind])}`),
            );
            list.append(row);
        }
        section.append(list);
        return section;
    }

    private deranks(profile: LearningProfile): HTMLElement {
        const section = document.createElement('section');
        const count = profile.derankedIds.length;
        section.append(text('h3', '', `Articles marked not interesting (${count})`));
        if (!count) {
            section.append(text('p', 'empty', 'No articles are marked not interesting.'));
            return section;
        }
        const list = el('ul', 'deranked');
        for (const id of profile.derankedIds.slice(0, DERANK_SAMPLE)) {
            const row = el('li', '');
            const code = text('code', '', id);
            row.append(code);
            list.append(row);
        }
        section.append(list);
        if (count > DERANK_SAMPLE) {
            section.append(text('p', 'empty', `and ${count - DERANK_SAMPLE} more.`));
        }
        return section;
    }

    private decay(profile: LearningProfile): HTMLElement {
        const section = document.createElement('section');
        section.append(text('h3', '', 'Daily decay'));
        const hours = Math.round(profile.decayIntervalMs / 3_600_000);
        const last =
            profile.decayAt === null
                ? 'Decay has not run yet.'
                : `Last ran ${new Date(profile.decayAt).toLocaleString()}.`;
        section.append(
            text(
                'p',
                '',
                `${last} Every ${hours} hours each weight halves, so old likes fade unless recent reading renews them.`,
            ),
        );
        return section;
    }

    /** Cold-data purge is confirmable and never removes article rows or state. */
    private storageSection(): HTMLElement {
        const section = document.createElement('section');
        this.storageEl = section;
        section.setAttribute('data-setting', 'purge');
        section.tabIndex = -1;
        section.append(text('h3', '', 'Stored article data'));
        const storage = this.storage;
        if (!storage || !purgeAvailable(storage)) {
            section.append(
                text(
                    'p',
                    'empty',
                    'Old-body purge is off on this server. Articles and reading state are never purged.',
                ),
            );
            return section;
        }
        section.append(
            text(
                'p',
                '',
                `Bodies older than ${storage.purgeAfterDays} days can be removed from the object store. ` +
                    `Articles, stars, and reading state stay. Database size: ${storageSizeLine(storage.databaseBytes)}.`,
            ),
        );
        const row = el('div', 'actions');
        const button = this.actionButton('Purge old body data', 'purge', true);
        button.disabled = this.purging;
        row.append(button);
        section.append(row);
        if (this.purgeConfirming) {
            const box = el('div', 'confirm');
            box.setAttribute('role', 'group');
            box.setAttribute('aria-labelledby', 'purge-heading');
            const heading = text('h3', '', 'Purge old body data?');
            heading.id = 'purge-heading';
            box.append(
                heading,
                text('p', '', 'This removes old cold body objects. Articles and reading state are not deleted.'),
            );
            const confirmRow = el('div', 'actions');
            confirmRow.append(
                this.actionButton('Cancel', 'cancel-purge', false),
                this.actionButton('Purge old body data', 'confirm-purge', true),
            );
            box.append(confirmRow);
            section.append(box);
        }
        return section;
    }

    private async runPurge(): Promise<void> {
        this.purging = true;
        this.purgeConfirming = false;
        this.render();
        try {
            const purged = await purgeStoredBodies();
            this.setStatus(purgeResultLine(purged));
        } catch {
            this.setStatus('Could not purge old body data.');
        } finally {
            this.purging = false;
            await this.loadStorage();
        }
    }

    private actions(): HTMLElement {
        const section = document.createElement('section');
        const row = el('div', 'actions');
        row.append(this.actionButton('Export learned profile', 'export', false));
        row.append(this.actionButton('Forget everything', 'forget', true));
        section.append(row);
        if (this.confirming) section.append(this.confirm());
        return section;
    }

    private confirm(): HTMLElement {
        const box = el('div', 'confirm');
        box.setAttribute('role', 'group');
        box.setAttribute('aria-labelledby', 'forget-heading');
        const heading = text('h3', '', 'Forget everything?');
        heading.id = 'forget-heading';
        const body = text(
            'p',
            '',
            'This clears every learned word weight, engagement record, derank, and the decay clock in this browser. Stars, folders, and the signal switches stay.',
        );
        const row = el('div', 'actions');
        row.append(
            this.actionButton('Cancel', 'cancel-forget', false),
            this.actionButton('Forget everything', 'confirm-forget', true),
        );
        box.append(heading, body, row);
        return box;
    }

    private actionButton(label: string, action: Action, danger: boolean): HTMLButtonElement {
        const button = el('button', danger ? 'danger' : 'primary');
        button.textContent = label;
        button.dataset['action'] = action;
        button.addEventListener('click', () => this.onAction(action));
        return button;
    }

    private onAction(action: Action): void {
        if (action === 'export') {
            this.exportProfile();
            return;
        }
        if (action === 'forget') {
            this.confirming = true;
            this.focusAfter = 'cancel';
            this.render();
            return;
        }
        if (action === 'cancel-forget') {
            this.confirming = false;
            this.focusAfter = 'forget';
            this.render();
            return;
        }
        if (action === 'purge') {
            this.purgeConfirming = true;
            this.focusAfter = 'cancel-purge';
            this.render();
            return;
        }
        if (action === 'cancel-purge') {
            this.purgeConfirming = false;
            this.focusAfter = 'purge';
            this.render();
            return;
        }
        if (action === 'confirm-purge') {
            void this.runPurge();
            return;
        }
        this.forget();
    }

    private toggleSignal(kind: LearningSignal, enabled: boolean, label: string): void {
        setSignalEnabled(kind, enabled);
        this.setStatus(`${label} learning ${enabled ? 'on' : 'off'}.`);
    }

    private exportProfile(): void {
        const json = serializeLearningProfile(loadLearningProfile());
        const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = profileFileName();
        anchor.hidden = true;
        this.shadowRoot?.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(url);
        this.setStatus('Learned profile exported.');
    }

    private forget(): void {
        forgetLearning();
        // The seeded likes list is in memory; drop it so a forget is not
        // immediately undone by the next ranking pass.
        invalidateStarredTitles();
        this.confirming = false;
        this.focusAfter = 'status';
        this.status = 'Learned profile forgotten. The next ranking starts from an empty map.';
        this.render();
    }

    private setStatus(status: string): void {
        this.status = status;
        if (this.statusEl) this.statusEl.textContent = status;
    }

    private applyFocus(): void {
        const target = this.focusAfter;
        this.focusAfter = null;
        if (!target) return;
        if (target === 'status') {
            this.statusEl?.focus();
            return;
        }
        const selectors: Record<FocusTarget, string> = {
            cancel: '[data-action="cancel-forget"]',
            forget: '[data-action="forget"]',
            status: '[role="status"]',
            'cancel-purge': '[data-action="cancel-purge"]',
            purge: '[data-action="purge"]',
        };
        this.root?.querySelector<HTMLElement>(selectors[target])?.focus();
    }
}

customElements.define('privacy-view', PrivacyView);

declare global {
    interface HTMLElementTagNameMap {
        'privacy-view': PrivacyView;
    }
}
