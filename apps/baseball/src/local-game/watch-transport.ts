import { html, nothing } from 'lit';
import type { TemplateResult } from 'lit';
import { SPEED_OPTIONS } from '../sim/playback';
import { activePlayLabel, watchBadge } from './watch-runner';

export interface WatchTransportModel {
  enabled: boolean;
  over: boolean;
  playing: boolean;
  awayName: string;
  homeName: string;
  activePlayJson: string;
  speed: number;
  animations: boolean;
  onPlay: () => void;
  onPause: () => void;
  onSpeed: (event: Event) => void;
  onAnimations: (event: Event) => void;
}

export function renderWatchTransport(model: WatchTransportModel): TemplateResult | typeof nothing {
  if (!model.enabled) return nothing;
  return html`
    <section class="sim-transport card" data-testid="sim-transport">
      ${watchTransportChrome(model)} ${watchTransportControls(model)}
    </section>
  `;
}

function watchTransportChrome(model: WatchTransportModel): TemplateResult {
  const label = activePlayLabel(model.activePlayJson);
  return html`
    <span class="sim-badge" data-testid="sim-badge">${watchBadge(model.over, model.playing)}</span>
    <span data-testid="watch-title">Watching: ${model.awayName} @ ${model.homeName}</span>
    <span class="sim-last-play" data-testid="sim-last-play" aria-live="polite">${label}</span>
    <span class="sim-active-play" data-testid="active-play" aria-hidden="true">${model.activePlayJson}</span>
  `;
}

function watchTransportControls(model: WatchTransportModel): TemplateResult {
  return html`
    <button class="btn btn-secondary" type="button" data-testid="sim-play-button" ?disabled=${model.playing || model.over} @click=${model.onPlay}>
      Play
    </button>
    <button class="btn btn-secondary" type="button" data-testid="sim-pause-button" ?disabled=${!model.playing} @click=${model.onPause}>
      Pause
    </button>
    ${watchSpeedSelect(model)} ${watchAnimToggle(model)}
  `;
}

function watchSpeedSelect(model: WatchTransportModel): TemplateResult {
  return html`
    <label class="sim-speed-label">
      Speed
      <select data-testid="sim-speed-select" @change=${model.onSpeed}>
        ${SPEED_OPTIONS.map(
          (option) => html`<option value=${String(option.value)} ?selected=${model.speed === option.value}>${option.label}</option>`
        )}
      </select>
    </label>
  `;
}

function watchAnimToggle(model: WatchTransportModel): TemplateResult {
  return html`
    <label class="sim-anim-label">
      <input type="checkbox" data-testid="sim-animations-toggle" .checked=${model.animations} @change=${model.onAnimations} />
      Animations
    </label>
  `;
}
