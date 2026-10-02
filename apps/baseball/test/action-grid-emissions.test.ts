import { expect } from '@esm-bundle/chai';
import '../src/widgets/scoring/baseball-action-grid.ts';
import { type BaseballActionGrid } from '../src/widgets/scoring/baseball-action-grid.ts';

/**
 * Every button the action grid renders, and the single event each must emit.
 *
 * The panel is a wall of similar labels, so a button wired to the wrong event
 * looks correct on screen and scores the wrong play: SAC BUNT landing a flyout
 * is invisible in a screenshot and obvious on a scoreboard. These are the
 * per-button contracts, keyed by data-action plus data-variant or data-base
 * where one action repeats across buttons.
 */
const EXPECTED: Record<string, { name: string; detail: Record<string, unknown> }> = {
    BALL: { name: 'trigger-scoring-event', detail: { eventType: 'BALL' } },
    'STRIKE:looking': { name: 'trigger-scoring-event', detail: { eventType: 'STRIKE' } },
    'STRIKE:swinging': { name: 'trigger-scoring-event', detail: { eventType: 'STRIKE' } },
    FOUL: { name: 'trigger-scoring-event', detail: { eventType: 'FOUL' } },
    SINGLE: { name: 'render-step2', detail: { eventType: 'SINGLE', baseLabel: 'Single (1B)' } },
    DOUBLE: { name: 'render-step2', detail: { eventType: 'DOUBLE', baseLabel: 'Double (2B)' } },
    TRIPLE: { name: 'render-step2', detail: { eventType: 'TRIPLE', baseLabel: 'Triple (3B)' } },
    HOME_RUN: { name: 'render-step2', detail: { eventType: 'HOME_RUN', baseLabel: 'Home Run (HR)' } },
    WALK: { name: 'trigger-scoring-event', detail: { eventType: 'WALK' } },
    HIT_BY_PITCH: { name: 'trigger-scoring-event', detail: { eventType: 'HIT_BY_PITCH' } },
    STRIKEOUT: { name: 'trigger-scoring-event', detail: { eventType: 'STRIKEOUT' } },
    GROUNDOUT: { name: 'render-step2', detail: { eventType: 'GROUNDOUT', baseLabel: 'Groundout' } },
    FLYOUT: { name: 'render-step2', detail: { eventType: 'FLYOUT', baseLabel: 'Flyout' } },
    LINE_OUT: { name: 'render-step2', detail: { eventType: 'LINE_OUT', baseLabel: 'Line Out' } },
    POP_OUT: { name: 'render-step2', detail: { eventType: 'POP_OUT', baseLabel: 'Pop Out' } },
    SACRIFICE_FLY: { name: 'render-step2', detail: { eventType: 'SACRIFICE_FLY', baseLabel: 'Sac Fly' } },
    ERROR: { name: 'render-step2', detail: { eventType: 'ERROR', baseLabel: 'Error (E)' } },
    FIELDER_CHOICE: { name: 'render-step2', detail: { eventType: 'FIELDER_CHOICE', baseLabel: "Fielder's Choice" } },
    SACRIFICE_BUNT: { name: 'render-step2', detail: { eventType: 'SACRIFICE_BUNT', baseLabel: 'Sac Bunt' } },
    'STOLEN_BASE:2': { name: 'trigger-scoring-event', detail: { eventType: 'STOLEN_BASE', base: 2 } },
    'STOLEN_BASE:3': { name: 'trigger-scoring-event', detail: { eventType: 'STOLEN_BASE', base: 3 } },
    'STOLEN_BASE:4': { name: 'trigger-scoring-event', detail: { eventType: 'STOLEN_BASE', base: 4 } },
    'CAUGHT_STEALING:2': { name: 'trigger-scoring-event', detail: { eventType: 'CAUGHT_STEALING', base: 2 } },
    'CAUGHT_STEALING:3': { name: 'trigger-scoring-event', detail: { eventType: 'CAUGHT_STEALING', base: 3 } },
    'CAUGHT_STEALING:4': { name: 'trigger-scoring-event', detail: { eventType: 'CAUGHT_STEALING', base: 4 } },
    WILD_PITCH: { name: 'trigger-scoring-event', detail: { eventType: 'WILD_PITCH' } },
    PASSED_BALL: { name: 'trigger-scoring-event', detail: { eventType: 'PASSED_BALL' } },
    BALK: { name: 'trigger-scoring-event', detail: { eventType: 'BALK' } },
};

const PITCH_TYPES = ['Fastball', 'Curveball', 'Slider', 'Changeup', 'Sinker', 'Cutter'];

