package com.baseball.ui.gametracking.scorebook

import com.baseball.game.BaseballConstants
import com.baseball.models.BoxScore
import com.baseball.models.Game
import com.baseball.models.GameStatus
import com.baseball.models.Player
import com.baseball.models.PlayerPitchingStats
import com.baseball.ui.core.css
import kotlinx.css.Align
import kotlinx.css.Border
import kotlinx.css.BorderCollapse
import kotlinx.css.BorderStyle
import kotlinx.css.Color
import kotlinx.css.Display
import kotlinx.css.FlexDirection
import kotlinx.css.FlexWrap
import kotlinx.css.FontWeight
import kotlinx.css.JustifyContent
import kotlinx.css.LinearDimension
import kotlinx.css.Margin
import kotlinx.css.Overflow
import kotlinx.css.Padding
import kotlinx.css.Position
import kotlinx.css.TextAlign
import kotlinx.css.alignItems
import kotlinx.css.backgroundColor
import kotlinx.css.border
import kotlinx.css.borderBottom
import kotlinx.css.borderCollapse
import kotlinx.css.borderRadius
import kotlinx.css.borderTop
import kotlinx.css.bottom
import kotlinx.css.color
import kotlinx.css.display
import kotlinx.css.flexDirection
import kotlinx.css.flexWrap
import kotlinx.css.fontSize
import kotlinx.css.fontWeight
import kotlinx.css.gap
import kotlinx.css.height
import kotlinx.css.justifyContent
import kotlinx.css.left
import kotlinx.css.margin
import kotlinx.css.marginBottom
import kotlinx.css.marginTop
import kotlinx.css.overflow
import kotlinx.css.overflowY
import kotlinx.css.padding
import kotlinx.css.paddingBottom
import kotlinx.css.paddingTop
import kotlinx.css.pct
import kotlinx.css.position
import kotlinx.css.px
import kotlinx.css.rem
import kotlinx.css.textAlign
import kotlinx.css.top
import kotlinx.css.width
import kotlinx.css.zIndex
import kotlinx.html.DIV
import kotlinx.html.TABLE
import kotlinx.html.TBODY
import kotlinx.html.TR
import kotlinx.html.div
import kotlinx.html.dom.append
import kotlinx.html.h3
import kotlinx.html.js.div
import kotlinx.html.span
import kotlinx.html.table
import kotlinx.html.tbody
import kotlinx.html.td
import kotlinx.html.th
import kotlinx.html.thead
import kotlinx.html.tr
import org.w3c.dom.HTMLDivElement
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

private fun renderDefenseDiagram(
    parent: HTMLDivElement,
    isHomeBatting: Boolean,
    teamState: ScorebookTeamState,
) {
    val cardEl = parent.append.div(classes = "card") {
        css {
            backgroundColor = Color("#f9f7f2")
            border = Border(2.px, BorderStyle.solid, Color("#5a544a"))
            padding = Padding(1.rem)
            color = Color("#2b2a28")
            put("flex", "1 1 300px")
        }
    }
    renderDefenseHeader(cardEl)

    val fieldWrapper = cardEl.append.div {
        css {
            position = Position.relative
            width = 100.pct
            height = 260.px
            backgroundColor = Color("#edf2eb")
            border = Border(1.px, BorderStyle.solid, Color("#c2bcae"))
            borderRadius = 8.px
            overflow = Overflow.hidden
        }
        div {
            css {
                position = Position.absolute
                bottom = 10.px
                left = "calc(50% - 90px)".toCSSValue()
                width = 180.px
                height = 180.px
                borderRadius = 50.pct
                backgroundColor = Color("#e5ccb3")
                zIndex = 1
            }
        }
        div {
            css {
                position = Position.absolute
                bottom = 50.px
                left = "calc(50% - 50px)".toCSSValue()
                width = 100.px
                height = 100.px
                backgroundColor = Color("#cbe1c7")
                border = Border(2.px, BorderStyle.solid, Color.white)
                put("transform", "rotate(45deg)")
                zIndex = 2
            }
        }
    }

    val defPlayers = if (isHomeBatting) teamState.awayRoster else teamState.homeRoster
    val activePitcherId = if (isHomeBatting) teamState.awayActivePitcherId else teamState.homeActivePitcherId
    renderPositionNodes(fieldWrapper, defPlayers, activePitcherId)
}

