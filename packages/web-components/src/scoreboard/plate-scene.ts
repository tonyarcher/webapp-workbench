import {html} from 'lit';
import {repeat} from 'lit/directives/repeat.js';
import {safeColor} from './plate-play';
import type {Handedness, ParsedPlatePlay, PlateResult} from './plate-play';
import {batterFigure, pitcherFigure} from './plate-figures';

export interface PlateSceneInput {
    play: ParsedPlatePlay | null;
    bats: Handedness;
    throws: Handedness;
    batterName: string;
    pitcherName: string;
    batterColor: string;
    pitcherColor: string;
    playSeq: number;
    playDurationMs: number;
    animations: boolean;
    interactive: boolean;
    armedZone: number;
    onZonePick: (zone: number | null) => void;
}

export function plateSceneClass(
    result: PlateResult | '',
    swinging: boolean,
    animated: boolean,
    locationKnown = true,
    interactive = false
): string {
    const parts = ['plate-scene'];
    if (result) parts.push(`result-${result.replace(' ', '-')}`, 'has-pitch');
    if (swinging) parts.push('swinging');
    parts.push(locationKnown ? 'has-location' : 'no-location');
    if (interactive) parts.push('zone-interactive');
    parts.push(animated ? 'animated' : 'instant');
    return parts.join(' ');
}

/** Chest-to-knees strike zone: 34 x 52 px at top 112. Zones 1-9 are cells; 10-17 are outside. */
const ZONE_TOP = 112;
const ZONE_W = 34;
const ZONE_H = 52;
const OUTSIDE_OFFSETS: Record<number, {dx: number; dy: number}> = {
    10: {dx: 0, dy: 89},
    11: {dx: 0, dy: 163},
    12: {dx: -31, dy: 129},
    13: {dx: 31, dy: 129},
    14: {dx: -24, dy: 89},
    15: {dx: 24, dy: 89},
    16: {dx: -24, dy: 163},
    17: {dx: 24, dy: 163},
};

/** Ball flight offset from the release point to the target zone cell. */
export function zoneOffsets(zone: number | null): {dx: number; dy: number} {
    const z = Math.min(17, Math.max(1, Math.round(zone ?? 5)));
    const outside = OUTSIDE_OFFSETS[z];
    if (outside) return outside;
    const col = (z - 1) % 3;
    const row = Math.floor((z - 1) / 3);
    return {
        dx: Math.round(((col - 1) * ZONE_W) / 3),
        dy: Math.round(ZONE_TOP + ((row + 0.5) * ZONE_H) / 3 - 9),
    };
}

/** Zone cell (1-9) under a point inside the zone box. */
export function zoneFromPoint(x: number, y: number, width: number, height: number): number {
    const col = Math.min(2, Math.max(0, Math.floor((x / width) * 3)));
    const row = Math.min(2, Math.max(0, Math.floor((y / height) * 3)));
    return row * 3 + col + 1;
}

/** Map a click onto the zone padding box, ignoring the 2px border. */
export function zoneFromClick(
    clientX: number,
    clientY: number,
    box: {left: number; top: number},
    borderLeft: number,
    borderTop: number,
    width: number,
    height: number,
): number {
    return zoneFromPoint(
        clientX - box.left - borderLeft,
        clientY - box.top - borderTop,
        width,
        height,
    );
}

export function renderPlateScene(input: PlateSceneInput) {
    const result = input.play?.result ?? '';
    const swinging = Boolean(input.play?.swinging);
    const animated = input.animations && input.playDurationMs > 40 && Boolean(result);
    const locationKnown = input.play !== null && input.play.zone !== null;
    return html`${repeat([input.playSeq], (seq) => seq, () => plateSceneMarkup(input, result, swinging, animated, locationKnown))}`;
}

function plateSceneMarkup(
    input: PlateSceneInput,
    result: PlateResult | '',
    swinging: boolean,
    animated: boolean,
    locationKnown: boolean
) {
    const {dx, dy} = zoneOffsets(input.play?.zone ?? null);
    const releaseX = input.throws === 'L' ? 16 : -16;
    return html`
      <div
          class=${plateSceneClass(result, swinging, animated, locationKnown, input.interactive)}
          data-testid="plate-view"
          data-bats=${input.bats}
          data-throws=${input.throws}
          style="--pitch-duration: ${input.playDurationMs}ms; --pitch-release: ${releaseX}px; --pitch-dx: ${dx - releaseX}px; --pitch-dy: ${dy}px"
      >
        <div class="mound"></div>
        ${platePitcher(input.throws, input.pitcherColor)}
        ${plateGround()}
        ${plateZone(result, input)}
        <div class="pitch-ball" data-testid="pitch-ball"></div>
        ${plateBatter(input.bats, input.batterColor)}
        <div class="hand-tag pitcher-tag">${input.throws}HP${input.pitcherName ? ` ${input.pitcherName}` : ''}</div>
        <div class="hand-tag batter-tag">${input.bats}HB${input.batterName ? ` ${input.batterName}` : ''}</div>
      </div>
    `;
}

function plateGround() {
    return html`
      <div class="ground">
        <div class="plate-dirt"></div>
        <div class="batters-box box-left"></div>
        <div class="batters-box box-right"></div>
        <div class="home-plate"></div>
      </div>
    `;
}

function plateZone(result: PlateResult | '', input: PlateSceneInput) {
    const armed = input.armedZone;
    const col = armed >= 1 && armed <= 9 ? (armed - 1) % 3 : -1;
    const row = armed >= 1 && armed <= 9 ? Math.floor((armed - 1) / 3) : -1;
    return html`
      <div class="zone" @click=${(event: MouseEvent) => onZoneClick(event, input)}>
        <div class="zone-grid"></div>
        <div class="zone-result" data-testid="plate-result" aria-live="polite">${result}</div>
        ${col >= 0
            ? html`<div class="zone-pick" data-testid="zone-pick" style="left: ${((col + 0.5) * 100) / 3}%; top: ${((row + 0.5) * 100) / 3}%"></div>`
            : ''}
      </div>
    `;
}

function onZoneClick(event: MouseEvent, input: PlateSceneInput): void {
    if (!input.interactive) return;
    const target = event.currentTarget;
    if (!(target instanceof HTMLElement)) return;
    const rect = target.getBoundingClientRect();
    const style = getComputedStyle(target);
    const zone = zoneFromClick(
        event.clientX,
        event.clientY,
        rect,
        parseFloat(style.borderLeftWidth),
        parseFloat(style.borderTopWidth),
        target.clientWidth,
        target.clientHeight,
    );
    input.onZonePick(zone === input.armedZone ? null : zone);
}

function platePitcher(throws: Handedness, color: string) {
    return html`
      <div class="sign pitcher throws-${throws}" data-testid="plate-pitcher" style="--team: ${safeColor(color)}">${pitcherSvg()}</div>
    `;
}

function plateBatter(bats: Handedness, color: string) {
    return html`
      <div class="sign batter bats-${bats}" data-testid="plate-batter" style="--team: ${safeColor(color)}">${batterSvg()}</div>
    `;
}

function pitcherSvg() {
    return html`<svg class="wire-sign" viewBox="0 0 60 84" aria-hidden="true">${pitcherFigure()}</svg>`;
}

function batterSvg() {
    return html`<svg class="wire-sign" viewBox="14 0 72 132" aria-hidden="true">${batterFigure()}</svg>`;
}
