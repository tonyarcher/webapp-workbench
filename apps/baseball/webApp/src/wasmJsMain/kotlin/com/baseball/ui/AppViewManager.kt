package com.baseball.ui

import com.baseball.BaseballConstants
import com.baseball.UiConstants
import com.baseball.api
import com.baseball.auth.UserSession
import com.baseball.authService
import com.baseball.game.*
import com.baseball.models.HalfInning
import kotlinx.browser.document
import kotlinx.browser.window
import kotlinx.css.*
import kotlinx.html.*
import kotlinx.html.dom.append
import kotlinx.html.js.div
import kotlinx.html.js.header
import kotlinx.html.js.main
import kotlinx.html.js.onClickFunction
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

@Suppress("TooManyFunctions", "LongMethod")
object AppViewManager {
    private val tabRenderers = mutableMapOf<String, (HTMLElement) -> Unit>()

    var internalCurrentTab: String = BaseballConstants.TAB_LEAGUES
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
                handleHashRoute(hash, isEvent = true)
            }
        })

        val initialHash = window.location.hash.removePrefix("#")
        if (initialHash.isNotEmpty()) {
            handleHashRoute(initialHash, isEvent = false)
        } else {
            window.location.hash = if (isWelcomeScreen) BaseballConstants.TAB_WELCOME else currentTab
        }

        if (isSingleGameMode) {
            initGame(forceReset = false)
        }

        renderApp()
        renderCurrentTabContent()
        fetchInitialServerData()
    }

    private fun handleHashRoute(hash: String, isEvent: Boolean) {
        if (requiresOnlineAuth(hash) && currentUserSession == null) {
            if (isEvent) {
                window.location.hash = BaseballConstants.TAB_LOGIN
            } else {
                isWelcomeScreen = false
                internalCurrentTab = BaseballConstants.TAB_LOGIN
                window.location.hash = BaseballConstants.TAB_LOGIN
            }
            return
        }

        if (hash == BaseballConstants.TAB_WELCOME) {
            isWelcomeScreen = true
        } else if (isValidTab(hash)) {
            isWelcomeScreen = false
            internalCurrentTab = hash
        }

        if (isEvent) {
            saveNavState()
            authService.refreshSession()
            renderApp()
            renderCurrentTabContent()
        }
    }

    private fun requiresOnlineAuth(hash: String): Boolean {
        val onlineOnlyTabs = listOf(
            BaseballConstants.TAB_LEAGUES,
            BaseballConstants.TAB_TEAMS,
            BaseballConstants.TAB_GAMES,
            BaseballConstants.TAB_STATS,
        )
        val onlineGameTabs = listOf(BaseballConstants.TAB_LIVE_SCORER, BaseballConstants.TAB_BOXSCORE)
        return hash in onlineOnlyTabs || (!isSingleGameMode && hash in onlineGameTabs)
    }

    private fun isValidTab(hash: String): Boolean = hash in listOf(
        BaseballConstants.TAB_LEAGUES,
        BaseballConstants.TAB_TEAMS,
        BaseballConstants.TAB_GAMES,
        BaseballConstants.TAB_STATS,
        BaseballConstants.TAB_LIVE_SCORER,
        BaseballConstants.TAB_BOXSCORE,
        BaseballConstants.TAB_LOGIN,
        BaseballConstants.TAB_REGISTER,
    )

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

    fun goBackToWelcome() {
        selectedGameId = null
        serverConnectionError = null
        window.location.hash = "welcome"
    }

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
                serverConnectionError?.let { errorMsg ->
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
                    onClickFunction = { authService.logout() }
                }
            } else {
                a {
                    +"Log In / Sign Up"
                    css {
                        color = Color("var(--accent-yellow)")
                        cursor = Cursor.pointer
                        put("text-decoration", "underline")
                    }
                    onClickFunction = { window.location.hash = "login" }
                }
            }
        }
    }

    private fun DIV.renderOfflineModeCard() {
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
                span(classes = if (serverOnline) "status-dot green" else "status-dot red")
                span(classes = if (serverOnline) "status-text online" else "status-text offline") {
                    +(if (serverOnline) "Server Online" else "Check Connection")
                }
            }
        }
    }

    private fun handleOnlineModeSelection() {
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
                val nextHash = if (currentUserSession == null) BaseballConstants.TAB_LOGIN else BaseballConstants.TAB_LEAGUES
                window.location.hash = nextHash
            } catch (ignored: Throwable) {
                println("Failed to connect online mode: ${ignored.message}")
                serverConnectionError = "Unable to connect to the server. Please check that the backend server is running."
                renderApp()
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

        app.append {
            header {
                div(classes = "header-container") {
                    div(classes = "logo") {
                        css { cursor = Cursor.pointer }
                        onClickFunction = { goBackToWelcome() }
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
                        fontWeight = FontWeight("600")
                        color = Color("var(--accent-yellow)")
                    }
                }
                button(classes = "btn btn-secondary") {
                    +"Log Out"
                    css {
                        padding = Padding(0.25.rem, 0.5.rem)
                        fontSize = 0.8.rem
                    }
                    onClickFunction = { authService.logout() }
                }
            }
        } else {
            button(classes = "btn btn-secondary") {
                +"Log In"
                css {
                    padding = Padding(0.25.rem, 0.75.rem)
                    fontSize = 0.85.rem
                }
                onClickFunction = { window.location.hash = "login" }
            }
        }
    }

    private fun DIV.renderHeaderNavigation() {
        nav {
            if (!isGameInProgress()) {
                button(classes = "back-to-welcome") {
                    +"← Back to Menu"
                    onClickFunction = { goBackToWelcome() }
                }
            }

            if (!isSingleGameMode && !isGameInProgress()) {
                button(classes = "nav-btn") {
                    id = "nav-btn-leagues"
                    +"Leagues & Seasons"
                    onClickFunction = { currentTab = BaseballConstants.TAB_LEAGUES }
                }
                button(classes = "nav-btn") {
                    id = "nav-btn-teams"
                    +"Teams & Rosters"
                    onClickFunction = { currentTab = BaseballConstants.TAB_TEAMS }
                }
                button(classes = "nav-btn") {
                    id = "nav-btn-games"
                    +"Season Dashboard"
                    onClickFunction = { currentTab = BaseballConstants.TAB_GAMES }
                }
                button(classes = "nav-btn") {
                    id = "nav-btn-stats"
                    +"Season Stats"
                    onClickFunction = { currentTab = BaseballConstants.TAB_STATS }
                }
            }

            button(classes = "nav-btn") {
                id = "nav-btn-live"
                +"Live Scoring"
                css {
                    display = if (isSingleGameMode || selectedGameId != null) Display.inlineBlock else Display.none
                }
                onClickFunction = { currentTab = BaseballConstants.TAB_LIVE_SCORER }
            }
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
            btnLive?.style?.setProperty(UiConstants.Css.DISPLAY, UiConstants.CssValues.INLINE_BLOCK)
            btnBoxScore?.style?.setProperty(UiConstants.Css.DISPLAY, UiConstants.CssValues.INLINE_BLOCK)
        } else {
            btnLive?.style?.setProperty(UiConstants.Css.DISPLAY, UiConstants.CssValues.NONE)
            btnBoxScore?.style?.setProperty(UiConstants.Css.DISPLAY, UiConstants.CssValues.NONE)
        }

        val btnActive = getActiveNavButton(btnLive, btnBoxScore)
        btnActive?.classList?.add("active")
    }

    private fun getActiveNavButton(btnLive: HTMLButtonElement?, btnBoxScore: HTMLButtonElement?): HTMLElement? =
        when (currentTab) {
            BaseballConstants.TAB_LIVE_SCORER -> btnLive
            BaseballConstants.TAB_BOXSCORE -> btnBoxScore
            BaseballConstants.TAB_LEAGUES -> document.getElementById("nav-btn-leagues") as? HTMLElement
            BaseballConstants.TAB_TEAMS -> document.getElementById("nav-btn-teams") as? HTMLElement
            BaseballConstants.TAB_GAMES -> document.getElementById("nav-btn-games") as? HTMLElement
            BaseballConstants.TAB_STATS -> document.getElementById("nav-btn-stats") as? HTMLElement
            else -> null
        }

}

fun updateActiveTabButtons() {
    AppViewManager.updateActiveTabButtons()
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
