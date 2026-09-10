import type {Situation} from 'football-core';
import {
    AWAY_GOAL_X,
    ENDZONE_YARDS,
    FIELD_HEIGHT,
    FIELD_SCALE,
    FIELD_WIDTH,
    HOME_GOAL_X,
    POST_HALF,
    ballX,
    firstDownX,
    hashY,
    unitX,
} from './field-geom';
import type {FieldAnimKind, PlayFlight} from './field-geom';

const LINE = '#f4f7f2';
const PAD_X = 90;
const PAD_Y = 24;
const EZ = ENDZONE_YARDS * FIELD_SCALE;
const H = round1(FIELD_HEIGHT);
const YARD_MAJOR = 4;
const YARD_MINOR = 2.5;
const HASH_STROKE = 2.5;
const HASH_HALF = 8;
const HASH_EDGE = 12;
const NUMBER_SIZE = 30;
const NUMBER_EDGE = 30;
const POST_STROKE = 5;
const POST_ARM = 50;
const UNIT_R = 16;
const UNIT_STROKE = 2.5;
const BALL_R = 7;
const BALL_STROKE = 2;
const TRAIL_STROKE = 6;
const PASS_BEND = 70;
const KICK_BEND = 50;

/** Trim float noise so markup coordinates stay readable. */
function round1(value: number): number {
    return Math.round(value * 10) / 10;
}

export interface FieldPaintInput {
    situation: Situation;
    homeName: string;
    awayName: string;
    trailPath: string;
    trailKind: FieldAnimKind | null;
    fgPath: string;
    fgKey: number;
    animateFg: boolean;
}

export function escapeXml(text: string): string {
    return text
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;');
}

export function playPath(flight: PlayFlight): string {
    const dir = flight.toX >= flight.fromX ? 1 : -1;
    if (flight.kind === 'run') {
        return `M ${flight.fromX} ${flight.fromY} L ${flight.toX} ${flight.toY}`;
    }
    if (flight.kind === 'pass') {
        const qbX = flight.fromX - dir * 7 * FIELD_SCALE;
        const midX = (qbX + flight.toX) / 2;
        return `M ${qbX} ${flight.fromY} Q ${midX} ${flight.fromY - PASS_BEND} ${flight.toX} ${flight.toY}`;
    }
    if (flight.kind === 'kick') {
        const midX = (flight.fromX + flight.toX) / 2;
        return `M ${flight.fromX} ${flight.fromY} Q ${midX} ${flight.fromY - KICK_BEND} ${flight.toX} ${flight.toY}`;
    }
    return `M ${flight.fromX} ${flight.fromY} L ${flight.toX} ${flight.toY}`;
}

export function paintFieldSvg(input: FieldPaintInput): string {
    const vb = `${-PAD_X} ${-PAD_Y} ${FIELD_WIDTH + PAD_X * 2} ${H + PAD_Y * 2}`;
    return [
        `<svg class="field" xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" role="img" aria-label="Football field">`,
        turfMarkup(),
        yardLineMarkup(),
        hashMarkup(),
        numberMarkup(),
        endzoneMarkup(input.homeName, input.awayName),
        postMarkup(0, -1),
        postMarkup(FIELD_WIDTH, 1),
        overlayMarkup(input),
        '</svg>',
    ].join('');
}

