import { html, css, LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

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
  hasSub: boolean;
  subBatterName?: string;
  subPosition?: string;
  atBats: number;
  runs: number;
  hits: number;
  rbi: number;
  subAtBats?: number;
  subRuns?: number;
  subHits?: number;
  subRbi?: number;
  innings: Record<number, ScorebookCellData>; // Inning 1..9 -> CellData
  subInnings?: Record<number, ScorebookCellData>;
}

@customElement('baseball-scorebook-grid')
export class BaseballScorebookGrid extends LitElement {
  static styles = css`
    :host {
      display: block;
      width: 100%;
      font-family: 'Courier New', Courier, monospace;
      box-sizing: border-box;
    }

    .scorebook-wrapper {
      background-color: #fcfbfa;
      color: #2b2a28;
      padding: 1.5rem;
      border-radius: 12px;
      border: 2px solid #d2cdc6;
      box-shadow: 0 6px 20px rgba(0, 0, 0, 0.15);
      box-sizing: border-box;
    }

    .scorebook-top-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid #d2cdc6;
      padding-bottom: 1rem;
      margin-bottom: 1.25rem;
    }

    .scorebook-title {
      margin: 0;
      font-weight: bold;
      letter-spacing: 2px;
      font-size: 1.25rem;
    }

    .scorebook-header-panel {
      display: grid;
      grid-template-columns: 150px 1fr 1fr 180px;
      border: 2px solid #5a544a;
      background-color: #eae5dc;
      padding: 0.75rem;
      margin-bottom: 1rem;
      font-weight: bold;
    }

    @media (max-width: 800px) {
      .scorebook-header-panel {
        grid-template-columns: 1fr 1fr;
        gap: 0.5rem;
      }
    }

    .scorebook-half-tag {
      font-size: 1.75rem;
      color: #ff2a3b;
      letter-spacing: 2px;
    }

    .scorebook-team-info, .scorebook-pitcher-info {
      display: flex;
      flex-direction: column;
      justify-content: center;
    }

    .scorebook-manager-tag, .scorebook-umpire-tag {
      font-size: 0.8rem;
      color: #555;
      margin-top: 0.25rem;
    }

    .scorebook-meta-col {
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: flex-end;
      font-size: 0.8rem;
    }

    .scorebook-bench-btn {
      margin-top: 0.4rem;
      font-size: 0.75rem;
      padding: 2px 8px;
      background: rgba(0, 0, 0, 0.05);
      border: 1px solid #5a544a;
      border-radius: 4px;
      cursor: pointer;
      font-family: inherit;
      font-weight: bold;
    }

    .scorebook-bench-btn:hover {
      background: rgba(0, 0, 0, 0.12);
    }

    .roster-drawer {
      background-color: #fcfbfa;
      border: 2px solid #5a544a;
      border-top: none;
      padding: 1rem;
      margin-top: -1rem;
      margin-bottom: 1.5rem;
    }

    .roster-drawer-inner {
      display: flex;
      gap: 2rem;
    }

    .roster-drawer-col {
      flex-grow: 1;
    }

    .scorecard-table-wrapper {
      width: 100%;
      overflow-x: auto;
      border: 2px solid #5a544a;
    }

    .scorecard-table {
      border-collapse: collapse;
      background-color: #faf9f6;
      min-width: 950px;
      width: 100%;
      color: #2b2a28;
      font-size: 0.85rem;
    }

    .scorecard-thead {
      background: #eae5dc;
      border-bottom: 2px solid #5a544a;
    }

    th {
      border-right: 1px solid #9c9384;
      padding: 0.5rem;
      text-align: center;
    }

    .th-batter-header {
      border-right: 2px solid #5a544a;
      text-align: left;
      width: 180px;
    }

    .th-pos-header {
      border-right: 2px solid #5a544a;
      width: 45px;
    }

    .th-inning-header {
      width: 52px;
    }

    .th-stat-header {
      border-left: 1px solid #9c9384;
      width: 45px;
    }

    .th-stat-header.first {
      border-left: 2px solid #5a544a;
    }

    td {
      border-right: 1px solid #9c9384;
      border-bottom: 1px solid #d2cdc6;
      padding: 0.4rem;
    }

    .sub-btn-scorebook {
      padding: 2px 6px;
      font-size: 0.7rem;
      background-color: #5a544a;
      color: #fff;
      font-weight: bold;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-family: inherit;
    }

    .sub-btn-scorebook:hover {
      background-color: #ff2a3b;
    }

    .player-cell-content {
      display: flex;
      justify-content: space-between;
      align-items: center;
      width: 100%;
    }

    .player-name-span {
      font-weight: bold;
      color: #111111;
    }

    .scorebook-cell-td {
      width: 52px !important;
      height: 52px !important;
      min-width: 52px !important;
      min-height: 52px !important;
      padding: 0 !important;
      text-align: center;
      vertical-align: middle;
    }

    .inning-cell-box {
      position: relative;
      width: 52px;
      height: 52px;
      margin: 0 auto;
      overflow: hidden;
      background-color: #ffffff;
      box-sizing: border-box;
    }

    .inning-diamond-shape {
      position: absolute;
      top: 50%;
      left: 50%;
      width: 28px;
      height: 28px;
      margin-top: -14px;
      margin-left: -14px;
      border: 1px dashed #9c9384;
      transform: rotate(45deg);
      z-index: 1;
      box-sizing: border-box;
    }

    .inning-diamond-shape.empty {
      border: 1px dashed #d2cdc6;
      background: transparent;
    }

    .inning-diamond-shape.b1 { border-right: 2.5px solid #ff2a3b; border-bottom: 2.5px solid #ff2a3b; }
    .inning-diamond-shape.b2 { border-right: 2.5px solid #ff2a3b; border-bottom: 2.5px solid #ff2a3b; border-top: 2.5px solid #ff2a3b; }
    .inning-diamond-shape.b3 { border-right: 2.5px solid #ff2a3b; border-bottom: 2.5px solid #ff2a3b; border-top: 2.5px solid #ff2a3b; border-left: 2.5px solid #ff2a3b; }
    .inning-diamond-shape.b4 { border: 2.5px solid #ff2a3b; background-color: rgba(255, 42, 59, 0.45); }

    .notation-tag {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      font-weight: 900;
      font-size: 0.75rem;
      color: #111111;
      text-shadow: 0 0 2px #ffffff;
      z-index: 10;
    }

    .count-tag {
      position: absolute;
      top: 2px;
      left: 3px;
      font-size: 0.6rem;
      font-weight: bold;
      color: #333333;
      font-family: monospace;
      z-index: 10;
    }

    .out-circle {
      position: absolute;
      bottom: 2px;
      left: 3px;
      width: 12px;
      height: 12px;
      border: 1.5px solid #ff2a3b;
      border-radius: 50%;
      display: flex;
      justify-content: center;
      align-items: center;
      font-size: 0.6rem;
      color: #ff2a3b;
      font-weight: bold;
      background: #ffffff;
      z-index: 10;
    }

    .inning-diagonal-line {
      position: absolute;
      bottom: 0;
      right: 0;
      width: 40px;
      height: 2px;
      background-color: #ff2a3b;
      transform: rotate(-45deg);
      transform-origin: bottom right;
      z-index: 8;
    }

    .text-center { text-align: center; }
    .font-bold { font-weight: bold; }
  `;

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
              ${this.slots.map((s) => {
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
                    ${inningsHeader.map((inn) => html`<td class="scorebook-cell-td">${this.renderCell(s.innings[inn])}</td>`)}
                    <td class="text-center">${s.atBats}</td>
                    <td class="text-center font-bold">${s.runs}</td>
                    <td class="text-center font-bold">${s.hits}</td>
                    <td class="text-center">${s.rbi}</td>
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
                          ${inningsHeader.map((inn) => html`<td class="scorebook-cell-td">${this.renderCell(s.subInnings ? s.subInnings[inn] : undefined)}</td>`)}
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
