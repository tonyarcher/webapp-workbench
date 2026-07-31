package com.baseball

import com.baseball.api.BaseballApi
import com.baseball.api.BaseballApiClient
import com.baseball.auth.AuthManager
import com.baseball.auth.AuthService
import com.baseball.ui.auth.renderLoginTab
import com.baseball.ui.auth.renderRegisterTab
import com.baseball.ui.state.AppViewManager
import com.baseball.ui.state.NavTabs
import com.baseball.ui.tabs.renderBoxScoreTab
import com.baseball.ui.tabs.renderLeaguesTab
import com.baseball.ui.tabs.renderStatsTab
import com.baseball.ui.tabs.renderTeamsTab
import com.baseball.ui.tabs.dashboard.renderSeasonDashboardTab
import com.baseball.ui.tabs.scorer.renderScorerTab

val api: BaseballApi = BaseballApiClient()
val authService: AuthService = AuthManager

fun main() {
    AppViewManager.registerTabRenderers(
        mapOf(
            NavTabs.TAB_LEAGUES to ::renderLeaguesTab,
            NavTabs.TAB_TEAMS to ::renderTeamsTab,
            NavTabs.TAB_GAMES to ::renderSeasonDashboardTab,
            NavTabs.TAB_STATS to ::renderStatsTab,
            NavTabs.TAB_LIVE_SCORER to ::renderScorerTab,
            NavTabs.TAB_BOXSCORE to ::renderBoxScoreTab,
            NavTabs.TAB_LOGIN to ::renderLoginTab,
            NavTabs.TAB_REGISTER to ::renderRegisterTab,
        ),
    )
    AppViewManager.start()
}
