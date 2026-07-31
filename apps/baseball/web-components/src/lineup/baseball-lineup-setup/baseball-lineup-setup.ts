import { html, css, unsafeCSS, LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import lineupCss from './baseball-lineup-setup.css?inline';

export interface PlayerInput {
  name: string;
  number: string;
  position: string;
}

@customElement('baseball-lineup-setup')
export class BaseballLineupSetup extends LitElement {
  static styles = css`${unsafeCSS(lineupCss)}`;

  @property({ type: String, attribute: 'away-team-name' }) awayTeamName = 'Away Team';
  @property({ type: String, attribute: 'home-team-name' }) homeTeamName = 'Home Team';
  @property({ type: String, attribute: 'validation-error' }) validationError = '';

  @state() useDh = true;

  @state() awayPitcherName = '';
  @state() awayPitcherNumber = '';
  @state() homePitcherName = '';
  @state() homePitcherNumber = '';

  @state() awayLineup: PlayerInput[] = Array.from({ length: 9 }, (_, i) => ({
    name: '',
    number: '',
    position: i === 0 ? 'DH' : ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'][i - 1] || 'DH'
  }));

  @state() homeLineup: PlayerInput[] = Array.from({ length: 9 }, (_, i) => ({
    name: '',
    number: '',
    position: i === 0 ? 'DH' : ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'][i - 1] || 'DH'
  }));

  @property({
    type: String,
    attribute: 'initial-data-json',
    converter: {
      fromAttribute: (val: string | null) => {
        if (!val) return null;
        try {
          return JSON.parse(val);
        } catch {
          return null;
        }
      }
    }
  })
  set initialDataJson(data: any) {
    if (!data) return;
    if (data.useDh !== undefined) this.useDh = data.useDh;
    if (data.awayPitcherName) this.awayPitcherName = data.awayPitcherName;
    if (data.awayPitcherNumber) this.awayPitcherNumber = data.awayPitcherNumber;
    if (data.homePitcherName) this.homePitcherName = data.homePitcherName;
    if (data.homePitcherNumber) this.homePitcherNumber = data.homePitcherNumber;
    if (Array.isArray(data.awayLineup)) this.awayLineup = data.awayLineup;
    if (Array.isArray(data.homeLineup)) this.homeLineup = data.homeLineup;
  }

  private toggleDh() {
    this.useDh = !this.useDh;
    this.dispatchEvent(new CustomEvent('dh-toggled', { detail: { useDh: this.useDh }, bubbles: true }));
  }

  private onStartGame() {
    this.dispatchEvent(
      new CustomEvent('start-game', {
        detail: {
          useDh: this.useDh,
          awayPitcherName: this.awayPitcherName,
          awayPitcherNumber: this.awayPitcherNumber,
          homePitcherName: this.homePitcherName,
          homePitcherNumber: this.homePitcherNumber,
          awayLineup: this.awayLineup,
          homeLineup: this.homeLineup
        },
        bubbles: true
      })
    );
  }

  private onCancel() {
    this.dispatchEvent(new CustomEvent('cancel-lineup', { bubbles: true }));
  }

  renderTeamSection(
    teamName: string,
    pitcherName: string,
    pitcherNum: string,
    onPitcherNameChange: (val: string) => void,
    onPitcherNumChange: (val: string) => void,
    lineup: PlayerInput[],
    onSlotChange: (idx: number, field: keyof PlayerInput, val: string) => void
  ) {
    const positions = ['DH', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'P'];

    return html`
      <div class="team-card">
        <h3 class="team-title">${teamName}</h3>
        <div class="pitcher-section">
          <input
            type="text"
            class="form-control input-num"
            placeholder="#"
            .value=${pitcherNum}
            @input=${(e: Event) => onPitcherNumChange((e.target as HTMLInputElement).value)}
          />
          <input
            type="text"
            class="form-control input-flex"
            placeholder="Starting Pitcher Name"
            .value=${pitcherName}
            @input=${(e: Event) => onPitcherNameChange((e.target as HTMLInputElement).value)}
          />
        </div>

        ${lineup.map(
          (slot, idx) => html`
            <div class="slot-row">
              <span class="slot-num">${idx + 1}.</span>
              <input
                type="text"
                class="form-control input-num"
                placeholder="#"
                .value=${slot.number}
                @input=${(e: Event) => onSlotChange(idx, 'number', (e.target as HTMLInputElement).value)}
              />
              <input
                type="text"
                class="form-control input-flex"
                placeholder="Player Name"
                .value=${slot.name}
                @input=${(e: Event) => onSlotChange(idx, 'name', (e.target as HTMLInputElement).value)}
              />
              <select
                class="form-control select-pos"
                .value=${slot.position}
                @change=${(e: Event) => onSlotChange(idx, 'position', (e.target as HTMLSelectElement).value)}
              >
                ${positions.map((pos) => html`<option value=${pos} ?selected=${slot.position === pos}>${pos}</option>`)}
              </select>
            </div>
          `
        )}
      </div>
    `;
  }

  render() {
    return html`
      <div class="modal-container">
        <div class="modal-header">
          <h2>Game Lineup & Roster Setup</h2>
          <label class="checkbox-wrapper">
            <input type="checkbox" ?checked=${this.useDh} @change=${this.toggleDh} />
            Use Designated Hitter (DH)
          </label>
        </div>

        ${this.validationError ? html`<div class="error-banner">${this.validationError}</div>` : ''}

        <div class="lineup-grid">
          ${this.renderTeamSection(
            this.awayTeamName,
            this.awayPitcherName,
            this.awayPitcherNumber,
            (val) => (this.awayPitcherName = val),
            (val) => (this.awayPitcherNumber = val),
            this.awayLineup,
            (idx, field, val) => {
              const updated = [...this.awayLineup];
              updated[idx] = { ...updated[idx], [field]: val };
              this.awayLineup = updated;
            }
          )}
          ${this.renderTeamSection(
            this.homeTeamName,
            this.homePitcherName,
            this.homePitcherNumber,
            (val) => (this.homePitcherName = val),
            (val) => (this.homePitcherNumber = val),
            this.homeLineup,
            (idx, field, val) => {
              const updated = [...this.homeLineup];
              updated[idx] = { ...updated[idx], [field]: val };
              this.homeLineup = updated;
            }
          )}
        </div>

        <div class="footer-actions">
          <button class="btn btn-secondary" @click=${this.onCancel}>Cancel</button>
          <div class="flex-gap-sm">
            <button class="btn btn-secondary" @click=${() => this.dispatchEvent(new CustomEvent('load-defaults', { bubbles: true }))}>Load Defaults</button>
            <button class="btn btn-secondary" @click=${() => this.dispatchEvent(new CustomEvent('randomize-lineup', { bubbles: true }))}>Randomize</button>
            <button class="btn" @click=${this.onStartGame}>Start Game</button>
          </div>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'baseball-lineup-setup': BaseballLineupSetup;
  }
}
