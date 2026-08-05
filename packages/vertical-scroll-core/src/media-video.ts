import {LitElement, html, svg, unsafeCSS} from 'lit'
import type {TemplateResult} from 'lit'
import {customElement, property, state} from 'lit/decorators.js'
import {ref} from 'lit/directives/ref.js'
import {resolveVideoUrl} from './media'
import {embedPosterFor, embedProviderForUrl, embedUrlFor} from './embeds'
import {safeUrl} from './url'
import {getSoundOn, setSoundOn, subscribeSound} from './sound'
import type {ScrollItem} from './types'
import styles from './media-video.css?inline'

const SOUND_ON_ICON = svg`<svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true"><path d="M3 8v4h3l4 3.5v-11L6 8H3Zm10.5 2a3 3 0 0 0-1.5-2.6v5.2a3 3 0 0 0 1.5-2.6Zm-1.5-5.8v1.7a4.8 4.8 0 0 1 0 8.2v1.7a6.5 6.5 0 0 0 0-11.6Z" fill="currentColor"/></svg>`
const SOUND_OFF_ICON = svg`<svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true"><path d="M3 8v4h3l4 3.5v-11L6 8H3Zm13.3-.3L15 9l-1.3-1.3-.9.9L14.1 10l-1.3 1.3.9.9L15 10.9l1.3 1.3.9-.9L15.9 10l1.3-1.3-.9-.9Z" fill="currentColor"/></svg>`
const PLAY_ICON = svg`<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path d="M8 5.5v13l11-6.5Z" fill="currentColor"/></svg>`
const PAUSE_ICON = svg`<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path d="M7 5h3.5v14H7ZM13.5 5H17v14h-3.5Z" fill="currentColor"/></svg>`

@customElement('vsc-media-video')
export class ScrollMediaVideo extends LitElement {
    static override styles = unsafeCSS(styles)

    @property({attribute: false}) item!: ScrollItem
    @property({attribute: false}) active = false

    @state() private soundOn = getSoundOn()
    @state() private src: string | null = null
    @state() private poster: string | null = null
    @state() private candidates: string[] = []
    @state() private resolveFailed = false
    @state() private playing = false

    private video: HTMLVideoElement | null = null
    private unsubscribeSound: (() => void) | null = null
    private resolveToken = 0

    override connectedCallback(): void {
        super.connectedCallback()
        this.unsubscribeSound = subscribeSound((sound) => {
            this.soundOn = sound
            if (this.video) this.video.muted = !sound
        })
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback()
        this.unsubscribeSound?.()
        this.unsubscribeSound = null
        this.resolveToken++
    }

    override willUpdate(changed: Map<string, unknown>): void {
        if (changed.has('item')) {
            this.src = null
            this.poster = null
            this.candidates = []
            this.resolveFailed = false
            if (embedUrlFor(this.item?.videoUrl ?? null)) return
            const token = ++this.resolveToken
            const resolved = resolveVideoUrl(this.item?.videoUrl ?? null)
            if (token !== this.resolveToken) return
            this.src = resolved.src
            this.poster = resolved.poster
            this.candidates = resolved.candidates
            this.resolveFailed = resolved.src === null
        }
    }

    override updated(changed: Map<string, unknown>): void {
        if (changed.has('active') || changed.has('src')) {
            if (this.active) {
                void this.video?.play().catch(() => {})
            } else {
                this.video?.pause()
            }
        }
    }

    /** Advance to the next candidate when a source fails to load. */
    private onVideoError(): void {
        if (this.candidates.length > 1) {
            const next = this.candidates.slice(1)
            this.candidates = next
            this.src = next[0]
            return
        }
        this.resolveFailed = true
    }

    private onRetry(): void {
        this.resolveFailed = false
        this.src = null
        this.candidates = []
        const token = ++this.resolveToken
        const resolved = resolveVideoUrl(this.item?.videoUrl ?? null)
        if (token !== this.resolveToken) return
        this.src = resolved.src
        this.poster = resolved.poster
        this.candidates = resolved.candidates
        this.resolveFailed = resolved.src === null
    }

