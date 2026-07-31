package com.baseball.ui.gametracking.scorebook

import com.baseball.game.BaseballConstants
import com.baseball.models.Game
import com.baseball.models.GameStatus
import com.baseball.models.Player
import com.baseball.ui.core.css
import kotlinx.css.Align
import kotlinx.css.Border
import kotlinx.css.BorderStyle
import kotlinx.css.Color
import kotlinx.css.Display
import kotlinx.css.FlexDirection
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
import kotlinx.css.borderRadius
import kotlinx.css.borderTop
import kotlinx.css.bottom
import kotlinx.css.color
import kotlinx.css.display
import kotlinx.css.flexDirection
import kotlinx.css.fontSize
import kotlinx.css.fontWeight
import kotlinx.css.gap
import kotlinx.css.height
import kotlinx.css.justifyContent
import kotlinx.css.left
import kotlinx.css.margin
import kotlinx.css.marginTop
import kotlinx.css.overflow
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
import kotlinx.html.div
import kotlinx.html.dom.append
import kotlinx.html.h3
import kotlinx.html.span
import org.w3c.dom.Element

internal fun renderDefenseDiagram(
    parent: Element,
    isHomeBatting: Boolean,
    teamState: ScorebookTeamState,
) {
    ScorebookFieldDiagramRenderer.renderDefenseDiagram(parent, isHomeBatting, teamState)
}

private fun String.toCSSValue(): LinearDimension = LinearDimension(this)

private object ScorebookFieldDiagramRenderer {
    fun renderDefenseDiagram(
        parent: Element,
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
        }
        renderDefenseFieldDiamond(fieldWrapper)

        val defPlayers = if (isHomeBatting) teamState.awayRoster else teamState.homeRoster
        val activePitcherId = if (isHomeBatting) teamState.awayActivePitcherId else teamState.homeActivePitcherId
        renderPositionNodes(fieldWrapper, defPlayers, activePitcherId)
    }

    private fun renderDefenseHeader(parent: Element) {
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

    private fun renderDefenseFieldDiamond(fieldWrapper: Element) {
        fieldWrapper.append.div {
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
        fieldWrapper.append.div {
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

    private fun buildPositionsMap(
        defPlayers: List<Player>,
        activePitcherId: Long,
    ): Map<String, String> =
        mapOf(
            BaseballConstants.Positions.P to
                    (defPlayers.find { it.id == activePitcherId }?.name ?: "Pitcher"),
            BaseballConstants.Positions.C to
                    (defPlayers.find { it.position == BaseballConstants.Positions.C }?.name ?: "Catcher"),
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
        fieldWrapper: Element,
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
            renderPositionNode(fieldWrapper, pos, coord, name)
        }
    }

    private fun renderPositionNode(
        fieldWrapper: Element,
        pos: String,
        coord: Pair<String, String>,
        name: String,
    ) {
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
            renderPositionBadge(pos)
            renderPositionLabel(name)
        }
    }

    private fun DIV.renderPositionBadge(pos: String) {
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
    }

    private fun DIV.renderPositionLabel(name: String) {
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

internal fun determineWpName(
    isCompleted: Boolean,
    game: Game,
    teamState: ScorebookTeamState,
): String = determineDecisionPitcher(isWinning = true, isCompleted, game, teamState)

internal fun determineLpName(
    isCompleted: Boolean,
    game: Game,
    teamState: ScorebookTeamState,
): String = determineDecisionPitcher(isWinning = false, isCompleted, game, teamState)

private fun determineDecisionPitcher(
    isWinning: Boolean,
    isCompleted: Boolean,
    game: Game,
    teamState: ScorebookTeamState,
): String {
    val homeWon = game.homeScore > game.awayScore
    val awayWon = game.awayScore > game.homeScore
    val targetHome = if (isWinning) homeWon else game.homeScore < game.awayScore
    val targetAway = if (isWinning) awayWon else game.awayScore < game.homeScore

    return when {
        isCompleted -> if (targetHome) {
            (teamState.homeRoster.find { it.position == BaseballConstants.Positions.P }?.name ?: "Justin Steele")
        } else {
            (teamState.awayRoster.find { it.position == BaseballConstants.Positions.P }?.name ?: "Sonny Gray")
        }

        targetHome -> teamState.homeActivePitcherName
        targetAway -> teamState.awayActivePitcherName
        else -> "-"
    }
}

internal fun determineSvName(
    isCompleted: Boolean,
    game: Game,
): String =
    if (isCompleted && game.homeScore > game.awayScore) {
        "HADER (12)"
    } else if (isCompleted) {
        "NONE"
    } else {
        "-"
    }

internal fun DIV.renderPitcherRecords(
    game: Game,
    teamState: ScorebookTeamState,
) {
    val isCompleted = game.status == GameStatus.COMPLETED
    val wpName = determineWpName(isCompleted, game, teamState)
    val lpName = determineLpName(isCompleted, game, teamState)
    val svName = determineSvName(isCompleted, game)

    div {
        css {
            display = Display.flex
            flexDirection = FlexDirection.column
            gap = 0.5.rem
            borderTop = Border(1.px, BorderStyle.solid, Color("#5a544a"))
            paddingTop = 0.75.rem
            fontSize = 0.8.rem
        }
        getPitcherRecords(isCompleted, wpName, lpName, svName).forEach { (label, name) ->
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

private fun getPitcherRecords(
    isCompleted: Boolean,
    wpName: String,
    lpName: String,
    svName: String,
) = listOf(
    (if (isCompleted) "WP" else "Potential WP (Hook)") to wpName,
    (if (isCompleted) "LP" else "Potential LP (Hook)") to lpName,
    "SV" to svName,
)

internal fun Element.renderStatsCard(title: String, block: DIV.() -> Unit) {
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
