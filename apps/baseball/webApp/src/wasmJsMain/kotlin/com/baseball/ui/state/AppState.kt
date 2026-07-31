package com.baseball.ui.state

import com.baseball.models.League
import com.baseball.models.Season
import com.baseball.models.Team
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch as coroutineLaunch

// Coroutine scope for all UI work
val uiScope = CoroutineScope(Dispatchers.Main)
internal fun launch(block: suspend () -> Unit) = uiScope.coroutineLaunch { block() }


// In-memory cache lists
var leaguesList: List<League> = emptyList()
var seasonsList: List<Season> = emptyList()
var teamsList: List<Team> = emptyList()

// Selected navigation state
var selectedLeagueId: Long? = null
var selectedSeasonId: Long? = null
var selectedTeamId: Long? = null
var selectedGameId: Long? = null

var isSingleGameMode: Boolean = false

var currentTab: String
    get() = AppViewManager.currentTab
    set(value) {
        AppViewManager.currentTab = value
    }

// Navigation tab ID constants
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
