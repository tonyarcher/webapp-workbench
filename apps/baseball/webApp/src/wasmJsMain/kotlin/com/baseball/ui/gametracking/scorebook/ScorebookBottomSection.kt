package com.baseball.ui.gametracking.scorebook

import com.baseball.models.BoxScore
import com.baseball.models.Game
import com.baseball.models.PlayerPitchingStats
import com.baseball.ui.core.css
import kotlinx.css.Border
import kotlinx.css.BorderCollapse
import kotlinx.css.BorderStyle
import kotlinx.css.Color
import kotlinx.css.Display
import kotlinx.css.FlexWrap
import kotlinx.css.FontWeight
import kotlinx.css.Margin
import kotlinx.css.Overflow
import kotlinx.css.Padding
import kotlinx.css.TextAlign
import kotlinx.css.backgroundColor
import kotlinx.css.border
import kotlinx.css.borderBottom
import kotlinx.css.borderCollapse
import kotlinx.css.color
import kotlinx.css.display
import kotlinx.css.flexWrap
import kotlinx.css.fontSize
import kotlinx.css.fontWeight
import kotlinx.css.gap
import kotlinx.css.height
import kotlinx.css.margin
import kotlinx.css.marginBottom
import kotlinx.css.marginTop
import kotlinx.css.overflowY
import kotlinx.css.padding
import kotlinx.css.paddingBottom
import kotlinx.css.pct
import kotlinx.css.px
import kotlinx.css.rem
import kotlinx.css.textAlign
import kotlinx.css.width
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
import org.w3c.dom.Element
import org.w3c.dom.HTMLElement

fun renderScorebookBottomSection(
    container: HTMLElement,
    isHomeBatting: Boolean,
    teamState: ScorebookTeamState,
    data: ScorebookSectionData,
) {
    val bottomGrid =
        container.append.div {
            css {
                display = Display.flex
                flexWrap = FlexWrap.wrap
                gap = 1.5.rem
                marginTop = 1.5.rem
            }
        }

    renderDefenseDiagram(
        bottomGrid,
        isHomeBatting,
        teamState
    )
    renderOpposingPitchingStats(bottomGrid, isHomeBatting, data.boxScore)
    renderScoreboardSummary(
        bottomGrid,
        data,
        teamState,
    )
}

private fun TABLE.renderPitchingHeader() {
    thead {
        css { backgroundColor = Color("#eae5dc") }
        tr {
            css { borderBottom = Border(1.px, BorderStyle.solid, Color("#5a544a")) }
            listOf("PITCHER", "R/L", "IP", "BF", "H", "R", "ER", "BB", "K").forEach { h ->
                th {
                    +h
                    css {
                        padding = Padding(4.px)
                        textAlign = if (h == "PITCHER") TextAlign.left else TextAlign.center
                    }
                }
            }
        }
    }
}

private fun renderOpposingPitchingStats(
    parent: Element,
    isHomeBatting: Boolean,
    boxScore: BoxScore,
) {
    parent.renderStatsCard("OPPOSING PITCHING STATS") {
        val pStatsList = if (isHomeBatting) boxScore.awayPitching else boxScore.homePitching
        div {
            css {
                overflowY = Overflow.auto
                height = 260.px
            }
            table {
                css {
                    width = 100.pct
                    borderCollapse = BorderCollapse.collapse
                    fontSize = 0.8.rem
                }
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
        css { textAlign = TextAlign.center }
    }
}

private fun renderPitcherRow(
    tbody: TBODY,
    p: PlayerPitchingStats,
) {
    tbody.tr {
        css { borderBottom = Border(1.px, BorderStyle.solid, Color("#c2bcae")) }
        td {
            +p.playerName
            css {
                fontWeight = FontWeight.bold
                padding = Padding(6.px, 4.px)
            }
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
    parent: Element,
    data: ScorebookSectionData,
    teamState: ScorebookTeamState,
) {
    parent.append.div(classes = "card") {
        css {
            backgroundColor = Color("#eae5dc")
            border = Border(2.px, BorderStyle.solid, Color("#5a544a"))
            padding = Padding(1.rem)
            color = Color("#2b2a28")
            put("flex", "1 1 280px")
        }
        h3 {
            +"SCOREBOARD SUMMARY"
            css {
                textAlign = TextAlign.center
                margin = Margin(0.px, 0.px, 1.rem, 0.px)
                fontSize = 1.rem
                fontWeight = FontWeight.bold
                borderBottom = Border(1.px, BorderStyle.solid, Color("#5a544a"))
                paddingBottom = 0.25.rem
            }
        }
        renderLineScoreTable(data.game, data.boxScore, data.maxInning)
        renderPitcherRecords(
            data.game,
            teamState,
        )
    }
}

private fun TABLE.renderLineScoreHeader(maxInning: Int) {
    thead {
        tr {
            css { borderBottom = Border(1.px, BorderStyle.solid, Color("#5a544a")) }
            th {
                +"TEAM"
                css { textAlign = TextAlign.left }
            }
            for (i in 1..maxInning) {
                th {
                    +i.toString()
                    css { textAlign = TextAlign.center }
                }
            }
            listOf("R", "H", "E").forEach { h ->
                th {
                    +h
                    css {
                        textAlign = TextAlign.center
                        if (h == "R") fontWeight = FontWeight.bold
                    }
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
        css {
            width = 100.pct
            borderCollapse = BorderCollapse.collapse
            marginBottom = 1.5.rem
            fontSize = 0.85.rem
        }
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
        css { borderBottom = Border(1.px, BorderStyle.solid, Color("#c2bcae")) }
        td {
            +data.teamAbb
            css { fontWeight = FontWeight.bold }
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
        td {
            +data.r.toString()
            css {
                textAlign = TextAlign.center
                fontWeight = FontWeight.bold
            }
        }
        renderCenterTd(data.h.toString())
        renderCenterTd(data.e.toString())
    }
}
