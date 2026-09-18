import {LitElement, html, svg, unsafeCSS} from 'lit';
import type {TemplateResult} from 'lit';
import {customElement, property} from 'lit/decorators.js';
import {getRulebook, laneRect, leftHoop, rightHoop} from 'basketball-core';
import type {CourtSpec, Point, RulebookId, ShotMark} from 'basketball-core';
import {PAD_X, PAD_Y, SCALE, clientToCourt, courtToSvg, viewSize} from '../../local-game/court-map';
import {restrictedSvg, threePointSvg} from '../../local-game/court-paint';
import styles from './court.css?inline';

@customElement('bball-court')
export class CourtView extends LitElement {
    static override styles = unsafeCSS(styles);

    @property() rulebookId: RulebookId = 'nba';
    @property({attribute: false}) shots: ShotMark[] = [];
    @property({attribute: false}) pending: Point | null = null;
    @property({type: Boolean}) interactive = false;

    private onClick = (event: MouseEvent): void => {
        if (!this.interactive) return;
        const svgEl = event.currentTarget;
        if (!(svgEl instanceof SVGSVGElement)) return;
        const spec = getRulebook(this.rulebookId).court;
        const point = clientToCourt(event.clientX, event.clientY, svgEl.getBoundingClientRect(), spec);
        if (!point) return;
        this.dispatchEvent(new CustomEvent('spot-picked', {
            detail: point,
            bubbles: true,
            composed: true,
        }));
    };

    override render(): TemplateResult {
        const spec = getRulebook(this.rulebookId).court;
        const size = viewSize(spec);
        return html`
            <div class="wrap">
                <svg
                    viewBox=${`0 0 ${size.width} ${size.height}`}
                    role=${this.interactive ? 'button' : 'img'}
                    aria-label="Basketball court"
                    @click=${this.onClick}
                >
                    ${courtLayers(spec)}
                    ${this.shots.map((shot) => shotMark(shot))}
                    ${this.pending ? pendingMark(this.pending) : ''}
                </svg>
                <p class="hint">${this.interactive ? 'Tap a location to log a shot' : 'Shot chart'}</p>
            </div>
        `;
    }
}

function courtLayers(spec: CourtSpec): TemplateResult {
    const size = viewSize(spec);
    const lHoop = leftHoop(spec);
    const rHoop = rightHoop(spec);
    return svg`
        ${woodFloor(spec, size)}
        ${lane(laneRect(spec, 'left'), '#1d4ed8')}
        ${lane(laneRect(spec, 'right'), '#1d4ed8')}
        ${lineWork(spec, lHoop, rHoop)}
        ${hoop(lHoop)}
        ${hoop(rHoop)}
    `;
}

function woodFloor(spec: CourtSpec, size: {width: number; height: number}): TemplateResult {
    return svg`
        <defs>
            <linearGradient id="wood" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stop-color="#d7b07a"/>
                <stop offset="50%" stop-color="#c4a06a"/>
                <stop offset="100%" stop-color="#a87d45"/>
            </linearGradient>
        </defs>
        <rect x="0" y="0" width=${size.width} height=${size.height} rx="18" fill="#12141a"/>
        <rect
            x=${PAD_X}
            y=${PAD_Y}
            width=${spec.length * SCALE}
            height=${spec.width * SCALE}
            fill="url(#wood)"
            stroke="#f3efe6"
            stroke-width="3"
        />
    `;
}

function lineWork(spec: CourtSpec, lHoop: Point, rHoop: Point): TemplateResult {
    const halfX = PAD_X + (spec.length / 2) * SCALE;
    const midY = PAD_Y + (spec.width / 2) * SCALE;
    return svg`
        <path d=${threePointSvg(lHoop, spec, 'left')} fill="none" stroke="#f7f4ee" stroke-width="2.4"/>
        <path d=${threePointSvg(rHoop, spec, 'right')} fill="none" stroke="#f7f4ee" stroke-width="2.4"/>
        <path d=${restrictedSvg(lHoop, spec, 'left')} fill="none" stroke="#f7f4ee" stroke-width="2"/>
        <path d=${restrictedSvg(rHoop, spec, 'right')} fill="none" stroke="#f7f4ee" stroke-width="2"/>
        <line x1=${halfX} y1=${PAD_Y} x2=${halfX} y2=${PAD_Y + spec.width * SCALE} stroke="#f7f4ee" stroke-width="2"/>
        <circle cx=${halfX} cy=${midY} r=${6 * SCALE} fill="none" stroke="#f7f4ee" stroke-width="2"/>
    `;
}

function lane(rect: {x: number; y: number; width: number; height: number}, fill: string): TemplateResult {
    const p = courtToSvg(rect.x, rect.y);
    return svg`
        <rect
            x=${p.x}
            y=${p.y}
            width=${rect.width * SCALE}
            height=${rect.height * SCALE}
            fill=${fill}
            fill-opacity="0.55"
            stroke="#f7f4ee"
            stroke-width="2"
        />
    `;
}

function hoop(point: Point): TemplateResult {
    const p = courtToSvg(point.x, point.y);
    return svg`
        <circle cx=${p.x} cy=${p.y} r="7" fill="none" stroke="#ea580c" stroke-width="3"/>
        <circle cx=${p.x} cy=${p.y} r="2.2" fill="#ea580c"/>
    `;
}

function shotMark(shot: ShotMark): TemplateResult {
    const p = courtToSvg(shot.xFeet, shot.yFeet);
    const color = shot.team === 'home' ? '#93c5fd' : '#fdba74';
    if (shot.made) {
        return svg`<circle cx=${p.x} cy=${p.y} r="7" fill=${color} stroke="#fff" stroke-width="1.4"/>`;
    }
    return svg`
        <path
            d=${`M ${p.x - 6} ${p.y - 6} L ${p.x + 6} ${p.y + 6} M ${p.x + 6} ${p.y - 6} L ${p.x - 6} ${p.y + 6}`}
            stroke=${color}
            stroke-width="2.6"
            stroke-linecap="round"
        />
    `;
}

function pendingMark(point: Point): TemplateResult {
    const p = courtToSvg(point.x, point.y);
    return svg`<circle cx=${p.x} cy=${p.y} r="9" fill="none" stroke="#f5d76e" stroke-width="2" stroke-dasharray="4 3"/>`;
}

declare global {
    interface HTMLElementTagNameMap {
        'bball-court': CourtView;
    }
}
