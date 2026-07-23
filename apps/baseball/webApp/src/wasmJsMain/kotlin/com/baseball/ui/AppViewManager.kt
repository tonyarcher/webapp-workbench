@file:Suppress("WildcardImport", "MagicNumber", "MaxLineLength", "TooManyFunctions", "LongMethod", "CognitiveComplexMethod", "CyclomaticComplexMethod", "NestedBlockDepth", "LongParameterList", "ComplexCondition", "TooGenericExceptionCaught", "SwallowedException", "ObjectPropertyNaming", "ReturnCount", "DestructuringDeclarationWithTooManyEntries", "UnusedPrivateMember", "UnusedPrivateProperty", "UnusedParameter")

package com.baseball.ui

import com.baseball.BaseballConstants
import com.baseball.UiConstants
import com.baseball.api
import com.baseball.authService
import com.baseball.game.*

import com.baseball.models.HalfInning
import com.baseball.models.Player
import com.baseball.auth.UserSession
import kotlinx.browser.document
import kotlinx.browser.window
import kotlinx.css.*
import kotlinx.html.*
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

object AppViewManager {
    private val tabRenderers = mutableMapOf<String, (HTMLElement) -> Unit>()

    var _currentTab: String = BaseballConstants.TAB_LEAGUES
    var currentTab: String
        get() = _currentTab
        set(value) {
            _currentTab = value
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
            _currentTab = state.currentTab
            isWelcomeScreen = state.isWelcomeScreen
            isSingleGameMode = state.isSingleGameMode
            selectedLeagueId = state.selectedLeagueId
            selectedSeasonId = state.selectedSeasonId
            selectedTeamId = state.selectedTeamId
            selectedGameId = state.selectedGameId
        } catch (e: Throwable) {
            // Ignore
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
                _currentTab = BaseballConstants.TAB_LOGIN
                window.location.hash = BaseballConstants.TAB_LOGIN
            }
            return
        }

        if (hash == BaseballConstants.TAB_WELCOME) {
            isWelcomeScreen = true
        } else if (isValidTab(hash)) {
            isWelcomeScreen = false
            _currentTab = hash
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
            } catch (e: Throwable) {
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
        container.div(classes = "welcome-container") {
            renderWelcomeHeader(this)
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
                renderOfflineModeCard(this)
                renderOnlineModeCard(this)
            }
        }
    }

    private fun renderWelcomeHeader(parent: DIV) {
        val session = currentUserSession
        parent.div {
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

    private fun renderOfflineModeCard(parent: DIV) {
        parent.div(classes = "mode-card offline") {
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
    }

    private fun renderOnlineModeCard(parent: DIV) {
        parent.div(classes = "mode-card online") {
            onClickFunction = { handleOnlineModeSelection() }
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
                window.location.hash = if (currentUserSession == null) BaseballConstants.TAB_LOGIN else BaseballConstants.TAB_LEAGUES
            } catch (e: Throwable) {
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

        app.header {
            div(classes = "header-container") {
                div(classes = "logo") {
                    css { cursor = Cursor.pointer }
                    onClickFunction = { goBackToWelcome() }
                    span { +"GRAND SLAM" }
                    +" BASEBALL"
                }
                renderUserHeaderControls(this)
                renderHeaderNavigation(this)
            }
        }

        app.main {
            id = "content-area"
        }

        updateActiveTabButtons()
    }

    private fun renderUserHeaderControls(parent: DIV) {
        val userSession = currentUserSession
        if (userSession != null) {
            parent.div {
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
            parent.button(classes = "btn btn-secondary") {
                +"Log In"
                css {
                    padding = Padding(0.25.rem, 0.75.rem)
                    fontSize = 0.85.rem
                }
                onClickFunction = { window.location.hash = "login" }
            }
        }
    }

    private fun renderHeaderNavigation(parent: DIV) {
        parent.nav {
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
