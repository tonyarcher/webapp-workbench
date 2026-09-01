import { html } from 'lit';
import type { TemplateResult } from 'lit';
import type { BoxScore, BoxScoreTeam } from './box-score';

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
    <div class="box-score-overlay" data-testid="box-score-modal" @click=${onClose}>
      <div class="box-score-modal" @click=${(event: Event) => event.stopPropagation()}>
        ${boxScoreHeader(onClose)} ${boxScoreLineScore(boxScore, innings)} ${boxScoreBatting(boxScore)}
      </div>
    </div>
  `;
}

function boxScoreHeader(onClose: () => void): TemplateResult {
  return html`
    <div class="box-score-header">
      <h3>Box Score</h3>
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