/** The three families of event the grid emits, collected from one listener each. */
const EVENT_NAMES = ['pitch-type-selected', 'trigger-scoring-event', 'render-step2'] as const;

/**
 * The lookup key for a button. Pitch buttons carry `data-action="PITCH_TYPE"`
 * as well as `data-pitch-type`, so the pitch type has to win: keying them on
 * the shared action would collapse all six into one entry.
 */
function keyFor(button: Element): string {
    const pitchType = button.getAttribute('data-pitch-type');
    if (pitchType) {
        return `pitch:${pitchType}`;
    }
    const action = button.getAttribute('data-action') ?? '';
    const qualifier = button.getAttribute('data-variant') ?? button.getAttribute('data-base');
    return qualifier ? `${action}:${qualifier}` : action;
}

describe('BaseballActionGrid per-button emissions', () => {
    let element: BaseballActionGrid;
    /** Every event the grid emitted, in order, as {name, detail}. */
    let emitted: { name: string; detail: Record<string, unknown> }[];

    beforeEach(async () => {
        element = document.createElement('baseball-action-grid') as BaseballActionGrid;
        document.body.appendChild(element);
        await element.updateComplete;
        emitted = [];
        for (const name of EVENT_NAMES) {
            element.addEventListener(name, (e: Event) => {
                emitted.push({ name, detail: (e as CustomEvent).detail });
            });
        }
    });

    afterEach(() => {
        element.remove();
    });

    it('has an expectation for every button it renders', () => {
        // Without this, adding a button and forgetting to assert it would pass.
        const buttons = Array.from(element.shadowRoot!.querySelectorAll('button'));
        const unlisted = buttons.map(keyFor).filter((key) => !(key in EXPECTED) && !key.startsWith('pitch:'));
        expect(unlisted, 'buttons with no expected emission').to.deep.equal([]);
    });

    it('renders every pitch type the expectations claim', () => {
        const rendered = Array.from(element.shadowRoot!.querySelectorAll('[data-pitch-type]')).map((b) =>
            b.getAttribute('data-pitch-type'),
        );
        expect(rendered).to.deep.equal(PITCH_TYPES);
    });

    it('emits the expected event and detail for every action button', () => {
        // Pitch buttons also carry data-action, so they are excluded here and
        // asserted by the pitch test below.
        const buttons = Array.from(
            element.shadowRoot!.querySelectorAll<HTMLElement>('button[data-action]:not([data-pitch-type])'),
        );
        // 4 pitch results + 4 hits + 3 walks + 8 outs + 9 baserunning.
        expect(buttons.length).to.equal(28);

        for (const button of buttons) {
            const key = keyFor(button);
            const want = EXPECTED[key];
            expect(want, `no expectation for ${key}`).to.not.be.undefined;
            if (!want) continue;

            emitted = [];
            button.click();

            expect(emitted, `${key} emitted the wrong number of events`).to.have.length(1);
            expect(emitted[0]?.name, `${key} emitted the wrong event`).to.equal(want.name);
            expect(emitted[0]?.detail, `${key} emitted the wrong detail`).to.deep.equal(want.detail);
        }
    });

    it('emits pitch-type-selected for every pitch button', () => {
        const buttons = Array.from(element.shadowRoot!.querySelectorAll<HTMLElement>('[data-pitch-type]'));
        for (const button of buttons) {
            const pitchType = button.getAttribute('data-pitch-type');
            emitted = [];
            button.click();

            expect(emitted, `${pitchType} emitted the wrong number of events`).to.have.length(1);
            expect(emitted[0]?.name).to.equal('pitch-type-selected');
            expect(emitted[0]?.detail).to.deep.equal({ pitchType });
        }
    });

    it('suppresses every button when interactive is false', () => {
        // One assertion for the whole panel: the guard is per-emit-family, so
        // checking BALK alone would leave the step2 and pitch paths unguarded.
        element.setAttribute('interactive', 'false');

        return element.updateComplete.then(() => {
            const buttons = Array.from(element.shadowRoot!.querySelectorAll('button'));
            for (const button of buttons) button.click();
            expect(emitted).to.deep.equal([]);
        });
    });

    it('marks only the active play as pressed', async () => {
        element.setAttribute(
            'active-play-json',
            JSON.stringify({ eventType: 'STOLEN_BASE', base: 3, pitchType: 'Slider' }),
        );
        await element.updateComplete;

        const pressed = Array.from(element.shadowRoot!.querySelectorAll('.sim-press')).map(keyFor);
        expect(pressed.sort()).to.deep.equal(['STOLEN_BASE:3', 'pitch:Slider']);
    });
});
