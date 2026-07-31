package com.baseball.ui.tabs.boxscore

import com.baseball.models.Game
import com.baseball.models.LineScore
import com.baseball.models.PlayerBattingStats
import com.baseball.models.PlayerPitchingStats
import kotlinx.html.TABLE
import kotlinx.html.TBODY
import kotlinx.html.dom.append
import kotlinx.html.js.div
import kotlinx.html.table
import kotlinx.html.tbody
import kotlinx.html.td
import kotlinx.html.th
import kotlinx.html.thead
import kotlinx.html.tr
import org.w3c.dom.HTMLElement

internal fun renderLineScoreTable(
    parent: HTMLElement,
    lineScore: LineScore,
    game: Game,
) {
    parent.append {
        div(classes = "table-container") {
            table(classes = "linescore-table") {
                renderLineScoreHeader(lineScore.awayInningRuns.size)
                tbody {
                    renderLineScoreRow(
                        game.awayTeam.name,
                        lineScore.awayInningRuns,
                        lineScore.awayRuns,
                        lineScore.awayHits,
                        lineScore.awayErrors,
                    )
                    renderLineScoreRow(
                        game.homeTeam.name,
                        lineScore.homeInningRuns,
                        lineScore.homeRuns,
                        lineScore.homeHits,
                        lineScore.homeErrors,
                    )
                }
            }
        }
    }
}

private fun TABLE.renderLineScoreHeader(inningCount: Int) {
    thead {
        tr {
            th { +"Team" }
            for (i in 1..inningCount) {
                th { +i.toString() }
            }
            th(classes = "linescore-stat") { +"R" }
            th(classes = "linescore-stat") { +"H" }
            th(classes = "linescore-stat") { +"E" }
        }
    }
}

private fun TBODY.renderLineScoreRow(
    teamName: String,
    inningRuns: List<Int?>,
    runs: Int,
    hits: Int,
    errors: Int
) {
    tr {
        td(classes = "linescore-team") { +teamName }
        inningRuns.forEach { r ->
            td { +(r?.toString() ?: "-") }
        }
        td(classes = "linescore-stat") { +runs.toString() }
        td(classes = "linescore-stat") { +hits.toString() }
        td(classes = "linescore-stat") { +errors.toString() }
    }
}

internal fun renderBattingTable(
    parent: HTMLElement,
    list: List<PlayerBattingStats>,
) {
    parent.append {
        div(classes = "table-container") {
            table {
                thead {
                    tr {
                        th { +"Player (Pos)" }
                        th { +"AB" }
                        th { +"R" }
                        th { +"H" }
                        th { +"RBI" }
                        th { +"BB" }
                        th { +"SO" }
                        th { +"HR" }
                    }
                }
                tbody {
                    if (list.isEmpty()) {
                        renderEmptyTableMessage(8, "No batting stats recorded yet.")
                    } else {
                        list.forEach { s -> renderBattingRow(s) }
                    }
                }
            }
        }
    }
}

private fun TBODY.renderBattingRow(s: PlayerBattingStats) {
    tr {
        td(classes = "font-bold") {
            +"${s.playerName} (${s.position})"
        }
        td { +s.atBats.toString() }
        td { +s.runs.toString() }
        td { +s.hits.toString() }
        td { +s.rbi.toString() }
        td { +s.walks.toString() }
        td { +s.strikeOuts.toString() }
        td { +s.homeRuns.toString() }
    }
}

internal fun renderPitchingTable(
    parent: HTMLElement,
    list: List<PlayerPitchingStats>,
) {
    parent.append {
        div(classes = "table-container") {
            table {
                thead {
                    tr {
                        th { +"Pitcher" }
                        th { +"IP" }
                        th { +"H" }
                        th { +"R" }
                        th { +"ER" }
                        th { +"BB" }
                        th { +"SO" }
                        th { +"HR" }
                    }
                }
                tbody {
                    if (list.isEmpty()) {
                        renderEmptyTableMessage(8, "No pitching stats recorded yet.")
                    } else {
                        list.forEach { s -> renderPitchingRow(s) }
                    }
                }
            }
        }
    }
}

private fun TBODY.renderPitchingRow(s: PlayerPitchingStats) {
    tr {
        td(classes = "font-bold") {
            +s.playerName
        }
        val whole = s.inningsPitchedThirds / 3
        val rem = s.inningsPitchedThirds % 3
        val ipStr = "$whole.$rem"
        td { +ipStr }
        td { +s.hitsAllowed.toString() }
        td { +s.runsAllowed.toString() }
        td { +s.earnedRuns.toString() }
        td { +s.walksAllowed.toString() }
        td { +s.walksAllowed.toString() }
        td { +s.strikeoutsRecorded.toString() }
        td { +s.homeRunsAllowed.toString() }
    }
}

private fun TBODY.renderEmptyTableMessage(spanCount: Int, message: String) {
    tr {
        td(classes = "text-muted text-center") {
            colSpan = spanCount.toString()
            +message
        }
    }
}
