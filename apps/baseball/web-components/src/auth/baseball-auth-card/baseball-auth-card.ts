import { html, css, unsafeCSS, LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import authCss from './baseball-auth-card.css?inline';

@customElement('baseball-auth-card')
export class BaseballAuthCard extends LitElement {
  static styles = css`${unsafeCSS(authCss)}`;

  @property({ type: String, attribute: 'error-message' }) errorMessage = '';
  @property({ type: String, attribute: 'logged-in-user' }) loggedInUser = '';

  @state() isSignUpMode = false;
  @state() username = '';
  @state() password = '';

  private toggleMode() {
    this.isSignUpMode = !this.isSignUpMode;
    this.errorMessage = '';
  }

  private onSubmit(e: Event) {
    e.preventDefault();
    this.dispatchEvent(
      new CustomEvent('auth-submit', {
        detail: {
          isSignUp: this.isSignUpMode,
          username: this.username,
          password: this.password
        },
        bubbles: true
      })
    );
  }

  private onLogout() {
    this.dispatchEvent(new CustomEvent('auth-logout', { bubbles: true }));
  }

  render() {
    if (this.loggedInUser) {
      return html`
        <div class="auth-card">
          <div class="auth-header">
            <h2>Welcome, ${this.loggedInUser}!</h2>
            <p>You are signed in to Baseball Pro account.</p>
          </div>
          <button class="btn-submit" @click=${this.onLogout}>Sign Out</button>
        </div>
      `;
    }

    return html`
      <div class="auth-card">
        <div class="auth-header">
          <h2>${this.isSignUpMode ? 'Create Account' : 'Sign In'}</h2>
          <p>${this.isSignUpMode ? 'Join Baseball Pro to track games & leagues' : 'Enter your credentials to continue'}</p>
        </div>

        ${this.errorMessage ? html`<div class="error-banner">${this.errorMessage}</div>` : ''}

        <form @submit=${this.onSubmit}>
          <div class="form-group">
            <label>Username</label>
            <input
              type="text"
              required
              .value=${this.username}
              @input=${(e: Event) => (this.username = (e.target as HTMLInputElement).value)}
            />
          </div>

          <div class="form-group">
            <label>Password</label>
            <input
              type="password"
              required
              .value=${this.password}
              @input=${(e: Event) => (this.password = (e.target as HTMLInputElement).value)}
            />
          </div>

          <button type="submit" class="btn-submit">
            ${this.isSignUpMode ? 'Register Account' : 'Sign In'}
          </button>
        </form>

        <div class="toggle-mode">
          ${this.isSignUpMode ? 'Already have an account?' : "Don't have an account?"}
          <span class="toggle-link" @click=${this.toggleMode}>
            ${this.isSignUpMode ? 'Sign In' : 'Sign Up'}
          </span>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'baseball-auth-card': BaseballAuthCard;
  }
}
