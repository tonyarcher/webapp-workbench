import { css } from 'lit'

export const tradeFormStyles = css`
  :host {
    display: block;
  }

  .field {
    margin-bottom: 14px;
  }

  label {
    display: block;
    color: var(--text-muted, #9aa4b2);
    font-size: 13px;
    margin-bottom: 6px;
  }

  input[type='number'],
  input[type='datetime-local'],
  select {
    width: 100%;
    font: inherit;
    color: var(--text, #e6edf3);
    background: var(--bg, #0d1117);
    border: 1px solid var(--border, #2a313c);
    border-radius: 8px;
    padding: 9px 12px;
  }

  input:focus,
  select:focus {
    outline: none;
    border-color: var(--accent, #4f9cf9);
  }

  .segmented {
    display: inline-flex;
    gap: 4px;
    background: var(--bg, #0d1117);
    border: 1px solid var(--border, #2a313c);
    border-radius: 8px;
    padding: 3px;
  }

  .segmented button {
    border: none;
    background: transparent;
    color: var(--text-muted, #9aa4b2);
    padding: 6px 14px;
    border-radius: 6px;
    cursor: pointer;
    font-weight: 500;
  }

  .segmented button.active-buy {
    background: var(--positive, #3fb950);
    color: #0d1117;
  }

  .segmented button.active-sell {
    background: var(--negative, #f85149);
    color: #fff;
  }

  .segmented button.active-mode {
    background: var(--accent, #4f9cf9);
    color: #fff;
  }

  .info {
    margin: 12px 0;
    font-size: 14px;
  }

  .warning {
    color: var(--negative, #f85149);
    font-size: 13px;
    margin: 8px 0;
  }

  .error {
    color: var(--negative, #f85149);
    font-size: 13px;
    margin: 8px 0;
  }

  .muted {
    color: var(--text-muted, #9aa4b2);
  }

  .hint {
    font-size: 12px;
    margin: 6px 0 0;
  }

  .when-toggle {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 0;
    cursor: pointer;
  }

  .when-toggle input[type='checkbox'] {
    width: auto;
    padding: 0;
    accent-color: var(--accent, #4f9cf9);
  }

  button.submit {
    font: inherit;
    color: #fff;
    background: var(--accent, #4f9cf9);
    border: 1px solid var(--accent, #4f9cf9);
    border-radius: 8px;
    padding: 9px 22px;
    cursor: pointer;
    font-weight: 600;
  }

  button.submit:disabled {
    opacity: 0.5;
    cursor: default;
  }

  .shares-row {
    display: flex;
    gap: 8px;
    align-items: stretch;
  }

  .shares-row input {
    width: 0;
    flex: 1;
    min-width: 0;
  }

  button.max {
    font: inherit;
    color: var(--text, #e6edf3);
    background: var(--bg, #0d1117);
    border: 1px solid var(--border, #2a313c);
    border-radius: 8px;
    padding: 9px 14px;
    cursor: pointer;
    font-weight: 600;
  }

  button.max:disabled {
    opacity: 0.5;
    cursor: default;
  }
`
