var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import wrapperCssText from './baseball-tab-page-wrapper.css?inline';
const wrapperSheet = new CSSStyleSheet();
wrapperSheet.replaceSync(wrapperCssText);
let BaseballTabPageWrapper = class BaseballTabPageWrapper extends LitElement {
    constructor() {
        super(...arguments);
        this.pageTitle = '';
        this.loadingMessage = '';
        this.emptyMessage = '';
    }
    static { this.styles = wrapperSheet; }
    render() {
        if (this.loadingMessage) {
            return html `<div class="loading-state">${this.loadingMessage}</div>`;
        }
        return html `
            ${this.pageTitle ? html `<h1>${this.pageTitle}</h1>` : ''}
            ${this.emptyMessage
            ? html `<p class="empty-state">${this.emptyMessage}</p>`
            : html `<slot></slot>`}
        `;
    }
};
__decorate([
    property({ type: String, attribute: 'page-title' })
], BaseballTabPageWrapper.prototype, "pageTitle", void 0);
__decorate([
    property({ type: String, attribute: 'loading-message' })
], BaseballTabPageWrapper.prototype, "loadingMessage", void 0);
__decorate([
    property({ type: String, attribute: 'empty-message' })
], BaseballTabPageWrapper.prototype, "emptyMessage", void 0);
BaseballTabPageWrapper = __decorate([
    customElement('baseball-tab-page-wrapper')
], BaseballTabPageWrapper);
export { BaseballTabPageWrapper };
