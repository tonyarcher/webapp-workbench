import {html, LitElement} from 'lit';
import {customElement, property, state} from 'lit/decorators.js';
import type {PropertyValues} from 'lit';
import lineupSetupCssText from './baseball-lineup-setup.css?inline';

const lineupSetupSheet = new CSSStyleSheet();
lineupSetupSheet.replaceSync(lineupSetupCssText);

export const FIELD_POSITIONS = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH'] as const;

export interface PlayerInfo {
    id: number;
    name: string;
    jerseyNumber: number;
    position: string;
}

export interface LineupDraft {
    homeLineup: PlayerInfo[];
    awayLineup: PlayerInfo[];
    homePitcherName: string;
    awayPitcherName: string;
}

function asRecord(value: unknown): Record<string, unknown> | null {
    return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
}

function normalizePlayer(raw: unknown, index: number): PlayerInfo {
    const record = asRecord(raw);
    return {
        id: resolvePlayerId(record, index),
        name: resolvePlayerName(record),
        jerseyNumber: resolvePlayerJersey(record),
        position: resolvePlayerPosition(record, index),
    };
}

function resolvePlayerName(record: Record<string, unknown> | null): string {
    return String(record?.name ?? record?.batterName ?? '');
}

function resolvePlayerJersey(record: Record<string, unknown> | null): number {
    const jerseyRaw = Number(record?.jerseyNumber);
    return Number.isFinite(jerseyRaw) ? jerseyRaw : 0;
}

function resolvePlayerPosition(record: Record<string, unknown> | null, index: number): string {
    const raw = String(record?.position ?? FIELD_POSITIONS[index] ?? 'DH');
    return raw || 'DH';
}

function resolvePlayerId(record: Record<string, unknown> | null, index: number): number {
    const id = Number(record?.id ?? index + 1);
    return Number.isFinite(id) ? id : index + 1;
}

function padLineup(players: PlayerInfo[]): PlayerInfo[] {
    const next = players.slice(0, 9).map((player, index) => ({...player, id: index + 1}));
    while (next.length < 9) {
        const index = next.length;
        next.push({
            id: index + 1,
            name: '',
            jerseyNumber: 0,
            position: FIELD_POSITIONS[index] ?? 'DH',
        });
    }
    return next;
}

function parseLineup(value: unknown): PlayerInfo[] {
    if (!Array.isArray(value)) return padLineup([]);
    return padLineup(value.map((entry, index) => normalizePlayer(entry, index)));
}

function lineupConverter(val: string | null): PlayerInfo[] {
    if (!val) return padLineup([]);
    try {
        return parseLineup(JSON.parse(val));
    } catch {
        return padLineup([]);
    }
}

function cloneLineup(players: PlayerInfo[]): PlayerInfo[] {
    return players.map((player) => ({...player}));
}

function validateLineup(players: PlayerInfo[], teamLabel: string): string[] {
    const errors: string[] = [];
    if (players.some((player) => !player.name.trim())) {
        errors.push(`${teamLabel}: every batting slot needs a name.`);
    }
    const defensive = players
        .map((player) => player.position)
        .filter((position) => position && position !== 'DH');
    const duplicates = defensive.filter((position, index) => defensive.indexOf(position) !== index);
    if (duplicates.length > 0) {
        errors.push(`${teamLabel}: duplicate positions (${[...new Set(duplicates)].join(', ')}).`);
    }
    return errors;
}

@customElement('baseball-lineup-setup')
export class BaseballLineupSetup extends LitElement {
    static styles = lineupSetupSheet;

    @property({type: String, attribute: 'home-team-name'}) homeTeamName = 'Home Team';
    @property({type: String, attribute: 'away-team-name'}) awayTeamName = 'Away Team';
    @property({type: Boolean, attribute: 'is-open'}) isOpen = false;
    @property({type: String, attribute: 'variant'}) variant: 'modal' | 'embedded' = 'modal';
    @property({type: String, attribute: 'home-pitcher-name'}) homePitcherName = '';
    @property({type: String, attribute: 'away-pitcher-name'}) awayPitcherName = '';

    @property({
        type: Array,
        attribute: 'home-lineup-json',
        converter: {fromAttribute: lineupConverter},
    })
    homeLineup: PlayerInfo[] = padLineup([]);

