package com.baseball.ui.components

import com.baseball.BaseballConstants
import com.baseball.models.*
import org.w3c.dom.*
import kotlinx.html.*
import kotlinx.html.js.*
import kotlinx.html.dom.*

fun renderScorebookBottomSection(
    container: HTMLElement,
    game: Game,
    boxScore: BoxScore,
    isHomeBatting: Boolean,
    maxInning: Int,
    localAwayRoster: List<Player>,
    localHomeRoster: List<Player>,
    localAwayActivePitcherId: Long,
    localHomeActivePitcherId: Long,
    localAwayActivePitcherName: String,
    localHomeActivePitcherName: String
) {
    val bottomGrid = container.append.div {
        style = "display: flex; flex-wrap: wrap; gap: 1.5rem; margin-top: 1.5rem;"
    }

    renderDefenseDiagram(bottomGrid, isHomeBatting, localAwayRoster, localHomeRoster, localAwayActivePitcherId, localHomeActivePitcherId)
    renderOpposingPitchingStats(bottomGrid, isHomeBatting, boxScore)
    renderScoreboardSummary(bottomGrid, game, boxScore, maxInning, localHomeRoster, localAwayRoster, localHomeActivePitcherName, localAwayActivePitcherName)
}

private fun renderDefenseDiagram(
    parent: HTMLDivElement,
    isHomeBatting: Boolean,
    localAwayRoster: List<Player>,
    localHomeRoster: List<Player>,
    localAwayActivePitcherId: Long,
    localHomeActivePitcherId: Long
) {
    val cardEl = parent.append.div(classes = "card") {
        style = "background-color: #f9f7f2; border: 2px solid #5a544a; padding: 1rem; color: #2b2a28; flex: 1 1 300px;"
        h3 {
            +"HOME DEFENSE FIELD"
            style = "text-align: center; margin: 0 0 1rem 0; font-size: 1rem; font-weight: bold; border-bottom: 1px solid #c2bcae; padding-bottom: 0.25rem;"
        }
    }

    val fieldWrapper = cardEl.append.div {
        style = "position: relative; width: 100%; height: 260px; background-color: #edf2eb; border: 1px solid #c2bcae; border-radius: 8px; overflow: hidden;"
        div {
            style = "position: absolute; bottom: 10px; left: calc(50% - 90px); width: 180px; height: 180px; border-radius: 50%; background-color: #e5ccb3; z-index: 1;"
        }
        div {
            style = "position: absolute; bottom: 50px; left: calc(50% - 50px); width: 100px; height: 100px; background-color: #cbe1c7; border: 2px solid white; transform: rotate(45deg); z-index: 2;"
        }
    }

    val defPlayers = if (isHomeBatting) localAwayRoster else localHomeRoster
    val activePitcherId = if (isHomeBatting) localAwayActivePitcherId else localHomeActivePitcherId
    renderPositionNodes(fieldWrapper, defPlayers, activePitcherId)
}

private fun buildPositionsMap(defPlayers: List<Player>, activePitcherId: Long): Map<String, String> {
    return mapOf(
        BaseballConstants.Positions.P to (defPlayers.find { it.id == activePitcherId }?.name ?: "Pitcher"),
        BaseballConstants.Positions.C to (defPlayers.find { it.position == BaseballConstants.Positions.C }?.name ?: "Catcher"),
        BaseballConstants.Positions.FIRST_BASE to (defPlayers.find { it.position == BaseballConstants.Positions.FIRST_BASE }?.name ?: "First Base"),
        BaseballConstants.Positions.SECOND_BASE to (defPlayers.find { it.position == BaseballConstants.Positions.SECOND_BASE }?.name ?: "Second Base"),
        BaseballConstants.Positions.THIRD_BASE to (defPlayers.find { it.position == BaseballConstants.Positions.THIRD_BASE }?.name ?: "Third Base"),
        BaseballConstants.Positions.SS to (defPlayers.find { it.position == BaseballConstants.Positions.SS }?.name ?: "Shortstop"),
        BaseballConstants.Positions.LF to (defPlayers.find { it.position == BaseballConstants.Positions.LF }?.name ?: "Left Field"),
        BaseballConstants.Positions.CF to (defPlayers.find { it.position == BaseballConstants.Positions.CF }?.name ?: "Center Field"),
        BaseballConstants.Positions.RF to (defPlayers.find { it.position == BaseballConstants.Positions.RF }?.name ?: "Right Field")
    )
}

