package com.baseball.ui.state

import com.baseball.api
import com.baseball.auth.UserSession
import com.baseball.authService
import com.baseball.game.initGame
import com.baseball.game.localAwayActivePitcherId
import com.baseball.game.localAwayActivePitcherName
import com.baseball.game.localAwayBatterIndex
import com.baseball.game.localAwayBench
import com.baseball.game.localAwayLineup
import com.baseball.game.localGame
import com.baseball.game.localHomeActivePitcherId
import com.baseball.game.localHomeActivePitcherName
import com.baseball.game.localHomeBatterIndex
import com.baseball.game.localHomeBench
import com.baseball.game.localHomeLineup
import com.baseball.game.localPlayersSubbedOut
import com.baseball.game.saveLocalState
import com.baseball.models.HalfInning
import com.baseball.ui.core.DomUiConstants
import com.baseball.ui.core.launch
import kotlinx.browser.document
import kotlinx.browser.window
import kotlinx.html.DIV
import kotlinx.html.a
import kotlinx.html.button
import kotlinx.html.div
import kotlinx.html.dom.append
import kotlinx.html.id
import kotlinx.html.js.div
import kotlinx.html.js.header
import kotlinx.html.js.main
import kotlinx.html.js.onClickFunction
import kotlinx.html.nav
import kotlinx.html.p
import kotlinx.html.span
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import org.w3c.dom.HTMLButtonElement
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
            saveNavState()
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

    fun saveNavState() {
        val state = NavState(
            currentTab = currentTab,
            isWelcomeScreen = isWelcomeScreen,
            isSingleGameMode = isSingleGameMode,
            selectedLeagueId = selectedLeagueId,
            selectedSeasonId = selectedSeasonId,
            selectedTeamId = selectedTeamId,
            selectedGameId = selectedGameId,
        )
        window.localStorage.setItem("baseball_nav_state", Json.encodeToString(state))
    }

    fun loadNavState() {
        val json = window.localStorage.getItem("baseball_nav_state") ?: return
        try {
            val state = Json.decodeFromString<NavState>(json)
            internalCurrentTab = state.currentTab
            isWelcomeScreen = state.isWelcomeScreen
            isSingleGameMode = state.isSingleGameMode
            selectedLeagueId = state.selectedLeagueId
            selectedSeasonId = state.selectedSeasonId
            selectedTeamId = state.selectedTeamId
            selectedGameId = state.selectedGameId
        } catch (ignored: Throwable) {
            println("Failed to load nav state: ${ignored.message}")
        }
    }

    fun isGameInProgress(): Boolean {
        if (isSingleGameMode) {
            return localGame?.status == com.baseball.models.GameStatus.IN_PROGRESS
        }
        return selectedGameStatus == com.baseball.models.GameStatus.IN_PROGRESS
    }

    fun registerTabRenderers(renderers: Map<String, (HTMLElement) -> Unit>) {
        tabRenderers.putAll(renderers)
    }

    fun start() {
        authService.loadSession()
        loadNavState()

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

    fun renderWelcomeScreen(container: HTMLElement) {
        AppWelcomeScreenRenderer.renderWelcomeScreen(container)
    }

    fun renderApp() {
        AppHeaderRenderer.renderApp()
    }

    fun updateActiveTabButtons() {
        AppHeaderRenderer.updateActiveTabButtons()
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
            AppViewManager.saveNavState()
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

    fun goBackToWelcome() {
        selectedGameId = null
        AppViewManager.serverConnectionError = null
        window.location.hash = "welcome"
    }
}

private object AppWelcomeScreenRenderer {
    fun renderWelcomeScreen(container: HTMLElement) {
        container.append {
            div(classes = "welcome-container") {
                renderWelcomeHeader()
                div(classes = "welcome-logo") {
                    span { +"GRAND SLAM" }
                    +" BASEBALL TRACKER"
                }
                p(classes = "welcome-subtitle") {
                    +"Exhibition Game Mode (Offline) & Full League Season Mode (Online)"
                }
                AppViewManager.serverConnectionError?.let { errorMsg ->
                    div(classes = "server-error-banner") { +errorMsg }
                }
                div(classes = "mode-grid") {
                    renderOfflineModeCard()
                    renderOnlineModeCard()
                }
            }
        }
    }

    private fun DIV.renderWelcomeHeader() {
        val session = AppViewManager.currentUserSession ?: run {
            renderLoggedOutWelcomeHeader()
            return
        }
        renderLoggedInWelcomeHeader(session)
    }

    private fun DIV.renderLoggedInWelcomeHeader(session: UserSession) {
        div(classes = "flex-between margin-bottom-md") {
            span(classes = "text-accent-yellow font-bold margin-right-md") {
                +"Logged in as ${session.firstName} "
            }
            a(classes = "auth-link") {
                +"Log Out"
                onClickFunction = { authService.logout() }
            }
        }
    }

    private fun DIV.renderLoggedOutWelcomeHeader() {
        div(classes = "flex-between margin-bottom-md") {
            a(classes = "auth-link") {
                +"Log In / Sign Up"
                onClickFunction = { window.location.hash = "login" }
            }
        }
    }

    private fun DIV.renderOfflineModeCard() {
        div(classes = "mode-card offline") {
            onClickFunction = {
                AppViewManager.serverConnectionError = null
                AppViewManager.isWelcomeScreen = false
                isSingleGameMode = true
                initGame(forceReset = false)
                window.location.hash = NavTabs.TAB_LIVE_SCORER
            }
            div(classes = "mode-icon") { +"⚾" }
            div(classes = "mode-title") { +"Single Game Mode" }
            div(classes = "mode-desc") {
                +"Play or score a local exhibition game between Chicago and St. Louis. "
                +"Runs entirely in your browser with no server connection required."
            }
            div(classes = "server-status") {
                span(classes = "status-dot green")
                span(classes = "status-text online") { +"Client-Side Only" }
            }
        }
    }

    private fun DIV.renderOnlineModeCard() {
        div(classes = "mode-card online") {
            onClickFunction = { handleOnlineModeSelection() }
            div(classes = "mode-icon") { +"🏆" }
            div(classes = "mode-title") { +"League & Season Mode" }
            div(classes = "mode-desc") {
                +"Manage complete baseball leagues, schedule round-robin seasons, "
                +"track standings, and record live games backed by your database server."
            }
            div(classes = "server-status") {
                span(classes = if (AppViewManager.serverOnline) "status-dot green" else "status-dot red")
                span(classes = if (AppViewManager.serverOnline) "status-text online" else "status-text offline") {
                    +(if (AppViewManager.serverOnline) "Server Online" else "Check Connection")
                }
            }
        }
    }

    private fun handleOnlineModeSelection() {
        AppViewManager.serverConnectionError = null
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
                AppViewManager.isWelcomeScreen = false
                isSingleGameMode = false
                val nextHash = if (AppViewManager.currentUserSession == null) {
                    NavTabs.TAB_LOGIN
                } else {
                    NavTabs.TAB_LEAGUES
                }
                window.location.hash = nextHash
            } catch (ignored: Throwable) {
                println("Failed to connect online mode: ${ignored.message}")
                AppViewManager.serverConnectionError =
                    "Unable to connect to the server. Please check that the backend server is running."
                AppViewManager.renderApp()
            }
        }
    }
}

