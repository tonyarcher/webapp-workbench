export type Handedness = 'L' | 'R';

export const PITCH_TYPES = ['Fastball', 'Curveball', 'Slider', 'Changeup', 'Sinker', 'Cutter'] as const;

export type PitchType = (typeof PITCH_TYPES)[number];

export interface PlayerRatings {
  contact: number;
  power: number;
  discipline: number;
  speed: number;
  bunt: number;
}

export interface PitcherRatings {
  control: number;
  stuff: number;
  gbTendency: number;
  arsenal: PitchType[];
}

export interface SimPlayer {
  batterName: string;
  position: string;
  jerseyNumber: number;
  bats: Handedness;
  throws: Handedness;
  ratings: PlayerRatings;
}

export interface SimPitcher {
  name: string;
  throws: Handedness;
  ratings: PitcherRatings;
}

export interface SimRoster {
  teamName: string;
  lineup: SimPlayer[];
  pitcher: SimPitcher;
}

export interface SimMatchup {
  batter: SimPlayer;
  pitcher: SimPitcher;
  offense: SimRoster;
  defense: SimRoster;
}

export interface PitchLocation {
  zone: number;
}

export interface ResolvedPlay {
  type: string;
  detail: Record<string, unknown>;
}