function turfMarkup(): string {
    const padW = FIELD_WIDTH + PAD_X * 2;
    const padH = H + PAD_Y * 2;
    const stripes = [10, 30, 50, 70, 90]
        .map((yard) => {
            const x = HOME_GOAL_X + yard * FIELD_SCALE;
            return `<rect x="${x}" y="0" width="${10 * FIELD_SCALE}" height="${H}" fill="#156f39"/>`;
        })
        .join('');
    return [
        `<rect x="${-PAD_X}" y="${-PAD_Y}" width="${padW}" height="${padH}" fill="#0a1c10"/>`,
        `<rect x="0" y="0" width="${FIELD_WIDTH}" height="${H}" fill="#178a44"/>`,
        `<rect x="0" y="0" width="${EZ}" height="${H}" fill="#0f5c2c"/>`,
        `<rect x="${AWAY_GOAL_X}" y="0" width="${EZ}" height="${H}" fill="#0f5c2c"/>`,
        stripes,
        `<rect x="2" y="2" width="${FIELD_WIDTH - 4}" height="${H - 4}" fill="none" stroke="${LINE}" stroke-width="4"/>`,
        `<line class="gl" x1="${HOME_GOAL_X}" y1="0" x2="${HOME_GOAL_X}" y2="${H}" stroke="${LINE}" stroke-width="${YARD_MAJOR}"/>`,
        `<line class="gl" x1="${AWAY_GOAL_X}" y1="0" x2="${AWAY_GOAL_X}" y2="${H}" stroke="${LINE}" stroke-width="${YARD_MAJOR}"/>`,
    ].join('');
}

function yardLineMarkup(): string {
    const lines: string[] = [];
    for (let yard = 5; yard < 100; yard += 5) {
        const x = HOME_GOAL_X + yard * FIELD_SCALE;
        const major = yard % 10 === 0;
        const width = major ? YARD_MAJOR : YARD_MINOR;
        const opacity = major ? 0.95 : 0.7;
        lines.push(
            `<line class="yl" x1="${x}" y1="0" x2="${x}" y2="${H}" stroke="${LINE}" stroke-width="${width}" opacity="${opacity}"/>`,
        );
    }
    return lines.join('');
}

function hashMarkup(): string {
    const ticks: string[] = [];
    const rows = [hashY('left'), hashY('right')];
    for (let yard = 1; yard < 100; yard += 1) {
        const x = HOME_GOAL_X + yard * FIELD_SCALE;
        for (const y of rows) {
            ticks.push(
                `<line class="hk" x1="${x - HASH_HALF}" y1="${y}" x2="${x + HASH_HALF}" y2="${y}" stroke="${LINE}" stroke-width="${HASH_STROKE}"/>`,
            );
        }
        ticks.push(`<line class="hk" x1="${x}" y1="0" x2="${x}" y2="${HASH_EDGE}" stroke="${LINE}" stroke-width="${HASH_STROKE}"/>`);
        ticks.push(
            `<line class="hk" x1="${x}" y1="${H - HASH_EDGE}" x2="${x}" y2="${H}" stroke="${LINE}" stroke-width="${HASH_STROKE}"/>`,
        );
    }
    return ticks.join('');
}

function numberMarkup(): string {
    const marks = [10, 20, 30, 40, 50, 40, 30, 20, 10];
    const yards = [10, 20, 30, 40, 50, 60, 70, 80, 90];
    const topY = NUMBER_EDGE;
    const bottomY = round1(H - NUMBER_EDGE);
    return yards
        .map((yard, i) => {
            const x = HOME_GOAL_X + yard * FIELD_SCALE;
            const label = String(marks[i]);
            return [
                numberText(x, topY, null, label),
                numberText(x, bottomY, `rotate(180 ${x} ${bottomY})`, label),
            ].join('');
        })
        .join('');
}

function numberText(x: number, y: number, transform: string | null, label: string): string {
    const t = transform ? ` transform="${transform}"` : '';
    return `<text class="num" x="${x}" y="${y}" text-anchor="middle" dominant-baseline="middle" fill="${LINE}" font-size="${NUMBER_SIZE}" font-weight="700" font-family="sans-serif"${t}>${label}</text>`;
}

function endzoneMarkup(homeName: string, awayName: string): string {
    const home = escapeXml(homeName.slice(0, 12).toUpperCase());
    const away = escapeXml(awayName.slice(0, 12).toUpperCase());
    const homeX = EZ / 2;
    const awayX = AWAY_GOAL_X + EZ / 2;
    const y = H / 2;
    return [
        `<text x="${homeX}" y="${y}" fill="#7dffa3" fill-opacity="0.7" font-size="26" font-weight="700" font-family="sans-serif" text-anchor="middle" transform="rotate(-90 ${homeX} ${y})">${home}</text>`,
        `<text x="${awayX}" y="${y}" fill="#7dffa3" fill-opacity="0.7" font-size="26" font-weight="700" font-family="sans-serif" text-anchor="middle" transform="rotate(90 ${awayX} ${y})">${away}</text>`,
    ].join('');
}

