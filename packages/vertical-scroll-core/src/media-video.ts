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
    @state() private embedTime = 0
    @state() private embedDuration = 0

    private video: HTMLVideoElement | null = null
    private iframe: HTMLIFrameElement | null = null
    private stage: HTMLElement | null = null
    private embedReady = false
    private unsubscribeSound: (() => void) | null = null
    private resolveToken = 0

    private setPlaying(next: boolean): void {
        if (this.playing === next) return
        this.playing = next
        this.dispatchEvent(new CustomEvent('playback-change', {
            detail: {playing: next},
            bubbles: true,
            composed: true,
        }))
    }

    togglePlay(): void {
        if (!this.active) return
        if (embedUrlFor(this.embedSource())) {
            const win = this.iframe?.contentWindow
            const provider = embedProviderForUrl(this.embedSource())
            if (!win || !provider?.commandPlayer) return
            if (this.playing) {
                provider.commandPlayer(win, 'pause')
                this.setPlaying(false)
            } else {
                provider.commandPlayer(win, 'play')
                this.setPlaying(true)
            }
        } else if (this.video) {
            if (this.video.paused) void this.video.play().catch(() => {})
            else this.video.pause()
        }
    }

    override connectedCallback(): void {
        super.connectedCallback()
        this.unsubscribeSound = subscribeSound((sound) => {
            this.soundOn = sound
            if (this.video) this.video.muted = !sound
            this.syncEmbedPlayback()
        })
        window.addEventListener('message', this.onEmbedMessage)
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback()
        this.unsubscribeSound?.()
        this.unsubscribeSound = null
        window.removeEventListener('message', this.onEmbedMessage)
        this.iframe = null
        this.embedReady = false
        this.resolveToken++
    }

    /**
     * Embeds are classified from either field (`classifyScrollItem` checks
     * `url` so a Link post whose page is an embed site still becomes a
     * video slide). The player must read the same pair or those slides
     * render as "Video unavailable".
     */
    private embedSource(): string | null {
        return this.item?.videoUrl ?? this.item?.url ?? null
    }

    override willUpdate(changed: Map<string, unknown>): void {
        if (changed.has('item')) {
            const prev = changed.get('item') as ScrollItem | undefined
            const prevEmbed = embedUrlFor(prev?.videoUrl ?? prev?.url ?? null)
            const nextEmbed = embedUrlFor(this.embedSource())
            // oEmbed enrichment rewrites pageUrl/author but keeps the same
            // player id — remounting would drop embedReady and desync chrome.
            if (prevEmbed && prevEmbed === nextEmbed) return
            this.src = null
            this.poster = null
            this.candidates = []
            this.resolveFailed = false
            this.embedReady = false
            this.playing = false
            this.embedTime = 0
            this.embedDuration = 0
            if (nextEmbed) return
            const token = ++this.resolveToken
            const resolved = resolveVideoUrl(this.item?.videoUrl ?? this.item?.url ?? null)
            if (token !== this.resolveToken) return
            this.src = resolved.src
            this.poster = resolved.poster
            this.candidates = resolved.candidates
            this.resolveFailed = resolved.src === null
        }
    }

    override updated(changed: Map<string, unknown>): void {
        if (changed.has('active') || changed.has('src') || changed.has('soundOn')) {
            if (this.active) {
                void this.video?.play().catch(() => {})
            } else {
                this.video?.pause()
            }
            this.syncEmbedPlayback()
        }
        if (changed.has('active')) this.applyEmbedScale()
    }

    /** Stable identity so the ref directive only fires on attach/detach. */
    private readonly onIframeRef = (el: Element | undefined): void => {
        const iframe = (el as HTMLIFrameElement | undefined) ?? null
        if (iframe === this.iframe) return
        this.iframe = iframe
        this.embedReady = false
        if (iframe) {
            this.applyEmbedScale()
            this.syncEmbedPlayback()
        }
    }

    /** Stable identity so the ref directive only fires on attach/detach. */
    private readonly onStageRef = (el: Element | undefined): void => {
        const stage = (el as HTMLElement | undefined) ?? null
        if (stage === this.stage) return
        this.stage = stage
        this.applyEmbedScale()
    }

    /**
     * TikTok's embed card is a fixed 325px-wide white card. Scale it so the
     * 9:16 video fills the slide height; the white card-info below the video
     * overflows the iframe viewport and is cropped. The center tap overlay
     * keeps the wheel from scrolling the iframe internally (which would
     * fight the viewport paging); left/right edges stay clickable so
     * photo-carousel chevrons work.
     */
    private applyEmbedScale(): void {
        const iframe = this.iframe
        const stage = this.stage
        const aspect = embedProviderForUrl(this.embedSource())?.iframeAspect
        if (!iframe || !stage || !aspect || stage.clientHeight === 0) return
        const CARD_WIDTH = 325
        const videoHeight = CARD_WIDTH / aspect
        // iframe is taller than the video so the white card-info sits below
        // the viewport (no internal scrollbar); the parent clips it.
        const iframeHeight = videoHeight + 280
        const scale = Math.min(stage.clientHeight / videoHeight, stage.clientWidth / CARD_WIDTH)
        iframe.style.width = `${CARD_WIDTH}px`
        iframe.style.height = `${iframeHeight}px`
        iframe.style.transform = `translateX(-50%) scale(${scale})`
    }

    private readonly onEmbedMessage = (event: MessageEvent): void => {
        if (!this.iframe || event.source !== this.iframe.contentWindow) return
        const provider = embedProviderForUrl(this.embedSource())
        const parsed = provider?.parsePlayerMessage?.(event.data)
        if (parsed) {
            if (parsed.type === 'ready') {
                this.embedReady = true
                this.syncEmbedPlayback()
                return
            }
            if (parsed.type === 'playing') this.setPlaying(true)
            if (parsed.type === 'paused' || parsed.type === 'ended') this.setPlaying(false)
            if (parsed.type === 'time' && !this.seeking) {
                this.embedTime = parsed.currentTime
                this.embedDuration = parsed.duration
            }
            return
        }
        if (!provider?.isPlayerReadyMessage?.(event.data)) return
        this.embedReady = true
        this.syncEmbedPlayback()
    }

    private onIframeLoad(): void {
        // player/v1 sometimes plays from autoplay=1 before posting ready;
        // treat load as ready enough to send mute/play.
        this.embedReady = true
        this.syncEmbedPlayback()
    }

    /**
     * Drive a scriptable embed (TikTok player/v1) via postMessage. Mute
     * before play only while the session is silent so autoplay is allowed.
     * Once the user has turned sound on, skip mute — mute+unMute in the
     * same turn can leave the embed at a ducked volume.
     */
    private syncEmbedPlayback(): void {
        const win = this.iframe?.contentWindow
        const provider = embedProviderForUrl(this.embedSource())
        if (!win || !provider?.commandPlayer || !this.embedReady) return
        if (this.active) {
            if (!this.soundOn) provider.commandPlayer(win, 'mute')
            provider.commandPlayer(win, 'play')
            if (this.soundOn) provider.commandPlayer(win, 'unmute')
            this.setPlaying(true)
        } else {
            provider.commandPlayer(win, 'pause')
            this.setPlaying(false)
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
                this.setPlaying(!video.paused)
            }
            video.addEventListener('play', sync)
            video.addEventListener('pause', sync)
            sync()
            if (this.active) void video.play().catch(() => {})
        }
    }

    private seeking = false

    private onEmbedTap(event: Event): void {
        event.preventDefault()
        event.stopPropagation()
        this.togglePlay()
    }

    private onSeekInput(event: Event): void {
        event.stopPropagation()
        this.seeking = true
        this.embedTime = Number((event.target as HTMLInputElement).value)
    }

    private onSeekCommit(event: Event): void {
        event.stopPropagation()
        const win = this.iframe?.contentWindow
        const provider = embedProviderForUrl(this.embedSource())
        const seconds = Number((event.target as HTMLInputElement).value)
        this.embedTime = seconds
        this.seeking = false
        if (win && provider?.seekPlayer) provider.seekPlayer(win, seconds)
    }

    private formatTime(seconds: number): string {
        if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
        const whole = Math.floor(seconds)
        const mins = Math.floor(whole / 60)
        const secs = whole % 60
        return `${mins}:${secs.toString().padStart(2, '0')}`
    }

    private onToggleSound(event: Event): void {
        event.preventDefault()
        event.stopPropagation()
        const next = !this.soundOn
        setSoundOn(next)
        const video = this.video
        if (video) {
            video.muted = !next
            if (next && this.active) void video.play().catch(() => {})
        }
        const win = this.iframe?.contentWindow
        const provider = embedProviderForUrl(this.embedSource())
        if (win && provider?.commandPlayer) {
            provider.commandPlayer(win, next ? 'unmute' : 'mute')
        }
    }

    private renderEmbed(): TemplateResult {
        const videoUrl = this.embedSource()
        const provider = embedProviderForUrl(videoUrl)
        const embedUrl = embedUrlFor(videoUrl)
        const poster = this.item?.thumbnailUrl ?? embedPosterFor(videoUrl)
        if (!embedUrl) return html``
        // Unload on scroll: the iframe mounts only while the slide is
        // active, so the previous clip's sound stops and memory is freed.
        const mount = this.active
        const framed = provider?.iframeAspect ? ' framed' : ''
        // player/v1 paints a blurred clone in extra iframe width; 9:16
        // leaves it no canvas for that fill (and no second decoder).
        const portrait = provider?.name === 'tiktok' || provider?.name === 'instagram' ? ' portrait' : ''
        const scriptable = !!provider?.commandPlayer
        return html`
            <div class="media-stage embed" ${ref(this.onStageRef)}>
                ${mount
                    ? html`<div class="embed-frame${framed}${portrait}">
                        <iframe
                            class="media-iframe"
                            src=${embedUrl}
                            title="${provider?.name ?? 'embedded'} video"
                            allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
                            scrolling="no"
                            referrerpolicy=${provider?.iframeReferrerPolicy ?? 'no-referrer'}
                            @load=${this.onIframeLoad}
                            ${ref(this.onIframeRef)}
                        ></iframe>
                    </div>
                    ${scriptable
                        ? html`<button class="embed-tap" aria-label=${this.playing ? 'Pause video' : 'Play video'} @click=${this.onEmbedTap}></button>
                        <button
                            class="sound-button${this.soundOn ? ' on' : ''}"
                            aria-label=${this.soundOn ? 'Mute video' : 'Unmute video'}
                            @click=${this.onToggleSound}
                        >${this.soundOn ? SOUND_ON_ICON : SOUND_OFF_ICON}</button>
                        ${this.embedDuration > 0
                            ? html`<div class="seek-bar">
                                <span class="seek-time">${this.formatTime(this.embedTime)}</span>
                                <input
                                    class="seek-input"
                                    type="range"
                                    min="0"
                                    max=${this.embedDuration}
                                    step="0.1"
                                    .value=${String(this.embedTime)}
                                    aria-label="Seek"
                                    @pointerdown=${(event: Event) => event.stopPropagation()}
                                    @input=${this.onSeekInput}
                                    @change=${this.onSeekCommit}
                                >
                                <span class="seek-time">${this.formatTime(this.embedDuration)}</span>
                            </div>`
                            : html``}`
                        : html``}`
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
                        class="sound-button${this.soundOn ? ' on' : ''}"
                        aria-label=${this.soundOn ? 'Mute video' : 'Unmute video'}
                        @click=${this.onToggleSound}
                    >${this.soundOn ? SOUND_ON_ICON : SOUND_OFF_ICON}</button>`
                    : html``}
            </div>
        `
    }

    override render(): TemplateResult {
        return embedUrlFor(this.embedSource()) ? this.renderEmbed() : this.renderNative()
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'vsc-media-video': ScrollMediaVideo
    }
}