private fun renderPositionNodes(fieldWrapper: HTMLDivElement, defPlayers: List<Player>, activePitcherId: Long) {
    val positionsMap = buildPositionsMap(defPlayers, activePitcherId)
    val coords = mapOf(
        BaseballConstants.Positions.CF to Pair("10px", "calc(50% - 40px)"),
        BaseballConstants.Positions.LF to Pair("40px", "15px"),
        BaseballConstants.Positions.RF to Pair("40px", "calc(100% - 95px)"),
        BaseballConstants.Positions.SS to Pair("55px", "calc(50% - 75px)"),
        BaseballConstants.Positions.SECOND_BASE to Pair("65px", "calc(50% - 5px)"),
        BaseballConstants.Positions.THIRD_BASE to Pair("130px", "calc(50% - 115px)"),
        BaseballConstants.Positions.FIRST_BASE to Pair("130px", "calc(50% + 35px)"),
        BaseballConstants.Positions.P to Pair("135px", "calc(50% - 40px)"),
        BaseballConstants.Positions.C to Pair("210px", "calc(50% - 40px)")
    )

    coords.forEach { (pos, coord) ->
        val name = positionsMap[pos] ?: "Def"
        fieldWrapper.append.div {
            style = "position: absolute; top: ${coord.first}; left: ${coord.second}; width: 80px; display: flex; flex-direction: column; align-items: center; z-index: 10;"
            span {
                +pos
                style = "font-size: 0.75rem; font-weight: bold; background-color: #ff2a3b; color: white; border-radius: 50%; width: 18px; height: 18px; display: flex; justify-content: center; align-items: center; border: 1px solid white;"
            }
            span {
                +name.substringBefore(" ").take(8)
                style = "font-size: 0.65rem; font-weight: bold; color: #111; background-color: rgba(255, 255, 255, 0.8); padding: 1px 4px; border-radius: 3px; margin-top: 2px; text-align: center;"
            }
        }
    }
}

private fun TABLE.renderPitchingHeader() {
    thead {
        style = "background-color: #eae5dc;"
        tr {
            style = "border-bottom: 1px solid #5a544a;"
            listOf("PITCHER", "R/L", "IP", "BF", "H", "R", "ER", "BB", "K").forEach { h ->
                th {
                    +h
                    style = "padding: 4px; text-align: ${if (h == "PITCHER") "left" else "center"};"
                }
            }
        }
    }
}

private fun renderOpposingPitchingStats(parent: HTMLDivElement, isHomeBatting: Boolean, boxScore: BoxScore) {
    parent.append.div(classes = "card") {
        style = "background-color: #f9f7f2; border: 2px solid #5a544a; padding: 1rem; color: #2b2a28; flex: 1 1 320px;"
        h3 {
            +"OPPOSING PITCHING STATS"
            style = "text-align: center; margin: 0 0 1rem 0; font-size: 1rem; font-weight: bold; border-bottom: 1px solid #c2bcae; padding-bottom: 0.25rem;"
        }
        val pStatsList = if (isHomeBatting) boxScore.awayPitching else boxScore.homePitching
        div {
            style = "overflow-y: auto; height: 260px;"
            table {
                style = "width: 100%; border-collapse: collapse; font-size: 0.8rem;"
                renderPitchingHeader()
                tbody {
                    pStatsList.forEach { p -> renderPitcherRow(this, p) }
                }
            }
        }
    }
}

private fun TR.renderCenterTd(text: String) {
    td {
        +text
        style = "text-align: center;"
    }
}

private fun renderPitcherRow(tbody: TBODY, p: PlayerPitchingStats) {
    tbody.tr {
        style = "border-bottom: 1px solid #c2bcae;"
        td {
            +p.playerName
            style = "font-weight: bold; padding: 6px 4px;"
        }
        renderCenterTd("R")
        renderCenterTd("${p.inningsPitchedThirds / 3}.${p.inningsPitchedThirds % 3}")
        renderCenterTd((p.inningsPitchedThirds + p.runsAllowed + p.hitsAllowed + p.walksAllowed).toString())
        renderCenterTd(p.hitsAllowed.toString())
        renderCenterTd(p.runsAllowed.toString())
        renderCenterTd(p.earnedRuns.toString())
        renderCenterTd(p.walksAllowed.toString())
        renderCenterTd(p.strikeoutsRecorded.toString())
    }
}

private fun renderScoreboardSummary(
    parent: HTMLDivElement,
    game: Game,
    boxScore: BoxScore,
    maxInning: Int,
    localHomeRoster: List<Player>,
    localAwayRoster: List<Player>,
    localHomeActivePitcherName: String,
    localAwayActivePitcherName: String
) {
    parent.append.div(classes = "card") {
        style = "background-color: #eae5dc; border: 2px solid #5a544a; padding: 1rem; color: #2b2a28; flex: 1 1 280px;"
        h3 {
            +"SCOREBOARD SUMMARY"
            style = "text-align: center; margin: 0 0 1rem 0; font-size: 1rem; font-weight: bold; border-bottom: 1px solid #5a544a; padding-bottom: 0.25rem;"
        }
        renderLineScoreTable(this, game, boxScore, maxInning)
        renderPitcherRecords(this, game, localHomeRoster, localAwayRoster, localHomeActivePitcherName, localAwayActivePitcherName)
    }
}

