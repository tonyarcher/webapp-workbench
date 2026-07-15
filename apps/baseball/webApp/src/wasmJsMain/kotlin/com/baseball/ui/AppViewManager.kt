package com.baseball.ui

import com.baseball.BaseballConstants

import com.baseball.UiConstants

import com.baseball.api
import com.baseball.authService
import com.baseball.gameService
import com.baseball.auth.currentUserSession
import com.baseball.auth.AuthManager
import com.baseball.game.initGame
import com.baseball.models.*
import kotlinx.browser.document
import kotlinx.browser.window
import kotlinx.coroutines.*
import org.w3c.dom.*
import kotlinx.html.*
import kotlinx.html.js.*
import kotlinx.css.*

private var _currentTab = BaseballConstants.TAB_LEAGUES
var currentTab: String
    get() = _currentTab
    set(value) {
        if (_currentTab != value) {
            _currentTab = value
            window.location.hash = value
        }
    }

var selectedLeagueId: Long? = null
var selectedSeasonId: Long? = null
var selectedTeamId: Long? = null
var selectedGameId: Long? = null

var leaguesList = emptyList<League>()
var teamsList = emptyList<Team>()
var seasonsList = emptyList<Season>()

var isWelcomeScreen = true
var isSingleGameMode = false
var serverOnline = false
var serverConnectionError: String? = null
var activeBoxScoreTab = "away-batting"

fun saveNavState() {
    try {
        window.localStorage.setItem(BaseballConstants.KEY_NAV_IS_SINGLE_GAME_MODE, isSingleGameMode.toString())
        window.localStorage.setItem(BaseballConstants.KEY_NAV_IS_WELCOME_SCREEN, isWelcomeScreen.toString())
        window.localStorage.setItem(BaseballConstants.KEY_NAV_SELECTED_GAME_ID, selectedGameId?.toString() ?: "")
        window.localStorage.setItem(BaseballConstants.KEY_NAV_SELECTED_LEAGUE_ID, selectedLeagueId?.toString() ?: "")
        window.localStorage.setItem(BaseballConstants.KEY_NAV_SELECTED_SEASON_ID, selectedSeasonId?.toString() ?: "")
        window.localStorage.setItem(BaseballConstants.KEY_NAV_SELECTED_TEAM_ID, selectedTeamId?.toString() ?: "")
        window.localStorage.setItem(BaseballConstants.KEY_NAV_CURRENT_TAB, currentTab)
    } catch (e: Exception) {
        println("Error saving nav state: ${e.message}")
    }
}

fun loadNavState() {
    try {
        isSingleGameMode = window.localStorage.getItem(BaseballConstants.KEY_NAV_IS_SINGLE_GAME_MODE)?.toBoolean() ?: false
        isWelcomeScreen = window.localStorage.getItem(BaseballConstants.KEY_NAV_IS_WELCOME_SCREEN)?.toBoolean() ?: true
        selectedGameId = window.localStorage.getItem(BaseballConstants.KEY_NAV_SELECTED_GAME_ID)?.toLongOrNull()
        selectedLeagueId = window.localStorage.getItem(BaseballConstants.KEY_NAV_SELECTED_LEAGUE_ID)?.toLongOrNull()
        selectedSeasonId = window.localStorage.getItem(BaseballConstants.KEY_NAV_SELECTED_SEASON_ID)?.toLongOrNull()
        selectedTeamId = window.localStorage.getItem(BaseballConstants.KEY_NAV_SELECTED_TEAM_ID)?.toLongOrNull()
        _currentTab = window.localStorage.getItem(BaseballConstants.KEY_NAV_CURRENT_TAB) ?: BaseballConstants.TAB_LEAGUES
    } catch (e: Exception) {
        println("Error loading nav state: ${e.message}")
    }
}

object AppViewManager : DomBuilder {

