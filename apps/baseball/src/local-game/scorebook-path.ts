import type { Advancement } from './notation';

// The scorebook cell diamond is drawn in a 52x52 viewBox with home at the
// bottom, first base on the right, second on top, and third on the left.
// These coordinates MUST stay in sync with the SVG arc rendering in the
// baseball-scorebook-grid web component (basePointX / basePointY).
export const SCOREBOOK_BASE_POINTS: Record<number, { x: number; y: number }> = {
  1: { x: 46, y: 26 },
  2: { x: 26, y: 6 },
  3: { x: 6, y: 26 },
  4: { x: 26, y: 46 },
};

export type DiamondEdge = 'top' | 'right' | 'bottom' | 'left';

// Which diamond edges the batter covers on the way to the base he reached.
// A rotated-square diamond's edges map to borders as follows (verified against
// the .diamond.bX::before rules in baseball-scorebook-grid.css):
//   border-right  = home -> first base
//   border-top    = first -> second base
//   border-left   = second -> third base
//   border-bottom = third -> home
export function basePathEdges(base: number): DiamondEdge[] {
  switch (base) {
    case 1:
      return ['right'];
    case 2:
      return ['right', 'top'];
    case 3:
      return ['right', 'top', 'left'];
    case 4:
      return ['right', 'top', 'left', 'bottom'];
    default:
      return [];
  }
}

export interface AdvancementArcPoints {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

// Resolve a runner advancement to the actual SVG endpoints on the diamond.
export function advancementArcPoints(advancement: Advancement): AdvancementArcPoints {
  const from = SCOREBOOK_BASE_POINTS[advancement.from] ?? SCOREBOOK_BASE_POINTS[4];
  const to = SCOREBOOK_BASE_POINTS[advancement.to] ?? SCOREBOOK_BASE_POINTS[4];
  return { x1: from.x, y1: from.y, x2: to.x, y2: to.y };
}
