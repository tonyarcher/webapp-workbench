package com.baseball.ui.gametracking.scorebook

import com.baseball.game.BaseballConstants
import com.baseball.models.Player
import kotlinx.html.DIV
import kotlinx.html.div
import kotlinx.html.h3
import kotlinx.html.id
import kotlinx.html.span

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
        val defPlayers = if (isHomeBatting) teamState.awayRoster else teamState.homeRoster
        val activePitcherId = if (isHomeBatting) teamState.awayActivePitcherId else teamState.homeActivePitcherId
        val activePitcherName = if (isHomeBatting) teamState.awayActivePitcherName else teamState.homeActivePitcherName

        parent.div(classes = "field-diagram-card card") {
            renderDefenseHeader()
            div(classes = "field-diagram-wrapper") {
                renderDefenseFieldDiamond()
                renderFielderBadges(this, defPlayers, activePitcherId, activePitcherName)
            }
        }
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
        fieldWrapper: DIV,
        defPlayers: List<Player>,
        activePitcherId: Long?,
        activePitcherName: String,
    ) {
        val positions = listOf("P", "C", "1B", "2B", "3B", "SS", "LF", "CF", "RF")

        positions.forEach { posCode ->
            val pName = getFielderName(posCode, defPlayers, activePitcherId, activePitcherName)
            renderFielderBadge(fieldWrapper, posCode, pName)
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
        fieldWrapper: DIV,
        posCode: String,
        playerName: String,
    ) {
        fieldWrapper.div(classes = "field-position-badge pos-pos-$posCode") {
            span(classes = "font-bold") {
                +"$posCode: $playerName"
            }
        }
    }
}
