package com.baseball.ui.gametracking.scorebook

import com.baseball.models.BoxScore
import com.baseball.models.Game
import com.baseball.models.PlayerPitchingStats
import kotlinx.html.DIV
import kotlinx.html.TABLE
import kotlinx.html.TBODY
import kotlinx.html.TR
import kotlinx.html.div
import kotlinx.html.dom.append
import kotlinx.html.h3
import kotlinx.html.table
import kotlinx.html.tbody
import kotlinx.html.td
import kotlinx.html.th
import kotlinx.html.thead
import kotlinx.html.tr
import org.w3c.dom.HTMLElement

fun renderScorebookBottomSection(
    container: HTMLElement,
    isHomeBatting: Boolean,
    teamState: ScorebookTeamState,
    data: ScorebookSectionData,
) {
    container.append.div(classes = "flex-gap-md") {
        renderDefenseDiagram(this, isHomeBatting, teamState)
        renderOpposingPitchingStats(this, isHomeBatting, data.boxScore)
        renderScoreboardSummary(this, data)
    }
}

private fun renderOpposingPitchingStats(
    parent: DIV,
    isHomeBatting: Boolean,
    boxScore: BoxScore,
) {
    parent.div(classes = "card field-diagram-card") {
        h3 { +"OPPOSING PITCHING STATS" }
        val pStatsList = if (isHomeBatting) boxScore.awayPitching else boxScore.homePitching
        div(classes = "table-container") {
            table {
                renderPitchingHeader()
                tbody {
                    pStatsList.forEach { p -> renderPitcherRow(this, p) }
                }
            }
        }
    }
}

private fun TABLE.renderPitchingHeader() {
    thead {
        tr {
            listOf("PITCHER", "R/L", "IP", "BF", "H", "R", "ER", "BB", "K").forEach { h ->
                th(classes = if (h == "PITCHER") "text-left" else "text-center") {
                    +h
                }
            }
        }
    }
}

private fun TR.renderCenterTd(text: String) {
    td(classes = "text-center") {
        +text
    }
}

private fun renderPitcherRow(
    tbody: TBODY,
    p: PlayerPitchingStats,
) {
    tbody.tr {
        td(classes = "font-bold") {
            +p.playerName
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
    parent: DIV,
    data: ScorebookSectionData,
) {
    parent.div(classes = "card field-diagram-card") {
        h3(classes = "text-center font-bold") {
            +"SCOREBOARD SUMMARY"
        }
        renderLineScoreTable(data.game, data.boxScore, data.maxInning)
    }
}

private fun TABLE.renderLineScoreHeader(maxInning: Int) {
    thead {
        tr {
            th(classes = "text-left") {
                +"TEAM"
            }
            for (i in 1..maxInning) {
                th(classes = "text-center") {
                    +i.toString()
                }
            }
            listOf("R", "H", "E").forEach { h ->
                th(classes = if (h == "R") "text-center font-bold" else "text-center") {
                    +h
                }
            }
        }
    }
}

private fun DIV.renderLineScoreTable(
    game: Game,
    boxScore: BoxScore,
    maxInning: Int,
) {
    table {
        renderLineScoreHeader(maxInning)
        tbody {
            renderLineScoreTeamRow(buildLineScoreData(isHome = false, game, boxScore, maxInning))
            renderLineScoreTeamRow(buildLineScoreData(isHome = true, game, boxScore, maxInning))
        }
    }
}

private fun buildLineScoreData(
    isHome: Boolean,
    game: Game,
    boxScore: BoxScore,
    maxInning: Int,
): LineScoreData {
    val team = if (isHome) game.homeTeam else game.awayTeam
    val inningRuns = if (isHome) boxScore.lineScore.homeInningRuns else boxScore.lineScore.awayInningRuns
    val r = if (isHome) boxScore.lineScore.homeRuns else boxScore.lineScore.awayRuns
    val h = if (isHome) boxScore.lineScore.homeHits else boxScore.lineScore.awayHits
    val e = if (isHome) boxScore.lineScore.homeErrors else boxScore.lineScore.awayErrors

    return LineScoreData(
        teamAbb = team.abbreviation,
        inningRuns = inningRuns,
        currentInning = game.gameState.inning,
        r = r,
        h = h,
        e = e,
        maxInning = maxInning,
    )
}

private fun TBODY.renderLineScoreTeamRow(data: LineScoreData) {
    tr {
        td(classes = "font-bold") {
            +data.teamAbb
        }
        for (i in 1..data.maxInning) {
            val run = data.inningRuns.getOrNull(i - 1)
            val text =
                when {
                    run != null -> run.toString()
                    i <= data.currentInning -> "0"
                    else -> "-"
                }
            renderCenterTd(text)
        }
        td(classes = "text-center font-bold") {
            +data.r.toString()
        }
        renderCenterTd(data.h.toString())
        renderCenterTd(data.e.toString())
    }
}
