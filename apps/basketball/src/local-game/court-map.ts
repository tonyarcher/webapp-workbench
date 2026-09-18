import {inBounds} from 'basketball-core';
import type {CourtSpec, Point} from 'basketball-core';

export const SCALE = 10;
export const PAD_X = 48;
export const PAD_Y = 36;

export function courtToSvg(xFeet: number, yFeet: number): Point {
    return {x: PAD_X + xFeet * SCALE, y: PAD_Y + yFeet * SCALE};
}

export function svgToCourt(svgX: number, svgY: number, spec: CourtSpec): Point | null {
    const x = (svgX - PAD_X) / SCALE;
    const y = (svgY - PAD_Y) / SCALE;
    if (!inBounds(x, y, spec)) return null;
    return {x, y};
}

export function viewSize(spec: CourtSpec): {width: number; height: number} {
    return {
        width: spec.length * SCALE + PAD_X * 2,
        height: spec.width * SCALE + PAD_Y * 2,
    };
}

export function clientToCourt(
    clientX: number,
    clientY: number,
    svg: {left: number; top: number; width: number; height: number},
    spec: CourtSpec,
): Point | null {
    if (svg.width <= 0 || svg.height <= 0) return null;
    const size = viewSize(spec);
    const x = ((clientX - svg.left) / svg.width) * size.width;
    const y = ((clientY - svg.top) / svg.height) * size.height;
    return svgToCourt(x, y, spec);
}
