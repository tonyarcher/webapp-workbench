import {html, LitElement} from 'lit';
import {customElement, property, state} from 'lit/decorators.js';
import authCardCssText from './baseball-auth-card.css?inline';

const authCardSheet = new CSSStyleSheet();
authCardSheet.replaceSync(authCardCssText);

@customElement('baseball-auth-card')
export class BaseballAuthCard extends LitElement {
    static styles = authCardSheet;

    @property({type: Boolean, attribute: 'is-sign-up'}) isSignUp = false;
    @property({type: String, attribute: 'logged-in-user'}) loggedInUser = '';
    @property({type: String, attribute: 'error-message'}) errorMessage = '';

    @state() private username = '';
    @state() private password = '';

    render() {
        if (this.loggedInUser) {
            return html`
                <div class="card auth-container text-center">
                    <h2 class="welcome-title">Welcome back, ${this.loggedInUser}!</h2>
                    <p class="auth-desc">You are signed in to Grand Slam Baseball.</p>
                    <button class="btn btn-danger margin-top-md" @click=${this.handleLogout}>Sign Out</button>
                </div>
            `;
        }

        return html`
            <div class="card auth-container">
                <h2>${this.isSignUp ? 'Create an Account' : 'Sign In'}</h2>
                <p class="auth-desc">
                    ${this.isSignUp ? 'Join to manage leagues and teams' : 'Access your league account'}
                </p>

                ${this.errorMessage ? html`
                    <div class="error-banner">${this.errorMessage}</div>` : ''}

                <form @submit=${this.handleSubmit}>
                    <div class="form-group">
                        <label>Username / Email</label>
                        <input
                                type="text"
                                class="form-control"
                                .value=${this.username}
                                @input=${(e: Event) => (this.username = (e.target as HTMLInputElement).value)}
                                required
                        />
                    </div>

                    <div class="form-group">
                        <label>Password</label>
                        <input
                                type="password"
                                class="form-control"
                                .value=${this.password}
                                @input=${(e: Event) => (this.password = (e.target as HTMLInputElement).value)}
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

    private handleSubmit(e: Event) {
        e.preventDefault();
        this.dispatchEvent(
            new CustomEvent('auth-submit', {
                detail: {
                    isSignUp: this.isSignUp,
                    username: this.username,
                    password: this.password,
                },
                bubbles: true,
            })
        );
    }

    private handleLogout() {
        this.dispatchEvent(
            new CustomEvent('auth-logout', {
                bubbles: true,
            })
        );
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'baseball-auth-card': BaseballAuthCard;
    }
}
