import {LitElement, html, unsafeCSS} from 'lit';
import type {TemplateResult} from 'lit';
import {customElement, property} from 'lit/decorators.js';
import type {NowPlaying} from '../../services/now-playing';
import {formatClock, formatHms} from '../../services/format';
import styles from './now-playing.css?inline';

@customElement('rs-now-playing')
export class NowPlayingBar extends LitElement {
    static override styles = unsafeCSS(styles);

    @property({attribute: false}) nowPlaying: NowPlaying = {kind: 'outside'};
    @property({type: Number}) now = Date.now();

    private emitJump(): void {
        this.dispatchEvent(new CustomEvent('jump-now', {bubbles: true, composed: true}));
    }

    private renderTrack(state: Extract<NowPlaying, {kind: 'track'}>): TemplateResult {
        const {entry, elapsedMs, progress} = state;
        return html`
            <div class="on-air" aria-hidden="true"></div>
            <div class="copy">
                <p class="kicker">On air · ${formatClock(this.now)}</p>
                <p class="title">${entry.artist} — ${entry.title}</p>
                <p class="time">${formatHms(elapsedMs)} / ${formatHms(entry.durationMs)}</p>
            </div>
            <div class="meter" role="progressbar" aria-label="Track progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow=${Math.round(progress * 100)}>
                <div class="meter-fill" style="width: ${progress * 100}%"></div>
            </div>
            <button class="jump" type="button" @click=${this.emitJump}>Jump to now</button>
        `;
    }

    override render(): TemplateResult {
        const state = this.nowPlaying;
        if (state.kind === 'track') {
            return html`<div class="row live">${this.renderTrack(state)}</div>`;
        }
        return html`
            <div class="row idle">
                <div class="copy">
                    <p class="kicker">${formatClock(this.now)}</p>
                    <p class="title">Outside this week</p>
                </div>
            </div>
        `;
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'rs-now-playing': NowPlayingBar;
    }
}
