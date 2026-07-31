import {html, LitElement} from 'lit';
import {customElement, property} from 'lit/decorators.js';
import wrapperCssText from './baseball-tab-page-wrapper.css?inline';

const wrapperSheet = new CSSStyleSheet();
wrapperSheet.replaceSync(wrapperCssText);

@customElement('baseball-tab-page-wrapper')
export class BaseballTabPageWrapper extends LitElement {
    static styles = wrapperSheet;

    @property({type: String, attribute: 'page-title'}) pageTitle = '';
    @property({type: String, attribute: 'loading-message'}) loadingMessage = '';
    @property({type: String, attribute: 'empty-message'}) emptyMessage = '';

    render() {
        if (this.loadingMessage) {
            return html`<div class="loading-state">${this.loadingMessage}</div>`;
        }

        return html`
            ${this.pageTitle ? html`<h1>${this.pageTitle}</h1>` : ''}
            ${this.emptyMessage
            ? html`<p class="empty-state">${this.emptyMessage}</p>`
            : html`<slot></slot>`}
        `;
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'baseball-tab-page-wrapper': BaseballTabPageWrapper;
    }
}
