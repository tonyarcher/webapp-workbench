package com.baseball.ui.gametracking.scorebook

import com.baseball.game.localAwayActivePitcherId
import com.baseball.game.localAwayActivePitcherName
import com.baseball.game.localAwayRoster
import com.baseball.game.localHomeActivePitcherId
import com.baseball.game.localHomeActivePitcherName
import com.baseball.game.localHomeRoster
import com.baseball.models.BoxScore
import com.baseball.models.Game
import com.baseball.models.HalfInning
import com.baseball.models.PlayEvent
import kotlinx.browser.document
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import org.w3c.dom.HTMLElement

fun renderScorecardSheet(
    container: HTMLElement,
    game: Game,
    boxScore: BoxScore,
    events: List<PlayEvent>,
    half: HalfInning,
) {
    val isHomeBatting = half == HalfInning.BOTTOM
    val battingTeam = if (isHomeBatting) game.homeTeam else game.awayTeam
    val pitchingTeam = if (isHomeBatting) game.awayTeam else game.homeTeam
    val maxInning = events.maxOfOrNull { it.inning }?.coerceAtLeast(9) ?: 9

    container.innerHTML = ""

    val scorebookEl = document.createElement("baseball-scorebook-grid")
    scorebookEl.setAttribute("team-name", battingTeam.name)
    scorebookEl.setAttribute("pitcher-opponent", pitchingTeam.name)
    scorebookEl.setAttribute("half-tag", if (isHomeBatting) "BOT" else "TOP")
    scorebookEl.setAttribute("max-inning", maxInning.toString())

    val slots = buildScorebookSlots(isHomeBatting, boxScore)
    scorebookEl.setAttribute("slots-json", Json.encodeToString(slots))

    container.appendChild(scorebookEl)

    val teamState = ScorebookTeamState(
        awayRoster = localAwayRoster,
        homeRoster = localHomeRoster,
        awayActivePitcherId = localAwayActivePitcherId,
        homeActivePitcherId = localHomeActivePitcherId,
        awayActivePitcherName = localAwayActivePitcherName,
        homeActivePitcherName = localHomeActivePitcherName,
    )

    val data = ScorebookSectionData(game, boxScore, maxInning)
    renderScorebookBottomSection(container, isHomeBatting, teamState, data)
}

@Serializable
private data class ScorebookSlotDto(
    val slotIdx: Int,
    val batterName: String,
    val position: String,
    val hasSub: Boolean = false,
    val atBats: Int = 0,
    val runs: Int = 0,
    val hits: Int = 0,
    val rbi: Int = 0,
    val innings: Map<Int, ScorebookCellDto> = emptyMap(),
)

@Serializable
private data class ScorebookCellDto(
    val notation: String? = null,
    val base: Int = 0,
    val outNum: Int? = null,
    val count: String? = null,
)

private fun buildScorebookSlots(
    isHomeBatting: Boolean,
    boxScore: BoxScore,
): List<ScorebookSlotDto> {
    val bStats = if (isHomeBatting) boxScore.homeBatting else boxScore.awayBatting
    return bStats.mapIndexed { idx, p ->
        ScorebookSlotDto(
            slotIdx = idx + 1,
            batterName = p.playerName,
            position = p.position,
            atBats = p.atBats,
            runs = p.runs,
            hits = p.hits,
            rbi = p.rbi,
        )
    }
}