    @property({
        type: Array,
        attribute: 'away-lineup-json',
        converter: {fromAttribute: lineupConverter},
    })
    awayLineup: PlayerInfo[] = padLineup([]);

    @property({
        type: Array,
        attribute: 'home-bench-json',
        converter: {fromAttribute: lineupConverter},
    })
    homeBench: PlayerInfo[] = [];

    @property({
        type: Array,
        attribute: 'away-bench-json',
        converter: {fromAttribute: lineupConverter},
    })
    awayBench: PlayerInfo[] = [];

    @state() private draftHome: PlayerInfo[] = padLineup([]);
    @state() private draftAway: PlayerInfo[] = padLineup([]);
    @state() private draftHomePitcher = '';
    @state() private draftAwayPitcher = '';
    @state() private errors: string[] = [];

    getLineups(): LineupDraft {
        return {
            homeLineup: cloneLineup(this.draftHome),
            awayLineup: cloneLineup(this.draftAway),
            homePitcherName: this.draftHomePitcher,
            awayPitcherName: this.draftAwayPitcher,
        };
    }

    protected willUpdate(changed: PropertyValues<this>) {
        if (!this.hasUpdated) {
            this.syncDraftFromProps();
            return;
        }
        if (this.variant === 'modal' && changed.has('isOpen') && this.isOpen) {
            this.syncDraftFromProps();
            this.errors = [];
            return;
        }
        const lineupChanged =
            changed.has('homeLineup') ||
            changed.has('awayLineup') ||
            changed.has('homePitcherName') ||
            changed.has('awayPitcherName');
        if (lineupChanged && !this.hasDraftEdits()) {
            this.syncDraftFromProps();
        }
    }

    protected firstUpdated() {
        this.emitChange();
    }

    render() {
        if (this.variant === 'modal' && !this.isOpen) return html``;
        const body = this.renderBody();
        return this.variant === 'modal' ? html`<div class="overlay-catch">${body}</div>` : body;
    }

    private renderBody() {
        return html`
          <div class=${this.variant === 'modal' ? 'modal-container' : 'embedded-editor'} data-testid="lineup-editor">
            ${this.renderHeader()} ${this.renderError()} ${this.renderGrid()} ${this.renderFooter()}
          </div>
        `;
    }

    private renderHeader() {
        if (this.variant === 'modal') {
            return html`
              <div class="modal-header">
                <h2>Lineup & Bench Setup</h2>
                <button class="btn btn-secondary" type="button" @click=${this.onClose} aria-label="Close">&times;</button>
              </div>
            `;
        }
        return html`<h2>Starting lineups</h2>`;
    }

    private renderError() {
        return this.errors.length ? html`<div class="error-banner" data-testid="lineup-error">${this.errors.join(' ')}</div>` : '';
    }

    private renderGrid() {
        return html`
          <div class="lineup-grid">
            ${this.renderTeam('away', this.awayTeamName, this.draftAway, this.draftAwayPitcher)}
            ${this.renderTeam('home', this.homeTeamName, this.draftHome, this.draftHomePitcher)}
          </div>
        `;
    }

    private renderFooter() {
        if (this.variant === 'modal') return this.renderModalFooter();
        return html`<p class="hint">Edit names, numbers, and positions. The batting order is the slot order.</p>`;
    }

    private renderModalFooter() {
        return html`
          <div class="footer-actions">
            <button class="btn btn-secondary" type="button" @click=${this.onClose}>Cancel</button>
            <button class="btn" type="button" data-testid="lineup-save-button" @click=${this.onSave}>Confirm & Save Lineups</button>
          </div>
        `;
    }

    private renderTeam(team: 'home' | 'away', name: string, lineup: PlayerInfo[], pitcherName: string) {
        return html`
            <div class="team-card">
                <h3 class="team-title">${name} (${team === 'away' ? 'Away' : 'Home'})</h3>
                ${this.renderPitcherInput(team, pitcherName)} ${this.renderGridHeader()} ${this.renderSlots(team, lineup)}
            </div>
        `;
    }

    private renderPitcherInput(team: 'home' | 'away', pitcherName: string) {
        return html`
          <div class="pitcher-section">
            <label for="${team}-pitcher-input">Pitcher</label>
            <input
                id="${team}-pitcher-input"
                class="form-control input-flex"
                data-testid="${team}-pitcher-input"
                .value=${pitcherName}
                @input=${(event: Event) => this.setPitcher(team, (event.target as HTMLInputElement).value)}
            />
          </div>
        `;
    }

