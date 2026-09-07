import {html} from 'lit';
import {repeat} from 'lit/directives/repeat.js';
import type {Handedness, ParsedPlatePlay, PlateResult} from './plate-play';

export interface PlateSceneInput {
    play: ParsedPlatePlay | null;
    bats: Handedness;
    throws: Handedness;
    batterName: string;
    pitcherName: string;
    playSeq: number;
    playDurationMs: number;
    animations: boolean;
}

export function plateSceneClass(result: PlateResult | '', swinging: boolean, animated: boolean): string {
    const parts = ['plate-scene'];
    if (result) parts.push(`result-${result.replace(' ', '-')}`, 'has-pitch');
    if (swinging) parts.push('swinging');
    parts.push(animated ? 'animated' : 'instant');
    return parts.join(' ');
}

export function renderPlateScene(input: PlateSceneInput) {
    const result = input.play?.result ?? '';
    const swinging = Boolean(input.play?.swinging);
    const animated = input.animations && input.playDurationMs > 40 && Boolean(result);
    return html`${repeat([input.playSeq], (seq) => seq, () => plateSceneMarkup(input, result, swinging, animated))}`;
}

function plateSceneMarkup(
    input: PlateSceneInput,
    result: PlateResult | '',
    swinging: boolean,
    animated: boolean
) {
    return html`
      <div
          class=${plateSceneClass(result, swinging, animated)}
          data-testid="plate-view"
          data-bats=${input.bats}
          data-throws=${input.throws}
          style="--pitch-duration: ${input.playDurationMs}ms"
      >
        <div class="mound"></div>
        ${platePitcher(input.throws)}
        <div class="batters-box box-left"></div>
        <div class="batters-box box-right"></div>
        <div class="home-plate"></div>
        ${plateZone(result)} ${plateBatter(input.bats)}
        <div class="hand-tag pitcher-tag">${input.throws}HP${input.pitcherName ? ` ${input.pitcherName}` : ''}</div>
        <div class="hand-tag batter-tag">${input.bats}HB${input.batterName ? ` ${input.batterName}` : ''}</div>
      </div>
    `;
}

function plateZone(result: PlateResult | '') {
    return html`
      <div class="zone">
        <div class="zone-grid"></div>
        <div class="zone-result" data-testid="plate-result" aria-live="polite">${result}</div>
      </div>
    `;
}

function platePitcher(throws: Handedness) {
    return html`
      <div class="sign pitcher throws-${throws}" data-testid="plate-pitcher">${pitcherSvg()}</div>
    `;
}

function plateBatter(bats: Handedness) {
    return html`
      <div class="sign batter bats-${bats}" data-testid="plate-batter">${batterSvg()}</div>
    `;
}

function pitcherSvg() {
    return html`
      <svg class="wire-sign" viewBox="0 0 40 72" aria-hidden="true">
        <path d="M14 8 Q20 4 26 8 L27 12 H13 Z"/>
        <ellipse cx="20" cy="16" rx="4" ry="5"/>
        <path d="M20 21 V24 M14 25 H26 L24 42 H16 Z"/>
        <path d="M17 42 L15 56 L13 70 M23 42 L26 54 L25 70"/>
        ${pitcherArms()}
      </svg>
    `;
}

function pitcherArms() {
    return html`
      <path class="arm-glove-R" d="M26 27 L33 35"/>
      <ellipse class="arm-glove-R" cx="35" cy="37" rx="3" ry="2.2"/>
      <path class="arm-glove-L" d="M14 27 L7 35"/>
      <ellipse class="arm-glove-L" cx="5" cy="37" rx="3" ry="2.2"/>
      <path class="arm-throw-R" d="M14 27 L6 20 L5 12"/>
      <path class="arm-throw-L" d="M26 27 L34 20 L35 12"/>
    `;
}

function batterSvg() {
    return html`
      <svg class="wire-sign" viewBox="0 0 52 84" aria-hidden="true">
        <path d="M30 9 H40 L39 6 H31 Z"/>
        <ellipse cx="35" cy="14" rx="5" ry="6"/>
        <path d="M27 23 L39 25 L36 46 H25 Z"/>
        <path d="M29 46 L38 62 L37 82 M24 46 L17 64 L16 82"/>
        <path d="M31 27 L22 34 L18 32 M23 25 L7 8"/>
      </svg>
    `;
}
