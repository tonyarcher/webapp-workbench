import { html } from 'lit';

export interface SpeedReadRenderHost {
    text: string;
    wpm: number;
    chunkSize: number;
    index: number;
    chunks: string[];
    playing: boolean;
    reducedMotion: boolean;
    toggle(): void;
    restart(): void;
    close(): void;
    setWpm(value: number): void;
    setChunkSize(value: number): void;
}

export function renderSpeedRead(host: SpeedReadRenderHost) {
    const chunk = host.chunks[host.index] ?? '';
    const progress = host.chunks.length ? Math.round((host.index / host.chunks.length) * 100) : 0;
    return html`
        <div class="view">
            <div class="toolbar">
                <h2>Speed read</h2>
                <button class="btn" @click=${() => host.toggle()} ?disabled=${host.reducedMotion}>${host.playing ? 'Pause' : 'Play'}</button>
                <button class="btn" @click=${() => host.restart()}>Restart</button>
                <button class="btn" @click=${() => host.close()}>Close</button>
            </div>
            ${
                host.reducedMotion
                    ? html`<div class="reduced">Reduced motion is on — speed read is disabled. Reading the text below.</div><div class="plain">${host.text}</div>`
                    : html`
                      <div class="word">${chunk}</div>
                      <div class="progress"><span style="width: ${progress}%"></span></div>
                      <div class="controls">
                          <label>WPM <input type="range" min="100" max="600" step="25" .value=${String(host.wpm)} @input=${(e: Event) => host.setWpm(Number((e.target as HTMLInputElement).value))} /></label>
                          <label>Chunk <input type="range" min="1" max="3" step="1" .value=${String(host.chunkSize)} @input=${(e: Event) => host.setChunkSize(Number((e.target as HTMLInputElement).value))} /></label>
                      </div>
                  `
            }
        </div>
    `;
}