    fun start() {
        authService.loadSession()
        loadNavState()
        
        window.addEventListener("hashchange", {
            val hash = window.location.hash.removePrefix("#")
            if (hash.isNotEmpty()) {
                val isOnlineTab = hash in listOf(BaseballConstants.TAB_LEAGUES, BaseballConstants.TAB_TEAMS, BaseballConstants.TAB_GAMES) || 
                                  (!isSingleGameMode && hash in listOf(BaseballConstants.TAB_LIVE_SCORER, BaseballConstants.TAB_BOXSCORE))
                
                if (isOnlineTab && currentUserSession == null) {
                    window.location.hash = BaseballConstants.TAB_LOGIN
                    return@addEventListener
                }

                if (hash == BaseballConstants.TAB_WELCOME) {
                    isWelcomeScreen = true
                } else if (hash == BaseballConstants.TAB_LOGIN || hash == BaseballConstants.TAB_REGISTER) {
                    isWelcomeScreen = false
                    _currentTab = hash
                } else if (hash in listOf(BaseballConstants.TAB_LEAGUES, BaseballConstants.TAB_TEAMS, BaseballConstants.TAB_GAMES, BaseballConstants.TAB_LIVE_SCORER, BaseballConstants.TAB_BOXSCORE)) {
                    isWelcomeScreen = false
                    _currentTab = hash
                }
                saveNavState()
                authService.refreshSession()
                renderApp()
                renderCurrentTab()
            }
        })

        val initialHash = window.location.hash.removePrefix("#")
        if (initialHash.isNotEmpty()) {
            val isOnlineTab = initialHash in listOf(BaseballConstants.TAB_LEAGUES, BaseballConstants.TAB_TEAMS, BaseballConstants.TAB_GAMES) || 
                              (!isSingleGameMode && initialHash in listOf(BaseballConstants.TAB_LIVE_SCORER, BaseballConstants.TAB_BOXSCORE))
            
            if (isOnlineTab && currentUserSession == null) {
                isWelcomeScreen = false
                _currentTab = BaseballConstants.TAB_LOGIN
                window.location.hash = BaseballConstants.TAB_LOGIN
            } else if (initialHash == BaseballConstants.TAB_WELCOME) {
                isWelcomeScreen = true
            } else if (initialHash in listOf(BaseballConstants.TAB_LEAGUES, BaseballConstants.TAB_TEAMS, BaseballConstants.TAB_GAMES, BaseballConstants.TAB_LIVE_SCORER, BaseballConstants.TAB_BOXSCORE, BaseballConstants.TAB_LOGIN, BaseballConstants.TAB_REGISTER)) {
                isWelcomeScreen = false
                _currentTab = initialHash
            }
        } else {
            window.location.hash = if (isWelcomeScreen) BaseballConstants.TAB_WELCOME else currentTab
        }

        if (isSingleGameMode) {
            initGame(forceReset = false)
        }

        renderApp()
        renderCurrentTab()

        launch {
            try {
                api.getLeagues()
                serverOnline = true
                if (!isSingleGameMode && !isWelcomeScreen) {
                    leaguesList = api.getLeagues()
                    teamsList = api.getTeams()
                    if (selectedLeagueId != null) {
                        seasonsList = api.getSeasons(selectedLeagueId!!)
                    }
                }
            } catch (e: Exception) {
                serverOnline = false
            }
            renderApp()
            renderCurrentTab()
        }
    }

    fun goBackToWelcome() {
        selectedGameId = null
        serverConnectionError = null
        window.location.hash = "welcome"
    }

