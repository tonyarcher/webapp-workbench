import {LitElement, html, unsafeCSS} from 'lit';
import type {TemplateResult} from 'lit';
import {customElement, property, state} from 'lit/decorators.js';
import {unsafeHTML} from 'lit/directives/unsafe-html.js';
import {describePlay} from 'football-core';
import type {Play, Situation} from 'football-core';
import {playFlight} from '../../local-game/field-geom';
import type {FieldAnimKind} from '../../local-game/field-geom';
import {paintFieldSvg, playPath} from '../../local-game/field-paint';
import styles from './field.css?inline';

@customElement('fb-field')
export class FieldView extends LitElement {
    static override styles = unsafeCSS(styles);

    @property({attribute: false}) situation!: Situation;
    @property({attribute: false}) lastPlay: Play | null = null;
    @property() homeName = 'HOME';
    @property() awayName = 'AWAY';
    @property({type: Boolean}) animations = true;

    @state() private trailPath = '';
    @state() private trailKind: FieldAnimKind | null = null;
    @state() private fgPath = '';
    @state() private fgKey = 0;

    private lastSeenPlayId = '';

    override willUpdate(changed: Map<PropertyKey, unknown>): void {
        if (!changed.has('lastPlay')) return;
        if (!this.lastPlay) {
            this.clearFlight();
            this.lastSeenPlayId = '';
            return;
        }
        if (this.lastPlay.id === this.lastSeenPlayId) return;
        this.lastSeenPlayId = this.lastPlay.id;
        const flight = playFlight(this.lastPlay);
        if (!flight) {
            this.clearFlight();
            return;
        }
        this.trailKind = flight.kind;
        this.trailPath = playPath(flight);
        this.fgPath = flight.kind === 'fg' ? this.trailPath : '';
        if (flight.kind === 'fg') this.fgKey += 1;
    }

    private clearFlight(): void {
        this.trailPath = '';
        this.trailKind = null;
        this.fgPath = '';
    }

    private animateFg(): boolean {
        if (!this.animations || !this.fgPath) return false;
        if (typeof matchMedia !== 'function') return true;
        return !matchMedia('(prefers-reduced-motion: reduce)').matches;
    }

    override render(): TemplateResult {
        if (!this.situation) return html``;
        const caption = this.lastPlay
            ? describePlay(this.lastPlay, this.homeName, this.awayName)
            : 'Ball spotted';
        const svg = paintFieldSvg({
            situation: this.situation,
            homeName: this.homeName,
            awayName: this.awayName,
            trailPath: this.trailPath,
            trailKind: this.trailKind,
            fgPath: this.fgPath,
            fgKey: this.fgKey,
            animateFg: this.animateFg(),
        });
        return html`
            <div class="wrap">
                ${unsafeHTML(svg)}
                <p class="play-call">${caption}</p>
            </div>
        `;
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'fb-field': FieldView;
    }
}
