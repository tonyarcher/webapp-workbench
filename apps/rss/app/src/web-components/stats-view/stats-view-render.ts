import { html } from 'lit';

export interface StatsViewRenderHost {
    loading: boolean;
    totalMinutes: number;
    finishRate: number;
    readCount: number;
    totalCount: number;
    streak: number;
    topics: Array<{ topic: string; count: number }>;
}

export function renderStatsView(host: StatsViewRenderHost) {
    return html`
        <div class="view">
            <div class="toolbar"><h2>Mastery stats</h2></div>
            <div class="body" tabindex="0">
                ${host.loading ? html`<div class="empty">Loading…</div>` : ''}
                ${
                    !host.loading
                        ? html`
                          <div class="grid">
                              <div class="card"><span class="label">Minutes read</span><span class="value">${host.totalMinutes}</span></div>
                              <div class="card"><span class="label">Finish rate</span><span class="value">${Math.round(host.finishRate * 100)}%</span></div>
                              <div class="card"><span class="label">Articles read</span><span class="value">${host.readCount} / ${host.totalCount}</span></div>
                              <div class="card"><span class="label">Focus streak</span><span class="value">${host.streak}</span></div>
                          </div>
                          <h3>Topic mix</h3>
                          <ul class="topics">
                              ${host.topics.map((t) => html`<li><span class="topic">${t.topic}</span><span class="count">${t.count}</span></li>`)}
                          </ul>
                          ${!host.topics.length ? html`<div class="empty">No read articles yet.</div>` : ''}
                      `
                        : ''
                }
            </div>
        </div>
    `;
}
