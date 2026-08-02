export type BattingHalf = 'TOP' | 'BOTTOM';

export type RunnersOnBase = [boolean, boolean, boolean];

export type ScoringEventType =
  | 'BALL'
  | 'STRIKE'
  | 'FOUL'
  | 'STRIKEOUT'
  | 'WALK'
  | 'HIT_BY_PITCH'
  | 'SINGLE'
  | 'DOUBLE'
  | 'TRIPLE'
  | 'HOME_RUN'
  | 'GROUNDOUT'
  | 'FLYOUT'
  | 'LINE_OUT'
  | 'POP_OUT'
  | 'SACRIFICE_FLY'
  | 'ERROR'
  | 'FIELDER_CHOICE';

export interface ScoringEvent {
  type: ScoringEventType;
  base?: number;
}

export interface EngineScorebookRow {
  slotIdx: number;
  batterName: string;
  position: string;
  atBats: number;
  runs: number;
  hits: number;
  rbi: number;
  walks: number;
  innings: Record<string, unknown>;
}

export interface EngineTeamLineup {
  name: string;
  rows: EngineScorebookRow[];
}

export interface EngineGameState {
  awayLineup: EngineTeamLineup;
  homeLineup: EngineTeamLineup;
  inning: number;
  half: BattingHalf;
  balls: number;
  strikes: number;
  outs: number;
  awayScore: number;
  homeScore: number;
  runners: RunnersOnBase;
  awayBatterIdx: number;
  homeBatterIdx: number;
  totalInnings: number;
  over: boolean;
}

export interface EngineInitOptions {
  homeName: string;
  awayName: string;
  homeLineup: Array<{ batterName: string; position: string }>;
  awayLineup: Array<{ batterName: string; position: string }>;
  totalInnings: number;
}

const OUT_EVENT_TYPES: ScoringEventType[] = ['GROUNDOUT', 'FLYOUT', 'LINE_OUT', 'POP_OUT', 'SACRIFICE_FLY', 'STRIKEOUT'];
const HIT_EVENT_TYPES: ScoringEventType[] = ['SINGLE', 'DOUBLE', 'TRIPLE', 'HOME_RUN'];

export function createGame(options: EngineInitOptions): EngineGameState {
  return {
    awayLineup: createTeamLineup(options.awayName, options.awayLineup),
    homeLineup: createTeamLineup(options.homeName, options.homeLineup),
    inning: 1,
    half: 'TOP',
    balls: 0,
    strikes: 0,
    outs: 0,
    awayScore: 0,
    homeScore: 0,
    runners: [false, false, false],
    awayBatterIdx: 0,
    homeBatterIdx: 0,
    totalInnings: options.totalInnings,
    over: false,
  };
}

function createTeamLineup(
  name: string,
  lineup: Array<{ batterName: string; position: string }>
): EngineTeamLineup {
  const rows = lineup.map((player, index) => ({
    slotIdx: index + 1,
    batterName: player.batterName,
    position: player.position,
    atBats: 0,
    runs: 0,
    hits: 0,
    rbi: 0,
    walks: 0,
    innings: {},
  }));
  return { name, rows };
}

export function reduceGame(game: EngineGameState, event: ScoringEvent): EngineGameState {
  if (game.over) return game;

  const lineup = battingLineup(game);
  if (lineup.rows.length === 0) return game;

  switch (event.type) {
    case 'BALL':
      return handleBall(game);
    case 'STRIKE':
    case 'FOUL':
      return handleStrike(game, event.type === 'FOUL');
    case 'STRIKEOUT':
      return handleStrikeout(game);
    case 'WALK':
    case 'HIT_BY_PITCH':
      return handleWalk(game);
    case 'SINGLE':
    case 'DOUBLE':
    case 'TRIPLE':
    case 'HOME_RUN':
      return handleHit(game, event.type);
    case 'GROUNDOUT':
    case 'FLYOUT':
    case 'LINE_OUT':
    case 'POP_OUT':
    case 'SACRIFICE_FLY':
      return handleInPlayOut(game, event.type);
    case 'ERROR':
    case 'FIELDER_CHOICE':
      return advancePlate(recordAtBat(resetCounts(game)));
  }

  return game;
}

