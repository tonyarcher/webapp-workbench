package com.baseball.ui

import com.baseball.UiConstants

import com.baseball.api
import com.baseball.authService
import com.baseball.gameService
import com.baseball.auth.currentUserSession
import com.baseball.auth.AuthManager
import com.baseball.game.initLocalGame
import com.baseball.models.*
import com.baseball.Constants
import kotlinx.browser.document
import kotlinx.browser.window
import kotlinx.coroutines.*
import org.w3c.dom.*

private var _currentTab = Constants.TAB_LEAGUES
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
        window.localStorage.setItem(Constants.KEY_NAV_IS_SINGLE_GAME_MODE, isSingleGameMode.toString())
        window.localStorage.setItem(Constants.KEY_NAV_IS_WELCOME_SCREEN, isWelcomeScreen.toString())
        window.localStorage.setItem(Constants.KEY_NAV_SELECTED_GAME_ID, selectedGameId?.toString() ?: "")
        window.localStorage.setItem(Constants.KEY_NAV_SELECTED_LEAGUE_ID, selectedLeagueId?.toString() ?: "")
        window.localStorage.setItem(Constants.KEY_NAV_SELECTED_SEASON_ID, selectedSeasonId?.toString() ?: "")
        window.localStorage.setItem(Constants.KEY_NAV_SELECTED_TEAM_ID, selectedTeamId?.toString() ?: "")
        window.localStorage.setItem(Constants.KEY_NAV_CURRENT_TAB, currentTab)
    } catch (e: Exception) {
        println("Error saving nav state: ${e.message}")
    }
}

