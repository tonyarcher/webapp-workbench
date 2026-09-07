import { expect } from '@esm-bundle/chai';
import { asHand, isBattedBall, parsePlatePlay, plateResultLabel } from '../src/scoreboard/plate-play.ts';
import { plateSceneClass } from '../src/scoreboard/plate-scene.ts';
import { hitEndpoint, HOME_POINT } from '../src/scorebook/baseball-defense-diagram/hit-line.ts';

describe('plate-play', () => {
  it('maps events to ball/strike/foul/in play/out', () => {
    expect(plateResultLabel('BALL')).to.equal('BALL');
    expect(plateResultLabel('WALK')).to.equal('BALL');
    expect(plateResultLabel('STRIKE')).to.equal('STRIKE');
    expect(plateResultLabel('FOUL')).to.equal('FOUL');
    expect(plateResultLabel('SINGLE')).to.equal('IN PLAY');
    expect(plateResultLabel('HOME_RUN')).to.equal('IN PLAY');
    expect(plateResultLabel('ERROR')).to.equal('IN PLAY');
    expect(plateResultLabel('GROUNDOUT')).to.equal('OUT');
    expect(plateResultLabel('STRIKEOUT')).to.equal('OUT');
    expect(plateResultLabel('STOLEN_BASE')).to.equal('');
  });

  it('identifies batted balls for the field line', () => {
    expect(isBattedBall('DOUBLE')).to.equal(true);
    expect(isBattedBall('FLYOUT')).to.equal(true);
    expect(isBattedBall('STRIKE')).to.equal(false);
    expect(isBattedBall('STRIKEOUT')).to.equal(false);
  });

  it('parses handedness, swing, zone, and field position', () => {
    const play = parsePlatePlay(JSON.stringify({
      eventType: 'FOUL',
      bats: 'L',
      throws: 'L',
      strikeKind: 'swinging',
      fieldPos: 8,
      pitchLocation: { zone: 5 },
    }));
    expect(play?.bats).to.equal('L');
    expect(play?.throws).to.equal('L');
    expect(play?.result).to.equal('FOUL');
    expect(play?.swinging).to.equal(true);
    expect(play?.fieldPos).to.equal(8);
    expect(play?.zone).to.equal(5);
  });

  it('uses looking to suppress the swing and falls back on handedness', () => {
    const play = parsePlatePlay(JSON.stringify({ eventType: 'STRIKE', strikeKind: 'looking', bats: 'X' }), 'L', 'L');
    expect(play?.swinging).to.equal(false);
    expect(play?.bats).to.equal('L');
    expect(play?.throws).to.equal('L');
  });

  it('builds plate scene classes for result and swing', () => {
    expect(plateSceneClass('IN PLAY', true, true)).to.equal('plate-scene result-IN-PLAY has-pitch swinging animated');
    expect(plateSceneClass('', false, false)).to.equal('plate-scene instant');
  });

  it('returns null for empty or invalid json', () => {
    expect(parsePlatePlay('')).to.equal(null);
    expect(parsePlatePlay('{')).to.equal(null);
    expect(asHand('L')).to.equal('L');
    expect(asHand('nope')).to.equal('R');
  });
});

describe('hit-line', () => {
  it('starts at home and ends at the fielder', () => {
    expect(HOME_POINT).to.deep.equal({ x: 50, y: 88 });
    expect(hitEndpoint(8, 'FLYOUT')).to.deep.equal({ x: 50, y: 15 });
    expect(hitEndpoint(99, 'SINGLE')).to.equal(null);
  });

  it('extends a home run beyond the outfielder', () => {
    const fly = hitEndpoint(7, 'FLYOUT');
    const homer = hitEndpoint(7, 'HOME_RUN');
    expect(fly).to.not.equal(null);
    expect(homer).to.not.equal(null);
    expect(homer!.y).to.be.lessThan(fly!.y);
  });
});
