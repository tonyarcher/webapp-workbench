import { speciesById } from '../../core/data';
import type { Encounter, Outcome, RunState, Size, Species, SpeciesId } from '../../core/types';
import type { FishGulp, FishMouth, FishMotion } from '../fish-art/fish-art';

export interface SceneAnimation {
    readonly playerMotion: FishMotion;
    readonly playerMouth: FishMouth;
    readonly playerGulp: FishGulp;
    readonly playerClass: string;
    readonly encounterMotion: FishMotion;
    readonly encounterMouth: FishMouth;
    readonly encounterClass: string;
    readonly sceneClass: string;
}

const SIZE_RANK: Readonly<Record<Size, number>> = {
    tiny: 0,
    small: 1,
    medium: 2,
    large: 3,
    huge: 4,
};

function swims(encounter: Encounter): boolean {
    return encounter.kind === 'fish' || encounter.kind === 'predator';
}

/**
 * A swallow is dramatic when the prey is within one size class of the eater.
 * The current food web has no larger-than-player prey; mackinaw swallowing a
 * walleye is the largest legal meal, and this threshold will cover a bigger one
 * if the data gains it later.
 */
function gulpFor(species: Species, encounter: Encounter, outcome: Outcome | null): FishGulp {
    if (!outcome || outcome.action !== 'eat' || outcome.tone !== 'good') return 'none';
    if (encounter.kind === 'food') return 'small';
    if (encounter.kind !== 'fish') return 'none';
    // A fish encounter carries a species id.
    const prey = speciesById(encounter.id as SpeciesId);
    return SIZE_RANK[prey.size] >= SIZE_RANK[species.size] - 1 ? 'big' : 'small';
}

function playerClassFor(outcome: Outcome | null, gulp: FishGulp): string {
    const classes: string[] = [];
    if (outcome?.tone === 'fatal') {
        classes.push('hit');
    } else if (outcome) {
        switch (outcome.action) {
            case 'eat':
                classes.push(outcome.tone === 'bad' ? 'spit' : 'lunge');
                break;
            case 'chase':
                classes.push('rush');
                break;
            case 'shallow':
                classes.push('rise');
                break;
            case 'deep':
                classes.push('dive');
                break;
            case 'ignore':
                classes.push('settle');
                break;
        }
    }
    if (gulp === 'big') classes.push('big-gulp');
    return classes.join(' ');
}

function encounterClassFor(encounter: Encounter, outcome: Outcome | null): string {
    if (!outcome) return '';
    if (outcome.tone === 'fatal') return 'attack';
    switch (outcome.action) {
        case 'eat':
            if (outcome.tone === 'good') return encounter.kind === 'food' ? 'nibbled' : 'eaten';
            if (outcome.tone === 'bad') return 'wobble';
            return encounter.kind === 'fish' ? 'fled' : 'wobble';
        case 'chase':
            return 'fled';
        case 'ignore':
        case 'shallow':
        case 'deep':
            return 'drift';
    }
}

function encounterMouthFor(encounter: Encounter, outcome: Outcome | null): FishMouth {
    if (!swims(encounter)) return 'shut';
    return outcome?.tone === 'fatal' ? 'chomp' : 'breathe';
}

function sceneClassFor(outcome: Outcome | null): string {
    if (!outcome) return '';
    const classes = [`scene-${outcome.tone}`];
    if (outcome.action === 'eat' && outcome.tone === 'good') classes.push('feeding');
    return classes.join(' ');
}

export function sceneAnimation(run: RunState, species: Species, encounter: Encounter): SceneAnimation {
    const outcome = run.outcome;
    const gulp = gulpFor(species, encounter, outcome);
    return {
        playerMotion: 'swim',
        playerMouth: outcome?.action === 'eat' ? 'chomp' : 'breathe',
        playerGulp: gulp,
        playerClass: playerClassFor(outcome, gulp),
        encounterMotion: swims(encounter) ? 'swim' : 'still',
        encounterMouth: encounterMouthFor(encounter, outcome),
        encounterClass: encounterClassFor(encounter, outcome),
        sceneClass: sceneClassFor(outcome),
    };
}
