package com.baseball.ui.controller.scorer

import com.baseball.api
import com.baseball.game.GameManager
import com.baseball.game.PlayEventInput
import com.baseball.game.TeamLineupConfig
import com.baseball.game.initGame
import com.baseball.game.localAwayActivePitcherId
import com.baseball.game.localAwayBench
import com.baseball.game.localAwayLineup
import com.baseball.game.localAwayRoster
import com.baseball.game.localBoxScore
import com.baseball.game.localEvents
import com.baseball.game.localGame
import com.baseball.game.localHomeActivePitcherId
import com.baseball.game.localHomeBench
import com.baseball.game.localHomeLineup
import com.baseball.game.localHomeRoster
import com.baseball.game.startNewGame
import com.baseball.models.BoxScore
import com.baseball.models.Game
import com.baseball.models.GameStatus
import com.baseball.models.HalfInning
import com.baseball.models.Player
import com.baseball.models.ScoringEventRequest
import com.baseball.models.ScoringEventType
import com.baseball.seed.SeedData
import com.baseball.ui.gametracking.scorebook.renderScorecardSheet
import com.baseball.ui.state.NavTabs
import com.baseball.ui.state.currentTab
import com.baseball.ui.state.isSingleGameMode
import com.baseball.ui.state.launch
import com.baseball.ui.state.renderCurrentTab
import com.baseball.ui.state.updateActiveTabButtons
import kotlinx.browser.document
import kotlinx.serialization.json.Json
import org.w3c.dom.Element
import org.w3c.dom.HTMLElement
import org.w3c.dom.events.Event

// Top-level js() helpers — required by Kotlin/Wasm (js() only allowed at top-level)
@OptIn(kotlin.js.ExperimentalWasmJsInterop::class)
private fun extractPitchType(event: Event): String =
    js("(event.detail && event.detail.pitchType) ? event.detail.pitchType : ''")

@OptIn(kotlin.js.ExperimentalWasmJsInterop::class)
private fun extractEventType(event: Event): String =
    js("(event.detail && event.detail.eventType) ? event.detail.eventType : ''")

@OptIn(kotlin.js.ExperimentalWasmJsInterop::class)
private fun extractBaseLabel(event: Event): String =
    js("(event.detail && event.detail.baseLabel) ? event.detail.baseLabel : ''")

@OptIn(kotlin.js.ExperimentalWasmJsInterop::class)
private fun extractLocation(event: Event): String? =
    js("(event.detail && event.detail.location !== undefined) ? (event.detail.location || null) : null")

object ScorerTabController {
    fun render(container: HTMLElement) {
        container.innerHTML = ""
        val game = localGame
        val boxScore = localBoxScore

        val scorerTab = document.createElement("baseball-scorer-tab")
        val lineupDialog = document.createElement("baseball-lineup-setup")

        scorerTab.addEventListener("start-new-game-click", {
            initGame(forceReset = true)
            renderCurrentTab()
        })

        scorerTab.addEventListener("open-lineup-setup-click", {
            lineupDialog.setAttribute("is-open", "true")
            lineupDialog.setAttribute("home-team-name", game?.homeTeam?.name ?: "Home Team")
            lineupDialog.setAttribute("away-team-name", game?.awayTeam?.name ?: "Away Team")
            lineupDialog.setAttribute("home-lineup-json", Json.encodeToString(localHomeLineup))
            lineupDialog.setAttribute("away-lineup-json", Json.encodeToString(localAwayLineup))
            lineupDialog.setAttribute("home-bench-json", Json.encodeToString(localHomeBench))
            lineupDialog.setAttribute("away-bench-json", Json.encodeToString(localAwayBench))
        })

        lineupDialog.addEventListener("save-lineup-setup", {
            if (game != null) {
                startNewGame(
                    homeTeam = game.homeTeam,
                    awayTeam = game.awayTeam,
                    homeConfig = TeamLineupConfig(localHomeLineup, localHomeBench, localHomeActivePitcherId),
                    awayConfig = TeamLineupConfig(localAwayLineup, localAwayBench, localAwayActivePitcherId),
                    useDh = true,
                )
            }
            renderCurrentTab()
        })

        if (game == null || boxScore == null) {
            scorerTab.setAttribute("no-game", "true")
            container.appendChild(scorerTab)
            container.appendChild(lineupDialog)
            return
        }

        scorerTab.setAttribute("away-name", game.awayTeam.name)
        scorerTab.setAttribute("home-name", game.homeTeam.name)

        val sbMount = document.createElement("div") as HTMLElement
        sbMount.setAttribute("slot", "scoreboard")
        mountScoreboard(sbMount, game, boxScore)

        val ctrlMount = document.createElement("div") as HTMLElement
        ctrlMount.setAttribute("slot", "controls")
        val controller = GameScoringController(
            ctrlMount,
            game,
            if (isSingleGameMode) localHomeRoster else emptyList(),
            if (isSingleGameMode) localAwayRoster else emptyList(),
        )
        controller.render()

        val bookMount = document.createElement("div") as HTMLElement
        bookMount.setAttribute("slot", "scorebook")
        renderScorecardSheet(bookMount, game, boxScore, localEvents, game.gameState.half)

        scorerTab.appendChild(sbMount)
        scorerTab.appendChild(ctrlMount)
        scorerTab.appendChild(bookMount)

        container.appendChild(scorerTab)
        container.appendChild(lineupDialog)
    }