private object AppHeaderRenderer {
    fun renderApp() {
        val app = document.getElementById("app") as? HTMLElement ?: return
        app.innerHTML = ""

        if (AppViewManager.isWelcomeScreen) {
            AppViewManager.renderWelcomeScreen(app)
            return
        }

        app.append {
            header {
                div(classes = "header-container") {
                    div(classes = "logo") {
                        onClickFunction = { AppRoutingHandler.goBackToWelcome() }
                        span { +"GRAND SLAM" }
                        +" BASEBALL"
                    }
                    renderUserHeaderControls()
                    renderHeaderNavigation()
                }
            }

            main {
                id = "content-area"
            }
        }

        updateActiveTabButtons()
    }

    private fun DIV.renderUserHeaderControls() {
        val userSession = AppViewManager.currentUserSession
        if (userSession != null) {
            renderLoggedInUserHeaderControls(userSession)
        } else {
            renderLoggedOutUserHeaderControls()
        }
    }

    private fun DIV.renderLoggedInUserHeaderControls(userSession: UserSession) {
        div(classes = "flex-between flex-gap-md font-small text-muted") {
            span(classes = "font-bold text-accent-yellow") {
                +"Hello, ${userSession.firstName}!"
            }
            button(classes = "btn btn-secondary font-small") {
                +"Log Out"
                onClickFunction = { authService.logout() }
            }
        }
    }

    private fun DIV.renderLoggedOutUserHeaderControls() {
        button(classes = "btn btn-secondary font-small") {
            +"Log In"
            onClickFunction = { window.location.hash = "login" }
        }
    }

    private fun DIV.renderHeaderNavigation() {
        nav {
            if (!AppViewManager.isGameInProgress()) {
                button(classes = "back-to-welcome") {
                    +"← Back to Menu"
                    onClickFunction = { AppRoutingHandler.goBackToWelcome() }
                }
            }
            renderSeasonNavigationButtons()
            button(classes = "nav-btn") {
                id = "nav-btn-live"
                +"Live Scoring"
                onClickFunction = { AppViewManager.currentTab = NavTabs.TAB_LIVE_SCORER }
            }
        }
    }

