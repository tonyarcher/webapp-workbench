package com.baseball.ui

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

object AppViewManager {

    fun start() {
        authService.loadSession()
        loadNavState()
        
        window.addEventListener("hashchange", {
            val hash = window.location.hash.removePrefix("#")
            if (hash.isNotEmpty()) {
                val isOnlineTab = hash in listOf("leagues", "teams", "games") || 
                                  (!isSingleGameMode && hash in listOf("live-scorer", "boxscore"))
                
                if (isOnlineTab && currentUserSession == null) {
                    window.location.hash = "login"
                    return@addEventListener
                }

                if (hash == "welcome") {
                    isWelcomeScreen = true
                } else if (hash == "login" || hash == "register") {
                    isWelcomeScreen = false
                    _currentTab = hash
                } else if (hash in listOf("leagues", "teams", "games", "live-scorer", "boxscore")) {
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
            val isOnlineTab = initialHash in listOf("leagues", "teams", "games") || 
                              (!isSingleGameMode && initialHash in listOf("live-scorer", "boxscore"))
            
            if (isOnlineTab && currentUserSession == null) {
                isWelcomeScreen = false
                _currentTab = "login"
                window.location.hash = "login"
            } else if (initialHash == "welcome") {
                isWelcomeScreen = true
            } else if (initialHash in listOf("leagues", "teams", "games", "live-scorer", "boxscore", "login", "register")) {
                isWelcomeScreen = false
                _currentTab = initialHash
            }
        } else {
            window.location.hash = if (isWelcomeScreen) "welcome" else currentTab
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

    fun launch(block: suspend () -> Unit) {
        @OptIn(DelicateCoroutinesApi::class)
        GlobalScope.launch(Dispatchers.Main) {
            try {
                block()
            } catch (e: Throwable) {
                println("Coroutine exception: ${e.message}")
                e.printStackTrace()
            }
        }
    }

    fun goBackToWelcome() {
        selectedGameId = null
        serverConnectionError = null
        window.location.hash = "welcome"
    }

    fun renderWelcomeScreen(container: HTMLElement) {
        val welcome = container.appendElement("div", "welcome-container")
        
        val session = currentUserSession
        val welcomeHeader = welcome.appendElement("div") {
            style.setProperty("display", "flex")
            style.setProperty("justify-content", "flex-end")
            style.setProperty("width", "100%")
            style.setProperty("margin-bottom", "1rem")
        }
        if (session != null) {
            welcomeHeader.appendElement("span") {
                textContent = "Logged in as ${session.firstName} "
                style.setProperty("color", "var(--accent-yellow)")
                style.setProperty("font-weight", "bold")
                style.setProperty("margin-right", "1rem")
            }
            welcomeHeader.appendElement("a") {
                textContent = "Log Out"
                style.setProperty("color", "var(--accent-red)")
                style.setProperty("cursor", "pointer")
                style.setProperty("text-decoration", "underline")
                onClick {
                    authService.logout()
                }
            }
        } else {
            welcomeHeader.appendElement("a") {
                textContent = "Log In / Sign Up"
                style.setProperty("color", "var(--accent-yellow)")
                style.setProperty("cursor", "pointer")
                style.setProperty("text-decoration", "underline")
                onClick {
                    window.location.hash = "login"
                }
            }
        }

        welcome.appendElement("div", "welcome-logo") {
            innerHTML = "<span>GRAND SLAM</span> BASEBALL TRACKER"
        }
        
        welcome.appendElement("p", "welcome-subtitle") {
            textContent = "Exhibition Game Mode (Offline) & Full League Season Mode (Online)"
        }
        
        if (serverConnectionError != null) {
            welcome.appendElement("div", "server-error-banner") {
                textContent = serverConnectionError!!
            }
        }
        
        val grid = welcome.appendElement("div", "mode-grid")
        
        val cardExhibition = grid.appendElement("div", "mode-card offline") {
            onClick {
                serverConnectionError = null
                isWelcomeScreen = false
                isSingleGameMode = true
                initLocalGame(forceReset = false)
                window.location.hash = "live-scorer"
            }
        }
        cardExhibition.appendElement("div", "mode-icon") { textContent = "⚾" }
        cardExhibition.appendElement("div", "mode-title") { textContent = "Single Game Mode" }
        cardExhibition.appendElement("div", "mode-desc") {
            textContent = "Play or score a local exhibition game between Chicago and St. Louis. Runs entirely in your browser with no server connection required."
        }
        val statusLocal = cardExhibition.appendElement("div", "server-status")
        statusLocal.appendElement("span", "status-dot green")
        statusLocal.appendElement("span", "status-text online") { textContent = "Client-Side Only" }

        val cardSeason = grid.appendElement("div", "mode-card online") {
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
                            window.location.hash = "login"
                        } else {
                            window.location.hash = "leagues"
                        }
                    } catch (e: Exception) {
                        serverConnectionError = "Unable to connect to the server. Please check that your Spring Boot backend is running."
                        renderApp()
                    }
                }
            }
        }
        cardSeason.appendElement("div", "mode-icon") { textContent = "🏆" }
        cardSeason.appendElement("div", "mode-title") { textContent = "League & Season Mode" }
        cardSeason.appendElement("div", "mode-desc") {
            textContent = "Manage complete baseball leagues, schedule round-robin seasons, track standings, and record live games backed by your database server."
        }
        
        val statusServer = cardSeason.appendElement("div", "server-status")
        val dot = statusServer.appendElement("span", "status-dot")
        val text = statusServer.appendElement("span", "status-text")
        
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

        val header = app.appendElement("header")
        val headerContainer = header.appendElement("div", "header-container")
        
        val logo = headerContainer.appendElement("div", "logo") {
            style.setProperty("cursor", "pointer")
            onClick {
                goBackToWelcome()
            }
        }
        logo.innerHTML = "<span>GRAND SLAM</span> BASEBALL"
        
        val userSession = currentUserSession
        if (userSession != null) {
            val userDiv = headerContainer.appendElement("div") {
                style.setProperty("display", "flex")
                style.setProperty("align-items", "center")
                style.setProperty("gap", "1rem")
                style.setProperty("font-size", "0.9rem")
                style.setProperty("color", "var(--text-secondary)")
            }
            userDiv.appendElement("span") {
                textContent = "Hello, ${userSession.firstName}!"
                style.setProperty("font-weight", "600")
                style.setProperty("color", "var(--accent-yellow)")
            }
            userDiv.appendElement("button", "btn btn-secondary") {
                textContent = "Log Out"
                style.setProperty("padding", "0.25rem 0.5rem")
                style.setProperty("font-size", "0.8rem")
                onClick {
                    authService.logout()
                }
            }
        } else {
            headerContainer.appendElement("button", "btn btn-secondary") {
                textContent = "Log In"
                style.setProperty("padding", "0.25rem 0.75rem")
                style.setProperty("font-size", "0.85rem")
                onClick {
                    window.location.hash = "login"
                }
            }
        }
        
        val nav = headerContainer.appendElement("nav")
        
        nav.appendElement("button", "back-to-welcome") {
            textContent = "← Back to Menu"
            onClick {
                goBackToWelcome()
            }
        }

        if (!isSingleGameMode) {
            nav.appendElement("button", "nav-btn") {
                id = "nav-btn-leagues"
                textContent = "Leagues & Seasons"
                onClick {
                    currentTab = "leagues"
                    updateActiveTabButtons()
                    renderCurrentTab()
                }
            }
            
            nav.appendElement("button", "nav-btn") {
                id = "nav-btn-teams"
                textContent = "Teams & Rosters"
                onClick {
                    currentTab = "teams"
                    updateActiveTabButtons()
                    renderCurrentTab()
                }
            }
            
            nav.appendElement("button", "nav-btn") {
                id = "nav-btn-games"
                textContent = "Season Dashboard"
                onClick {
                    currentTab = "games"
                    updateActiveTabButtons()
                    renderCurrentTab()
                }
            }
        }
        
        val btnLive = nav.appendElement("button", "nav-btn") {
            id = "nav-btn-live"
            textContent = "Live Scoring"
            style.setProperty("display", if (isSingleGameMode || selectedGameId != null) "inline-block" else "none")
            onClick {
                currentTab = "live-scorer"
                updateActiveTabButtons()
                renderCurrentTab()
            }
        }

        val btnBoxScore = nav.appendElement("button", "nav-btn") {
            id = "nav-btn-boxscore"
            textContent = "Box Score"
            style.setProperty("display", if (isSingleGameMode || selectedGameId != null) "inline-block" else "none")
            onClick {
                currentTab = "boxscore"
                updateActiveTabButtons()
                renderCurrentTab()
            }
        }

        app.appendElement("main") {
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
            btnLive?.style?.setProperty("display", "inline-block")
            btnBoxScore?.style?.setProperty("display", "inline-block")
        } else {
            btnLive?.style?.setProperty("display", "none")
            btnBoxScore?.style?.setProperty("display", "none")
        }

        val btnActive = when (currentTab) {
            "live-scorer" -> btnLive
            "boxscore" -> btnBoxScore
            else -> {
                when (currentTab) {
                    "leagues" -> document.getElementById("nav-btn-leagues")
                    "teams" -> document.getElementById("nav-btn-teams")
                    "games" -> document.getElementById("nav-btn-games")
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
            "leagues" -> renderLeaguesTab(contentArea)
            "teams" -> renderTeamsTab(contentArea)
            "games" -> renderSeasonDashboardTab(contentArea)
            "live-scorer" -> renderLiveScorerTab(contentArea)
            "boxscore" -> renderBoxScoreTab(contentArea)
            "login" -> renderLoginTab(contentArea)
            "register" -> renderRegisterTab(contentArea)
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
