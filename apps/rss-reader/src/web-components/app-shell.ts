import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { history, parsePath } from '../router';
import { markArticleRead } from '../mutations';
import type { Article, View } from '../types';

@customElement('app-shell')
export class AppShell extends LitElement {
  static override styles = css`
    :host {
      display: flex;
      flex-direction: column;
      height: 100vh;
      width: 100vw;
      overflow: hidden;
      background: var(--bg);
      color: var(--text);
      font-family: var(--font-family);
      font-size: 14px;
    }
    header {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 0 16px;
      height: 48px;
      border-bottom: 1px solid var(--border);
      background: var(--panel-bg);
      flex: none;
    }
    header h1 {
      font-size: 15px;
      font-weight: 700;
      margin: 0;
      letter-spacing: 0.02em;
    }
    .logo {
      width: 22px;
      height: 22px;
      color: var(--accent);
    }
    header .sub {
      font-size: 12px;
      color: var(--text-muted);
    }
    .spacer {
      flex: 1;
    }
    .gear {
      border: none;
      background: none;
      cursor: pointer;
      color: var(--text-muted);
      padding: 6px;
      border-radius: 6px;
      display: inline-flex;
    }
    .gear:hover {
      color: var(--text);
      background: var(--hover);
    }
    .gear svg {
      width: 18px;
      height: 18px;
    }
    .layout {
      flex: 1;
      display: flex;
      min-height: 0;
    }
    source-list {
      width: 280px;
      flex: none;
    }
    main {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
    }
  `;

  @state() private route: View = { kind: 'all' };
  @state() private article: Article | null = null;
  @state() private settingsOpen = false;

  private readContext: { items: Article[]; index: number } | null = null;
  private unsubscribe?: () => void;

  override connectedCallback() {
    super.connectedCallback();
    this.route = parsePath(history.location.pathname);
    this.unsubscribe = history.subscribe(({ location }) => {
      this.route = parsePath(location.pathname);
      this.closeArticle();
    });
    window.addEventListener('keydown', this.onKeyDown);
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener('keydown', this.onKeyDown);
    this.unsubscribe?.();
  }

  private onKeyDown = (e: KeyboardEvent) => {
    if (!this.readContext) return;
    const target = e.target as HTMLElement | null;
    const tag = target?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (document.querySelector('dialog[open]')) return;

    const { items, index } = this.readContext;
    if (e.key === 'j' || e.key === 'ArrowDown') {
      e.preventDefault();
      if (index < items.length - 1) this.openAt(index + 1);
    } else if (e.key === 'k' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (index > 0) this.openAt(index - 1);
    } else if (e.key === 'Escape' || e.key === 'ArrowLeft' || e.key === 'Backspace') {
      e.preventDefault();
      this.closeArticle();
    }
  };

  private openAt(index: number) {
    if (!this.readContext) return;
    const article = this.readContext.items[index];
    if (!article) return;
    this.readContext = { ...this.readContext, index };
    this.article = article;
    void markArticleRead(article.id);
  }

  private onOpenArticle(e: Event) {
    const detail = (e as CustomEvent<{ article: Article; index: number; items: Article[] }>).detail;
    this.readContext = { items: detail.items, index: detail.index };
    this.article = detail.article;
  }

  private closeArticle() {
    this.article = null;
    this.readContext = null;
  }

  override render() {
    return html`
      <header>
        <svg class="logo" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="6" cy="18" r="2" fill="currentColor"/>
          <path d="M4 4a16 16 0 0 1 16 16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>
          <path d="M4 11a9 9 0 0 1 9 9" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>
        </svg>
        <h1>RSS Reader</h1>
        <span class="sub">your feeds, in one place</span>
        <div class="spacer"></div>
        <button class="gear" title="Settings" @click=${() => (this.settingsOpen = true)}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" fill="none" stroke="currentColor" stroke-width="1.7"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.08a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.08a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.08a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" fill="none" stroke="currentColor" stroke-width="1.5"/>
          </svg>
        </button>
      </header>
      <div class="layout">
        <source-list .view=${this.route}></source-list>
        <main>
          ${this.article
            ? html`<article-view
                .article=${this.article}
                @close=${this.closeArticle}
              ></article-view>`
            : this.route.kind === 'brief'
              ? html`<brief-view @open-article=${this.onOpenArticle}></brief-view>`
              : html`<article-list
                  .view=${this.route}
                  @open-article=${this.onOpenArticle}
                ></article-list>`}
        </main>
      </div>
      <settings-dialog
        .open=${this.settingsOpen}
        @close=${() => (this.settingsOpen = false)}
      ></settings-dialog>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'app-shell': AppShell;
  }
}
