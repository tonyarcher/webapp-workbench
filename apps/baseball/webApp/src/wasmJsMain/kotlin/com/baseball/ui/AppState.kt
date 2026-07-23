

package com.baseball.ui

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
    set(value) { AppViewManager.currentTab = value }

fun saveNavState() {
    AppViewManager.saveNavState()
}
