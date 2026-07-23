

package com.baseball.ui.tabs


import com.baseball.BaseballConstants
import com.baseball.api
import com.baseball.game.initGame
import com.baseball.game.localAwayRoster
import com.baseball.game.localBoxScore
import com.baseball.game.localEvents
import com.baseball.game.localGame
import com.baseball.game.localHomeRoster
import com.baseball.models.BoxScore
import com.baseball.models.Game
import com.baseball.models.GameStatus
import com.baseball.models.PlayEvent
import com.baseball.models.Player
import com.baseball.ui.UiConstants
import com.baseball.ui.components.lineup.LineupSetupOverlay
import com.baseball.ui.components.lineup.isLineupDialogOpen
import com.baseball.ui.components.scorebook.getScorebookNotation
import com.baseball.ui.components.scorebook.renderScorebookView
import com.baseball.ui.components.scoring.renderGameScoringControls
import com.baseball.ui.components.scoring.renderScorerLedScoreboard
import com.baseball.ui.isSingleGameMode
import com.baseball.ui.renderCurrentTab
import com.baseball.ui.selectedGameId
import com.baseball.ui.selectedGameStatus
import com.baseball.game.*
import com.baseball.models.*
import com.baseball.ui.*
import kotlinx.css.*
import kotlinx.html.*
import kotlinx.html.js.*
import kotlinx.html.h2
import kotlinx.html.p
import org.w3c.dom.HTMLButtonElement
import org.w3c.dom.HTMLDivElement
import org.w3c.dom.HTMLElement
import kotlin.Boolean
import kotlin.String
import kotlin.Throwable
import kotlin.collections.List
import kotlin.collections.addAll
import kotlin.collections.drop
import kotlin.collections.filter
import kotlin.collections.find
import kotlin.collections.forEachIndexed
import kotlin.collections.getOrNull
import kotlin.collections.indexOfFirst
import kotlin.collections.isEmpty
import kotlin.collections.isNotEmpty
import kotlin.collections.listOf
import kotlin.collections.none
import kotlin.collections.plus
import kotlin.collections.removeAll
import kotlin.collections.removeFirst
import kotlin.collections.take
import kotlin.compareTo
import kotlin.sequences.indexOfFirst
import kotlin.sequences.none
import kotlin.text.contains
import kotlin.text.indexOfFirst
import kotlin.text.isEmpty
import kotlin.text.isNotEmpty
import kotlin.text.none
import kotlin.text.substringBefore

var isResetDialogOpen = false

@Suppress("LongMethod", "MaxLineLength", "MagicNumber", "TooManyFunctions")
internal fun renderLiveScorerTab(container: HTMLElement) {
    com.baseball.game.onOpenLineupSetupDialog = {
        isLineupDialogOpen = true
        renderCurrentTab()
    }
    if (!isSingleGameMode && selectedGameId == null) {
        renderNoGameSelectedCard(container)
        return
    }
    launch {
        try {
            if (isSingleGameMode && localGame == null) initGame(forceReset = false)
            val (game, events, boxScore, homeRoster, awayRoster) = loadScorerData()
            container.innerHTML = ""
            if (game.status == GameStatus.SCHEDULED) {
                renderStartGameCard(container, game)
                return@launch
            }
            renderLiveScorerMainView(container, game, events, boxScore, homeRoster, awayRoster)
        } catch (e: Throwable) {
            renderScorerErrorCard(container, e.message)
        }
    }
}

private fun renderNoGameSelectedCard(container: HTMLElement) {
    container.div(classes = "card") {
        css { textAlign = TextAlign.center; padding = Padding(3.rem) }
        p { +"No game selected. Go to Season Dashboard to select one." }
    }
}

private data class ScorerData(
    val game: Game,
    val events: List<PlayEvent>,
    val boxScore: BoxScore,
    val homeRoster: List<Player>,
    val awayRoster: List<Player>,
)