    fun renderWelcomeScreen(container: HTMLElement) {
        container.div(classes = "welcome-container") {
            val session = currentUserSession
            div {
                css {
                    display = Display.flex
                    justifyContent = JustifyContent.flexEnd
                    width = 100.pct
                    marginBottom = 1.rem
                }
                if (session != null) {
                    span {
                        +"Logged in as ${session.firstName} "
                        css {
                            color = Color("var(--accent-yellow)")
                            fontWeight = FontWeight.bold
                            marginRight = 1.rem
                        }
                    }
                    a {
                        +"Log Out"
                        css {
                            color = Color("var(--accent-red)")
                            cursor = Cursor.pointer
                            put("text-decoration", "underline")
                        }
                        onClickFunction = {
                            authService.logout()
                        }
                    }
                } else {
                    a {
                        +"Log In / Sign Up"
                        css {
                            color = Color("var(--accent-yellow)")
                            cursor = Cursor.pointer
                            put("text-decoration", "underline")
                        }
                        onClickFunction = {
                            window.location.hash = "login"
                        }
                    }
                }
            }

            div(classes = "welcome-logo") {
                span { +"GRAND SLAM" }
                +" BASEBALL TRACKER"
            }

            p(classes = "welcome-subtitle") {
                +"Exhibition Game Mode (Offline) & Full League Season Mode (Online)"
            }

            val errorMsg = serverConnectionError
            if (errorMsg != null) {
                div(classes = "server-error-banner") {
                    +errorMsg
                }
            }

            div(classes = "mode-grid") {
                div(classes = "mode-card offline") {
                    onClickFunction = {
                        serverConnectionError = null
                        isWelcomeScreen = false
                        isSingleGameMode = true
                        initGame(forceReset = false)
                        window.location.hash = BaseballConstants.TAB_LIVE_SCORER
                    }
                    div(classes = "mode-icon") { +"⚾" }
                    div(classes = "mode-title") { +"Single Game Mode" }
                    div(classes = "mode-desc") {
                        +"Play or score a local exhibition game between Chicago and St. Louis. Runs entirely in your browser with no server connection required."
                    }
                    div(classes = "server-status") {
                        span(classes = "status-dot green")
                        span(classes = "status-text online") { +"Client-Side Only" }
                    }
                }

                div(classes = "mode-card online") {
                    onClickFunction = {
                        serverConnectionError = null
                        launch {
                            try {
                                leaguesList = api.getLeagues()
                                teamsList = api.getTeams()
                                if (leaguesList.isNotEmpty()) {
                                    selectedLeagueId = leaguesList.first().id
                                    seasonsList = api.getSeasons(selectedLeagueId!!)
                                    if (seasonsList.isNotEmpty()) {
                                        selectedSeasonId = seasonsList.first().id
                                    }
                                }
                                isWelcomeScreen = false
                                isSingleGameMode = false
                                if (currentUserSession == null) {
                                    window.location.hash = BaseballConstants.TAB_LOGIN
                                } else {
                                    window.location.hash = BaseballConstants.TAB_LEAGUES
                                }
                            } catch (e: Exception) {
                                serverConnectionError = "Unable to connect to the server. Please check that your Spring Boot backend is running."
                                renderApp()
                            }
                        }
                    }
                    div(classes = "mode-icon") { +"🏆" }
                    div(classes = "mode-title") { +"League & Season Mode" }
                    div(classes = "mode-desc") {
                        +"Manage complete baseball leagues, schedule round-robin seasons, track standings, and record live games backed by your database server."
                    }
                    div(classes = "server-status") {
                        span(classes = if (serverOnline) "status-dot green" else "status-dot red")
                        span(classes = if (serverOnline) "status-text online" else "status-text offline") {
                            +(if (serverOnline) "Server Online" else "Check Connection")
                        }
                    }
                }
            }
        }
    }

    fun renderApp() {
        val app = document.getElementById("app") as? HTMLElement ?: return
        app.innerHTML = ""

        if (isWelcomeScreen) {
            renderWelcomeScreen(app)
            return
        }

        app.header {
            div(classes = "header-container") {
                div(classes = "logo") {
                    css {
                        cursor = Cursor.pointer
                    }
                    onClickFunction = {
                        goBackToWelcome()
                    }
                    span { +"GRAND SLAM" }
                    +" BASEBALL"
                }

                val userSession = currentUserSession
                if (userSession != null) {
                    div {
                        css {
                            display = Display.flex
                            alignItems = Align.center
                            gap = 1.rem
                            fontSize = 0.9.rem
                            color = Color("var(--text-secondary)")
                        }
                        span {
                            +"Hello, ${userSession.firstName}!"
                            css {
                                put("font-weight", "600")
                                color = Color("var(--accent-yellow)")
                            }
                        }
                        button(classes = "btn btn-secondary") {
                            +"Log Out"
                            css {
                                padding = Padding(0.25.rem, 0.5.rem)
                                fontSize = 0.8.rem
                            }
                            onClickFunction = {
                                authService.logout()
                            }
                        }
                    }
                } else {
                    button(classes = "btn btn-secondary") {
                        +"Log In"
                        css {
                            padding = Padding(0.25.rem, 0.75.rem)
                            fontSize = 0.85.rem
                        }
                        onClickFunction = {
                            window.location.hash = "login"
                        }
                    }
                }

                nav {
                    button(classes = "back-to-welcome") {
                        +"← Back to Menu"
                        onClickFunction = {
                            goBackToWelcome()
                        }
                    }

                    if (!isSingleGameMode) {
                        button(classes = "nav-btn") {
                            id = "nav-btn-leagues"
                            +"Leagues & Seasons"
                            onClickFunction = {
                                currentTab = BaseballConstants.TAB_LEAGUES
                                updateActiveTabButtons()
                                renderCurrentTab()
                            }
                        }

                        button(classes = "nav-btn") {
                            id = "nav-btn-teams"
                            +"Teams & Rosters"
                            onClickFunction = {
                                currentTab = BaseballConstants.TAB_TEAMS
                                updateActiveTabButtons()
                                renderCurrentTab()
                            }
                        }

                        button(classes = "nav-btn") {
                            id = "nav-btn-games"
                            +"Season Dashboard"
                            onClickFunction = {
                                currentTab = BaseballConstants.TAB_GAMES
                                updateActiveTabButtons()
                                renderCurrentTab()
                            }
                        }
                    }

                    button(classes = "nav-btn") {
                        id = "nav-btn-live"
                        +"Live Scoring"
                        css {
                            put("display", if (isSingleGameMode || selectedGameId != null) "inline-block" else "none")
                        }
                        onClickFunction = {
                            currentTab = BaseballConstants.TAB_LIVE_SCORER
                            updateActiveTabButtons()
                            renderCurrentTab()
                        }
                    }

                    button(classes = "nav-btn") {
                        id = "nav-btn-boxscore"
                        +"Box Score"
                        css {
                            put("display", if (isSingleGameMode || selectedGameId != null) "inline-block" else "none")
                        }
                        onClickFunction = {
                            currentTab = BaseballConstants.TAB_BOXSCORE
                            updateActiveTabButtons()
                            renderCurrentTab()
                        }
                    }
                }
            }
        }

        app.main {
            id = "content-area"
        }

        updateActiveTabButtons()
    }

