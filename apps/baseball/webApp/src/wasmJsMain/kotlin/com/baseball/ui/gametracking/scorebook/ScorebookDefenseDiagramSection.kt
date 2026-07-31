package com.baseball.ui.gametracking.scorebook

import com.baseball.game.BaseballConstants
import com.baseball.models.Player
import com.baseball.ui.core.css
import kotlinx.css.Position
import kotlinx.css.left
import kotlinx.css.position
import kotlinx.css.top
import kotlinx.html.DIV
import kotlinx.html.div
import kotlinx.html.dom.append
import kotlinx.html.h3
import kotlinx.html.id
import kotlinx.html.span
import org.w3c.dom.HTMLElement

fun renderDefenseDiagram(
    parent: DIV,
    isHomeBatting: Boolean,
    teamState: ScorebookTeamState,
) {
    ScorebookFieldDiagramRenderer.renderDefenseDiagram(parent, isHomeBatting, teamState)
}

private object ScorebookFieldDiagramRenderer {
    fun renderDefenseDiagram(
        parent: DIV,
        isHomeBatting: Boolean,
        teamState: ScorebookTeamState,
    ) {
        var fieldWrapper: HTMLElement? = null
        parent.div(classes = "field-diagram-card card") {
            renderDefenseHeader()
            fieldWrapper = div(classes = "field-diagram-wrapper") {
                renderDefenseFieldDiamond()
            } as HTMLElement
        }

        val defPlayers = if (isHomeBatting) teamState.awayRoster else teamState.homeRoster
        val activePitcherId = if (isHomeBatting) teamState.awayActivePitcherId else teamState.homeActivePitcherId
        val activePitcherName = if (isHomeBatting) teamState.awayActivePitcherName else teamState.homeActivePitcherName

        val fw = fieldWrapper ?: return
        renderFielderBadges(fw, defPlayers, activePitcherId, activePitcherName)
    }

    private fun DIV.renderDefenseHeader() {
        h3 {
            +"DEFENSIVE POSITIONS"
        }
    }

    private fun DIV.renderDefenseFieldDiamond() {
        div {
            id = "field-diamond-bg"
        }
    }

    private fun renderFielderBadges(
        fieldWrapper: HTMLElement,
        defPlayers: List<Player>,
        activePitcherId: Long?,
        activePitcherName: String,
    ) {
        val positions = listOf(
            Triple("P", "50%", "55%"),
            Triple("C", "50%", "85%"),
            Triple("1B", "72%", "52%"),
            Triple("2B", "60%", "38%"),
            Triple("3B", "28%", "52%"),
            Triple("SS", "40%", "38%"),
            Triple("LF", "20%", "22%"),
            Triple("CF", "50%", "15%"),
            Triple("RF", "80%", "22%")
        )

        positions.forEach { (posCode, x, y) ->
            val pName = getFielderName(posCode, defPlayers, activePitcherId, activePitcherName)
            renderFielderBadge(fieldWrapper, posCode, pName, x, y)
        }
    }

    private fun getFielderName(
        posCode: String,
        defPlayers: List<Player>,
        activePitcherId: Long?,
        activePitcherName: String,
    ): String {
        if (posCode == BaseballConstants.Positions.P) {
            return if (activePitcherName.isNotBlank()) activePitcherName else "Pitcher"
        }
        return defPlayers.find { it.position == posCode || it.id == activePitcherId }?.name ?: posCode
    }

    private fun renderFielderBadge(
        fieldWrapper: HTMLElement,
        posCode: String,
        playerName: String,
        leftPct: String,
        topPct: String,
    ) {
        fieldWrapper.append.div(classes = "field-position-badge") {
            css {
                position = Position.absolute
                left = kotlinx.css.LinearDimension(leftPct)
                top = kotlinx.css.LinearDimension(topPct)
            }
            span(classes = "font-bold") {
                +"$posCode: $playerName"
            }
        }
    }
}