private suspend fun loadScorerData(): ScorerData {
    if (isSingleGameMode) {
        return ScorerData(localGame!!, localEvents, localBoxScore!!, localHomeRoster, localAwayRoster)
    }
    val gId = selectedGameId!!
    val game = api.getGame(gId)
    val events = api.getGameEvents(gId)
    val boxScore = api.getGameBoxScore(gId)
    val homeRoster = api.getTeamRoster(game.homeTeam.id!!)
    val awayRoster = api.getTeamRoster(game.awayTeam.id!!)
    selectedGameStatus = game.status
    harmonizeAwayLineup(game, awayRoster)
    harmonizeHomeLineup(game, homeRoster)
    return ScorerData(game, events, boxScore, homeRoster, awayRoster)
}

private fun harmonizeAwayLineup(game: Game, awayRoster: List<Player>) {
    if (localAwayLineup.isEmpty()) {
        localAwayLineup.addAll(awayRoster.filter { it.position != BaseballConstants.Positions.P }.take(9))
        localAwayBench.addAll(
            awayRoster.filter { it.position == BaseballConstants.Positions.P && it.id != game.gameState.currentPitcherId } +
                awayRoster.drop(10),
        )
        localAwayActivePitcherId = game.gameState.currentPitcherId ?: awayRoster.find { it.position == BaseballConstants.Positions.P }?.id ?: 210L
        localAwayActivePitcherName = game.gameState.currentPitcherName ?: awayRoster.find { it.position == BaseballConstants.Positions.P }?.name ?: "Sonny Gray"
        localAwayBatterIndex = localAwayLineup.indexOfFirst { it.id == game.gameState.currentBatterId }.coerceAtLeast(0)
    } else {
        localAwayLineup.removeAll { p -> awayRoster.none { it.id == p.id } }
        localAwayBench.removeAll { p -> awayRoster.none { it.id == p.id } }
        val newAway = awayRoster.filter { r -> localAwayLineup.none { it.id == r.id } && localAwayBench.none { it.id == r.id } }
        localAwayBench.addAll(newAway)
        while (localAwayLineup.size < 9 && localAwayBench.isNotEmpty()) localAwayLineup.add(localAwayBench.removeFirst())
    }
}

private fun harmonizeHomeLineup(game: Game, homeRoster: List<Player>) {
    if (localHomeLineup.isEmpty()) {
        localHomeLineup.addAll(homeRoster.filter { it.position != BaseballConstants.Positions.P }.take(9))
        localHomeBench.addAll(
            homeRoster.filter { it.position == BaseballConstants.Positions.P && it.id != game.gameState.currentPitcherId } +
                homeRoster.drop(10),
        )
        localHomeActivePitcherId = game.gameState.currentPitcherId ?: homeRoster.find { it.position == BaseballConstants.Positions.P }?.id ?: 110L
        localHomeActivePitcherName = game.gameState.currentPitcherName ?: homeRoster.find { it.position == BaseballConstants.Positions.P }?.name ?: "Justin Steele"
        localHomeBatterIndex = localHomeLineup.indexOfFirst { it.id == game.gameState.currentBatterId }.coerceAtLeast(0)
    } else {
        localHomeLineup.removeAll { p -> homeRoster.none { it.id == p.id } }
        localHomeBench.removeAll { p -> homeRoster.none { it.id == p.id } }
        val newHome = homeRoster.filter { r -> localHomeLineup.none { it.id == r.id } && localHomeBench.none { it.id == r.id } }
        localHomeBench.addAll(newHome)
        while (localHomeLineup.size < 9 && localHomeBench.isNotEmpty()) localHomeLineup.add(localHomeBench.removeFirst())
    }
}

private fun renderStartGameCard(container: HTMLElement, game: Game) {
    container.div(classes = "card") {
        css { textAlign = TextAlign.center; padding = UiConstants.CARD_PADDING_LARGE; maxWidth = 600.px; margin = Margin(2.rem, LinearDimension.auto) }
        h2 { +"Ready to Play!" }
        p {
            css { fontSize = UiConstants.FONT_SIZE_LARGE; color = Color("var(--text-secondary)"); marginTop = 1.rem; marginBottom = UiConstants.CARD_GAP_XL }
            +"Matchup: ${game.awayTeam.city} ${game.awayTeam.name} @ ${game.homeTeam.city} ${game.homeTeam.name}"
        }
        renderStartGameTeams(this, game)
        renderStartGameButton(this)
    }
}