fun loadNavState() {
    try {
        isSingleGameMode = window.localStorage.getItem(Constants.KEY_NAV_IS_SINGLE_GAME_MODE)?.toBoolean() ?: false
        isWelcomeScreen = window.localStorage.getItem(Constants.KEY_NAV_IS_WELCOME_SCREEN)?.toBoolean() ?: true
        selectedGameId = window.localStorage.getItem(Constants.KEY_NAV_SELECTED_GAME_ID)?.toLongOrNull()
        selectedLeagueId = window.localStorage.getItem(Constants.KEY_NAV_SELECTED_LEAGUE_ID)?.toLongOrNull()
        selectedSeasonId = window.localStorage.getItem(Constants.KEY_NAV_SELECTED_SEASON_ID)?.toLongOrNull()
        selectedTeamId = window.localStorage.getItem(Constants.KEY_NAV_SELECTED_TEAM_ID)?.toLongOrNull()
        _currentTab = window.localStorage.getItem(Constants.KEY_NAV_CURRENT_TAB) ?: Constants.TAB_LEAGUES
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
                val isOnlineTab = hash in listOf(Constants.TAB_LEAGUES, Constants.TAB_TEAMS, Constants.TAB_GAMES) || 
                                  (!isSingleGameMode && hash in listOf(Constants.TAB_LIVE_SCORER, Constants.TAB_BOXSCORE))
                
                if (isOnlineTab && currentUserSession == null) {
                    window.location.hash = Constants.TAB_LOGIN
                    return@addEventListener
                }

                if (hash == Constants.TAB_WELCOME) {
                    isWelcomeScreen = true
                } else if (hash == Constants.TAB_LOGIN || hash == Constants.TAB_REGISTER) {
                    isWelcomeScreen = false
                    _currentTab = hash
                } else if (hash in listOf(Constants.TAB_LEAGUES, Constants.TAB_TEAMS, Constants.TAB_GAMES, Constants.TAB_LIVE_SCORER, Constants.TAB_BOXSCORE)) {
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
            val isOnlineTab = initialHash in listOf(Constants.TAB_LEAGUES, Constants.TAB_TEAMS, Constants.TAB_GAMES) || 
                              (!isSingleGameMode && initialHash in listOf(Constants.TAB_LIVE_SCORER, Constants.TAB_BOXSCORE))
            
            if (isOnlineTab && currentUserSession == null) {
                isWelcomeScreen = false
                _currentTab = Constants.TAB_LOGIN
                window.location.hash = Constants.TAB_LOGIN
            } else if (initialHash == Constants.TAB_WELCOME) {
                isWelcomeScreen = true
            } else if (initialHash in listOf(Constants.TAB_LEAGUES, Constants.TAB_TEAMS, Constants.TAB_GAMES, Constants.TAB_LIVE_SCORER, Constants.TAB_BOXSCORE, Constants.TAB_LOGIN, Constants.TAB_REGISTER)) {
                isWelcomeScreen = false
                _currentTab = initialHash
            }
        } else {
            window.location.hash = if (isWelcomeScreen) Constants.TAB_WELCOME else currentTab
        }

        if (isSingleGameMode) {
            initLocalGame(forceReset = false)
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
        val welcome = container.appendElement(UiConstants.Html.DIV, "welcome-container")
        
        val session = currentUserSession
        val welcomeHeader = welcome.appendElement(UiConstants.Html.DIV) {
            style.setProperty(UiConstants.Css.DISPLAY, UiConstants.CssValues.FLEX)
            style.setProperty(UiConstants.Css.JUSTIFY_CONTENT, UiConstants.CssValues.FLEX_END)
            style.setProperty(UiConstants.Css.WIDTH, "100%")
            style.setProperty(UiConstants.Css.MARGIN_BOTTOM, "1rem")
        }
        if (session != null) {
            welcomeHeader.appendElement(UiConstants.Html.SPAN) {
                textContent = "Logged in as ${session.firstName} "
                style.setProperty(UiConstants.Css.COLOR, "var(--accent-yellow)")
                style.setProperty(UiConstants.Css.FONT_WEIGHT, UiConstants.CssValues.BOLD)
                style.setProperty(UiConstants.Css.MARGIN_RIGHT, "1rem")
            }
            welcomeHeader.appendElement(UiConstants.Html.A) {
                textContent = "Log Out"
                style.setProperty(UiConstants.Css.COLOR, "var(--accent-red)")
                style.setProperty(UiConstants.Css.CURSOR, UiConstants.CssValues.POINTER)
                style.setProperty(UiConstants.Css.TEXT_DECORATION, UiConstants.CssValues.UNDERLINE)
                onClick {
                    authService.logout()
                }
            }
        } else {
            welcomeHeader.appendElement(UiConstants.Html.A) {
                textContent = "Log In / Sign Up"
                style.setProperty(UiConstants.Css.COLOR, "var(--accent-yellow)")
                style.setProperty(UiConstants.Css.CURSOR, UiConstants.CssValues.POINTER)
                style.setProperty(UiConstants.Css.TEXT_DECORATION, UiConstants.CssValues.UNDERLINE)
                onClick {
                    window.location.hash = "login"
                }
            }
        }

        welcome.appendElement(UiConstants.Html.DIV, "welcome-logo") {
            innerHTML = "<span>GRAND SLAM</span> BASEBALL TRACKER"
        }
        
        welcome.appendElement(UiConstants.Html.P, "welcome-subtitle") {
            textContent = "Exhibition Game Mode (Offline) & Full League Season Mode (Online)"
        }
        
        if (serverConnectionError != null) {
            welcome.appendElement(UiConstants.Html.DIV, "server-error-banner") {
                textContent = serverConnectionError!!
            }
        }
        
        val grid = welcome.appendElement(UiConstants.Html.DIV, "mode-grid")
        
        val cardExhibition = grid.appendElement(UiConstants.Html.DIV, "mode-card offline") {
            onClick {
                serverConnectionError = null
                isWelcomeScreen = false
                isSingleGameMode = true
                initLocalGame(forceReset = false)
                window.location.hash = Constants.TAB_LIVE_SCORER
            }
        }
        cardExhibition.appendElement(UiConstants.Html.DIV, "mode-icon") { textContent = "⚾" }
        cardExhibition.appendElement(UiConstants.Html.DIV, "mode-title") { textContent = "Single Game Mode" }
        cardExhibition.appendElement(UiConstants.Html.DIV, "mode-desc") {
            textContent = "Play or score a local exhibition game between Chicago and St. Louis. Runs entirely in your browser with no server connection required."
        }
        val statusLocal = cardExhibition.appendElement(UiConstants.Html.DIV, "server-status")
        statusLocal.appendElement(UiConstants.Html.SPAN, "status-dot green")
        statusLocal.appendElement(UiConstants.Html.SPAN, "status-text online") { textContent = "Client-Side Only" }

        val cardSeason = grid.appendElement(UiConstants.Html.DIV, "mode-card online") {
            onClick {
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
                            window.location.hash = Constants.TAB_LOGIN
                        } else {
                            window.location.hash = Constants.TAB_LEAGUES
                        }
                    } catch (e: Exception) {
                        serverConnectionError = "Unable to connect to the server. Please check that your Spring Boot backend is running."
                        renderApp()
                    }
                }
            }
        }
        cardSeason.appendElement(UiConstants.Html.DIV, "mode-icon") { textContent = "🏆" }
        cardSeason.appendElement(UiConstants.Html.DIV, "mode-title") { textContent = "League & Season Mode" }
        cardSeason.appendElement(UiConstants.Html.DIV, "mode-desc") {
            textContent = "Manage complete baseball leagues, schedule round-robin seasons, track standings, and record live games backed by your database server."
        }
        
        val statusServer = cardSeason.appendElement(UiConstants.Html.DIV, "server-status")
        val dot = statusServer.appendElement(UiConstants.Html.SPAN, "status-dot")
        val text = statusServer.appendElement(UiConstants.Html.SPAN, "status-text")
        
        if (serverOnline) {
            dot.className = "status-dot green"
            text.className = "status-text online"
            text.textContent = "Server Online"
        } else {
            dot.className = "status-dot red"
            text.className = "status-text offline"
            text.textContent = "Check Connection"
        }
    }

    fun renderApp() {
        val app = document.getElementById("app") as? HTMLElement ?: return
        app.innerHTML = ""

        if (isWelcomeScreen) {
            renderWelcomeScreen(app)
            return
        }

        val header = app.appendElement(UiConstants.Html.HEADER)
        val headerContainer = header.appendElement(UiConstants.Html.DIV, "header-container")
        
        val logo = headerContainer.appendElement(UiConstants.Html.DIV, "logo") {
            style.setProperty(UiConstants.Css.CURSOR, UiConstants.CssValues.POINTER)
            onClick {
                goBackToWelcome()
            }
        }
        logo.innerHTML = "<span>GRAND SLAM</span> BASEBALL"
        
        val userSession = currentUserSession
        if (userSession != null) {
            val userDiv = headerContainer.appendElement(UiConstants.Html.DIV) {
                style.setProperty(UiConstants.Css.DISPLAY, UiConstants.CssValues.FLEX)
                style.setProperty(UiConstants.Css.ALIGN_ITEMS, UiConstants.CssValues.CENTER)
                style.setProperty(UiConstants.Css.GAP, "1rem")
                style.setProperty(UiConstants.Css.FONT_SIZE, "0.9rem")
                style.setProperty(UiConstants.Css.COLOR, "var(--text-secondary)")
            }
            userDiv.appendElement(UiConstants.Html.SPAN) {
                textContent = "Hello, ${userSession.firstName}!"
                style.setProperty(UiConstants.Css.FONT_WEIGHT, "600")
                style.setProperty(UiConstants.Css.COLOR, "var(--accent-yellow)")
            }
            userDiv.appendElement(UiConstants.Html.BUTTON, "btn btn-secondary") {
                textContent = "Log Out"
                style.setProperty(UiConstants.Css.PADDING, "0.25rem 0.5rem")
                style.setProperty(UiConstants.Css.FONT_SIZE, "0.8rem")
                onClick {
                    authService.logout()
                }
            }
        } else {
            headerContainer.appendElement(UiConstants.Html.BUTTON, "btn btn-secondary") {
                textContent = "Log In"
                style.setProperty(UiConstants.Css.PADDING, "0.25rem 0.75rem")
                style.setProperty(UiConstants.Css.FONT_SIZE, "0.85rem")
                onClick {
                    window.location.hash = "login"
                }
            }
        }
        
        val nav = headerContainer.appendElement(UiConstants.Html.NAV)
        
        nav.appendElement(UiConstants.Html.BUTTON, "back-to-welcome") {
            textContent = "← Back to Menu"
            onClick {
                goBackToWelcome()
            }
        }

        if (!isSingleGameMode) {
            nav.appendElement(UiConstants.Html.BUTTON, "nav-btn") {
                id = "nav-btn-leagues"
                textContent = "Leagues & Seasons"
                onClick {
                    currentTab = Constants.TAB_LEAGUES
                    updateActiveTabButtons()
                    renderCurrentTab()
                }
            }
            
            nav.appendElement(UiConstants.Html.BUTTON, "nav-btn") {
                id = "nav-btn-teams"
                textContent = "Teams & Rosters"
                onClick {
                    currentTab = Constants.TAB_TEAMS
                    updateActiveTabButtons()
                    renderCurrentTab()
                }
            }
            
            nav.appendElement(UiConstants.Html.BUTTON, "nav-btn") {
                id = "nav-btn-games"
                textContent = "Season Dashboard"
                onClick {
                    currentTab = Constants.TAB_GAMES
                    updateActiveTabButtons()
                    renderCurrentTab()
                }
            }
        }
        
        val btnLive = nav.appendElement(UiConstants.Html.BUTTON, "nav-btn") {
            id = "nav-btn-live"
            textContent = "Live Scoring"
            style.setProperty(UiConstants.Css.DISPLAY, if (isSingleGameMode || selectedGameId != null) UiConstants.CssValues.INLINE_BLOCK else UiConstants.CssValues.NONE)
            onClick {
                currentTab = Constants.TAB_LIVE_SCORER
                updateActiveTabButtons()
                renderCurrentTab()
            }
        }

        val btnBoxScore = nav.appendElement(UiConstants.Html.BUTTON, "nav-btn") {
            id = "nav-btn-boxscore"
            textContent = "Box Score"
            style.setProperty(UiConstants.Css.DISPLAY, if (isSingleGameMode || selectedGameId != null) UiConstants.CssValues.INLINE_BLOCK else UiConstants.CssValues.NONE)
            onClick {
                currentTab = Constants.TAB_BOXSCORE
                updateActiveTabButtons()
                renderCurrentTab()
            }
        }

        app.appendElement(UiConstants.Html.MAIN) {
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
            Constants.TAB_LIVE_SCORER -> btnLive
            Constants.TAB_BOXSCORE -> btnBoxScore
            else -> {
                when (currentTab) {
                    Constants.TAB_LEAGUES -> document.getElementById("nav-btn-leagues")
                    Constants.TAB_TEAMS -> document.getElementById("nav-btn-teams")
                    Constants.TAB_GAMES -> document.getElementById("nav-btn-games")
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
            Constants.TAB_LEAGUES -> renderLeaguesTab(contentArea)
            Constants.TAB_TEAMS -> renderTeamsTab(contentArea)
            Constants.TAB_GAMES -> renderSeasonDashboardTab(contentArea)
            Constants.TAB_LIVE_SCORER -> renderLiveScorerTab(contentArea)
            Constants.TAB_BOXSCORE -> renderBoxScoreTab(contentArea)
            Constants.TAB_LOGIN -> renderLoginTab(contentArea)
            Constants.TAB_REGISTER -> renderRegisterTab(contentArea)
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