private fun renderDefenseHeader(parent: HTMLDivElement) {
    parent.append {
        h3 {
            +"HOME DEFENSE FIELD"
            css {
                textAlign = TextAlign.center
                margin = Margin(0.px, 0.px, 1.rem, 0.px)
                fontSize = 1.rem
                fontWeight = FontWeight.bold
                borderBottom = Border(1.px, BorderStyle.solid, Color("#c2bcae"))
                paddingBottom = 0.25.rem
            }
        }
    }
}

private fun String.toCSSValue(): LinearDimension = LinearDimension(this)

private fun buildPositionsMap(
    defPlayers: List<Player>,
    activePitcherId: Long,
): Map<String, String> =
    mapOf(
        BaseballConstants.Positions.P to
                (defPlayers.find { it.id == activePitcherId }?.name
                    ?: "Pitcher"),
        BaseballConstants.Positions.C to
                (defPlayers.find { it.position == BaseballConstants.Positions.C }?.name
                    ?: "Catcher"),
        BaseballConstants.Positions.FIRST_BASE to
                (defPlayers.find { it.position == BaseballConstants.Positions.FIRST_BASE }?.name ?: "First Base"),
        BaseballConstants.Positions.SECOND_BASE to
                (defPlayers.find { it.position == BaseballConstants.Positions.SECOND_BASE }?.name ?: "Second Base"),
        BaseballConstants.Positions.THIRD_BASE to
                (defPlayers.find { it.position == BaseballConstants.Positions.THIRD_BASE }?.name ?: "Third Base"),
        BaseballConstants.Positions.SS to
                (defPlayers.find { it.position == BaseballConstants.Positions.SS }?.name ?: "Shortstop"),
        BaseballConstants.Positions.LF to
                (defPlayers.find { it.position == BaseballConstants.Positions.LF }?.name ?: "Left Field"),
        BaseballConstants.Positions.CF to
                (defPlayers.find { it.position == BaseballConstants.Positions.CF }?.name ?: "Center Field"),
        BaseballConstants.Positions.RF to
                (defPlayers.find { it.position == BaseballConstants.Positions.RF }?.name ?: "Right Field"),
    )

private fun renderPositionNodes(
    fieldWrapper: HTMLDivElement,
    defPlayers: List<Player>,
    activePitcherId: Long,
) {
    val positionsMap = buildPositionsMap(defPlayers, activePitcherId)
    val coords =
        mapOf(
            BaseballConstants.Positions.CF to Pair("10px", "calc(50% - 40px)"),
            BaseballConstants.Positions.LF to Pair("40px", "15px"),
            BaseballConstants.Positions.RF to Pair("40px", "calc(100% - 95px)"),
            BaseballConstants.Positions.SS to Pair("55px", "calc(50% - 75px)"),
            BaseballConstants.Positions.SECOND_BASE to Pair("65px", "calc(50% - 5px)"),
            BaseballConstants.Positions.THIRD_BASE to Pair("130px", "calc(50% - 115px)"),
            BaseballConstants.Positions.FIRST_BASE to Pair("130px", "calc(50% + 35px)"),
            BaseballConstants.Positions.P to Pair("135px", "calc(50% - 40px)"),
            BaseballConstants.Positions.C to Pair("210px", "calc(50% - 40px)"),
        )

    coords.forEach { (pos, coord) ->
        val name = positionsMap[pos] ?: "Def"
        fieldWrapper.append.div {
            css {
                position = Position.absolute
                top = coord.first.toCSSValue()
                left = coord.second.toCSSValue()
                width = 80.px
                display = Display.flex
                flexDirection = FlexDirection.column
                alignItems = Align.center
                zIndex = 10
            }
            span {
                +pos
                css {
                    fontSize = 0.75.rem
                    fontWeight = FontWeight.bold
                    backgroundColor = Color("#ff2a3b")
                    color = Color.white
                    borderRadius = 50.pct
                    width = 18.px
                    height = 18.px
                    display = Display.flex
                    justifyContent = JustifyContent.center
                    alignItems = Align.center
                    border = Border(1.px, BorderStyle.solid, Color.white)
                }
            }
            span {
                +name.substringBefore(" ").take(8)
                css {
                    fontSize = 0.65.rem
                    fontWeight = FontWeight.bold
                    color = Color("#111")
                    backgroundColor = Color("rgba(255, 255, 255, 0.8)")
                    padding = Padding(1.px, 4.px)
                    borderRadius = 3.px
                    marginTop = 2.px
                    textAlign = TextAlign.center
                }
            }
        }
    }
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
    parent: HTMLDivElement,
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
    parent: HTMLDivElement,
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
            renderLineScoreTeamRow(
                LineScoreData(
                    teamAbb = game.awayTeam.abbreviation,
                    inningRuns = boxScore.lineScore.awayInningRuns,
                    currentInning = game.gameState.inning,
                    r = boxScore.lineScore.awayRuns,
                    h = boxScore.lineScore.awayHits,
                    e = boxScore.lineScore.awayErrors,
                    maxInning = maxInning,
                ),
            )
            renderLineScoreTeamRow(
                LineScoreData(
                    teamAbb = game.homeTeam.abbreviation,
                    inningRuns = boxScore.lineScore.homeInningRuns,
                    currentInning = game.gameState.inning,
                    r = boxScore.lineScore.homeRuns,
                    h = boxScore.lineScore.homeHits,
                    e = boxScore.lineScore.homeErrors,
                    maxInning = maxInning,
                ),
            )
        }
    }
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

