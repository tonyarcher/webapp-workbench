import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import {
    fetchInterests,
    importInterests,
    fetchLane,
    type InterestJson,
    type LaneResult,
    type ImportResult,
} from '../../services/api-interests';

@customElement('interests-settings')
export class InterestsSettings extends LitElement {
    @state() private interests: InterestJson[] = [];
    @state() private topics = '';
    @state() private sources = '';
    @state() private busy = false;
    @state() private status = '';
    @state() private report: ImportResult | null = null;
    @state() private lane: LaneResult | null = null;

    static override styles = css`
        :host { display: block; padding: 1rem; }
        textarea { width: 100%; min-height: 80px; margin-bottom: 0.5rem; }
        button { margin-right: 0.5rem; }
        .interest { padding: 0.25rem 0; border-bottom: 1px solid var(--border, #eee); }
        .weight { color: var(--text-muted, #888); font-size: 0.85rem; }
        .lane-row { padding: 0.25rem 0; }
        .reason { color: var(--text-muted, #888); font-size: 0.8rem; }
    `;

    override connectedCallback(): void {
        super.connectedCallback();
        void this.load();
        void this.loadLane();
    }

    private async load(): Promise<void> {
        try {
            this.interests = await fetchInterests();
        } catch {
            this.status = 'Failed to load interests';
        }
    }

    private async doImport(): Promise<void> {
        this.busy = true;
        this.status = '';
        try {
            const r = await importInterests(this.topics, this.sources);
            this.report = r;
            this.status = `Imported: ${r.topics.unique} topics, ${r.sources.unique} sources`;
            this.interests = await fetchInterests();
        } catch {
            this.status = 'Import failed';
        } finally {
            this.busy = false;
        }
    }

    private async loadLane(): Promise<void> {
        try {
            this.lane = await fetchLane();
        } catch {
            this.status = 'Failed to load lane';
        }
    }

    override render() {
        return html`
            <h3>Interests</h3>
            <p>Import followed topics and sources from exported lists.</p>
            <textarea .value=${this.topics} @input=${(e: Event) => (this.topics = (e.target as HTMLTextAreaElement).value)} placeholder="Topics (one per line)"></textarea>
            <textarea .value=${this.sources} @input=${(e: Event) => (this.sources = (e.target as HTMLTextAreaElement).value)} placeholder="Sources (one per line)"></textarea>
            <button ?disabled=${this.busy} @click=${() => void this.doImport()}>Import</button>
            <button @click=${() => void this.loadLane()}>Load promoted lane</button>
            ${this.status ? html`<p>${this.status}</p>` : ''}
            ${
                this.report
                    ? html`
                          <div class="report">
                              <p>Topics: ${this.report.topics.count} lines, ${this.report.topics.unique} unique, ${this.report.topics.duplicates} duplicates, ${this.report.topics.quarantined} quarantined</p>
                              <p>Sources: ${this.report.sources.count} lines, ${this.report.sources.unique} unique, ${this.report.sources.duplicates} duplicates, ${this.report.sources.quarantined} quarantined</p>
                              ${this.report.topics.quarantinedLabels.length ? html`<p>Quarantined: ${this.report.topics.quarantinedLabels.join(', ')}</p>` : ''}
                          </div>
                      `
                    : ''
            }
            <h4>Your interests (${this.interests.length})</h4>
            ${this.interests.map((i) => html`<div class="interest">${i.label} <span class="weight">${i.weight.toFixed(2)}</span></div>`)}
            ${
                this.lane
                    ? html`
                <h4>Promoted today (${this.lane.rows.length})</h4>
                ${this.lane.rows.map((r) => html`<div class="lane-row">${r.articleId} <span class="reason">${r.reason}</span></div>`)}
            `
                    : ''
            }
        `;
    }
}