private fun TABLE.renderLineScoreHeader(maxInning: Int) {
    thead {
        tr {
            style = "border-bottom: 1px solid #5a544a;"
            th {
                +"TEAM"
                style = "text-align: left;"
            }
            for (i in 1..maxInning) {
                th {
                    +i.toString()
                    style = "text-align: center;"
                }
            }
            listOf("R", "H", "E").forEach { h ->
                th {
                    +h
                    style = "text-align: center;${if (h == "R") " font-weight: bold;" else ""}"
                }
            }
        }
    }
}

private fun renderLineScoreTable(card: DIV, game: Game, boxScore: BoxScore, maxInning: Int) {
    card.table {
        style = "width: 100%; border-collapse: collapse; margin-bottom: 1.5rem; font-size: 0.85rem;"
        renderLineScoreHeader(maxInning)
        tbody {
            renderLineScoreTeamRow(this, game.awayTeam.abbreviation, boxScore.lineScore.awayInningRuns, game.gameState.inning, boxScore.lineScore.awayRuns, boxScore.lineScore.awayHits, boxScore.lineScore.awayErrors, maxInning)
            renderLineScoreTeamRow(this, game.homeTeam.abbreviation, boxScore.lineScore.homeInningRuns, game.gameState.inning, boxScore.lineScore.homeRuns, boxScore.lineScore.homeHits, boxScore.lineScore.homeErrors, maxInning)
        }
    }
}

private fun renderLineScoreTeamRow(tbody: TBODY, teamAbb: String, inningRuns: List<Int?>, currentInning: Int, r: Int, h: Int, e: Int, maxInning: Int) {
    tbody.tr {
        style = "border-bottom: 1px solid #c2bcae;"
        td {
            +teamAbb
            style = "font-weight: bold;"
        }
        for (i in 1..maxInning) {
            val run = inningRuns.getOrNull(i - 1)
            val text = when {
                run != null -> run.toString()
                i <= currentInning -> "0"
                else -> "-"
            }
            renderCenterTd(text)
        }
        td {
            +r.toString()
            style = "text-align: center; font-weight: bold;"
        }
        renderCenterTd(h.toString())
        renderCenterTd(e.toString())
    }
}

private fun determineWpName(isCompleted: Boolean, game: Game, localHomeRoster: List<Player>, localAwayRoster: List<Player>, localHomeActivePitcherName: String, localAwayActivePitcherName: String): String {
    return when {
        isCompleted -> if (game.homeScore > game.awayScore)
            (localHomeRoster.find { it.position == BaseballConstants.Positions.P }?.name ?: "Justin Steele")
        else
            (localAwayRoster.find { it.position == BaseballConstants.Positions.P }?.name ?: "Sonny Gray")
        game.homeScore > game.awayScore -> localHomeActivePitcherName
        game.awayScore > game.homeScore -> localAwayActivePitcherName
        else -> "-"
    }
}

private fun determineLpName(isCompleted: Boolean, game: Game, localHomeRoster: List<Player>, localAwayRoster: List<Player>, localHomeActivePitcherName: String, localAwayActivePitcherName: String): String {
    return when {
        isCompleted -> if (game.homeScore < game.awayScore)
            (localHomeRoster.find { it.position == BaseballConstants.Positions.P }?.name ?: "Justin Steele")
        else
            (localAwayRoster.find { it.position == BaseballConstants.Positions.P }?.name ?: "Sonny Gray")
        game.homeScore < game.awayScore -> localHomeActivePitcherName
        game.awayScore < game.homeScore -> localAwayActivePitcherName
        else -> "-"
    }
}

private fun renderPitcherRecords(
    card: DIV,
    game: Game,
    localHomeRoster: List<Player>,
    localAwayRoster: List<Player>,
    localHomeActivePitcherName: String,
    localAwayActivePitcherName: String
) {
    val isCompleted = game.status == GameStatus.COMPLETED
    val wpName = determineWpName(isCompleted, game, localHomeRoster, localAwayRoster, localHomeActivePitcherName, localAwayActivePitcherName)
    val lpName = determineLpName(isCompleted, game, localHomeRoster, localAwayRoster, localHomeActivePitcherName, localAwayActivePitcherName)
    val svName = if (isCompleted && game.homeScore > game.awayScore) "HADER (12)" else if (isCompleted) "NONE" else "-"

    card.div {
        style = "display: flex; flex-direction: column; gap: 0.5rem; border-top: 1px solid #5a544a; padding-top: 0.75rem; font-size: 0.8rem;"
        listOf(
            (if (isCompleted) "WP" else "Potential WP (Hook)") to wpName,
            (if (isCompleted) "LP" else "Potential LP (Hook)") to lpName,
            "SV" to svName
        ).forEach { (label, name) ->
            div {
                +"$label: "
                span {
                    style = "font-weight: bold;"
                    +name
                }
            }
        }
    }
}