private fun determineWpName(
    isCompleted: Boolean,
    game: Game,
    teamState: ScorebookTeamState,
): String =
    when {
        isCompleted ->
            if (game.homeScore > game.awayScore) {
                (teamState.homeRoster.find { it.position == BaseballConstants.Positions.P }?.name ?: "Justin Steele")
            } else {
                (teamState.awayRoster.find { it.position == BaseballConstants.Positions.P }?.name ?: "Sonny Gray")
            }

        game.homeScore > game.awayScore -> teamState.homeActivePitcherName
        game.awayScore > game.homeScore -> teamState.awayActivePitcherName
        else -> "-"
    }

private fun determineLpName(
    isCompleted: Boolean,
    game: Game,
    teamState: ScorebookTeamState,
): String =
    when {
        isCompleted ->
            if (game.homeScore < game.awayScore) {
                (teamState.homeRoster.find { it.position == BaseballConstants.Positions.P }?.name ?: "Justin Steele")
            } else {
                (teamState.awayRoster.find { it.position == BaseballConstants.Positions.P }?.name ?: "Sonny Gray")
            }

        game.homeScore < game.awayScore -> teamState.homeActivePitcherName
        game.awayScore < game.homeScore -> teamState.awayActivePitcherName
        else -> "-"
    }

private fun DIV.renderPitcherRecords(
    game: Game,
    teamState: ScorebookTeamState,
) {
    val isCompleted = game.status == GameStatus.COMPLETED
    val wpName =
        determineWpName(
            isCompleted,
            game,
            teamState
        )
    val lpName =
        determineLpName(
            isCompleted,
            game,
            teamState
        )
    val svName =
        if (isCompleted && game.homeScore > game.awayScore) {
            "HADER (12)"
        } else if (isCompleted) {
            "NONE"
        } else {
            "-"
        }

    div {
        css {
            display = Display.flex
            flexDirection = FlexDirection.column
            gap = 0.5.rem
            borderTop = Border(
                1.px,
                BorderStyle.solid,
                Color("#5a544a")
            )
            paddingTop = 0.75.rem
            fontSize = 0.8.rem
        }
        listOf(
            (if (isCompleted) "WP" else "Potential WP (Hook)") to wpName,
            (if (isCompleted) "LP" else "Potential LP (Hook)") to lpName,
            "SV" to svName,
        ).forEach { (label, name) ->
            renderRecordRow(label, name)
        }
    }
}

private fun HTMLDivElement.renderStatsCard(title: String, block: DIV.() -> Unit) {
    append.div(classes = "card") {
        css {
            backgroundColor = Color("#f9f7f2")
            border = Border(2.px, BorderStyle.solid, Color("#5a544a"))
            padding = Padding(1.rem)
            color = Color("#2b2a28")
            put("flex", "1 1 300px")
        }
        h3 {
            +title
            css {
                textAlign = TextAlign.center
                margin = Margin(0.px, 0.px, 1.rem, 0.px)
                fontSize = 1.rem
                fontWeight = FontWeight.bold
                borderBottom = Border(1.px, BorderStyle.solid, Color("#c2bcae"))
                paddingBottom = 0.25.rem
            }
        }
        block()
    }
}

private fun DIV.renderRecordRow(label: String, name: String) {
    div {
        +"$label: "
        span {
            css { fontWeight = FontWeight.bold }
            +name
        }
    }
}