    private renderGridHeader() {
        return html`
          <div class="lineup-grid-header"><span></span><span>Batter</span><span>#</span><span>Pos</span></div>
        `;
    }

    private renderSlots(team: 'home' | 'away', lineup: PlayerInfo[]) {
        return html`${lineup.map((player, index) => this.renderSlotRow(team, player, index))}`;
    }

    private renderSlotRow(team: 'home' | 'away', player: PlayerInfo, index: number) {
        return html`
          <div class="slot-row">
            <span class="slot-num">${index + 1}</span>
            <input
                class="form-control input-flex"
                data-testid="${team}-slot-${index + 1}-name"
                .value=${player.name}
                @input=${(event: Event) => this.updatePlayer(team, index, 'name', (event.target as HTMLInputElement).value)}
            />
            <input
                class="form-control input-num"
                data-testid="${team}-slot-${index + 1}-jersey"
                type="number"
                min="0"
                max="99"
                .value=${player.jerseyNumber ? String(player.jerseyNumber) : ''}
                @input=${(event: Event) => this.updatePlayer(team, index, 'jerseyNumber', (event.target as HTMLInputElement).value)}
            />
            <select
                class="form-control select-pos"
                data-testid="${team}-slot-${index + 1}-position"
                .value=${player.position}
                @change=${(event: Event) => this.updatePlayer(team, index, 'position', (event.target as HTMLSelectElement).value)}
            >
              ${FIELD_POSITIONS.map((position) => this.renderPositionOption(position, player.position))}
            </select>
          </div>
        `;
    }

    private renderPositionOption(position: string, selected: string) {
        return html`<option value=${position} ?selected=${selected === position}>${position}</option>`;
    }

    private syncDraftFromProps() {
        this.draftHome = cloneLineup(padLineup(this.homeLineup));
        this.draftAway = cloneLineup(padLineup(this.awayLineup));
        this.draftHomePitcher = this.homePitcherName;
        this.draftAwayPitcher = this.awayPitcherName;
    }

    private hasDraftEdits(): boolean {
        return this.draftHome.some((player) => player.name.trim()) || this.draftAway.some((player) => player.name.trim());
    }

    private setPitcher(team: 'home' | 'away', value: string) {
        if (team === 'home') this.draftHomePitcher = value;
        else this.draftAwayPitcher = value;
        this.emitChange();
    }

    private updatePlayer(team: 'home' | 'away', index: number, field: 'name' | 'jerseyNumber' | 'position', value: string) {
        const target = team === 'home' ? [...this.draftHome] : [...this.draftAway];
        const current = target[index];
        if (!current) return;
        if (field === 'jerseyNumber') {
            const parsed = Number(value);
            target[index] = {...current, jerseyNumber: Number.isFinite(parsed) ? parsed : 0};
        } else {
            target[index] = {...current, [field]: value};
        }
        if (team === 'home') this.draftHome = target;
        else this.draftAway = target;
        this.emitChange();
    }

    private emitChange() {
        this.dispatchEvent(
            new CustomEvent('lineup-change', {
                detail: this.getLineups(),
                bubbles: true,
                composed: true,
            })
        );
    }

    private collectErrors(): string[] {
        return [
            ...validateLineup(this.draftAway, this.awayTeamName),
            ...validateLineup(this.draftHome, this.homeTeamName),
        ];
    }

    private onClose() {
        this.isOpen = false;
        this.removeAttribute('is-open');
        this.dispatchEvent(new CustomEvent('close-lineup-setup', {bubbles: true, composed: true}));
    }

    private onSave() {
        const errors = this.collectErrors().filter((error) => error.includes('needs a name'));
        if (errors.length > 0) {
            this.errors = errors;
            return;
        }
        this.errors = this.collectErrors();
        this.isOpen = false;
        this.removeAttribute('is-open');
        this.dispatchEvent(
            new CustomEvent('save-lineup-setup', {
                detail: {
                    ...this.getLineups(),
                    homeBench: this.homeBench,
                    awayBench: this.awayBench,
                },
                bubbles: true,
                composed: true,
            })
        );
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'baseball-lineup-setup': BaseballLineupSetup;
    }
}