function battingLineup(game: EngineGameState): EngineTeamLineup {
  return game.half === 'TOP' ? game.awayLineup : game.homeLineup;
}

function batterIndex(game: EngineGameState): number {
  return game.half === 'TOP' ? game.awayBatterIdx : game.homeBatterIdx;
}

function setBatterIndex(game: EngineGameState, value: number): EngineGameState {
  if (game.half === 'TOP') return { ...game, awayBatterIdx: value };
  return { ...game, homeBatterIdx: value };
}

function updateBatterStats(
  game: EngineGameState,
  update: (row: EngineScorebookRow) => EngineScorebookRow
): EngineGameState {
  const lineup = battingLineup(game);
  const rowIndex = batterIndex(game) % lineup.rows.length;
  const rows = lineup.rows.map((row, index) => (index === rowIndex ? update(row) : row));
  const updatedLineup = { ...lineup, rows };
  if (game.half === 'TOP') return { ...game, awayLineup: updatedLineup };
  return { ...game, homeLineup: updatedLineup };
}

function updateRunners(game: EngineGameState, runners: RunnersOnBase): EngineGameState {
  return { ...game, runners };
}

function handleBall(game: EngineGameState): EngineGameState {
  if (game.balls === 3) return handleWalk(game);
  return { ...game, balls: game.balls + 1 };
}

function handleStrike(game: EngineGameState, isFoul: boolean): EngineGameState {
  if (isFoul && game.strikes === 2) return game;
  if (game.strikes === 2) return handleStrikeout(game);
  return { ...game, strikes: game.strikes + 1 };
}

function handleStrikeout(game: EngineGameState): EngineGameState {
  return recordOut(advancePlate(recordAtBat(resetCounts(game))));
}

function handleWalk(game: EngineGameState): EngineGameState {
  const { runners, runsScored } = walkRunners(game.runners);
  const advanced = updateRunners(game, runners);
  const scored = addRuns(advanced, runsScored);
  const withStats = updateBatterStats(scored, (row) => ({
    ...row,
    atBats: row.atBats + 1,
    walks: row.walks + 1,
  }));
  return advancePlate(resetCounts(withStats));
}

function handleHit(game: EngineGameState, eventType: ScoringEventType): EngineGameState {
  const bases = hitBaseCount(eventType);
  const { runners, runsScored } = advanceRunners(game.runners, bases);
  const withBatter = updateRunners(game, placeBatter(runners, bases));
  const withRunnerRuns = addRuns(withBatter, runsScored);
  const withBatterRun = bases === 4 ? scoreRunForBatter(withRunnerRuns) : withRunnerRuns;
  const withStats = updateBatterStats(withBatterRun, (row) => ({
    ...row,
    atBats: row.atBats + 1,
    hits: row.hits + 1,
  }));
  return advancePlate(resetCounts(withStats));
}

function handleInPlayOut(game: EngineGameState, eventType: ScoringEventType): EngineGameState {
  const withAtBat = recordAtBat(resetCounts(game));
  if (eventType === 'SACRIFICE_FLY' || eventType === 'FLYOUT') {
    return recordOut(advancePlate(scoreRunnerFromThird(withAtBat)));
  }
  return recordOut(advancePlate(withAtBat));
}

function walkRunners(runners: RunnersOnBase): { runners: RunnersOnBase; runsScored: number } {
  const runsScored = runners[0] && runners[1] && runners[2] ? 1 : 0;
  const next: RunnersOnBase = [true, runners[0], runners[1]];
  return { runners: next, runsScored };
}

function advanceRunners(runners: RunnersOnBase, bases: number): { runners: RunnersOnBase; runsScored: number } {
  const next: RunnersOnBase = [false, false, false];
  let runsScored = 0;
  for (const occupiedBase of runnersOn(runners)) {
    const destination = occupiedBase + bases;
    if (destination > 3) {
      runsScored += 1;
    } else {
      next[destination - 1] = true;
    }
  }
  return { runners: next, runsScored };
}

