package com.baseball.ui.gametracking.scorebook

import com.baseball.game.BaseballConstants
import com.baseball.models.Player
import kotlinx.browser.document
import kotlinx.html.DIV
import kotlinx.html.div
import kotlinx.html.id
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import org.w3c.dom.HTMLElement

@Serializable
private data class FielderJs(
    val position: String,
    val name: String,
)

fun renderDefenseDiagram(
    parent: DIV,
    isHomeBatting: Boolean,
    teamState: ScorebookTeamState,
) {
    val defPlayers = if (isHomeBatting) teamState.awayRoster else teamState.homeRoster
    val activePitcherId = if (isHomeBatting) teamState.awayActivePitcherId else teamState.homeActivePitcherId
    val activePitcherName = if (isHomeBatting) teamState.awayActivePitcherName else teamState.homeActivePitcherName

    val positions = listOf("P", "C", "1B", "2B", "3B", "SS", "LF", "CF", "RF")
    val fielders = positions.map { posCode ->
        val pName = getFielderName(posCode, defPlayers, activePitcherId, activePitcherName)
        FielderJs(posCode, pName)
    }

    val jsonString = Json.encodeToString(fielders)
    parent.div {
        id = "defense-diagram-mount-point"
    }

    val mountPoint = document.getElementById("defense-diagram-mount-point") as? HTMLElement
    if (mountPoint != null) {
        mountPoint.innerHTML = ""
        val diagram = document.createElement("baseball-defense-diagram")
        diagram.setAttribute("fielders-json", jsonString)
        mountPoint.appendChild(diagram)
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
