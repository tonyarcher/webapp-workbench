import { describe, expect, it } from 'vitest';
import { chooseAction, currentEncounter, currentSpecies, startRun } from '../../core/game';
import type { Action, EncounterId, SpeciesId } from '../../core/types';
import { sceneAnimation } from './animation';

function at(speciesId: SpeciesId, encounterId: EncounterId, action: Action, roll = 0) {
    const base = startRun('practice', speciesId, 7);
    const run = chooseAction({ ...base, encounterId }, action, roll);
    return sceneAnimation(run, currentSpecies(run), currentEncounter(run));
}

function choosing(speciesId: SpeciesId, encounterId: EncounterId) {
    const run = { ...startRun('practice', speciesId, 7), encounterId };
    return sceneAnimation(run, currentSpecies(run), currentEncounter(run));
}

describe('scene animation state', () => {
    it('swims the player and a breathing fish before a choice', () => {
        expect(choosing('walleye', 'chub')).toMatchObject({
            playerMotion: 'swim',
            playerMouth: 'breathe',
            playerGulp: 'none',
            playerClass: '',
            encounterMotion: 'swim',
            encounterMouth: 'breathe',
            encounterClass: '',
            sceneClass: '',
        });
    });

    it('leaves food and hazards still and quiet', () => {
        const food = choosing('chub', 'algae');
        expect(food.encounterMotion).toBe('still');
        expect(food.encounterMouth).toBe('shut');

        const hazard = choosing('walleye', 'angler-bait');
        expect(hazard.encounterMotion).toBe('still');
        expect(hazard.encounterMouth).toBe('shut');
    });

    it('lunges and swallows a smaller fish with a small gulp', () => {
        expect(at('rainbow', 'chub', 'eat')).toMatchObject({
            playerMouth: 'chomp',
            playerGulp: 'small',
            playerClass: 'lunge',
            encounterClass: 'eaten',
            sceneClass: 'scene-good feeding',
        });
    });

    it('gives the largest legal meal the big genie gulp', () => {
        expect(at('mackinaw', 'walleye', 'eat')).toMatchObject({
            playerGulp: 'big',
            playerClass: 'lunge big-gulp',
            encounterClass: 'eaten',
            sceneClass: 'scene-good feeding',
        });
    });

    it('nibbles food and spits out the wrong food', () => {
        expect(at('chub', 'algae', 'eat')).toMatchObject({
            playerGulp: 'small',
            playerClass: 'lunge',
            encounterClass: 'nibbled',
            sceneClass: 'scene-good feeding',
        });
        expect(at('walleye', 'algae', 'eat')).toMatchObject({
            playerGulp: 'none',
            playerClass: 'spit',
            encounterClass: 'wobble',
            sceneClass: 'scene-bad',
        });
    });

    it('shows a fish slipping away and a predator being mouthed', () => {
        expect(at('walleye', 'chub', 'eat', 0.99)).toMatchObject({
            playerGulp: 'none',
            playerMouth: 'chomp',
            playerClass: 'lunge',
            encounterClass: 'fled',
            sceneClass: 'scene-neutral',
        });
        expect(at('mackinaw', 'otter', 'eat')).toMatchObject({
            playerGulp: 'none',
            playerClass: 'lunge',
            encounterClass: 'wobble',
            encounterMotion: 'swim',
            encounterMouth: 'breathe',
            sceneClass: 'scene-neutral',
        });
    });

    it('drives prey away and drifts past a hazard', () => {
        expect(at('walleye', 'chub', 'chase')).toMatchObject({
            playerMouth: 'breathe',
            playerClass: 'rush',
            encounterClass: 'fled',
            sceneClass: 'scene-neutral',
        });
        expect(at('walleye', 'angler-bait', 'ignore')).toMatchObject({
            playerClass: 'settle',
            encounterClass: 'drift',
            encounterMouth: 'shut',
            sceneClass: 'scene-good',
        });
    });

    it('rises or dives out of the way', () => {
        expect(at('walleye', 'chub', 'shallow').playerClass).toBe('rise');
        expect(at('walleye', 'chub', 'deep').playerClass).toBe('dive');
        expect(at('walleye', 'chub', 'deep').encounterClass).toBe('drift');
    });

    it('keeps a good escape from flashing like a meal', () => {
        expect(at('walleye', 'otter', 'deep')).toMatchObject({
            playerClass: 'dive',
            encounterClass: 'drift',
            sceneClass: 'scene-good',
        });
    });

    it('shows a fatal attack from a predator and a hazard', () => {
        expect(at('walleye', 'otter', 'ignore')).toMatchObject({
            playerClass: 'hit',
            encounterClass: 'attack',
            encounterMouth: 'chomp',
            sceneClass: 'scene-fatal',
        });
        expect(at('walleye', 'angler-bait', 'eat')).toMatchObject({
            playerClass: 'hit',
            encounterClass: 'attack',
            encounterMouth: 'shut',
            sceneClass: 'scene-fatal',
        });
    });
});
