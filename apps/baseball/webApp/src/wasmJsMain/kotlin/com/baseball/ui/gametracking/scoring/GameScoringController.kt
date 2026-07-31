package com.baseball.ui.gametracking.scoring

import com.baseball.api
import com.baseball.game.GameManager
import com.baseball.game.PlayEventInput
import com.baseball.game.localAwayActivePitcherId
import com.baseball.game.localAwayLineup
import com.baseball.game.localHomeActivePitcherId
import com.baseball.game.localHomeLineup
import com.baseball.models.Game
import com.baseball.models.GameStatus
import com.baseball.models.HalfInning
import com.baseball.models.Player
import com.baseball.models.ScoringEventRequest
import com.baseball.models.ScoringEventType
import com.baseball.ui.core.launch
import com.baseball.ui.state.NavTabs
import com.baseball.ui.state.currentTab
import com.baseball.ui.state.isSingleGameMode
import com.baseball.ui.state.renderCurrentTab
import com.baseball.ui.state.updateActiveTabButtons
import kotlinx.browser.document
import org.w3c.dom.Element
import org.w3c.dom.HTMLElement

class GameScoringController(
    val rightCol: HTMLElement,
    val game: Game,
    val homeRoster: List<Player>,
    val awayRoster: List<Player>,
) {
    var optionalPitchType: String? = null
    private var scoringControls: Element? = null

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

        val batterName = game.gameState.currentBatterName ?: currBatter?.name ?: "Current Batter"
        val batterStats = currBatter?.let { "${it.position} | #${it.jerseyNumber} | Bat: ${it.battingHand}" }
            ?: "AVG .333 | 2 HR"
        val pitcherName = game.gameState.currentPitcherName ?: currPitcher?.name ?: "Current Pitcher"
        val pitcherStats = currPitcher?.let { "${it.position} | #${it.jerseyNumber} | Throw: ${it.throwingHand}" }
            ?: "ERA 2.50 | 15 K"

        controls.setAttribute("batter-name", batterName)
        controls.setAttribute("batter-stats", batterStats)
        controls.setAttribute("pitcher-name", pitcherName)
        controls.setAttribute("pitcher-stats", pitcherStats)
        optionalPitchType?.let { controls.setAttribute("current-pitch-type", it) }
    }

    private fun bindActiveEvents(controls: Element) {
        controls.addEventListener("pitch-type-selected", { event ->
            val pitchType = (event as? org.w3c.dom.CustomEvent)?.detail?.let {
                js("it.pitchType") as? String
            }
            optionalPitchType = if (pitchType.isNullOrBlank()) null else pitchType
            controls.setAttribute("current-pitch-type", optionalPitchType ?: "")
        })

        controls.addEventListener("trigger-scoring-event", { event ->
            val eventTypeStr = (event as? org.w3c.dom.CustomEvent)?.detail?.let {
                js("it.eventType") as? String
            } ?: ""
            runCatching { ScoringEventType.valueOf(eventTypeStr) }.getOrNull()
                ?.let { triggerScoringEvent(it) }
        })

        controls.addEventListener("render-step2", { event ->
            val detail = (event as? org.w3c.dom.CustomEvent)?.detail
            val eventTypeStr = detail?.let { js("it.eventType") as? String } ?: ""
            val baseLabel = detail?.let { js("it.baseLabel") as? String } ?: ""
            runCatching { ScoringEventType.valueOf(eventTypeStr) }.getOrNull()?.let { type ->
                renderStep2(type, baseLabel)
            }
        })

        controls.addEventListener("location-selected", { event ->
            val location = (event as? org.w3c.dom.CustomEvent)?.detail?.let {
                js("it.location") as? String
            }
            pendingStep2Panel?.submitPlayWithLocation(location)
            pendingStep2Panel = null
            resetToActionGrid()
        })

        controls.addEventListener("cancel-step2", {
            pendingStep2Panel = null
            resetToActionGrid()
        })
    }

    private var pendingStep2Panel: ScorerStep2Panel? = null

    fun renderStep2(eventType: ScoringEventType, baseLabel: String) {
        val isHit = eventType in listOf(
            ScoringEventType.SINGLE, ScoringEventType.DOUBLE,
            ScoringEventType.TRIPLE, ScoringEventType.HOME_RUN,
        )
        val panel = ScorerStep2Panel(this, eventType, baseLabel, isHit)
        pendingStep2Panel = panel
        val controls = scoringControls ?: return
        controls.setAttribute("panel-mode", "step2")
        controls.setAttribute("step2-label", baseLabel)
        controls.setAttribute("step2-is-hit", isHit.toString())
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

        recordEvent(PlayEventInput(type, resolvedBatterId(), resolvedPitcherId(), finalDescription, isDoublePlay, isError, runnerAdvanceMap))
        renderCurrentTab()
    }

    private fun resolvedBatterId(): Long {
        val isHomeBatting = game.gameState.half == HalfInning.BOTTOM
        val currentLineup = if (isHomeBatting) localHomeLineup else localAwayLineup
        return game.gameState.currentBatterId ?: currentLineup.firstOrNull()?.id ?: 101L
    }

    private fun resolvedPitcherId(): Long? {
        val isHomeBatting = game.gameState.half == HalfInning.BOTTOM
        return game.gameState.currentPitcherId
            ?: if (isHomeBatting) localAwayActivePitcherId else localHomeActivePitcherId
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
