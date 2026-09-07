import {html, LitElement, nothing} from 'lit';
import {repeat} from 'lit/directives/repeat.js';
import {customElement, property} from 'lit/decorators.js';
import {isBattedBall, parsePlatePlay} from '../../scoreboard/plate-play';
import {HOME_POINT, hitEndpoint} from './hit-line';
import defenseCssText from './baseball-defense-diagram.css?inline';

const defenseSheet = new CSSStyleSheet();
defenseSheet.replaceSync(defenseCssText);

const FIELD_POSITIONS = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'] as const;

export interface FielderPosition {
    posName: string;
    playerName: string;
    jerseyNumber?: number;
}

@customElement('baseball-defense-diagram')
export class BaseballDefenseDiagram extends LitElement {
    static styles = defenseSheet;

    @property({type: String, attribute: 'defending-team'}) defendingTeam = 'Defending Team';
    @property({
        attribute: 'fielders-json',
        converter: (value: string | null) => {
            if (!value) return [];
            try {
                const parsed = JSON.parse(value) as unknown;
                return Array.isArray(parsed) ? parsed : [];
            } catch {
                return [];
            }
        },
    })
    fielders: FielderPosition[] = [];
    @property({type: String, attribute: 'active-play-json'}) activePlayJson = '';
    @property({type: Number, attribute: 'play-seq'}) playSeq = 0;
    @property({type: Number, attribute: 'play-duration-ms'}) playDurationMs = 4000;
    @property({
        attribute: 'animations',
        converter: {
            fromAttribute: (value: string | null) => value !== 'false',
            toAttribute: (value: boolean) => (value ? 'true' : 'false'),
        },
        reflect: true,
    })
    animations = true;

    render() {
        return html`
      <div class="field-diagram-card" data-testid="defense-diagram" style="--pitch-duration: ${this.playDurationMs}ms">
        <h3>Defensive Alignment - ${this.defendingTeam}</h3>
        <div class="field-diagram-wrapper">
          <div id="field-diamond-bg"></div>
          ${repeat([this.playSeq], (seq) => seq, () => this.renderHitLine())}
          ${this.renderFielders()}
        </div>
      </div>
    `;
    }

    private resolvedFielders(): FielderPosition[] {
        const provided = new Map(
            this.fielders
                .filter((fielder) => typeof fielder?.posName === 'string')
                .map((fielder) => [fielder.posName, fielder])
        );
        return FIELD_POSITIONS.map((pos) => provided.get(pos) ?? {posName: pos, playerName: '', jerseyNumber: 0});
    }

    private renderFielders() {
        return html`${this.resolvedFielders().map((fielder) => this.renderFielder(fielder))}`;
    }

    private renderFielder(fielder: FielderPosition) {
        const posClass = `pos-pos-${fielder.posName}`;
        return html`
          <div class="field-position-badge ${posClass}" data-pos=${fielder.posName}>
            <span class="pos-code">${fielder.posName}${fielder.jerseyNumber ? ` #${fielder.jerseyNumber}` : ''}</span>
            ${fielder.playerName
                ? html`<span class="fielder-name">${fielder.playerName}</span>`
                : nothing}
          </div>
        `;
    }

    private renderHitLine() {
        const play = parsePlatePlay(this.activePlayJson);
        if (!play || play.fieldPos == null || !isBattedBall(play.eventType)) return nothing;
        const end = hitEndpoint(play.fieldPos, play.eventType);
        if (!end) return nothing;
        const animated = this.animations && this.playDurationMs > 40;
        return html`
          <svg class="hit-line-layer" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <line
                class="hit-line ${animated ? 'draw' : 'drawn'}"
                data-testid="hit-line"
                x1=${HOME_POINT.x}
                y1=${HOME_POINT.y}
                x2=${end.x}
                y2=${end.y}
            ></line>
          </svg>
        `;
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'baseball-defense-diagram': BaseballDefenseDiagram;
    }
}
