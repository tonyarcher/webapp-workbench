import { html } from 'lit';
import type { TemplateResult } from 'lit';
import type { BoxScore, BoxScoreTeam } from './box-score';

/**
 * The element that really has focus. `document.activeElement` stops at a
 * shadow host, so a dialog opened from a control inside a component's shadow
 * root would otherwise restore focus to the host instead of the control.
 */
export function deepActiveElement(): HTMLElement | null {
    let element: Element | null = document.activeElement;
    while (element?.shadowRoot?.activeElement) {
        element = element.shadowRoot.activeElement;
    }
    return element instanceof HTMLElement ? element : null;
}

/**
 * Open state for the box score dialog, with the three things a modal has to get
 * right and which are easy to drop: focus moves in on open, focus goes back to
 * whatever opened it, and Escape closes it. The key listener lives only while
 * the dialog is open, and `dispose` takes it off again so a shell that unmounts
 * mid-dialog leaves nothing behind.
 */
export class BoxScoreDialog {
    open = false;
    private returnFocus: HTMLElement | null = null;
    private focused = false;
    private readonly onChange: () => void;
    private readonly keyHandler = (event: KeyboardEvent) => {
        if (event.key === 'Escape') this.close();
    };

    constructor(onChange: () => void) {
        this.onChange = onChange;
    }

    show() {
        this.returnFocus = deepActiveElement();
        this.focused = false;
        this.open = true;
        document.addEventListener('keydown', this.keyHandler);
        this.onChange();
    }

    close = () => {
        if (!this.open) return;
        this.open = false;
        document.removeEventListener('keydown', this.keyHandler);
        const target = this.returnFocus;
        this.returnFocus = null;
        this.onChange();
        target?.focus();
    };

    toggle() {
        if (this.open) this.close();
        else this.show();
    }

    /** Move focus into the dialog once per open, not on every re-render. */
    focusIfNeeded(root: ParentNode | null) {
        if (!this.open || this.focused || !root) return;
        const dialog = root.querySelector('.box-score-modal');
        if (!dialog) return;
        this.focused = true;
        (dialog as HTMLElement).focus();
    }

    dispose() {
        document.removeEventListener('keydown', this.keyHandler);
    }
}

export function inningColumns(total: number): number[] {
    return Array.from({ length: total }, (_, index) => index + 1);
}

export function lineScoreRow(team: BoxScoreTeam, innings: number): TemplateResult {
    return html`
    <tr data-testid="line-score-row-${team.name}">
      <td>${team.name}</td>
      ${inningColumns(innings).map((n) => html`<td data-testid="inning-${team.name}-${n}">${team.runsByInning[n - 1] ?? 0}</td>`)}
      <td class="box-score-total" data-testid="runs-${team.name}">${team.runs}</td>
      <td data-testid="hits-${team.name}">${team.hits}</td>
      <td data-testid="errors-${team.name}">${team.errors}</td>
    </tr>
  `;
}

export function battingTable(team: BoxScoreTeam): TemplateResult {
    return html`
    <table class="batting-table" data-testid="batting-table-${team.name}">
      <caption>${team.name} Batting</caption>
      ${battingHead()} ${battingBody(team)}
    </table>
  `;
}

function battingHead(): TemplateResult {
    return html`
    <thead>
      <tr><th>Player</th><th>AB</th><th>R</th><th>H</th><th>RBI</th><th>BB</th></tr>
    </thead>
  `;
}

function battingBody(team: BoxScoreTeam): TemplateResult {
    return html` <tbody>${team.batting.map((line) => battingRow(line))}</tbody> `;
}

function battingRow(line: BoxScoreTeam['batting'][number]): TemplateResult {
    return html`
    <tr>
      <td>${line.player}</td><td>${line.ab}</td><td>${line.runs}</td><td>${line.hits}</td><td>${line.rbi}</td><td>${line.walks}</td>
    </tr>
  `;
}

export function boxScoreOverlay(boxScore: BoxScore, innings: number, onClose: () => void): TemplateResult {
    return html`
    <!-- pointer-only: click-outside affordance. The dialog has a Close button,
         aria-modal, and Escape, so the keyboard path exists. -->
    <div class="box-score-overlay" data-testid="box-score-modal" @click=${onClose}>
      <div
        class="box-score-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="box-score-title"
        tabindex="-1"
        @click=${(event: Event) => event.stopPropagation()}
      >
        ${boxScoreHeader(onClose)} ${boxScoreLineScore(boxScore, innings)} ${boxScoreBatting(boxScore)}
      </div>
    </div>
  `;
}

function boxScoreHeader(onClose: () => void): TemplateResult {
    return html`
    <div class="box-score-header">
      <h3 id="box-score-title">Box Score</h3>
      <button class="btn btn-secondary" @click=${onClose} data-testid="close-box-score-button">Close</button>
    </div>
  `;
}

function boxScoreLineScore(boxScore: BoxScore, innings: number): TemplateResult {
    return html`
    <table class="line-score-table">
      <thead>
        <tr><th>Team</th>${inningColumns(innings).map((n) => html`<th key=${n}>${n}</th>`)}<th>R</th><th>H</th><th>E</th></tr>
      </thead>
      <tbody>${lineScoreRow(boxScore.away, innings)} ${lineScoreRow(boxScore.home, innings)}</tbody>
    </table>
  `;
}

function boxScoreBatting(boxScore: BoxScore): TemplateResult {
    return html`
    <div class="batting-tables">${battingTable(boxScore.away)} ${battingTable(boxScore.home)}</div>
  `;
}
