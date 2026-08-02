import React from 'react';

type CustomElementProps = React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'baseball-scoreboard': CustomElementProps & {
        'away-name'?: string;
        'home-name'?: string;
        'away-score'?: string | number;
        'home-score'?: string | number;
        'away-hits'?: string | number;
        'home-hits'?: string | number;
        'away-errors'?: string | number;
        'home-errors'?: string | number;
        'game-json'?: string;
        'box-score-json'?: string;
      };
      'baseball-scorebook-grid': CustomElementProps & {
        'team-name'?: string;
        'max-inning'?: string | number;
        'slots-json'?: string;
      };
      'baseball-defense-diagram': CustomElementProps;
      'baseball-matchup-card': CustomElementProps & {
        'batter-name'?: string;
        'batter-stats'?: string;
        'pitcher-name'?: string;
        'pitcher-stats'?: string;
      };
      'baseball-action-grid': CustomElementProps & {
        'current-pitch-type'?: string;
      };
      'baseball-step2-panel': CustomElementProps & {
        'base-label'?: string;
        'is-hit'?: string;
      };
      'baseball-scoring-controls': CustomElementProps & {
        'game-status'?: string;
        'away-name'?: string;
        'home-name'?: string;
        'away-score'?: string;
        'home-score'?: string;
        'batter-name'?: string;
        'batter-stats'?: string;
        'pitcher-name'?: string;
        'pitcher-stats'?: string;
        'panel-mode'?: string;
        'step2-label'?: string;
        'step2-is-hit'?: string;
      };
      'baseball-scorer-tab': CustomElementProps & {
        'away-name'?: string;
        'home-name'?: string;
        'no-game'?: string;
      };
      'baseball-lineup-setup': CustomElementProps & {
        'home-team-name'?: string;
        'away-team-name'?: string;
        'is-open'?: string;
        'home-lineup-json'?: string;
        'away-lineup-json'?: string;
        'home-bench-json'?: string;
        'away-bench-json'?: string;
      };
      'baseball-tab-page-wrapper': CustomElementProps & {
        'page-title'?: string;
        'loading-message'?: string;
        'empty-message'?: string;
      };
    }
  }
}

export {};