private fun renderStartGameTeams(container: DIV, game: Game) {
    container.div {
        css { display = Display.flex; justifyContent = JustifyContent.center; gap = UiConstants.CARD_GAP_LARGE; marginBottom = UiConstants.CARD_GAP_XL }
        div {
            css { background = "rgba(255,255,255,0.05)"; padding = Padding(UiConstants.CARD_GAP_LARGE); borderRadius = UiConstants.CARD_BORDER_RADIUS; flexGrow = 1.0 }
            div { +"Away" }
            h3 { +"${game.awayTeam.abbreviation}" }
        }
        div {
            css { background = "rgba(255,255,255,0.05)"; padding = Padding(UiConstants.CARD_GAP_LARGE); borderRadius = UiConstants.CARD_BORDER_RADIUS; flexGrow = 1.0 }
            div { +"Home" }
            h3 { +"${game.homeTeam.abbreviation}" }
        }
    }
}

private fun renderStartGameButton(container: DIV) {
    container.button(classes = "btn btn-primary") {
        +"START GAME"
        css { fontSize = 1.3.rem; padding = Padding(0.75.rem, 2.5.rem); borderRadius = 30.px }
        onClickFunction = {
            isLineupDialogOpen = true
            renderCurrentTab()
        }
    }
}

private fun renderLiveScorerMainView(
    container: HTMLElement,
    game: Game,
    events: List<PlayEvent>,
    boxScore: BoxScore,
    homeRoster: List<Player>,
    awayRoster: List<Player>,
) {
    renderScorerHeader(container, game)
    val topGrid = container.div(classes = "scorekeeper-grid")
    renderScorerLedScoreboard(topGrid.div(classes = "scoreboard-led"), game)
    renderGameScoringControls(topGrid.div(classes = "card"), game, homeRoster, awayRoster, boxScore)
    renderPlayMonitoringSection(container, game, events, boxScore, homeRoster, awayRoster)
    if (isLineupDialogOpen) {
        LineupSetupOverlay(container, homeRoster, awayRoster, game.homeTeam, game.awayTeam).render()
    }
    if (isResetDialogOpen) renderResetGameOverlay(container)
}

private fun renderScorerHeader(container: HTMLElement, game: Game) {
    container.div {
        css { display = Display.flex; justifyContent = JustifyContent.spaceBetween; alignItems = Align.center; marginBottom = 1.rem }
        h1 { +"Live Scoring: ${game.awayTeam.city} @ ${game.homeTeam.city}"; css { marginBottom = 0.rem } }
        if (isSingleGameMode) {
            div {
                css { display = Display.flex; gap = 0.5.rem }
                if (localEvents.isNotEmpty()) {
                    button(classes = "btn btn-secondary") {
                        +"⎌ Undo Action"; css { padding = Padding(0.5.rem, 1.rem) }
                        onClickFunction = { undoLastLocalEvent(); renderCurrentTab() }
                    }
                }
                button(classes = "btn btn-danger") {
                    +"New Game"; css { padding = Padding(0.5.rem, 1.rem) }
                    onClickFunction = { isResetDialogOpen = true; renderCurrentTab() }
                }
            }
        }
    }
}

