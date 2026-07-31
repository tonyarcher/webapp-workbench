import { html, css, unsafeCSS, LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import scorebookCss from './baseball-scorebook-grid.css?inline';

export interface ScorebookCellData {
  notation?: string;
  base?: number; // 0=none, 1=1b, 2=2b, 3=3b, 4=hr
  outNum?: number;
  count?: string;
  outDetail?: string;
  hasEndedInningLine?: boolean;
}

export interface ScorebookSlotData {
  slotIdx: number;
  batterName: string;
  position: string;
  hasSub?: boolean;
  subBatterName?: string;
  subPosition?: string;
  atBats?: number;
  runs?: number;
  hits?: number;
  rbi?: number;
  subAtBats?: number;
  subRuns?: number;
  subHits?: number;
  subRbi?: number;
  innings?: Record<string | number, ScorebookCellData>;
  subInnings?: Record<string | number, ScorebookCellData>;
}

@customElement('baseball-scorebook-grid')
export class BaseballScorebookGrid extends LitElement {
  static styles = css`${unsafeCSS(scorebookCss)}`;

  @property({ type: String, attribute: 'team-name' }) teamName = 'CARDINALS';
  @property({ type: String, attribute: 'pitcher-opponent' }) pitcherOpponent = 'CUBS';
  @property({ type: String, attribute: 'half-tag' }) halfTag = 'TOP';
  @property({ type: Number, attribute: 'max-inning' }) maxInning = 9;

  @property({ type: Array }) slots: ScorebookSlotData[] = [];

  @state() isDrawerOpen = false;

  @property({
    type: String,
    attribute: 'slots-json',
    converter: {
      fromAttribute: (val: string | null) => {
        if (!val) return [];
        try {
          return JSON.parse(val);
        } catch {
          return [];
        }
      }
    }
  })
  set slotsJson(val: ScorebookSlotData[]) {
    this.slots = val;
  }

  private toggleDrawer() {
    this.isDrawerOpen = !this.isDrawerOpen;
  }

  private onSubClick(slotIdx: number) {
    this.dispatchEvent(new CustomEvent('sub-click', { detail: { slotIdx }, bubbles: true }));
  }

  private getInningCell(
    inningsObj: Record<string | number, ScorebookCellData> | undefined,
    inn: number
  ): ScorebookCellData | undefined {
    if (!inningsObj) return undefined;
    return inningsObj[inn] ?? inningsObj[String(inn)];
  }

  renderCell(cellData?: ScorebookCellData) {
    if (!cellData) {
      return html`<div class="inning-cell-box"><div class="inning-diamond-shape empty"></div></div>`;
    }

    const b = cellData.base || 0;
    const diamondClass = b === 1 ? 'inning-diamond-shape b1' : b === 2 ? 'inning-diamond-shape b2' : b === 3 ? 'inning-diamond-shape b3' : b === 4 ? 'inning-diamond-shape b4' : 'inning-diamond-shape';

    return html`
      <div class="inning-cell-box">
        <div class="${diamondClass}"></div>
        ${cellData.notation ? html`<div class="notation-tag">${cellData.notation}</div>` : ''}
        ${cellData.count ? html`<div class="count-tag">${cellData.count}</div>` : ''}
        ${cellData.outNum !== undefined ? html`<div class="out-circle">${cellData.outNum}</div>` : ''}
        ${cellData.hasEndedInningLine ? html`<div class="inning-diagonal-line"></div>` : ''}
      </div>
    `;
  }

  render() {
    const inningsHeader = Array.from({ length: Math.max(9, this.maxInning) }, (_, i) => i + 1);

    return html`
      <div class="scorebook-wrapper">
        <div class="scorebook-top-bar">
          <h2 class="scorebook-title">TRADITIONAL BASEBALL SCOREBOOK SHEET</h2>
        </div>

        <div class="scorebook-header-panel">
          <div class="scorebook-half-tag">${this.halfTag}</div>
          <div class="scorebook-team-info">
            <div>TEAM: ${this.teamName.toUpperCase()}</div>
            <div class="scorebook-manager-tag">MANAGER: REYNOLDS, J.</div>
          </div>
          <div class="scorebook-pitcher-info">
            <div>PITCHING OPPONENT: ${this.pitcherOpponent.toUpperCase()}</div>
            <div class="scorebook-umpire-tag">UMPIRES: HP: CULBRETH | 1B: NELSON</div>
          </div>
          <div class="scorebook-meta-col">
            <div>KEEPING SCORE BY: ☑ WEBAPP</div>
            <div>FIRST PITCH: 7:05 PM</div>
            <button class="scorebook-bench-btn" @click=${this.toggleDrawer}>Bench & Bullpen</button>
          </div>
        </div>

        ${this.isDrawerOpen
          ? html`
              <div class="roster-drawer">
                <div class="roster-drawer-inner">
                  <div class="roster-drawer-col">
                    <h4 style="margin: 0 0 0.5rem 0;">BENCH BATTERS</h4>
                    <p style="font-size: 0.8rem; color: #666; margin: 0;">Click 'Sub' next to player in slot to make substitution.</p>
                  </div>
                  <div class="roster-drawer-col">
                    <h4 style="margin: 0 0 0.5rem 0;">BULLPEN</h4>
                    <p style="font-size: 0.8rem; color: #666; margin: 0;">Bullpen pitchers available for callup.</p>
                  </div>
                </div>
              </div>
            `
          : ''}

        <div class="scorecard-table-wrapper">
          <table class="scorecard-table">
            <thead class="scorecard-thead">
              <tr>
                <th class="th-batter-header">BATTERS</th>
                <th class="th-pos-header">POS</th>
                ${inningsHeader.map((i) => html`<th class="th-inning-header">${i}</th>`)}
                <th class="th-stat-header first">AB</th>
                <th class="th-stat-header">R</th>
                <th class="th-stat-header">H</th>
                <th class="th-stat-header">RBI</th>
              </tr>
            </thead>
            <tbody>
              ${(this.slots || []).map((s) => {
                const bg = s.slotIdx % 2 === 1 ? '#f4f1e7' : '#faf9f6';
                return html`
                  <tr style="background-color: ${bg};">
                    <td>
                      <div class="player-cell-content">
                        <span class="player-name-span">${s.batterName}</span>
                        ${!s.hasSub
                          ? html`<button class="sub-btn-scorebook" @click=${() => this.onSubClick(s.slotIdx)}>Sub</button>`
                          : ''}
                      </div>
                    </td>
                    <td class="text-center font-bold">${s.position}</td>
                    ${inningsHeader.map(
                      (inn) => html`<td class="scorebook-cell-td">${this.renderCell(this.getInningCell(s.innings, inn))}</td>`
                    )}
                    <td class="text-center">${s.atBats || 0}</td>
                    <td class="text-center font-bold">${s.runs || 0}</td>
                    <td class="text-center font-bold">${s.hits || 0}</td>
                    <td class="text-center">${s.rbi || 0}</td>
                  </tr>
                  ${s.hasSub
                    ? html`
                        <tr style="background-color: ${bg};">
                          <td>
                            <div class="player-cell-content" style="padding-left: 0.75rem;">
                              <span class="player-name-span" style="font-size: 0.8rem; color: #555;">${s.subBatterName}</span>
                            </div>
                          </td>
                          <td class="text-center font-bold" style="font-size: 0.8rem; color: #555;">${s.subPosition || ''}</td>
                          ${inningsHeader.map(
                            (inn) => html`<td class="scorebook-cell-td">${this.renderCell(this.getInningCell(s.subInnings, inn))}</td>`
                          )}
                          <td class="text-center">${s.subAtBats || 0}</td>
                          <td class="text-center font-bold">${s.subRuns || 0}</td>
                          <td class="text-center font-bold">${s.subHits || 0}</td>
                          <td class="text-center">${s.subRbi || 0}</td>
                        </tr>
                      `
                    : ''}
                `;
              })}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'baseball-scorebook-grid': BaseballScorebookGrid;
  }
}
