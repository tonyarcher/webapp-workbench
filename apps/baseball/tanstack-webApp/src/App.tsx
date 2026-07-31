import React, { useEffect, useRef, useState } from 'react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import '@baseball/web-components/dist/web-components.js';
import { api } from './api';
import {
  type Article,
  isChromeAiAvailable,
  predictRecommendedArticles,
  sampleArticles,
} from './chrome-ai';
import {
  loadAppState,
  requestPersistentStorage,
  saveAppState,
} from './storage-persistence';

const queryClient = new QueryClient();

// Seed data for local single game mode
const defaultGame = {
  id: 1,
  awayTeam: { id: 2, name: 'St. Louis Cardinals' },
  homeTeam: { id: 1, name: 'Chicago Cubs' },
  awayScore: 0,
  homeScore: 0,
  status: 'IN_PROGRESS',
  gameState: {
    inning: 1,
    half: 'TOP',
    balls: 0,
    strikes: 0,
    outs: 0,
    currentBatterName: 'Nico Hoerner',
    currentPitcherName: 'Sonny Gray',
  },
};

const defaultBoxScore = {
  awayInnings: [0, 0, 0, 0, 0, 0, 0, 0, 0],
  homeInnings: [0, 0, 0, 0, 0, 0, 0, 0, 0],
  awayRuns: 0,
  awayHits: 0,
  awayErrors: 0,
  homeRuns: 0,
  homeHits: 0,
  homeErrors: 0,
};

export function AppContent() {
  const initialSaved = loadAppState();

  const [currentTab, setCurrentTab] = useState(initialSaved?.currentTab || 'leagues');
  const [selectedSeasonId] = useState<number | null>(null);
  const [selectedTeamId] = useState<number | null>(null);
  const [isWelcomeScreen, setIsWelcomeScreen] = useState(initialSaved ? false : true);
  const [isSingleGameMode, setIsSingleGameMode] = useState(initialSaved?.isSingleGameMode || false);
  const [hasActiveGame, setHasActiveGame] = useState(initialSaved?.hasActiveGame || false);
  const [userName, setUserName] = useState(initialSaved?.userName || '');

  const navRef = useRef<HTMLElement>(null);
  const welcomeRef = useRef<HTMLElement>(null);
  const authRef = useRef<HTMLElement>(null);
  const scorerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    requestPersistentStorage();
  }, []);

  useEffect(() => {
    saveAppState({
      currentTab,
      isSingleGameMode,
      hasActiveGame,
      userName,
    });
  }, [currentTab, isSingleGameMode, hasActiveGame, userName]);

  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const handleTabSelected = (e: any) => {
      const tab = e.detail?.tabId || e.target?.getAttribute('active-tab');
      if (tab === 'welcome') {
        setIsWelcomeScreen(true);
        setIsSingleGameMode(false);
      } else if (tab === 'leagues' && isSingleGameMode) {
        setIsWelcomeScreen(false);
        setIsSingleGameMode(false);
        setCurrentTab('leagues');
      } else if (tab) {
        setCurrentTab(tab);
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    nav.addEventListener('tab-selected', handleTabSelected);
    return () => nav.removeEventListener('tab-selected', handleTabSelected);
  }, [currentTab, isWelcomeScreen, isSingleGameMode]);

  useEffect(() => {
    const welcome = welcomeRef.current;
    if (!welcome) return;
    const handleModeSelected = (e: any) => {
      setIsWelcomeScreen(false);
      const mode = e.detail?.mode || e.target?.getAttribute('selected-mode');
      if (mode === 'single') {
        setIsSingleGameMode(true);
        setHasActiveGame(true);
        setCurrentTab('live-scorer');
      } else {
        setIsSingleGameMode(false);
        setCurrentTab('leagues');
      }
    };
    welcome.addEventListener('mode-selected', handleModeSelected);
    return () => welcome.removeEventListener('mode-selected', handleModeSelected);
  }, [isWelcomeScreen]);

  useEffect(() => {
    const scorer = scorerRef.current;
    if (!scorer) return;
    const handleStartNewGame = () => {
      setHasActiveGame(true);
    };
    scorer.addEventListener('start-new-game-click', handleStartNewGame);
    return () => scorer.removeEventListener('start-new-game-click', handleStartNewGame);
  }, [currentTab, hasActiveGame]);

  useEffect(() => {
    const auth = authRef.current;
    if (!auth) return;
    const handleAuthSubmit = (e: any) => {
      const username = e.detail?.username || e.target?.getAttribute('username');
      if (username) setUserName(username);
      setIsWelcomeScreen(false);
    };
    const handleAuthLogout = () => {
      setUserName('');
      setIsWelcomeScreen(true);
    };
    auth.addEventListener('auth-submit', handleAuthSubmit);
    auth.addEventListener('auth-logout', handleAuthLogout);
    return () => {
      auth.removeEventListener('auth-submit', handleAuthSubmit);
      auth.removeEventListener('auth-logout', handleAuthLogout);
    };
  }, [currentTab]);

  return (
    <div className="app-shell">
      {isWelcomeScreen ? (
        <baseball-welcome-screen
          ref={welcomeRef}
          server-online="true"
        />
      ) : (
        <React.Fragment>
          <baseball-nav-bar
            ref={navRef}
            active-tab={currentTab}
            user-name={userName}
            is-single-game-mode={isSingleGameMode ? 'true' : 'false'}
          />
          <main id="content-area" className="padding-lg">
            {currentTab === 'leagues' && <LeaguesTab />}
            {currentTab === 'teams' && <TeamsTab selectedTeamId={selectedTeamId} />}
            {currentTab === 'dashboard' && <DashboardTab selectedSeasonId={selectedSeasonId} />}
            {currentTab === 'stats' && <StatsTab selectedSeasonId={selectedSeasonId} />}
            {currentTab === 'ai-insights' && <AiInsightsTab />}
            {currentTab === 'login' && <baseball-auth-card ref={authRef} logged-in-user={userName} />}
            {currentTab === 'register' && <baseball-auth-card ref={authRef} is-sign-up="true" logged-in-user={userName} />}
            {currentTab === 'live-scorer' && (
              <LiveScorerView
                ref={scorerRef}
                hasActiveGame={hasActiveGame}
                onStartGame={() => setHasActiveGame(true)}
              />
            )}
            {currentTab === 'boxscore' && (
              <baseball-tab-page-wrapper page-title="Box Score">
                <baseball-scoreboard
                  game-json={JSON.stringify(defaultGame)}
                  box-score-json={JSON.stringify(defaultBoxScore)}
                />
              </baseball-tab-page-wrapper>
            )}
          </main>
        </React.Fragment>
      )}
    </div>
  );
}

