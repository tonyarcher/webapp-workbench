package com.baseball.ui.tabs

import com.baseball.game.localBoxScore
import com.baseball.game.localEvents
import com.baseball.game.localGame
import com.baseball.models.*
import com.baseball.ui.*
import kotlinx.css.*
import kotlinx.html.*
import kotlinx.html.dom.append
import kotlinx.html.js.*
import org.w3c.dom.HTMLElement
import org.w3c.dom.HTMLDivElement

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
        td {
            +"${s.playerName} (${s.position})"
            css { fontWeight = FontWeight.bold }
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
        td {
            +s.playerName
            css { fontWeight = FontWeight.bold }
        }
        val whole = s.inningsPitchedThirds / 3
        val rem = s.inningsPitchedThirds % 3
        val ipStr = "$whole.$rem"
        td { +ipStr }
        td { +s.hitsAllowed.toString() }
        td { +s.runsAllowed.toString() }
        td { +s.earnedRuns.toString() }
        td { +s.walksAllowed.toString() }
        td { +s.strikeoutsRecorded.toString() }
        td { +s.homeRunsAllowed.toString() }
    }
}

private fun TBODY.renderEmptyTableMessage(spanCount: Int, message: String) {
    tr {
        td {
            colSpan = spanCount.toString()
            +message
            css {
                color = Color("var(--text-secondary)")
                textAlign = TextAlign.center
            }
        }
    }
}
