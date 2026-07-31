package com.baseball

import com.baseball.api.BaseballApi
import com.baseball.api.BaseballApiClient
import com.baseball.auth.AuthManager
import com.baseball.auth.AuthService
import com.baseball.ui.auth.renderLoginTab
import com.baseball.ui.auth.renderRegisterTab
import com.baseball.ui.state.AppViewManager
import com.baseball.ui.state.NavTabs
import com.baseball.ui.tabs.BoxScoreTabController
import com.baseball.ui.tabs.DashboardTabController
import com.baseball.ui.tabs.LeaguesTabController
import com.baseball.ui.tabs.ScorerTabController
import com.baseball.ui.tabs.StatsTabController
import com.baseball.ui.tabs.TeamsTabController

val api: BaseballApi = BaseballApiClient()
val authService: AuthService = AuthManager

fun main() {
    AppViewManager.registerTabRenderers(
        mapOf(
            NavTabs.TAB_LEAGUES to LeaguesTabController::render,
            NavTabs.TAB_TEAMS to TeamsTabController::render,
            NavTabs.TAB_GAMES to DashboardTabController::render,
            NavTabs.TAB_STATS to StatsTabController::render,
            NavTabs.TAB_LIVE_SCORER to ScorerTabController::render,
            NavTabs.TAB_BOXSCORE to BoxScoreTabController::render,
            NavTabs.TAB_LOGIN to ::renderLoginTab,
            NavTabs.TAB_REGISTER to ::renderRegisterTab,
        ),
    )
    AppViewManager.start()
}
