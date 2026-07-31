import React, { useEffect, useRef, useState } from 'react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import '@baseball/web-components/dist/web-components.js';
import { api } from './api';

const queryClient = new QueryClient();

export function AppContent() {
  const [currentTab, setCurrentTab] = useState('leagues');
  const [selectedSeasonId] = useState<number | null>(null);
  const [selectedTeamId] = useState<number | null>(null);
  const [isWelcomeScreen, setIsWelcomeScreen] = useState(true);
  const [userName, setUserName] = useState('');

  const navRef = useRef<HTMLElement>(null);
  const welcomeRef = useRef<HTMLElement>(null);
  const authRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const handleTabSelected = (e: any) => {
      const tab = e.detail?.tabId || e.target?.getAttribute('active-tab');
      if (tab) setCurrentTab(tab);
    };
    nav.addEventListener('tab-selected', handleTabSelected);
    return () => nav.removeEventListener('tab-selected', handleTabSelected);
  }, [currentTab, isWelcomeScreen]);

  useEffect(() => {
    const welcome = welcomeRef.current;
    if (!welcome) return;
    const handleModeSelected = (e: any) => {
      setIsWelcomeScreen(false);
      const mode = e.detail?.mode || e.target?.getAttribute('selected-mode');
      if (mode === 'single') {
        setCurrentTab('live-scorer');
      } else {
        setCurrentTab('leagues');
      }
    };
    welcome.addEventListener('mode-selected', handleModeSelected);
    return () => welcome.removeEventListener('mode-selected', handleModeSelected);
  }, [isWelcomeScreen]);

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
          />
          <main id="content-area" className="padding-lg">
            {currentTab === 'leagues' && <LeaguesTab />}
            {currentTab === 'teams' && <TeamsTab selectedTeamId={selectedTeamId} />}
            {currentTab === 'dashboard' && <DashboardTab selectedSeasonId={selectedSeasonId} />}
            {currentTab === 'stats' && <StatsTab selectedSeasonId={selectedSeasonId} />}
            {currentTab === 'login' && <baseball-auth-card ref={authRef} logged-in-user={userName} />}
            {currentTab === 'register' && <baseball-auth-card ref={authRef} is-sign-up="true" logged-in-user={userName} />}
            {currentTab === 'live-scorer' && <baseball-scorer-tab no-game="true" />}
            {currentTab === 'boxscore' && <baseball-tab-page-wrapper empty-message="No active box score session." />}
          </main>
        </React.Fragment>
      )}
    </div>
  );
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  );
}

function LeaguesTab() {
  const { data: leagues, isLoading, error } = useQuery({
    queryKey: ['leagues'],
    queryFn: () => api.getLeagues(),
  });

  if (isLoading) return <baseball-tab-page-wrapper loading-message="Loading Leagues..." />;
  if (error) return <baseball-tab-page-wrapper empty-message={(error as Error).message} />;

  return (
    <baseball-leagues-tab
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

export default App;
