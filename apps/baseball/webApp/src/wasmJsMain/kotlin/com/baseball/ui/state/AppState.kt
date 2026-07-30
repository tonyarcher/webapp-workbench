package com.baseball.ui.state

import com.baseball.models.GameStatus
import com.baseball.models.League
import com.baseball.models.Season
import com.baseball.models.Team

var leaguesList: List<League> = emptyList()
var seasonsList: List<Season> = emptyList()
var teamsList: List<Team> = emptyList()

var selectedLeagueId: Long? = null
var selectedSeasonId: Long? = null
var selectedTeamId: Long? = null
var selectedGameId: Long? = null

var selectedGameStatus: GameStatus? = null

var isSingleGameMode: Boolean = false

var currentTab: String
    get() = AppViewManager.currentTab
    set(value) {
        AppViewManager.currentTab = value
    }

// Navigation Tabs
object NavTabs {
    const val TAB_WELCOME = "welcome"
    const val TAB_LIVE_SCORER = "live-scorer"
    const val TAB_BOXSCORE = "boxscore"
    const val TAB_LEAGUES = "leagues"
    const val TAB_TEAMS = "teams"
    const val TAB_GAMES = "games"
    const val TAB_STATS = "stats"
    const val TAB_LOGIN = "login"
    const val TAB_REGISTER = "register"
}

fun saveNavState() {
    AppViewManager.saveNavState()
}