    /** Stable identity so the ref directive only fires on attach/detach. */
    private readonly onVideoRef = (el: Element | undefined): void => {
        const video = el as HTMLVideoElement | null
        this.video = video
        if (video) {
            video.muted = !this.soundOn
            const sync = (): void => {
                this.playing = !video.paused
            }
            video.addEventListener('play', sync)
            video.addEventListener('pause', sync)
            sync()
            if (this.active) void video.play().catch(() => {})
        }
    }

    private onTogglePlay(event: Event): void {
        event.preventDefault()
        event.stopPropagation()
        const video = this.video
        if (!video) return
        if (video.paused) void video.play().catch(() => {})
        else video.pause()
    }

    private onToggleSound(event: Event): void {
        event.preventDefault()
        event.stopPropagation()
        setSoundOn(!this.soundOn)
        const video = this.video
        if (video) {
            video.muted = !this.soundOn
            if (this.soundOn && this.active) void video.play().catch(() => {})
        }
    }

    private renderEmbed(): TemplateResult {
        const videoUrl = this.item?.videoUrl ?? null
        const provider = embedProviderForUrl(videoUrl)
        const embedUrl = embedUrlFor(videoUrl)
        const poster = embedPosterFor(videoUrl)
        // the embed player is only mounted while the slide is active, so
        // off-screen gifs/videos never play or load
        if (!embedUrl) return html``
        return html`
            <div class="media-stage embed">
                ${this.active
                    ? html`<iframe
                        class="media-iframe"
                        src=${embedUrl}
                        title="${provider?.name ?? 'embedded'} video"
                        allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
                        allowfullscreen
                        referrerpolicy=${provider?.iframeReferrerPolicy ?? 'no-referrer'}
                    ></iframe>`
                    : html`<div class="embed-placeholder">
                        ${poster
                            ? html`<img class="embed-poster" src=${poster} alt="" loading="lazy">`
                            : html``}
                    </div>`}
            </div>
        `
    }

    private renderNative(): TemplateResult {
        const {item} = this
        const original = safeUrl(item.originalUrl ?? null)
        const media = this.resolveFailed
            ? html`<div class="video-fallback">
                <p class="fallback-text">Video unavailable</p>
                <div class="fallback-actions">
                    <button class="fallback-button" @click=${this.onRetry}>Retry</button>
                    ${original
                        ? html`<a class="fallback-link" href=${original} target="_blank" rel="noopener noreferrer">Open original ↗</a>`
                        : html``}
                </div>
            </div>`
            : this.src
              ? html`<video
                    class="media-video"
                    src=${this.src}
                    poster=${this.poster ?? ''}
                    playsinline
                    loop
                    preload="metadata"
                    controls
                    @error=${this.onVideoError}
                    ${ref(this.onVideoRef)}
                ></video>`
              : html`<span class="video-spinner" aria-label="Loading video"></span>`
        return html`
            <div class="media-stage">
                ${media}
                ${this.src && !this.resolveFailed
                    ? html`<button
                        class="center-play${this.playing ? ' playing' : ''}"
                        aria-label=${this.playing ? 'Pause video' : 'Play video'}
                        @click=${this.onTogglePlay}
                    >${this.playing ? PAUSE_ICON : PLAY_ICON}</button>`
                    : html``}
                ${this.src && !this.resolveFailed
                    ? html`<button
                        class="sound-button${this.soundOn ? ' on' : ''}"
                        aria-label=${this.soundOn ? 'Mute video' : 'Unmute video'}
                        @click=${this.onToggleSound}
                    >${this.soundOn ? SOUND_ON_ICON : SOUND_OFF_ICON}</button>`
                    : html``}
            </div>
        `
    }

    override render(): TemplateResult {
        return embedUrlFor(this.item?.videoUrl ?? null) ? this.renderEmbed() : this.renderNative()
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'vsc-media-video': ScrollMediaVideo
    }
}
