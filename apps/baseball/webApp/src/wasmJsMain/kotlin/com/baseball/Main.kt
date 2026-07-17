package com.baseball

import com.baseball.api.BaseballApi
import com.baseball.api.BaseballApiClient
import com.baseball.auth.AuthManager
import com.baseball.auth.AuthService
import com.baseball.ui.AppViewManager
import com.baseball.ui.auth.renderLoginTab
import com.baseball.ui.auth.renderRegisterTab
import com.baseball.ui.tabs.*

// Global interface instantiations promoting coding by interface inheritance
val api: BaseballApi = BaseballApiClient()
val authService: AuthService = AuthManager

fun main() {
    AppViewManager.registerTabRenderers(
        mapOf(
            BaseballConstants.TAB_LEAGUES to ::renderLeaguesTab,
            BaseballConstants.TAB_TEAMS to ::renderTeamsTab,
            BaseballConstants.TAB_GAMES to ::renderSeasonDashboardTab,
            BaseballConstants.TAB_STATS to ::renderStatsTab,
            BaseballConstants.TAB_LIVE_SCORER to ::renderLiveScorerTab,
            BaseballConstants.TAB_BOXSCORE to ::renderBoxScoreTab,
            BaseballConstants.TAB_LOGIN to ::renderLoginTab,
            BaseballConstants.TAB_REGISTER to ::renderRegisterTab,
        ),
    )
    AppViewManager.start()
}