const LiveScorerView = React.forwardRef(({ hasActiveGame }: any, ref: any) => {
  if (!hasActiveGame) {
    return (
      <baseball-scorer-tab
        ref={ref}
        no-game="true"
      />
    );
  }

  return (
    <baseball-scorer-tab
      ref={ref}
      away-name="St. Louis Cardinals"
      home-name="Chicago Cubs"
    >
      <div slot="scoreboard">
        <baseball-scoreboard
          game-json={JSON.stringify(defaultGame)}
          box-score-json={JSON.stringify(defaultBoxScore)}
        />
      </div>
      <div slot="controls">
        <baseball-scoring-controls game-status="active" batter-name="Nico Hoerner" pitcher-name="Sonny Gray" />
      </div>
      <div slot="scorebook">
        <baseball-scorebook-grid
          team-name="Chicago Cubs"
          pitcher-opponent="Sonny Gray"
          half-tag="TOP"
          max-inning="9"
          slots-json={JSON.stringify([
            {
              slotIdx: 1,
              batterName: 'Nico Hoerner',
              position: '2B',
              atBats: 0,
              runs: 0,
              hits: 0,
              rbi: 0,
              innings: {}
            },
            {
              slotIdx: 2,
              batterName: 'Dansby Swanson',
              position: 'SS',
              atBats: 0,
              runs: 0,
              hits: 0,
              rbi: 0,
              innings: {}
            },
            {
              slotIdx: 3,
              batterName: 'Ian Happ',
              position: 'LF',
              atBats: 0,
              runs: 0,
              hits: 0,
              rbi: 0,
              innings: {}
            }
          ])}
        />
      </div>
    </baseball-scorer-tab>
  );
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  );
}