function postMarkup(goalX: number, intoPad: 1 | -1): string {
    const cy = H / 2;
    const arm = POST_ARM * intoPad;
    const stem = 16 * -intoPad;
    return [
        `<g class="posts" stroke="#ffd54a" stroke-width="${POST_STROKE}" stroke-linecap="square" fill="none">`,
        `<line x1="${goalX}" y1="${cy - POST_HALF}" x2="${goalX}" y2="${cy + POST_HALF}"/>`,
        `<line x1="${goalX}" y1="${cy - POST_HALF}" x2="${goalX + arm}" y2="${cy - POST_HALF}"/>`,
        `<line x1="${goalX}" y1="${cy + POST_HALF}" x2="${goalX + arm}" y2="${cy + POST_HALF}"/>`,
        `<line x1="${goalX}" y1="${cy}" x2="${goalX + stem}" y2="${cy}"/>`,
        '</g>',
    ].join('');
}

function overlayMarkup(input: FieldPaintInput): string {
    const {situation} = input;
    const losX = ballX(situation.yardline100, situation.possession);
    const fdX = firstDownX(situation.yardline100, situation.distance, situation.possession);
    const y = hashY(situation.hash);
    const offX = unitX(losX, situation.possession, 'offense');
    const defX = unitX(losX, situation.possession, 'defense');
    const defTeam = situation.possession === 'home' ? 'away' : 'home';
    return [
        `<line class="fd" x1="${fdX}" y1="0" x2="${fdX}" y2="${H}" stroke="#ffe082" stroke-width="3" opacity="0.9" stroke-dasharray="10 8"/>`,
        `<line class="los" x1="${losX}" y1="0" x2="${losX}" y2="${H}" stroke="#8ab4f8" stroke-width="3"/>`,
        unitCircle(offX, y, situation.possession),
        unitCircle(defX, y, defTeam),
        trailMarkup(input),
        ballMarkup(input, losX, y),
    ].join('');
}

function unitCircle(x: number, y: number, team: 'home' | 'away'): string {
    const color = team === 'home' ? '#8ab4f8' : '#ffb74d';
    return `<circle class="unit ${team}" cx="${x}" cy="${y}" r="${UNIT_R}" fill="${color}" fill-opacity="0.32" stroke="${color}" stroke-width="${UNIT_STROKE}"/>`;
}

function trailColor(kind: FieldAnimKind): string {
    if (kind === 'run') return '#ffffff';
    if (kind === 'pass') return '#ffe082';
    return '#ffab40';
}

function trailMarkup(input: FieldPaintInput): string {
    if (!input.trailPath || !input.trailKind) return '';
    const color = trailColor(input.trailKind);
    return [
        `<defs><marker id="play-arrow" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="10" markerHeight="10" markerUnits="userSpaceOnUse" orient="auto">`,
        `<path d="M0,0 L10,5 L0,10 z" fill="${color}"/></marker></defs>`,
        `<path class="trail" d="${input.trailPath}" fill="none" stroke="${color}" stroke-width="${TRAIL_STROKE}" stroke-linecap="round" opacity="0.9" marker-end="url(#play-arrow)"/>`,
    ].join('');
}

function ballMarkup(input: FieldPaintInput, idleX: number, y: number): string {
    if (input.fgPath && input.animateFg) {
        const path = input.fgPath.replaceAll('"', '');
        return [
            `<circle class="ball fly" id="fg-${input.fgKey}" r="${BALL_R}" fill="#c45a12" stroke="#f4e1c1" stroke-width="${BALL_STROKE}">`,
            `<animateMotion dur="1.4s" fill="freeze" path="${path}"/>`,
            '</circle>',
        ].join('');
    }
    return `<circle class="ball idle" cx="${idleX}" cy="${y}" r="${BALL_R}" fill="#c45a12" stroke="#f4e1c1" stroke-width="${BALL_STROKE}"/>`;
}
