import {LitElement, html, unsafeCSS} from 'lit';
import type {TemplateResult} from 'lit';
import {customElement, state} from 'lit/decorators.js';
import type {DayFilter, GenerateResult, ListItem, PlaylistEntry, Weights} from '../../types';
import {DEFAULT_WEIGHTS} from '../../services/defaults';
import {createPlaylist, restorePlaylist} from '../../services/api';
import {formatPlaylistTxt} from '../../services/export-txt';
import {findNowPlaying, type NowPlaying} from '../../services/now-playing';
import {toListItems, weekDays} from '../../services/list-items';
import {localMidnightMs} from '../../services/format';
import {clearSession, loadSession, saveSession} from '../../services/session-store';
import type {GenerateDetail} from '../toolbar/toolbar';
import '../toolbar/toolbar';
import '../now-playing/now-playing';
import '../day-filter/day-filter';
import '../week-list/week-list';
import styles from './app-shell.css?inline';

@customElement('rs-app-shell')
export class AppShell extends LitElement {
    static override styles = unsafeCSS(styles);

    @state() private seed = '';
    @state() private weights: Weights = DEFAULT_WEIGHTS;
    @state() private result: GenerateResult | null = null;
    @state() private day: DayFilter = 'all';
    @state() private busy = false;
    @state() private error = '';
    @state() private now = Date.now();
    @state() private jumpToken = 0;
    @state() private listItems: ListItem[] = [];
    @state() private days: {key: string; label: string}[] = [];

    private timer: number | null = null;
    private listKey = '';

    override connectedCallback(): void {
        super.connectedCallback();
        this.timer = window.setInterval(() => {
            this.now = Date.now();
        }, 1_000);
        const saved = loadSession();
        if (saved) {
            this.seed = saved.seed;
            this.weights = saved.weights;
            void this.restore(saved.playlistId);
        }
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        if (this.timer != null) window.clearInterval(this.timer);
        this.timer = null;
    }

    private get entries(): PlaylistEntry[] {
        return this.result?.entries ?? [];
    }

    private get nowPlaying(): NowPlaying {
        return findNowPlaying(this.entries, this.now);
    }

    private get currentIdx(): number {
        const np = this.nowPlaying;
        return np.kind === 'track' ? np.entry.idx : -1;
    }

    private onClockChange(event: CustomEvent<GenerateDetail>): void {
        this.seed = event.detail.seed;
        this.weights = event.detail.weights;
    }

    private onGenerate(event: CustomEvent<GenerateDetail>): void {
        this.seed = event.detail.seed;
        this.weights = event.detail.weights;
        void this.generate();
    }

    private async restore(id: string): Promise<void> {
        try {
            this.result = await restorePlaylist(id);
            this.seed = this.result.playlist.seed;
            this.weights = this.result.playlist.weights;
            this.error = '';
        } catch (err) {
            clearSession();
            this.result = null;
            this.error = err instanceof Error ? err.message : String(err);
        }
    }

    private async generate(): Promise<void> {
        this.busy = true;
        this.error = '';
        try {
            const result = await createPlaylist({
                stationId: 'top40',
                seed: this.seed || undefined,
                startsAt: localMidnightMs(this.now),
                weights: this.weights,
            });
            this.result = result;
            this.seed = result.playlist.seed;
            this.weights = result.playlist.weights;
            this.day = 'all';
            saveSession({
                version: 1,
                playlistId: result.playlist.id,
                seed: result.playlist.seed,
                weights: result.playlist.weights,
                startsAt: result.playlist.startsAt,
            });
        } catch (err) {
            this.error = err instanceof Error ? err.message : String(err);
        } finally {
            this.busy = false;
        }
    }

    private onExport(): void {
        const result = this.result;
        if (!result) return;
        const txt = formatPlaylistTxt({
            stationName: result.playlist.stationName,
            seed: result.playlist.seed,
            weights: result.playlist.weights,
            entries: result.entries,
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        });
        const blob = new Blob([txt], {type: 'text/plain;charset=utf-8'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${result.playlist.seed}.txt`;
        a.click();
        URL.revokeObjectURL(url);
    }

    private onDayChange(event: CustomEvent<DayFilter>): void {
        this.day = event.detail;
    }

    private onJumpNow(): void {
        this.jumpToken += 1;
        if (this.day !== 'all' && this.nowPlaying.kind === 'track') {
            this.day = 'all';
        }
    }

    private syncList(): void {
        const result = this.result;
        const key = `${result?.playlist.id ?? ''}:${this.day}:${result?.entries.length ?? 0}`;
        if (key === this.listKey) return;
        this.listKey = key;
        const entries = result?.entries ?? [];
        this.days = weekDays(entries);
        this.listItems = toListItems(entries, this.day);
    }

    override willUpdate(): void {
        this.syncList();
    }

    override render(): TemplateResult {
        const result = this.result;
        return html`
            <rs-toolbar
                .seed=${this.seed}
                .weights=${this.weights}
                .busy=${this.busy}
                .canExport=${!!result}
                @clock-change=${this.onClockChange}
                @generate=${this.onGenerate}
                @export=${this.onExport}
            ></rs-toolbar>
            <rs-now-playing
                .nowPlaying=${this.nowPlaying}
                .now=${this.now}
                @jump-now=${this.onJumpNow}
            ></rs-now-playing>
            ${this.error ? html`<p class="error">${this.error}</p>` : ''}
            ${result
                ? html`
                    <rs-day-filter
                        .days=${this.days}
                        .selected=${this.day}
                        @day-change=${this.onDayChange}
                    ></rs-day-filter>
                    <rs-week-list
                        .items=${this.listItems}
                        .currentIdx=${this.currentIdx}
                        .jumpToken=${this.jumpToken}
                    ></rs-week-list>
                `
                : html`<div class="empty">
                    <p class="empty-title">Generate a week of Pulse 101</p>
                    <p class="empty-copy">Seven days of Top 40, no commercials. Tweak the gravity knobs, then export a log.</p>
                </div>`}
        `;
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'rs-app-shell': AppShell;
    }
}
