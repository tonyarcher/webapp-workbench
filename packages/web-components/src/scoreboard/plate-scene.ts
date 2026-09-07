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
        ${plateZone(result)} ${platePitcher(input.throws)} ${plateBatter(input.bats)}
        <div class="pitch-ball"></div>
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
      <div class="figure pitcher throws-${throws}" data-testid="plate-pitcher">
        <div class="fig-head"></div>
        <div class="fig-body"></div>
        <div class="fig-arm glove"></div>
        <div class="fig-arm throw"></div>
        <div class="fig-leg l"></div>
        <div class="fig-leg r"></div>
      </div>
    `;
}

function plateBatter(bats: Handedness) {
    return html`
      <div class="figure batter bats-${bats}" data-testid="plate-batter">
        <div class="fig-head"></div>
        <div class="fig-body"></div>
        <div class="fig-arm glove"></div>
        <div class="bat"></div>
        <div class="fig-leg l"></div>
        <div class="fig-leg r"></div>
      </div>
    `;
}
