import {LitElement, html, nothing, unsafeCSS} from 'lit';
import type {TemplateResult} from 'lit';
import {customElement, property} from 'lit/decorators.js';
import {ref} from 'lit/directives/ref.js';
import type {ListItem, PlaylistEntry} from '../../types';
import {rowTime} from '../../services/format';
import {VirtualizerController} from '../virtual-list';
import styles from './week-list.css?inline';

const SIZE = {day: 40, hour: 28, track: 44} as const;

@customElement('rs-week-list')
export class WeekList extends LitElement {
    static override styles = unsafeCSS(styles);

    @property({attribute: false}) items: ListItem[] = [];
    @property({type: Number}) currentIdx = -1;
    @property({type: Number}) jumpToken = 0;

    private listEl: HTMLElement | null = null;
    private readonly virtualizer = new VirtualizerController<ListItem>(
        this,
        () => this.listEl,
        () => this.items,
        (index) => SIZE[this.items[index]?.kind ?? 'track'],
    );

    private readonly setListEl = (el: Element | undefined): void => {
        this.listEl = (el as HTMLElement | undefined) ?? null;
    };

    private readonly measureRow = (el: Element | undefined): void => {
        if (el) this.virtualizer.measureElement(el as HTMLElement);
    };

    override updated(changed: Map<string, unknown>): void {
        if (changed.has('jumpToken') && this.jumpToken > 0) this.scrollToCurrent();
    }

    private scrollToCurrent(): void {
        const index = this.items.findIndex(
            (item) => item.kind === 'track' && item.entry.idx === this.currentIdx,
        );
        if (index >= 0) this.virtualizer.scrollToIndex(index);
    }

    private renderDay(item: Extract<ListItem, {kind: 'day'}>): TemplateResult {
        return html`<div class="day">${item.label}</div>`;
    }

    private renderHour(item: Extract<ListItem, {kind: 'hour'}>): TemplateResult {
        return html`<div class="hour">${item.label}</div>`;
    }

    private renderTrack(entry: PlaylistEntry): TemplateResult {
        const on = entry.idx === this.currentIdx;
        return html`
            <div class="track ${on ? 'now' : ''}">
                <span class="when">${rowTime(entry.startsAt)}</span>
                <span class="who">${entry.artist}</span>
                <span class="song">${entry.title}</span>
            </div>
        `;
    }

    private renderItem(item: ListItem | undefined): TemplateResult | typeof nothing {
        if (!item) return nothing;
        if (item.kind === 'day') return this.renderDay(item);
        if (item.kind === 'hour') return this.renderHour(item);
        return this.renderTrack(item.entry);
    }

    override render(): TemplateResult {
        return html`
            <div class="scroller" ${ref(this.setListEl)}>
                <div class="spacer" style="height: ${this.virtualizer.totalSize}px">
                    ${this.virtualizer.virtualItems.map((row) => html`
                        <div
                            class="row"
                            data-index=${row.index}
                            style="transform: translateY(${row.start}px)"
                            ${ref(this.measureRow)}
                        >${this.renderItem(this.items[row.index])}</div>
                    `)}
                </div>
            </div>
        `;
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'rs-week-list': WeekList;
    }
}
