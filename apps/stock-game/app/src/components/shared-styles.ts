import { css } from 'lit'

export const tableStyles = css`
  :host {
    display: block;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 14px;
  }

  th {
    text-align: left;
    color: var(--text-muted, #9aa4b2);
    font-weight: 500;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    padding: 8px 10px;
    border-bottom: 1px solid var(--border, #2a313c);
    cursor: pointer;
    user-select: none;
  }

  th:hover {
    color: var(--text, #e6edf3);
  }

  td {
    padding: 8px 10px;
    border-bottom: 1px solid var(--border, #2a313c);
  }

  tr:hover td {
    background: var(--bg-hover, #1f2430);
  }

  .num {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }

  .positive {
    color: var(--positive, #3fb950);
  }

  .negative {
    color: var(--negative, #f85149);
  }

  .muted {
    color: var(--text-muted, #9aa4b2);
  }
`