function LeaguesTab({ onSelectLeague }: { onSelectLeague?: (id: number) => void }) {
  const { data: leagues, isLoading, error } = useQuery({
    queryKey: ['leagues'],
    queryFn: () => api.getLeagues(),
  });

  const leaguesRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = leaguesRef.current;
    if (!el) return;
    const handleLeagueClick = (e: any) => {
      const id = e.detail?.leagueId;
      if (id && onSelectLeague) onSelectLeague(id);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    el.addEventListener('league-click', handleLeagueClick);
    return () => el.removeEventListener('league-click', handleLeagueClick);
  }, [onSelectLeague]);

  if (isLoading) return <baseball-tab-page-wrapper loading-message="Loading Leagues..." />;
  if (error) return <baseball-tab-page-wrapper empty-message={(error as Error).message} />;

  return (
    <baseball-leagues-tab
      ref={leaguesRef}
      leagues-json={JSON.stringify(leagues || [])}
    />
  );
}

function TeamsTab({ selectedTeamId }: { selectedTeamId: number | null }) {
  const { data: teams } = useQuery({
    queryKey: ['teams'],
    queryFn: () => api.getTeams(),
  });

  const tId = selectedTeamId || teams?.[0]?.id;

  const { data: roster, isLoading } = useQuery({
    queryKey: ['roster', tId],
    queryFn: () => (tId ? api.getTeamRoster(tId) : Promise.resolve([])),
    enabled: !!tId,
  });

  if (isLoading) return <baseball-tab-page-wrapper loading-message="Loading Roster..." />;

  return (
    <baseball-tab-page-wrapper page-title="Team Rosters">
      <baseball-roster-table players-json={JSON.stringify(roster || [])} />
    </baseball-tab-page-wrapper>
  );
}

function DashboardTab({ selectedSeasonId }: { selectedSeasonId: number | null }) {
  const { data: dash, isLoading, error } = useQuery({
    queryKey: ['dashboard', selectedSeasonId],
    queryFn: () => (selectedSeasonId ? api.getSeasonDashboard(selectedSeasonId) : Promise.resolve(null)),
    enabled: !!selectedSeasonId,
  });

  if (!selectedSeasonId) return <baseball-dashboard-tab no-season="true" />;
  if (isLoading) return <baseball-tab-page-wrapper loading-message="Loading Dashboard..." />;
  if (error) return <baseball-dashboard-tab error-message={(error as Error).message} />;

  return (
    <baseball-dashboard-tab
      standings-json={JSON.stringify(dash?.standings || [])}
      schedule-json={JSON.stringify(dash?.games || [])}
    />
  );
}

function StatsTab({ selectedSeasonId }: { selectedSeasonId: number | null }) {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['stats', selectedSeasonId],
    queryFn: () => (selectedSeasonId ? api.getSeasonStats(selectedSeasonId) : Promise.resolve({ battingStats: [] })),
    enabled: !!selectedSeasonId,
  });

  if (!selectedSeasonId) {
    return (
      <baseball-tab-page-wrapper page-title="Season Player Statistics" empty-message="No season selected." />
    );
  }

  if (isLoading) return <baseball-tab-page-wrapper loading-message="Loading Stats..." />;

  return (
    <baseball-tab-page-wrapper page-title="Season Player Statistics">
      <baseball-stats-table rows-json={JSON.stringify(stats?.battingStats || [])} />
    </baseball-tab-page-wrapper>
  );
}