    private fun kotlinx.html.NAV.renderSeasonNavigationButtons() {
        if (isSingleGameMode || AppViewManager.isGameInProgress()) return
        button(classes = "nav-btn") {
            id = "nav-btn-leagues"
            +"Leagues & Seasons"
            onClickFunction = { AppViewManager.currentTab = NavTabs.TAB_LEAGUES }
        }
        button(classes = "nav-btn") {
            id = "nav-btn-teams"
            +"Teams & Rosters"
            onClickFunction = { AppViewManager.currentTab = NavTabs.TAB_TEAMS }
        }
        button(classes = "nav-btn") {
            id = "nav-btn-games"
            +"Season Dashboard"
            onClickFunction = { AppViewManager.currentTab = NavTabs.TAB_GAMES }
        }
        button(classes = "nav-btn") {
            id = "nav-btn-stats"
            +"Season Stats"
            onClickFunction = { AppViewManager.currentTab = NavTabs.TAB_STATS }
        }
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
            btnLive?.style?.setProperty(DomUiConstants.Css.DISPLAY, DomUiConstants.CssValues.INLINE_BLOCK)
            btnBoxScore?.style?.setProperty(DomUiConstants.Css.DISPLAY, DomUiConstants.CssValues.INLINE_BLOCK)
        } else {
            btnLive?.style?.setProperty(DomUiConstants.Css.DISPLAY, DomUiConstants.CssValues.NONE)
            btnBoxScore?.style?.setProperty(DomUiConstants.Css.DISPLAY, DomUiConstants.CssValues.NONE)
        }

        val btnActive = getActiveNavButton(btnLive, btnBoxScore)
        btnActive?.classList?.add("active")
    }

    private fun getActiveNavButton(btnLive: HTMLButtonElement?, btnBoxScore: HTMLButtonElement?): HTMLElement? =
        when (AppViewManager.currentTab) {
            NavTabs.TAB_LIVE_SCORER -> btnLive
            NavTabs.TAB_BOXSCORE -> btnBoxScore
            NavTabs.TAB_LEAGUES -> document.getElementById("nav-btn-leagues") as? HTMLElement
            NavTabs.TAB_TEAMS -> document.getElementById("nav-btn-teams") as? HTMLElement
            NavTabs.TAB_GAMES -> document.getElementById("nav-btn-games") as? HTMLElement
            NavTabs.TAB_STATS -> document.getElementById("nav-btn-stats") as? HTMLElement
            else -> null
        }
}

fun updateActiveTabButtons() {
    AppViewManager.updateActiveTabButtons()
}

fun goBackToWelcome() {
    AppRoutingHandler.goBackToWelcome()
}

fun renderCurrentTab() {
    AppViewManager.renderCurrentTabContent()
}

internal fun substituteBatter(
    isHome: Boolean,
    lineupIndex: Int,
    newPlayerId: Long,
) {
    val lineup = if (isHome) localHomeLineup else localAwayLineup
    val bench = if (isHome) localHomeBench else localAwayBench
    val oldPlayer = lineup[lineupIndex]
    val newPlayer = bench.find { it.id == newPlayerId } ?: return

    lineup[lineupIndex] = newPlayer
    bench.remove(newPlayer)
    localPlayersSubbedOut.add(oldPlayer.id!!)

    val game = localGame ?: return
    val currentHalf = game.gameState.half
    val isCurrentBatterHome = currentHalf == HalfInning.BOTTOM
    if (isHome == isCurrentBatterHome && (if (isHome) localHomeBatterIndex else localAwayBatterIndex) == lineupIndex) {
        localGame =
            game.copy(
                gameState =
                    game.gameState.copy(
                        currentBatterId = newPlayer.id,
                        currentBatterName = newPlayer.name,
                    ),
            )
    }
    saveLocalState()
}

internal fun substitutePitcher(
    isHome: Boolean,
    newPitcherId: Long,
) {
    val bench = if (isHome) localHomeBench else localAwayBench
    val newPitcher = bench.find { it.id == newPitcherId } ?: return
    val oldPitcherId = if (isHome) localHomeActivePitcherId else localAwayActivePitcherId

    bench.remove(newPitcher)
    localPlayersSubbedOut.add(oldPitcherId)

    if (isHome) {
        localHomeActivePitcherId = newPitcher.id!!
        localHomeActivePitcherName = newPitcher.name
    } else {
        localAwayActivePitcherId = newPitcher.id!!
        localAwayActivePitcherName = newPitcher.name
    }

    val game = localGame ?: return
    val currentHalf = game.gameState.half
    val isHomePitching = currentHalf == HalfInning.TOP
    if (isHome == isHomePitching) {
        localGame =
            game.copy(
                gameState =
                    game.gameState.copy(
                        currentPitcherId = newPitcher.id,
                        currentPitcherName = newPitcher.name,
                    ),
            )
    }
    saveLocalState()
}