    private fun mountScoreboard(container: HTMLElement, game: Game, boxScore: BoxScore) {
        val scoreboard = document.createElement("baseball-scoreboard")
        scoreboard.setAttribute("game-json", Json.encodeToString(game))
        scoreboard.setAttribute("box-score-json", Json.encodeToString(boxScore))
        container.appendChild(scoreboard)
    }
}

class GameScoringController(
    val rightCol: HTMLElement,
    val game: Game,
    val homeRoster: List<Player>,
    val awayRoster: List<Player>,
) {
    var optionalPitchType: String? = null
    private var scoringControls: Element? = null
    private var pendingStep2Panel: ScorerStep2Panel? = null

    fun render() {
        rightCol.innerHTML = ""
        val controls = document.createElement("baseball-scoring-controls")
        scoringControls = controls

        if (game.status == GameStatus.COMPLETED) {
            controls.setAttribute("game-status", "completed")
            controls.setAttribute("away-name", game.awayTeam.name)
            controls.setAttribute("home-name", game.homeTeam.name)
            controls.setAttribute("away-score", game.awayScore.toString())
            controls.setAttribute("home-score", game.homeScore.toString())
            controls.addEventListener("view-boxscore", {
                currentTab = NavTabs.TAB_BOXSCORE
                updateActiveTabButtons()
                renderCurrentTab()
            })
        } else {
            controls.setAttribute("game-status", "active")
            refreshMatchupAttributes(controls)
            bindActiveEvents(controls)
        }

        rightCol.appendChild(controls)
    }

    private fun refreshMatchupAttributes(controls: Element) {
        val isHomeBatting = game.gameState.half == HalfInning.BOTTOM
        val allPlayers = (if (isHomeBatting) homeRoster else awayRoster) +
                (if (isHomeBatting) awayRoster else homeRoster)
        val currBatter = allPlayers.find { it.id == game.gameState.currentBatterId }
        val currPitcher = allPlayers.find { it.id == game.gameState.currentPitcherId }

        controls.setAttribute("batter-name", game.gameState.currentBatterName ?: currBatter?.name ?: "Current Batter")
        controls.setAttribute("batter-stats", currBatter?.let {
            "${it.position} | #${it.jerseyNumber} | Bat: ${it.battingHand}"
        } ?: "AVG .333 | 2 HR")
        controls.setAttribute(
            "pitcher-name",
            game.gameState.currentPitcherName ?: currPitcher?.name ?: "Current Pitcher"
        )
        controls.setAttribute("pitcher-stats", currPitcher?.let {
            "${it.position} | #${it.jerseyNumber} | Throw: ${it.throwingHand}"
        } ?: "ERA 2.50 | 15 K")
        optionalPitchType?.let { controls.setAttribute("current-pitch-type", it) }
    }

    private fun bindActiveEvents(controls: Element) {
        controls.addEventListener("pitch-type-selected", { event ->
            val pitchType = extractPitchType(event).takeIf { it.isNotBlank() }
            optionalPitchType = pitchType
            controls.setAttribute("current-pitch-type", pitchType ?: "")
        })

        controls.addEventListener("trigger-scoring-event", { event ->
            val eventTypeStr = extractEventType(event)
            runCatching { ScoringEventType.valueOf(eventTypeStr) }.getOrNull()
                ?.let { triggerScoringEvent(it) }
        })

        controls.addEventListener("render-step2", { event ->
            val eventTypeStr = extractEventType(event)
            val baseLabel = extractBaseLabel(event)
            runCatching { ScoringEventType.valueOf(eventTypeStr) }.getOrNull()?.let { type ->
                renderStep2(type, baseLabel)
            }
        })

        controls.addEventListener("location-selected", { event ->
            pendingStep2Panel?.submitPlayWithLocation(extractLocation(event))
            pendingStep2Panel = null
            resetToActionGrid()
        })

        controls.addEventListener("cancel-step2", {
            pendingStep2Panel = null
            resetToActionGrid()
        })
    }

    fun renderStep2(eventType: ScoringEventType, baseLabel: String) {
        val isHit = eventType in listOf(
            ScoringEventType.SINGLE, ScoringEventType.DOUBLE,
            ScoringEventType.TRIPLE, ScoringEventType.HOME_RUN,
        )
        pendingStep2Panel = ScorerStep2Panel(this, eventType, baseLabel, isHit)
        scoringControls?.setAttribute("panel-mode", "step2")
        scoringControls?.setAttribute("step2-label", baseLabel)
        if (isHit) scoringControls?.setAttribute("step2-is-hit", "true")
        else scoringControls?.removeAttribute("step2-is-hit")
    }

    private fun resetToActionGrid() {
        scoringControls?.setAttribute("panel-mode", "action-grid")
        scoringControls?.removeAttribute("step2-label")
        scoringControls?.removeAttribute("step2-is-hit")
    }

    fun triggerScoringEvent(
        type: ScoringEventType,
        detail: String? = null,
        isDoublePlay: Boolean = false,
        isError: Boolean = false,
        runnerAdvanceMap: Map<String, Int>? = null,
    ) {
        val finalDescription = buildString {
            optionalPitchType?.let { append("$it - ") }
            detail?.let { append(it) }
        }.takeIf { it.isNotEmpty() }

        val isHomeBatting = game.gameState.half == HalfInning.BOTTOM
        val currentLineup = if (isHomeBatting) localHomeLineup else localAwayLineup
        val currentPitcherId = if (isHomeBatting) localAwayActivePitcherId else localHomeActivePitcherId

        val batterId = game.gameState.currentBatterId ?: currentLineup.firstOrNull()?.id ?: 101L
        val pitcherId = game.gameState.currentPitcherId ?: currentPitcherId

        recordEvent(
            PlayEventInput(
                type,
                batterId,
                pitcherId,
                finalDescription,
                isDoublePlay,
                isError,
                runnerAdvanceMap
            )
        )
        renderCurrentTab()
    }

    private fun recordEvent(input: PlayEventInput) {
        if (isSingleGameMode) {
            GameManager.recordPlayEvent(input)
        } else {
            launch {
                api.recordGameEvent(
                    game.id!!,
                    ScoringEventRequest(
                        eventType = input.eventType,
                        batterId = input.batterId,
                        pitcherId = input.pitcherId,
                        description = input.descriptionDetail,
                        isDoublePlay = input.isDoublePlay,
                        isError = input.isError,
                        runnerAdvanceMap = input.runnerAdvanceMap,
                    ),
                )
            }
        }
    }
}
