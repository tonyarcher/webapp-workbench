package com.baseball

import com.baseball.api.BaseballApi
import com.baseball.api.BaseballApiClient
import com.baseball.auth.AuthManager
import com.baseball.auth.AuthService
import com.baseball.ui.controller.auth.AuthController
import com.baseball.ui.controller.boxscore.BoxScoreController
import com.baseball.ui.controller.dashboard.DashboardController
import com.baseball.ui.controller.leagues.LeaguesController
import com.baseball.ui.controller.scorer.ScorerTabController
import com.baseball.ui.controller.stats.StatsController
import com.baseball.ui.controller.teams.TeamsController
import com.baseball.ui.state.AppViewManager
import com.baseball.ui.state.NavTabs

val api: BaseballApi = BaseballApiClient()
val authService: AuthService = AuthManager

fun main() {
    AppViewManager.registerTabRenderers(
        mapOf(
            NavTabs.TAB_LEAGUES to LeaguesController::render,
            NavTabs.TAB_TEAMS to TeamsController::render,
            NavTabs.TAB_GAMES to DashboardController::render,
            NavTabs.TAB_STATS to StatsController::render,
            NavTabs.TAB_LIVE_SCORER to ScorerTabController::render,
            NavTabs.TAB_BOXSCORE to BoxScoreController::render,
            NavTabs.TAB_LOGIN to AuthController::renderLogin,
            NavTabs.TAB_REGISTER to AuthController::renderRegister,
        ),
    )
    AppViewManager.start()
}
