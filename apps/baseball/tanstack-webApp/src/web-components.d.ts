import React from 'react';

type CustomElementProps = React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'baseball-nav-bar': CustomElementProps & {
        'active-tab'?: string;
        'user-name'?: string;
      };
      'baseball-welcome-screen': CustomElementProps & {
        'server-online'?: string;
        'selected-mode'?: string;
      };
      'baseball-auth-card': CustomElementProps & {
        'is-sign-up'?: string;
        'logged-in-user'?: string;
        'error-message'?: string;
      };
      'baseball-dashboard-tab': CustomElementProps & {
        'standings-json'?: string;
        'schedule-json'?: string;
        'error-message'?: string;
        'no-season'?: string;
      };
      'baseball-leagues-tab': CustomElementProps & {
        'leagues-json'?: string;
      };
      'baseball-league-card': CustomElementProps & {
        'league-name'?: string;
        'league-details'?: string;
      };
      'baseball-roster-table': CustomElementProps & {
        'team-name'?: string;
        'players-json'?: string;
      };
      'baseball-stats-table': CustomElementProps & {
        'title'?: string;
        'rows-json'?: string;
      };
      'baseball-scoreboard': CustomElementProps & {
        'game-json'?: string;
        'box-score-json'?: string;
      };
      'baseball-scorer-tab': CustomElementProps & {
        'away-name'?: string;
        'home-name'?: string;
        'no-game'?: string;
      };
      'baseball-scoring-controls': CustomElementProps & {
        'game-status'?: string;
      };
      'baseball-step2-panel': CustomElementProps & {
        'base-label'?: string;
        'is-hit'?: string;
      };
      'baseball-action-grid': CustomElementProps;
      'baseball-matchup-card': CustomElementProps;
      'baseball-tab-page-wrapper': CustomElementProps & {
        'page-title'?: string;
        'loading-message'?: string;
        'empty-message'?: string;
      };
      'baseball-standings-table': CustomElementProps & {
        'standings-json'?: string;
      };
      'baseball-schedule-list': CustomElementProps & {
        'games-json'?: string;
      };
      'baseball-scorebook-grid': CustomElementProps;
      'baseball-defense-diagram': CustomElementProps;
    }
  }
}

export {};
