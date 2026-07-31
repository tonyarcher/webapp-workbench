package com.baseball.ui.state

import com.baseball.api
import com.baseball.auth.UserSession
import com.baseball.authService
import com.baseball.game.initGame
import com.baseball.ui.core.launch
import kotlinx.browser.document
import kotlinx.browser.window
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import org.w3c.dom.Element
import org.w3c.dom.HTMLElement

@Serializable
data class NavState(
    val currentTab: String,
    val isWelcomeScreen: Boolean,
    val isSingleGameMode: Boolean,
    val selectedLeagueId: Long?,
    val selectedSeasonId: Long?,
    val selectedTeamId: Long?,
    val selectedGameId: Long?,
)

object AppViewManager {
    private val tabRenderers = mutableMapOf<String, (HTMLElement) -> Unit>()

    var internalCurrentTab: String = NavTabs.TAB_LEAGUES
    var currentTab: String
        get() = internalCurrentTab
        set(value) {
            internalCurrentTab = value
            saveAppNavState()
            renderApp()
            renderCurrentTabContent()
        }

    var isWelcomeScreen: Boolean = true
    var serverConnectionError: String? = null
    var serverOnline: Boolean = false
    var currentUserSession: UserSession? = null

    fun renderCurrentTabContent() {
        val contentArea = document.getElementById("content-area") as? HTMLElement ?: return
        contentArea.innerHTML = ""
        tabRenderers[currentTab]?.invoke(contentArea)
    }

    fun registerTabRenderers(renderers: Map<String, (HTMLElement) -> Unit>) {
        tabRenderers.putAll(renderers)
    }

    fun start() {
        authService.loadSession()
        loadAppNavState()

        window.addEventListener("hashchange", {
            val hash = window.location.hash.removePrefix("#")
            if (hash.isNotEmpty()) {
                AppRoutingHandler.handleHashRoute(hash, isEvent = true)
            }
        })

        val initialHash = window.location.hash.removePrefix("#")
        if (initialHash.isNotEmpty()) {
            AppRoutingHandler.handleHashRoute(initialHash, isEvent = false)
        } else {
            window.location.hash = if (isWelcomeScreen) NavTabs.TAB_WELCOME else currentTab
        }

        if (isSingleGameMode) {
            initGame(forceReset = false)
        }

        renderApp()
        renderCurrentTabContent()
        fetchInitialServerData()
    }

    private fun fetchInitialServerData() {
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
            } catch (ignored: Throwable) {
                println("Failed to fetch initial server data: ${ignored.message}")
                serverOnline = false
            }
            renderApp()
            renderCurrentTabContent()
        }
    }

    fun renderApp() {
        val app = document.getElementById("app") as? HTMLElement ?: return
        app.innerHTML = ""

        if (isWelcomeScreen) {
            renderWelcomeCard(app)
        } else {
            renderNavBarAndMain(app)
        }
    }

    private fun renderWelcomeCard(app: HTMLElement) {
        val welcomeCard = document.createElement("div")
        welcomeCard.className = "welcome-container text-center padding-lg"
        welcomeCard.innerHTML = """
            <h1 style='color: #ffcc00; font-size: 2.5rem;'>⚾ GRAND SLAM BASEBALL</h1>
            <p style='color: #8e9cae; margin-bottom: 2rem;'>Exhibition Mode (Offline) & Full League Season Mode (Online)</p>
            <div style='display: flex; gap: 1rem; justify-content: center;'>
                <button id='btn-single-game' class='btn' style='padding: 1rem 2rem; font-size: 1.1rem;'>Single Game Mode</button>
                <button id='btn-league-mode' class='btn btn-secondary' style='padding: 1rem 2rem; font-size: 1.1rem;'>League Season Mode</button>
            </div>
        """.trimIndent()
        app.appendChild(welcomeCard)

        document.getElementById("btn-single-game")?.addEventListener("click", {
            serverConnectionError = null
            isWelcomeScreen = false
            isSingleGameMode = true
            initGame(forceReset = false)
            window.location.hash = NavTabs.TAB_LIVE_SCORER
        })

        document.getElementById("btn-league-mode")?.addEventListener("click", {
            serverConnectionError = null
            isWelcomeScreen = false
            isSingleGameMode = false
            window.location.hash = NavTabs.TAB_LEAGUES
        })
    }

    private fun renderNavBarAndMain(app: HTMLElement) {
        val nav = document.createElement("baseball-nav-bar")
        nav.setAttribute("active-tab", currentTab)
        currentUserSession?.let {
            nav.setAttribute("user-name", it.firstName)
        }
        nav.addEventListener("tab-selected", { event ->
            val target = event.target as? Element
            val tabId = target?.getAttribute("active-tab") ?: ""
            if (tabId.isNotEmpty()) currentTab = tabId
        })
        app.appendChild(nav)

        val main = document.createElement("main")
        main.id = "content-area"
        app.appendChild(main)
    }

    fun updateActiveTabButtons() {
        println("Active tab: ${currentTab}")
    }
}

