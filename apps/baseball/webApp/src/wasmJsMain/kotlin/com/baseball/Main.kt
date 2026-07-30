package com.baseball

import com.baseball.api.BaseballApi
import com.baseball.api.BaseballApiClient
import com.baseball.auth.AuthManager
import com.baseball.auth.AuthService
import com.baseball.ui.auth.renderLoginTab
import com.baseball.ui.auth.renderRegisterTab
import com.baseball.ui.state.AppViewManager
import com.baseball.ui.state.NavTabs
import com.baseball.ui.tabs.boxscore.renderBoxScoreTab
import com.baseball.ui.tabs.dashboard.renderSeasonDashboardTab
import com.baseball.ui.tabs.leagues.renderLeaguesTab
import com.baseball.ui.tabs.scorer.renderLiveScorerTab
import com.baseball.ui.tabs.stats.renderStatsTab
import com.baseball.ui.tabs.teams.renderTeamsTab

// Duplicate tab imports removed

// Global interface instantiations promoting coding by interface inheritance
val api: BaseballApi = BaseballApiClient()
val authService: AuthService = AuthManager

fun main() {
    AppViewManager.registerTabRenderers(
        mapOf(
            NavTabs.TAB_LEAGUES to ::renderLeaguesTab,
            NavTabs.TAB_TEAMS to ::renderTeamsTab,
            NavTabs.TAB_GAMES to ::renderSeasonDashboardTab,
            NavTabs.TAB_STATS to ::renderStatsTab,
            NavTabs.TAB_LIVE_SCORER to ::renderLiveScorerTab,
            NavTabs.TAB_BOXSCORE to ::renderBoxScoreTab,
            NavTabs.TAB_LOGIN to ::renderLoginTab,
            NavTabs.TAB_REGISTER to ::renderRegisterTab,
        ),
    )
    AppViewManager.start()
}
