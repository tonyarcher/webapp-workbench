typescriptstatic styles = css`
  :host {
    display: block;
    border-radius: var(--baseball-radius);
    background: white;
    box-shadow: 0 4px 6px rgba(0,0,0,0.1);
  }
  h3 {
    color: var(--baseball-primary); /* Reads perfectly from the top level! */
    font-family: var(--baseball-font-sans);
  }
`; Use code with caution.Updated AGENTS.md for Your Migration StrategyThis updated file explicitly instructs AI coding
agents on how to handle styling so it remains fully compatible with your future React migration.markdown# Web Components
Subfolder Instructions (Lit + TS + Vite Migration Setup)

## Scope & Role

You are developing `@baseball/web-components`. These components must remain strictly framework-agnostic so they can
easily be dropped into Kotlin templates now, and React/TanStack later.

## Commands (Scoped)

- Local Dev Server: `npm run dev`
- Production Build: `npm run build`
- Type Check: `npx tsc --noEmit`

## Do's (CSS & Component Architecture)

- **Use Global CSS Variables:** Only style components using global custom properties (e.g., `var(--baseball-primary)`).
  Never hardcode Hex colors or specific font-families inside components.
- **Component Self-Containment:** Put layout, spacing, and structural CSS entirely inside the Lit component's
  `static styles` block.
- **Support Host Styling:** Always define a `:host` selector in `static styles` to control the element's default block
  behavior (e.g., `:host { display: block; }`).
- **React Compatibility:** Keep event payloads standard (`CustomEvent`) so React wrappers or TanStack event handlers can
  read them cleanly later.

## Don'ts

- **No Class Name Reliance from Outside:** Never assume an external stylesheet will style the internal HTML markup of a
  component.
- **No Hardcoded Values:** Do not bypass the design tokens found in the top-level CSS directory.
- **No Framework-Specific Code:** Do not introduce any Kotlin or React bindings inside this subfolder. Keep it 100%
  standard web specifications.

## Example Pattern (Theme-Aware Component)

```typescript
import {LitElement, html, css} from 'lit';
import {customElement, property} from 'lit/decorators.js';

@customElement('baseball-player-badge')
export class BaseballPlayerBadge extends LitElement {
    // 1. Structural and theme-linked styles lived safely inside the Shadow DOM
    static styles = css`
    :host {
      display: inline-flex;
      align-items: center;
      padding: var(--baseball-spacing-sm, 6px);
      border: 2px solid var(--baseball-primary, #333);
      border-radius: var(--baseball-radius, 4px);
    }
    .position {
      background-color: var(--baseball-secondary, #666);
      color: white;
      padding: 2px 6px;
    }
  `;

    @property({type: String}) name = '';
    @property({type: String}) position = '';

    protected render() {
        return html`
      <span class="position">${this.position}</span>
      <span class="name">${this.name}</span>
    `;
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'baseball-player-badge': BaseballPlayerBadge;
    }
}
```