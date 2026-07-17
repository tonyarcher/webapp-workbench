package com.baseball.ui.components.scorebook

import com.baseball.BaseballConstants
import com.baseball.models.*
import com.baseball.ui.css
import kotlinx.css.*
import kotlinx.html.*
import kotlinx.html.dom.append
import kotlinx.html.js.div
import org.w3c.dom.HTMLDivElement
import org.w3c.dom.HTMLElement

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
    localHomeActivePitcherName: String,
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

    renderDefenseDiagram(bottomGrid, isHomeBatting, localAwayRoster, localHomeRoster, localAwayActivePitcherId, localHomeActivePitcherId)
    renderOpposingPitchingStats(bottomGrid, isHomeBatting, boxScore)
    renderScoreboardSummary(
        bottomGrid,
        game,
        boxScore,
        maxInning,
        localHomeRoster,
        localAwayRoster,
        localHomeActivePitcherName,
        localAwayActivePitcherName,
    )
}

private fun renderDefenseDiagram(
    parent: HTMLDivElement,
    isHomeBatting: Boolean,
    localAwayRoster: List<Player>,
    localHomeRoster: List<Player>,
    localAwayActivePitcherId: Long,
    localHomeActivePitcherId: Long,
) {
    val cardEl =
        parent.append.div(classes = "card") {
            css {
                backgroundColor = Color("#f9f7f2")
                border = Border(2.px, BorderStyle.solid, Color("#5a544a"))
                padding = Padding(1.rem)
                color = Color("#2b2a28")
                put("flex", "1 1 300px")
            }
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

    val fieldWrapper =
        cardEl.append.div {
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

    val defPlayers = if (isHomeBatting) localAwayRoster else localHomeRoster
    val activePitcherId = if (isHomeBatting) localAwayActivePitcherId else localHomeActivePitcherId
    renderPositionNodes(fieldWrapper, defPlayers, activePitcherId)
}

private fun String.toCSSValue(): LinearDimension = LinearDimension(this)

private fun buildPositionsMap(
    defPlayers: List<Player>,
    activePitcherId: Long,
): Map<String, String> =
    mapOf(
        BaseballConstants.Positions.P to (defPlayers.find { it.id == activePitcherId }?.name ?: "Pitcher"),
        BaseballConstants.Positions.C to (defPlayers.find { it.position == BaseballConstants.Positions.C }?.name ?: "Catcher"),
        BaseballConstants.Positions.FIRST_BASE to
            (defPlayers.find { it.position == BaseballConstants.Positions.FIRST_BASE }?.name ?: "First Base"),
        BaseballConstants.Positions.SECOND_BASE to
            (defPlayers.find { it.position == BaseballConstants.Positions.SECOND_BASE }?.name ?: "Second Base"),
        BaseballConstants.Positions.THIRD_BASE to
            (defPlayers.find { it.position == BaseballConstants.Positions.THIRD_BASE }?.name ?: "Third Base"),
        BaseballConstants.Positions.SS to (defPlayers.find { it.position == BaseballConstants.Positions.SS }?.name ?: "Shortstop"),
        BaseballConstants.Positions.LF to (defPlayers.find { it.position == BaseballConstants.Positions.LF }?.name ?: "Left Field"),
        BaseballConstants.Positions.CF to (defPlayers.find { it.position == BaseballConstants.Positions.CF }?.name ?: "Center Field"),
        BaseballConstants.Positions.RF to (defPlayers.find { it.position == BaseballConstants.Positions.RF }?.name ?: "Right Field"),
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
    parent.append.div(classes = "card") {
        css {
            backgroundColor = Color("#f9f7f2")
            border = Border(2.px, BorderStyle.solid, Color("#5a544a"))
            padding = Padding(1.rem)
            color = Color("#2b2a28")
            put("flex", "1 1 320px")
        }
        h3 {
            +"OPPOSING PITCHING STATS"
            css {
                textAlign = TextAlign.center
                margin = Margin(0.px, 0.px, 1.rem, 0.px)
                fontSize = 1.rem
                fontWeight = FontWeight.bold
                borderBottom = Border(1.px, BorderStyle.solid, Color("#c2bcae"))
                paddingBottom = 0.25.rem
            }
        }
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
    game: Game,
    boxScore: BoxScore,
    maxInning: Int,
    localHomeRoster: List<Player>,
    localAwayRoster: List<Player>,
    localHomeActivePitcherName: String,
    localAwayActivePitcherName: String,
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
        renderLineScoreTable(this, game, boxScore, maxInning)
        renderPitcherRecords(this, game, localHomeRoster, localAwayRoster, localHomeActivePitcherName, localAwayActivePitcherName)
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

private fun renderLineScoreTable(
    card: DIV,
    game: Game,
    boxScore: BoxScore,
    maxInning: Int,
) {
    card.table {
        css {
            width = 100.pct
            borderCollapse = BorderCollapse.collapse
            marginBottom = 1.5.rem
            fontSize = 0.85.rem
        }
        renderLineScoreHeader(maxInning)
        tbody {
            renderLineScoreTeamRow(
                this,
                game.awayTeam.abbreviation,
                boxScore.lineScore.awayInningRuns,
                game.gameState.inning,
                boxScore.lineScore.awayRuns,
                boxScore.lineScore.awayHits,
                boxScore.lineScore.awayErrors,
                maxInning,
            )
            renderLineScoreTeamRow(
                this,
                game.homeTeam.abbreviation,
                boxScore.lineScore.homeInningRuns,
                game.gameState.inning,
                boxScore.lineScore.homeRuns,
                boxScore.lineScore.homeHits,
                boxScore.lineScore.homeErrors,
                maxInning,
            )
        }
    }
}

private fun renderLineScoreTeamRow(
    tbody: TBODY,
    teamAbb: String,
    inningRuns: List<Int?>,
    currentInning: Int,
    r: Int,
    h: Int,
    e: Int,
    maxInning: Int,
) {
    tbody.tr {
        css { borderBottom = Border(1.px, BorderStyle.solid, Color("#c2bcae")) }
        td {
            +teamAbb
            css { fontWeight = FontWeight.bold }
        }
        for (i in 1..maxInning) {
            val run = inningRuns.getOrNull(i - 1)
            val text =
                when {
                    run != null -> run.toString()
                    i <= currentInning -> "0"
                    else -> "-"
                }
            renderCenterTd(text)
        }
        td {
            +r.toString()
            css {
                textAlign = TextAlign.center
                fontWeight = FontWeight.bold
            }
        }
        renderCenterTd(h.toString())
        renderCenterTd(e.toString())
    }
}

private fun determineWpName(
    isCompleted: Boolean,
    game: Game,
    localHomeRoster: List<Player>,
    localAwayRoster: List<Player>,
    localHomeActivePitcherName: String,
    localAwayActivePitcherName: String,
): String =
    when {
        isCompleted ->
            if (game.homeScore > game.awayScore) {
                (localHomeRoster.find { it.position == BaseballConstants.Positions.P }?.name ?: "Justin Steele")
            } else {
                (localAwayRoster.find { it.position == BaseballConstants.Positions.P }?.name ?: "Sonny Gray")
            }
        game.homeScore > game.awayScore -> localHomeActivePitcherName
        game.awayScore > game.homeScore -> localAwayActivePitcherName
        else -> "-"
    }

private fun determineLpName(
    isCompleted: Boolean,
    game: Game,
    localHomeRoster: List<Player>,
    localAwayRoster: List<Player>,
    localHomeActivePitcherName: String,
    localAwayActivePitcherName: String,
): String =
    when {
        isCompleted ->
            if (game.homeScore < game.awayScore) {
                (localHomeRoster.find { it.position == BaseballConstants.Positions.P }?.name ?: "Justin Steele")
            } else {
                (localAwayRoster.find { it.position == BaseballConstants.Positions.P }?.name ?: "Sonny Gray")
            }
        game.homeScore < game.awayScore -> localHomeActivePitcherName
        game.awayScore < game.homeScore -> localAwayActivePitcherName
        else -> "-"
    }

private fun renderPitcherRecords(
    card: DIV,
    game: Game,
    localHomeRoster: List<Player>,
    localAwayRoster: List<Player>,
    localHomeActivePitcherName: String,
    localAwayActivePitcherName: String,
) {
    val isCompleted = game.status == GameStatus.COMPLETED
    val wpName =
        determineWpName(isCompleted, game, localHomeRoster, localAwayRoster, localHomeActivePitcherName, localAwayActivePitcherName)
    val lpName =
        determineLpName(isCompleted, game, localHomeRoster, localAwayRoster, localHomeActivePitcherName, localAwayActivePitcherName)
    val svName =
        if (isCompleted && game.homeScore > game.awayScore) {
            "HADER (12)"
        } else if (isCompleted) {
            "NONE"
        } else {
            "-"
        }

    card.div {
        css {
            display = Display.flex
            flexDirection = FlexDirection.column
            gap = 0.5.rem
            borderTop = Border(1.px, BorderStyle.solid, Color("#5a544a"))
            paddingTop = 0.75.rem
            fontSize = 0.8.rem
        }
        listOf(
            (if (isCompleted) "WP" else "Potential WP (Hook)") to wpName,
            (if (isCompleted) "LP" else "Potential LP (Hook)") to lpName,
            "SV" to svName,
        ).forEach { (label, name) ->
            div {
                +"$label: "
                span {
                    css { fontWeight = FontWeight.bold }
                    +name
                }
            }
        }
    }
}