function placeBatter(runners: RunnersOnBase, bases: number): RunnersOnBase {
  if (bases === 4) return runners;
  const next: RunnersOnBase = [...runners] as RunnersOnBase;
  next[bases - 1] = true;
  return next;
}

function runnersOn(runners: RunnersOnBase): number[] {
  return runners.reduce<number[]>((indexes, occupied, index) => {
    if (occupied) indexes.push(index + 1);
    return indexes;
  }, []);
}

function addRuns(game: EngineGameState, runsScored: number): EngineGameState {
  if (runsScored <= 0) return game;
  const withScore = setTeamScore(game, teamScore(game) + runsScored);
  return updateBatterStats(withScore, (row) => ({ ...row, rbi: row.rbi + runsScored }));
}

function scoreRunForBatter(game: EngineGameState): EngineGameState {
  const withScore = setTeamScore(game, teamScore(game) + 1);
  return updateBatterStats(withScore, (row) => ({ ...row, runs: row.runs + 1, rbi: row.rbi + 1 }));
}

function scoreRunnerFromThird(game: EngineGameState): EngineGameState {
  if (!game.runners[2]) return game;
  const advanced = updateRunners(game, [game.runners[0], game.runners[1], false]);
  return scoreRunForBatter(advanced);
}

function recordAtBat(game: EngineGameState): EngineGameState {
  return updateBatterStats(game, (row) => ({ ...row, atBats: row.atBats + 1 }));
}

function recordOut(game: EngineGameState): EngineGameState {
  if (game.outs === 2) return flipInning({ ...game, outs: 3 });
  return { ...game, outs: game.outs + 1 };
}

function resetCounts(game: EngineGameState): EngineGameState {
  return { ...game, balls: 0, strikes: 0 };
}

function advancePlate(game: EngineGameState): EngineGameState {
  const lineup = battingLineup(game);
  const nextIndex = (batterIndex(game) + 1) % lineup.rows.length;
  return setBatterIndex(game, nextIndex);
}

function flipInning(game: EngineGameState): EngineGameState {
  const flipped: EngineGameState = {
    ...game,
    outs: 0,
    runners: [false, false, false],
    balls: 0,
    strikes: 0,
    awayBatterIdx: 0,
    homeBatterIdx: 0,
    half: game.half === 'TOP' ? 'BOTTOM' : 'TOP',
    inning: game.half === 'BOTTOM' ? game.inning + 1 : game.inning,
  };
  if (isGameOverAfter(flipped)) return { ...flipped, over: true };
  return flipped;
}

function isGameOverAfter(game: EngineGameState): boolean {
  const finalInning = game.totalInnings;
  const homeLead = game.homeScore > game.awayScore;
  const homeBattingLast = game.half === 'BOTTOM';
  if (game.inning >= finalInning && homeBattingLast && homeLead) return true;
  if (game.inning > finalInning) return true;
  return false;
}

function teamScore(game: EngineGameState): number {
  return game.half === 'TOP' ? game.awayScore : game.homeScore;
}

function setTeamScore(game: EngineGameState, value: number): EngineGameState {
  if (game.half === 'TOP') return { ...game, awayScore: value };
  return { ...game, homeScore: value };
}

function hitBaseCount(eventType: ScoringEventType): number {
  switch (eventType) {
    case 'SINGLE':
      return 1;
    case 'DOUBLE':
      return 2;
    case 'TRIPLE':
      return 3;
    case 'HOME_RUN':
      return 4;
    default:
      return 0;
  }
}

export function isHitEventType(eventType: string): boolean {
  return HIT_EVENT_TYPES.includes(eventType as ScoringEventType);
}

export function isOutEventType(eventType: string): boolean {
  return OUT_EVENT_TYPES.includes(eventType as ScoringEventType);
}

export function isGameOver(game: EngineGameState): boolean {
  return game.over;
}

export function isBattingHalfTop(game: EngineGameState): boolean {
  return game.half === 'TOP';
}
