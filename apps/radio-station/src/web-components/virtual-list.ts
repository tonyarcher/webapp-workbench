import {
    elementScroll,
    observeElementOffset,
    observeElementRect,
    Virtualizer,
} from '@tanstack/virtual-core';
import type {VirtualItem, VirtualizerOptions} from '@tanstack/virtual-core';
import type {ReactiveController, ReactiveControllerHost} from 'lit';

export class VirtualizerController<T> implements ReactiveController {
    private virtualizer: Virtualizer<HTMLElement, HTMLElement> | null = null;
    private items: T[] = [];

    constructor(
        private readonly host: ReactiveControllerHost & Element,
        private readonly getScrollEl: () => HTMLElement | null,
        private readonly getItems: () => T[],
        private readonly estimateSize: (index: number) => number,
    ) {
        host.addController(this);
    }

    private buildOptions(count: number): VirtualizerOptions<HTMLElement, HTMLElement> {
        return {
            count,
            getScrollElement: () => this.getScrollEl(),
            estimateSize: this.estimateSize,
            overscan: 8,
            indexAttribute: 'data-index',
            getItemKey: (index) => index,
            scrollToFn: elementScroll,
            observeElementRect,
            observeElementOffset,
            onChange: () => this.host.requestUpdate(),
        };
    }

    private sync(): void {
        this.items = this.getItems();
        if (!this.virtualizer) {
            if (!this.getScrollEl()?.isConnected) return;
            this.virtualizer = new Virtualizer<HTMLElement, HTMLElement>(this.buildOptions(this.items.length));
            this.virtualizer.shouldAdjustScrollPositionOnItemSizeChange = () => false;
        }
        this.virtualizer.setOptions(this.buildOptions(this.items.length));
        this.virtualizer._willUpdate();
    }

    hostConnected(): void {
        this.sync();
    }

    hostUpdate(): void {
        this.sync();
    }

    hostUpdated(): void {
        this.sync();
    }

    hostDisconnected(): void {
        this.virtualizer = null;
    }

    get virtualItems(): VirtualItem[] {
        return this.virtualizer?.getVirtualItems() ?? [];
    }

    get totalSize(): number {
        return this.virtualizer?.getTotalSize() ?? 0;
    }

    measureElement(el: HTMLElement | null): void {
        this.virtualizer?.measureElement(el);
    }

    scrollToIndex(index: number): void {
        this.virtualizer?.scrollToIndex(index, {align: 'center'});
    }
}