private fun renderPlayMonitoringSection(
    container: HTMLElement,
    game: Game,
    events: List<PlayEvent>,
    boxScore: BoxScore,
    homeRoster: List<Player>,
    awayRoster: List<Player>,
) {
    var btnLog: HTMLButtonElement? = null
    var btnScorecard: HTMLButtonElement? = null
    var monitorContent: HTMLDivElement? = null

    fun showLog() {
        val monitorEl = monitorContent ?: return
        renderEventLogContent(monitorEl, events, homeRoster, awayRoster)
    }

    fun showScorecard() {
        val monitorEl = monitorContent ?: return
        monitorEl.innerHTML = ""
        renderScorebookView(monitorEl, game, boxScore, events)
    }

    val monitorCard = container.div(classes = "card") {
        css { marginTop = UiConstants.CARD_GAP_XL }
        div {
            css { display = Display.flex; justifyContent = JustifyContent.spaceBetween; alignItems = Align.center; borderBottom = Border(1.px, BorderStyle.solid, Color("rgba(255, 255, 255, 0.1)")); paddingBottom = 0.5.rem; marginBottom = 1.rem }
            h2 { +"Live Game Monitoring"; css { margin = Margin(0.px) } }
            div {
                css { display = Display.flex; gap = 0.5.rem }
                button(classes = "btn btn-secondary") {
                    id = "scorer-btn-log"
                    +"Play-By-Play Log"
                    onClickFunction = {
                        showLog()
                        btnLog?.classList?.add("btn-primary"); btnLog?.classList?.remove("btn-secondary")
                        btnScorecard?.classList?.add("btn-secondary"); btnScorecard?.classList?.remove("btn-primary")
                    }
                }
                button(classes = "btn btn-primary") {
                    id = "scorer-btn-scorecard"
                    +"Scorebook"
                    onClickFunction = {
                        showScorecard()
                        btnScorecard?.classList?.add("btn-primary"); btnScorecard?.classList?.remove("btn-secondary")
                        btnLog?.classList?.add("btn-secondary"); btnLog?.classList?.remove("btn-primary")
                    }
                }
            }
        }
    }
    btnLog = monitorCard.querySelector("#scorer-btn-log") as? HTMLButtonElement
    btnScorecard = monitorCard.querySelector("#scorer-btn-scorecard") as? HTMLButtonElement
    monitorContent = monitorCard.div { id = "monitor-content-container" }
    showScorecard()
}

private fun isPlayEventInningEnded(ev: PlayEvent, nextEv: PlayEvent?): Boolean {
    if (nextEv != null) return nextEv.half != ev.half || nextEv.inning != ev.inning
    val outsOnPlay = when {
        ev.description.contains(BaseballConstants.DESC_DOUBLE_PLAY) || ev.description.contains(BaseballConstants.DESC_DP) -> 2
        ev.eventType in listOf(
            ScoringEventType.STRIKEOUT, ScoringEventType.GROUNDOUT, ScoringEventType.FLYOUT,
            ScoringEventType.LINE_OUT, ScoringEventType.POP_OUT, ScoringEventType.SACRIFICE_FLY, ScoringEventType.FIELDER_CHOICE,
        ) -> 1
        else -> 0
    }
    return ev.outsBefore + outsOnPlay >= 3
}

private fun getPlayEventEndingStr(ev: PlayEvent): String = when (ev.eventType) {
    ScoringEventType.SINGLE, ScoringEventType.WALK, ScoringEventType.HIT_BY_PITCH, ScoringEventType.ERROR -> BaseballConstants.PLAY_RESULT_1B
    ScoringEventType.DOUBLE -> BaseballConstants.PLAY_RESULT_2B
    ScoringEventType.TRIPLE -> BaseballConstants.PLAY_RESULT_3B
    ScoringEventType.HOME_RUN -> BaseballConstants.PLAY_RESULT_RUN_SCORED
    else -> BaseballConstants.PLAY_RESULT_OUT
}

private fun renderEventLogContent(monitorEl: HTMLDivElement, events: List<PlayEvent>, homeRoster: List<Player>, awayRoster: List<Player>) {
    monitorEl.innerHTML = ""
    monitorEl.div(classes = "event-log") {
        if (events.isEmpty()) {
            div { +"No events logged for this game yet." }
        } else {
            val allPlayers = homeRoster + awayRoster
            events.forEachIndexed { index, ev ->
                val player = allPlayers.find { it.name == ev.batterName }
                val position = player?.position ?: "DH"
                val endedInning = isPlayEventInningEnded(ev, events.getOrNull(index + 1))
                renderLogItem(this, ev, position, endedInning)
            }
        }
    }
}

