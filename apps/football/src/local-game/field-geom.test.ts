import {describe, expect, it} from 'vitest';
import {
    AWAY_GOAL_X,
    FIELD_HEIGHT,
    FIELD_WIDTH,
    HOME_GOAL_X,
    POST_HALF,
    animKind,
    ballX,
    fgTarget,
    firstDownX,
    yardsFromHomeGoal,
} from './field-geom';

describe('field-geom', () => {
    it('maps home ball on own 30 (yardline_100 70) near the left numbers', () => {
        expect(yardsFromHomeGoal(70, 'home')).toBe(30);
        expect(ballX(70, 'home')).toBe(HOME_GOAL_X + 300);
    });

    it('maps away ball on own 30 (yardline_100 70) near the right numbers', () => {
        expect(yardsFromHomeGoal(70, 'away')).toBe(70);
        expect(ballX(70, 'away')).toBe(HOME_GOAL_X + 700);
    });

    it('places first down 10 yards ahead of home LOS', () => {
        expect(firstDownX(70, 10, 'home')).toBe(ballX(70, 'home') + 100);
    });

    it('places first down toward the home goal for away', () => {
        expect(firstDownX(70, 10, 'away')).toBe(ballX(70, 'away') - 100);
    });

    it('clamps a goal-to-go marker to the goal line', () => {
        expect(firstDownX(8, 8, 'home')).toBe(AWAY_GOAL_X);
        expect(firstDownX(8, 8, 'away')).toBe(HOME_GOAL_X);
    });

    it('classifies play animations', () => {
        expect(animKind('field_goal', false)).toBe('fg');
        expect(animKind('scrimmage', true)).toBe('pass');
        expect(animKind('scrimmage', false, 'dropback')).toBe('pass');
        expect(animKind('scrimmage', false, 'inside_zone')).toBe('run');
        expect(animKind('kickoff', false)).toBe('kick');
        expect(animKind('timeout', false)).toBeNull();
    });

    it('aims a miss left or right of the posts, never through', () => {
        const fromX = 400;
        const fromY = 186;
        const left = fgTarget(fromX, fromY, 'home', 'left');
        const right = fgTarget(fromX, fromY, 'home', 'right');
        const through = fgTarget(fromX, fromY, 'home', 'through');
        expect(left.toY).toBeLessThan(through.toY);
        expect(right.toY).toBeGreaterThan(through.toY);
        expect(through.toY - left.toY).toBeGreaterThan(POST_HALF);
        expect(right.toY - through.toY).toBeGreaterThan(POST_HALF);
        expect(left.toY).toBeGreaterThan(0);
        expect(right.toY).toBeLessThan(FIELD_HEIGHT);
        expect(left.toX).toBeGreaterThan(FIELD_WIDTH);
    });
});
