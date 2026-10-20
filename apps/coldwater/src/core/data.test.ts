import { describe, expect, it } from 'vitest';
import { FOOD_IDS, SPECIES_LIST, allEncounters, encounterById, isFood, speciesById } from './data';
import type { EncounterId, SpeciesId } from './types';

const SPECIES_IDS = new Set<string>(SPECIES_LIST.map((species) => species.id));

describe('lake data', () => {
    it('uses unique species and encounter ids', () => {
        expect(new Set(SPECIES_LIST.map((species) => species.id)).size).toBe(SPECIES_LIST.length);
        const encounters = allEncounters();
        expect(new Set(encounters.map((encounter) => encounter.id)).size).toBe(encounters.length);
    });

    it('gives every fish at least one edible encounter', () => {
        for (const species of SPECIES_LIST) {
            expect(species.eats.length, species.id).toBeGreaterThan(0);
            for (const food of species.eats) {
                expect(() => encounterById(food)).not.toThrow();
            }
        }
    });

    it('keeps the food web symmetric for fish', () => {
        for (const species of SPECIES_LIST) {
            for (const preyId of species.eats) {
                if (!SPECIES_IDS.has(preyId)) continue;
                const prey = speciesById(preyId as SpeciesId);
                expect(prey.predators, `${species.id} eats ${preyId}`).toContain(species.id);
            }
        }
    });

    it('lists every fish a predator can eat', () => {
        for (const species of SPECIES_LIST) {
            for (const predatorId of species.predators) {
                if (!SPECIES_IDS.has(predatorId)) continue;
                const predator = speciesById(predatorId as SpeciesId);
                expect(predator.eats, `${predatorId} eats ${species.id}`).toContain(species.id);
            }
        }
    });

    it('gives every hunting encounter an escape route', () => {
        const predatorIds = new Set<EncounterId>();
        for (const species of SPECIES_LIST) {
            for (const predator of species.predators) predatorIds.add(predator);
        }
        for (const encounter of allEncounters()) {
            if (!predatorIds.has(encounter.id)) continue;
            expect(encounter.escape, encounter.id).not.toBeNull();
        }
    });

    it('includes the requested lake animals', () => {
        expect(SPECIES_LIST.some((species) => species.id === 'walleye')).toBe(true);
        expect(allEncounters().some((encounter) => encounter.id === 'otter')).toBe(true);
        expect(SPECIES_LIST.some((species) => species.id === 'mackinaw' && !species.canShallow)).toBe(true);
    });

    it('has at least one food item of each kind', () => {
        for (const food of FOOD_IDS) {
            expect(isFood(food)).toBe(true);
            expect(encounterById(food).kind).toBe('food');
        }
        expect(isFood('otter')).toBe(false);
    });

    it('rejects unknown ids', () => {
        expect(() => speciesById('unknown' as SpeciesId)).toThrow('Unknown species');
        expect(() => encounterById('unknown' as EncounterId)).toThrow('Unknown encounter');
    });
});