private fun renderLogItem(container: DIV, ev: PlayEvent, position: String, endedInning: Boolean) {
    val endedStr = getPlayEventEndingStr(ev)
    val notation = getScorebookNotation(ev)
    container.div(classes = "log-item") {
        css {
            display = Display.flex; flexDirection = FlexDirection.column; padding = Padding(0.75.rem)
            borderBottom = Border(1.px, BorderStyle.solid, Color("rgba(255, 255, 255, 0.05)"))
            if (endedInning) { background = "rgba(255, 42, 59, 0.05)"; borderLeft = Border(4.px, BorderStyle.solid, Color("var(--accent-red)")) }
        }
        div {
            css { display = Display.flex; justifyContent = JustifyContent.spaceBetween; alignItems = Align.center; width = 100.pct }
            span(classes = "log-desc") {
                val header = "${ev.batterName} ($position) - Inning ${ev.inning} (${if (ev.half == HalfInning.TOP) "Top" else "Bottom"})"
                val notStr = if (notation.isNotEmpty()) " [$notation]" else ""
                val endingDetail = if (endedInning && endedStr != BaseballConstants.PLAY_RESULT_RUN_SCORED && endedStr != BaseballConstants.PLAY_RESULT_OUT) BaseballConstants.PLAY_RESULT_LOB else endedStr
                val cleanedDesc = ev.description.substringBefore(" | Adv:")
                unsafe { raw("<span style='color: var(--accent-yellow); font-weight: 700;'>$header</span>$notStr - $cleanedDesc <span style='color: var(--text-secondary); font-size: 0.8rem;'>[Ended: $endingDetail]</span>") }
            }
            if (endedInning) {
                span {
                    +" ─── / (Side Retired)"
                    css { color = Color("var(--accent-red)"); fontWeight = FontWeight.bold; fontSize = 0.9.rem }
                }
            }
        }
    }
}

private fun renderResetGameOverlay(container: HTMLElement) {
    container.div {
        css {
            position = Position.fixed; top = 0.px; left = 0.px; width = LinearDimension("100vw"); height = LinearDimension("100vh")
            background = "rgba(10, 15, 30, 0.8)"; put("backdrop-filter", "blur(12px)"); display = Display.flex
            alignItems = Align.center; justifyContent = JustifyContent.center; zIndex = 10000
        }
        div(classes = "card") {
            css { width = UiConstants.MODAL_WIDTH_PCT.pct; maxWidth = UiConstants.MODAL_MAX_WIDTH_PX.px; padding = Padding(2.rem); textAlign = TextAlign.center }
            h2 { +"Start a New Game"; css { marginBottom = 1.rem } }
            p { +"Are you sure you want to reset? All current game progress and stats will be permanently lost."; css { marginBottom = 1.5.rem; color = Color("var(--text-secondary)") } }
            renderResetDialogActions(this)
        }
    }
}

private fun renderResetDialogActions(container: DIV) {
    container.div {
        css { display = Display.flex; flexDirection = FlexDirection.column; gap = 0.75.rem }
        if (isSingleGameMode) {
            button(classes = "btn btn-primary") {
                +"Restart with Current Lineups"
                onClickFunction = { isResetDialogOpen = false; resetLocalGame(toInitialLineups = true); renderCurrentTab() }
            }
            button(classes = "btn btn-action") {
                +"Configure New Lineups"
                css { put("background", "linear-gradient(135deg, #3b82f6, #8b5cf6)") }
                onClickFunction = { isResetDialogOpen = false; isLineupDialogOpen = true; renderCurrentTab() }
            }
        } else {
            button(classes = "btn btn-primary") {
                +"Reset Game Stats & Events"
                onClickFunction = {
                    launch {
                        api.resetGame(selectedGameId!!)
                        com.baseball.game.clearLiveScorerCache()
                        isResetDialogOpen = false
                        renderCurrentTab()
                    }
                }
            }
        }
        button(classes = "btn btn-secondary") {
            +"Cancel"
            onClickFunction = { isResetDialogOpen = false; renderCurrentTab() }
        }
    }
}

private fun renderScorerErrorCard(container: HTMLElement, errorMsg: String?) {
    container.innerHTML = ""
    container.div(classes = "card") {
        css { textAlign = TextAlign.center; padding = Padding(3.rem) }
        h2 { +"Failed to load Live Scorer" }
        p { css { color = Color("var(--text-secondary)") }; +"Error: $errorMsg" }
        button(classes = "btn btn-primary") {
            +"Retry"; css { marginTop = 1.rem }
            onClickFunction = { renderCurrentTab() }
        }
    }
}
