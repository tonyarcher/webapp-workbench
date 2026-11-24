import { svgIcon } from './source-list-dom';

export type IconKind = 'rss' | 'folder' | 'all' | 'refresh' | 'trash';

type Shape = [string, Record<string, string>];

const ROUNDED_STROKE: Record<string, string> = {
    fill: 'none',
    stroke: 'currentColor',
    'stroke-linecap': 'round',
};

const ICON_SHAPES: Record<IconKind, Shape[]> = {
    rss: [
        ['circle', { cx: '6', cy: '18', r: '2', fill: 'currentColor' }],
        ['path', { d: 'M4 4a16 16 0 0 1 16 16', ...ROUNDED_STROKE, 'stroke-width': '2' }],
        ['path', { d: 'M4 11a9 9 0 0 1 9 9', ...ROUNDED_STROKE, 'stroke-width': '2' }],
    ],
    folder: [
        [
            'path',
            {
                d: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
                fill: 'none',
                stroke: 'currentColor',
                'stroke-width': '1.6',
            },
        ],
    ],
    all: [
        ['circle', { cx: '12', cy: '12', r: '9', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.6' }],
        ['circle', { cx: '12', cy: '12', r: '3', fill: 'currentColor' }],
    ],
    refresh: [
        [
            'path',
            {
                d: 'M20 11a8 8 0 1 0-2.3 5.7',
                fill: 'none',
                stroke: 'currentColor',
                'stroke-width': '1.8',
                'stroke-linecap': 'round',
            },
        ],
        [
            'path',
            {
                d: 'M20 4v7h-7',
                fill: 'none',
                stroke: 'currentColor',
                'stroke-width': '1.8',
                'stroke-linecap': 'round',
                'stroke-linejoin': 'round',
            },
        ],
    ],
    trash: [
        [
            'path',
            {
                d: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
                fill: 'none',
                stroke: 'currentColor',
                'stroke-width': '1.6',
                'stroke-linecap': 'round',
            },
        ],
    ],
};

/** The small line icon that sits beside a row label. */
export function icon(kind: IconKind): SVGElement {
    return svgIcon({ class: 'icon', viewBox: '0 0 24 24', 'aria-hidden': 'true' }, ICON_SHAPES[kind]);
}

const PIN_SHAPES: Shape[] = [
    ['line', { x1: '12', x2: '12', y1: '17', y2: '22' }],
    [
        'path',
        {
            d: 'M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z',
        },
    ],
];

const PIN_OFF: Shape = ['line', { x1: '2', x2: '22', y1: '2', y2: '22' }];

/** Pin glyph; the slash marks the auto-hide state. */
export function pinIcon(autoHide: boolean): SVGElement {
    return svgIcon(
        {
            viewBox: '0 0 24 24',
            fill: 'none',
            stroke: 'currentColor',
            'stroke-width': '2',
            'stroke-linecap': 'round',
            'stroke-linejoin': 'round',
            'aria-hidden': 'true',
        },
        autoHide ? [...PIN_SHAPES, PIN_OFF] : PIN_SHAPES,
    );
}

export function filterIcon(): SVGElement {
    return svgIcon(
        {
            viewBox: '0 0 24 24',
            fill: 'none',
            stroke: 'currentColor',
            'stroke-width': '2',
            'stroke-linecap': 'round',
            'stroke-linejoin': 'round',
            'aria-hidden': 'true',
        },
        [['path', { d: 'M3 4h18l-7 8v5l-4 2v-7L3 4z' }]],
    );
}

const MENU_SHAPES: Shape[] = [
    [
        'rect',
        {
            x: '3',
            y: '3',
            width: '18',
            height: '18',
            rx: '4',
            fill: 'none',
            stroke: 'currentColor',
            'stroke-width': '1.6',
        },
    ],
    [
        'path',
        {
            d: 'M9 10.2l3 3 3-3',
            fill: 'none',
            stroke: 'currentColor',
            'stroke-width': '1.6',
            'stroke-linecap': 'round',
            'stroke-linejoin': 'round',
        },
    ],
];

export function menuIcon(): SVGElement {
    return svgIcon({ viewBox: '0 0 24 24', 'aria-hidden': 'true' }, MENU_SHAPES);
}
