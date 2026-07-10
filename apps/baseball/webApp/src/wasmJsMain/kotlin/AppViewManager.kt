package com.baseball

import com.baseball.api.BaseballApiClient
import com.baseball.models.*
import kotlinx.browser.document
import kotlinx.browser.window
import kotlinx.coroutines.*
import org.w3c.dom.*
import org.w3c.dom.events.Event

val api = BaseballApiClient()
var currentTab = "leagues"

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

object AppViewManager {

    fun start() {
        renderApp()
        launch {
            try {
                api.getLeagues()
                serverOnline = true
            } catch (e: Exception) {
                serverOnline = false
            }
            renderApp()
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
        isWelcomeScreen = true
        selectedGameId = null
        serverConnectionError = null
        renderApp()
    }

    fun renderWelcomeScreen(container: HTMLElement) {
        val welcome = container.appendElement("div", "welcome-container")
        
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
                LocalGameManager.initLocalGame()
                currentTab = "live-scorer"
                renderApp()
                renderCurrentTab()
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
                        currentTab = "leagues"
                        renderApp()
                        renderCurrentTab()
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
            style.cursor = "pointer"
            onClick {
                goBackToWelcome()
            }
        }
        logo.innerHTML = "<span>GRAND SLAM</span> BASEBALL"
        
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