function AiInsightsTab() {
  const [articles, setArticles] = useState<Article[]>(sampleArticles);
  const [aiStatus, setAiStatus] = useState<string>('Checking Chrome Built-in AI...');
  const [aiReasoning, setAiReasoning] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [viewType, setViewType] = useState<'detailed' | 'headline'>('detailed');

  useEffect(() => {
    isChromeAiAvailable().then((available) => {
      setAiStatus(
        available
          ? '🟢 Chrome Built-in AI (Prompt API / Gemini Nano) Ready'
          : '🟡 Chrome Built-in AI not detected (using Heuristic Fallback engine)'
      );
    });
  }, []);

  const toggleStar = (id: number) => {
    setArticles((prev) =>
      prev.map((a) => (a.id === id ? { ...a, isStarred: !a.isStarred } : a))
    );
  };

  const handlePredict = async () => {
    setIsAnalyzing(true);
    const starred = articles.filter((a) => a.isStarred);
    const { aiReasoning } = await predictRecommendedArticles(starred, articles);
    setAiReasoning(aiReasoning);
    setIsAnalyzing(false);
  };

  const starredCount = articles.filter((a) => a.isStarred).length;

  return (
    <baseball-tab-page-wrapper page-title="🤖 Chrome Built-in AI — Article Predictor">
      <div className="card padding-lg margin-bottom-lg" style={{ background: 'rgba(22, 26, 36, 0.8)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
          <span style={{ fontSize: '0.9rem', color: '#8e9cae', fontWeight: 600 }}>{aiStatus}</span>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <label style={{ fontSize: '0.85rem', color: '#8e9cae', fontWeight: 600 }}>View Mode:</label>
            <select
              value={viewType}
              onChange={(e) => setViewType(e.target.value as 'detailed' | 'headline')}
              className="btn btn-secondary"
              style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
            >
              <option value="detailed">Detailed List</option>
              <option value="headline">Headline View</option>
            </select>
            <button
              className="btn btn-primary"
              onClick={handlePredict}
              disabled={isAnalyzing}
            >
              {isAnalyzing ? 'Analyzing via Chrome AI...' : `Predict Recommendations (${starredCount} Starred)`}
            </button>
          </div>
        </div>
        <p style={{ color: '#8e9cae', fontSize: '0.95rem' }}>
          Star articles below based on your interests. Click <strong>Predict Recommendations</strong> to invoke Chrome's built-in Gemini Nano model (`window.ai.languageModel`) to analyze liked article characteristics and rank unread articles!
        </p>
      </div>

      {aiReasoning && (
        <div className="card padding-lg margin-bottom-lg" style={{ border: '1px solid var(--accent-green, #00b050)' }}>
          <h3 style={{ color: 'var(--accent-green-glow, #00e676)', marginBottom: '0.5rem' }}>
            🤖 AI Prediction & Recommendation Analysis:
          </h3>
          <pre style={{ whiteSpace: 'pre-wrap', color: '#f5f7fa', fontFamily: 'inherit', fontSize: '0.95rem' }}>
            {aiReasoning}
          </pre>
        </div>
      )}

      {viewType === 'headline' ? (
        <div className="card padding-lg" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {articles.map((art) => (
            <div
              key={art.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0.75rem 1rem',
                background: 'rgba(255, 255, 255, 0.03)',
                borderRadius: '8px',
                borderLeft: art.isStarred ? '4px solid var(--accent-yellow, #ffcc00)' : '4px solid transparent',
              }}
            >
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--accent-green, #00b050)', fontWeight: 700, width: '90px' }}>
                  [{art.category}]
                </span>
                <span style={{ fontSize: '1rem', fontWeight: 600, color: '#ffffff' }}>{art.title}</span>
              </div>
              <button
                className="btn btn-secondary"
                onClick={() => toggleStar(art.id)}
                style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem' }}
              >
                {art.isStarred ? '⭐ Starred' : '☆ Star'}
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="action-grid-2col">
          {articles.map((art) => (
            <div
              key={art.id}
              className="card"
              style={{
                borderColor: art.isStarred ? 'var(--accent-yellow, #ffcc00)' : 'var(--border-color)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <span
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    color: 'var(--accent-green, #00b050)',
                    textTransform: 'uppercase',
                  }}
                >
                  {art.category}
                </span>
                <button
                  className="btn btn-secondary"
                  onClick={() => toggleStar(art.id)}
                  style={{ padding: '0.25rem 0.6rem', fontSize: '0.9rem' }}
                >
                  {art.isStarred ? '⭐ Starred' : '☆ Star'}
                </button>
              </div>
              <h3 style={{ fontSize: '1.1rem', margin: '0.5rem 0', color: '#ffffff' }}>{art.title}</h3>
              <p style={{ color: '#8e9cae', fontSize: '0.9rem', marginBottom: '1rem' }}>{art.summary}</p>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {art.tags.map((tag) => (
                  <span
                    key={tag}
                    style={{
                      background: 'rgba(255, 255, 255, 0.08)',
                      borderRadius: '4px',
                      padding: '0.2rem 0.5rem',
                      fontSize: '0.75rem',
                      color: '#f5f7fa',
                    }}
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </baseball-tab-page-wrapper>
  );
}

export default App;
