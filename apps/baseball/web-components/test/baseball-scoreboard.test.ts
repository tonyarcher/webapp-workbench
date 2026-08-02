import { expect } from '@esm-bundle/chai';
import '../src/scoreboard/baseball-scoreboard.ts';
import { BaseballScoreboard } from '../src/scoreboard/baseball-scoreboard.ts';

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
});
