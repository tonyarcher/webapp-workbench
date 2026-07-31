var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { html, LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import authCardCssText from './baseball-auth-card.css?inline';
const authCardSheet = new CSSStyleSheet();
authCardSheet.replaceSync(authCardCssText);
let BaseballAuthCard = class BaseballAuthCard extends LitElement {
    constructor() {
        super(...arguments);
        this.isSignUp = false;
        this.loggedInUser = '';
        this.errorMessage = '';
        this.username = '';
        this.password = '';
    }
    static { this.styles = authCardSheet; }
    render() {
        if (this.loggedInUser) {
            return html `
                <div class="card auth-container text-center">
                    <h2 class="welcome-title">Welcome back, ${this.loggedInUser}!</h2>
                    <p class="auth-desc">You are signed in to Grand Slam Baseball.</p>
                    <button class="btn btn-danger margin-top-md" @click=${this.handleLogout}>Sign Out</button>
                </div>
            `;
        }
        return html `
            <div class="card auth-container">
                <h2>${this.isSignUp ? 'Create an Account' : 'Sign In'}</h2>
                <p class="auth-desc">
                    ${this.isSignUp ? 'Join to manage leagues and teams' : 'Access your league account'}
                </p>

                ${this.errorMessage ? html `
                    <div class="error-banner">${this.errorMessage}</div>` : ''}

                <form @submit=${this.handleSubmit}>
                    <div class="form-group">
                        <label>Username / Email</label>
                        <input
                                type="text"
                                class="form-control"
                                .value=${this.username}
                                @input=${(e) => (this.username = e.target.value)}
                                required
                        />
                    </div>

                    <div class="form-group">
                        <label>Password</label>
                        <input
                                type="password"
                                class="form-control"
                                .value=${this.password}
                                @input=${(e) => (this.password = e.target.value)}
                                required
                        />
                    </div>

                    <button type="submit" class="btn btn-full margin-top-md">
                        ${this.isSignUp ? 'Sign Up' : 'Sign In'}
                    </button>
                </form>

                <div class="toggle-mode margin-top-md">
                    <span>${this.isSignUp ? 'Already have an account?' : "Don't have an account?"}</span>
                    <button class="btn-link" @click=${() => (this.isSignUp = !this.isSignUp)}>
                        ${this.isSignUp ? 'Sign In' : 'Register Now'}
                    </button>
                </div>
            </div>
        `;
    }
    handleSubmit(e) {
        e.preventDefault();
        this.dispatchEvent(new CustomEvent('auth-submit', {
            detail: {
                isSignUp: this.isSignUp,
                username: this.username,
                password: this.password,
            },
            bubbles: true,
        }));
    }
    handleLogout() {
        this.dispatchEvent(new CustomEvent('auth-logout', {
            bubbles: true,
        }));
    }
};
__decorate([
    property({ type: Boolean, attribute: 'is-sign-up' })
], BaseballAuthCard.prototype, "isSignUp", void 0);
__decorate([
    property({ type: String, attribute: 'logged-in-user' })
], BaseballAuthCard.prototype, "loggedInUser", void 0);
__decorate([
    property({ type: String, attribute: 'error-message' })
], BaseballAuthCard.prototype, "errorMessage", void 0);
__decorate([
    state()
], BaseballAuthCard.prototype, "username", void 0);
__decorate([
    state()
], BaseballAuthCard.prototype, "password", void 0);
BaseballAuthCard = __decorate([
    customElement('baseball-auth-card')
], BaseballAuthCard);
export { BaseballAuthCard };
