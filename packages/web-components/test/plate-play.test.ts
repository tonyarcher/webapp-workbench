import { expect } from '@esm-bundle/chai';
import { asHand, isBattedBall, parsePlatePlay, plateResultLabel, safeColor } from '../src/scoreboard/plate-play.ts';
import { plateSceneClass, zoneFromClick, zoneFromPoint, zoneOffsets } from '../src/scoreboard/plate-scene.ts';
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

  it('accepts outside pitch locations up to zone 17', () => {
    const play = parsePlatePlay(JSON.stringify({ eventType: 'BALL', pitchLocation: { zone: 13 } }));
    expect(play?.zone).to.equal(13);
  });

  it('rejects pitch locations outside 1-17', () => {
    expect(parsePlatePlay(JSON.stringify({ eventType: 'BALL', pitchLocation: { zone: 0 } }))?.zone).to.equal(null);
    expect(parsePlatePlay(JSON.stringify({ eventType: 'BALL', pitchLocation: { zone: 18 } }))?.zone).to.equal(null);
  });

  it('uses looking to suppress the swing and falls back on handedness', () => {
    const play = parsePlatePlay(JSON.stringify({ eventType: 'STRIKE', strikeKind: 'looking', bats: 'X' }), 'L', 'L');
    expect(play?.swinging).to.equal(false);
    expect(play?.bats).to.equal('L');
    expect(play?.throws).to.equal('L');
  });

  it('builds plate scene classes for result and swing', () => {
    expect(plateSceneClass('IN PLAY', true, true)).to.equal('plate-scene result-IN-PLAY has-pitch swinging has-location animated');
    expect(plateSceneClass('', false, false)).to.equal('plate-scene has-location instant');
    expect(plateSceneClass('STRIKE', false, false, false)).to.equal('plate-scene result-STRIKE has-pitch no-location instant');
    expect(plateSceneClass('BALL', false, false, true, true)).to.equal('plate-scene result-BALL has-pitch has-location zone-interactive instant');
  });

  it('maps a click point to a zone cell', () => {
    expect(zoneFromPoint(0, 0, 34, 52)).to.equal(1);
    expect(zoneFromPoint(17, 26, 34, 52)).to.equal(5);
    expect(zoneFromPoint(33, 51, 34, 52)).to.equal(9);
    expect(zoneFromPoint(40, -5, 34, 52)).to.equal(3);
  });

  it('maps padding-box points near cell boundaries to the visual cell', () => {
    expect(zoneFromPoint(12, 9, 34, 52)).to.equal(2);
    expect(zoneFromPoint(23, 9, 34, 52)).to.equal(3);
    expect(zoneFromPoint(6, 18, 34, 52)).to.equal(4);
    expect(zoneFromPoint(17, 36, 34, 52)).to.equal(8);
  });

  it('ignores the zone border when mapping a click', () => {
    const box = { left: 10, top: 20 };
    expect(zoneFromClick(10 + 2 + 12, 20 + 2 + 9, box, 2, 2, 34, 52)).to.equal(2);
    expect(zoneFromClick(10 + 2 + 6, 20 + 2 + 18, box, 2, 2, 34, 52)).to.equal(4);
    expect(zoneFromClick(10 + 2 + 12, 20 + 2 + 9, box, 2, 2, 38, 56)).to.equal(1);
  });

  it('maps pitch zones to ball-flight offsets', () => {
    expect(zoneOffsets(null)).to.deep.equal({ dx: 0, dy: 129 });
    expect(zoneOffsets(1)).to.deep.equal({ dx: -11, dy: 112 });
    expect(zoneOffsets(5)).to.deep.equal({ dx: 0, dy: 129 });
    expect(zoneOffsets(9)).to.deep.equal({ dx: 11, dy: 146 });
  });

  it('maps outside zones past the strike zone edges', () => {
    expect(zoneOffsets(10)).to.deep.equal({ dx: 0, dy: 89 });
    expect(zoneOffsets(11)).to.deep.equal({ dx: 0, dy: 163 });
    expect(zoneOffsets(12)).to.deep.equal({ dx: -31, dy: 129 });
    expect(zoneOffsets(13)).to.deep.equal({ dx: 31, dy: 129 });
    expect(zoneOffsets(99)).to.deep.equal({ dx: 24, dy: 163 });
  });

  it('accepts safe team colors and rejects anything else', () => {
    expect(safeColor('#12ab34')).to.equal('#12ab34');
    expect(safeColor('#abc')).to.equal('#abc');
    expect(safeColor('rgb(10, 20, 30)')).to.equal('rgb(10, 20, 30)');
    expect(safeColor('rgba(1,2,3,0.5)')).to.equal('rgba(1,2,3,0.5)');
    expect(safeColor('hsl(200 50% 40%)')).to.equal('hsl(200 50% 40%)');
    expect(safeColor('hsl(200 50% 40% / 0.5)')).to.equal('hsl(200 50% 40% / 0.5)');
  });

  it('rejects malformed colors so a figure cannot lose its stroke', () => {
    expect(safeColor('#12345')).to.equal('#ffd95a');
    expect(safeColor('#1234567')).to.equal('#ffd95a');
    expect(safeColor('rgba(1,2,3,4,5)')).to.equal('#ffd95a');
    expect(safeColor('rgb()')).to.equal('#ffd95a');
    expect(safeColor('red; background: url(x)')).to.equal('#ffd95a');
    expect(safeColor('javascript:alert(1)')).to.equal('#ffd95a');
    expect(safeColor(undefined)).to.equal('#ffd95a');
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
