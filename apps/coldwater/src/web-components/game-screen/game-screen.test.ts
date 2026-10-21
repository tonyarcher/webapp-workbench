// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { chooseAction, currentSpecies, startRun } from '../../core/game';
import type { Action, RunState } from '../../core/types';
import { CwGameScreen } from './game-screen';

async function mount(run: RunState): Promise<CwGameScreen> {
    const element = new CwGameScreen();
    element.run = run;
    document.body.appendChild(element);
    await element.updateComplete;
    return element;
}

function atEncounter(run: RunState, encounterId: RunState['encounterId']): RunState {
    return { ...run, encounterId };
}

beforeEach(() => {
    document.body.innerHTML = '';
});

describe('game screen', () => {
    it('shows the current fish, encounter, and available moves', async () => {
        const element = await mount(atEncounter(startRun('practice', 'walleye', 7), 'chub'));
        expect(element.renderRoot.querySelector('h1')?.textContent).toBe('Walleye');
        expect(element.renderRoot.textContent).toContain('A chub nips at something in the shallows.');
        const actions = Array.from(element.renderRoot.querySelectorAll('.action')).map((action) => action.textContent);
        expect(actions).toHaveLength(5);
        expect(actions[0]).toContain('Eat');
        expect(actions[4]).toContain('Deep escape');
    });

    it('emits the selected action', async () => {
        const element = await mount(atEncounter(startRun('practice', 'walleye', 7), 'chub'));
        const actions: Action[] = [];
        element.addEventListener('choose-action', (event) => actions.push((event as CustomEvent<Action>).detail));
        const first = element.renderRoot.querySelector<HTMLButtonElement>('.action');
        first?.click();
        expect(actions).toEqual(['eat']);
    });

    it('shows a resolved outcome and continues', async () => {
        const run = chooseAction(atEncounter(startRun('practice', 'walleye', 7), 'chub'), 'eat', 0);
        const element = await mount(run);
        expect(element.renderRoot.querySelector('.outcome h2')?.textContent).toBe('Caught it');
        expect(element.renderRoot.textContent).toContain('+5 points');
        let continued = 0;
        element.addEventListener('continue-run', () => {
            continued += 1;
        });
        element.renderRoot.querySelector<HTMLButtonElement>('.outcome .primary')?.click();
        expect(continued).toBe(1);
    });

    it('shows a fatal outcome and offers a restart', async () => {
        const run = chooseAction(atEncounter(startRun('practice', 'walleye', 7), 'otter'), 'ignore', 0);
        const element = await mount(run);
        expect(element.renderRoot.querySelector('.outcome h2')?.textContent).toBe('It closed in');
        expect(element.renderRoot.textContent).toContain('The lake does not keep score');
        let restarted = 0;
        element.addEventListener('restart', () => {
            restarted += 1;
        });
        element.renderRoot.querySelector<HTMLButtonElement>('.outcome .primary')?.click();
        expect(restarted).toBe(1);
    });

    it('hides the name and shows a timer in points mode', async () => {
        const run = startRun('points', 'walleye', 7);
        const element = await mount(run);
        expect(element.renderRoot.querySelector('h1')?.textContent).toBe('Unidentified fish');
        expect(element.renderRoot.querySelector('[role="progressbar"]')).not.toBeNull();
        expect(element.renderRoot.textContent).toContain('Unknown');
        expect(element.renderRoot.textContent).toContain('Your fish');
        expect(element.renderRoot.textContent).not.toContain(currentSpecies(run).name);
        const guide = element.renderRoot.querySelector<HTMLButtonElement>('.guide-link');
        let opened = 0;
        element.addEventListener('open-guide', () => {
            opened += 1;
        });
        guide?.click();
        expect(opened).toBe(1);
    });

    it('shows the fish name after a points outcome', async () => {
        const run = chooseAction(atEncounter(startRun('points', 'walleye', 7), 'chub'), 'eat', 0);
        const element = await mount(run);
        expect(element.renderRoot.querySelector('h1')).not.toBeNull();
        expect(element.renderRoot.textContent).not.toContain('Unknown');
    });

    it('shows negative and zero score changes', async () => {
        const bad = chooseAction(atEncounter(startRun('practice', 'walleye', 7), 'algae'), 'eat', 0);
        const badElement = await mount(bad);
        expect(badElement.renderRoot.textContent).toContain('-4 points');
        badElement.remove();

        const flat = chooseAction(atEncounter(startRun('practice', 'walleye', 7), 'chub'), 'chase', 0);
        const flatElement = await mount(flat);
        expect(flatElement.renderRoot.textContent).toContain('No score change');
    });

    it('shows a surface-and-deep fish and a points-mode final score', async () => {
        const chub = await mount(startRun('practice', 'chub', 7));
        expect(chub.renderRoot.textContent).toContain('Surface and deep water');
        chub.remove();

        const dead = chooseAction(atEncounter(startRun('points', 'walleye', 7), 'otter'), 'ignore', 0);
        const element = await mount(dead);
        expect(element.renderRoot.textContent).toContain('Final score:');
    });

    it('sets the swimming and breathing state before a choice', async () => {
        const element = await mount(atEncounter(startRun('practice', 'walleye', 7), 'chub'));
        const player = element.renderRoot.querySelector<HTMLElement>('.player');
        const encounter = element.renderRoot.querySelector<HTMLElement>('.encounter');
        const playerArt = player?.querySelector('cw-fish-art');
        const encounterArt = encounter?.querySelector('cw-fish-art');
        expect(player?.classList.contains('lunge')).toBe(false);
        expect(playerArt?.getAttribute('motion')).toBe('swim');
        expect(playerArt?.getAttribute('mouth')).toBe('breathe');
        expect(playerArt?.getAttribute('gulp')).toBe('none');
        expect(encounterArt?.getAttribute('motion')).toBe('swim');
        expect(encounterArt?.getAttribute('mouth')).toBe('breathe');
        expect(element.renderRoot.querySelector('.scene-flash')?.getAttribute('aria-hidden')).toBe('true');
    });

    it('adds a big gulp state for the largest legal meal', async () => {
        const run = chooseAction(atEncounter(startRun('practice', 'mackinaw', 7), 'walleye'), 'eat', 0);
        const element = await mount(run);
        const player = element.renderRoot.querySelector<HTMLElement>('.player');
        const encounter = element.renderRoot.querySelector<HTMLElement>('.encounter');
        const scene = element.renderRoot.querySelector<HTMLElement>('.scene');
        expect(player?.classList.contains('lunge')).toBe(true);
        expect(player?.classList.contains('big-gulp')).toBe(true);
        expect(player?.querySelector('cw-fish-art')?.getAttribute('gulp')).toBe('big');
        expect(player?.querySelector('cw-fish-art')?.getAttribute('mouth')).toBe('chomp');
        expect(encounter?.classList.contains('eaten')).toBe(true);
        expect(scene?.classList.contains('scene-good')).toBe(true);
        expect(scene?.classList.contains('feeding')).toBe(true);
    });

    it('shows the fatal attack state', async () => {
        const run = chooseAction(atEncounter(startRun('practice', 'walleye', 7), 'otter'), 'ignore', 0);
        const element = await mount(run);
        expect(element.renderRoot.querySelector('.scene')?.classList.contains('scene-fatal')).toBe(true);
        expect(element.renderRoot.querySelector('.player')?.classList.contains('hit')).toBe(true);
        expect(element.renderRoot.querySelector('.encounter')?.classList.contains('attack')).toBe(true);
        expect(element.renderRoot.querySelector('.encounter cw-fish-art')?.getAttribute('mouth')).toBe('chomp');
    });

    it('keeps food still while the player nibbles', async () => {
        const run = chooseAction(atEncounter(startRun('practice', 'chub', 7), 'algae'), 'eat', 0);
        const element = await mount(run);
        expect(element.renderRoot.querySelector('.encounter cw-fish-art')?.getAttribute('motion')).toBe('still');
        expect(element.renderRoot.querySelector('.encounter cw-fish-art')?.getAttribute('mouth')).toBe('shut');
        expect(element.renderRoot.querySelector('.player cw-fish-art')?.getAttribute('gulp')).toBe('small');
        expect(element.renderRoot.querySelector('.encounter')?.classList.contains('nibbled')).toBe(true);
    });

    it('renders nothing before a run exists', async () => {
        const element = new CwGameScreen();
        document.body.appendChild(element);
        await element.updateComplete;
        expect(element.renderRoot.textContent?.trim()).toBe('');
    });
});
