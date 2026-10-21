import { describe, expect, it } from 'vitest';
import { availableActionsFor, relationshipFor, resolveEncounter } from './resolve';
import { encounterById, speciesById } from './data';
import type { Action, EncounterId, SpeciesId } from './types';

function resolve(speciesId: SpeciesId, encounterId: EncounterId, action: Action, roll = 0) {
    return resolveEncounter(speciesId, encounterId, action, roll);
}

describe('encounter resolution', () => {
    it('lets a walleye eat a chub when the roll is good', () => {
        const result = resolve('walleye', 'chub', 'eat', 0);
        expect(result.tone).toBe('good');
        expect(result.points).toBe(5);
        expect(result.survived).toBe(true);
    });

    it('lets a chub escape now and then', () => {
        const result = resolve('walleye', 'chub', 'eat', 0.99);
        expect(result.tone).toBe('neutral');
        expect(result.points).toBe(0);
        expect(result.title).toContain('slips away');
    });

    it('kills a fish that tries to eat a predator', () => {
        const result = resolve('walleye', 'otter', 'eat');
        expect(result.tone).toBe('fatal');
        expect(result.survived).toBe(false);
    });

    it('treats an ignored predator as fatal', () => {
        expect(resolve('walleye', 'otter', 'ignore')).toMatchObject({ tone: 'fatal', survived: false });
        expect(resolve('whitefish', 'otter', 'ignore')).toMatchObject({ tone: 'fatal', survived: false });
    });

    it('makes deep water the otter answer and shallow water the mackinaw answer', () => {
        expect(resolve('walleye', 'otter', 'deep').survived).toBe(true);
        expect(resolve('walleye', 'otter', 'shallow').survived).toBe(false);
        expect(resolve('walleye', 'mackinaw', 'shallow').survived).toBe(true);
        expect(resolve('walleye', 'mackinaw', 'deep').survived).toBe(false);
    });

    it('makes bait fatal to eat and safe to ignore', () => {
        expect(resolve('walleye', 'angler-bait', 'eat').survived).toBe(false);
        expect(resolve('walleye', 'angler-bait', 'ignore')).toMatchObject({
            tone: 'good',
            points: 1,
            survived: true,
        });
        expect(resolve('walleye', 'angler-fly', 'eat').survived).toBe(false);
    });

    it('rewards the right food and punishes the wrong food', () => {
        expect(resolve('chub', 'algae', 'eat')).toMatchObject({ tone: 'good', points: 3 });
        expect(resolve('walleye', 'algae', 'eat')).toMatchObject({ tone: 'bad', points: -4 });
        expect(resolve('walleye', 'bottom-life', 'eat')).toMatchObject({ tone: 'bad', points: -4 });
    });

    it('lets a fish chase off a predator only rarely', () => {
        expect(resolve('walleye', 'otter', 'chase', 0)).toMatchObject({ tone: 'good', survived: true });
        expect(resolve('walleye', 'otter', 'chase', 0.5)).toMatchObject({ tone: 'fatal', survived: false });
    });

    it('does not reward chasing prey', () => {
        expect(resolve('walleye', 'chub', 'chase')).toMatchObject({ tone: 'neutral', points: 0 });
    });

    it('treats a hazard as fatal when chased', () => {
        expect(resolve('walleye', 'angler-bait', 'chase')).toMatchObject({ tone: 'fatal', survived: false });
    });

    it('swims clear of a hazard', () => {
        expect(resolve('walleye', 'angler-fly', 'deep')).toMatchObject({ tone: 'good', points: 1, survived: true });
    });

    it('lets a fish mouth something that is neither food nor a threat', () => {
        expect(resolve('walleye', 'walleye', 'eat')).toMatchObject({ tone: 'neutral', points: 0 });
        expect(resolve('walleye', 'algae', 'chase')).toMatchObject({ tone: 'neutral', points: 0 });
        expect(resolve('walleye', 'chub', 'deep')).toMatchObject({ tone: 'neutral', points: 0 });
    });

    it('blocks shallow movement for a mackinaw and lets it move elsewhere', () => {
        expect(resolve('mackinaw', 'chub', 'shallow')).toMatchObject({ tone: 'neutral', survived: true });
        expect(resolve('mackinaw', 'chub', 'deep')).toMatchObject({ tone: 'neutral', survived: true });
    });

    it('reports the relationship between a fish and an encounter', () => {
        expect(relationshipFor(speciesById('walleye'), encounterById('chub'))).toBe('prey');
        expect(relationshipFor(speciesById('walleye'), encounterById('otter'))).toBe('predator');
        expect(relationshipFor(speciesById('walleye'), encounterById('angler-bait'))).toBe('hazard');
        expect(relationshipFor(speciesById('walleye'), encounterById('bottom-life'))).toBe('food');
        expect(relationshipFor(speciesById('mackinaw'), encounterById('otter'))).toBe('neutral');
    });

    it('offers only the actions a body can perform', () => {
        expect(availableActionsFor(speciesById('walleye'))).toEqual(['eat', 'chase', 'ignore', 'shallow', 'deep']);
        expect(availableActionsFor(speciesById('mackinaw'))).toEqual(['eat', 'chase', 'ignore', 'deep']);
    });

    it('clamps rolls outside the normal range', () => {
        expect(resolve('walleye', 'chub', 'eat', -1).tone).toBe('good');
        expect(resolve('walleye', 'chub', 'eat', 2).tone).toBe('neutral');
    });

    it('records the action that produced the outcome', () => {
        expect(resolve('walleye', 'chub', 'eat').action).toBe('eat');
        expect(resolve('walleye', 'chub', 'chase').action).toBe('chase');
        expect(resolve('walleye', 'chub', 'ignore').action).toBe('ignore');
        expect(resolve('walleye', 'chub', 'deep').action).toBe('deep');
    });
});