fun saveAppNavState() {
    val state = NavState(
        currentTab = AppViewManager.currentTab,
        isWelcomeScreen = AppViewManager.isWelcomeScreen,
        isSingleGameMode = isSingleGameMode,
        selectedLeagueId = selectedLeagueId,
        selectedSeasonId = selectedSeasonId,
        selectedTeamId = selectedTeamId,
        selectedGameId = selectedGameId,
    )
    window.localStorage.setItem("baseball_nav_state", Json.encodeToString(state))
}

fun loadAppNavState() {
    val json = window.localStorage.getItem("baseball_nav_state") ?: return
    try {
        val state = Json.decodeFromString<NavState>(json)
        AppViewManager.internalCurrentTab = state.currentTab
        AppViewManager.isWelcomeScreen = state.isWelcomeScreen
        isSingleGameMode = state.isSingleGameMode
        selectedLeagueId = state.selectedLeagueId
        selectedSeasonId = state.selectedSeasonId
        selectedTeamId = state.selectedTeamId
        selectedGameId = state.selectedGameId
    } catch (ignored: Throwable) {
        println("Failed to load nav state: ${ignored.message}")
    }
}

private object AppRoutingHandler {
    fun handleHashRoute(hash: String, isEvent: Boolean) {
        if (requiresOnlineAuth(hash) && AppViewManager.currentUserSession == null) {
            if (isEvent) {
                window.location.hash = NavTabs.TAB_LOGIN
            } else {
                AppViewManager.isWelcomeScreen = false
                AppViewManager.internalCurrentTab = NavTabs.TAB_LOGIN
                window.location.hash = NavTabs.TAB_LOGIN
            }
            return
        }

        if (hash == NavTabs.TAB_WELCOME) {
            AppViewManager.isWelcomeScreen = true
        } else if (isValidTab(hash)) {
            AppViewManager.isWelcomeScreen = false
            AppViewManager.internalCurrentTab = hash
        }

        if (isEvent) {
            saveAppNavState()
            authService.refreshSession()
            AppViewManager.renderApp()
            AppViewManager.renderCurrentTabContent()
        }
    }

    private fun requiresOnlineAuth(hash: String): Boolean {
        val onlineOnlyTabs = listOf(
            NavTabs.TAB_LEAGUES,
            NavTabs.TAB_TEAMS,
            NavTabs.TAB_GAMES,
            NavTabs.TAB_STATS,
        )
        val onlineGameTabs = listOf(NavTabs.TAB_LIVE_SCORER, NavTabs.TAB_BOXSCORE)
        return hash in onlineOnlyTabs || (!isSingleGameMode && hash in onlineGameTabs)
    }

    private fun isValidTab(hash: String): Boolean = hash in listOf(
        NavTabs.TAB_LEAGUES,
        NavTabs.TAB_TEAMS,
        NavTabs.TAB_GAMES,
        NavTabs.TAB_STATS,
        NavTabs.TAB_LIVE_SCORER,
        NavTabs.TAB_BOXSCORE,
        NavTabs.TAB_LOGIN,
        NavTabs.TAB_REGISTER,
    )

}

fun updateActiveTabButtons() {
    AppViewManager.updateActiveTabButtons()
}

fun renderCurrentTab() {
    AppViewManager.renderCurrentTabContent()
}
