import {
    elementScroll,
    observeElementOffset,
    observeElementRect,
    Virtualizer,
} from '@tanstack/virtual-core'
import type {VirtualItem, VirtualizerOptions} from '@tanstack/virtual-core'
import type {ReactiveController, ReactiveControllerHost} from 'lit'

const NEAR_END_THRESHOLD = 400

/**
 * Lit adapter over @tanstack/virtual-core for vertical lists inside a
 * component-owned scroll element. Re-syncs count/keys on every host update,
 * auto-fetches via onNearEnd when the viewport approaches the bottom.
 */
export class VirtualizerController<TItem extends {id: number}> implements ReactiveController {
    private virtualizer: Virtualizer<HTMLElement, HTMLElement> | null = null
    private items: TItem[] = []

    constructor(
        private readonly host: ReactiveControllerHost & Element,
        private readonly getScrollEl: () => HTMLElement | null,
        private readonly getItems: () => TItem[],
        private readonly onNearEnd: () => void,
    ) {
        host.addController(this)
    }

    private buildOptions(count: number): VirtualizerOptions<HTMLElement, HTMLElement> {
        return {
            count,
            getScrollElement: () => this.getScrollEl(),
            estimateSize: () => 120,
            overscan: 6,
            indexAttribute: 'data-index',
            getItemKey: (index) => this.items[index]?.id ?? index,
            scrollEndThreshold: NEAR_END_THRESHOLD,
            scrollToFn: elementScroll,
            observeElementRect,
            observeElementOffset,
            onChange: (instance) => {
                this.host.requestUpdate()
                if (instance.getDistanceFromEnd() < NEAR_END_THRESHOLD) this.onNearEnd()
            },
        }
    }

    hostConnected(): void {
        this.sync()
    }

    hostUpdate(): void {
        this.sync()
    }

    hostUpdated(): void {
        this.sync()
    }

    hostDisconnected(): void {
        this.virtualizer = null
    }

    /**
     * virtual-core only bootstraps its scroll observers inside `_willUpdate()`
     * (that is what the React adapter calls on every render), so it must be
     * invoked after every option change and once on creation.
     */
    private sync(): void {
        this.items = this.getItems()
        if (!this.virtualizer) {
            if (!this.getScrollEl()?.isConnected) return
            this.virtualizer = new Virtualizer<HTMLElement, HTMLElement>(this.buildOptions(this.items.length))
            // never let measurement reflows move the user's scroll position
            this.virtualizer.shouldAdjustScrollPositionOnItemSizeChange = () => false
        }
        this.virtualizer.setOptions(this.buildOptions(this.items.length))
        this.virtualizer._willUpdate()
    }

    get virtualItems(): VirtualItem[] {
        return this.virtualizer?.getVirtualItems() ?? []
    }

    get totalSize(): number {
        return this.virtualizer?.getTotalSize() ?? 0
    }

    measureElement(el: HTMLElement | null): void {
        this.virtualizer?.measureElement(el)
    }
}