    fun updateActiveTabButtons() {
        val navButtons = document.querySelectorAll(".nav-btn")
        for (i in 0 until navButtons.length) {
            val btn = navButtons.item(i) as HTMLElement
            btn.classList.remove("active")
        }

        val btnLive = document.getElementById("nav-btn-live") as? HTMLButtonElement
        val btnBoxScore = document.getElementById("nav-btn-boxscore") as? HTMLButtonElement

        if (isSingleGameMode || selectedGameId != null) {
            btnLive?.style?.setProperty(UiConstants.Css.DISPLAY, UiConstants.CssValues.INLINE_BLOCK)
            btnBoxScore?.style?.setProperty(UiConstants.Css.DISPLAY, UiConstants.CssValues.INLINE_BLOCK)
        } else {
            btnLive?.style?.setProperty(UiConstants.Css.DISPLAY, UiConstants.CssValues.NONE)
            btnBoxScore?.style?.setProperty(UiConstants.Css.DISPLAY, UiConstants.CssValues.NONE)
        }

        val btnActive = when (currentTab) {
            BaseballConstants.TAB_LIVE_SCORER -> btnLive
            BaseballConstants.TAB_BOXSCORE -> btnBoxScore
            else -> {
                when (currentTab) {
                    BaseballConstants.TAB_LEAGUES -> document.getElementById("nav-btn-leagues")
                    BaseballConstants.TAB_TEAMS -> document.getElementById("nav-btn-teams")
                    BaseballConstants.TAB_GAMES -> document.getElementById("nav-btn-games")
                    else -> null
                }
            }
        }
        btnActive?.classList?.add("active")
    }

    fun renderCurrentTab() {
        val contentArea = document.getElementById("content-area") as? HTMLElement ?: return
        contentArea.innerHTML = ""

        when (currentTab) {
            BaseballConstants.TAB_LEAGUES -> renderLeaguesTab(contentArea)
            BaseballConstants.TAB_TEAMS -> renderTeamsTab(contentArea)
            BaseballConstants.TAB_GAMES -> renderSeasonDashboardTab(contentArea)
            BaseballConstants.TAB_LIVE_SCORER -> renderLiveScorerTab(contentArea)
            BaseballConstants.TAB_BOXSCORE -> renderBoxScoreTab(contentArea)
            BaseballConstants.TAB_LOGIN -> renderLoginTab(contentArea)
            BaseballConstants.TAB_REGISTER -> renderRegisterTab(contentArea)
        }
    }
}

fun renderApp() {
    AppViewManager.renderApp()
}

fun updateActiveTabButtons() {
    AppViewManager.updateActiveTabButtons()
}

fun renderCurrentTab() {
    AppViewManager.renderCurrentTab()
}
