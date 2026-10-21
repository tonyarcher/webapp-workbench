import { LitElement, html, svg, unsafeCSS } from 'lit';
import type { SVGTemplateResult, TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { ArtKey } from '../../core/types';
import styles from './fish-art.css?inline';

export type FishMotion = 'still' | 'swim';
export type FishMouth = 'shut' | 'breathe' | 'chomp';
export type FishGulp = 'none' | 'small' | 'big';

interface FishStyle {
    readonly body: string;
    readonly belly: string;
    readonly fin: string;
    readonly eye: string;
    readonly stripe?: string;
    readonly spots?: string;
}

type FishArt = 'chub' | 'whitefish' | 'rainbow' | 'blueback' | 'dolly' | 'mackinaw' | 'walleye';

const FISH_STYLES: Readonly<Record<FishArt, FishStyle>> = {
    chub: { body: '#829b95', belly: '#d7e4dc', fin: '#637b75', eye: '#07151b' },
    whitefish: { body: '#b8c9ca', belly: '#eef5f3', fin: '#8fa5a7', eye: '#07151b' },
    rainbow: {
        body: '#5d8b86',
        belly: '#d9e8e1',
        fin: '#c98383',
        eye: '#07151b',
        stripe: '#e69a9a',
    },
    blueback: { body: '#527c9a', belly: '#d4e5ee', fin: '#3d647d', eye: '#07151b' },
    dolly: {
        body: '#68715a',
        belly: '#d8d2b8',
        fin: '#c47d58',
        eye: '#07151b',
        spots: '#e0a36d',
    },
    mackinaw: {
        body: '#3c4a4c',
        belly: '#aebcba',
        fin: '#2a3638',
        eye: '#d9e2de',
        spots: '#b9c6c0',
    },
    walleye: {
        body: '#7c6a47',
        belly: '#d9cda8',
        fin: '#5c4f37',
        eye: '#e9e3c8',
        spots: '#4a402b',
    },
};

const SPOT_POSITIONS: readonly (readonly [number, number])[] = [
    [62, 38],
    [78, 33],
    [92, 40],
    [70, 48],
    [86, 51],
    [56, 47],
];

const BODY_PATH = 'M34 45 C48 22 94 19 121 42 C126 46 126 50 121 54 C94 77 48 74 34 51 C31 49 31 47 34 45 Z';

function spotDots(style: FishStyle): SVGTemplateResult[] {
    if (!style.spots) return [];
    const fill = style.spots;
    return SPOT_POSITIONS.map(
        ([cx, cy]) => svg`<circle cx="${cx}" cy="${cy}" r="2.2" fill="${fill}" opacity="0.8"></circle>`,
    );
}

function fish(style: FishStyle): SVGTemplateResult {
    const spots = spotDots(style);
    return svg`
        <defs>
            <clipPath id="fish-body">
                <path d="${BODY_PATH}"></path>
            </clipPath>
            <radialGradient id="fish-gulp-fill" cx="50%" cy="50%" r="50%">
                <stop offset="0" stop-color="#ffffff" stop-opacity="0.6"></stop>
                <stop offset="1" stop-color="#ffffff" stop-opacity="0"></stop>
            </radialGradient>
        </defs>
        <path class="fish-tail" d="M34 45 L10 24 L15 46 L10 66 Z" fill="${style.fin}"></path>
        <path d="${BODY_PATH}" fill="${style.body}"></path>
        <path class="fish-dorsal" d="M70 26 L86 9 L94 30 Z" fill="${style.fin}"></path>
        <path d="M34 48 C53 39 91 37 120 47 C91 57 53 55 34 48 Z" fill="${style.belly}" opacity="0.72"></path>
        ${
            style.stripe
                ? svg`<path d="M40 43 C62 34 98 34 122 44" fill="none" stroke="${style.stripe}" stroke-width="4" stroke-linecap="round"></path>`
                : ''
        }
        ${spots}
        <g clip-path="url(#fish-body)">
            <ellipse class="fish-gulp" cx="78" cy="46" rx="20" ry="10" fill="url(#fish-gulp-fill)"></ellipse>
        </g>
        <circle cx="108" cy="40" r="3.4" fill="${style.eye}"></circle>
        <circle cx="109" cy="39" r="1" fill="#07151b"></circle>
        <g transform="translate(119 52.5) rotate(18)">
            <g class="fish-mouth">
                <ellipse class="mouth-opening" cx="0" cy="0" rx="3.2" ry="1.15"></ellipse>
                <path class="mouth-lip" d="M-4 -2.2 C-1.5 -3.6 1.5 -3.6 4 -2.2" stroke="${style.fin}"></path>
                <path class="mouth-lip" d="M-4 2.2 C-1.5 3.6 1.5 3.6 4 2.2" stroke="${style.fin}"></path>
            </g>
        </g>
        <g class="fish-puff">
            <circle cx="58" cy="16" r="5" fill="${style.belly}" opacity="0.7"></circle>
            <circle cx="72" cy="8" r="3.5" fill="${style.belly}" opacity="0.55"></circle>
            <circle cx="84" cy="14" r="4.5" fill="${style.belly}" opacity="0.6"></circle>
            <circle cx="66" cy="2" r="2.5" fill="${style.belly}" opacity="0.4"></circle>
        </g>
    `;
}

function otter(): SVGTemplateResult {
    return svg`
        <path d="M18 58 C31 36 71 31 107 38 C127 42 142 53 148 62 C132 70 96 74 62 70 C37 67 25 63 18 58 Z" fill="#6f4a34"></path>
        <path d="M111 52 C112 38 124 30 137 33 C150 36 154 48 148 58 C143 66 129 68 119 62 Z" fill="#8a6248"></path>
        <circle cx="138" cy="45" r="2.4" fill="#07151b"></circle>
        <circle cx="141" cy="44" r="0.8" fill="#f0e7dc"></circle>
        <path d="M149 52 L159 55 M149 55 L159 59 M149 58 L158 64" stroke="#d7c3ab" stroke-width="1.2" fill="none"></path>
        <path d="M18 58 C12 61 8 69 12 73 C18 78 26 73 27 66" fill="#543726"></path>
        <path d="M55 39 C63 35 77 34 88 37" fill="none" stroke="#a47a5a" stroke-width="1.2" opacity="0.6"></path>
    `;
}

function osprey(): SVGTemplateResult {
    return svg`
        <path d="M12 42 C31 25 52 28 73 44 C93 28 116 24 148 40 C124 46 104 56 80 60 C55 56 33 48 12 42 Z" fill="#3d4b52"></path>
        <path d="M52 43 C60 28 69 21 81 20 C93 21 102 29 108 44 C96 38 88 38 80 43 C72 38 62 37 52 43 Z" fill="#d9d4c8"></path>
        <circle cx="88" cy="35" r="2.1" fill="#07151b"></circle>
        <path d="M96 39 L106 42 L96 44 Z" fill="#e2b25e"></path>
        <path d="M82 60 C78 69 82 76 90 79 M92 60 C96 68 102 72 108 74" fill="none" stroke="#8a8d83" stroke-width="2"></path>
    `;
}

function bait(): SVGTemplateResult {
    return svg`
        <path d="M108 4 L108 42" stroke="#b9c8ca" stroke-width="1.4"></path>
        <ellipse cx="108" cy="49" rx="7" ry="9" fill="#e8ece7"></ellipse>
        <circle cx="108" cy="49" r="3" fill="#b94e45"></circle>
        <path d="M108 58 L108 67 C108 73 113 76 118 73 C122 70 120 64 115 64" fill="none" stroke="#c7d2cf" stroke-width="1.6"></path>
        <path d="M86 72 C92 64 103 62 111 66 C118 69 121 75 117 80 C111 85 97 83 90 79 Z" fill="#7f9b92"></path>
        <path d="M86 74 L74 66 L77 78 L74 86 Z" fill="#637b75"></path>
        <circle cx="109" cy="72" r="1.6" fill="#07151b"></circle>
    `;
}

function fly(): SVGTemplateResult {
    return svg`
        <path d="M20 18 C48 12 76 22 98 40" fill="none" stroke="#b9c8ca" stroke-width="1.3"></path>
        <path d="M96 38 C108 24 124 24 132 32 C124 37 120 44 122 52 C112 50 104 45 96 38 Z" fill="#d9a35e"></path>
        <path d="M122 52 L122 64 C122 72 128 75 134 71 C138 68 136 62 131 62" fill="none" stroke="#d9e2de" stroke-width="1.5"></path>
        <circle cx="116" cy="35" r="1.8" fill="#07151b"></circle>
    `;
}

function algae(): SVGTemplateResult {
    return svg`
        <path d="M20 78 C26 58 22 40 34 20 M42 78 C48 58 42 38 52 16 M64 78 C62 62 70 48 76 30 M88 78 C86 62 94 44 102 24 M112 78 C110 62 118 46 126 28 M136 78 C134 62 140 48 146 36" stroke="#4f8b5e" stroke-width="5" fill="none" stroke-linecap="round"></path>
        <path d="M20 78 C26 58 22 40 34 20 M42 78 C48 58 42 38 52 16 M64 78 C62 62 70 48 76 30 M88 78 C86 62 94 44 102 24 M112 78 C110 62 118 46 126 28 M136 78 C134 62 140 48 146 36" stroke="#86c08b" stroke-width="2" fill="none" stroke-linecap="round" opacity="0.8"></path>
    `;
}

function plankton(): SVGTemplateResult {
    return svg`
        ${[
            [18, 26],
            [38, 18],
            [58, 32],
            [80, 20],
            [102, 30],
            [124, 18],
            [142, 34],
            [28, 52],
            [52, 60],
            [76, 48],
            [98, 64],
            [120, 52],
            [140, 66],
            [18, 72],
            [66, 76],
            [110, 76],
        ].map(([cx, cy]) => svg`<circle cx="${cx}" cy="${cy}" r="2.4" fill="#c8ded6" opacity="0.85"></circle>`)}
        <circle cx="50" cy="40" r="1.4" fill="#86c08b"></circle>
        <circle cx="130" cy="40" r="1.4" fill="#86c08b"></circle>
    `;
}

function insects(): SVGTemplateResult {
    return svg`
        <ellipse cx="34" cy="48" rx="12" ry="5" fill="#9b7d58" transform="rotate(-18 34 48)"></ellipse>
        <ellipse cx="70" cy="58" rx="14" ry="5" fill="#b08a5e" transform="rotate(12 70 58)"></ellipse>
        <ellipse cx="108" cy="42" rx="11" ry="4" fill="#8b6d4b" transform="rotate(-8 108 42)"></ellipse>
        <ellipse cx="138" cy="62" rx="9" ry="4" fill="#a17f56" transform="rotate(20 138 62)"></ellipse>
        <path d="M24 45 L18 38 M30 43 L26 35 M42 42 L46 34 M60 55 L54 48 M66 52 L62 44 M80 55 L86 47 M100 39 L96 32 M112 38 L116 31 M128 59 L134 52 M142 58 L148 52" stroke="#6b5338" stroke-width="1.1"></path>
    `;
}

function bottomLife(): SVGTemplateResult {
    return svg`
        <ellipse cx="44" cy="58" rx="22" ry="9" fill="#8d6f52"></ellipse>
        <path d="M22 58 C14 50 10 58 16 66 C24 74 38 72 46 66" fill="#765a41"></path>
        <path d="M42 50 C36 40 44 32 52 40 M52 50 C48 42 56 36 62 44" fill="none" stroke="#a38360" stroke-width="2"></path>
        <path d="M66 58 L82 52 L78 60 L82 68 Z" fill="#765a41"></path>
        <circle cx="50" cy="55" r="1.8" fill="#0a1114"></circle>
        <circle cx="112" cy="56" r="18" fill="#b9a98c"></circle>
        <path d="M112 38 C120 48 124 60 116 72 C108 66 104 50 112 38 Z" fill="#9b876d"></path>
        <path d="M104 74 C118 80 134 76 142 68" fill="none" stroke="#8d7a61" stroke-width="2"></path>
    `;
}

const OTHER_ART: Readonly<Record<Exclude<ArtKey, FishArt>, () => SVGTemplateResult>> = {
    otter,
    osprey,
    bait,
    fly,
    algae,
    plankton,
    insects,
    'bottom-life': bottomLife,
};

function isFishArt(art: ArtKey): art is FishArt {
    return art in FISH_STYLES;
}

function artwork(art: ArtKey): SVGTemplateResult {
    if (isFishArt(art)) return fish(FISH_STYLES[art]);
    return OTHER_ART[art]();
}

@customElement('cw-fish-art')
export class CwFishArt extends LitElement {
    static override styles = unsafeCSS(styles);

    @property({ type: String }) art: ArtKey = 'chub';

    @property({ type: String, reflect: true }) motion: FishMotion = 'still';

    @property({ type: String, reflect: true }) mouth: FishMouth = 'shut';

    @property({ type: String, reflect: true }) gulp: FishGulp = 'none';

    override render(): TemplateResult {
        return html`<svg viewBox="0 0 160 90" aria-hidden="true" focusable="false">${artwork(this.art)}</svg>`;
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'cw-fish-art': CwFishArt;
    }
}
