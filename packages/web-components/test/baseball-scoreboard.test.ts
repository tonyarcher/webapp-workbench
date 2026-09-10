import { expect } from '@esm-bundle/chai';
import '../src/scoreboard/baseball-scoreboard.ts';
import { BaseballScoreboard } from '../src/scoreboard/baseball-scoreboard.ts';

function clickZonePadding(zoneEl: HTMLElement, padX: number, padY: number) {
  const rect = zoneEl.getBoundingClientRect();
  const style = getComputedStyle(zoneEl);
  zoneEl.dispatchEvent(new MouseEvent('click', {
    bubbles: true,
    clientX: rect.left + parseFloat(style.borderLeftWidth) + padX,
    clientY: rect.top + parseFloat(style.borderTopWidth) + padY,
  }));
}

describe('BaseballScoreboard', () => {
  let element: BaseballScoreboard;

  beforeEach(async () => {
    element = document.createElement('baseball-scoreboard') as BaseballScoreboard;
    document.body.appendChild(element);
    await element.updateComplete;
  });

  afterEach(() => {
    element.remove();
  });

  it('renders default properties correctly', () => {
    expect(element.awayName).to.equal('AWAY');
    expect(element.homeName).to.equal('HOME');
    expect(element.awayScore).to.equal(0);
    expect(element.homeScore).to.equal(0);
  });

  it('updates when properties change', async () => {
    element.awayName = 'Cubs';
    element.homeName = 'Cardinals';
    element.awayScore = 5;
    element.homeScore = 3;
    element.inning = 7;
    element.half = 'BOT';
    element.balls = 3;
    element.strikes = 2;
    element.outs = 2;
    element.runnerFirst = true;
    element.runnerFirstName = 'John Doe';

    await element.updateComplete;

    const shadow = element.shadowRoot!;
    expect(shadow.textContent).to.include('Cubs');
    expect(shadow.textContent).to.include('Cardinals');
    expect(shadow.textContent).to.include('▼ Inning 7');
    expect(shadow.textContent).to.include('Count: 3 - 2');
    expect(shadow.textContent).to.include('2 Outs');
    expect(shadow.textContent).to.include('1B: John Doe');
  });

  it('parses game-json and box-score-json attributes', async () => {
    const game = {
      awayTeam: { name: 'Red Sox' },
      homeTeam: { name: 'Yankees' },
      awayScore: 4,
      homeScore: 2,
      gameState: {
        inning: 9,
        half: 'TOP',
        balls: 1,
        strikes: 2,
        outs: 2,
        runnerFirstId: 101,
        runnerFirstName: 'Speedy Runner',
        runnerSecondId: 102,
        runnerSecondName: 'Lead Runner',
        runnerThirdId: 103,
        runnerThirdName: 'Third Runner',
      }
    };
    const boxScore = {
      lineScore: {
        awayHits: 8,
        homeHits: 5,
        awayErrors: 0,
        homeErrors: 1
      }
    };

    element.setAttribute('game-json', JSON.stringify(game));
    element.setAttribute('box-score-json', JSON.stringify(boxScore));
    await element.updateComplete;

    const shadow = element.shadowRoot!;
    expect(shadow.textContent).to.include('Red Sox');
    expect(shadow.textContent).to.include('Yankees');
    expect(shadow.textContent).to.include('▲ Inning 9');
    expect(shadow.textContent).to.include('R-H-E: 4-8-0 vs 2-5-1');
    expect(shadow.textContent).to.include('1B: Speedy Runner');
    expect(shadow.textContent).to.include('2B: Lead Runner');
    expect(shadow.textContent).to.include('3B: Third Runner');
  });

  it('renders the last play banner from game-json', async () => {
    const game = {
      gameState: {
        lastPlay: 'SINGLE · Right Field',
      }
    };

    element.setAttribute('game-json', JSON.stringify(game));
    await element.updateComplete;

    const shadow = element.shadowRoot!;
    expect(shadow.textContent).to.include('SINGLE · Right Field');
  });

  it('renders the last play banner from the last-play attribute', async () => {
    element.lastPlay = 'GROUNDOUT · DOUBLE PLAY';
    await element.updateComplete;

    expect(element.shadowRoot!.textContent).to.include('GROUNDOUT · DOUBLE PLAY');
  });

  it('marks last play as live when sim-playing is true', async () => {
    element.setAttribute('sim-playing', 'true');
    await element.updateComplete;
    const lastPlay = element.shadowRoot!.querySelector('[data-testid="last-play"]') as HTMLElement;
    expect(lastPlay.classList.contains('sim-live')).to.equal(true);
  });

  it('renders left-handed pitcher and batter with the result in the zone', async () => {
    element.setAttribute('game-json', JSON.stringify({
      gameState: { currentBatterName: 'Ruth', currentPitcherName: 'Grove', batterBats: 'L', pitcherThrows: 'L' },
    }));
    element.setAttribute('active-play-json', JSON.stringify({ eventType: 'STRIKE', bats: 'L', throws: 'L' }));
    element.setAttribute('play-seq', '1');
    await element.updateComplete;

    const scene = element.shadowRoot!.querySelector('[data-testid="plate-view"]') as HTMLElement;
    expect(scene.getAttribute('data-bats')).to.equal('L');
    expect(scene.getAttribute('data-throws')).to.equal('L');
    expect(element.shadowRoot!.querySelector('[data-testid="plate-pitcher"]')!.classList.contains('throws-L')).to.equal(true);
    expect(element.shadowRoot!.querySelector('[data-testid="plate-batter"]')!.classList.contains('bats-L')).to.equal(true);
    expect(element.shadowRoot!.querySelector('.mound')).to.not.equal(null);
    expect(element.shadowRoot!.querySelector('.box-left')).to.not.equal(null);
    expect(element.shadowRoot!.querySelector('[data-testid="pitch-ball"]')).to.not.equal(null);
    expect(element.shadowRoot!.querySelectorAll('.pitcher .arm').length).to.equal(4);
    expect(element.shadowRoot!.querySelector('[data-testid="plate-result"]')!.textContent).to.equal('STRIKE');
    expect(scene.textContent).to.include('LHP Grove');
    expect(scene.textContent).to.include('LHB Ruth');
  });

  it('shows the glove and throwing arm for a left-handed pitcher', async () => {
    element.setAttribute('game-json', JSON.stringify({
      gameState: { pitcherThrows: 'L', batterBats: 'R' },
    }));
    await element.updateComplete;

    const pitcher = element.shadowRoot!.querySelector('[data-testid="plate-pitcher"]') as HTMLElement;
    const glove = pitcher.querySelector('.glove-arm.side-left') as HTMLElement;
    const pitch = pitcher.querySelector('.pitch-arm.side-right') as HTMLElement;
    const otherGlove = pitcher.querySelector('.glove-arm.side-right') as HTMLElement;
    const otherPitch = pitcher.querySelector('.pitch-arm.side-left') as HTMLElement;
    expect(getComputedStyle(glove).display).to.equal('block');
    expect(getComputedStyle(pitch).display).to.equal('block');
    expect(getComputedStyle(otherGlove).display).to.equal('none');
    expect(getComputedStyle(otherPitch).display).to.equal('none');
  });

  it('shows the glove and throwing arm for a right-handed pitcher', async () => {
    element.setAttribute('game-json', JSON.stringify({
      gameState: { pitcherThrows: 'R', batterBats: 'L' },
    }));
    await element.updateComplete;

    const pitcher = element.shadowRoot!.querySelector('[data-testid="plate-pitcher"]') as HTMLElement;
    expect(getComputedStyle(pitcher.querySelector('.glove-arm.side-right') as HTMLElement).display).to.equal('block');
    expect(getComputedStyle(pitcher.querySelector('.pitch-arm.side-left') as HTMLElement).display).to.equal('block');
    expect(getComputedStyle(pitcher.querySelector('.glove-arm.side-left') as HTMLElement).display).to.equal('none');
    expect(getComputedStyle(pitcher.querySelector('.pitch-arm.side-right') as HTMLElement).display).to.equal('none');
  });

  it('mirrors the left-handed batter but keeps the jersey number readable', async () => {
    element.setAttribute('game-json', JSON.stringify({
      gameState: { batterBats: 'L', pitcherThrows: 'R' },
    }));
    await element.updateComplete;

    const batter = element.shadowRoot!.querySelector('[data-testid="plate-batter"]') as HTMLElement;
    const svg = batter.querySelector('.wire-sign') as SVGElement;
    const number = batter.querySelector('.jersey-num') as SVGElement;
    expect(getComputedStyle(svg).transform).to.equal('matrix(-1, 0, 0, 1, 0, 0)');
    expect(getComputedStyle(number).transform).to.equal('matrix(-1, 0, 0, 1, 0, 0)');
  });

  it('tints the batter and pitcher with their team colors', async () => {
    element.setAttribute('game-json', JSON.stringify({
      awayTeam: { name: 'Away', primaryColor: '#ff0000' },
      homeTeam: { name: 'Home', primaryColor: '#00ff00' },
      gameState: { half: 'TOP', batterBats: 'R', pitcherThrows: 'R' },
    }));
    await element.updateComplete;

    const batter = element.shadowRoot!.querySelector('[data-testid="plate-batter"]') as HTMLElement;
    const pitcher = element.shadowRoot!.querySelector('[data-testid="plate-pitcher"]') as HTMLElement;
    expect(batter.getAttribute('style')).to.include('#ff0000');
    expect(pitcher.getAttribute('style')).to.include('#00ff00');
  });

  it('swaps the team colors when the home team bats', async () => {
    element.setAttribute('game-json', JSON.stringify({
      awayTeam: { name: 'Away', primaryColor: '#ff0000' },
      homeTeam: { name: 'Home', primaryColor: '#00ff00' },
      gameState: { half: 'BOTTOM', batterBats: 'R', pitcherThrows: 'R' },
    }));
    await element.updateComplete;

    const batter = element.shadowRoot!.querySelector('[data-testid="plate-batter"]') as HTMLElement;
    const pitcher = element.shadowRoot!.querySelector('[data-testid="plate-pitcher"]') as HTMLElement;
    expect(batter.getAttribute('style')).to.include('#00ff00');
    expect(pitcher.getAttribute('style')).to.include('#ff0000');
  });

  it('arms a pitch location when the zone is clicked', async () => {
    element.setAttribute('interactive', 'true');
    await element.updateComplete;
    let zone: number | null | undefined;
    element.addEventListener('pitch-location-selected', (event) => {
      zone = (event as CustomEvent).detail.zone;
    });
    const zoneEl = element.shadowRoot!.querySelector('.zone') as HTMLElement;
    clickZonePadding(zoneEl, zoneEl.clientWidth / 2, zoneEl.clientHeight / 2);
    expect(zone).to.equal(5);
  });

  it('arms the visual cell for clicks near a grid line', async () => {
    element.setAttribute('interactive', 'true');
    await element.updateComplete;
    let zone: number | null | undefined;
    element.addEventListener('pitch-location-selected', (event) => {
      zone = (event as CustomEvent).detail.zone;
    });
    const zoneEl = element.shadowRoot!.querySelector('.zone') as HTMLElement;
    clickZonePadding(zoneEl, 12, 9);
    expect(zone).to.equal(2);
    clickZonePadding(zoneEl, 6, 18);
    expect(zone).to.equal(4);
  });

  it('sits the plate and boxes on a ground plane', async () => {
    const root = element.shadowRoot!;
    expect(root.querySelector('.ground')).to.not.equal(null);
    expect(root.querySelector('.home-plate')).to.not.equal(null);
    expect(root.querySelectorAll('.batters-box').length).to.equal(2);
  });

  it('marks the armed location', async () => {
    element.setAttribute('armed-location', '7');
    await element.updateComplete;
    expect(element.shadowRoot!.querySelector('[data-testid="zone-pick"]')).to.not.equal(null);
  });

  it('flies the ball only when a pitch location is set', async () => {
    element.setAttribute('play-seq', '1');
    element.setAttribute('play-duration-ms', '4000');
    element.setAttribute('active-play-json', JSON.stringify({ eventType: 'STRIKE', strikeKind: 'looking', bats: 'R', throws: 'R' }));
    await element.updateComplete;
    const unknown = element.shadowRoot!.querySelector('[data-testid="plate-view"]') as HTMLElement;
    expect(unknown.classList.contains('no-location')).to.equal(true);

    element.setAttribute('active-play-json', JSON.stringify({
      eventType: 'STRIKE', strikeKind: 'looking', bats: 'R', throws: 'R', pitchLocation: { zone: 3 },
    }));
    element.setAttribute('play-seq', '2');
    await element.updateComplete;
    const known = element.shadowRoot!.querySelector('[data-testid="plate-view"]') as HTMLElement;
    expect(known.classList.contains('has-location')).to.equal(true);
  });

  it('writes in play in the zone for a hit', async () => {
    element.setAttribute('active-play-json', JSON.stringify({ eventType: 'DOUBLE', bats: 'R', throws: 'R' }));
    await element.updateComplete;
    expect(element.shadowRoot!.querySelector('[data-testid="plate-result"]')!.textContent).to.equal('IN PLAY');
  });
});
